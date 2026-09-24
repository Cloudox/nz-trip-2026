/* 离线缓存 v2
   策略：有网 → 走网络拿最新内容并刷新缓存；无网（山区）→ 用缓存。
   这样既能离线用，又不会出现"线上改了、手机上还是旧内容"。 */
const CACHE = "nz-trip-v2";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./data.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => {
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
