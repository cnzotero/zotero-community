#!/usr/bin/env python3
"""把访问上报日志汇总成页脚显示的「累计 / 今日」访问量。仅用 Python 标准库。

网站页面每被打开一次,会向 /api/visit 发一个不带内容的请求;Web 服务器把这些请求
单独记到一个日志文件里。本脚本定时执行:只读上次读到的位置之后的新内容,累加计数,
写出一个只含汇总数字的 JSON 文件供页脚读取。

    python3 visit_stats.py --log <上报日志> --state <状态文件> --out <stats.json>

- 只统计 POST /api/visit 且返回 204 的请求,并排除自称爬虫的访问。
- 日志按天轮转时,先把旧文件(<上报日志>.1)里没读完的部分读完,再从新文件开头读。
- 输出文件只有汇总数字,不含地址、不含任何访问者信息。
- 「今日」按北京时间划分。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from datetime import datetime, timedelta, timezone

BEIJING = timezone(timedelta(hours=8))
KEEP_DAYS = 400

# 常见日志格式:... [10/Nov/2026:12:30:01 +0000] "POST /api/visit HTTP/2.0" 204 0 "来源" "浏览器标识"
LINE = re.compile(
    r'\[(?P<time>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<agent>[^"]*)"'
)
BOT = re.compile(r"bot|spider|crawl|slurp|curl|wget|python|headless|scrapy|httpclient|monitor", re.I)


def parse_line(line: str) -> str | None:
    """命中一次有效访问时返回它的北京日期(YYYY-MM-DD),否则返回 None。"""
    m = LINE.search(line)
    if not m:
        return None
    if m["method"] != "POST" or m["path"].split("?", 1)[0] != "/api/visit" or m["status"] != "204":
        return None
    agent = m["agent"]
    if not agent or agent == "-" or BOT.search(agent):
        return None
    try:
        when = datetime.strptime(m["time"], "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None
    return when.astimezone(BEIJING).strftime("%Y-%m-%d")


def load_state(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        state = {}
    return {
        "inode": state.get("inode"),
        "offset": int(state.get("offset") or 0),
        "total": int(state.get("total") or 0),
        "days": dict(state.get("days") or {}),
    }


def read_from(path: str, offset: int) -> tuple[list[str], int]:
    """从 offset 读到最后一个完整行;返回 (各行, 新位置)。写了一半的末行留到下次。"""
    with open(path, "rb") as f:
        f.seek(offset)
        data = f.read()
    end = data.rfind(b"\n") + 1
    lines = data[:end].decode("utf-8", "replace").splitlines()
    return lines, offset + end


def collect(log_path: str, state: dict) -> dict:
    """读新增的日志并更新 state(就地修改并返回)。"""
    lines: list[str] = []
    try:
        st = os.stat(log_path)
    except OSError:
        return state  # 还没有任何访问上报

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
        day = parse_line(line)
        if day is None:
            continue
        state["total"] += 1
        state["days"][day] = state["days"].get(day, 0) + 1

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
            json.dump(payload, f, ensure_ascii=False)
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
    return {
        "total": state["total"],
        "today": state["days"].get(today, 0),
        "date": today,
        "updated": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--log", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    state = collect(args.log, load_state(args.state))
    write_json(args.state, state)
    write_json(args.out, public_stats(state, datetime.now(timezone.utc)))


if __name__ == "__main__":
    main()
