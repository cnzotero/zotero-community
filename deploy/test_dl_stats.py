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



class ExternalFeed(unittest.TestCase):
    NOW = datetime(2026, 11, 26, 4, 0, tzinfo=timezone.utc)  # 北京时间 11-26 12:00

    def test_parse_feed_is_strict_per_plugin(self):
        raw = {"plugins": {
            "a/b": {"total": 10, "today": 3},
            "c/d": {"total": 5, "today": 9},  # 今日大于累计:不合格
            "x/y": {"total": 1, "today": 0},  # 不在在架目录
            "a/c": {"total": -1, "today": 0},
            "A/B": {"total": 1, "today": 0},
            "bad id": {"total": 1, "today": 0},
        }}
        self.assertEqual(ds.parse_feed(raw, LISTED | {"a/c"}), {"a/b": {"total": 10, "today": 3}})
        for bad in [None, [], {}, {"plugins": []}, {"plugins": {"a/b": {"total": "1", "today": 0}}}, {"plugins": {"a/b": {"total": True, "today": 0}}}, {"plugins": {"a/b": {"total": 1.5, "today": 0}}}]:
            self.assertIn(ds.parse_feed(bad, LISTED), (None, {}))

    def test_fetch_feed_failures_return_none(self):
        class R:
            def __init__(self, body, status=200): self.body, self.status = body, status
            def read(self, n=-1): return self.body[:n] if n >= 0 else self.body
            def __enter__(self): return self
            def __exit__(self, *a): return False
        ok = json.dumps({"plugins": {"a/b": {"total": 2, "today": 1}}}).encode()
        sent = {}
        def opener(req, timeout):
            sent["token"] = req.get_header("X-feed-token")
            return R(ok)
        self.assertEqual(ds.fetch_feed("https://h.example/f", "tok", LISTED, opener=opener), {"a/b": {"total": 2, "today": 1}})
        self.assertEqual(sent["token"], "tok")
        self.assertIsNone(ds.fetch_feed("http://h.example/f", "tok", LISTED, opener=opener))  # 只接受 https
        self.assertIsNone(ds.fetch_feed("https://h.example/f", "", LISTED, opener=opener))  # 没有令牌
        self.assertIsNone(ds.fetch_feed("https://h.example/f", "t", LISTED, opener=lambda r, timeout: R(ok, 503)))
        self.assertIsNone(ds.fetch_feed("https://h.example/f", "t", LISTED, opener=lambda r, timeout: R(b"not json")))
        self.assertIsNone(ds.fetch_feed("https://h.example/f", "t", LISTED, opener=lambda r, timeout: R(b" " * (ds.MAX_FEED_BYTES + 1))))
        def boom(req, timeout): raise OSError("网络不通")
        self.assertIsNone(ds.fetch_feed("https://h.example/f", "t", LISTED, opener=boom))

    def test_public_stats_adds_feed_to_button_reports(self):
        state = ds.load_state("/nonexistent")
        ds.count(state, "a/b", "2026-11-26")
        ds.count(state, "a/b", "2026-11-25")
        state["feed"] = {"at": "2026-11-26", "plugins": {"a/b": {"total": 100, "today": 7}, "c/d": {"total": 50, "today": 2}}}
        out = ds.public_stats(state, self.NOW)
        self.assertEqual(out["plugins"]["a/b"], {"total": 102, "today": 8})
        self.assertEqual(out["plugins"]["c/d"], {"total": 50, "today": 2})  # 只有汇总源数字的插件也展示
        self.assertEqual((out["total"], out["today"]), (152, 10))

    def test_stale_feed_keeps_total_but_not_today(self):
        state = ds.load_state("/nonexistent")
        state["feed"] = {"at": "2026-11-25", "plugins": {"a/b": {"total": 100, "today": 7}}}
        out = ds.public_stats(state, self.NOW)
        self.assertEqual(out["plugins"]["a/b"], {"total": 100, "today": 0})
        self.assertEqual((out["total"], out["today"]), (100, 0))

    def test_no_feed_output_unchanged(self):
        state = ds.load_state("/nonexistent")
        ds.count(state, "a/b", "2026-11-26")
        out = ds.public_stats(state, self.NOW)
        self.assertEqual(out["plugins"], {"a/b": {"total": 1, "today": 1}})

    def test_feed_survives_state_roundtrip_and_ignores_garbage(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "s.json")
            with open(path, "w") as f:
                json.dump({"feed": {"at": "2026-11-26", "plugins": {"a/b": {"total": 5, "today": 1}, "bad": {"total": 1, "today": 1}, "c/d": {"total": "x", "today": 0}}}}, f)
            self.assertEqual(ds.load_state(path)["feed"], {"at": "2026-11-26", "plugins": {"a/b": {"total": 5, "today": 1}}})
            self.assertEqual(ds.load_state("/nonexistent")["feed"], {"at": "", "plugins": {}})


if __name__ == "__main__":
    unittest.main()
