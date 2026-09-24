#!/bin/bash
# 把 index.html + styles.css + data.js + app.js 打包成单文件离线版
cd "$(dirname "$0")" && python3.11 - <<'PY'
import base64

css = open("styles.css", encoding="utf-8").read()
data = open("data.js", encoding="utf-8").read()
app  = open("app.js", encoding="utf-8").read()
icon = base64.b64encode(open("icon-192.png","rb").read()).decode()

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0d6e7a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>新西兰南岛 13 天 · 行程助手（离线版）</title>
<link rel="apple-touch-icon" href="data:image/png;base64,{icon}">
<style>
{css}
</style>
</head>
<body>
<header class="app-header">
  <div class="hd-top">
    <div class="hd-title">新西兰南岛 13 天</div>
    <div class="hd-sub">2026.9.24 香港出发 — 10.7 返抵香港</div>
  </div>
  <div class="hd-status" id="hdStatus"></div>
</header>
<main id="view" class="view"></main>
<nav class="tabbar">
  <button class="tab is-active" data-view="days"><span class="tab-ico">🗓</span><span>行程</span></button>
  <button class="tab" data-view="quick"><span class="tab-ico">📇</span><span>速查</span></button>
  <button class="tab" data-view="alert"><span class="tab-ico">⚠️</span><span>提醒</span></button>
  <button class="tab" data-view="check"><span class="tab-ico">✅</span><span>清单</span></button>
</nav>
<div class="toast" id="toast"></div>
<script>
{data}
</script>
<script>
{app}
</script>
</body>
</html>
"""
open("新西兰南岛行程助手-离线单文件.html","w",encoding="utf-8").write(html)
open("nz-trip-offline.html","w",encoding="utf-8").write(html)
print("offline built:", round(len(html.encode())/1024,1), "KB")
PY
