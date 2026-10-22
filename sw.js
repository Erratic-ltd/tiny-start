// Keeps the app working offline. Online it always fetches the newest files first.
const CACHE = "tinystart-v1";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "math.js",
  "questions.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "katex/katex.min.css",
  "katex/katex.min.js",
  "katex/fonts/KaTeX_AMS-Regular.woff2",
  "katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "katex/fonts/KaTeX_Main-Bold.woff2",
  "katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "katex/fonts/KaTeX_Main-Italic.woff2",
  "katex/fonts/KaTeX_Main-Regular.woff2",
  "katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "katex/fonts/KaTeX_Math-Italic.woff2",
  "katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "katex/fonts/KaTeX_Script-Regular.woff2",
  "katex/fonts/KaTeX_Size1-Regular.woff2",
  "katex/fonts/KaTeX_Size2-Regular.woff2",
  "katex/fonts/KaTeX_Size3-Regular.woff2",
  "katex/fonts/KaTeX_Size4-Regular.woff2",
  "katex/fonts/KaTeX_Typewriter-Regular.woff2"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return response;
      })
      .catch(function () { return caches.match(event.request); })
  );
});
