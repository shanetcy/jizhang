#!/bin/sh
# 构建并发布到 GitHub Pages（gh-pages 分支）。用法：npm run deploy
set -e
npm run build
touch dist/.nojekyll
cd dist
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -qm "deploy $(date '+%Y-%m-%d %H:%M')"
git push -qf "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "已发布：https://shanetcy.github.io/jizhang/"
