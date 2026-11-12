// Service worker mínimo: guarda solo la «carcasa» de la app (código, estilos, iconos) para que abra rápido.
// Nunca guarda datos de clientes: todas las peticiones a Supabase van siempre a la red.
const CACHE = "arc-v6";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./logo.jpg", "./logo-blanco.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return; // Supabase y fuentes: red directa
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match("./index.html"))));
});
// Notificaciones push
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Adrián Rodríguez Coaching", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Adrián Rodríguez Coaching", { body: d.body || "", icon: "./icon-192.png", badge: "./icon-192.png", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) { if ("focus" in w) { w.navigate ? w.navigate(url).catch(() => { }) : 0; return w.focus(); } } return self.clients.openWindow(url); }));
});
