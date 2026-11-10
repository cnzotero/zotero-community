import json
import os
import tempfile
import unittest
from datetime import datetime, timezone

import visit_stats as vs

UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36"


def line(time="10/Nov/2026:12:30:01 +0000", method="POST", path="/api/visit", status=204, agent=UA):
    return f'203.0.113.9 - - [{time}] "{method} {path} HTTP/2.0" {status} 0 "https://example.org/" "{agent}"\n'


class ParseLine(unittest.TestCase):
    def test_counts_only_real_page_opens(self):
        self.assertEqual(vs.parse_line(line()), "2026-11-10")
        self.assertIsNone(vs.parse_line(line(method="GET")))
        self.assertIsNone(vs.parse_line(line(path="/api/journals/search?q=x")))
        self.assertIsNone(vs.parse_line(line(status=429)))
        self.assertIsNone(vs.parse_line(line(agent="Mozilla/5.0 (compatible; bingbot/2.0)")))
        self.assertIsNone(vs.parse_line(line(agent="curl/8.5.0")))
        self.assertIsNone(vs.parse_line(line(agent="-")))
        self.assertIsNone(vs.parse_line("garbage\n"))

    def test_day_boundary_is_beijing_time(self):
        self.assertEqual(vs.parse_line(line(time="10/Nov/2026:15:59:59 +0000")), "2026-11-10")
        self.assertEqual(vs.parse_line(line(time="10/Nov/2026:16:00:00 +0000")), "2026-11-11")


class Collect(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.log = os.path.join(self.dir.name, "visit.log")
        self.state_path = os.path.join(self.dir.name, "state.json")
        self.out = os.path.join(self.dir.name, "public", "stats.json")

    def tearDown(self):
        self.dir.cleanup()

    def run_once(self):
        state = vs.collect(self.log, vs.load_state(self.state_path))
        vs.write_json(self.state_path, state)
        return state

    def append(self, text):
        with open(self.log, "a", encoding="utf-8") as f:
            f.write(text)

    def test_no_log_yet(self):
        self.assertEqual(self.run_once()["total"], 0)

    def test_incremental_never_double_counts(self):
        self.append(line() + line() + line(method="GET"))
        self.assertEqual(self.run_once()["total"], 2)
        self.assertEqual(self.run_once()["total"], 2)  # 没有新内容,数字不变
        self.append(line())
        self.assertEqual(self.run_once()["total"], 3)

    def test_half_written_last_line_waits_for_next_run(self):
        whole = line()
        self.append(whole + whole[:40])
        self.assertEqual(self.run_once()["total"], 1)
        self.append(whole[40:])
        self.assertEqual(self.run_once()["total"], 2)

    def test_rotation_reads_the_rest_of_the_old_file(self):
        self.append(line())
        self.assertEqual(self.run_once()["total"], 1)
        self.append(line() + line())  # 轮转前又来了两次,还没被读到
        os.rename(self.log, self.log + ".1")
        self.append(line(time="11/Nov/2026:01:00:00 +0000"))  # 新文件
        state = self.run_once()
        self.assertEqual(state["total"], 4)
        self.assertEqual(state["days"], {"2026-11-10": 3, "2026-11-11": 1})

    def test_truncated_log_restarts_from_the_beginning(self):
        self.append(line() + line())
        self.assertEqual(self.run_once()["total"], 2)
        with open(self.log, "w", encoding="utf-8") as f:
            f.write(line())
        self.assertEqual(self.run_once()["total"], 3)

    def test_public_file_has_only_totals(self):
        self.append(line() + line(time="09/Nov/2026:12:00:00 +0000"))
        state = self.run_once()
        now = datetime(2026, 11, 10, 13, 0, tzinfo=timezone.utc)
        vs.write_json(self.out, vs.public_stats(state, now))
        with open(self.out, encoding="utf-8") as f:
            public = json.load(f)
        self.assertEqual(public, {"total": 2, "today": 1, "date": "2026-11-10", "updated": "2026-11-10T13:00:00Z"})
        self.assertEqual(oct(os.stat(self.out).st_mode & 0o777), "0o644")


if __name__ == "__main__":
    unittest.main()
