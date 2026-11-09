# 期刊查询接口(只读)

为站点的「期刊查询」页提供数据的小服务,仅用 Python 标准库。

- 数据文件(SQLite)**不随本仓库发布**,运行时通过环境变量 `JOURNAL_DB` 指向服务器上的本地文件。
- 只读打开数据库;所有 SQL 使用参数绑定。
- 每次最多返回 20 条,没有批量导出接口;访问频率限制由前置的 Web 服务器负责。
- 不对外发起任何网络请求,不依赖任何第三方服务。

```bash
JOURNAL_DB=/path/to/journal-db.sqlite PORT=8091 python3 app.py   # 仅监听 127.0.0.1
PYTHONPATH=. python3 -m unittest -q test_app                      # 单元测试
```

接口:`GET /api/journals/search?q=...`、`GET /api/journals/detail?key=...`、`GET /api/journals/health`。
