import os
import sqlite3
import tempfile
import unittest

import app

SCHEMA = """
CREATE TABLE journal_ranking (id INTEGER PRIMARY KEY, journal_name TEXT, name_key TEXT, issn TEXT DEFAULT '', eissn TEXT DEFAULT '',
  category TEXT DEFAULT '', indexed_science INTEGER DEFAULT 0, indexed_ssci INTEGER DEFAULT 0, jcr_quartile TEXT DEFAULT '',
  cas_zone INTEGER, cas_top INTEGER DEFAULT 0, impact_factor REAL, warning INTEGER DEFAULT 0, five_year_if REAL, jci REAL,
  jif_rank TEXT DEFAULT '', cas_basic_zone INTEGER, cas_basic_top INTEGER DEFAULT 0);
CREATE TABLE chinese_index (id INTEGER PRIMARY KEY, name_key TEXT, index_type TEXT, detail TEXT DEFAULT '');
CREATE TABLE journal_abbrev (id INTEGER PRIMARY KEY, name_key TEXT, full_name_key TEXT, with_dots INTEGER DEFAULT 0);
CREATE TABLE journal_ajg (id INTEGER PRIMARY KEY, journal_name TEXT, name_key TEXT, ajg_rating TEXT DEFAULT '', ft50 INTEGER DEFAULT 0);
CREATE TABLE ccf_ranking (id INTEGER PRIMARY KEY, name_key TEXT, rank TEXT);
CREATE TABLE journal_ei (id INTEGER PRIMARY KEY, journal_name TEXT, name_key TEXT, issn TEXT DEFAULT '', eissn TEXT DEFAULT '');
CREATE TABLE journal_ft50 (id INTEGER PRIMARY KEY, journal_name TEXT, name_key TEXT);
CREATE TABLE journal_utd24 (id INTEGER PRIMARY KEY, journal_name TEXT, name_key TEXT);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
"""


def make_db() -> str:
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    c = sqlite3.connect(path)
    c.executescript(SCHEMA)
    c.executemany(
        "INSERT INTO journal_ranking(journal_name,name_key,issn,eissn,category,indexed_science,jcr_quartile,cas_zone,cas_top,impact_factor,five_year_if,jci,jif_rank,cas_basic_zone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            ("NATURE", "nature", "0028-0836", "1476-4687", "MULTIDISCIPLINARY SCIENCES", 1, "Q1", 1, 1, 56.1, 60.0, 17.5, "1/134", 1),
            ("Nature Reviews Drug Discovery", "nature reviews drug discovery", "1474-1776", "1474-1784", "PHARMACOLOGY", 1, "Q1", 1, 1, 120.0, 130.0, 30.0, "1/353", 1),
            ("100% Pure_Journal", "100% pure_journal", "1111-2222", "", "TEST", 0, "Q4", 4, 0, 0.5, None, None, "", 4),
        ],
    )
    c.execute("INSERT INTO chinese_index(name_key,index_type,detail) VALUES ('中国社会科学','北核','北大核心')")
    c.execute("INSERT INTO chinese_index(name_key,index_type,detail) VALUES ('nature','CSCD','CSCD核心')")
    c.execute("INSERT INTO journal_abbrev(name_key,full_name_key) VALUES ('nat rev drug discov','nature reviews drug discovery')")
    c.execute("INSERT INTO journal_ajg(journal_name,name_key,ajg_rating,ft50) VALUES ('Nature','nature','4*',1)")
    c.execute("INSERT INTO ccf_ranking(name_key,rank) VALUES ('nature','A')")
    c.execute("INSERT INTO meta(key,value) VALUES ('data_version','v-test')")
    c.commit()
    c.close()
    return path


class JournalApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = make_db()
        cls.conn = app.connect(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()
        os.unlink(cls.path)

    def search(self, q):
        status, body = app.handle(self.conn, "/api/journals/search", {"q": [q]})
        self.assertEqual(status, 200)
        return body

    def test_exact_name_first_then_prefix(self):
        keys = [r["key"] for r in self.search("nature")["results"]]
        self.assertEqual(keys[0], "nature")
        self.assertIn("nature reviews drug discovery", keys)

    def test_case_and_leading_the_ignored(self):
        self.assertEqual(self.search("  THE Nature ")["results"][0]["key"], "nature")

    def test_abbreviation(self):
        self.assertEqual(self.search("nat rev drug discov")["results"][0]["key"], "nature reviews drug discovery")

    def test_issn_with_and_without_hyphen(self):
        for q in ("0028-0836", "00280836", "1476-4687"):
            self.assertEqual(self.search(q)["results"][0]["key"], "nature")

    def test_chinese_journal_without_ranking_row(self):
        r = self.search("中国社会科学")["results"][0]
        self.assertEqual(r["name"], "中国社会科学")
        self.assertEqual(r["lists"]["chinese"][0]["type"], "北核")
        self.assertIsNone(r["jcr"])

    def test_record_fields(self):
        r = self.search("nature")["results"][0]
        self.assertEqual(r["jcr"]["quartile"], "Q1")
        self.assertEqual(r["jcr"]["impactFactor"], 56.1)
        self.assertEqual(r["cas"], {"zone": 1, "top": True, "basicZone": 1, "basicTop": False})
        self.assertEqual(r["lists"]["ccf"], "A")
        self.assertEqual(r["lists"]["ajg"], {"rating": "4*", "ft50": True})
        self.assertTrue(r["lists"]["ft50"])
        self.assertEqual(r["categories"], ["MULTIDISCIPLINARY SCIENCES"])

    def test_warning_column_is_never_exposed(self):
        self.conn  # 库里有 warning 列,但接口不输出它
        for r in self.search("nature")["results"]:
            self.assertNotIn("warning", r)
            self.assertNotIn("warning", r["jcr"] or {})

    def test_too_short_query_returns_nothing(self):
        self.assertEqual(self.search("n")["results"], [])
        self.assertEqual(self.search("")["results"], [])

    def test_like_wildcards_are_escaped(self):
        self.assertEqual(self.search("%%")["results"], [])
        self.assertEqual(self.search("__")["results"], [])
        self.assertEqual(self.search("100% pure_j")["results"][0]["key"], "100% pure_journal")

    def test_sql_injection_is_inert(self):
        self.assertEqual(self.search("x' OR '1'='1")["results"], [])
        self.assertEqual(self.search("nature'; DROP TABLE journal_ranking;--")["results"], [])
        self.assertEqual(self.search("nature")["results"][0]["key"], "nature")

    def test_result_cap(self):
        path = make_db()
        try:
            c = sqlite3.connect(path)
            c.executemany("INSERT INTO journal_ranking(journal_name,name_key) VALUES (?,?)", [(f"Cap {i}", f"cap {i}") for i in range(50)])
            c.commit()
            c.close()
            conn = app.connect(path)
            _, body = app.handle(conn, "/api/journals/search", {"q": ["cap"]})
            conn.close()
            self.assertEqual(len(body["results"]), app.MAX_RESULTS)
        finally:
            os.unlink(path)

    def test_detail_and_not_found(self):
        status, body = app.handle(self.conn, "/api/journals/detail", {"key": ["Nature"]})
        self.assertEqual((status, body["record"]["key"], body["dataVersion"]), (200, "nature", "v-test"))
        self.assertEqual(app.handle(self.conn, "/api/journals/detail", {"key": ["nope"]})[0], 404)
        self.assertEqual(app.handle(self.conn, "/api/journals/nothing", {})[0], 404)

    def test_database_is_opened_read_only(self):
        with self.assertRaises(sqlite3.OperationalError):
            self.conn.execute("INSERT INTO meta(key,value) VALUES ('x','y')")


if __name__ == "__main__":
    unittest.main()
