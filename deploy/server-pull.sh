#!/usr/bin/env bash
# 网站服务器定时执行:拉取公开仓库 deploy 分支(只含构建产物),有更新才同步到网站目录。
# 不需要任何密钥;只读公开分支。
set -euo pipefail
SITE_DIR="${SITE_DIR:-/opt/zotero-community/site}"
WEB_ROOT="${WEB_ROOT:-/var/www/zoterocn}"
REPO="${REPO:-https://github.com/cnzotero/zotero-community.git}"

if [ ! -d "$SITE_DIR/.git" ]; then
  git clone -q --depth 1 --branch deploy "$REPO" "$SITE_DIR"
fi
cd "$SITE_DIR"
git fetch -q --depth 1 origin deploy
if [ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ]; then exit 0; fi
git reset -q --hard FETCH_HEAD
# 必须有首页才同步,避免异常的空分支把网站清空
[ -s index.html ] || { echo "deploy 分支缺少 index.html,放弃同步" >&2; exit 1; }
rsync -a --delete --exclude '.git' ./ "$WEB_ROOT/"
echo "已同步 $(git rev-parse --short HEAD) $(date -u +%FT%TZ)"
