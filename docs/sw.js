// Service worker mínimo: guarda solo la «carcasa» de la app (código, estilos, iconos) para que abra rápido.
// Nunca guarda datos de clientes: todas las peticiones a Supabase van siempre a la red.
const CACHE = "arc-v9";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./logo.jpg", "./logo-blanco.png", "./icon-192.png", "./icon-512.png", "./fonts/archivo.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Archivos con ?v= (cambian de nombre en cada versión), fuentes, iconos y splash: caché primero (instantáneo).
// Página (index.html) y el resto: red primero con 3 s de margen y, si no hay red, la copia guardada.
const fijo = u => u.searchParams.has("v") || /\/(fonts|splash)\/|\.(png|jpg|woff2|webmanifest)$/.test(u.pathname);
const guardar = (req, r) => { if (r && r.ok && r.type === "basic") { const copy = r.clone(); caches.open(CACHE).then(async c => { const u = new URL(req.url); if (u.searchParams.has("v")) { for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); } } c.put(req, copy); }); } return r; };
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return; // Supabase y externos: red directa
  if (fijo(u)) { e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => guardar(e.request, r)))); return; }
  const red = fetch(e.request, { cache: "no-cache" }).then(r => guardar(e.request, r));
  const nav = e.request.mode === "navigate";
  e.respondWith(new Promise(res => {
    let hecho = false; const fin = r => { if (!hecho && r) { hecho = true; res(r); } };
    const copia = () => caches.match(e.request).then(m => m || (nav ? caches.match("./index.html") : null));
    const t = setTimeout(() => copia().then(fin), 3000);
    red.then(r => { clearTimeout(t); fin(r); }).catch(() => { clearTimeout(t); copia().then(m => fin(m || Response.error())); });
  }));
});
// Notificaciones push
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Adrián Rodríguez Coaching", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Adrián Rodríguez Coaching", { body: d.body || "", icon: "./icon-192.png", badge: "./badge-96.png", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) { if ("focus" in w) { w.navigate ? w.navigate(url).catch(() => { }) : 0; return w.focus(); } } return self.clients.openWindow(url); }));
});
