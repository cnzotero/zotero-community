#!/usr/bin/env python3
"""把下载上报日志汇总成插件卡片与详情页显示的「本站下载」次数。仅用 Python 标准库。

访问者点本站插件的「下载」按钮时,页面会向 /api/dl?p=<owner/repo>&v=<版本号> 发一个不带内容的
请求(下载本身直接走作者发布页的地址,不经本站);Web 服务器把这些请求单独记到一个日志文件里。
本脚本定时执行:只读上次读到的位置之后的新内容,按插件累加,写出一个只含汇总数字的 JSON 文件。

    python3 dl_stats.py --log <上报日志> --state <状态文件> --catalog <站点的 data/catalog.json> --out <dl-stats.json>

- 只统计 POST /api/dl 且返回 204 的请求,并排除自称爬虫的访问。
- 插件 id 与版本号按严格格式校验,格式不对的整行不计;插件 id 必须在本站在架目录里,未收录的不计。
- 日志按天轮转时,先把旧文件(<上报日志>.1)里没读完的部分读完,再从新文件开头读。
- 读不到在架目录时本次不处理(位置不前进),等下次再读,不丢计数。
- 输出文件只有汇总数字,不含地址、不含任何访问者信息;脚本也不保存地址。
- 「今日」按北京时间划分。

外部汇总源(可选):插件作者或渠道方把「通过自己提供的下载入口(例如插件内的安装与更新)完成的下载」按插件汇总成
累计与今日两个数字,本站定时去取,与按钮上报的数字相加后一起展示。同一口径对所有插件开放。
    --feed-url <地址> --feed-token-file <令牌文件>   请求头 X-Feed-Token 带令牌;返回 {"plugins": {"owner/repo": {"total": N, "today": M}}}
- 令牌只放在服务器文件里,不进仓库;取不到或格式不对时保留上一次取到的数字,不影响其它统计。
- 汇总源给的是绝对累计数,只接受本站在架目录里的插件、非负整数;「今日」只在当天取到时才显示。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs

BEIJING = timezone(timedelta(hours=8))
KEEP_DAYS = 400
HIT_PATH = "/api/dl"

# 常见日志格式:... [10/Nov/2026:12:30:01 +0000] "POST /api/dl?p=a%2Fb&v=1.0 HTTP/2.0" 204 0 "来源" "浏览器标识"
LINE = re.compile(
    r'\[(?P<time>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<agent>[^"]*)"'
)
BOT = re.compile(r"bot|spider|crawl|slurp|curl|wget|python|headless|scrapy|httpclient|monitor", re.I)
# 与前端 src/plugins/site-downloads.ts 同一套格式。插件 id 即 GitHub 的 owner/repo(本站数据里统一为小写)。
PLUGIN_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,38}/[a-z0-9._-]{1,100}")
VERSION = re.compile(r"[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}")
MAX_QUERY = 200


def parse_query(query: str) -> tuple[str, str] | None:
    """查询串必须恰好是 p=<插件 id>&v=<版本号>(顺序不限),各一次、格式合法;否则返回 None。"""
    if not query or len(query) > MAX_QUERY:
        return None
    try:
        q = parse_qs(query, keep_blank_values=True, strict_parsing=True, max_num_fields=2)
    except ValueError:
        return None
    if set(q) != {"p", "v"} or len(q["p"]) != 1 or len(q["v"]) != 1:
        return None
    pid, ver = q["p"][0], q["v"][0]
    if not PLUGIN_ID.fullmatch(pid) or not VERSION.fullmatch(ver):
        return None
    return pid, ver


def parse_line(line: str) -> tuple[str, str] | None:
    """命中一次有效下载时返回 (插件 id, 北京日期 YYYY-MM-DD),否则返回 None。版本号只校验格式,不分开计数。"""
    m = LINE.search(line)
    if not m:
        return None
    path, _, query = m["path"].partition("?")
    if m["method"] != "POST" or path != HIT_PATH or m["status"] != "204":
        return None
    agent = m["agent"]
    if not agent or agent == "-" or BOT.search(agent):
        return None
    hit = parse_query(query)
    if hit is None:
        return None
    try:
        when = datetime.strptime(m["time"], "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None
    return hit[0], when.astimezone(BEIJING).strftime("%Y-%m-%d")


def load_catalog(path: str) -> set[str]:
    """本站在架目录(构建产物 data/catalog.json)里的插件 id。读不到或格式不对时抛出异常。"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    ids = {p["id"] for p in data["plugins"] if isinstance(p, dict) and isinstance(p.get("id"), str)}
    ids = {i for i in ids if PLUGIN_ID.fullmatch(i)}
    if not ids:
        raise ValueError("在架目录里没有插件")
    return ids


def load_state(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        state = {}
    plugins = {}
    for pid, v in dict(state.get("plugins") or {}).items():
        if isinstance(v, dict) and PLUGIN_ID.fullmatch(pid):
            plugins[pid] = {"total": int(v.get("total") or 0), "day": str(v.get("day") or ""), "count": int(v.get("count") or 0)}
    return {
        "inode": state.get("inode"),
        "offset": int(state.get("offset") or 0),
        "total": int(state.get("total") or 0),
        "days": dict(state.get("days") or {}),
        "plugins": plugins,
        "feed": load_feed_state(state.get("feed")),
    }


MAX_FEED_BYTES = 256 * 1024
MAX_FEED_COUNT = 10**10


def _count(v) -> int | None:
    """非负整数(不接受布尔、小数、字符串),且不超过上限;否则 None。"""
    if isinstance(v, bool) or not isinstance(v, int) or v < 0 or v > MAX_FEED_COUNT:
        return None
    return v


def parse_feed(raw, listed: set[str]) -> dict[str, dict[str, int]] | None:
    """校验汇总源返回的内容;整体格式不对返回 None,单个插件不合格只跳过那一个(未收录的插件也跳过)。"""
    if not isinstance(raw, dict) or not isinstance(raw.get("plugins"), dict):
        return None
    out: dict[str, dict[str, int]] = {}
    for pid, v in raw["plugins"].items():
        if not isinstance(pid, str) or not PLUGIN_ID.fullmatch(pid) or pid not in listed or not isinstance(v, dict):
            continue
        total, today = _count(v.get("total")), _count(v.get("today"))
        if total is None or today is None or today > total:
            continue
        out[pid] = {"total": total, "today": today}
    return out


def load_feed_state(raw) -> dict:
    """状态文件里上次取到的汇总源数字:{"at": 取到的北京日期, "plugins": {id: {total, today}}}。"""
    if not isinstance(raw, dict) or not isinstance(raw.get("plugins"), dict):
        return {"at": "", "plugins": {}}
    plugins = {}
    for pid, v in raw["plugins"].items():
        if isinstance(pid, str) and PLUGIN_ID.fullmatch(pid) and isinstance(v, dict):
            total, today = _count(v.get("total")), _count(v.get("today"))
            if total is not None and today is not None:
                plugins[pid] = {"total": total, "today": today}
    return {"at": str(raw.get("at") or ""), "plugins": plugins}


def fetch_feed(url: str, token: str, listed: set[str], opener=urllib.request.urlopen, timeout: int = 20) -> dict[str, dict[str, int]] | None:
    """取一次汇总源;网络出错、非 2xx、太大、不是 JSON、整体格式不对都返回 None(调用方保留上次的数字)。"""
    if not url.startswith("https://") or not token:
        return None
    req = urllib.request.Request(url, headers={"X-Feed-Token": token, "User-Agent": "zotero-community-dl-stats"})
    try:
        with opener(req, timeout=timeout) as r:
            if getattr(r, "status", 200) != 200:
                return None
            body = r.read(MAX_FEED_BYTES + 1)
        if len(body) > MAX_FEED_BYTES:
            return None
        return parse_feed(json.loads(body.decode("utf-8")), listed)
    except (OSError, ValueError):
        return None


def read_from(path: str, offset: int) -> tuple[list[str], int]:
    """从 offset 读到最后一个完整行;返回 (各行, 新位置)。写了一半的末行留到下次。"""
    with open(path, "rb") as f:
        f.seek(offset)
        data = f.read()
    end = data.rfind(b"\n") + 1
    lines = data[:end].decode("utf-8", "replace").splitlines()
    return lines, offset + end


def count(state: dict, pid: str, day: str) -> None:
    state["total"] += 1
    state["days"][day] = state["days"].get(day, 0) + 1
    p = state["plugins"].setdefault(pid, {"total": 0, "day": "", "count": 0})
    p["total"] += 1
    # 每个插件只记最近一天的数(够算「今日」);轮转后补读到的更早日期只计入累计
    if day == p["day"]:
        p["count"] += 1
    elif day > p["day"]:
        p["day"], p["count"] = day, 1


def collect(log_path: str, state: dict, listed: set[str]) -> dict:
    """读新增的日志并更新 state(就地修改并返回)。listed 是在架插件 id。"""
    lines: list[str] = []
    try:
        st = os.stat(log_path)
    except OSError:
        return state  # 还没有任何下载上报

    offset = state["offset"]
    if state["inode"] is not None and state["inode"] != st.st_ino:
        # 日志轮转过:旧文件改名成了 .1,先把里面没读完的读完
        rotated = log_path + ".1"
        try:
            if os.stat(rotated).st_ino == state["inode"]:
                old_lines, _ = read_from(rotated, offset)
                lines += old_lines
        except OSError:
            pass
        offset = 0
    elif st.st_size < offset:
        offset = 0  # 文件被清空后重新写

    new_lines, offset = read_from(log_path, offset)
    lines += new_lines

    for line in lines:
        hit = parse_line(line)
        if hit is None or hit[0] not in listed:
            continue
        count(state, *hit)

    for day in sorted(state["days"])[:-KEEP_DAYS]:
        del state["days"][day]
    state["inode"] = st.st_ino
    state["offset"] = offset
    return state


def write_json(path: str, payload: dict) -> None:
    """先写临时文件再改名,读的一方永远拿不到写了一半的内容。"""
    folder = os.path.dirname(os.path.abspath(path))
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, sort_keys=True)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def public_stats(state: dict, now: datetime) -> dict:
    today = now.astimezone(BEIJING).strftime("%Y-%m-%d")
    feed = state.get("feed") or {"at": "", "plugins": {}}
    feed_fresh = feed["at"] == today  # 汇总源的「今日」只在当天取到时才算
    ids = set(state["plugins"]) | set(feed["plugins"])
    plugins = {}
    for pid in sorted(ids):
        p = state["plugins"].get(pid, {"total": 0, "day": "", "count": 0})
        f = feed["plugins"].get(pid, {"total": 0, "today": 0})
        total = p["total"] + f["total"]
        if total > 0:
            plugins[pid] = {"total": total, "today": (p["count"] if p["day"] == today else 0) + (f["today"] if feed_fresh else 0)}
    return {
        "generatedAt": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": state["total"] + sum(f["total"] for f in feed["plugins"].values()),
        "today": state["days"].get(today, 0) + (sum(f["today"] for f in feed["plugins"].values()) if feed_fresh else 0),
        "plugins": plugins,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--log", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--catalog", required=True, help="站点构建产物里的 data/catalog.json")
    ap.add_argument("--out", required=True)
    ap.add_argument("--feed-url", help="外部汇总源地址(https);不给则不取")
    ap.add_argument("--feed-token-file", help="存放汇总源令牌的文件(只读第一行)")
    args = ap.parse_args()

    try:
        listed = load_catalog(args.catalog)
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(f"读不到在架目录,本次不处理:{e}", file=sys.stderr)
        sys.exit(1)
    state = collect(args.log, load_state(args.state), listed)
    now = datetime.now(timezone.utc)
    if args.feed_url and args.feed_token_file:
        try:
            with open(args.feed_token_file, encoding="utf-8") as f:
                token = f.readline().strip()
        except OSError as e:
            print(f"读不到汇总源令牌,沿用上次的数字:{e}", file=sys.stderr)
            token = ""
        got = fetch_feed(args.feed_url, token, listed)
        if got is None:
            print("汇总源这次没取到或格式不对,沿用上次的数字", file=sys.stderr)
        else:
            state["feed"] = {"at": now.astimezone(BEIJING).strftime("%Y-%m-%d"), "plugins": got}
    write_json(args.state, state)
    write_json(args.out, public_stats(state, now))


if __name__ == "__main__":
    main()
