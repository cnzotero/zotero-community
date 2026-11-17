# 网站服务器侧的配置

本目录是网站服务器上用到的脚本。网站本身是静态文件,由 GitHub Actions 构建后发布到 `deploy` 分支;服务器只做三件事:

| 用途 | 脚本 | 页面上的表现 |
| --- | --- | --- |
| 拉取 `deploy` 分支并同步到网站目录 | `server-pull.sh` | — |
| 访问量 | `visit_stats.py` | 页眉「累计访问 N 次」,读 `/stats.json` |
| 本站下载次数 | `dl_stats.py` | 插件卡片与详情页「本站下载 N 次」,读 `/dl-stats.json` |

访问量与本站下载次数用同一种做法:页面向本站发一个不带内容的请求,Web 服务器把这类请求单独记一个日志,定时任务只读新增的日志、累加,写出只含汇总数字的 JSON。不用数据库、不跑常驻服务、不用第三方统计。两个 JSON 都不在构建产物里,`server-pull.sh` 同步时会保留它们。

下文的路径都是示例,与 `server-pull.sh` 的默认值一致(网站目录 `/var/www/zoterocn`、站点代码 `/opt/zotero-community/site`);服务器上不同就整体替换。nginx 片段在 nginx 1.31 上实测过(见文末)。

## 访问量(已有)

- 页面请求:`POST /api/visit`,不带任何参数。
- 日志:只记这一类请求,格式要能被 `visit_stats.py` 读懂(见下面「日志格式」)。
- 定时任务:`python3 visit_stats.py --log <日志> --state <状态文件> --out <网站目录>/stats.json`。

服务器上已有的配置以实际为准。如果 `/api/visit` 那段是直接 `return 204;`,注意 nginx 会在限速之前就返回,`limit_req` 实际不生效;可以按下面 `/api/dl` 的写法改。

## 本站下载次数(新增)

页面行为:访问者点本站插件的「下载」按钮(左键、Ctrl/⌘ 点击、中键点击)时,页面向
`POST /api/dl?p=<owner/repo>&v=<版本号>` 发一个 keepalive 请求,然后照常直接打开作者发布页的安装包地址,不经本站中转。请求不带内容、不带任何访问者标识。

口径:只统计从本站按钮发起的下载,不含从 GitHub 直接下载;从开始统计之日起累计。插件 id 必须在本站在架目录(`/data/catalog.json`)里才计入;格式不对、返回码不是 204(包括被限速的)、自称爬虫的请求都不计。

### 1. nginx:日志格式与限速区(http 级别)

新建 `/etc/nginx/conf.d/zoterocn-dl.conf`(Debian/Ubuntu 默认会在 `http {}` 里引入 `conf.d/*.conf`;其它发行版放到 `http {}` 里即可):

```nginx
# 本站下载上报的日志格式:不记访问者地址与来源页,只留时间、请求行、返回码和浏览器标识
log_format zc_dl '- - - [$time_local] "$request" $status $body_bytes_sent "-" "$http_user_agent"';

# 每个地址每秒最多 5 次(限速只在内存里按地址计数,不写日志)
limit_req_zone $binary_remote_addr zone=zc_dl:10m rate=5r/s;
```

### 2. nginx:上报地址(放进本站的 server 块)

放进 zoterocn.org 对外提供 https 的那个 `server { ... }` 里,与 `/api/visit` 那段并列:

```nginx
# 本站下载上报:只收 POST,每个地址限速,单独记日志,返回 204 不带内容
location = /api/dl {
    if ($request_method != POST) { return 405; }
    limit_req zone=zc_dl burst=10 nodelay;
    limit_req_status 429;
    access_log /var/log/nginx/zoterocn-dl.log zc_dl;
    # 不能直接写 return 204:return 在限速之前执行,limit_req 会不生效。
    # 这里先过限速,再转到下面的命名 location 返回 204。
    try_files /.zc-dl-beacon-does-not-exist @zc_dl_ok;
}
location @zc_dl_ok {
    access_log /var/log/nginx/zoterocn-dl.log zc_dl;
    return 204;
}
```

然后检查并重载:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

### 3. 汇总脚本与目录

脚本只用 Python 3 标准库(3.8 及以上)。合并后从公开仓库取:

```sh
sudo mkdir -p /opt/zotero-community/bin /var/lib/zoterocn-stats
sudo curl -fsSL https://raw.githubusercontent.com/cnzotero/zotero-community/main/deploy/dl_stats.py -o /opt/zotero-community/bin/dl_stats.py
```

先手动跑一次,确认能写出文件:

```sh
sudo /usr/bin/python3 /opt/zotero-community/bin/dl_stats.py \
  --log /var/log/nginx/zoterocn-dl.log \
  --state /var/lib/zoterocn-stats/dl-state.json \
  --catalog /var/www/zoterocn/data/catalog.json \
  --out /var/www/zoterocn/dl-stats.json
cat /var/www/zoterocn/dl-stats.json
```

还没有人点过下载时输出类似 `{"generatedAt": "...", "plugins": {}, "today": 0, "total": 0}`,页面上不会显示这一项。

- `--state`:脚本自己的进度与累计数,不要放进网站目录;删掉它会让累计数从 0 重来。
- `--catalog`:构建产物里的在架目录,用来判断插件 id 是否收录;读不到时脚本退出码为 1、本次不处理,下次再读,不丢计数。
- `--out`:写进网站目录根下,页面读 `/dl-stats.json`。`server-pull.sh` 同步时保留这个文件(如果服务器上的 `server-pull.sh` 是旧版,先按本仓库的版本更新,否则每次同步会把它删掉,直到下一次定时任务重新写出)。

### 4. 定时任务:每 5 分钟一次

nginx 日志通常只有 root 或 adm 组可读,所以用 root 跑。新建 `/etc/cron.d/zoterocn-dl-stats`(文件末尾要有换行):

```cron
*/5 * * * * root /usr/bin/python3 /opt/zotero-community/bin/dl_stats.py --log /var/log/nginx/zoterocn-dl.log --state /var/lib/zoterocn-stats/dl-state.json --catalog /var/www/zoterocn/data/catalog.json --out /var/www/zoterocn/dl-stats.json
```

### 5. 日志轮转

脚本按「改名为 `<日志>.1`、新建空文件」的方式处理轮转,要求 `.1` 不立即压缩。Debian/Ubuntu 自带的 `/etc/logrotate.d/nginx` 覆盖 `/var/log/nginx/*.log`,并带 `delaycompress`,不用另配。核对:

```sh
grep -nE 'nginx/\*\.log|delaycompress|copytruncate' /etc/logrotate.d/nginx
```

应能看到 `delaycompress`,且没有 `copytruncate`。

### 6. 上线后核对

```sh
# 只收 POST:GET 返回 405
curl -s -o /dev/null -w '%{http_code}\n' 'https://zoterocn.org/api/dl?p=a%2Fb&v=1.0'
# POST 返回 204(curl 会被脚本当作程序访问排除,不会计入下载数)
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://zoterocn.org/api/dl?p=a%2Fb&v=1.0'
# 连续发 20 次,后面应出现 429
for i in $(seq 1 20); do curl -s -o /dev/null -w '%{http_code} ' -X POST 'https://zoterocn.org/api/dl?p=a%2Fb&v=1.0'; done; echo
# 日志里有这几行,且不含访问者地址
sudo tail -n 3 /var/log/nginx/zoterocn-dl.log
# 5 分钟后汇总文件可访问
curl -s https://zoterocn.org/dl-stats.json
```

在浏览器里打开任一插件详情页点「下载」,开发者工具的网络面板里应能看到一条 `POST /api/dl?p=...&v=...` 返回 204,同时安装包照常从 github.com 下载。

## 日志格式

两个汇总脚本按同一种行格式读取(nginx 默认的 `combined` 格式也能读):

```
<任意> [10/Nov/2026:12:30:01 +0000] "POST /api/dl?p=a%2Fb&v=1.0 HTTP/2.0" 204 0 "<来源页>" "<浏览器标识>"
```

## 本地测试

```sh
cd deploy && python3 -m unittest -v test_visit_stats test_dl_stats
```

上面的 nginx 片段在本机 nginx 1.31.2 上实测过:连续 15 次 POST 前 11 次 204、之后 429;GET 返回 405;日志行能被 `dl_stats.py` 读取。对照实测了直接 `return 204;` 的写法,15 次全部 204,限速不生效。服务器上的实际效果未实测。
