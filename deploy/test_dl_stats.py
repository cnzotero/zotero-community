import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone

import dl_stats as ds

UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36"
Q = "p=a%2Fb&v=1.0"
LISTED = {"a/b", "c/d"}


def line(time="10/Nov/2026:12:30:01 +0000", method="POST", query=Q, status=204, agent=UA, path="/api/dl"):
    target = f"{path}?{query}" if query is not None else path
    return f'- - - [{time}] "{method} {target} HTTP/2.0" {status} 0 "-" "{agent}"\n'


class ParseLine(unittest.TestCase):
    def test_counts_only_real_download_clicks(self):
        self.assertEqual(ds.parse_line(line()), ("a/b", "2026-11-10"))
        self.assertEqual(ds.parse_line(line(query="v=2.0.1-beta.1&p=c%2Fd")), ("c/d", "2026-11-10"))
        self.assertEqual(ds.parse_line(line(query="p=a/b&v=1.0%2Bbuild.7")), ("a/b", "2026-11-10"))
        # 带地址的常见日志格式也能读(本站建议的格式不记地址)
        self.assertEqual(ds.parse_line('203.0.113.9 - - [10/Nov/2026:12:30:01 +0000] "POST /api/dl?p=a%2Fb&v=1.0 HTTP/1.1" 204 0 "https://example.org/" "UA"\n'), ("a/b", "2026-11-10"))
        self.assertIsNone(ds.parse_line(line(method="GET")))
        self.assertIsNone(ds.parse_line(line(path="/api/visit", query=None)))
        self.assertIsNone(ds.parse_line(line(path="/api/dlx")))
        self.assertIsNone(ds.parse_line(line(status=429)))
        self.assertIsNone(ds.parse_line(line(status=405)))
        self.assertIsNone(ds.parse_line(line(agent="Mozilla/5.0 (compatible; bingbot/2.0)")))
        self.assertIsNone(ds.parse_line(line(agent="curl/8.5.0")))
        self.assertIsNone(ds.parse_line(line(agent="-")))
        self.assertIsNone(ds.parse_line("garbage\n"))

    def test_query_format_is_strict(self):
        for q in [
            None,
            "",
            "p=a%2Fb",  # 缺版本号
            "v=1.0",
            "p=a%2Fb&v=1.0&x=1",  # 多余参数
            "p=a%2Fb&p=c%2Fd&v=1.0",  # 重复参数
            "p=A%2Fb&v=1.0",  # 本站 id 都是小写
            "p=a&v=1.0",
            "p=a%2Fb%2Fc&v=1.0",
            "p=..%2F..&v=1.0",
            "p=a%2Fb&v=",
            "p=a%2Fb&v=1.0+x",  # + 是空格
            "p=a%2Fb&v=1.0%22",
            "p=a%2Fb&v=1.0%0A",
            "p=a%2Fb%5Cx22&v=1.0",
            "p=__proto__&v=1.0",
            "p=a%2Fb&v=" + "1" * 41,
            "p=" + "a" * 40 + "%2Fb&v=1.0",
            "p=a%2Fb&&v=1.0",
            "p=a%2Fb&v=1.0&" + "x" * 300,
        ]:
            self.assertIsNone(ds.parse_line(line(query=q)), q)

    def test_day_boundary_is_beijing_time(self):
        self.assertEqual(ds.parse_line(line(time="10/Nov/2026:15:59:59 +0000"))[1], "2026-11-10")
        self.assertEqual(ds.parse_line(line(time="10/Nov/2026:16:00:00 +0000"))[1], "2026-11-11")


class Collect(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.log = os.path.join(self.dir.name, "dl.log")
        self.state_path = os.path.join(self.dir.name, "state.json")
        self.out = os.path.join(self.dir.name, "public", "dl-stats.json")

    def tearDown(self):
        self.dir.cleanup()

    def run_once(self, listed=LISTED):
        state = ds.collect(self.log, ds.load_state(self.state_path), listed)
        ds.write_json(self.state_path, state)
        return state

    def append(self, text):
        with open(self.log, "a", encoding="utf-8") as f:
            f.write(text)

    def test_no_log_yet(self):
        self.assertEqual(self.run_once()["total"], 0)

    def test_unlisted_plugins_are_not_counted(self):
        self.append(line() + line(query="p=x%2Fy&v=1.0") + line(query="p=c%2Fd&v=3.0"))
        state = self.run_once()
        self.assertEqual(state["total"], 2)
        self.assertEqual(sorted(state["plugins"]), ["a/b", "c/d"])

    def test_incremental_never_double_counts(self):
        self.append(line() + line() + line(method="GET"))
        self.assertEqual(self.run_once()["plugins"]["a/b"]["total"], 2)
        self.assertEqual(self.run_once()["plugins"]["a/b"]["total"], 2)  # 没有新内容,数字不变
        self.append(line())
        self.assertEqual(self.run_once()["plugins"]["a/b"]["total"], 3)

    def test_half_written_last_line_waits_for_next_run(self):
        whole = line()
        self.append(whole + whole[:40])
        self.assertEqual(self.run_once()["total"], 1)
        self.append(whole[40:])
        self.assertEqual(self.run_once()["total"], 2)

    def test_rotation_reads_the_rest_of_the_old_file(self):
        self.append(line())
        self.assertEqual(self.run_once()["total"], 1)
        self.append(line() + line(query="p=c%2Fd&v=1"))  # 轮转前又来了两次,还没被读到
        os.rename(self.log, self.log + ".1")
        self.append(line(time="11/Nov/2026:01:00:00 +0000"))  # 新文件
        state = self.run_once()
        self.assertEqual(state["total"], 4)
        self.assertEqual(state["days"], {"2026-11-10": 3, "2026-11-11": 1})
        self.assertEqual(state["plugins"]["a/b"], {"total": 3, "day": "2026-11-11", "count": 1})
        self.assertEqual(state["plugins"]["c/d"], {"total": 1, "day": "2026-11-10", "count": 1})

    def test_truncated_log_restarts_from_the_beginning(self):
        self.append(line() + line())
        self.assertEqual(self.run_once()["total"], 2)
        with open(self.log, "w", encoding="utf-8") as f:
            f.write(line())
        self.assertEqual(self.run_once()["total"], 3)

    def test_public_file_has_only_totals(self):
        self.append(
            line(time="09/Nov/2026:12:00:00 +0000")
            + line(time="10/Nov/2026:12:00:00 +0000")
            + line(time="10/Nov/2026:12:00:01 +0000", query="v=2&p=a%2Fb")
            + line(time="09/Nov/2026:12:00:00 +0000", query="p=c%2Fd&v=1")
        )
        state = self.run_once()
        now = datetime(2026, 11, 10, 13, 0, tzinfo=timezone.utc)
        ds.write_json(self.out, ds.public_stats(state, now))
        with open(self.out, encoding="utf-8") as f:
            public = json.load(f)
        self.assertEqual(public, {
            "generatedAt": "2026-11-10T13:00:00Z",
            "total": 4,
            "today": 2,
            "plugins": {"a/b": {"total": 3, "today": 2}, "c/d": {"total": 1, "today": 0}},
        })
        self.assertEqual(oct(os.stat(self.out).st_mode & 0o777), "0o644")

    def test_state_keeps_no_addresses(self):
        self.append('203.0.113.9 - - [10/Nov/2026:12:30:01 +0000] "POST /api/dl?p=a%2Fb&v=1.0 HTTP/1.1" 204 0 "-" "UA"\n')
        self.run_once()
        with open(self.state_path, encoding="utf-8") as f:
            self.assertNotIn("203.0.113.9", f.read())


class Main(unittest.TestCase):
    def test_missing_catalog_does_not_advance(self):
        with tempfile.TemporaryDirectory() as d:
            log, state, out = (os.path.join(d, n) for n in ("dl.log", "state.json", "dl-stats.json"))
            catalog = os.path.join(d, "catalog.json")
            with open(log, "w", encoding="utf-8") as f:
                f.write(line())
            script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dl_stats.py")
            args = [sys.executable, script, "--log", log, "--state", state, "--catalog", catalog, "--out", out]
            r = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(r.returncode, 1)
            self.assertFalse(os.path.exists(state))
            self.assertFalse(os.path.exists(out))
            with open(catalog, "w", encoding="utf-8") as f:
                json.dump({"schema": 1, "plugins": [{"id": "a/b"}, {"id": "Bad Id"}]}, f)
            r = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            with open(out, encoding="utf-8") as f:
                public = json.load(f)
            self.assertEqual(public["total"], 1)
            self.assertEqual(public["plugins"]["a/b"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
