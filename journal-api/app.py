#!/usr/bin/env python3
"""期刊查询只读接口(仅标准库)。

- 数据文件(SQLite)不随本仓库发布,通过环境变量 JOURNAL_DB 指向服务器上的本地文件。
- 一次只返回少量结果,最多 20 本;没有批量导出接口。限速由前置的 nginx 负责。
- 只读打开数据库;所有 SQL 都使用参数绑定,LIKE 中的通配符已转义。
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

MAX_RESULTS = 20
MAX_QUERY_LEN = 80
MIN_QUERY_LEN = 2
ISSN_RE = re.compile(r"^\d{4}-?[\dxX]{4}$")


def normalize_key(value: str) -> str:
    s = " ".join((value or "").strip().lower().split())
    return s[4:] if s.startswith("the ") else s


def like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _opt_num(v):
    return None if v is None else v


def build_record(conn: sqlite3.Connection, key: str) -> dict | None:
    rk = conn.execute("SELECT * FROM journal_ranking WHERE name_key = ? LIMIT 1", (key,)).fetchone()
    chinese = [
        {"type": r["index_type"], "detail": r["detail"] or ""}
        for r in conn.execute("SELECT index_type, detail FROM chinese_index WHERE name_key = ?", (key,))
    ]
    ei = conn.execute("SELECT 1 FROM journal_ei WHERE name_key = ? LIMIT 1", (key,)).fetchone() is not None
    ccf = conn.execute("SELECT rank FROM ccf_ranking WHERE name_key = ? LIMIT 1", (key,)).fetchone()
    ajg = conn.execute("SELECT ajg_rating, ft50 FROM journal_ajg WHERE name_key = ? LIMIT 1", (key,)).fetchone()
    ft50 = conn.execute("SELECT 1 FROM journal_ft50 WHERE name_key = ? LIMIT 1", (key,)).fetchone() is not None
    utd = conn.execute("SELECT 1 FROM journal_utd24 WHERE name_key = ? LIMIT 1", (key,)).fetchone() is not None
    if rk is None and not (chinese or ei or ccf or ajg or ft50 or utd):
        return None
    abbrevs = [
        r["name_key"]
        for r in conn.execute(
            "SELECT DISTINCT name_key FROM journal_abbrev WHERE full_name_key = ? AND name_key != ? LIMIT 5", (key, key)
        )
    ]
    name = rk["journal_name"] if rk else (key if re.search(r"[一-鿿]", key) else key.title())
    rec: dict = {
        "key": key,
        "name": name,
        "issn": (rk["issn"] if rk else "") or "",
        "eissn": (rk["eissn"] if rk else "") or "",
        "categories": [c.strip() for c in (rk["category"] or "").split(";") if c.strip()] if rk else [],
        "jcr": None,
        "cas": None,
        "lists": {
            "ei": ei,
            "ccf": ccf["rank"] if ccf else None,
            "ajg": {"rating": ajg["ajg_rating"], "ft50": bool(ajg["ft50"])} if ajg else None,
            "ft50": ft50 or bool(ajg and ajg["ft50"]),
            "utd24": utd,
            "chinese": chinese,
        },
        "abbreviations": abbrevs,
    }
    if rk is not None:
        rec["jcr"] = {
            "quartile": rk["jcr_quartile"] or None,
            "rank": rk["jif_rank"] or None,
            "impactFactor": _opt_num(rk["impact_factor"]),
            "fiveYearImpactFactor": _opt_num(rk["five_year_if"]),
            "jci": _opt_num(rk["jci"]),
            "scie": bool(rk["indexed_science"]),
            "ssci": bool(rk["indexed_ssci"]),
        }
        if rk["cas_zone"] is not None or rk["cas_basic_zone"] is not None:
            rec["cas"] = {
                "zone": _opt_num(rk["cas_zone"]),
                "top": bool(rk["cas_top"]),
                "basicZone": _opt_num(rk["cas_basic_zone"]),
                "basicTop": bool(rk["cas_basic_top"]),
            }
    return rec


def search_keys(conn: sqlite3.Connection, query: str) -> list[str]:
    q = normalize_key(query)
    if len(q) < MIN_QUERY_LEN:
        return []
    out: list[str] = []
    seen: set[str] = set()

    def add(rows) -> None:
        for (k,) in rows:
            if k and k not in seen and len(out) < MAX_RESULTS:
                seen.add(k)
                out.append(k)

    if ISSN_RE.match(q):
        digits = q.replace("-", "").upper()
        dashed = f"{digits[:4]}-{digits[4:]}"
        add(conn.execute("SELECT name_key FROM journal_ranking WHERE issn = ? OR eissn = ? LIMIT ?", (dashed, dashed, MAX_RESULTS)))
        return out
    esc = like_escape(q)
    add(conn.execute("SELECT name_key FROM journal_ranking WHERE name_key = ? LIMIT 5", (q,)))
    add(conn.execute("SELECT full_name_key FROM journal_abbrev WHERE name_key = ? LIMIT 5", (q,)))
    add(conn.execute("SELECT name_key FROM chinese_index WHERE name_key = ? LIMIT 5", (q,)))
    add(conn.execute(
        "SELECT name_key FROM journal_ranking WHERE name_key LIKE ? ESCAPE '\\' ORDER BY length(name_key) LIMIT ?",
        (esc + "%", MAX_RESULTS),
    ))
    add(conn.execute(
        "SELECT DISTINCT name_key FROM chinese_index WHERE name_key LIKE ? ESCAPE '\\' ORDER BY length(name_key) LIMIT ?",
        (esc + "%", MAX_RESULTS),
    ))
    add(conn.execute(
        "SELECT name_key FROM journal_ranking WHERE name_key LIKE ? ESCAPE '\\' ORDER BY length(name_key) LIMIT ?",
        ("%" + esc + "%", MAX_RESULTS),
    ))
    add(conn.execute(
        "SELECT DISTINCT name_key FROM chinese_index WHERE name_key LIKE ? ESCAPE '\\' ORDER BY length(name_key) LIMIT ?",
        ("%" + esc + "%", MAX_RESULTS),
    ))
    return out


def data_version(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM meta WHERE key = 'data_version'").fetchone()
    return row["value"] if row else ""


def handle(conn: sqlite3.Connection, path: str, query: dict[str, list[str]]) -> tuple[int, dict]:
    if path == "/api/journals/health":
        return 200, {"ok": True}
    if path == "/api/journals/search":
        q = (query.get("q", [""])[0] or "")[:MAX_QUERY_LEN]
        keys = search_keys(conn, q)
        results = [r for r in (build_record(conn, k) for k in keys) if r]
        return 200, {"dataVersion": data_version(conn), "query": q, "results": results}
    if path == "/api/journals/detail":
        key = normalize_key((query.get("key", [""])[0] or "")[:MAX_QUERY_LEN * 2])
        rec = build_record(conn, key) if key else None
        if rec is None:
            return 404, {"error": "not_found"}
        return 200, {"dataVersion": data_version(conn), "record": rec}
    return 404, {"error": "not_found"}


class Handler(BaseHTTPRequestHandler):
    conn: sqlite3.Connection

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        try:
            status, body = handle(self.conn, url.path, parse_qs(url.query))
        except Exception:  # 不把内部错误细节返回给访问者
            status, body = 500, {"error": "internal"}
        data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=300" if status == 200 else "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args) -> None:  # 访问日志由 nginx 记录,这里不重复
        pass


def main() -> None:
    db = os.environ["JOURNAL_DB"]
    port = int(os.environ.get("PORT", "8091"))
    Handler.conn = connect(db)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
