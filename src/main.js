import { createClient } from "@supabase/supabase-js";

/* ================= Configuración y cliente ================= */
const CFG = window.APP_CONFIG || {};
const sb = window.__SB_MOCK || createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => (v === null || v === undefined || v === "" || isNaN(+String(v).replace(",", "."))) ? null : +String(v).replace(",", ".");
const fmt = (v, d = 1) => v == null || isNaN(v) ? "—" : (+v).toLocaleString("es-ES", { maximumFractionDigits: d });
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => iso(new Date());
const parseD = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const fdate = (s, o) => { const d = parseD(s); return d ? d.toLocaleDateString("es-ES", o || { day: "numeric", month: "short" }) : "—"; };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const e1rm = (kg, reps, rir) => { kg = num(kg); reps = num(reps); if (kg == null || reps == null || !kg || !reps) return null; return kg * (1 + (reps + (num(rir) || 0)) / 30); };
const lines = s => (s || "").split("\n").map(x => x.trim()).filter(Boolean);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const slug = s => (s || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
function splitItem(x) { if (x && typeof x === "object") return { t: String(x.t || ""), p: String(x.p || "") }; const [t, ...r] = String(x || "").split("|"); return { t: t.trim(), p: r.join("|").trim() }; }
function seriesOf(sxr) { const m = String(sxr || "").match(/^\s*(\d+)\s*[x×]/i); return m ? Math.min(+m[1], 10) : 0; }
const WK = [
  ["sueno", "Calidad del sueño", "Muy mala", "Excelente"],
  ["fatiga", "Energía", "Muy cansado", "Recuperado"],
  ["dolor", "Agujetas", "Muchas", "Ninguna"],
  ["estres", "Estrés", "Muy alto", "Muy tranquilo"],
  ["animo", "Ánimo", "Muy bajo", "Muy bueno"],
  ["motivacion", "Ganas de entrenar", "Ninguna", "Muchísimas"],
  ["articular", "Articulaciones", "Con dolor", "Perfectas"]
];
const wellIdx = w => { const v = WK.map(([k]) => num(w && w[k])).filter(x => x != null); return v.length ? avg(v) : null; };

function toast(t) { const r = $("#toast-root"); r.innerHTML = `<div class="toast" role="status">${esc(t)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => r.innerHTML = "", 3000); }
function sheet(html, cls = "") { $("#modal-root").innerHTML = html ? `<div class="ov" data-act="close-bg"><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div></div>` : ""; }
function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || "";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (/invalid|expired/i.test(m) && /otp|token|code/i.test(m)) return "El código no es válido o ha caducado. Pide uno nuevo.";
  if (/row-level security/i.test(m)) return "No tienes permiso para guardar esto.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet y vuelve a intentarlo.";
  if (/Demasiados registros/i.test(m)) return "Has llegado al límite de registros de hoy.";
  return "No se pudo completar: " + (m || "error desconocido");
}
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

/* ================= Gráfica sencilla ================= */
function niceTicks(a, b, n) { const span = b - a || 1; const s0 = span / n; const mag = 10 ** Math.floor(Math.log10(s0)); const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= s0) || 10 * mag; const t = []; for (let v = Math.floor(a / st) * st; v <= b + st * 0.999; v += st) t.push(+v.toFixed(6)); return t; }
function lineChart(pts, o = {}) {
  pts = pts.filter(p => p.y != null && parseD(p.x)).sort((a, b) => a.x.localeCompare(b.x));
  if (pts.length < 2) return `<div class="empty">${esc(o.empty || "Aún no hay suficientes datos para la gráfica")}</div>`;
  const W = 560, H = 210, P = { l: 40, r: 44, t: 12, b: 24 };
  const xs = pts.map(p => parseD(p.x).getTime()); const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  let y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y)); if (o.yMin != null) { y0 = o.yMin; y1 = o.yMax; } else { const pd = (y1 - y0) * .15 || 1; y0 -= pd; y1 += pd; }
  const tk = niceTicks(y0, y1, 4); if (o.yMin == null) { y0 = tk[0]; y1 = tk[tk.length - 1]; }
  const X = t => P.l + (t - x0) / ((x1 - x0) || 1) * (W - P.l - P.r), Y = v => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  let g = tk.filter(v => v >= y0 && v <= y1).map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, 1)}</text>`).join("");
  const c = pts.map(p => [X(parseD(p.x).getTime()), Y(p.y), p.y]);
  const d = c.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  g += `<path d="${d} L${c[c.length - 1][0]} ${H - P.b} L${c[0][0]} ${H - P.b} Z" fill="var(--accent)" opacity=".1"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>`;
  g += c.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === c.length - 1 ? 4.5 : 2.6}" fill="${i === c.length - 1 ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="2"/>`).join("");
  const l = c[c.length - 1]; g += `<text x="${l[0] + 8}" y="${l[1] + 4}" style="fill:var(--accent);font-weight:700">${fmt(l[2], o.dec ?? 1)}</text>`;
  const step = Math.max(1, Math.ceil(pts.length / 5)); g += pts.filter((p, i) => i % step === 0 || i === pts.length - 1).map(p => `<text x="${X(parseD(p.x).getTime())}" y="${H - 5}" text-anchor="middle">${esc(fdate(p.x))}</text>`).join("");
  g += `<line class="guide" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" stroke-dasharray="3 3" style="display:none"/><circle class="hl" r="6" fill="var(--accent)" stroke="#fff" stroke-width="2" style="display:none"/>`;
  const data = c.map((q2, i) => [+q2[0].toFixed(1), +q2[1].toFixed(1), (pts[i].lbl || fdate(pts[i].x, { weekday: "short", day: "numeric", month: "short" })) + " · " + fmt(q2[2], o.dec ?? 1) + (o.unit ? " " + o.unit : "") + (pts[i].tip ? " · " + pts[i].tip : "")]);
  return `<div class="chart" data-pts="${esc(JSON.stringify(data))}" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || "Gráfica")}">${g}</svg><div class="ctip" role="status" hidden></div></div>`;
}
function chartHover(ev) {
  const ch = ev.target.closest && ev.target.closest(".chart[data-pts]"); if (!ch) return;
  const svg = ch.querySelector("svg"); const r = svg.getBoundingClientRect(); const W = +ch.dataset.w;
  const pts = JSON.parse(ch.dataset.pts); const mx = (ev.clientX - r.left) / r.width * W;
  let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - mx) < Math.abs(best[0] - mx)) best = p;
  const k = r.width / W; const g = svg.querySelector(".guide"), h = svg.querySelector(".hl"), tip = ch.querySelector(".ctip");
  g.setAttribute("x1", best[0]); g.setAttribute("x2", best[0]); g.style.display = ""; h.setAttribute("cx", best[0]); h.setAttribute("cy", best[1]); h.style.display = "";
  tip.hidden = false; tip.textContent = best[2];
  const left = Math.min(Math.max(best[0] * k - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth); tip.style.left = left + "px"; tip.style.top = Math.max(best[1] * k - 44, 0) + "px";
}
function chartLeave(ev) { const ch = ev.target.closest && ev.target.closest(".chart[data-pts]"); if (!ch) return; ch.querySelectorAll(".guide,.hl").forEach(x => x.style.display = "none"); const t = ch.querySelector(".ctip"); if (t) t.hidden = true; }
document.addEventListener("pointermove", chartHover);
document.addEventListener("pointerdown", chartHover);
document.addEventListener("pointerleave", chartLeave, true);
document.addEventListener("pointerout", ev => { if (ev.target.closest && ev.target.closest(".chart[data-pts]") && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest(".chart[data-pts]"))) chartLeave(ev); });

/* ================= Estado ================= */
const S = { me: null, email: "", view: "hoy", plan: null, sub: {}, coach: { list: [], cid: null, tab: "plan", evo: "actividad" }, lib: { tab: "workouts", ex: null } };
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  hoy: svg('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  entreno: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>'),
  nutri: svg('<path d="M12 21c-4 0-7-3.5-7-8 0-3 2-5 4.5-5 1.2 0 1.8.5 2.5.5s1.3-.5 2.5-.5C17 8 19 10 19 13c0 4.5-3 8-7 8z"/><path d="M12 8c0-2 1-4 3-5"/>'),
  progreso: svg('<path d="M3 20h18M5 16l5-5 4 3 6-7"/>'),
  mas: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>'),
  clientes: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 4-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.5 2.3 4 5"/>'),
  lib: svg('<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15-3.5 1z"/>'),
  info: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 2-3 3.5-3s2.7 1 3.5 3M14 9h5M14 13h4"/>'),
  evo: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  doc: svg('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>'),
  key: svg('<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>'),
  plan: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h3M7 17h6"/>')
};
const initials = n => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const avatar = (n, cls = "") => `<span class="av ${cls}" aria-hidden="true">${esc(initials(n))}</span>`;
const TIPOS = { workout: "Workout", cardio: "Cardio", tarea: "Tarea", formulario: "Formulario", nota: "Mensaje" };
const ACCIONES = [["", "Tarea libre"], ["peso", "Registrar su peso"], ["fotos", "Subir fotos de su físico"], ["medidas", "Tomar medidas"], ["wellness", "Rellenar el cuestionario diario"]];
// Un mensaje programado no se muestra al cliente hasta su fecha y hora
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const yaVisible = x => x.tipo !== "nota" || x.fecha < today() || (x.fecha === today() && (!(x.contenido || {}).hora || x.contenido.hora <= nowHM()));
// Al registrar peso, fotos, medidas o cuestionario se completan solas las tareas pendientes de ese tipo (hoy o atrasadas)
async function completarAccion(accion) {
  try { const xs = await q(sb.from("assignments").select("id,contenido,hecho,fecha").eq("tipo", "tarea").eq("hecho", false).lte("fecha", today()).gte("fecha", addDays(today(), -14)));
    for (const x of xs.filter(x => (x.contenido || {}).accion === accion)) await q(sb.rpc("completar_asignacion", { p_id: x.id, p_hecho: true, p_respuesta: "", p_resultado: null }));
  } catch { }
}
const EV_TIPOS = { competicion: "Competición", test: "Test", control: "Control", recordatorio: "Recordatorio", otro: "Otro" };
const DSEM = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dow = s => ((parseD(s).getDay() + 6) % 7) + 1;
const monday = s => addDays(s, 1 - dow(s));
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const tipoChip = t => `<span class="tp tp-${esc(t)}">${esc(TIPOS[t] || EV_TIPOS[t] || t)}</span>`;


/* ================= Actualización automática ================= */
// Cada vez que se publica una versión nueva, index.html cambia el ?v= de app.js.
// La app lo comprueba al volver a abrirla, al cambiar de pantalla y cada 2 minutos.
// Si no estás escribiendo nada, recarga sola; si hay un formulario a medias, avisa con un botón.
const MY_V = (document.querySelector('script[src*="app.js"]')?.getAttribute("src") || "").split("v=")[1] || "";
let dirty = false, updPending = false;
document.addEventListener("input", () => { dirty = true; }, true);
window.addEventListener("hashchange", () => { dirty = false; if (updPending) safeReload(); });
function safeReload() {
  const busy = dirty || $("#modal-root")?.innerHTML || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if (!busy) { location.reload(); return; }
  if (!$("#upd-bar")) document.body.insertAdjacentHTML("beforeend", `<div id="upd-bar" class="upd" role="status">Hay una versión nueva de la app <button type="button" class="btn sm pri" onclick="location.reload()">Actualizar</button></div>`);
}
async function checkUpdate() {
  if (!MY_V || updPending || location.protocol !== "https:") return;
  try {
    const t = await fetch("./index.html", { cache: "no-store" }).then(r => r.ok ? r.text() : "");
    const v = (t.match(/app\.js\?v=(\w+)/) || [])[1];
    if (v && v !== MY_V) { updPending = true; navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => { }); safeReload(); }
  } catch { }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });
window.addEventListener("focus", checkUpdate);
window.addEventListener("online", checkUpdate);
setInterval(checkUpdate, 120000);

/* ================= Arranque y acceso ================= */
const LOGO = `<img class="logo" src="./logo.jpg" alt="">`;
async function init() {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => { });
  if (!CFG.supabaseUrl || /TU-PROYECTO/.test(CFG.supabaseUrl)) { if (!window.__SB_MOCK) { $("#app").innerHTML = `<div class="login">${LOGO}<h1>Falta configurar</h1><p>Pon la URL y la clave pública de Supabase en config.js.</p></div>`; return; } }
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "SIGNED_OUT") { S.me = null; clearLocal(); renderLogin(); }
    if (ev === "PASSWORD_RECOVERY") { S.recovery = true; renderLogin("nueva"); }
  });
  const { data } = await sb.auth.getSession();
  if (S.recovery) return;
  if (!data || !data.session) return renderLogin();
  S.email = data.session.user.email || "";
  await afterLogin();
}
function clearLocal() { try { Object.keys(localStorage).filter(k => k.startsWith("arc-")).forEach(k => localStorage.removeItem(k)); } catch { } }
async function afterLogin() {
  try { const rows = await q(sb.rpc("my_profile")); const p = (rows || []).find(r => r.es_entrenador) || (rows || [])[0];
    if (!p) return renderNoAccess();
    S.me = { role: p.es_entrenador ? "coach" : "client", cid: p.id, nombre: p.nombre }; S.plan = null;
    const hc = isCoachHash(location.hash.slice(1));
    if (!location.hash || (S.me.role === "coach") !== hc) location.hash = S.me.role === "coach" ? "inicio" : "hoy";
    route();
  } catch (e) { $("#app").innerHTML = `<div class="login">${LOGO}<h1>No se pudo cargar</h1><p>${esc(errMsg(e))}</p><button class="btn pri" data-act="reload">Reintentar</button><button class="btn ghost" data-act="logout">Cerrar sesión</button></div>`; }
}
function renderNoAccess() {
  $("#app").innerHTML = `<form class="login" id="f-alta-codigo">${LOGO}<h1>Activa tu cuenta</h1><p>Has entrado como <b>${esc(S.email)}</b>. Escribe el código de alta que te ha dado Adrián para vincular tu cuenta.</p>
  <div class="f"><label for="ac">Código de alta</label><input id="ac" name="codigo" autocomplete="off" autocapitalize="characters" required maxlength="12"></div>
  <button class="btn pri block">Activar</button><button type="button" class="btn ghost" data-act="logout">Cerrar sesión</button></form>`;
}
const EYE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>`;
const pwField = (id, label, ac) => `<div class="f"><label for="${id}">${label}</label><div class="pw"><input id="${id}" name="${id}" type="password" autocomplete="${ac}" minlength="8" maxlength="72" required><button type="button" class="eye" data-act="ver-pw" aria-label="Mostrar contraseña" title="Mostrar contraseña">${EYE}</button></div></div>`;
function renderLogin(stage) {
  const head = `${LOGO}<h1>${esc(CFG.nombre || "Adrián Rodríguez Coaching")}</h1>`;
  const tabs = cur => `<div class="seg" role="group" aria-label="Acceso"><button type="button" data-act="login-tab" data-t="" aria-pressed="${cur === "entrar"}">Entrar</button><button type="button" data-act="login-tab" data-t="alta" aria-pressed="${cur === "alta"}">Nuevo atleta</button></div>`;
  if (stage === "alta") {
    $("#app").innerHTML = `<form class="login" id="f-alta">${head}${tabs("alta")}<p>¿Es tu primera vez? Crea tu cuenta con el email que le diste a Adrián y el código de alta que te ha enviado.</p>
    <div class="f"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
    ${pwField("pw", "Crea una contraseña (mínimo 8 caracteres)", "new-password")}${pwField("pw2", "Repite la contraseña", "new-password")}
    <div class="f"><label for="codigo">Código de alta</label><input id="codigo" name="codigo" autocomplete="off" autocapitalize="characters" required maxlength="12" placeholder="8 caracteres"></div>
    <button class="btn pri block">Crear mi cuenta</button></form>`; return;
  }
  if (stage === "olvido") {
    $("#app").innerHTML = `<form class="login" id="f-olvido">${head}<p>Te enviaremos un enlace a tu email para crear una contraseña nueva. Ábrelo en este mismo móvil.</p>
    <div class="f"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
    <button class="btn pri block">Enviar enlace</button><button type="button" class="btn ghost" data-act="login-tab" data-t="">Volver</button></form>`; return;
  }
  if (stage === "nueva") {
    $("#app").innerHTML = `<form class="login" id="f-nueva">${head}<p>Escribe tu nueva contraseña.</p>${pwField("pw", "Nueva contraseña (mínimo 8 caracteres)", "new-password")}${pwField("pw2", "Repítela", "new-password")}<button class="btn pri block">Guardar contraseña</button></form>`; return;
  }
  $("#app").innerHTML = `<form class="login" id="f-login">${head}${tabs("entrar")}
  <div class="f"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
  ${pwField("pw", "Contraseña", "current-password")}
  <button class="btn pri block">Entrar</button><button type="button" class="btn ghost" data-act="login-tab" data-t="olvido">He olvidado mi contraseña</button></form>`;
}
function authMsg(e) {
  const m = (e && e.message) || "";
  if (/invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/already registered|already exists/i.test(m)) return "Ese email ya tiene cuenta. Entra desde «Entrar».";
  if (/password/i.test(m) && /(short|least|weak|characters)/i.test(m)) return "La contraseña es demasiado débil: usa al menos 8 caracteres, mezclando letras y números.";
  if (/email not confirmed/i.test(m)) return "Tienes que confirmar tu email antes de entrar.";
  return errMsg(e);
}
async function doLogin(f) {
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { const email = f.email.value.trim().toLowerCase(); await q(sb.auth.signInWithPassword({ email, password: f.pw.value })); S.email = email; await afterLogin(); }
  catch (e) { toast(authMsg(e)); b.disabled = false; }
}
async function doAlta(f) {
  const email = f.email.value.trim().toLowerCase(), pw = f.pw.value, codigo = f.codigo.value.trim();
  if (pw !== f.pw2.value) { toast("Las contraseñas no coinciden"); return; }
  if (pw.length < 8) { toast("La contraseña debe tener al menos 8 caracteres"); return; }
  const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    let r = await sb.auth.signUp({ email, password: pw });
    if (r.error && /already registered|already exists/i.test(r.error.message)) r = await sb.auth.signInWithPassword({ email, password: pw });
    if (r.error) throw r.error;
    if (!r.data.session) { toast("Revisa tu email para confirmar la cuenta y luego entra con tu contraseña."); b.disabled = false; return; }
    S.email = email;
    const ok = await q(sb.rpc("alta_atleta", { p_codigo: codigo }));
    if (!ok) { toast("El código no coincide con ese email. Revísalo o pídele uno nuevo a Adrián."); renderNoAccess(); return; }
    toast("¡Cuenta creada!"); await afterLogin();
  } catch (e) { toast(authMsg(e)); b.disabled = false; }
}
async function doAltaCodigo(f) {
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { const ok = await q(sb.rpc("alta_atleta", { p_codigo: f.codigo.value.trim() })); if (!ok) { toast("Código no válido para este email"); b.disabled = false; return; } await afterLogin(); }
  catch (e) { toast(errMsg(e)); b.disabled = false; }
}
async function doOlvido(f) {
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { await q(sb.auth.resetPasswordForEmail(f.email.value.trim().toLowerCase(), { redirectTo: location.origin + location.pathname })); toast("Si ese email tiene cuenta, te llegará un enlace en unos minutos."); renderLogin(); }
  catch (e) { toast(errMsg(e)); b.disabled = false; }
}
async function doNueva(f) {
  if (f.pw.value !== f.pw2.value) { toast("Las contraseñas no coinciden"); return; }
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { await q(sb.auth.updateUser({ password: f.pw.value })); S.recovery = false; toast("Contraseña cambiada"); history.replaceState(null, "", location.pathname); const { data } = await sb.auth.getSession(); S.email = (data.session && data.session.user.email) || ""; await afterLogin(); }
  catch (e) { toast(authMsg(e)); b.disabled = false; }
}

/* ================= Navegación ================= */
const CLIENT_TABS = [["hoy", "Hoy", "hoy"], ["cal", "Calendario", "cal"], ["entreno", "Entreno", "entreno"], ["nutri", "Nutrición", "nutri"], ["progreso", "Progreso", "progreso"]];
const COACH_TABS = [["inicio", "Inicio", "hoy"], ["c", "Clientes", "clientes"], ["lib", "Librería", "lib"], ["mas", "Perfil", "mas"]];
const isCoachHash = h => ["inicio", "c", "lib"].includes(h) || h.startsWith("c-") || h.startsWith("lib-");
function shell(title, body, opts = {}) {
  const coach = S.me.role === "coach";
  const v = S.view; document.body.classList.toggle("is-coach", coach);
  if (coach) {
    const cur = v.startsWith("c") ? "c" : v.startsWith("lib") ? "lib" : v;
    const crumb = opts.crumb || [[null, title]];
    $("#app").innerHTML = `<header class="hnav"><a class="hlogo" href="#inicio" aria-label="Inicio"><img src="./logo.jpg" alt=""></a>
    <nav class="hmenu" aria-label="Secciones">${COACH_TABS.filter(t => t[0] !== "mas").map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>
    <span class="grow"></span><button class="hme" data-act="go" data-h="mas" aria-label="Tu perfil" aria-current="${cur === "mas"}">${avatar(S.me.nombre || "A", "dark")}</button></header>
    <div class="crumb"><div class="crumbin">${crumb.map(([h, l, av], k) => `${k ? `<span class="sep">/</span>` : ""}${h ? `<a href="#${esc(h)}">${esc(l)}</a>` : `<b>${av ? avatar(l, "xs") : ""}${esc(l)}</b>`}`).join("")}${opts.sub ? `<span class="csub">${esc(opts.sub)}</span>` : ""}<span class="grow"></span>${opts.right || ""}</div></div>
    <main class="wide" id="main">${body}</main>`;
  } else {
    const tabs = CLIENT_TABS; const cur = v.split("-")[0];
    const right = !opts.back ? `<button class="back" data-act="go" data-h="mas" aria-label="Tu perfil">${avatar(S.me.nombre)}</button>` : (opts.right || "");
    $("#app").innerHTML = `<header class="top">${opts.back ? `<button class="back" data-act="go" data-h="${esc(opts.back)}" aria-label="Volver">←</button>` : `<img src="./logo.jpg" alt="">`}<h1>${esc(title)}${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ""}</h1>${right}</header>
    <main id="main">${body}</main>
    ${opts.noTabs ? "" : `<nav class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)" aria-label="Secciones">${tabs.map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>`}`;
  }
  if (!opts.keepScroll) window.scrollTo(0, 0);
}
function loading(title) { shell(title, `<div class="empty">Cargando…</div>`); }
async function route() {
  if (!S.me) return;
  const coach = S.me.role === "coach";
  let h = location.hash.slice(1) || (coach ? "inicio" : "hoy");
  if (!coach && isCoachHash(h)) h = "hoy"; // la vista de entrenador no existe para clientes
  if (coach && !isCoachHash(h) && h !== "mas") h = "inicio";
  S.view = h;
  try {
    if (coach) {
      if (h.startsWith("c-")) return await viewCoachClient(decodeURIComponent(h.slice(2)));
      if (h === "c") return await viewCoachList();
      if (h === "lib") return await viewLib();
      if (h.startsWith("lib-w-")) return await viewLibWorkout(h.slice(6));
      if (h.startsWith("lib-p-")) return await viewLibProgram(h.slice(6));
      if (h.startsWith("lib-r-")) return await viewLibRecipe(h.slice(6));
      if (h === "mas") return await viewMas();
      return await viewInicio();
    }
    if (h === "cal") return await viewCal();
    if (h === "entreno") return await viewEntreno();
    if (h.startsWith("a-")) return await viewWorkout(h.slice(2));
    if (h === "nutri") return await viewNutri();
    if (h === "progreso") return await viewProgreso();
    if (h === "informes") return await viewInformes();
    if (h.startsWith("informe-")) return await viewInforme(decodeURIComponent(h.slice(8)));
    if (h === "mas") return await viewMas();
    return await viewHoy();
  } catch (e) { shell("Error", `<div class="banner">${esc(errMsg(e))}</div><button class="btn" data-act="reload">Reintentar</button>`); }
}
window.addEventListener("hashchange", route);

/* ================= Cliente: datos ================= */
async function getPlan() {
  if (S.plan) return S.plan;
  const rows = await q(sb.from("plans").select("objetivo,bloques,habitos,nutricion,progreso_visible").limit(1));
  S.plan = rows[0] || { bloques: [], habitos: [], objetivo: "", progreso_visible: ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"] };
  return S.plan;
}
function weekNow(plan, d = today()) { for (const b of plan.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= d && d <= s.fin); if (w) return { ...w, bloque: b.nombre }; } return null; }
const getAsig = async (from, to) => (await q(sb.from("assignments").select("*").gte("fecha", from).lte("fecha", to).order("fecha").order("orden"))).filter(yaVisible);
function asigRow(x) {
  const t = today(); const late = !x.hecho && x.fecha < t;
  const h = x.tipo === "workout" ? `data-act="go" data-h="a-${esc(x.id)}"` : `data-act="item" data-id="${esc(x.id)}"`;
  const n = x.tipo === "workout" ? ((x.contenido && x.contenido.ejercicios) || []).length : 0;
  const sub = [TIPOS[x.tipo], n ? n + " ejercicios" : "", x.fecha !== t ? (late ? "era para el " : "") + fdate(x.fecha, { weekday: "short", day: "numeric", month: "short" }) : ""].filter(Boolean).join(" · ");
  const acc = x.tipo === "tarea" && (x.contenido || {}).accion;
  const btn = x.tipo === "workout" ? "Empezar" : x.tipo === "nota" ? "Leer" : acc === "peso" ? "Apuntar" : acc === "fotos" ? "Subir" : acc === "medidas" ? "Medir" : acc === "wellness" ? "Rellenar" : late ? "Pendiente" : "Abrir";
  return `<button class="it" ${h}><span class="itl"><i class="dot dot-${esc(x.tipo)}"></i><span><b>${esc(x.titulo)}</b><br><span class="tiny muted">${esc(sub)}</span></span></span>${x.hecho ? `<span class="done">${x.tipo === "nota" ? "Leído ✓" : "Hecho ✓"}</span>` : `<span class="chip ${late && x.tipo !== "nota" ? "warn" : "acc"}">${btn}</span>`}</button>`;
}

/* ================= Cliente: Hoy ================= */
async function viewHoy() {
  loading("Hoy");
  const t = today();
  const [plan, wl, wt, asig, rp, ev] = await Promise.all([getPlan(), q(sb.from("wellness").select("id").eq("fecha", t).limit(1)), q(sb.from("weights").select("*").order("fecha", { ascending: false }).limit(1)), getAsig(addDays(t, -7), addDays(t, 7)), q(sb.from("reports").select("id,fecha,titular,semana").order("fecha", { ascending: false }).limit(1)), q(sb.from("events").select("*").gte("fecha", t).order("fecha").limit(3))]);
  const w = weekNow(plan); const lastW = wt[0];
  const msgs = asig.filter(x => x.tipo === "nota" && x.fecha <= t && (!x.hecho || x.fecha === t)).slice(-3);
  const hoy = asig.filter(x => x.fecha === t && x.tipo !== "nota"), atras = asig.filter(x => x.fecha < t && !x.hecho && x.tipo !== "nota"), prox = asig.filter(x => x.fecha > t && x.tipo !== "nota").slice(0, 4);
  shell(CFG.nombre || "Hoy", `
  <section class="hello"><h2>Hola, ${esc((S.me.nombre || "").split(" ")[0])}</h2><p>${esc(cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })))}${w ? ` · ${esc(w.bloque)} · ${esc(w.nombre)}` : ""}</p></section>
  ${msgs.map(m => `<button class="msg ${m.hecho ? "leido" : ""}" data-act="item" data-id="${esc(m.id)}">${avatar("Adrián Rodríguez", "sm")}<span><b>Adrián</b> <span class="tiny muted">${esc(fdate(m.fecha, { weekday: "short", day: "numeric" }))}${(m.contenido || {}).hora ? " · " + esc(m.contenido.hora) : ""}</span><br>${esc(((m.contenido || {}).detalle || m.titulo).slice(0, 220))}</span></button>`).join("")}
  ${w && w.foco ? `<div class="card"><h2>Esta semana <small>${esc(w.tipo && w.tipo !== "carga" ? cap(w.tipo) : "")}</small></h2><p class="small" style="margin:0">${esc(w.foco)}</p></div>` : ""}
  <div class="card"><h2>Para hoy</h2><div class="list">
    ${hoy.length ? hoy.map(asigRow).join("") : `<div class="it" style="cursor:default"><span><b>Hoy no tienes entreno</b><br><span class="tiny muted">${prox[0] ? `Lo siguiente: ${esc(prox[0].titulo)} · ${esc(fdate(prox[0].fecha, { weekday: "long" }))}` : "Descansa y recupera"}</span></span></div>`}
    <button class="it" data-act="wellness"><span class="itl"><i class="dot dot-formulario"></i><span><b>Cuestionario diario</b><br><span class="tiny muted">1 minuto · sueño y cómo te sientes</span></span></span>${wl[0] ? `<span class="done">Hecho ✓</span>` : `<span class="chip acc">Rellenar</span>`}</button>
    <button class="it" data-act="peso"><span class="itl"><i class="dot dot-nota"></i><span><b>Peso</b><br><span class="tiny muted">${lastW ? `Último: ${fmt(lastW.kg)} kg (${esc(fdate(lastW.fecha))})` : "En ayunas, después de ir al baño"}</span></span></span>${lastW && lastW.fecha === t ? `<span class="done">Hecho ✓</span>` : `<span class="chip">Apuntar</span>`}</button>
  </div></div>
  ${atras.length ? `<div class="card"><h2>Pendiente de días anteriores</h2><div class="list">${atras.map(asigRow).join("")}</div></div>` : ""}
  ${prox.length ? `<div class="card"><h2>Próximos días <small><a href="#cal">Calendario</a></small></h2><div class="list">${prox.map(asigRow).join("")}</div></div>` : ""}
  ${ev.length ? `<div class="card"><h2>Fechas importantes</h2>${ev.map(e => `<p class="small" style="margin:6px 0"><b>${esc(fdate(e.fecha, { day: "numeric", month: "long" }))}</b> · ${esc(e.titulo)}</p>`).join("")}</div>` : ""}
  ${rp[0] ? `<div class="card"><h2>Tu último informe <small>${esc(fdate(rp[0].fecha))}</small></h2><p style="margin:0 0 10px"><b>${esc(rp[0].titular || rp[0].semana || "Informe semanal")}</b></p><button class="btn block" data-act="go" data-h="informe-${esc(encodeURIComponent(rp[0].id))}">Leer informe</button></div>` : ""}
  ${(plan.habitos || []).length ? `<div class="card"><h2>Tus hábitos</h2><ul class="small" style="margin:0;padding-left:18px">${plan.habitos.map(hb => `<li>${esc(hb)}</li>`).join("")}</ul></div>` : ""}`);
}
async function openItem(id) {
  const x = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; if (!x) return;
  const acc = x.tipo === "tarea" && !x.hecho && (x.contenido || {}).accion;
  if (acc === "peso") return openPeso(); if (acc === "fotos") return openFotos(); if (acc === "medidas") return openMedidas();
  if (acc === "wellness") { const r = await q(sb.from("wellness").select("*").eq("fecha", today()).limit(1)).catch(() => []); return openWellness(r[0]); }
  const c = x.contenido || {}; const pre = (c.preguntas || []);
  const prevR = (x.resultado && x.resultado.respuestas) || [];
  sheet(`<h2>${esc(x.titulo)}</h2><p class="tiny muted" style="margin:0">${esc(TIPOS[x.tipo] || "")} · ${esc(fdate(x.fecha, { weekday: "long", day: "numeric", month: "long" }))}</p>
  ${c.detalle ? `<p class="small" style="white-space:pre-wrap;margin:0">${esc(c.detalle)}</p>` : ""}
  <form id="f-item" data-id="${esc(x.id)}" style="display:flex;flex-direction:column;gap:10px">
  ${pre.map((p, i) => `<div class="f"><label for="q${i}">${esc(p)}</label><textarea id="q${i}" name="q${i}" maxlength="1000" style="min-height:60px">${esc((prevR[i] && prevR[i].r) || "")}</textarea></div>`).join("")}
  ${x.tipo !== "nota" ? `<div class="f"><label for="it-r">Comentario para Adrián (opcional)</label><textarea id="it-r" name="respuesta" maxlength="2000" style="min-height:60px">${esc(x.respuesta || "")}</textarea></div>` : ""}
  <button class="btn pri block">${x.tipo === "nota" ? (x.hecho ? "Leída ✓" : "Marcar como leída") : x.hecho ? "Guardar" : x.tipo === "formulario" ? "Enviar respuestas" : "Marcar como hecho"}</button>
  ${x.hecho && x.tipo !== "nota" ? `<button type="button" class="btn ghost" data-act="item-undo" data-id="${esc(x.id)}">Marcar como no hecho</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveItem(f) {
  const pre = [...f.querySelectorAll("textarea[name^=q]")]; const x = (await q(sb.from("assignments").select("contenido").eq("id", f.dataset.id).limit(1)))[0] || {};
  const qs = (x.contenido && x.contenido.preguntas) || [];
  const resultado = pre.length ? { respuestas: pre.map((t, i) => ({ p: qs[i] || "", r: t.value.trim() })) } : null;
  try { await q(sb.rpc("completar_asignacion", { p_id: f.dataset.id, p_hecho: true, p_respuesta: f.respuesta ? f.respuesta.value.trim() : "", p_resultado: resultado })); sheet(""); toast("¡Hecho!"); route(); } catch (e) { toast(errMsg(e)); }
}

/* ================= Cliente: Calendario ================= */
async function viewCal() {
  loading("Calendario");
  const t = today(); const m = S.sub.calM || t.slice(0, 7); const sel = S.sub.calD && S.sub.calD.startsWith(m) ? S.sub.calD : (t.startsWith(m) ? t : m + "-01");
  const first = m + "-01"; const last = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
  const [plan, asig, ev, wo] = await Promise.all([getPlan(), getAsig(first, last), q(sb.from("events").select("*").lte("fecha", last).order("fecha")), q(sb.from("workouts").select("fecha,dia,assignment_id").gte("fecha", first).lte("fecha", last))]);
  const evOn = d => ev.filter(e => e.fecha <= d && d <= (e.fin || e.fecha));
  const libres = wo.filter(w => !w.assignment_id);
  let cells = Array.from({ length: dow(first) - 1 }, () => `<span></span>`).join("");
  for (let k = 1; k <= +last.slice(8); k++) {
    const d = m + "-" + String(k).padStart(2, "0"); const a = asig.filter(x => x.fecha === d);
    const dots = [...new Set(a.map(x => x.tipo))].map(tp => `<i class="dot dot-${tp}${a.filter(x => x.tipo === tp).every(x => x.hecho) ? "" : " hollow"}"></i>`).join("") + (evOn(d).length ? `<i class="dot dot-evento"></i>` : "") + (libres.some(w => w.fecha === d) ? `<i class="dot dot-workout"></i>` : "");
    cells += `<button class="cd${d === t ? " hoy" : ""}" data-act="cal-d" data-d="${d}" aria-pressed="${d === sel}" aria-label="${esc(fdate(d, { weekday: "long", day: "numeric", month: "long" }))}"><span>${k}</span><span class="dots">${dots}</span></button>`;
  }
  const w = weekNow(plan, sel);
  const items = [...asig.filter(x => x.fecha === sel).map(asigRow), ...libres.filter(x => x.fecha === sel).map(x => `<div class="it" style="cursor:default"><span><b>${esc(x.dia || "Entreno")}</b><br><span class="tiny muted">Entreno registrado</span></span><span class="done">Hecho ✓</span></div>`), ...evOn(sel).map(e => `<div class="it" style="cursor:default"><span class="itl"><i class="dot dot-evento"></i><span><b>${esc(e.titulo)}</b><br><span class="tiny muted">${esc(EV_TIPOS[e.tipo] || cap(e.tipo || ""))}${e.notas ? " · " + esc(e.notas) : ""}</span></span></span></div>`)];
  const mName = cap(parseD(first).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const prevM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7), nextM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
  shell("Calendario", `<div class="card"><div class="row"><button class="btn ghost sm" data-act="cal-m" data-m="${prevM}" aria-label="Mes anterior">‹</button><h2 class="grow" style="text-align:center;margin:0;display:block">${esc(mName)}</h2><button class="btn ghost sm" data-act="cal-m" data-m="${nextM}" aria-label="Mes siguiente">›</button></div>
  <div class="calg"><span class="dh">L</span><span class="dh">M</span><span class="dh">X</span><span class="dh">J</span><span class="dh">V</span><span class="dh">S</span><span class="dh">D</span>${cells}</div>
  <div class="leg tiny muted"><span><i class="dot dot-workout"></i>Workout</span><span><i class="dot dot-cardio"></i>Cardio</span><span><i class="dot dot-tarea"></i>Tarea</span><span><i class="dot dot-formulario"></i>Formulario</span><span><i class="dot dot-evento"></i>Evento</span><span><i class="dot dot-workout hollow"></i>Pendiente</span></div></div>
  <div class="card"><h2>${esc(cap(fdate(sel, { weekday: "long", day: "numeric", month: "long" })))}${w ? ` <small>${esc(w.bloque)} · ${esc(w.nombre)}</small>` : ""}</h2>${items.length ? `<div class="list">${items.join("")}</div>` : `<p class="small muted" style="margin:0">Nada previsto este día.</p>`}</div>`);
}

/* ================= Cliente: Entreno ================= */
async function viewEntreno() {
  loading("Entreno"); const t = today(); const mon = monday(t);
  const [asig, wo] = await Promise.all([getAsig(mon, addDays(mon, 13)), q(sb.from("workouts").select("id,fecha,dia,sets").order("fecha", { ascending: false }).limit(20))]);
  const ent = asig.filter(x => x.tipo === "workout" || x.tipo === "cardio");
  const sem1 = ent.filter(x => x.fecha <= addDays(mon, 6)), sem2 = ent.filter(x => x.fecha > addDays(mon, 6));
  shell("Entreno", `<div class="card"><h2>Esta semana</h2>${sem1.length ? `<div class="list">${sem1.map(asigRow).join("")}</div>` : `<div class="empty">Adrián aún no te ha programado entrenos esta semana.</div>`}</div>
  ${sem2.length ? `<div class="card"><h2>La semana que viene</h2><div class="list">${sem2.map(asigRow).join("")}</div></div>` : ""}
  <div class="card"><h2>Últimos entrenos</h2>${wo.length ? `<div class="list">${wo.slice(0, 10).map(x => `<div class="it" style="cursor:default"><span><b>${esc(x.dia || "Entreno")}</b><br><span class="tiny muted">${esc(fdate(x.fecha, { weekday: "short", day: "numeric", month: "short" }))} · ${(x.sets || []).length} series</span></span></div>`).join("")}</div>` : `<div class="empty">Aún no has registrado ningún entreno.</div>`}</div>`);
}
const draftKey = id => `arc-draft-${S.me.cid}-${id}`;
async function viewWorkout(id) {
  loading("Entreno");
  const [ar, wo] = await Promise.all([q(sb.from("assignments").select("*").eq("id", id).limit(1)), q(sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(40))]);
  const a = ar[0]; if (!a) { location.hash = "entreno"; return; }
  const c = a.contenido || {}; let draft = {}; try { draft = JSON.parse(localStorage.getItem(draftKey(id)) || "{}"); } catch { }
  const lastSets = name => { for (const w of wo) { const s = (w.sets || []).filter(x => x.ejercicio === name); if (s.length) return { fecha: w.fecha, s }; } return null; };
  const exs = c.ejercicios || [];
  shell(a.titulo, `
  ${a.hecho ? `<div class="banner" style="background:var(--ok-soft);border-color:var(--ok)">Ya registraste este entreno. Si lo guardas otra vez se añade como un registro nuevo.</div>` : ""}
  ${c.calentamiento ? `<div class="card"><h2>Calentamiento</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.calentamiento)}</p></div>` : ""}
  ${c.notas ? `<div class="card"><h2>Notas</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.notas)}</p></div>` : ""}
  ${c.detalle ? `<div class="card"><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.detalle)}</p></div>` : ""}
  <form id="f-workout" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:12px">
  ${exs.map((e, ei) => { const n = seriesOf(e.sxr); const prev = lastSets(e.nombre);
    const prevKg = prev ? Math.max(...prev.s.map(x => num(x.kg)).filter(x => x != null), -Infinity) : null; const pk = prevKg != null && isFinite(prevKg) ? prevKg : null;
    const pg = progTxt(e.prog, pk);
    return `<div class="ex"><div>${e.bloque ? `<span class="chip">${esc(e.bloque)}</span> ` : ""}<h3 style="display:inline">${esc(e.nombre)}</h3> <button type="button" class="btn ghost sm hist" data-act="ex-hist" data-n="${esc(e.nombre)}">Historial</button>${pg ? `<div class="prog">🎯 ${esc(pg.t)}</div>` : ""}<div class="target">${esc([e.sxr, e.rir && e.rir !== "—" ? "RIR " + e.rir : "", e.descanso && e.descanso !== "—" ? "descanso " + e.descanso : ""].filter(Boolean).join(" · "))}</div>${e.notas ? `<div class="tiny muted" style="margin-top:4px">${esc(e.notas)}</div>` : ""}${e.video ? `<a class="tiny" href="${esc(e.video)}" target="_blank" rel="noopener">▶ Ver vídeo</a>` : ""}</div>
    ${n ? `<div class="seth"><span>#</span><span>Kg</span><span>Reps</span><span>Te quedaban</span></div><div class="sets">${Array.from({ length: n }, (_, si) => { const k = `${ei}-${si}`; const dv = draft[k] || {}; const pv = prev && prev.s[si]; return `<div class="set"><span class="n">${si + 1}</span><input inputmode="decimal" aria-label="Kilos serie ${si + 1}" data-k="${k}" data-f="kg" value="${esc(dv.kg ?? "")}" placeholder="${esc(pg && pg.kg != null ? pg.kg : pv && pv.kg != null ? pv.kg : "kg")}"><input inputmode="numeric" aria-label="Repeticiones serie ${si + 1}" data-k="${k}" data-f="reps" value="${esc(dv.reps ?? "")}" placeholder="${esc(pv && pv.reps != null ? pv.reps : "reps")}"><input inputmode="numeric" aria-label="Repeticiones que te quedaban serie ${si + 1}" data-k="${k}" data-f="rir" value="${esc(dv.rir ?? "")}" placeholder="${esc(pv && pv.rir != null ? pv.rir : "RIR")}"></div>`; }).join("")}</div>${prev ? `<div class="prev">La última vez (${esc(fdate(prev.fecha))}): ${prev.s.map(x => `${x.kg ?? "?"}×${x.reps ?? "?"}`).join(" · ")}</div>` : ""}`
      : `<label class="small" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-k="${ei}-done" data-f="hecho" ${draft[`${ei}-done`] && draft[`${ei}-done`].hecho ? "checked" : ""} style="width:22px;height:22px"> Hecho</label>`}</div>`; }).join("")}
  <div class="card"><h2>Al terminar</h2>
    <div class="grid2"><div class="f"><label for="rpe">Dureza de la sesión (1–10)</label><select id="rpe" name="rpe"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${draft.rpe == n ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="f"><label for="dur">Minutos</label><input id="dur" name="dur" inputmode="numeric" value="${esc(draft.dur || "")}"></div></div>
    <div class="f" style="margin-top:10px"><label for="com">¿Algo que contar? (sensaciones, molestias, cambios)</label><textarea id="com" name="com" maxlength="2000">${esc(draft.com || "")}</textarea></div>
    <p class="tiny muted">«Te quedaban» = cuántas repeticiones más podrías haber hecho con buena técnica. Si no lo tienes claro, pon tu mejor estimación.</p>
    <button class="btn pri block">Terminar y guardar</button>
  </div></form>`, { back: "entreno", noTabs: true, sub: [TIPOS[a.tipo], fdate(a.fecha, { weekday: "long", day: "numeric", month: "long" })].join(" · ") });
}
async function openHist(nombre) {
  let qy = sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(200);
  if (S.me.role === "coach") qy = qy.eq("client_id", S.coach.cid);
  const wo = await q(qy);
  const ses = wo.map(w => ({ fecha: w.fecha, s: (w.sets || []).filter(x => x.ejercicio === nombre && !x.hecho) })).filter(x => x.s.length);
  const best = ses.flatMap(x => x.s.map(y => ({ ...y, fecha: x.fecha, e: e1rm(y.kg, y.reps, y.rir) }))).filter(y => y.e).sort((a, b) => b.e - a.e)[0];
  const top = ses.flatMap(x => x.s.map(y => ({ ...y, fecha: x.fecha }))).filter(y => num(y.kg) != null).sort((a, b) => b.kg - a.kg)[0];
  sheet(`<h2>${esc(nombre)}</h2>${ses.length ? `<div class="kpis"><div class="kpi"><span>Última vez</span><b>${esc(fdate(ses[0].fecha))}</b><em>${ses[0].s.map(x => `${x.kg ?? "?"}×${x.reps ?? "?"}`).join(" · ")}</em></div><div class="kpi"><span>Mayor carga</span><b>${top ? fmt(top.kg) + " kg" : "—"}</b><em>${top ? `${top.reps ?? "?"} reps · ${esc(fdate(top.fecha))}` : ""}</em></div><div class="kpi"><span>Mejor 1RM estimado</span><b>${best ? fmt(best.e) + " kg" : "—"}</b><em>${best ? `${best.kg}×${best.reps}${best.rir != null ? " @" + best.rir : ""}` : ""}</em></div></div>
  ${lineChart(ses.map(x => ({ x: x.fecha, y: Math.max(...x.s.map(y => e1rm(y.kg, y.reps, y.rir) || 0)) || null, tip: x.s.map(y => `${y.kg ?? "?"}×${y.reps ?? "?"}`).join(" ") })), { label: "1RM estimado", unit: "kg", empty: "Hace falta registrar al menos dos días para ver la evolución" })}
  <div class="tbl"><table><thead><tr><th>Fecha</th><th>Series (kg × reps @ RIR)</th></tr></thead><tbody>${ses.slice(0, 20).map(x => `<tr><td>${esc(fdate(x.fecha, { day: "numeric", month: "short" }))}</td><td>${x.s.map(y => `${y.kg ?? "?"}×${y.reps ?? "?"}${y.rir != null ? " @" + y.rir : ""}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted">Aún no hay registros de este ejercicio.</p>`}<button class="btn" data-act="close">Cerrar</button>`);
}
function saveDraftFrom(el) {
  const f = el.closest("#f-workout"); if (!f) return; const id = f.dataset.id; let d = {}; try { d = JSON.parse(localStorage.getItem(draftKey(id)) || "{}"); } catch { }
  if (el.dataset.k) { const o = d[el.dataset.k] || {}; o[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; d[el.dataset.k] = o; } else if (["rpe", "dur", "com"].includes(el.name)) d[el.name] = el.value;
  try { localStorage.setItem(draftKey(id), JSON.stringify(d)); } catch { }
}
async function saveWorkout(f) {
  const id = f.dataset.id; const a = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; if (!a) return;
  const sets = [];
  ((a.contenido || {}).ejercicios || []).forEach((e, ei) => {
    const n = seriesOf(e.sxr);
    if (!n) { const c = f.querySelector(`[data-k="${ei}-done"]`); if (c && c.checked) sets.push({ ejercicio: e.nombre, serie: 1, hecho: true }); return; }
    for (let si = 0; si < n; si++) { const g = fld => { const el = f.querySelector(`[data-k="${ei}-${si}"][data-f="${fld}"]`); return el ? num(el.value) : null; }; const kg = g("kg"), reps = g("reps"), rir = g("rir"); if (kg != null || reps != null) sets.push({ ejercicio: e.nombre, serie: si + 1, kg, reps, rir }); }
  });
  if (!sets.length && a.tipo === "workout" && ((a.contenido || {}).ejercicios || []).length) { toast("Apunta al menos una serie"); return; }
  const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    await q(sb.from("workouts").insert({ client_id: S.me.cid, fecha: today(), dia: a.titulo, sets, rpe_sesion: num(f.rpe.value), duracion_min: num(f.dur.value), comentario: f.com.value.trim(), assignment_id: id }));
    await q(sb.rpc("completar_asignacion", { p_id: id, p_hecho: true, p_respuesta: f.com.value.trim() }));
    try { localStorage.removeItem(draftKey(id)); } catch { } toast("¡Entreno guardado!"); location.hash = "hoy";
  } catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ================= Cliente: Nutrición ================= */

function openWellness(prev) {
  const w = prev || {}; S.sub.well = { ...w };
  sheet(`<h2>¿Cómo estás hoy?</h2><p class="small muted" style="margin:0">Toca un número del 1 al 5. El 5 siempre es lo mejor.</p>
  <form id="f-well" class="col" style="display:flex;flex-direction:column;gap:14px">
  ${WK.map(([k, l, a, b]) => `<div><div class="small" style="font-weight:700;margin-bottom:6px">${l}</div><div class="scale" role="group" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="scale" data-k="${k}" data-v="${n}" aria-pressed="${num(w[k]) === n}">${n}</button>`).join("")}</div><div class="anchors"><span>${a}</span><span>${b}</span></div></div>`).join("")}
  <div class="grid2"><div class="f"><label for="w-h">Horas dormidas</label><input id="w-h" name="sueno_h" inputmode="decimal" value="${esc(w.sueno_h ?? "")}" placeholder="7,5"></div><div class="f"><label for="w-fc">Pulso en reposo (opcional)</label><input id="w-fc" name="fc" inputmode="numeric" value="${esc(w.fc ?? "")}"></div></div>
  <div class="grid2"><div class="f"><label for="w-hrv">HRV / VFC en ms (si tienes reloj)</label><input id="w-hrv" name="hrv" inputmode="numeric" value="${esc(w.hrv ?? "")}"></div><div class="f"><label for="w-ap">Apetito</label><select id="w-ap" name="apetito"><option value="">—</option>${[[1, "1 · Sin ganas de comer"], [2, "2 · Poco apetito"], [3, "3 · Normal"], [4, "4 · Más hambre de lo normal"], [5, "5 · Hambre voraz"]].map(([v, l]) => `<option value="${v}" ${num(w.apetito) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
  <div class="grid2"><div class="f"><label for="w-mz">¿Alguna molestia? Zona</label><input id="w-mz" name="molestia_zona" value="${esc(w.molestia_zona || "")}" placeholder="Rodilla derecha"></div><div class="f"><label for="w-mi">Dolor 0–10</label><input id="w-mi" name="molestia_0a10" inputmode="numeric" value="${esc(w.molestia_0a10 ?? "")}"></div></div>
  <div class="f"><label for="w-c">Comentario (opcional)</label><textarea id="w-c" name="comentario" maxlength="1000">${esc(w.comentario || "")}</textarea></div>
  <button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveWellness(f) {
  const v = S.sub.well || {}; const missing = WK.filter(([k]) => num(v[k]) == null);
  if (missing.length === WK.length) { toast("Marca al menos una respuesta"); return; }
  const row = { client_id: S.me.cid, fecha: today(), comentario: f.comentario.value.trim(), molestia_zona: f.molestia_zona.value.trim(), sueno_h: num(f.sueno_h.value), fc: num(f.fc.value), hrv: num(f.hrv.value), apetito: num(f.apetito.value), molestia_0a10: num(f.molestia_0a10.value) };
  WK.forEach(([k]) => row[k] = num(v[k]));
  try { await q(sb.from("wellness").upsert(row, { onConflict: "client_id,fecha" })); await completarAccion("wellness"); sheet(""); toast("Guardado. ¡Gracias!"); route(); } catch (e) { toast(errMsg(e)); }
}
function openPeso() {
  sheet(`<h2>Peso de hoy</h2><p class="small muted" style="margin:0">Mejor por la mañana, en ayunas y después de ir al baño. Lo que cuenta es la media de la semana, no un día suelto.</p>
  <form id="f-peso" style="display:flex;flex-direction:column;gap:12px"><div class="f"><label for="kg">Kilos</label><input id="kg" name="kg" inputmode="decimal" placeholder="80,5" required></div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
  $("#kg").focus();
}
async function savePeso(f) { const kg = num(f.kg.value); if (kg == null || kg < 25 || kg > 350) { toast("Escribe un peso válido"); return; } try { await q(sb.from("weights").upsert({ client_id: S.me.cid, fecha: today(), kg }, { onConflict: "client_id,fecha" })); await completarAccion("peso"); sheet(""); toast("Peso guardado"); route(); } catch (e) { toast(errMsg(e)); } }

/* ================= Cliente: Progreso ================= */
async function viewProgreso() {
  loading("Progreso"); const plan = await getPlan();
  const vis = Array.isArray(plan.progreso_visible) ? plan.progreso_visible : ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"];
  const segs = [["fuerza", "Fuerza"], ["peso", "Peso"], ["bienestar", "Bienestar"], ["medidas", "Medidas"], ["tests", "Tests"], ["fotos", "Fotos"]].filter(([k]) => vis.includes(k));
  if (!segs.length) { shell("Tu progreso", `<div class="empty">Adrián te enseñará aquí tu progreso.</div>`); return; }
  const tab = segs.some(([k]) => k === S.sub.prog) ? S.sub.prog : segs[0][0];
  let body = "";
  if (tab === "bienestar") {
    const wl = await q(sb.from("wellness").select("*").order("fecha", { ascending: true }).limit(400));
    const byW = {}; wl.forEach(w => { const d = parseD(w.fecha); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = iso(d); (byW[k] = byW[k] || []).push(w); });
    const wk = Object.entries(byW);
    body = `<div class="card"><h2>Bienestar medio semanal <small>1–5</small></h2>${lineChart(wk.map(([x, v]) => ({ x, y: avg(v.map(wellIdx).filter(z => z != null)) })), { label: "Bienestar medio semanal", yMin: 1, yMax: 5, dec: 2, empty: "Rellena el cuestionario diario para ver tu evolución" })}<p class="tiny muted">Media de tus respuestas del cuestionario diario (5 = mejor). Una semana mala suelta es normal; lo importante es la tendencia.</p></div>
    <div class="card"><h2>Horas de sueño <small>media semanal</small></h2>${lineChart(wk.map(([x, v]) => ({ x, y: avg(v.map(z => num(z.sueno_h)).filter(z => z != null)) })), { label: "Horas de sueño", empty: "Apunta las horas que duermes en el cuestionario" })}</div>`;
  } else if (tab === "tests") {
    const ts = await q(sb.from("tests").select("*").order("fecha", { ascending: false, nullsFirst: false }).limit(100));
    body = `<div class="card"><h2>Tests y evaluaciones</h2>${ts.length ? `<div class="tbl"><table><thead><tr><th>Test</th><th>Fecha</th><th class="n">Resultado</th></tr></thead><tbody>${ts.map(x => `<tr><td>${esc(x.nombre)}${x.notas ? `<div class="tiny muted">${esc(x.notas)}</div>` : ""}</td><td>${x.fecha ? esc(fdate(x.fecha)) : "—"}</td><td class="n">${x.valor != null ? fmt(x.valor, 2) + " " + esc(x.unidad) : ""}${x.izq != null || x.der != null ? `I ${fmt(x.izq, 2)} · D ${fmt(x.der, 2)} ${esc(x.unidad)}` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Aquí verás tus tests cuando los hagas.</div>`}</div>`;
  } else if (tab === "peso") {
    const ws = await q(sb.from("weights").select("fecha,kg").order("fecha", { ascending: true }).limit(400));
    const byW = {}; ws.forEach(w => { const d = parseD(w.fecha); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); const k = iso(d); (byW[k] = byW[k] || []).push(+w.kg); });
    const pts = Object.entries(byW).map(([x, v]) => ({ x, y: avg(v) }));
    body = `<div class="card"><h2>Peso medio semanal</h2>${lineChart(pts, { label: "Peso medio semanal", empty: "Apunta tu peso varios días para ver la evolución" })}<p class="tiny muted">Usamos la media de cada semana porque el peso de un día suelto sube y baja por el agua, la sal o la digestión.</p></div>
    <div class="card"><h2>Últimos registros</h2>${ws.length ? `<table><tbody>${ws.slice(-10).reverse().map(w => `<tr><td>${esc(fdate(w.fecha, { weekday: "short", day: "numeric", month: "short" }))}</td><td class="n">${fmt(w.kg)} kg</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Sin registros.</div>`}<button class="btn block" style="margin-top:10px" data-act="peso">Apuntar peso</button></div>`;
  } else if (tab === "fuerza") {
    const wo = await q(sb.from("workouts").select("fecha,sets").order("fecha", { ascending: true }).limit(300));
    const exs = [...new Set(wo.flatMap(w => (w.sets || []).filter(s => s.kg != null).map(s => s.ejercicio)))];
    const sel = exs.includes(S.sub.ex) ? S.sub.ex : exs[0];
    const pts = wo.map(w => { const v = (w.sets || []).filter(s => s.ejercicio === sel).map(s => e1rm(s.kg, s.reps, s.rir)).filter(Boolean); return { x: w.fecha, y: v.length ? Math.max(...v) : null }; });
    body = exs.length ? `<div class="card"><h2>Fuerza estimada</h2><select id="ex-sel" aria-label="Ejercicio">${exs.map(x => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>${lineChart(pts, { label: "Fuerza estimada" })}<p class="tiny muted">Es el peso que podrías levantar una sola vez, calculado a partir de tu mejor serie de cada día (kilos, repeticiones y las que te quedaban). Sirve para comparar días aunque cambien los kilos o las repeticiones.</p></div>` : `<div class="empty">Registra entrenos con kilos para ver tu progreso de fuerza.</div>`;
  } else if (tab === "medidas") {
    const ms = await q(sb.from("measurements").select("*").order("fecha", { ascending: false }).limit(30));
    body = `<div class="card"><h2>Medidas <small>cm</small></h2>${ms.length ? `<div class="tbl"><table><thead><tr><th>Fecha</th><th class="n">Cintura</th><th class="n">Cadera</th><th class="n">Pecho</th><th class="n">Brazo</th><th class="n">Muslo</th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(fdate(m.fecha))}</td>${["cintura", "cadera", "pecho", "brazo", "muslo"].map(k => `<td class="n">${fmt(m[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin medidas todavía.</div>`}<button class="btn pri block" style="margin-top:10px" data-act="medidas">Añadir medidas</button></div>`;
  } else {
    const ph = await q(sb.from("photos").select("*").order("fecha", { ascending: false }).limit(30));
    let urls = {}; if (ph.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ph.map(p => p.path), 600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); }
    body = `<div class="card"><h2>Fotos de progreso</h2><p class="tiny muted" style="margin-top:0">Solo las ves tú y Adrián. Misma luz, misma ropa y misma hora para poder comparar.</p>${ph.length ? `<div class="photos">${ph.map(p => urls[p.path] ? `<figure style="margin:0"><img src="${esc(urls[p.path])}" alt="Foto de ${esc(p.vista)} del ${esc(fdate(p.fecha))}" loading="lazy"><figcaption class="tiny muted">${esc(fdate(p.fecha))} · ${esc(p.vista)}</figcaption></figure>` : "").join("")}</div>` : `<div class="empty">Aún no has subido fotos.</div>`}<button class="btn pri block" style="margin-top:10px" data-act="fotos">Subir fotos</button></div>`;
  }
  shell("Tu progreso", `<div class="seg" role="group" aria-label="Apartado">${segs.map(([k, l]) => `<button data-act="prog" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body}`);
}
function openMedidas() {
  sheet(`<h2>Medidas</h2><p class="small muted" style="margin:0">Por la mañana, en ayunas, con cinta métrica y sin apretar. Rellena solo las que te pida Adrián.</p>
  <form id="f-med" style="display:flex;flex-direction:column;gap:10px"><div class="grid2">${[["cintura", "Cintura (a la altura del ombligo)"], ["cadera", "Cadera (parte más ancha)"], ["pecho", "Pecho"], ["brazo", "Brazo contraído"], ["muslo", "Muslo (parte más ancha)"]].map(([k, l]) => `<div class="f"><label for="m-${k}">${l}</label><input id="m-${k}" name="${k}" inputmode="decimal"></div>`).join("")}</div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveMedidas(f) { const row = { client_id: S.me.cid, fecha: today() }; let any = false; ["cintura", "cadera", "pecho", "brazo", "muslo"].forEach(k => { const v = num(f[k].value); row[k] = v; if (v != null) any = true; }); if (!any) { toast("Escribe al menos una medida"); return; } try { await q(sb.from("measurements").insert(row)); await completarAccion("medidas"); sheet(""); toast("Medidas guardadas"); route(); } catch (e) { toast(errMsg(e)); } }
function openFotos() {
  sheet(`<h2>Subir fotos</h2><p class="small muted" style="margin:0">Las fotos se reducen y se les quita la ubicación y los datos de la cámara antes de subirlas.</p>
  <form id="f-fotos" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="ph-v">Vista</label><select id="ph-v" name="vista"><option value="frente">De frente</option><option value="perfil">De perfil</option><option value="espalda">De espaldas</option><option value="otra">Otra</option></select></div><div class="f"><label for="ph-f">Foto</label><input id="ph-f" name="foto" type="file" accept="image/*" required></div><button class="btn pri block">Subir</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function shrink(file) { // re-codifica a JPEG: elimina EXIF/GPS
  const url = URL.createObjectURL(file); try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}
async function saveFotos(f) {
  const file = f.foto.files[0]; if (!file) return; const b = f.querySelector("button.pri"); b.disabled = true; b.textContent = "Subiendo…";
  try { const blob = await shrink(file); const path = `${S.me.cid}/${today()}-${f.vista.value}-${uid()}.jpg`;
    const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg", upsert: false }); if (error) throw error;
    await q(sb.from("photos").insert({ client_id: S.me.cid, fecha: today(), vista: f.vista.value, path })); await completarAccion("fotos"); sheet(""); toast("Foto subida"); route();
  } catch (e) { toast(errMsg(e)); b.disabled = false; b.textContent = "Subir"; }
}

/* ================= Cliente: Informes ================= */
async function viewInformes() {
  loading("Informes"); const rp = await q(sb.from("reports").select("id,fecha,semana,titular").order("fecha", { ascending: false }).limit(52));
  shell("Tus informes", rp.length ? `<div class="card"><div class="list">${rp.map(r => `<button class="it" data-act="go" data-h="informe-${esc(encodeURIComponent(r.id))}"><span><b>${esc(r.titular || "Informe semanal")}</b><br><span class="tiny muted">${esc(fdate(r.fecha, { day: "numeric", month: "long" }))}${r.semana ? " · " + esc(r.semana) : ""}</span></span><span aria-hidden="true">›</span></button>`).join("")}</div></div>` : `<div class="empty">Aquí aparecerán los informes semanales que te envíe Adrián.</div>`);
}
function reportHTML(r) {
  const box = (cls, title, items) => { const it = (items || []).map(splitItem).filter(i => i.t); return it.length ? `<div class="box ${cls}"><h3>${title}</h3><ul>${it.map(i => `<li><b>${esc(i.t)}</b>${i.p ? `<span>${esc(i.p)}</span>` : ""}</li>`).join("")}</ul></div>` : ""; };
  const k = r.kpis || {}; const foco = (r.foco || []).map(splitItem).filter(i => i.t);
  return `<div class="card"><h2 style="font-size:20px">${esc(r.titular || "Tu semana")}</h2>
  ${Object.keys(k).length ? `<div class="kpis">${Object.entries(k).filter(([key]) => r.mostrar_peso || !/peso/i.test(key)).map(([key, val]) => `<div class="kpi"><span>${esc(key)}</span><b>${esc(val && val.valor != null ? val.valor : val)}</b>${val && val.nota ? `<em>${esc(val.nota)}</em>` : ""}</div>`).join("")}</div>` : ""}</div>
  ${box("ok", "Lo que has hecho bien", r.logros)}${box("acc", "A mejorar", r.mejorar)}${box("dark", "A tener en cuenta", r.tener_en_cuenta)}
  ${foco.length ? `<div class="card"><h2>Tu foco para la semana que viene</h2><ol class="steps">${foco.map(i => `<li><div><b>${esc(i.t)}</b>${i.p ? `<span>${esc(i.p)}</span>` : ""}</div></li>`).join("")}</ol></div>` : ""}
  ${r.mensaje ? `<div class="card"><h2>Mensaje de Adrián</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(r.mensaje)}</p></div>` : ""}
  <p class="tiny muted" style="text-align:center">¿Quieres saber más sobre algún punto? Pregúntale a Adrián.</p>`;
}
async function viewInforme(id) {
  loading("Informe"); const rows = await q(sb.from("reports").select("*").eq("id", id).limit(1)); const r = rows[0];
  if (!r) { shell("Informe", `<div class="empty">Este informe no está disponible.</div>`, { back: "informes" }); return; }
  shell("Tu semana", reportHTML(r), { back: "informes", sub: `${fdate(r.fecha, { day: "numeric", month: "long" })}${r.semana ? " · " + r.semana : ""}` });
}

/* ================= Perfil ================= */
async function viewMas() {
  const wa = (CFG.whatsappEntrenador || "").replace(/\D/g, "");
  const coach = S.me.role === "coach"; const plan = coach ? null : await getPlan();
  shell("Perfil", `<div class="card"><h2>${esc(S.me.nombre || "")}</h2><p class="small muted" style="margin:0">${esc(S.email)}${coach ? " · entrenador" : ""}</p></div>
  ${plan && plan.objetivo ? `<div class="card"><h2>Tu objetivo</h2><p class="small" style="margin:0">${esc(plan.objetivo)}</p></div>` : ""}
  ${coach ? "" : `<div class="card"><div class="list"><button class="it" data-act="go" data-h="informes"><span><b>Mis informes</b><br><span class="tiny muted">Los resúmenes semanales de Adrián</span></span><span aria-hidden="true">›</span></button><button class="it" data-act="go" data-h="tareas"><span><b>Mis tareas</b><br><span class="tiny muted">Lo que te ha pedido Adrián</span></span><span aria-hidden="true">›</span></button></div></div>`}
  ${!coach && wa ? `<a class="btn block" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir a Adrián por WhatsApp</a>` : ""}
  <div class="card"><h2>Instalar la app</h2><p class="small" style="margin:0"><b>iPhone:</b> en Safari, botón Compartir → «Añadir a pantalla de inicio».<br><b>Android:</b> en Chrome, menú ⋮ → «Instalar aplicación».</p></div>
  <div class="card"><h2>Tus datos</h2><p class="small" style="margin:0">Tus registros, fotos e informes solo los ves tú y tu entrenador. Usa una contraseña que no uses en otras webs. Si pierdes el móvil, cambia la contraseña desde otro dispositivo o avisa a Adrián.</p></div>
  <button class="btn block" data-act="cambiar-pw">Cambiar contraseña</button>
  <button class="btn block" data-act="logout">Cerrar sesión</button>`, coach ? {} : { back: "hoy" });
}
function openCambiarPw() {
  sheet(`<h2>Cambiar contraseña</h2><form id="f-nueva" style="display:flex;flex-direction:column;gap:10px">${pwField("pw", "Nueva contraseña (mínimo 8 caracteres)", "new-password")}${pwField("pw2", "Repítela", "new-password")}<button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}

/* ================= Entrenador: utilidades ================= */
async function exLib(force) { if (!S.lib.ex || force) S.lib.ex = await q(sb.from("exercises").select("*").order("nombre")); return S.lib.ex; }
async function tplLib() { return await q(sb.from("workout_templates").select("id,nombre,tipo,descripcion,contenido,updated_at").order("nombre")); }
function exDatalist() { return `<datalist id="dl-ex">${(S.lib.ex || []).map(e => `<option value="${esc(e.nombre)}">`).join("")}</datalist>`; }
const relTime = ts => { const d = new Date(ts); const mins = Math.round((Date.now() - d) / 6e4); if (mins < 60) return `hace ${Math.max(1, mins)} min`; const h = Math.round(mins / 60); if (h < 24) return `hace ${h} h`; return fdate(iso(d), { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); };
const clientName = id => ((S.coach.list.find(c => c.id === id) || {}).nombre || id);
async function loadClients() { S.coach.list = await q(sb.from("clients").select("id,nombre,email,estado,user_id").order("nombre")); return S.coach.list; }

/* ---- Editor de workout (librería, asignaciones y programas) ---- */
const PROG = [["", "Carga: sin indicar"], ["=", "Mantener carga"], ["+1.25", "Subir 1,25 kg"], ["+2.5", "Subir 2,5 kg"], ["+5", "Subir 5 kg"], ["+10", "Subir 10 kg"], ["-2.5", "Bajar 2,5 kg"], ["-5", "Bajar 5 kg"], ["-10%", "Bajar 10 %"], ["libre", "Elige tú (por RIR)"]];
function progTxt(prog, prevKg) {
  if (!prog) return null;
  if (prog === "libre") return { t: "Elige la carga para llegar al RIR indicado", kg: null };
  if (prog === "=") return { t: prevKg != null ? `Mantén ${fmt(prevKg)} kg` : "Mantén la carga de la última vez", kg: prevKg };
  if (prog.endsWith("%")) { const pc = parseFloat(prog); const kg = prevKg != null ? Math.round(prevKg * (1 + pc / 100) / 1.25) * 1.25 : null; return { t: kg != null ? `Baja un ${Math.abs(pc)} %: ${fmt(kg)} kg` : `Baja un ${Math.abs(pc)} % respecto a la última vez`, kg }; }
  const d = parseFloat(prog); const kg = prevKg != null ? prevKg + d : null;
  return { t: kg != null ? `${d > 0 ? "Sube" : "Baja"} ${fmt(Math.abs(d))} kg: ${fmt(kg)} kg` : `${d > 0 ? "Sube" : "Baja"} ${fmt(Math.abs(d))} kg respecto a la última vez`, kg };
}
function wRow(e = {}) {
  return `<div class="wrow" data-row><input name="r_b" value="${esc(e.bloque || "")}" placeholder="A1" aria-label="Bloque" class="rb"><input name="r_n" list="dl-ex" value="${esc(e.nombre || "")}" placeholder="Ejercicio" aria-label="Ejercicio" class="rn"><input name="r_sxr" value="${esc(e.sxr || "")}" placeholder="3×8–10" aria-label="Series × reps"><input name="r_rir" value="${esc(e.rir || "")}" placeholder="RIR" aria-label="RIR o RPE"><input name="r_des" value="${esc(e.descanso || "")}" placeholder="Descanso" aria-label="Descanso"><select name="r_prog" class="rprog" aria-label="Progresión de carga">${PROG.map(([v, l]) => `<option value="${v}" ${(e.prog || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select><input name="r_not" value="${esc(e.notas || "")}" placeholder="Notas técnicas" aria-label="Notas técnicas" class="rnot"><span class="ra"><button type="button" class="btn ghost sm" data-act="w-up" aria-label="Subir">↑</button><button type="button" class="btn ghost sm" data-act="w-down" aria-label="Bajar">↓</button><button type="button" class="btn ghost sm" data-act="w-del" aria-label="Quitar">✕</button></span></div>`;
}
function wEditor(c = {}, tipo = "workout") {
  if (tipo === "cardio") return `<div class="wed"><div class="f"><label>Descripción del cardio</label><textarea name="w_det" placeholder="45–60 min en zona 2 (120–140 ppm)">${esc(c.detalle || "")}</textarea></div></div>`;
  return `<div class="wed"><div class="f"><label>Calentamiento</label><textarea name="w_cal" style="min-height:60px">${esc(c.calentamiento || "")}</textarea></div>
  <div class="whead tiny muted"><span>Bloque</span><span>Ejercicio</span><span>Series×reps</span><span>RIR/RPE</span><span>Descanso</span></div>
  <div class="wrows">${((c.ejercicios && c.ejercicios.length) ? c.ejercicios : [{}]).map(wRow).join("")}</div>
  <button type="button" class="btn sm" data-act="w-add">+ Ejercicio</button>
  <div class="f"><label>Notas del workout</label><textarea name="w_not" style="min-height:60px">${esc(c.notas || "")}</textarea></div></div>`;
}
function readWEditor(root, tipo) {
  if (tipo === "cardio") return { detalle: (root.querySelector('[name="w_det"]') || {}).value || "" };
  const vid = n => { const e = (S.lib.ex || []).find(x => x.nombre.toLowerCase() === n.toLowerCase()); return e && e.video_url ? e.video_url : ""; };
  const ejercicios = [...root.querySelectorAll("[data-row]")].map(r => { const g = n => r.querySelector(`[name="${n}"]`).value.trim(); const nombre = g("r_n"); return { bloque: g("r_b"), nombre, sxr: g("r_sxr"), rir: g("r_rir"), descanso: g("r_des"), notas: g("r_not"), prog: (r.querySelector('[name="r_prog"]') || {}).value || "", video: vid(nombre) }; }).filter(e => e.nombre);
  return { calentamiento: root.querySelector('[name="w_cal"]').value.trim(), notas: root.querySelector('[name="w_not"]').value.trim(), ejercicios };
}
async function newExercisesFrom(c) { // añade a la librería los ejercicios escritos a mano
  const known = new Set((S.lib.ex || []).map(e => e.nombre.toLowerCase()));
  const nuevos = [...new Set((c.ejercicios || []).map(e => e.nombre).filter(n => n && !known.has(n.toLowerCase()) && !/^finisher/i.test(n)))];
  if (nuevos.length) { try { await q(sb.from("exercises").upsert(nuevos.map(nombre => ({ nombre })), { onConflict: "nombre", ignoreDuplicates: true })); await exLib(true); } catch { } }
}

/* ================= Entrenador: Inicio ================= */
async function viewInicio() {
  loading("Inicio"); const t = today(); const since = addDays(t, -7); const sinceTs = new Date(Date.now() - 7 * 864e5).toISOString();
  const [cl, wo, wl, ws, as, asAll, ev] = await Promise.all([loadClients(), q(sb.from("workouts").select("client_id,dia,created_at").gte("created_at", sinceTs)), q(sb.from("wellness").select("client_id,created_at").gte("created_at", sinceTs)), q(sb.from("weights").select("client_id,kg,created_at").gte("created_at", sinceTs)), q(sb.from("assignments").select("client_id,titulo,tipo,hecho_en").eq("hecho", true).neq("tipo", "workout").gte("hecho_en", sinceTs)), q(sb.from("assignments").select("client_id,fecha,hecho,visible").gte("fecha", t.slice(0, 7) + "-01").lte("fecha", addDays(t, 120))), q(sb.from("events").select("*").gte("fecha", t).lte("fecha", addDays(t, 45)).order("fecha"))]);
  const act = [...wo.map(x => ({ c: x.client_id, ts: x.created_at, t: x.dia || "Entreno", k: "Workout" })), ...wl.map(x => ({ c: x.client_id, ts: x.created_at, t: "Cuestionario diario", k: "Formulario" })), ...ws.map(x => ({ c: x.client_id, ts: x.created_at, t: `Peso: ${fmt(x.kg)} kg`, k: "Evolución" })), ...as.map(x => ({ c: x.client_id, ts: x.hecho_en, t: x.titulo, k: TIPOS[x.tipo] }))].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 30);
  const activos = cl.filter(c => c.estado === "activo");
  const agenda = activos.map(c => { const f = asAll.filter(x => x.client_id === c.id).map(x => x.fecha).sort().pop(); const d = f ? daysBetween(t, f) : null; return { c, d }; }).sort((a, b) => (a.d ?? -999) - (b.d ?? -999));
  const mon = monday(t), m1 = t.slice(0, 7) + "-01";
  const pct = (cid, from) => { const r = asAll.filter(x => x.client_id === cid && x.visible && x.fecha >= from && x.fecha <= t); return r.length ? Math.round(100 * r.filter(x => x.hecho).length / r.length) : null; };
  shell("Inicio", `<div class="quick"><button class="qa" data-act="new-client">${ICON.clientes}<span>Añade un cliente</span></button><button class="qa" data-act="go" data-h="lib-w-new">${ICON.entreno}<span>Crea un workout</span></button><button class="qa" data-act="go" data-h="lib-p-new">${ICON.plan}<span>Crea un programa</span></button><button class="qa" data-act="go" data-h="lib">${ICON.lib}<span>Librería</span></button></div>
  <div class="cols">
  <div class="card"><h2 class="hh">${ICON.evo}Actividad reciente <span class="cnt">${act.length}</span></h2>${act.length ? `<div class="list">${act.map(a => `<button class="it feed" data-act="go" data-h="c-${esc(encodeURIComponent(a.c))}">${avatar(clientName(a.c))}<span class="grow"><span class="lnk">${esc(clientName(a.c).toUpperCase())}</span> completó <span class="lnk">${esc(a.t)}</span><br><span class="tag tag-${esc(slug(a.k))}">${esc(a.k)}</span> <span class="tiny muted">${esc(relTime(a.ts))}</span></span></button>`).join("")}</div>` : `<div class="empty">Sin actividad esta semana.</div>`}</div>
  <div style="display:flex;flex-direction:column;gap:12px">
  <div class="card"><h2 class="hh">${ICON.plan}Agendar tareas <span class="cnt">${agenda.length}</span></h2>${agenda.length ? `<div class="list">${agenda.map(({ c, d }) => `<button class="it feed" data-act="go-plan" data-cid="${esc(c.id)}">${avatar(c.nombre)}<span class="grow"><span class="lnk">${esc(c.nombre)}</span><br><span class="tiny ${d == null || d < 3 ? "" : "muted"}" style="${d == null || d < 3 ? "color:var(--bad)" : ""}">${d == null ? "No tiene nada programado" : d < 0 ? `Lleva sin tareas desde hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "Se queda sin tareas hoy" : `Se queda sin tareas en ${d} día${d === 1 ? "" : "s"}`}</span></span><span class="chip acc">Planificar</span></button>`).join("")}</div>` : `<div class="empty">Sin clientes activos.</div>`}</div>
  <div class="card"><h2 class="hh">${ICON.progreso}Revisar cumplimiento <span class="cnt">${activos.length}</span></h2><table><tbody>${activos.map(c => { const s = pct(c.id, mon), mm = pct(c.id, m1); const cl2 = v => v == null ? "" : v >= 80 ? "ok" : v >= 50 ? "warn" : "bad"; return `<tr data-act="go" data-h="c-${esc(encodeURIComponent(c.id))}" style="cursor:pointer"><td><span class="feedn">${avatar(c.nombre, "sm")}<span class="lnk">${esc(c.nombre)}</span></span></td><td class="n"><span class="chip ${cl2(s)}">S. ${s == null ? "—" : s + " %"}</span></td><td class="n"><span class="chip ${cl2(mm)}">M. ${mm == null ? "—" : mm + " %"}</span></td></tr>`; }).join("")}</tbody></table><p class="tiny muted" style="margin:8px 0 0">Tareas completadas de las programadas hasta hoy.</p></div>
  <div class="card"><h2 class="hh">${ICON.cal}Próximos eventos <span class="cnt">${ev.length}</span></h2>${ev.length ? ev.map(e => `<p class="small" style="margin:6px 0"><b>${esc(fdate(e.fecha, { day: "numeric", month: "short" }))}</b> · ${esc(clientName(e.client_id))} · ${esc(e.titulo)}</p>`).join("") : `<p class="small muted" style="margin:0">Nada en las próximas semanas.</p>`}</div>
  </div></div>`);
}

/* ================= Entrenador: Clientes ================= */
async function viewCoachList() {
  loading("Clientes"); const since = addDays(today(), -7);
  const [cl, wl, wo, as] = await Promise.all([loadClients(), q(sb.from("wellness").select("client_id,fecha,sueno,fatiga,dolor,estres,animo,motivacion,articular").gte("fecha", since)), q(sb.from("workouts").select("client_id,fecha").gte("fecha", since)), q(sb.from("assignments").select("client_id,fecha").gte("fecha", since))]);
  const row = c => { const w = wl.filter(x => x.client_id === c.id), o = wo.filter(x => x.client_id === c.id); const wi = avg(w.map(wellIdx).filter(x => x != null)); const hasta = as.filter(x => x.client_id === c.id).map(x => x.fecha).sort().pop();
    return `<tr data-act="go" data-h="c-${esc(encodeURIComponent(c.id))}" style="cursor:pointer"><td><span class="feedn">${avatar(c.nombre)}<span><span class="lnk">${esc(c.nombre)}</span><div class="tiny muted">${c.user_id ? "Usa la app" : "Sin cuenta todavía"}</div></span></span></td><td class="n">${o.length}</td><td class="n">${w.length}/7</td><td class="n">${wi != null ? fmt(wi, 2) : "—"}</td><td>${hasta ? esc(fdate(hasta)) : `<span class="chip bad">Nada</span>`}</td><td>${c.estado !== "activo" ? `<span class="chip">${esc(c.estado)}</span>` : ""}</td></tr>`; };
  shell("Clientes", `<div class="pghead"><h1 class="ptitle">Mis clientes <sup>${cl.length}</sup></h1><span class="grow"></span><button class="btn dark" data-act="new-client"><span class="plus">+</span>Añadir cliente</button></div><p class="small muted" style="margin:0">Datos de los últimos 7 días</p>
  <div class="card"><div class="tbl"><table><thead><tr><th>Cliente</th><th class="n">Entrenos</th><th class="n">Cuestionarios</th><th class="n">Bienestar</th><th>Planificado hasta</th><th></th></tr></thead><tbody>${cl.map(row).join("") || `<tr><td colspan="6" class="muted">Sin clientes todavía.</td></tr>`}</tbody></table></div></div>`);
}
function openNewClient() {
  sheet(`<h2>Nuevo cliente</h2><form id="f-newc" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="nc-n">Nombre (como lo verá él)</label><input id="nc-n" name="nombre" required></div><div class="f"><label for="nc-e">Email con el que entrará</label><input id="nc-e" name="email" type="email" required></div><div class="f"><label for="nc-o">Objetivo</label><textarea id="nc-o" name="objetivo"></textarea></div><p class="tiny muted" style="margin:0">Al crearla tendrás su código de alta en la pestaña «Cuenta»: se lo das junto con el enlace de la app para que se registre en «Nuevo atleta».</p><button class="btn pri block">Crear</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveNewClient(f) {
  const nombre = f.nombre.value.trim(), email = f.email.value.trim().toLowerCase(); let id = slug(nombre.split(" ")[0] + "-" + (nombre.split(" ")[1] || "x").slice(0, 1));
  if (!S.coach.list.length) await loadClients();
  if (S.coach.list.some(c => c.id === id)) id += "-" + Math.random().toString(36).slice(2, 5);
  try { await q(sb.from("clients").insert({ id, nombre, email })); await q(sb.from("plans").insert({ client_id: id, objetivo: f.objetivo.value.trim() })); sheet(""); toast("Cliente creado"); S.coach.tab = "cuenta"; location.hash = "c-" + id; }
  catch (e) { toast(errMsg(e)); }
}

/* ================= Entrenador: ficha del cliente ================= */
const CTABS = [["plan", "Planificación", "plan"], ["info", "Información", "info"], ["evo", "Evolución", "evo"], ["nutri", "Nutrición", "nutri"], ["informes", "Informes", "doc"], ["cuenta", "Cuenta", "key"]];
async function viewCoachClient(cid) {
  if (S.coach.cid !== cid) { S.coach.cid = cid; S.coach.calM = null; }
  const tab = S.coach.tab || "plan";
  const c = (await q(sb.from("clients").select("*").eq("id", cid).limit(1)))[0];
  if (!c) { shell("Cliente", `<div class="empty">No existe.</div>`, { back: "c" }); return; }
  const pl = (await q(sb.from("plans").select("*").eq("client_id", cid).limit(1)))[0] || { client_id: cid, bloques: [], habitos: [], objetivo: "", progreso_visible: ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"] };
  S.coach.c = c; S.coach.pl = pl;
  const body = tab === "plan" ? await tabPlan(c, pl) : tab === "info" ? tabInfo(c, pl) : tab === "evo" ? await tabEvo(c, pl) : tab === "nutri" ? await tabNutri(c, pl) : tab === "informes" ? await tabInformes(c) : tabCuenta(c, pl);
  const alertas = ((c.ficha || {}).salud || []).filter(s => String(s).startsWith("!"));
  shell(c.nombre, `<div class="cwrap"><nav class="rail" aria-label="Apartados del cliente">${CTABS.map(([k, l, i]) => `<button data-act="ctab" data-t="${k}" aria-current="${tab === k}" title="${l}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>
  <div class="cmain"><h1 class="ptitle">${esc((CTABS.find(t => t[0] === tab) || CTABS[0])[1])}</h1>${alertas.length ? `<div class="banner"><b>Salud:</b> ${alertas.map(s => esc(String(s).slice(1))).join(" · ")}</div>` : ""}${body}</div></div>`, { crumb: [["c", "Clientes"], ["c", "Mis clientes"], [null, c.nombre, true]], keepScroll: S.coach.keep, sub: c.estado !== "activo" ? cap(c.estado) : "" });
  S.coach.keep = false;
}

/* ---- Planificación ---- */
async function tabPlan(c, pl) {
  const t = today(); const m = S.coach.calM || t.slice(0, 7); S.coach.calM = m;
  const first = m + "-01", last = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
  const g0 = monday(first), g1 = addDays(monday(last), 6);
  const [as, ev, wo] = await Promise.all([q(sb.from("assignments").select("*").eq("client_id", c.id).gte("fecha", g0).lte("fecha", g1).order("orden")), q(sb.from("events").select("*").eq("client_id", c.id).lte("fecha", g1).order("fecha")), q(sb.from("workouts").select("id,fecha,dia,assignment_id").eq("client_id", c.id).gte("fecha", g0).lte("fecha", g1))]);
  S.coach.asig = as;
  const weekLbl = d => { for (const b of pl.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= addDays(d, 6) && d <= s.fin); if (w) return `${b.nombre} · ${w.nombre}${w.tipo && w.tipo !== "carga" ? " · " + w.tipo : ""}`; } return ""; };
  let rows = "";
  for (let d = g0; d <= g1; d = addDays(d, 7)) {
    const lbl = weekLbl(d);
    rows += `<div class="pweek">${lbl ? `<div class="pwl">${esc(lbl)}</div>` : ""}<div class="pgrid">`;
    for (let k = 0; k < 7; k++) {
      const day = addDays(d, k); const items = as.filter(x => x.fecha === day); const evs = ev.filter(e => e.fecha <= day && day <= (e.fin || e.fecha)); const libres = wo.filter(w => w.fecha === day && !w.assignment_id);
      rows += `<div class="pday${day.slice(0, 7) !== m ? " out" : ""}${day === t ? " hoy" : ""}" data-day="${day}"><div class="pdh"><span>${+day.slice(8)}</span><button class="padd" data-act="asig-new" data-d="${day}" aria-label="Añadir el ${esc(fdate(day))}">+</button></div>
      ${evs.map(e => `<button class="pch tp-evento" data-act="ev-edit" data-id="${esc(e.id)}">${esc(e.titulo)}</button>`).join("")}
      ${items.map(x => `<button class="pch tp-${esc(x.tipo)}${x.hecho ? " ok" : !x.hecho && day < t ? " late" : ""}${x.visible ? "" : " hid"}" data-act="asig-edit" data-id="${esc(x.id)}" draggable="true" data-drag="${esc(x.id)}">${x.hecho ? "✓ " : ""}${esc(x.titulo)}</button>`).join("")}
      ${libres.map(w => `<span class="pch tp-workout ok">✓ ${esc(w.dia || "Entreno libre")}</span>`).join("")}</div>`;
    }
    rows += `</div></div>`;
  }
  const mName = cap(parseD(first).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const prevM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7), nextM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
  const tot = as.filter(x => x.fecha >= first && x.fecha <= last && x.fecha <= t && x.visible); const pct = tot.length ? Math.round(100 * tot.filter(x => x.hecho).length / tot.length) : null;
  return `<div class="card"><div class="row"><button class="btn ghost sm" data-act="pm" data-m="${prevM}" aria-label="Mes anterior">‹</button><button class="btn ghost sm" data-act="pm" data-m="${t.slice(0, 7)}">Hoy</button><button class="btn ghost sm" data-act="pm" data-m="${nextM}" aria-label="Mes siguiente">›</button><h2 class="grow" style="margin:0">${esc(mName)}</h2>${pct != null ? `<span class="chip ${pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad"}">Cumplimiento ${pct} %</span>` : ""}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm pri" data-act="asig-new" data-d="${t}">+ Tarea</button><button class="btn sm" data-act="prog-asignar">Asignar programa</button><button class="btn sm" data-act="copiar-semana">Copiar semana</button><button class="btn sm" data-act="borrar-semana">Vaciar semana</button><button class="btn sm" data-act="meso-edit">Mesociclos</button></div>
  <div class="pgrid phead"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>${rows}
  <div class="leg tiny muted">${Object.entries(TIPOS).map(([k, l]) => `<span><i class="sw tp-${k}"></i>${l}</span>`).join("")}<span><i class="sw tp-evento"></i>Evento</span><span>✓ hecho · borde rojo: sin hacer · rayado: oculto al cliente</span></div>
  <p class="tiny muted" style="margin:8px 0 0">Arrastra una tarea a otro día para moverla.</p></div>`;
}
async function openAsig(id, fecha) {
  await exLib(); const tpls = await tplLib();
  const x = id ? (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0] : { tipo: "workout", fecha, titulo: "", contenido: {}, visible: true };
  if (!x) return; S.sub.asigTipo = x.tipo; S.sub.tpls = tpls;
  const logs = id && x.tipo === "workout" ? await q(sb.from("workouts").select("*").eq("assignment_id", id)) : [];
  const res = (x.resultado && x.resultado.respuestas) || [];
  sheet(`<h2>${id ? "Editar" : "Nueva"} tarea · ${esc(fdate(x.fecha, { weekday: "long", day: "numeric", month: "long" }))}</h2>
  <form id="f-asig" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:10px">
  ${!id ? `<div class="seg" role="group" aria-label="Tipo">${[...Object.entries(TIPOS), ["evento", "Evento"]].map(([k, l]) => `<button type="button" data-act="asig-tipo" data-t="${k}" aria-pressed="${x.tipo === k}">${l}</button>`).join("")}</div>` : `<p class="small" style="margin:0">${tipoChip(x.tipo)}${x.hecho ? ` <span class="chip ok">Hecho ${x.hecho_en ? esc(relTime(x.hecho_en)) : ""}</span>` : ""}${x.programa ? ` <span class="chip">${esc(x.programa)}</span>` : ""}</p>`}
  <div id="asig-body">${asigBody(x, tpls)}</div>
  ${logs.length ? `<div class="card"><h2>Lo que registró</h2>${logs.map(w => `<p class="tiny muted" style="margin:0 0 4px">${esc(fdate(w.fecha))}${w.rpe_sesion != null ? " · dureza " + w.rpe_sesion + "/10" : ""}${w.duracion_min ? " · " + w.duracion_min + " min" : ""}</p><table><tbody>${Object.entries((w.sets || []).reduce((a, s) => { (a[s.ejercicio] = a[s.ejercicio] || []).push(s); return a; }, {})).map(([ex, ss]) => `<tr><td>${esc(ex)}</td><td class="n">${ss.map(s => s.hecho ? "hecho" : `${s.kg ?? "?"}×${s.reps ?? "?"}${s.rir != null ? " @" + s.rir : ""}`).join(" · ")}</td></tr>`).join("")}</tbody></table>${w.comentario ? `<p class="small">${esc(w.comentario)}</p>` : ""}`).join("")}</div>` : ""}
  ${res.length || x.respuesta ? `<div class="card"><h2>Respuesta del cliente</h2>${res.map(r => `<p class="small" style="margin:4px 0"><b>${esc(r.p)}</b><br>${esc(r.r || "—")}</p>`).join("")}${x.respuesta ? `<p class="small" style="margin:4px 0"><b>Comentario:</b> ${esc(x.respuesta)}</p>` : ""}</div>` : ""}
  <button class="btn pri block">Guardar</button>
  ${id ? `<div class="row"><input type="date" name="dup_fecha" value="${esc(addDays(x.fecha, 7))}" aria-label="Fecha para duplicar" style="width:auto"><button type="button" class="btn sm" data-act="asig-dup" data-id="${esc(id)}">Duplicar en esa fecha</button><span class="grow"></span><button type="button" class="btn sm ghost" data-act="asig-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button></div>` : ""}
  <button type="button" class="btn ghost" data-act="close">Cerrar</button></form>${exDatalist()}`, "wide");
}
function asigBody(x, tpls) {
  const t = x.tipo; const c = x.contenido || {};
  if (t === "evento") return `<div class="grid2"><div class="f"><label>Título</label><input name="titulo" required value="${esc(x.titulo || "")}" placeholder="Torneo nacional"></div><div class="f"><label>Tipo de evento</label><select name="ev_tipo">${Object.entries(EV_TIPOS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div></div>
  <div class="grid2"><div class="f"><label>Desde</label><input type="date" name="fecha" value="${esc(x.fecha)}" required></div><div class="f"><label>Hasta (opcional)</label><input type="date" name="fin"></div></div>
  <div class="f"><label>Notas</label><textarea name="notas"></textarea></div><label class="small"><input type="checkbox" name="visible" checked> Lo ve el cliente</label>`;
  const opts = tpls.filter(p => (t === "cardio" ? p.tipo === "cardio" : p.tipo === "workout"));
  return `<div class="grid2"><div class="f"><label>Título</label><input name="titulo" required value="${esc(x.titulo || "")}" placeholder="${t === "workout" ? "Pierna A" : t === "cardio" ? "Rodaje Z2" : t === "formulario" ? "Revisión semanal" : t === "nota" ? "Buenos días" : "Pesarte en ayunas"}"></div><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${esc(x.fecha)}" required></div></div>
  ${(t === "workout" || t === "cardio") && opts.length ? `<div class="row"><select id="tpl-sel" aria-label="Cargar de la librería" style="flex:1"><option value="">Cargar de la librería…</option>${opts.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("")}</select><button type="button" class="btn sm" data-act="tpl-load">Cargar</button></div>` : ""}
  ${t === "tarea" ? `<div class="f"><label>Qué tiene que hacer</label><select name="accion">${ACCIONES.map(([k, l]) => `<option value="${k}" ${(c.accion || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><p class="tiny muted" style="margin:0">Si eliges registrar peso, fotos, medidas o el cuestionario, al cliente se le abre directamente esa pantalla y la tarea se marca sola cuando lo hace.</p>` : ""}
  ${t === "nota" ? `<div class="f"><label>Hora a la que le aparece</label><input type="time" name="hora" value="${esc(c.hora || "08:00")}"></div>` : ""}
  ${t === "workout" || t === "cardio" ? wEditor(c, t) : t === "formulario" ? `<div class="f"><label>Preguntas (una por línea)</label><textarea name="preguntas" style="min-height:120px">${esc((c.preguntas || []).join("\n"))}</textarea></div><div class="f"><label>Instrucciones (opcional)</label><textarea name="detalle">${esc(c.detalle || "")}</textarea></div>` : `<div class="f"><label>${t === "nota" ? "Mensaje" : "Detalle"}</label><textarea name="detalle" style="min-height:120px">${esc(c.detalle || "")}</textarea></div>`}
  <label class="small"><input type="checkbox" name="visible" ${x.visible !== false ? "checked" : ""}> Lo ve el cliente</label>
  ${!x.id ? `<div class="grid2"><div class="f"><label>Repetir</label><select name="rep"><option value="">No repetir</option><option value="1">Cada día</option><option value="2">Cada 2 días</option><option value="7">Cada semana</option></select></div><div class="f"><label>Hasta el</label><input type="date" name="rep_hasta"></div></div>` : ""}`;
}
async function saveAsig(f) {
  const id = f.dataset.id; const tipo = S.sub.asigTipo; const cid = S.coach.cid;
  try {
    if (tipo === "evento") {
      await q(sb.from("events").insert({ client_id: cid, titulo: f.titulo.value.trim(), tipo: f.ev_tipo.value, fecha: f.fecha.value, fin: f.fin.value || null, notas: f.notas.value.trim(), visible_cliente: f.visible.checked }));
    } else {
      let contenido;
      if (tipo === "workout" || tipo === "cardio") { contenido = readWEditor(f, tipo); if (tipo === "workout") await newExercisesFrom(contenido); }
      else if (tipo === "formulario") contenido = { preguntas: lines(f.preguntas.value), detalle: f.detalle.value.trim() };
      else contenido = { detalle: f.detalle.value.trim() };
      if (tipo === "tarea" && f.accion) contenido.accion = f.accion.value;
      if (tipo === "nota" && f.hora) contenido.hora = f.hora.value;
      const row = { titulo: f.titulo.value.trim(), fecha: f.fecha.value, contenido, visible: f.visible.checked };
      if (id) await q(sb.from("assignments").update(row).eq("id", id));
      else {
        const paso = f.rep ? +f.rep.value : 0, hasta = f.rep_hasta ? f.rep_hasta.value : "";
        const fechas = [row.fecha]; if (paso && hasta > row.fecha) for (let d = addDays(row.fecha, paso); d <= hasta && fechas.length < 120; d = addDays(d, paso)) fechas.push(d);
        await q(sb.from("assignments").insert(fechas.map(fe => ({ ...row, fecha: fe, client_id: cid, tipo }))));
        if (fechas.length > 1) toast(`${fechas.length} creadas`);
      }
    }
    sheet(""); toast("Guardado"); S.coach.keep = true; S.coach.calM = f.fecha.value.slice(0, 7); viewCoachClient(cid);
  } catch (e) { toast(errMsg(e)); }
}
async function openEvent(id) {
  const e = (await q(sb.from("events").select("*").eq("id", id).limit(1)))[0]; if (!e) return;
  sheet(`<h2>Evento</h2><form id="f-ev" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Título</label><input name="titulo" required value="${esc(e.titulo)}"></div><div class="f"><label>Tipo</label><select name="ev_tipo">${Object.entries(EV_TIPOS).map(([k, l]) => `<option value="${k}" ${e.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
  <div class="grid2"><div class="f"><label>Desde</label><input type="date" name="fecha" value="${esc(e.fecha)}" required></div><div class="f"><label>Hasta</label><input type="date" name="fin" value="${esc(e.fin || "")}"></div></div>
  <div class="f"><label>Notas</label><textarea name="notas">${esc(e.notas || "")}</textarea></div><label class="small"><input type="checkbox" name="visible" ${e.visible_cliente ? "checked" : ""}> Lo ve el cliente</label>
  <button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="ev-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar evento</button><button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveEvent(f) { try { await q(sb.from("events").update({ titulo: f.titulo.value.trim(), tipo: f.ev_tipo.value, fecha: f.fecha.value, fin: f.fin.value || null, notas: f.notas.value.trim(), visible_cliente: f.visible.checked }).eq("id", f.dataset.id)); sheet(""); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } }
async function openAsignarPrograma(programId) {
  const [ps] = await Promise.all([q(sb.from("programs").select("id,nombre,semanas").order("nombre")), S.coach.list.length ? null : loadClients()]);
  if (!ps.length) { toast("Primero crea un programa en la Librería"); return; }
  const nm = monday(addDays(today(), 7));
  sheet(`<h2>Asignar programa</h2><form id="f-asigprog" style="display:flex;flex-direction:column;gap:10px">
  ${S.view.startsWith("lib") ? `<div class="f"><label>Cliente</label><select name="cid">${S.coach.list.filter(c => c.estado !== "baja").map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select></div>` : ""}
  <div class="f"><label>Programa</label><select name="pid">${ps.map(p => `<option value="${esc(p.id)}" ${p.id === programId ? "selected" : ""}>${esc(p.nombre)} · ${p.semanas} semanas</option>`).join("")}</select></div>
  <div class="f"><label>Empieza el lunes</label><input type="date" name="inicio" value="${nm}" required></div>
  <p class="tiny muted" style="margin:0">Se copian todas las tareas del programa al calendario del cliente. Luego puedes cambiar cualquiera sin tocar el programa.</p>
  <button class="btn pri block">Asignar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function asignarPrograma(f) {
  const cid = f.cid ? f.cid.value : S.coach.cid; const inicio = monday(f.inicio.value);
  try {
    const p = (await q(sb.from("programs").select("*").eq("id", f.pid.value).limit(1)))[0]; const tpls = await tplLib();
    const rows = (p.items || []).map((it, i) => { const tp = it.template_id && tpls.find(x => x.id === it.template_id); return { client_id: cid, fecha: addDays(inicio, (it.semana - 1) * 7 + (it.dia - 1)), orden: i, tipo: it.tipo, titulo: it.titulo || (tp && tp.nombre) || TIPOS[it.tipo], contenido: tp ? tp.contenido : (it.contenido || {}), programa: p.nombre }; });
    if (!rows.length) { toast("El programa está vacío"); return; }
    await q(sb.from("assignments").insert(rows)); sheet(""); toast(`${rows.length} tareas asignadas`);
    if (S.view.startsWith("lib")) { S.coach.tab = "plan"; S.coach.cid = null; location.hash = "c-" + cid; S.coach.calM = inicio.slice(0, 7); } else { S.coach.calM = inicio.slice(0, 7); S.coach.keep = true; viewCoachClient(cid); }
  } catch (e) { toast(errMsg(e)); }
}
function openCopiarSemana() {
  const mon = monday(today());
  sheet(`<h2>Copiar semana</h2><form id="f-copsem" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Semana que copias (lunes)</label><input type="date" name="de" value="${mon}" required></div><div class="f"><label>Pegar en la semana del (lunes)</label><input type="date" name="a" value="${addDays(mon, 7)}" required></div></div><div class="f"><label>Número de semanas a pegar</label><input name="n" inputmode="numeric" value="1"></div><p class="tiny muted" style="margin:0">Copia todas las tareas de esa semana (sin el estado de hechas). Útil para repetir una semana de carga.</p><button class="btn pri block">Copiar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function copiarSemana(f) {
  const de = monday(f.de.value), a = monday(f.a.value), n = Math.min(12, Math.max(1, num(f.n.value) || 1)); const cid = S.coach.cid;
  try { const src = await q(sb.from("assignments").select("*").eq("client_id", cid).gte("fecha", de).lte("fecha", addDays(de, 6)));
    if (!src.length) { toast("Esa semana está vacía"); return; }
    const rows = []; for (let k = 0; k < n; k++) src.forEach(x => rows.push({ client_id: cid, fecha: addDays(a, k * 7 + daysBetween(de, x.fecha)), orden: x.orden, tipo: x.tipo, titulo: x.titulo, contenido: x.contenido, visible: x.visible, programa: x.programa }));
    await q(sb.from("assignments").insert(rows)); sheet(""); toast(`${rows.length} tareas copiadas`); S.coach.calM = a.slice(0, 7); S.coach.keep = true; viewCoachClient(cid);
  } catch (e) { toast(errMsg(e)); }
}
function openBorrarSemana() {
  sheet(`<h2>Vaciar semana</h2><form id="f-borsem" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label>Semana (lunes)</label><input type="date" name="de" value="${monday(addDays(today(), 7))}" required></div><p class="tiny muted" style="margin:0">Borra las tareas <b>no hechas</b> de esa semana. Las ya completadas se quedan.</p><button class="btn pri block" style="background:var(--bad);border-color:var(--bad)">Vaciar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function borrarSemana(f) { const de = monday(f.de.value); try { await q(sb.from("assignments").delete().eq("client_id", S.coach.cid).eq("hecho", false).gte("fecha", de).lte("fecha", addDays(de, 6))); sheet(""); toast("Semana vaciada"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } }

/* ---- Mesociclos ---- */
const SEM_TIPOS = ["carga", "descarga", "afinamiento", "competicion", "test", "transicion"];
function mesoWeek(w = {}) { return `<div class="mw" data-w><input name="s_n" value="${esc(w.nombre || "")}" placeholder="S1" aria-label="Semana"><input type="date" name="s_i" value="${esc(w.inicio || "")}" aria-label="Inicio"><input type="date" name="s_f" value="${esc(w.fin || "")}" aria-label="Fin"><select name="s_t" aria-label="Tipo">${SEM_TIPOS.map(t => `<option ${w.tipo === t ? "selected" : ""}>${t}</option>`).join("")}</select><input name="s_fo" value="${esc(w.foco || "")}" placeholder="Foco (lo ve el cliente)" aria-label="Foco" class="mwf"><button type="button" class="btn ghost sm" data-act="mw-del" aria-label="Quitar semana">✕</button></div>`; }
function mesoBlock(b = {}) { return `<div class="mb card" data-b><div class="grid2"><div class="f"><label>Nombre</label><input name="b_n" value="${esc(b.nombre || "")}" placeholder="Mesociclo 2 · Hipertrofia"></div><div class="f"><label>Objetivo</label><input name="b_o" value="${esc(b.objetivo || "")}"></div></div><div class="f"><label>Notas (privadas)</label><input name="b_no" value="${esc(b.notas || "")}"></div><div class="mws">${(b.semanas || []).map(mesoWeek).join("")}</div><div class="row"><button type="button" class="btn sm" data-act="mw-add">+ Semana</button><span class="grow"></span><button type="button" class="btn ghost sm" data-act="mb-del" style="color:var(--bad)">Quitar mesociclo</button></div></div>`; }
function openMeso() {
  sheet(`<h2>Mesociclos</h2><p class="tiny muted" style="margin:0">Las semanas aparecen como etiqueta en el calendario y el cliente ve el foco de la semana en «Hoy».</p><form id="f-meso" style="display:flex;flex-direction:column;gap:12px"><div id="mbs" style="display:flex;flex-direction:column;gap:12px">${(S.coach.pl.bloques || []).map(mesoBlock).join("")}</div><button type="button" class="btn" data-act="mb-add">+ Mesociclo</button><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`, "wide");
}
async function saveMeso(f) {
  const bloques = [...f.querySelectorAll("[data-b]")].map((b, i) => { const g = n => b.querySelector(`[name="${n}"]`).value.trim(); const semanas = [...b.querySelectorAll("[data-w]")].map(w => { const h = n => w.querySelector(`[name="${n}"]`).value.trim(); return { nombre: h("s_n"), inicio: h("s_i"), fin: h("s_f"), tipo: h("s_t"), foco: h("s_fo") }; }).filter(w => w.nombre || w.inicio);
    const old = (S.coach.pl.bloques || [])[i] || {}; return { ...old, nombre: g("b_n"), objetivo: g("b_o"), notas: g("b_no"), inicio: semanas.length ? semanas[0].inicio : old.inicio || "", fin: semanas.length ? semanas[semanas.length - 1].fin : old.fin || "", semanas }; }).filter(b => b.nombre || b.semanas.length);
  try { await q(sb.from("plans").upsert({ client_id: S.coach.cid, bloques }, { onConflict: "client_id" })); sheet(""); toast("Mesociclos guardados"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); }
}

/* ---- Información ---- */
const PERFILES = { hipertrofia: "Hipertrofia / estética", fuerza: "Fuerza / rendimiento", combate: "Deportes de combate", salud: "Salud / principiante / pérdida de grasa" };
function pendRow(p = {}) { return `<div class="row pend" data-p><input type="checkbox" name="p_d" ${p.done ? "checked" : ""} aria-label="Hecho" style="width:22px;height:22px"><input name="p_t" value="${esc(p.t || "")}" class="grow" aria-label="Pendiente"><button type="button" class="btn ghost sm" data-act="row-del" aria-label="Quitar">✕</button></div>`; }
function marcaRow(m = {}) { return `<div class="mrow" data-m><input name="m_e" list="dl-ex" value="${esc(m.ejercicio || "")}" placeholder="Ejercicio" aria-label="Ejercicio"><input type="date" name="m_f" value="${esc(m.fecha || "")}" aria-label="Fecha"><input name="m_c" inputmode="decimal" value="${esc(m.carga ?? "")}" placeholder="kg" aria-label="Carga"><input name="m_r" inputmode="numeric" value="${esc(m.reps ?? "")}" placeholder="reps" aria-label="Repeticiones"><input name="m_i" inputmode="numeric" value="${esc(m.rir ?? "")}" placeholder="RIR" aria-label="RIR"><input name="m_n" value="${esc(m.nota || "")}" placeholder="Nota" aria-label="Nota" class="mrn"><button type="button" class="btn ghost sm" data-act="row-del" aria-label="Quitar">✕</button></div>`; }
function tabInfo(c, pl) {
  const f = c.ficha || {}; const pg = f.pago || {};
  const fld = (n, l, v, o = "") => `<div class="f"><label for="i-${n}">${l}</label><input id="i-${n}" name="${n}" value="${esc(v ?? "")}" ${o}></div>`;
  const ta = (n, l, v, h = 80) => `<div class="f"><label for="i-${n}">${l}</label><textarea id="i-${n}" name="${n}" style="min-height:${h}px">${esc(v ?? "")}</textarea></div>`;
  return `<form id="f-info" class="cols" style="align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px">
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Datos</h2>${fld("nombre", "Nombre", c.nombre, "required")}
   <div class="f"><label for="i-perfil">Perfil</label><select id="i-perfil" name="perfil">${Object.entries(PERFILES).map(([k, l]) => `<option value="${k}" ${f.perfil === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
   <div class="grid2">${fld("fechaInicio", "Cliente desde", f.fechaInicio, 'type="date"')}${fld("telefono", "Teléfono", f.telefono, 'inputmode="tel"')}</div>
   <div class="grid3">${fld("edad", "Edad", f.edad)}${fld("altura", "Altura", f.altura)}${fld("pesoInicial", "Peso inicial (kg)", f.pesoInicial, 'inputmode="decimal"')}</div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Objetivo</h2>${ta("objetivo_cli", "Objetivo que ve el cliente", pl.objetivo)}${ta("objetivo", "Objetivo detallado (privado)", f.objetivo)}${ta("ejerciciosClave", "Ejercicios clave (uno por línea)", (f.ejerciciosClave || []).join("\n"), 60)}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Salud y limitaciones</h2>${ta("salud", "Una por línea. Empieza con «!» las alertas importantes (salen arriba en rojo)", (f.salud || []).join("\n"), 120)}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Pago</h2><div class="grid2">${fld("cuota", "Cuota (€)", pg.cuota, 'inputmode="decimal"')}<div class="f"><label for="i-per">Periodicidad</label><select id="i-per" name="periodicidad">${["mensual", "trimestral", "semestral", "anual", "pago único"].map(p => `<option ${pg.periodicidad === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>${fld("metodo", "Método", pg.metodo)}${fld("proximoCobro", "Próximo cobro", pg.proximoCobro, 'type="date"')}</div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Contexto</h2>${ta("disponibilidad", "Disponibilidad", f.disponibilidad, 60)}${ta("material", "Material", f.material, 60)}${ta("preferencias", "Preferencias", f.preferencias, 60)}${ta("habitos", "Hábitos actuales", f.habitos, 60)}${ta("notas", "Notas privadas (perfil, histórico, comunicación…)", f.notas, 160)}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:8px"><h2>Pendientes</h2><div id="pends" style="display:flex;flex-direction:column;gap:6px">${(f.pendientes || []).map(pendRow).join("")}</div><button type="button" class="btn sm" data-act="pend-add">+ Pendiente</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:8px"><h2>Marcas de referencia</h2><div id="marcas" style="display:flex;flex-direction:column;gap:6px">${(f.marcas || []).map(marcaRow).join("")}</div><button type="button" class="btn sm" data-act="marca-add">+ Marca</button></div>
  </div>
  <div class="savebar"><button class="btn pri">Guardar información</button></div></form>${exDatalist()}`;
}
async function saveInfo(f) {
  const c = S.coach.c; const old = c.ficha || {}; const v = n => f[n].value.trim();
  const ficha = { ...old, perfil: v("perfil"), fechaInicio: v("fechaInicio"), telefono: v("telefono"), edad: v("edad"), altura: v("altura"), pesoInicial: num(v("pesoInicial")), objetivo: v("objetivo"), ejerciciosClave: lines(v("ejerciciosClave")), salud: lines(v("salud")),
    pago: { ...(old.pago || {}), cuota: num(v("cuota")), periodicidad: v("periodicidad"), metodo: v("metodo"), proximoCobro: v("proximoCobro") },
    disponibilidad: v("disponibilidad"), material: v("material"), preferencias: v("preferencias"), habitos: v("habitos"), notas: v("notas"),
    pendientes: [...f.querySelectorAll("[data-p]")].map(r => ({ t: r.querySelector('[name="p_t"]').value.trim(), done: r.querySelector('[name="p_d"]').checked })).filter(p => p.t),
    marcas: [...f.querySelectorAll("[data-m]")].map(r => { const g = n => r.querySelector(`[name="${n}"]`).value.trim(); return { ejercicio: g("m_e"), fecha: g("m_f"), carga: num(g("m_c")), reps: num(g("m_r")), rir: num(g("m_i")), nota: g("m_n") }; }).filter(m => m.ejercicio),
    actualizado: new Date().toISOString() };
  try { await q(sb.from("clients").update({ nombre: v("nombre"), ficha }).eq("id", c.id)); await q(sb.from("plans").upsert({ client_id: c.id, objetivo: v("objetivo_cli") }, { onConflict: "client_id" })); toast("Información guardada"); S.coach.keep = true; viewCoachClient(c.id); } catch (e) { toast(errMsg(e)); }
}

/* ---- Evolución ---- */
const EVO = [["recuperacion", "Recuperación"], ["actividad", "Actividad"], ["entrenos", "Entrenos"], ["fuerza", "Fuerza"], ["wellness", "Cuestionarios"], ["cuerpo", "Peso y medidas"], ["fotos", "Fotos"], ["tests", "Tests"]];
async function tabEvo(c) {
  const sub = S.coach.evo || "recuperacion"; const cid = c.id; let body = "";
  if (sub === "recuperacion") body = await tabRecup(c);
  else if (sub === "actividad") {
    const as = await q(sb.from("assignments").select("*").eq("client_id", cid).lte("fecha", today()).gte("fecha", addDays(today(), -28)).order("fecha", { ascending: false }));
    const byW = {}; as.forEach(x => { const k = monday(x.fecha); (byW[k] = byW[k] || []).push(x); });
    body = `<div class="card"><h2>Cumplimiento por semana</h2>${Object.keys(byW).length ? `<table><tbody>${Object.entries(byW).map(([k, v]) => { const p = Math.round(100 * v.filter(x => x.hecho).length / v.length); return `<tr><td>Semana del ${esc(fdate(k))}</td><td class="n">${v.filter(x => x.hecho).length}/${v.length}</td><td class="n"><span class="chip ${p >= 80 ? "ok" : p >= 50 ? "warn" : "bad"}">${p} %</span></td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">Sin tareas programadas en las últimas 4 semanas.</div>`}</div>
    <div class="card"><h2>Últimas tareas</h2>${as.length ? `<table><tbody>${as.slice(0, 40).map(x => `<tr data-act="asig-edit" data-id="${esc(x.id)}" style="cursor:pointer"><td>${esc(fdate(x.fecha, { weekday: "short", day: "numeric", month: "short" }))}</td><td>${tipoChip(x.tipo)} ${esc(x.titulo)}${x.respuesta ? `<div class="tiny muted">«${esc(x.respuesta)}»</div>` : ""}</td><td>${x.hecho ? `<span class="chip ok">Hecho</span>` : `<span class="chip bad">No hecho</span>`}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">—</div>`}</div>`;
  } else if (sub === "entrenos") {
    const wo = await q(sb.from("workouts").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40));
    body = wo.length ? wo.map(w => `<div class="card"><h2>${esc(w.dia || "Entreno")} <small>${esc(fdate(w.fecha, { weekday: "short", day: "numeric", month: "short" }))}${w.rpe_sesion != null ? " · dureza " + w.rpe_sesion + "/10" : ""}${w.duracion_min ? " · " + w.duracion_min + " min" : ""}${w.rpe_sesion != null && w.duracion_min ? " · " + w.rpe_sesion * w.duracion_min + " UA" : ""}</small></h2><div class="tbl"><table><tbody>${Object.entries((w.sets || []).reduce((a, s) => { (a[s.ejercicio] = a[s.ejercicio] || []).push(s); return a; }, {})).map(([ex, ss]) => `<tr><td>${esc(ex)}</td><td class="n">${ss.map(s => s.hecho ? "hecho" : `${s.kg ?? "?"}×${s.reps ?? "?"}${s.rir != null ? " @" + s.rir : ""}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>${w.comentario ? `<p class="small" style="margin:8px 0 0">${esc(w.comentario)}</p>` : ""}</div>`).join("") : `<div class="empty">Sin entrenos registrados.</div>`;
  } else if (sub === "fuerza") {
    const wo = await q(sb.from("workouts").select("fecha,sets").eq("client_id", cid).order("fecha", { ascending: true }).limit(400));
    const exs = [...new Set(wo.flatMap(w => (w.sets || []).filter(s => s.kg != null).map(s => s.ejercicio)))]; const sel = exs.includes(S.sub.cex) ? S.sub.cex : exs[0];
    const pts = wo.map(w => { const v = (w.sets || []).filter(s => s.ejercicio === sel).map(s => e1rm(s.kg, s.reps, s.rir)).filter(Boolean); return { x: w.fecha, y: v.length ? Math.max(...v) : null }; });
    body = exs.length ? `<div class="card"><h2>1RM estimado</h2><select id="cex-sel" aria-label="Ejercicio">${exs.map(x => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>${lineChart(pts, { label: "1RM estimado", unit: "kg" })}<p class="tiny muted">Mejor serie de cada día (Epley con repeticiones en reserva). Pasa el ratón por la gráfica para ver cada dato.</p></div>
    <div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Ejercicio</th><th>Última vez</th><th class="n">Mayor carga</th><th class="n">Mejor 1RM est.</th><th class="n">Cambio</th><th></th></tr></thead><tbody>${exs.map(x => { const ses = wo.map(w => ({ f: w.fecha, s: (w.sets || []).filter(y => y.ejercicio === x && y.kg != null) })).filter(z => z.s.length); const l = ses[ses.length - 1]; const e1 = z => Math.max(...z.s.map(y => e1rm(y.kg, y.reps, y.rir) || 0)); const best = Math.max(...ses.map(e1)); const ch = ses.length > 1 ? e1(l) - e1(ses[0]) : null; const mx = Math.max(...ses.flatMap(z => z.s.map(y => +y.kg)));
      return `<tr><td><span class="lnk">${esc(x)}</span></td><td class="tiny">${esc(fdate(l.f))} · ${l.s.map(y => `${y.kg}×${y.reps ?? "?"}`).join(" · ")}</td><td class="n">${fmt(mx)} kg</td><td class="n">${best ? fmt(best) + " kg" : "—"}</td><td class="n">${ch == null ? "—" : `<span class="chip ${ch > 0 ? "ok" : ch < 0 ? "bad" : ""}">${ch > 0 ? "+" : ""}${fmt(ch)} kg</span>`}</td><td><button class="btn ghost sm" data-act="ex-hist" data-n="${esc(x)}">Historial</button></td></tr>`; }).join("")}</tbody></table></div></div>` : `<div class="empty">Sin series con carga registradas.</div>`;
  } else if (sub === "wellness") {
    const wl = await q(sb.from("wellness").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(60));
    body = `<div class="card"><h2>Bienestar diario <small>1–5 (5 = mejor)</small></h2>${lineChart(wl.map(w => ({ x: w.fecha, y: wellIdx(w) })), { label: "Bienestar", yMin: 1, yMax: 5, dec: 2 })}</div><div class="card"><div class="tbl"><table><thead><tr><th>Fecha</th>${WK.map(([, l]) => `<th class="n">${esc(l.split(" ")[0])}</th>`).join("")}<th class="n">Sueño h</th><th class="n">FC</th><th class="n">VFC</th><th>Molestia</th><th>Comentario</th></tr></thead><tbody>${wl.map(w => `<tr><td>${esc(fdate(w.fecha))}</td>${WK.map(([k]) => `<td class="n">${w[k] ?? "—"}</td>`).join("")}<td class="n">${w.sueno_h ?? "—"}</td><td class="n">${w.fc ?? "—"}</td><td class="n">${w.hrv ?? "—"}</td><td>${esc(w.molestia_zona || "")}${w.molestia_0a10 != null ? " " + w.molestia_0a10 + "/10" : ""}</td><td class="tiny">${esc(w.comentario || "")}</td></tr>`).join("") || `<tr><td colspan="14" class="muted">Sin cuestionarios.</td></tr>`}</tbody></table></div></div>`;
  } else if (sub === "cuerpo") {
    const [ws, ms] = await Promise.all([q(sb.from("weights").select("fecha,kg").eq("client_id", cid).order("fecha", { ascending: true }).limit(400)), q(sb.from("measurements").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(30))]);
    const byW = {}; ws.forEach(w => { const k = monday(w.fecha); (byW[k] = byW[k] || []).push(+w.kg); });
    body = `<div class="card"><h2>Peso medio semanal</h2>${lineChart(Object.entries(byW).map(([x, v]) => ({ x, y: avg(v) })), { label: "Peso medio semanal" })}</div><div class="card"><h2>Medidas <small>cm</small></h2>${ms.length ? `<div class="tbl"><table><thead><tr><th>Fecha</th><th class="n">Cintura</th><th class="n">Cadera</th><th class="n">Pecho</th><th class="n">Brazo</th><th class="n">Muslo</th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(fdate(m.fecha))}</td>${["cintura", "cadera", "pecho", "brazo", "muslo"].map(k => `<td class="n">${fmt(m[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin medidas.</div>`}</div>`;
  } else if (sub === "fotos") {
    const ph = await q(sb.from("photos").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40)); let urls = {};
    if (ph.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ph.map(p => p.path), 600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); }
    body = `<div class="card">${ph.length ? `<div class="photos">${ph.map(p => urls[p.path] ? `<figure style="margin:0"><img src="${esc(urls[p.path])}" alt="${esc(p.vista)} ${esc(fdate(p.fecha))}" loading="lazy"><figcaption class="tiny muted">${esc(fdate(p.fecha))} · ${esc(p.vista)}</figcaption></figure>` : "").join("")}</div>` : `<div class="empty">Sin fotos.</div>`}</div>`;
  } else {
    const ts = await q(sb.from("tests").select("*").eq("client_id", cid).order("fecha", { ascending: false, nullsFirst: false }));
    body = `<div class="card"><h2>Tests</h2>${ts.length ? `<table><thead><tr><th>Test</th><th>Fecha</th><th class="n">Resultado</th><th></th></tr></thead><tbody>${ts.map(x => `<tr><td>${esc(x.nombre)}<div class="tiny muted">${esc(x.categoria)}${x.notas ? " · " + esc(x.notas) : ""}</div></td><td>${x.fecha ? esc(fdate(x.fecha)) : "—"}</td><td class="n">${x.valor != null ? fmt(x.valor, 2) + " " + esc(x.unidad) : ""}${x.izq != null || x.der != null ? `I ${fmt(x.izq, 2)} · D ${fmt(x.der, 2)} ${esc(x.unidad)}${x.izq && x.der ? ` · LSI ${Math.round(100 * Math.min(x.izq, x.der) / Math.max(x.izq, x.der))} %` : ""}` : ""}</td><td><button class="btn ghost sm" data-act="test-del" data-id="${esc(x.id)}">Borrar</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">Sin tests.</div>`}</div>
    <form id="f-test" class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Añadir test</h2><div class="grid2"><div class="f"><label>Test</label><input name="nombre" required placeholder="CMJ, 1RM sentadilla, triple hop…"></div><div class="f"><label>Categoría</label><select name="categoria">${["fuerza", "salto", "velocidad", "resistencia", "movilidad", "composicion", "otro"].map(x => `<option>${x}</option>`).join("")}</select></div></div>
    <div class="grid3"><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${today()}"></div><div class="f"><label>Valor</label><input name="valor" inputmode="decimal"></div><div class="f"><label>Unidad</label><input name="unidad" placeholder="kg, cm, s"></div></div>
    <div class="grid3"><div class="f"><label>Izquierda</label><input name="izq" inputmode="decimal"></div><div class="f"><label>Derecha</label><input name="der" inputmode="decimal"></div><label class="small" style="align-self:end"><input type="checkbox" name="menos"> Mejor cuanto menos</label></div>
    <div class="f"><label>Notas</label><input name="notas"></div><button class="btn pri">Añadir</button></form>`;
  }
  return `<div class="seg sub" role="group" aria-label="Evolución">${EVO.map(([k, l]) => `<button data-act="evo" data-t="${k}" aria-pressed="${sub === k}">${l}</button>`).join("")}</div>${body}`;
}
async function saveTest(f) { const v = n => f[n].value.trim(); try { await q(sb.from("tests").insert({ client_id: S.coach.cid, nombre: v("nombre"), categoria: v("categoria"), fecha: v("fecha") || null, valor: num(v("valor")), unidad: v("unidad"), izq: num(v("izq")), der: num(v("der")), notas: v("notas"), mejor_es_menos: f.menos.checked })); toast("Test añadido"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } }

/* ---- Nutrición ---- */
function secRow(s = {}) { return `<div class="card" data-s style="display:flex;flex-direction:column;gap:8px;background:var(--bg)"><div class="row"><input name="s_t" value="${esc(s.titulo || "")}" placeholder="Desayuno, Pautas generales…" class="grow" aria-label="Título de la sección"><button type="button" class="btn ghost sm" data-act="sec-del">Quitar</button></div><textarea name="s_i" placeholder="Una línea por punto" aria-label="Puntos">${esc((s.items || []).join("\n"))}</textarea></div>`; }
/* ---- Informes y Cuenta ---- */
async function tabInformes(c) {
  const rp = await q(sb.from("reports").select("*").eq("client_id", c.id).order("fecha", { ascending: false }).limit(30));
  return `<div class="row" style="flex-wrap:wrap"><button class="btn pri" data-act="rep-new" data-auto="1">+ Nuevo informe con autorrelleno</button><button class="btn" data-act="rep-new" data-auto="0">+ En blanco</button><span class="grow"></span><span class="tiny muted">Claude también los prepara en la revisión semanal del chat del cliente. Nada se publica hasta que pulses «Publicar».</span></div>
  ${rp.length ? rp.map(r => `<div class="card"><h2>${esc(r.titular || "Informe")} <small>${esc(fdate(r.fecha))}${r.semana ? " · " + esc(r.semana) : ""}</small></h2><div class="row" style="flex-wrap:wrap"><span class="chip ${r.publicado ? "ok" : "warn"}">${r.publicado ? "Visible para el cliente" : "Borrador (no lo ve)"}</span><span class="tag tag-${r.autor === "adrian" ? "workout" : "formulario"}">${r.autor === "adrian" ? "Hecho por ti" : "Hecho por Claude"}</span><span class="grow"></span><button class="btn sm" data-act="ver-informe" data-id="${esc(r.id)}">Vista del cliente</button><button class="btn sm" data-act="rep-edit" data-id="${esc(r.id)}">Editar</button><button class="btn sm ${r.publicado ? "" : "pri"}" data-act="publicar" data-id="${esc(r.id)}" data-v="${r.publicado ? "0" : "1"}">${r.publicado ? "Ocultar" : "Publicar"}</button></div></div>`).join("") : `<div class="empty">Aún no hay informes.</div>`}`;
}
const repLines = a => (a || []).map(x => typeof x === "string" ? x : `${x.t || ""}${x.p ? " | " + x.p : ""}`).join("\n");
async function autoReport(cid, fin) {
  const ini = addDays(fin, -6), ini0 = addDays(ini, -7);
  const [as, wo, woAll, wl, ws, pl] = await Promise.all([
    q(sb.from("assignments").select("tipo,titulo,fecha,hecho,visible").eq("client_id", cid).gte("fecha", ini).lte("fecha", fin)),
    q(sb.from("workouts").select("fecha,dia,sets,rpe_sesion").eq("client_id", cid).gte("fecha", ini).lte("fecha", fin)),
    q(sb.from("workouts").select("fecha,sets").eq("client_id", cid).lt("fecha", ini).order("fecha", { ascending: false }).limit(200)),
    q(sb.from("wellness").select("*").eq("client_id", cid).gte("fecha", ini).lte("fecha", fin)),
    q(sb.from("weights").select("fecha,kg").eq("client_id", cid).gte("fecha", ini0).lte("fecha", fin)),
    q(sb.from("plans").select("bloques").eq("client_id", cid).limit(1))]);
  const ent = as.filter(a => (a.tipo === "workout" || a.tipo === "cardio") && a.visible), hechos = ent.filter(a => a.hecho).length;
  const tareas = as.filter(a => (a.tipo === "tarea" || a.tipo === "formulario") && a.visible);
  const sue = avg(wl.map(w => num(w.sueno_h)).filter(x => x != null)), bien = avg(wl.map(wellIdx).filter(x => x != null));
  const pw = avg(ws.filter(w => w.fecha >= ini).map(w => +w.kg)), pw0 = avg(ws.filter(w => w.fecha < ini).map(w => +w.kg));
  // mejores marcas de la semana frente a lo anterior
  const prevBest = {}; woAll.forEach(w => (w.sets || []).forEach(x => { const e = e1rm(x.kg, x.reps, x.rir); if (e && (!prevBest[x.ejercicio] || e > prevBest[x.ejercicio])) prevBest[x.ejercicio] = e; }));
  const prs = {}; wo.forEach(w => (w.sets || []).forEach(x => { const e = e1rm(x.kg, x.reps, x.rir); if (e && prevBest[x.ejercicio] && e > prevBest[x.ejercicio] * 1.005 && (!prs[x.ejercicio] || e > prs[x.ejercicio].e)) prs[x.ejercicio] = { e, s: x }; }));
  const kpis = {}; if (ent.length) kpis["Entrenos"] = { valor: `${hechos}/${ent.length}`, nota: Math.round(100 * hechos / ent.length) + " %" };
  if (pw != null) kpis["Peso medio"] = { valor: fmt(pw) + " kg", nota: pw0 != null ? `${pw - pw0 >= 0 ? "+" : ""}${fmt(pw - pw0)} kg vs semana anterior` : "" };
  if (sue != null) kpis["Sueño"] = { valor: fmt(sue) + " h", nota: "media de la semana" };
  if (bien != null) kpis["Bienestar"] = { valor: fmt(bien, 1), nota: "de 5" };
  const logros = [], mejorar = [], tener = [], foco = [];
  if (ent.length && hechos === ent.length) logros.push(`${hechos} de ${ent.length} entrenos | Has hecho todo lo planificado: la constancia es lo que más te hace progresar`);
  else if (ent.length && hechos / ent.length < 0.75) mejorar.push(`Has hecho ${hechos} de ${ent.length} entrenos | Si algún día no puedes, avísame y lo adaptamos a tu semana`);
  Object.entries(prs).slice(0, 3).forEach(([ex, v]) => logros.push(`Mejor marca en ${ex}: ${v.s.kg} kg × ${v.s.reps} | Tu fuerza estimada sube a ${fmt(v.e)} kg`));
  if (sue != null && sue < 7) mejorar.push(`Duerme algo más (media ${fmt(sue)} h) | El músculo se recupera sobre todo mientras duermes; apunta a 7–9 h`);
  if (wl.length < 5) mejorar.push(`Rellena el cuestionario diario (${wl.length}/7 días) | Con él ajusto la carga a cómo te encuentras`);
  if (tareas.some(t => !t.hecho)) tener.push(`Tienes tareas pendientes | Revísalas en «Hoy» o en tu perfil`);
  wl.filter(w => w.molestia_zona).slice(0, 2).forEach(w => tener.push(`Molestia en ${w.molestia_zona} (${w.molestia_0a10 ?? "?"}/10) | Si no mejora o va a más, dímelo antes del próximo entreno`));
  const bl = ((pl[0] || {}).bloques) || []; let next = null; for (const b of bl) for (const w of b.semanas || []) if (w.inicio <= addDays(fin, 1) && addDays(fin, 1) <= w.fin) next = { ...w, b: b.nombre };
  if (next && next.foco) foco.push(`${next.nombre}: ${next.foco} | Lo verás en tus entrenos de la semana`);
  let semana = ""; for (const b of bl) for (const w of b.semanas || []) if (w.inicio <= fin && fin <= w.fin) semana = `${b.nombre} · ${w.nombre}`;
  const titular = ent.length && hechos === ent.length ? (Object.keys(prs).length ? "Semana completa y con mejores marcas" : "Semana completa: ¡buen trabajo!") : ent.length ? `Semana con ${hechos} de ${ent.length} entrenos` : "Tu semana";
  return { fecha: fin, semana, titular, kpis, logros, mejorar, tener_en_cuenta: tener, foco, mensaje: "", mostrar_peso: true };
}
async function openReportEditor(id, auto) {
  const cid = S.coach.cid; let r;
  if (id) r = (await q(sb.from("reports").select("*").eq("id", id).limit(1)))[0];
  else { const t = today(); const fin = dow(t) === 7 ? t : addDays(monday(t), -1); r = auto ? await autoReport(cid, fin) : { fecha: fin, semana: "", titular: "", kpis: {}, logros: [], mejorar: [], tener_en_cuenta: [], foco: [], mensaje: "", mostrar_peso: true }; }
  if (!r) return;
  const kp = Object.entries(r.kpis || {}); while (kp.length < 4) kp.push(["", { valor: "", nota: "" }]);
  sheet(`<h2>${id ? "Editar informe" : "Nuevo informe"}</h2>${auto && !id ? `<p class="tiny muted" style="margin:0">Relleno automático con los datos de la semana (${esc(fdate(addDays(r.fecha, -6)))}–${esc(fdate(r.fecha))}). Revisa y escribe lo que quieras; nada se publica hasta que pulses Publicar.</p>` : ""}
  <form id="f-rep" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:12px">
  <div class="grid3"><div class="f"><label>Fecha (fin de semana)</label><input name="fecha" type="date" value="${esc(r.fecha)}" required></div><div class="f"><label>Semana</label><input name="semana" value="${esc(r.semana || "")}" placeholder="Mesociclo 1 · S3"></div><div class="f"><label>Titular</label><input name="titular" value="${esc(r.titular || "")}" required></div></div>
  <div><div class="small" style="font-weight:700;margin-bottom:6px">Datos destacados</div>${kp.map(([k, v]) => `<div class="kprow" data-kp><input name="k_l" value="${esc(k)}" placeholder="Etiqueta (Entrenos)"><input name="k_v" value="${esc(v && v.valor != null ? v.valor : v || "")}" placeholder="Valor (4/4)"><input name="k_n" value="${esc((v && v.nota) || "")}" placeholder="Nota (100 %)"></div>`).join("")}</div>
  <p class="tiny muted" style="margin:0">Una línea por punto. Formato: <b>frase corta | explicación sencilla</b> (la explicación es opcional).</p>
  <div class="grid2"><div class="f"><label>Lo que ha hecho bien</label><textarea name="logros">${esc(repLines(r.logros))}</textarea></div><div class="f"><label>A mejorar</label><textarea name="mejorar">${esc(repLines(r.mejorar))}</textarea></div><div class="f"><label>A tener en cuenta</label><textarea name="tener">${esc(repLines(r.tener_en_cuenta))}</textarea></div><div class="f"><label>Foco para la semana que viene</label><textarea name="foco">${esc(repLines(r.foco))}</textarea></div></div>
  <div class="f"><label>Mensaje</label><textarea name="mensaje" style="min-height:90px">${esc(r.mensaje || "")}</textarea></div>
  <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="mostrar_peso" ${r.mostrar_peso !== false ? "checked" : ""}> Mostrar el peso al cliente</label>
  <div class="row" style="flex-wrap:wrap"><button class="btn pri" name="pub" value="0">Guardar borrador</button><button class="btn dark" name="pub" value="1">Guardar y publicar</button><span class="grow"></span>${id ? `<button type="button" class="btn ghost sm bad" data-act="rep-del" data-id="${esc(id)}">Borrar</button>` : ""}</div></form>`, true);
}
async function saveReport(f, pub) {
  const cid = S.coach.cid; const L = n => lines(f[n].value);
  const kpis = {}; f.querySelectorAll("[data-kp]").forEach(r => { const g = n => r.querySelector(`[name="${n}"]`).value.trim(); if (g("k_l")) kpis[g("k_l")] = { valor: g("k_v"), nota: g("k_n") }; });
  const row = { client_id: cid, fecha: f.fecha.value, semana: f.semana.value.trim(), titular: f.titular.value.trim(), kpis, logros: L("logros"), mejorar: L("mejorar"), tener_en_cuenta: L("tener"), foco: L("foco"), mensaje: f.mensaje.value.trim(), mostrar_peso: f.mostrar_peso.checked };
  if (pub) { row.publicado = true; row.publicado_en = new Date().toISOString(); }
  try {
    if (f.dataset.id) await q(sb.from("reports").update(row).eq("id", f.dataset.id));
    else { let id = `${cid}-${row.fecha}`; const ex = await q(sb.from("reports").select("id").eq("id", id)); if (ex.length) id += "-" + Math.random().toString(36).slice(2, 5); await q(sb.from("reports").insert({ id, autor: "adrian", publicado: !!pub, ...row })); }
    sheet(""); toast(pub ? "Informe publicado: ya lo ve el cliente" : "Borrador guardado"); refreshClient();
  } catch (e) { toast(errMsg(e)); }
}
function tabCuenta(c, pl) {
  return `<form id="f-cuenta" class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Cuenta</h2><div class="f"><label for="cu-e">Email de acceso</label><input id="cu-e" name="email" type="email" value="${esc(c.email)}"></div><div class="f"><label for="cu-s">Estado</label><select id="cu-s" name="estado">${["activo", "pausa", "baja"].map(s => `<option ${c.estado === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><p class="tiny muted" style="margin:0">«Baja» le quita el acceso a la app al momento.</p>
  <h2 style="margin-top:6px">Qué progreso ve</h2><div class="row">${[["fuerza", "Fuerza"], ["peso", "Peso"], ["bienestar", "Bienestar"], ["medidas", "Medidas"], ["tests", "Tests"], ["fotos", "Fotos"]].map(([k, l]) => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="pv" value="${k}" ${(pl.progreso_visible || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div><button class="btn pri">Guardar</button></form>
  <div class="card"><h2>Acceso a la app</h2>${c.user_id ? `<p class="small" style="margin:0 0 10px">Cuenta creada y vinculada.</p><button class="btn sm" data-act="desvincular" data-cid="${esc(c.id)}">Desvincular cuenta</button><p class="tiny muted">Úsalo si cambia de email o pierde el acceso: tendrá un código nuevo para registrarse otra vez.</p>` : `<p class="small" style="margin:0">Mándale el enlace de la app, su <b>email</b> (${esc(c.email)}) y este <b>código de alta</b> para que se registre en «Nuevo atleta»:</p><p style="font-size:26px;font-weight:800;letter-spacing:3px;margin:10px 0">${esc(c.codigo_alta || "—")}</p><div class="row"><button class="btn sm" data-act="copiar-alta">Copiar mensaje</button><button class="btn sm" data-act="nuevo-codigo" data-cid="${esc(c.id)}">Generar otro código</button></div>`}</div>`;
}
async function saveCuenta(f) { try { await q(sb.from("clients").update({ email: f.email.value.trim().toLowerCase(), estado: f.estado.value }).eq("id", S.coach.cid)); await q(sb.from("plans").upsert({ client_id: S.coach.cid, progreso_visible: [...f.querySelectorAll('[name="pv"]:checked')].map(x => x.value) }, { onConflict: "client_id" })); toast("Guardado"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } }

/* ================= Librería ================= */
async function viewLib() {
  loading("Librería"); const tab = S.lib.tab || "workouts"; let body = ""; const qy = (S.lib.q || "").toLowerCase();
  const LT = [["workouts", "Workouts"], ["programas", "Programas"], ["ejercicios", "Ejercicios"], ["alimentos", "Alimentos"], ["recetas", "Recetas"]];
  const head = (titulo, n, act, h, label) => `<div class="pghead"><h1 class="ptitle">${titulo} <sup>${n}</sup></h1></div><div class="row"><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ex-q" type="search" placeholder="Buscar por nombre o descripción…" value="${esc(S.lib.q || "")}" aria-label="Buscar"></label><span class="grow"></span><button class="btn dark" data-act="${act}" ${h ? `data-h="${h}"` : ""}><span class="plus">+</span>${label}</button></div>`;
  const desc = c => { const ej = (c && c.ejercicios) || []; return ej.length ? ej.map(e => e.nombre).join(", ") : ((c && c.detalle) || ""); };
  if (tab === "alimentos") body = await libFoodsHTML();
  else if (tab === "recetas") body = await libRecipesHTML();
  else if (tab === "ejercicios") {
    const ex = await exLib(true); const list = ex.filter(e => !qy || (e.nombre + " " + e.grupo + " " + e.material).toLowerCase().includes(qy));
    body = head("Ejercicios", ex.length, "ex-new", "", "Añadir ejercicio") + `<div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Nombre</th><th>Grupo / patrón</th><th>Material</th><th>Vídeo</th></tr></thead><tbody>${list.map(e => `<tr data-act="ex-edit" data-id="${esc(e.id)}"><td><span class="lnk">${esc(e.nombre)}</span>${e.notas ? `<div class="tiny muted clamp">${esc(e.notas)}</div>` : ""}</td><td>${esc(e.grupo)}</td><td>${esc(e.material)}</td><td>${e.video_url ? `<span class="tag tag-workout">▶ vídeo</span>` : ""}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sin resultados.</td></tr>`}</tbody></table></div></div>`;
  } else if (tab === "workouts") {
    const ts = await tplLib(); const list = ts.filter(t => !qy || (t.nombre + " " + t.descripcion + " " + desc(t.contenido)).toLowerCase().includes(qy));
    body = head("Workouts", ts.length, "go", "lib-w-new", "Añadir workout") + `<div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Nombre</th><th>Tipo</th><th>Descripción</th><th>Actualizado</th></tr></thead><tbody>${list.map(t => `<tr data-act="go" data-h="lib-w-${esc(t.id)}"><td><span class="lnk">${esc(t.nombre)}</span></td><td><span class="tag tag-${esc(t.tipo)}">${esc(TIPOS[t.tipo])}</span></td><td><div class="tiny muted clamp">${esc(t.descripcion ? t.descripcion + ". " : "")}${esc(desc(t.contenido))}</div></td><td class="tiny muted">${esc(fdate((t.updated_at || "").slice(0, 10)))}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sin workouts.</td></tr>`}</tbody></table></div></div>`;
  } else {
    const ps = await q(sb.from("programs").select("id,nombre,descripcion,semanas,items").order("nombre")); const list = ps.filter(p => !qy || (p.nombre + " " + p.descripcion).toLowerCase().includes(qy));
    body = head("Programas", ps.length, "go", "lib-p-new", "Añadir programa") + `<div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Nombre</th><th>Duración</th><th>Descripción</th><th>Elementos</th></tr></thead><tbody>${list.map(p => `<tr data-act="go" data-h="lib-p-${esc(p.id)}"><td><span class="lnk">${esc(p.nombre)}</span></td><td>${p.semanas} semanas</td><td><div class="tiny muted clamp">${esc(p.descripcion || "")}</div></td><td class="n">${(p.items || []).length}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sin programas.</td></tr>`}</tbody></table></div></div>`;
  }
  shell("Librería", body, { crumb: [["lib", "Librería"]], right: `<div class="subtabs">${LT.map(([k, l]) => `<button data-act="lib-tab" data-t="${k}" aria-current="${tab === k}">${l}</button>`).join("")}</div>` });
  const i = $("#ex-q"); if (i && S.lib.focusQ) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); S.lib.focusQ = false; }
}
function openEx(id) {
  const e = id ? (S.lib.ex || []).find(x => x.id === id) : {}; if (!e) return;
  sheet(`<h2>${id ? "Editar" : "Nuevo"} ejercicio</h2><form id="f-ex" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label>Nombre</label><input name="nombre" required value="${esc(e.nombre || "")}"></div><div class="grid2"><div class="f"><label>Grupo muscular / patrón</label><input name="grupo" value="${esc(e.grupo || "")}" placeholder="Cuádriceps, empuje horizontal…"></div><div class="f"><label>Material</label><input name="material" value="${esc(e.material || "")}" placeholder="Barra, polea, máquina…"></div></div><div class="f"><label>Vídeo (enlace de YouTube, Drive…)</label><input name="video_url" type="url" value="${esc(e.video_url || "")}"></div><div class="f"><label>Notas técnicas por defecto</label><textarea name="notas">${esc(e.notas || "")}</textarea></div><button class="btn pri block">Guardar</button>${id ? `<button type="button" class="btn ghost" data-act="ex-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveEx(f) { const row = { nombre: f.nombre.value.trim(), grupo: f.grupo.value.trim(), material: f.material.value.trim(), video_url: f.video_url.value.trim(), notas: f.notas.value.trim() }; try { if (f.dataset.id) await q(sb.from("exercises").update(row).eq("id", f.dataset.id)); else await q(sb.from("exercises").insert(row)); sheet(""); toast("Ejercicio guardado"); viewLib(); } catch (e) { toast(/duplicate|unique/i.test(e.message || "") ? "Ya existe un ejercicio con ese nombre" : errMsg(e)); } }
async function viewLibWorkout(id) {
  loading("Workout"); await exLib();
  const t = id === "new" ? { nombre: "", tipo: S.lib.newTipo || "workout", descripcion: "", contenido: {} } : (await q(sb.from("workout_templates").select("*").eq("id", id).limit(1)))[0];
  if (!t) { location.hash = "lib"; return; } S.sub.wtTipo = t.tipo;
  shell(t.nombre || "Nuevo workout", `<form id="f-wt" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:12px"><div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Nombre</label><input name="nombre" required value="${esc(t.nombre)}" placeholder="Torso A · Hipertrofia"></div><div class="f"><label>Tipo</label><select name="tipo" id="wt-tipo"><option value="workout" ${t.tipo === "workout" ? "selected" : ""}>Workout</option><option value="cardio" ${t.tipo === "cardio" ? "selected" : ""}>Cardio</option></select></div></div><div class="f"><label>Descripción (solo para ti)</label><input name="descripcion" value="${esc(t.descripcion || "")}"></div></div>
  <div class="card" id="wt-ed">${wEditor(t.contenido || {}, t.tipo)}</div>
  <div class="savebar row"><button class="btn pri">Guardar</button>${id !== "new" ? `<button type="button" class="btn" data-act="wt-asignar" data-id="${esc(id)}">Asignar a un cliente</button><button type="button" class="btn" data-act="wt-dup" data-id="${esc(id)}">Duplicar</button><span class="grow"></span><button type="button" class="btn ghost" data-act="wt-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button>` : ""}</div></form>${exDatalist()}`, { crumb: [["lib", "Librería"], ["lib", "Workouts"], [null, t.nombre || "Nuevo workout"]] });
}
async function saveWt(f) {
  const tipo = f.tipo.value; const contenido = readWEditor($("#wt-ed"), tipo); if (tipo === "workout") await newExercisesFrom(contenido);
  const row = { nombre: f.nombre.value.trim(), tipo, descripcion: f.descripcion.value.trim(), contenido };
  try { if (f.dataset.id !== "new") { await q(sb.from("workout_templates").update(row).eq("id", f.dataset.id)); toast("Workout guardado"); } else { const r = await q(sb.from("workout_templates").insert(row).select("id")); toast("Workout creado"); location.hash = "lib-w-" + r[0].id; } } catch (e) { toast(errMsg(e)); }
}
async function openWtAsignar(id) {
  if (!S.coach.list.length) await loadClients();
  sheet(`<h2>Asignar workout</h2><form id="f-wtas" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label>Cliente</label><select name="cid">${S.coach.list.filter(c => c.estado !== "baja").map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select></div><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${today()}" required></div><button class="btn pri block">Asignar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function wtAsignar(f) { try { const t = (await q(sb.from("workout_templates").select("*").eq("id", f.dataset.id).limit(1)))[0]; await q(sb.from("assignments").insert({ client_id: f.cid.value, fecha: f.fecha.value, tipo: t.tipo, titulo: t.nombre.replace(/^[^·]+ · /, ""), contenido: t.contenido })); sheet(""); toast("Asignado"); } catch (e) { toast(errMsg(e)); } }

/* ---- Programas ---- */
async function viewLibProgram(id) {
  loading("Programa"); const tpls = await tplLib(); S.sub.tpls = tpls;
  const p = id === "new" ? { nombre: "", descripcion: "", semanas: 4, items: [] } : (await q(sb.from("programs").select("*").eq("id", id).limit(1)))[0];
  if (!p) { location.hash = "lib"; return; } S.sub.prog = JSON.parse(JSON.stringify(p));
  renderProgram(id);
}
function renderProgram(id) {
  const p = S.sub.prog; let grid = `<div class="pgrid phead"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>`;
  for (let s = 1; s <= p.semanas; s++) {
    grid += `<div class="pweek"><div class="pwl">Semana ${s}</div><div class="pgrid">`;
    for (let d = 1; d <= 7; d++) { const its = p.items.map((it, i) => ({ ...it, i })).filter(it => it.semana === s && it.dia === d);
      grid += `<div class="pday"><div class="pdh"><span></span><button type="button" class="padd" data-act="pi-new" data-s="${s}" data-d="${d}" aria-label="Añadir en semana ${s}, ${DSEM[d]}">+</button></div>${its.map(it => `<button type="button" class="pch tp-${esc(it.tipo)}" data-act="pi-edit" data-i="${it.i}">${esc(it.titulo || TIPOS[it.tipo])}</button>`).join("")}</div>`; }
    grid += `</div></div>`;
  }
  shell(p.nombre || "Nuevo programa", `<form id="f-prog" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:12px"><div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Nombre</label><input name="nombre" required value="${esc(p.nombre)}" placeholder="Hipertrofia 4 días · 4 semanas" data-prog="nombre"></div><div class="f"><label>Semanas</label><input name="semanas" type="number" min="1" max="16" value="${p.semanas}" data-prog="semanas"></div></div><div class="f"><label>Descripción</label><input name="descripcion" value="${esc(p.descripcion || "")}" data-prog="descripcion"></div></div>
  <div class="card">${grid}<p class="tiny muted" style="margin:8px 0 0">Pulsa «+» en un día para añadir un workout de la librería, cardio, tarea, formulario o nota.</p></div>
  <div class="savebar row"><button class="btn pri">Guardar programa</button>${id !== "new" ? `<button type="button" class="btn" data-act="prog-asignar" data-id="${esc(id)}">Asignar a un cliente</button><button type="button" class="btn" data-act="prog-dup" data-id="${esc(id)}">Duplicar</button><span class="grow"></span><button type="button" class="btn ghost" data-act="prog-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button>` : ""}</div></form>`, { crumb: [["lib", "Librería"], ["lib", "Programas"], [null, p.nombre || "Nuevo programa"]], keepScroll: true });
}
function openProgItem(i, s, d) {
  const it = i != null ? S.sub.prog.items[i] : { semana: s, dia: d, tipo: "workout", titulo: "", contenido: {} }; S.sub.piTipo = it.tipo;
  const tpls = S.sub.tpls || [];
  sheet(`<h2>Semana ${it.semana} · ${DSEM[it.dia]}</h2><form id="f-pi" data-i="${i ?? ""}" data-s="${it.semana}" data-d="${it.dia}" style="display:flex;flex-direction:column;gap:10px">
  <div class="seg" role="group" aria-label="Tipo">${Object.entries(TIPOS).map(([k, l]) => `<button type="button" data-act="pi-tipo" data-t="${k}" aria-pressed="${it.tipo === k}">${l}</button>`).join("")}</div>
  <div id="pi-body">${piBody(it, tpls)}</div>
  <button class="btn pri block">Aceptar</button>${i != null ? `<button type="button" class="btn ghost" data-act="pi-del" data-i="${i}" style="color:var(--bad)">Quitar del programa</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
function piBody(it, tpls) {
  const t = it.tipo; const c = it.contenido || {};
  if (t === "workout" || t === "cardio") { const opts = tpls.filter(p => p.tipo === t); return opts.length ? `<div class="f"><label>${t === "workout" ? "Workout" : "Cardio"} de la librería</label><select name="tpl">${opts.map(p => `<option value="${esc(p.id)}" ${it.template_id === p.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div><div class="f"><label>Título para el cliente (opcional)</label><input name="titulo" value="${esc(it.titulo || "")}" placeholder="Si lo dejas vacío, el nombre del workout"></div><p class="tiny muted" style="margin:0">Se usa la versión del workout que haya en la librería en el momento de asignar el programa.</p>` : `<div class="empty">Primero crea ${t === "workout" ? "workouts" : "cardios"} en la Librería.</div>`; }
  return `<div class="f"><label>Título</label><input name="titulo" required value="${esc(it.titulo || "")}"></div>${t === "formulario" ? `<div class="f"><label>Preguntas (una por línea)</label><textarea name="preguntas">${esc((c.preguntas || []).join("\n"))}</textarea></div>` : `<div class="f"><label>Detalle</label><textarea name="detalle">${esc(c.detalle || "")}</textarea></div>`}`;
}
function saveProgItem(f) {
  const t = S.sub.piTipo; const it = { semana: +f.dataset.s, dia: +f.dataset.d, tipo: t, titulo: f.titulo ? f.titulo.value.trim() : "" };
  if (t === "workout" || t === "cardio") { if (!f.tpl) { toast("Primero crea el workout en la Librería"); return; } it.template_id = f.tpl.value; if (!it.titulo) it.titulo = ((S.sub.tpls.find(x => x.id === it.template_id) || {}).nombre || "").replace(/^[^·]+ · /, ""); it.contenido = {}; }
  else it.contenido = t === "formulario" ? { preguntas: lines(f.preguntas.value) } : { detalle: f.detalle.value.trim() };
  if (f.dataset.i !== "") S.sub.prog.items[+f.dataset.i] = it; else S.sub.prog.items.push(it);
  sheet(""); renderProgram($("#f-prog").dataset.id);
}
async function saveProg(f) {
  const p = S.sub.prog; p.nombre = f.nombre.value.trim(); p.descripcion = f.descripcion.value.trim(); p.semanas = Math.min(16, Math.max(1, +f.semanas.value || 1)); p.items = p.items.filter(it => it.semana <= p.semanas);
  const row = { nombre: p.nombre, descripcion: p.descripcion, semanas: p.semanas, items: p.items };
  try { if (f.dataset.id !== "new") { await q(sb.from("programs").update(row).eq("id", f.dataset.id)); toast("Programa guardado"); } else { const r = await q(sb.from("programs").insert(row).select("id")); toast("Programa creado"); location.hash = "lib-p-" + r[0].id; } } catch (e) { toast(errMsg(e)); }
}


/* ================= Recuperación (entrenador) ================= */
// Gráfica de varias series con banda opcional; tooltip con todos los valores del día
function multiChart(days, series, o = {}) {
  const W = 620, H = o.h || 220, P = { l: 40, r: 16, t: 12, b: 24 };
  const vals = series.flatMap(s => days.map(d => s.v[d]).filter(v => v != null)).concat((o.band ? days.flatMap(d => o.band[d] ? [o.band[d][0], o.band[d][1]] : []) : []), o.ref != null ? [o.ref] : []);
  if (vals.length < 2) return `<div class="empty">${esc(o.empty || "Aún no hay suficientes datos")}</div>`;
  let y0 = o.yMin ?? Math.min(...vals), y1 = o.yMax ?? Math.max(...vals); if (o.yMin == null) { const pd = (y1 - y0) * .12 || 1; y0 -= pd; y1 += pd; }
  const tk = niceTicks(y0, y1, 4); if (o.yMin == null) { y0 = tk[0]; y1 = tk[tk.length - 1]; }
  const n = days.length, X = i => P.l + (n === 1 ? 0 : i / (n - 1)) * (W - P.l - P.r), Y = v => P.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  let g = tk.filter(v => v >= y0 && v <= y1).map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, o.dec ?? 0)}</text>`).join("");
  if (o.band) { const up = [], lo = []; days.forEach((d, i) => { if (o.band[d]) { up.push([X(i), Y(o.band[d][1])]); lo.unshift([X(i), Y(o.band[d][0])]); } }); if (up.length > 1) g += `<path d="M${[...up, ...lo].map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")} Z" fill="var(--ok)" opacity=".13"/>`; }
  if (o.ref != null) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  if (o.bars) { const bw = Math.max(2, (W - P.l - P.r) / n * .62); const s0 = series[0]; g += days.map((d, i) => s0.v[d] != null ? `<rect x="${X(i) - bw / 2}" y="${Y(Math.max(s0.v[d], y0))}" width="${bw}" height="${Math.max(0, Y(y0) - Y(Math.max(s0.v[d], y0)))}" rx="2" fill="${o.barColor ? o.barColor(s0.v[d], d) : s0.color}"/>` : "").join(""); }
  series.forEach((sr, si) => { if (o.bars && si === 0) return; let dd = "", on = false; days.forEach((d, i) => { const v = sr.v[d]; if (v == null) { on = false; return; } dd += (on ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; on = true; });
    g += `<path d="${dd}" fill="none" stroke="${sr.color}" stroke-width="${sr.w || 2}" ${sr.dash ? `stroke-dasharray="${sr.dash}"` : ""} stroke-linejoin="round"/>`;
    if (sr.dots) g += days.map((d, i) => sr.v[d] != null ? `<circle cx="${X(i)}" cy="${Y(sr.v[d])}" r="2.4" fill="${sr.color}"/>` : "").join(""); });
  const step = Math.max(1, Math.ceil(n / 6)); g += days.map((d, i) => i % step === 0 || i === n - 1 ? `<text x="${X(i)}" y="${H - 5}" text-anchor="middle">${esc(fdate(d))}</text>` : "").join("");
  g += `<line class="guide" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" stroke-dasharray="3 3" style="display:none"/><circle class="hl" r="5" fill="${series[0].color}" stroke="#fff" stroke-width="2" style="display:none"/>`;
  const data = days.map((d, i) => { const main = series.find(sr => sr.v[d] != null); return [+X(i).toFixed(1), main ? +Y(main.v[d]).toFixed(1) : Y(y0), fdate(d, { weekday: "short", day: "numeric", month: "short" }) + " · " + series.map(sr => sr.v[d] != null ? `${sr.name} ${fmt(sr.v[d], sr.dec ?? o.dec ?? 0)}${o.unit ? " " + o.unit : ""}` : "").filter(Boolean).join(" · ") + (o.band && o.band[d] ? ` · normal ${fmt(o.band[d][0])}–${fmt(o.band[d][1])}` : "")]; }).filter(p => series.some(sr => true));
  return `<div class="chart" data-pts="${esc(JSON.stringify(data))}" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || "Gráfica")}">${g}</svg><div class="ctip" role="status" hidden></div></div>
  <div class="leg tiny muted">${series.map(sr => `<span><i style="background:${sr.color}"></i>${esc(sr.name)}</span>`).join("")}${o.band ? `<span><i style="background:var(--ok);opacity:.4"></i>${esc(o.bandName || "Rango normal")}</span>` : ""}${o.ref != null ? `<span><i style="background:var(--muted)"></i>${esc(o.refName || "Referencia")}</span>` : ""}</div>`;
}
const meanOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sdOf = a => { if (a.length < 2) return null; const m = meanOf(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function rolling(days, v, n, minN = 3) { const out = {}; days.forEach((d, i) => { const w = days.slice(Math.max(0, i - n + 1), i + 1).map(x => v[x]).filter(x => x != null); if (w.length >= minN) out[d] = meanOf(w); }); return out; }
async function tabRecup(c) {
  const t = today(), d0 = addDays(t, -119), win = +(S.coach.recW || 42);
  const [wl, wo] = await Promise.all([q(sb.from("wellness").select("*").eq("client_id", c.id).gte("fecha", d0).order("fecha")), q(sb.from("workouts").select("fecha,rpe_sesion,duracion_min,dia").eq("client_id", c.id).gte("fecha", d0).order("fecha"))]);
  const all = []; for (let d = d0; d <= t; d = addDays(d, 1)) all.push(d);
  const days = all.slice(-win);
  const by = k => { const o = {}; wl.forEach(w => { if (num(w[k]) != null) o[w.fecha] = num(w[k]); }); return o; };
  const hrv = by("hrv"), fc = by("fc"), sh = by("sueno_h"), wi = {}; wl.forEach(w => { const v = wellIdx(w); if (v != null) wi[w.fecha] = v; });
  // HRV: línea base de 60 días con ln(HRV) ± 0,5 DE (necesita 14 días con dato)
  const hrv7 = rolling(all, hrv, 7), band = {};
  all.forEach((d, i) => { const prev = all.slice(Math.max(0, i - 60), i).map(x => hrv[x]).filter(x => x != null && x > 0).map(Math.log); if (prev.length >= 14) { const m = meanOf(prev), sd = sdOf(prev); band[d] = [Math.exp(m - 0.5 * sd), Math.exp(m + 0.5 * sd)]; } });
  const fc7 = rolling(all, fc, 7), fcBase = {}; all.forEach((d, i) => { const prev = all.slice(Math.max(0, i - 30), i).map(x => fc[x]).filter(x => x != null); if (prev.length >= 10) { const m = meanOf(prev), sd = sdOf(prev) || 1; fcBase[d] = [m - sd, m + sd]; } });
  const wi7 = rolling(all, wi, 7);
  // Carga interna (RPE de sesión × minutos, Foster)
  const load = {}; wo.forEach(w => { if (w.rpe_sesion != null && w.duracion_min) load[w.fecha] = (load[w.fecha] || 0) + w.rpe_sesion * w.duracion_min; });
  const sumR = (end, n) => { let s = 0; for (let k = 0; k < n; k++) s += load[addDays(end, -k)] || 0; return s; };
  const acwr = {}; all.forEach(d => { const ch = sumR(d, 28) / 4; if (ch > 0 && Object.keys(load).some(x => x <= addDays(d, -21))) acwr[d] = sumR(d, 7) / ch; });
  const lastW = Array.from({ length: 7 }, (_, k) => load[addDays(t, -k)] || 0), mono = sdOf(lastW) ? meanOf(lastW) / sdOf(lastW) : null, strain = mono ? lastW.reduce((a, b) => a + b, 0) * mono : null;
  // Alertas
  const al = [], ok = [];
  const lastIn = o => { for (let k = 0; k < 4; k++) { const d = addDays(t, -k); if (o[d] != null) return { d, v: o[d] }; } return null; };
  const h7 = lastIn(hrv7); if (h7 && band[h7.d]) { if (h7.v < band[h7.d][0]) al.push(`HRV media 7 días ${fmt(h7.v)} ms por debajo de su rango normal (${fmt(band[h7.d][0])}–${fmt(band[h7.d][1])}): posible fatiga acumulada, estrés o enfermedad.`); else ok.push(`HRV dentro de su rango normal (${fmt(h7.v)} ms).`); } else if (Object.keys(hrv).length) ok.push("HRV: hacen falta 14 días con dato para calcular su rango normal.");
  const f7 = lastIn(fc7); if (f7 && fcBase[f7.d]) { if (f7.v > fcBase[f7.d][1]) al.push(`FC en reposo media ${fmt(f7.v)} lpm, más alta de lo habitual (${fmt(fcBase[f7.d][0])}–${fmt(fcBase[f7.d][1])}).`); else ok.push(`FC en reposo normal (${fmt(f7.v)} lpm).`); }
  const w7 = lastIn(wi7); const w28 = meanOf(all.slice(-28).map(d => wi[d]).filter(x => x != null)); if (w7 && w28) { if (w7.v < w28 - 0.4) al.push(`Bienestar de la última semana (${fmt(w7.v, 2)}) por debajo de su media de 4 semanas (${fmt(w28, 2)}).`); else ok.push(`Bienestar estable (${fmt(w7.v, 2)} de 5).`); }
  const s7 = meanOf(all.slice(-7).map(d => sh[d]).filter(x => x != null)); if (s7 != null) (s7 < 7 ? al : ok).push(`Sueño medio de la última semana: ${fmt(s7)} h${s7 < 7 ? " (por debajo de 7 h)" : ""}.`);
  const ac = lastIn(acwr); if (ac) { if (ac.v > 1.5) al.push(`Ratio de carga aguda:crónica ${fmt(ac.v, 2)}: subida brusca de carga (riesgo por encima de 1,5).`); else if (ac.v < 0.8) al.push(`Ratio de carga aguda:crónica ${fmt(ac.v, 2)}: está entrenando bastante menos de lo habitual.`); else ok.push(`Carga bien progresada (ratio agudo:crónico ${fmt(ac.v, 2)}).`); }
  if (mono != null && mono > 2) al.push(`Monotonía alta (${fmt(mono, 1)}): cargas muy parecidas todos los días; alterna días duros y suaves.`);
  const mol = wl.filter(w => w.molestia_zona && w.fecha >= addDays(t, -14)); if (mol.length) al.push(`Molestias en los últimos 14 días: ${mol.map(m => `${m.molestia_zona} ${m.molestia_0a10 ?? "?"}/10 (${fdate(m.fecha)})`).join(" · ")}.`);
  // Mapa de calor del cuestionario
  const IT = [...WK.map(([k, l]) => [k, l]), ["apetito", "Apetito (3 = óptimo)"]];
  const hd = days.slice(-28);
  const col = (k, v) => { if (v == null) return "transparent"; const sc = k === "apetito" ? 5 - Math.abs(v - 3) * 2 : v; return ["#e5484d", "#f08c4b", "#f2c94c", "#8fcf6b", "#2f9e6e"][Math.max(0, Math.min(4, Math.round(sc) - 1))]; };
  const heat = `<div class="heat" style="--n:${hd.length}"><span></span>${hd.map(d => `<span class="hdd">${dow(d) === 1 ? esc(fdate(d)) : ""}</span>`).join("")}${IT.map(([k, l]) => `<span class="hl2">${esc(l)}</span>${hd.map(d => { const w = wl.find(x => x.fecha === d); const v = w ? num(w[k]) : null; return `<span class="hc" style="background:${col(k, v)}" title="${esc(fdate(d, { weekday: "short", day: "numeric", month: "short" }) + " · " + l + ": " + (v ?? "—"))}">${v ?? ""}</span>`; }).join("")}`).join("")}</div>`;
  const W = [[28, "4 semanas"], [42, "6 semanas"], [84, "12 semanas"], [120, "4 meses"]];
  return `<div class="row" style="flex-wrap:wrap"><div class="subtabs">${W.map(([n, l]) => `<button data-act="rec-w" data-n="${n}" aria-current="${win === n}">${l}</button>`).join("")}</div><span class="grow"></span><span class="tiny muted">Pasa el ratón por las gráficas para ver cada día.</span></div>
  ${al.length || ok.length ? `<div class="card"><h2 class="hh">${ICON.evo}Estado de recuperación</h2>${al.map(a => `<div class="alr bad">⚠ ${esc(a)}</div>`).join("")}${ok.map(a => `<div class="alr ok">✓ ${esc(a)}</div>`).join("")}</div>` : ""}
  <div class="cols2">
  <div class="card"><h2>HRV / VFC <small>ms</small></h2>${multiChart(days, [{ name: "HRV", color: "#2b7de9", v: hrv, w: 1.4, dots: true }, { name: "Media 7 días", color: "#173f8a", v: hrv7, w: 2.6 }], { band, bandName: "Rango normal (60 días)", empty: "Sin datos de HRV" })}<p class="tiny muted">Lo que cuenta es la media de 7 días frente a su rango normal (media de 60 días ± 0,5 desviaciones sobre el logaritmo). Por debajo del rango de forma mantenida = peor recuperación.</p></div>
  <div class="card"><h2>FC en reposo <small>lpm</small></h2>${multiChart(days, [{ name: "FC", color: "#e5484d", v: fc, w: 1.4, dots: true }, { name: "Media 7 días", color: "#8c1d22", v: fc7, w: 2.6 }], { band: fcBase, bandName: "Habitual (30 días ± 1 DE)", empty: "Sin datos de FC en reposo" })}<p class="tiny muted">Si sube de forma mantenida por encima de lo habitual suele indicar fatiga, estrés, mal sueño o que se está poniendo malo.</p></div>
  <div class="card"><h2>Sueño <small>horas</small></h2>${multiChart(days, [{ name: "Horas", color: "#7c5cff", v: sh, dec: 1 }], { bars: true, ref: 7, refName: "7 h", yMin: 0, yMax: Math.max(10, ...Object.values(sh)), barColor: v => v < 6 ? "#e5484d" : v < 7 ? "#f2c94c" : "#7c5cff", dec: 1, empty: "Sin datos de sueño" })}</div>
  <div class="card"><h2>Bienestar general <small>1–5</small></h2>${multiChart(days, [{ name: "Bienestar", color: "#2f9e6e", v: wi, w: 1.4, dots: true, dec: 2 }, { name: "Media 7 días", color: "#16603f", v: wi7, w: 2.6, dec: 2 }], { yMin: 1, yMax: 5, dec: 1, empty: "Sin cuestionarios" })}</div>
  <div class="card"><h2>Carga interna <small>RPE × minutos</small></h2>${multiChart(days, [{ name: "Carga", color: "#f39c12", v: load }], { bars: true, yMin: 0, empty: "Hace falta que registre dureza y minutos al terminar los entrenos" })}<div class="kpis"><div class="kpi"><span>Carga 7 días</span><b>${fmt(sumR(t, 7), 0)}</b><em>UA</em></div><div class="kpi"><span>Media semanal (28 d)</span><b>${fmt(sumR(t, 28) / 4, 0)}</b><em>UA</em></div><div class="kpi"><span>Monotonía</span><b>${mono != null ? fmt(mono, 1) : "—"}</b><em>&gt; 2 = poco variada</em></div><div class="kpi"><span>Strain</span><b>${strain != null ? fmt(strain, 0) : "—"}</b><em>carga × monotonía</em></div></div></div>
  <div class="card"><h2>Ratio agudo:crónico</h2>${multiChart(days, [{ name: "ACWR", color: "#22242f", v: acwr, dec: 2 }], { yMin: 0, yMax: 2.2, dec: 1, band: Object.fromEntries(days.map(d => [d, [0.8, 1.3]])), bandName: "Zona óptima 0,8–1,3", ref: 1.5, refName: "Riesgo > 1,5", empty: "Hacen falta 3–4 semanas de entrenos con dureza registrada" })}</div>
  </div>
  <div class="card"><h2>Cuestionario diario <small>últimos 28 días · 5 = mejor</small></h2>${heat}</div>`;
}

/* ================= Nutrición ================= */
const go = h => { if (location.hash === "#" + h) route(); else location.hash = h; };
async function signedUrls(paths) { const out = {}; const ps = paths.filter(Boolean); if (ps.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ps, 600); (data || []).forEach(d => { if (d.signedUrl) out[d.path] = d.signedUrl; }); } return out; }
// Todo por 100 g en la base; las cantidades del plan van en gramos.
const r1 = v => Math.round(v * 10) / 10, r0 = v => Math.round(v);
const macroOf = (f, g) => ({ kcal: (+f.kcal || 0) * g / 100, prot: (+f.prot || 0) * g / 100, hc: (+f.hc || 0) * g / 100, grasa: (+f.grasa || 0) * g / 100 });
const sumM = arr => arr.reduce((a, m) => ({ kcal: a.kcal + (m.kcal || 0), prot: a.prot + (m.prot || 0), hc: a.hc + (m.hc || 0), grasa: a.grasa + (m.grasa || 0) }), { kcal: 0, prot: 0, hc: 0, grasa: 0 });
const mTxt = m => `${r0(m.kcal)} kcal · P ${r0(m.prot)} g · HC ${r0(m.hc)} g · G ${r0(m.grasa)} g`;
const mBar = (m, obj) => obj && obj.kcal ? `<div class="mbar">${[["kcal", "kcal", ""], ["prot", "Proteína", "g"], ["hc", "Hidratos", "g"], ["grasa", "Grasa", "g"]].map(([k, l, u]) => { const pc = obj[k] ? Math.min(140, 100 * m[k] / obj[k]) : 0; return `<div><span>${l}</span><b>${r0(m[k])}${u ? " " + u : ""} <small>/ ${r0(obj[k] || 0)}</small></b><i style="--p:${Math.min(100, pc)}%" class="${pc > 110 ? "over" : pc < 90 ? "under" : "okk"}"></i></div>`; }).join("")}</div>` : "";
const COMIDAS = ["Desayuno", "Media mañana", "Comida", "Merienda", "Cena", "Pre-entreno", "Post-entreno", "Antes de dormir"];
const N = { foods: {}, recipes: {} };
async function foodsById(ids) {
  const need = [...new Set(ids.filter(id => id && !N.foods[id]))];
  for (let i = 0; i < need.length; i += 100) { const rows = await q(sb.from("foods").select("*").in("id", need.slice(i, i + 100))); rows.forEach(f => N.foods[f.id] = f); }
}
async function recipesById(ids) {
  const need = [...new Set(ids.filter(id => id && !N.recipes[id]))];
  if (need.length) (await q(sb.from("recipes").select("*").in("id", need))).forEach(r => N.recipes[r.id] = r);
  await foodsById(Object.values(N.recipes).flatMap(r => (r.ingredientes || []).map(i => i.food_id)));
}
function recipeMacros(r) { return sumM((r.ingredientes || []).map(i => N.foods[i.food_id] ? macroOf(N.foods[i.food_id], +i.g || 0) : { kcal: 0, prot: 0, hc: 0, grasa: 0 })); }
function itemMacros(it) {
  if (it.receta_id && N.recipes[it.receta_id]) { const r = N.recipes[it.receta_id]; const tot = recipeMacros(r); const k = (+it.raciones || 1) / (+r.raciones || 1); return { kcal: tot.kcal * k, prot: tot.prot * k, hc: tot.hc * k, grasa: tot.grasa * k }; }
  if (it.food_id && N.foods[it.food_id]) return macroOf(N.foods[it.food_id], +it.g || 0);
  return { kcal: +it.kcal || 0, prot: +it.prot || 0, hc: +it.hc || 0, grasa: +it.grasa || 0 };
}
const optMacros = o => sumM((o.items || []).map(itemMacros));
async function preloadPlan(n) {
  const its = (n.comidas || []).flatMap(c => (c.opciones || []).flatMap(o => o.items || []));
  await foodsById(its.map(i => i.food_id)); await recipesById(its.map(i => i.receta_id));
}
async function signedRecetas(paths) { const out = {}; const ps = paths.filter(Boolean); if (ps.length) { const { data } = await sb.storage.from("recetas").createSignedUrls(ps, 3600); (data || []).forEach(d => { if (d.signedUrl) out[d.path] = d.signedUrl; }); } return out; }
const itemName = it => it.receta_id && N.recipes[it.receta_id] ? N.recipes[it.receta_id].nombre : it.food_id && N.foods[it.food_id] ? N.foods[it.food_id].nombre + (N.foods[it.food_id].marca ? ` (${N.foods[it.food_id].marca})` : "") : it.nombre || "";
const itemQty = it => it.receta_id ? `${fmt(+it.raciones || 1)} ración${(+it.raciones || 1) === 1 ? "" : "es"}` : `${fmt(+it.g || 0, 0)} g en crudo${it.food_id && N.foods[it.food_id] && N.foods[it.food_id].racion_g && it.g ? ` (≈ ${fmt((+it.g) / N.foods[it.food_id].racion_g, 1)} × ${esc(N.foods[it.food_id].racion_nombre || "ración")})` : ""}`;

/* ---------- Calculadora (método factorial) ---------- */
function calcKcal(c) {
  const w = +c.peso || 0, h = +c.altura || 0, a = +c.edad || 0, bf = num(c.grasa);
  const mifflin = w && h && a ? 10 * w + 6.25 * h - 5 * a + (c.sexo === "m" ? -161 : 5) : null;
  const katch = bf != null && w ? 370 + 21.6 * w * (1 - bf / 100) : null;
  const bmr = c.metodo === "katch" && katch ? katch : c.metodo === "media" && katch && mifflin ? (katch + mifflin) / 2 : mifflin || katch;
  if (!bmr) return null;
  const base = bmr * (c.trabajo === "fisico" ? 1.35 : c.trabajo === "pie" ? 1.27 : 1.2); // incluye termogénesis de los alimentos y actividad mínima (~3.000 pasos)
  const pasos = Math.max(0, (+c.pasos || 0) - 3000) * 0.00057 * w;            // NEAT por pasos por encima de la base
  const met = c.intensidad === "alta" ? 6 : c.intensidad === "baja" ? 3.5 : 5;  // fuerza: MET (Compendium)
  const ent = (met - 1) * w * ((+c.min || 0) / 60) * (+c.dias || 0) / 7;        // gasto neto medio por día
  const card = (((+c.cardio_met || 0) - 1) * w * ((+c.cardio_min || 0) / 60)) / 7; // cardio semanal
  const tdee = base + pasos + ent + Math.max(0, card);
  const ajuste = c.modo === "kg" ? (+c.kg_sem || 0) * 7700 / 7 : tdee * (+c.pct || 0) / 100;
  const kcal = tdee + ajuste;
  const lbm = bf != null ? w * (1 - bf / 100) : null;
  let prot, grasa, hc;
  if (c.reparto === "pct") { prot = kcal * (+c.p_pct || 0) / 100 / 4; hc = kcal * (+c.hc_pct || 0) / 100 / 4; grasa = kcal * (+c.g_pct || 0) / 100 / 9; }
  else { prot = (+c.p_gkg || 0) * (c.p_base === "lbm" && lbm ? lbm : w); grasa = (+c.g_gkg || 0) * w; hc = Math.max(0, (kcal - prot * 4 - grasa * 9) / 4); }
  return { mifflin, katch, bmr, base, pasos, ent, card: Math.max(0, card), tdee, ajuste, kcal, prot, hc, grasa, lbm };
}
const CALC_DEF = { sexo: "h", edad: "", altura: "", peso: "", grasa: "", metodo: "mifflin", trabajo: "sentado", pasos: 8000, dias: 4, min: 60, intensidad: "media", cardio_min: 0, cardio_met: 7, modo: "pct", pct: 0, kg_sem: -0.4, reparto: "gkg", p_gkg: 2, p_base: "peso", g_gkg: 0.9, p_pct: 30, hc_pct: 45, g_pct: 25 };
function calcForm(c) {
  const sel = (n, opts, l) => `<div class="f"><label>${l}</label><select name="${n}" data-calc>${opts.map(([v, t]) => `<option value="${v}" ${String(c[n]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  const inp = (n, l, ph = "") => `<div class="f"><label>${l}</label><input name="${n}" data-calc inputmode="decimal" value="${esc(c[n] ?? "")}" placeholder="${ph}"></div>`;
  return `<form id="f-calc" class="calc"><div class="card"><h2 class="hh">${ICON.info}Datos</h2><div class="grid4">${sel("sexo", [["h", "Hombre"], ["m", "Mujer"]], "Sexo")}${inp("edad", "Edad")}${inp("altura", "Altura (cm)")}${inp("peso", "Peso (kg)", "media semanal")}${inp("grasa", "% de grasa (opcional)")}${sel("metodo", [["mifflin", "Mifflin-St Jeor"], ["katch", "Katch-McArdle (con % grasa)"], ["media", "Media de ambas"]], "Fórmula del metabolismo basal")}${sel("trabajo", [["sentado", "Sentado la mayor parte"], ["pie", "De pie / se mueve"], ["fisico", "Trabajo físico"]], "Trabajo")}${inp("pasos", "Pasos al día (media)")}</div></div>
  <div class="card"><h2 class="hh">${ICON.entreno}Entrenamiento</h2><div class="grid4">${inp("dias", "Días de fuerza / semana")}${inp("min", "Minutos por sesión")}${sel("intensidad", [["baja", "Baja (técnica, descansos largos)"], ["media", "Media"], ["alta", "Alta (superseries, poco descanso)"]], "Intensidad")}${inp("cardio_min", "Cardio: min / semana")}${sel("cardio_met", [[4, "Suave (caminar rápido)"], [7, "Moderado (zona 2, bici)"], [10, "Intenso (carrera, HIIT)"]], "Cardio: intensidad")}</div></div>
  <div class="card"><h2 class="hh">${ICON.progreso}Objetivo y reparto</h2><div class="grid4">${sel("modo", [["pct", "% sobre mantenimiento"], ["kg", "Kg por semana"]], "Ajuste")}${c.modo === "kg" ? inp("kg_sem", "Kg / semana (− pierde, + gana)") : inp("pct", "% (−20 definición · +10 volumen)")}${sel("reparto", [["gkg", "Gramos por kg"], ["pct", "Porcentajes"]], "Reparto de macros")}
  ${c.reparto === "pct" ? `${inp("p_pct", "% proteína")}${inp("hc_pct", "% hidratos")}${inp("g_pct", "% grasa")}` : `${inp("p_gkg", "Proteína (g/kg)")}${sel("p_base", [["peso", "sobre peso total"], ["lbm", "sobre masa magra"]], "Proteína calculada")}${inp("g_gkg", "Grasa (g/kg)")}<div class="f"><label>Hidratos</label><input disabled value="El resto de las kcal"></div>`}</div></div></form>`;
}
function calcResult(c, plan) {
  const r = calcKcal(c); if (!r) return `<div class="card"><p class="small muted" style="margin:0">Rellena edad, altura y peso para calcular.</p></div>`;
  const pcts = r.kcal ? [r.prot * 4, r.hc * 4, r.grasa * 9].map(x => r0(100 * x / r.kcal)) : [0, 0, 0];
  const warn = [];
  if (r.prot / (+c.peso) < 1.4) warn.push("Proteína por debajo de 1,4 g/kg: poco para ganar o mantener músculo.");
  if (r.grasa / (+c.peso) < 0.5 || pcts[2] < 20) warn.push("Grasa muy baja (menos de 0,5 g/kg o del 20 %): puede afectar a las hormonas.");
  if (c.reparto === "pct" && Math.abs((+c.p_pct) + (+c.hc_pct) + (+c.g_pct) - 100) > 0.5) warn.push("Los porcentajes no suman 100 %.");
  if (r.kcal < r.bmr) warn.push("El objetivo está por debajo del metabolismo basal: déficit demasiado agresivo.");
  return `<div class="card res"><h2 class="hh">${ICON.evo}Resultado</h2>
  <div class="kpis"><div class="kpi"><span>Metabolismo basal</span><b>${r0(r.bmr)} kcal</b><em>Mifflin ${r.mifflin ? r0(r.mifflin) : "—"} · Katch ${r.katch ? r0(r.katch) : "—"}</em></div><div class="kpi"><span>Mantenimiento</span><b>${r0(r.tdee)} kcal</b><em>gasto total estimado</em></div><div class="kpi acc"><span>Objetivo</span><b>${r0(r.kcal)} kcal</b><em>${r.ajuste >= 0 ? "+" : ""}${r0(r.ajuste)} kcal/día</em></div><div class="kpi"><span>Cambio esperado</span><b>${fmt(r.ajuste * 7 / 7700, 2)} kg/sem</b><em>aproximado</em></div></div>
  <table class="htable"><tbody><tr><td>Basal + digestión + vida diaria (${c.trabajo === "fisico" ? "×1,35" : c.trabajo === "pie" ? "×1,27" : "×1,2"})</td><td class="n">${r0(r.base)} kcal</td></tr><tr><td>Pasos por encima de 3.000</td><td class="n">${r0(r.pasos)} kcal</td></tr><tr><td>Entrenamiento de fuerza (media diaria)</td><td class="n">${r0(r.ent)} kcal</td></tr><tr><td>Cardio (media diaria)</td><td class="n">${r0(r.card)} kcal</td></tr></tbody></table>
  <div class="macros"><div><span>Proteína</span><b>${r0(r.prot)} g</b><em>${fmt(r.prot / (+c.peso), 1)} g/kg · ${pcts[0]} %</em></div><div><span>Hidratos</span><b>${r0(r.hc)} g</b><em>${fmt(r.hc / (+c.peso), 1)} g/kg · ${pcts[1]} %</em></div><div><span>Grasa</span><b>${r0(r.grasa)} g</b><em>${fmt(r.grasa / (+c.peso), 1)} g/kg · ${pcts[2]} %</em></div></div>
  ${warn.length ? `<div class="banner">${warn.map(esc).join("<br>")}</div>` : ""}
  <p class="tiny muted">Estimación con método factorial: basal (Mifflin-St Jeor o Katch-McArdle) + actividad diaria + pasos + entrenamiento (MET). Ningún cálculo es exacto: ajústalo con la evolución real del peso medio semanal durante 2–3 semanas.</p>
  <div class="row"><button class="btn pri" data-act="n-calc-apply">Usar como objetivo del plan</button>${plan && plan.objetivo ? `<span class="tiny muted">Objetivo actual: ${esc(mTxt(plan.objetivo))}</span>` : ""}</div></div>`;
}

/* ---------- Entrenador: pestaña Nutrición ---------- */
async function tabNutri(c, pl) {
  const n = pl.nutricion || {}; const sub = S.coach.nsub || "plan"; N.plan = JSON.parse(JSON.stringify(n)); N.plan.comidas = N.plan.comidas || []; N.cid = c.id;
  let body = "";
  if (sub === "plan") { await preloadPlan(N.plan); body = planEditorHTML(); }
  else if (sub === "calc") {
    const f = c.ficha || {}; const lastW = (await q(sb.from("weights").select("kg").eq("client_id", c.id).order("fecha", { ascending: false }).limit(7))).map(x => +x.kg);
    N.calc = { ...CALC_DEF, peso: lastW.length ? r1(avg(lastW)) : (f.pesoInicial || ""), altura: num(String(f.altura || "").replace(/[^\d,.]/g, "").replace(",", ".")) ? (num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", ".")) < 3 ? r0(num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", ".")) * 100) : num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", "."))) : "", edad: num(String(f.edad || "").match(/\d+/)) || "", ...(n.calc || {}) };
    body = `<div class="calcwrap">${calcForm(N.calc)}<div id="calc-res">${calcResult(N.calc, n)}</div></div>`;
  } else if (sub === "habitos") body = habitosHTML(pl);
  else {
    const logs = await q(sb.from("meal_logs").select("*").eq("client_id", c.id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(60));
    const urls = await signedUrls(logs.map(l => l.foto_path).filter(Boolean));
    body = logs.length ? `<div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Fecha</th><th>Comida</th><th>Qué tomó</th><th>Comentario</th><th>Foto</th></tr></thead><tbody>${logs.map(l => `<tr><td>${esc(fdate(l.fecha))}</td><td>${esc(l.comida)}</td><td>${l.cumplido ? `<span class="chip ok">${esc(l.opcion || "Según el plan")}</span>` : `<span class="chip warn">Otra cosa</span>`}</td><td class="tiny">${esc(l.comentario)}</td><td>${l.foto_path && urls[l.foto_path] ? `<a href="${esc(urls[l.foto_path])}" target="_blank" rel="noopener"><img class="thumb" src="${esc(urls[l.foto_path])}" alt="Foto de ${esc(l.comida)}"></a>` : ""}</td></tr>`).join("")}</tbody></table></div></div>` : `<div class="empty">El cliente aún no ha registrado comidas. El registro es opcional para él.</div>`;
  }
  const subs = [["plan", "Plan de comidas"], ["calc", "Calculadora"], ["habitos", "Hábitos y pautas"], ["registro", "Registro del cliente"]];
  return `<div class="seg" role="group" aria-label="Nutrición">${subs.map(([k, l]) => `<button data-act="n-sub" data-t="${k}" aria-pressed="${sub === k}">${l}</button>`).join("")}</div>${body}`;
}
function habitosHTML(pl) {
  const n = pl.nutricion || {};
  return `<form id="f-nutri" style="display:flex;flex-direction:column;gap:12px">
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Hábitos <small>los ve en Hoy y en Nutrición</small></h2><textarea name="habitos" placeholder="Uno por línea: Dormir 7–8 h · 10.000 pasos · 2 L de agua">${esc((pl.habitos || []).join("\n"))}</textarea></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Pautas generales</h2><div class="f"><label>Título</label><input name="titulo" value="${esc(n.titulo || "")}" placeholder="Pautas de alimentación"></div><div class="f"><label>Introducción</label><textarea name="notas">${esc(n.notas || "")}</textarea></div>
  <div id="secs" style="display:flex;flex-direction:column;gap:8px">${(n.secciones || []).map(secRow).join("")}</div><button type="button" class="btn sm" data-act="sec-add">+ Sección</button></div>
  <button class="btn pri block">Guardar hábitos y pautas</button></form>`;
}
async function saveNutri(f) {
  const secciones = [...f.querySelectorAll("[data-s]")].map(s => ({ titulo: s.querySelector('[name="s_t"]').value.trim(), items: lines(s.querySelector('[name="s_i"]').value) })).filter(s => s.titulo || s.items.length);
  const pl = (await q(sb.from("plans").select("nutricion").eq("client_id", S.coach.cid).limit(1)))[0] || {};
  const nutricion = { ...(pl.nutricion || {}), titulo: f.titulo.value.trim(), notas: f.notas.value.trim(), secciones };
  try { await q(sb.from("plans").upsert({ client_id: S.coach.cid, habitos: lines(f.habitos.value), nutricion }, { onConflict: "client_id" })); toast("Guardado"); } catch (e) { toast(errMsg(e)); }
}
function planEditorHTML() {
  const n = N.plan; const obj = n.objetivo;
  const day = sumM((n.comidas || []).map(cm => cm.opciones && cm.opciones[0] ? optMacros(cm.opciones[0]) : { kcal: 0, prot: 0, hc: 0, grasa: 0 }));
  return `<div class="card"><div class="row" style="flex-wrap:wrap"><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-n="activo" ${n.activo ? "checked" : ""}> Plan visible para el cliente</label><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-n="mostrar_objetivo" ${n.mostrar_objetivo !== false ? "checked" : ""}> Mostrarle sus kcal y macros</label><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-n="registro" ${n.registro !== false ? "checked" : ""}> Permitir que registre lo que come (opcional para él)</label><span class="grow"></span><button class="btn pri" data-act="n-save">Guardar plan</button></div>
  ${obj ? `<div class="objline"><b>Objetivo:</b> ${esc(mTxt(obj))} <button class="btn ghost sm" data-act="n-sub" data-t="calc">Cambiar en la calculadora</button></div>${mBar(day, obj)}<p class="tiny muted" style="margin:4px 0 0">Total del día sumando la opción 1 de cada comida. Todas las cantidades van en crudo.</p>` : `<div class="objline">Sin objetivo de kcal. <button class="btn sm" data-act="n-sub" data-t="calc">Calcular</button></div>`}</div>
  ${(n.comidas || []).map((cm, ci) => comidaHTML(cm, ci, obj)).join("")}
  <div class="row" style="flex-wrap:wrap"><select id="n-new-comida" aria-label="Comida a añadir">${COMIDAS.map(x => `<option>${x}</option>`).join("")}<option value="">Otra…</option></select><button class="btn" data-act="n-comida-add">+ Añadir comida</button></div>`;
}
function comidaHTML(cm, ci, obj) {
  const opts = cm.opciones || [];
  return `<div class="card comida"><div class="row"><input class="ctit" value="${esc(cm.nombre)}" data-n-cm="${ci}" aria-label="Nombre de la comida"><input class="chora" value="${esc(cm.hora || "")}" placeholder="Hora (opcional)" data-n-hora="${ci}" aria-label="Hora"><span class="grow"></span><button class="btn ghost sm" data-act="n-cm-up" data-ci="${ci}" aria-label="Subir">↑</button><button class="btn ghost sm" data-act="n-cm-del" data-ci="${ci}">Quitar comida</button></div>
  <div class="opts">${opts.map((o, oi) => { const m = optMacros(o); return `<div class="opt"><div class="row"><input class="otit" value="${esc(o.nombre || `Opción ${oi + 1}`)}" data-n-on="${ci}.${oi}" aria-label="Nombre de la opción"><span class="grow"></span><button class="btn ghost sm" data-act="n-opt-dup" data-k="${ci}.${oi}">Duplicar</button><button class="btn ghost sm" data-act="n-opt-del" data-k="${ci}.${oi}" aria-label="Quitar opción">✕</button></div>
    <div class="items">${(o.items || []).map((it, ii) => `<div class="itm"><span class="grow">${it.receta_id ? `<span class="tag tag-nota">Receta</span> ` : ""}${esc(itemName(it))}</span>${it.receta_id ? `<input class="g" inputmode="decimal" value="${esc(it.raciones || 1)}" data-n-r="${ci}.${oi}.${ii}" aria-label="Raciones"><span class="tiny">rac.</span>` : `<input class="g" inputmode="decimal" value="${esc(it.g || "")}" data-n-g="${ci}.${oi}.${ii}" aria-label="Gramos en crudo"><span class="tiny">g crudo</span>`}<span class="tiny muted mm">${r0(itemMacros(it).kcal)} kcal</span><button class="btn ghost sm" data-act="n-it-del" data-k="${ci}.${oi}.${ii}" aria-label="Quitar">✕</button></div>`).join("") || `<p class="tiny muted" style="margin:4px 0">Sin alimentos todavía.</p>`}</div>
    <div class="fsearch"><input placeholder="Añadir alimento o receta (pollo, avena, Hacendado…)" data-n-search="${ci}.${oi}" aria-label="Buscar alimento"><div class="fres" hidden></div></div>
    <div class="f"><input value="${esc(o.notas || "")}" data-n-notas="${ci}.${oi}" placeholder="Notas de la opción (preparación, alternativas…)" aria-label="Notas"></div>
    <div class="omac"><b>${r0(m.kcal)} kcal</b> · P ${r0(m.prot)} · HC ${r0(m.hc)} · G ${r0(m.grasa)}</div></div>`; }).join("")}
  <button class="btn sm addopt" data-act="n-opt-add" data-ci="${ci}">+ Opción</button></div></div>`;
}
const nGet = k => { const [ci, oi, ii] = k.split(".").map(Number); const cm = N.plan.comidas[ci]; const o = cm && oi != null && !isNaN(oi) ? cm.opciones[oi] : null; return { cm, o, it: o && ii != null && !isNaN(ii) ? o.items[ii] : null, ci, oi, ii }; };
function rerenderPlan() { const y = window.scrollY; const main = $(".cmain"); const seg = main.querySelector(".seg[aria-label='Nutrición']"); while (seg.nextSibling) seg.nextSibling.remove(); seg.insertAdjacentHTML("afterend", planEditorHTML()); window.scrollTo(0, y); }
async function nSearch(input) {
  const qy = input.value.trim(); const box = input.parentElement.querySelector(".fres"); if (qy.length < 2) { box.hidden = true; return; }
  const words = qy.split(/\s+/).filter(Boolean).slice(0, 4);
  let fq = sb.from("foods").select("id,nombre,marca,fuente,kcal,prot,hc,grasa,racion_g,racion_nombre").limit(25);
  words.forEach(w => { fq = fq.or(`nombre.ilike.%${w.replace(/[%,()]/g, "")}%,marca.ilike.%${w.replace(/[%,()]/g, "")}%`); });
  const [fs, rs] = await Promise.all([q(fq), q(sb.from("recipes").select("id,nombre").ilike("nombre", `%${qy.replace(/[%,()]/g, "")}%`).limit(5))]);
  if (input.value.trim() !== qy) return;
  fs.forEach(f => N.foods[f.id] = { ...(N.foods[f.id] || {}), ...f });
  fs.sort((a, b) => (a.fuente === "generico" ? 0 : 1) - (b.fuente === "generico" ? 0 : 1));
  box.innerHTML = [...rs.map(r => `<button type="button" data-act="n-pick" data-rec="${esc(r.id)}" data-k="${esc(input.dataset.nSearch || "rec")}"><span class="tag tag-nota">Receta</span> ${esc(r.nombre)}</button>`), ...fs.map(f => `<button type="button" data-act="n-pick" data-food="${esc(f.id)}" data-k="${esc(input.dataset.nSearch || "rec")}"><span class="grow">${esc(f.nombre)}${f.marca ? ` <span class="muted">· ${esc(f.marca)}</span>` : ""}</span><span class="tiny muted">${r0(f.kcal)} kcal · P ${r1(f.prot)} · HC ${r1(f.hc)} · G ${r1(f.grasa)} /100 g</span></button>`)].join("") || `<p class="tiny muted" style="padding:8px">Sin resultados. Puedes añadirlo en Librería → Alimentos.</p>`;
  box.hidden = false;
}
async function nSavePlan() {
  try { await q(sb.from("plans").upsert({ client_id: N.cid, nutricion: N.plan }, { onConflict: "client_id" })); toast("Plan de nutrición guardado"); } catch (e) { toast(errMsg(e)); }
}

/* ---------- Librería: alimentos y recetas ---------- */
async function libFoodsHTML() {
  const qy = (S.lib.q || "").trim(); const fu = S.lib.fuente || "";
  let fq = sb.from("foods").select("*").order("nombre").limit(200);
  if (fu) fq = fq.eq("fuente", fu);
  qy.split(/\s+/).filter(Boolean).slice(0, 4).forEach(w => { const x = w.replace(/[%,()]/g, ""); fq = fq.or(`nombre.ilike.%${x}%,marca.ilike.%${x}%,categoria.ilike.%${x}%`); });
  const [fs, cnt] = await Promise.all([q(fq), sb.from("foods").select("id", { count: "exact", head: true })]);
  return `<div class="pghead"><h1 class="ptitle">Alimentos <sup>${cnt.count ?? fs.length}</sup></h1></div><div class="row" style="flex-wrap:wrap"><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ex-q" type="search" placeholder="Buscar alimento o marca…" value="${esc(qy)}" aria-label="Buscar"></label><select id="food-fuente" aria-label="Origen"><option value="">Todos</option><option value="mercadona" ${fu === "mercadona" ? "selected" : ""}>Mercadona (Open Food Facts)</option><option value="generico" ${fu === "generico" ? "selected" : ""}>Genéricos</option><option value="propio" ${fu === "propio" ? "selected" : ""}>Añadidos por ti</option></select><span class="grow"></span><button class="btn dark" data-act="food-edit" data-id=""><span class="plus">+</span>Añadir alimento</button></div>
  <div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Alimento</th><th>Origen</th><th class="n">kcal</th><th class="n">Prot.</th><th class="n">HC</th><th class="n">Grasa</th><th>Ración</th></tr></thead><tbody>${fs.map(f => `<tr data-act="food-edit" data-id="${esc(f.id)}"><td><span class="feedn">${f.foto_url ? `<img class="thumb sm" src="${esc(f.foto_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span><span class="lnk">${esc(f.nombre)}</span>${f.marca ? `<div class="tiny muted">${esc(f.marca)}</div>` : ""}</span></span></td><td><span class="tag tag-${f.fuente === "mercadona" ? "workout" : f.fuente === "generico" ? "tarea" : "nota"}">${f.fuente === "mercadona" ? "Mercadona" : f.fuente === "generico" ? "Genérico" : "Propio"}</span></td><td class="n">${r0(f.kcal)}</td><td class="n">${r1(f.prot)}</td><td class="n">${r1(f.hc)}</td><td class="n">${r1(f.grasa)}</td><td class="tiny">${f.racion_g ? `${fmt(f.racion_g, 0)} g${f.racion_nombre ? " · " + esc(f.racion_nombre) : ""}` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Sin resultados.</td></tr>`}</tbody></table></div></div><p class="tiny muted">Valores por 100 g. Los productos de Mercadona vienen de Open Food Facts (base pública que rellenan los usuarios a partir de las etiquetas): revisa los que uses a menudo. Se muestran hasta 200 resultados: usa el buscador.</p>`;
}
async function openFood(id) {
  const f = id ? (await q(sb.from("foods").select("*").eq("id", id).limit(1)))[0] : { fuente: "propio" };
  sheet(`<h2>${id ? "Editar alimento" : "Nuevo alimento"}</h2><form id="f-food" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Nombre</label><input name="nombre" required value="${esc(f.nombre || "")}"></div><div class="f"><label>Marca</label><input name="marca" value="${esc(f.marca || "")}" placeholder="Hacendado"></div></div>
  <div class="small" style="font-weight:700">Por 100 g</div><div class="grid4"><div class="f"><label>kcal</label><input name="kcal" inputmode="decimal" required value="${esc(f.kcal ?? "")}"></div><div class="f"><label>Proteína (g)</label><input name="prot" inputmode="decimal" value="${esc(f.prot ?? "")}"></div><div class="f"><label>Hidratos (g)</label><input name="hc" inputmode="decimal" value="${esc(f.hc ?? "")}"></div><div class="f"><label>Grasa (g)</label><input name="grasa" inputmode="decimal" value="${esc(f.grasa ?? "")}"></div><div class="f"><label>Fibra (g)</label><input name="fibra" inputmode="decimal" value="${esc(f.fibra ?? "")}"></div><div class="f"><label>Ración (g)</label><input name="racion_g" inputmode="decimal" value="${esc(f.racion_g ?? "")}"></div><div class="f"><label>Nombre de la ración</label><input name="racion_nombre" value="${esc(f.racion_nombre || "")}" placeholder="1 yogur"></div><div class="f"><label>Categoría</label><input name="categoria" value="${esc(f.categoria || "")}"></div></div>
  <p class="tiny muted" style="margin:0" id="food-chk"></p>
  <div class="row"><button class="btn pri">Guardar</button>${id ? `<button type="button" class="btn sm" data-act="food-dup" data-id="${esc(id)}">Duplicar como propio</button><span class="grow"></span><button type="button" class="btn ghost sm bad" data-act="food-del" data-id="${esc(id)}">Borrar</button>` : ""}</div></form>`);
  foodCheck();
}
function foodCheck() { const f = $("#f-food"); if (!f) return; const k = num(f.kcal.value), calc = 4 * (num(f.prot.value) || 0) + 4 * (num(f.hc.value) || 0) + 9 * (num(f.grasa.value) || 0); const el = $("#food-chk"); el.textContent = k ? `Comprobación: las macros suman ${r0(calc)} kcal frente a ${r0(k)} declaradas${Math.abs(calc - k) > Math.max(25, k * 0.15) ? " — revisa los valores" : " ✓"}` : ""; }
async function saveFood(f) {
  const row = { nombre: f.nombre.value.trim(), marca: f.marca.value.trim(), kcal: num(f.kcal.value) || 0, prot: num(f.prot.value) || 0, hc: num(f.hc.value) || 0, grasa: num(f.grasa.value) || 0, fibra: num(f.fibra.value), racion_g: num(f.racion_g.value), racion_nombre: f.racion_nombre.value.trim(), categoria: f.categoria.value.trim() };
  try { if (f.dataset.id) await q(sb.from("foods").update(row).eq("id", f.dataset.id)); else await q(sb.from("foods").insert({ ...row, fuente: "propio" })); delete N.foods[f.dataset.id]; sheet(""); toast("Alimento guardado"); viewLib(); } catch (e) { toast(errMsg(e)); }
}
async function libRecipesHTML() {
  const rs = await q(sb.from("recipes").select("*").order("nombre")); await recipesById(rs.map(r => r.id)); rs.forEach(r => N.recipes[r.id] = r);
  const urls = await signedRecetas(rs.map(r => r.foto_path));
  return `<div class="pghead"><h1 class="ptitle">Recetas <sup>${rs.length}</sup></h1><span class="grow"></span><button class="btn dark" data-act="rec-new"><span class="plus">+</span>Añadir receta</button></div>
  <div class="grid-cards">${rs.map(r => { const m = recipeMacros(r), k = 1 / (+r.raciones || 1); return `<button class="card tcard rcard" data-act="go" data-h="lib-r-${esc(r.id)}">${r.foto_path && urls[r.foto_path] ? `<img src="${esc(urls[r.foto_path])}" alt="" loading="lazy">` : `<span class="noimg">${ICON.nutri}</span>`}<b>${esc(r.nombre)}</b><span class="tiny muted">${r0(m.kcal * k)} kcal · P ${r0(m.prot * k)} · HC ${r0(m.hc * k)} · G ${r0(m.grasa * k)} por ración</span></button>`; }).join("") || `<p class="small muted">Aún no hay recetas.</p>`}</div>`;
}
async function viewLibRecipe(id) {
  loading("Receta");
  const r = (await q(sb.from("recipes").select("*").eq("id", id).limit(1)))[0]; if (!r) { go("lib"); return; }
  N.recipes[r.id] = r; N.rec = JSON.parse(JSON.stringify(r)); await foodsById((r.ingredientes || []).map(i => i.food_id));
  renderRecipe();
}
async function renderRecipe() {
  const r = N.rec; const urls = await signedRecetas([r.foto_path]); const m = sumM((r.ingredientes || []).map(i => N.foods[i.food_id] ? macroOf(N.foods[i.food_id], +i.g || 0) : { kcal: 0, prot: 0, hc: 0, grasa: 0 })); const k = 1 / (+r.raciones || 1);
  shell(r.nombre, `<form id="f-rec" style="display:flex;flex-direction:column;gap:12px"><div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="grid3"><div class="f"><label>Nombre</label><input name="nombre" value="${esc(r.nombre)}" required></div><div class="f"><label>Raciones que salen</label><input name="raciones" inputmode="decimal" value="${esc(r.raciones)}"></div><div class="f"><label>Foto</label><input name="foto" type="file" accept="image/*"></div></div>
  ${r.foto_path && urls[r.foto_path] ? `<img class="recimg" src="${esc(urls[r.foto_path])}" alt="Foto de ${esc(r.nombre)}">` : ""}
  <div class="small" style="font-weight:700">Ingredientes (receta completa, pesados en crudo)</div><div class="items">${(r.ingredientes || []).map((i, ii) => `<div class="itm"><span class="grow">${esc(N.foods[i.food_id] ? N.foods[i.food_id].nombre + (N.foods[i.food_id].marca ? " (" + N.foods[i.food_id].marca + ")" : "") : i.nombre || "?")}</span><input class="g" inputmode="decimal" value="${esc(i.g)}" data-rec-g="${ii}" aria-label="Gramos en crudo"><span class="tiny">g crudo</span><button type="button" class="btn ghost sm" data-act="rec-ing-del" data-i="${ii}" aria-label="Quitar">✕</button></div>`).join("") || `<p class="tiny muted">Añade ingredientes con el buscador.</p>`}</div>
  <div class="fsearch"><input placeholder="Añadir ingrediente…" data-rec-search="1" aria-label="Buscar ingrediente"><div class="fres" hidden></div></div>
  <div class="omac"><b>Por ración:</b> ${esc(mTxt({ kcal: m.kcal * k, prot: m.prot * k, hc: m.hc * k, grasa: m.grasa * k }))} · <span class="muted">Total: ${r0(m.kcal)} kcal</span></div>
  <div class="f"><label>Preparación (un paso por línea)</label><textarea name="pasos" style="min-height:120px">${esc(r.pasos || "")}</textarea></div><div class="f"><label>Notas</label><input name="notas" value="${esc(r.notas || "")}"></div></div>
  <div class="savebar row"><button class="btn pri">Guardar receta</button><span class="grow"></span><button type="button" class="btn ghost sm bad" data-act="rec-del" data-id="${esc(r.id)}">Borrar receta</button></div></form>`, { crumb: [["lib", "Librería"], ["lib", "Recetas"], [null, r.nombre]] });
}
function syncRec() { const f = $("#f-rec"); if (!f) return; N.rec.nombre = f.nombre.value.trim() || N.rec.nombre; N.rec.raciones = num(f.raciones.value) || 1; N.rec.pasos = f.pasos.value; N.rec.notas = f.notas.value; f.querySelectorAll("[data-rec-g]").forEach(i => { N.rec.ingredientes[+i.dataset.recG].g = num(i.value) || 0; }); }
async function saveRec(f) {
  syncRec(); const r = N.rec; const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    const file = f.foto.files[0]; if (file) { const blob = await shrink(file); const path = `${r.id}/${uid()}.jpg`; const { error } = await sb.storage.from("recetas").upload(path, blob, { contentType: "image/jpeg" }); if (error) throw error; if (r.foto_path) await sb.storage.from("recetas").remove([r.foto_path]); r.foto_path = path; }
    await q(sb.from("recipes").update({ nombre: r.nombre, raciones: r.raciones, ingredientes: r.ingredientes, pasos: r.pasos, notas: r.notas, foto_path: r.foto_path }).eq("id", r.id));
    N.recipes[r.id] = JSON.parse(JSON.stringify(r)); toast("Receta guardada"); renderRecipe();
  } catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ---------- Cliente: Nutrición ---------- */
async function viewNutri() {
  loading("Nutrición"); const plan = await getPlan(); const n = plan.nutricion || {};
  const hab = (plan.habitos || []).length ? `<div class="card"><h2>Tus hábitos</h2><ul class="small" style="margin:0;padding-left:18px">${plan.habitos.map(hb => `<li>${esc(hb)}</li>`).join("")}</ul></div>` : "";
  const pautas = `${n.titulo || n.notas ? `<div class="card">${n.titulo ? `<h2>${esc(n.titulo)}</h2>` : ""}${n.notas ? `<p class="small" style="margin:0;white-space:pre-wrap">${esc(n.notas)}</p>` : ""}</div>` : ""}${(n.secciones || []).map(sec => `<div class="card"><h2>${esc(sec.titulo || "")}</h2><ul class="small" style="margin:0;padding-left:18px">${(sec.items || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}`;
  if (!n.activo || !(n.comidas || []).length) { shell("Nutrición", `${!n.activo ? `<div class="card"><h2>Próximamente</h2><p class="small" style="margin:0">Aquí tendrás tu plan de alimentación cuando Adrián lo active. Mientras tanto, céntrate en tus hábitos.</p></div>` : ""}${n.activo ? pautas : ""}${hab}`); return; }
  await preloadPlan(n); N.cplan = n;
  const t = today(); const logs = n.registro !== false ? await q(sb.from("meal_logs").select("comida,opcion,cumplido").eq("fecha", t)) : [];
  const recs = [...new Set(n.comidas.flatMap(c => (c.opciones || []).flatMap(o => (o.items || []).map(i => i.receta_id).filter(Boolean))))];
  const urls = await signedRecetas(recs.map(id => N.recipes[id] && N.recipes[id].foto_path));
  shell("Nutrición", `${n.objetivo && n.mostrar_objetivo !== false ? `<div class="card"><h2>Tu objetivo diario</h2><div class="macros"><div><span>Energía</span><b>${r0(n.objetivo.kcal)} kcal</b></div><div><span>Proteína</span><b>${r0(n.objetivo.prot)} g</b></div><div><span>Hidratos</span><b>${r0(n.objetivo.hc)} g</b></div><div><span>Grasa</span><b>${r0(n.objetivo.grasa)} g</b></div></div><p class="tiny muted" style="margin:6px 0 0">Elige en cada comida la opción que más te apetezca: todas están pensadas para encajar en tu día.</p></div>` : ""}
  <div class="banner crudo"><b>Pesa siempre en crudo:</b> todas las cantidades son del alimento antes de cocinarlo (arroz, pasta, carne, legumbre seca…).</div>
  ${n.comidas.map((cm, ci) => { const reg = logs.find(l => l.comida === cm.nombre); const sel = S.sub["nopt" + ci] || 0; const o = cm.opciones[sel] || cm.opciones[0]; if (!o) return ""; const m = optMacros(o);
    return `<div class="card"><h2>${esc(cm.nombre)}${cm.hora ? ` <small>${esc(cm.hora)}</small>` : ""}${reg ? ` <span class="done">Registrado ✓</span>` : ""}</h2>
    ${cm.opciones.length > 1 ? `<div class="seg optseg" role="group" aria-label="Opciones de ${esc(cm.nombre)}">${cm.opciones.map((op, oi) => `<button data-act="n-copt" data-ci="${ci}" data-oi="${oi}" aria-pressed="${oi === sel}">${esc(op.nombre || "Opción " + (oi + 1))}</button>`).join("")}</div>` : ""}
    <ul class="flist">${(o.items || []).map(it => `<li>${it.receta_id && N.recipes[it.receta_id] ? `<button class="linkbtn" data-act="n-rec" data-id="${esc(it.receta_id)}">${N.recipes[it.receta_id].foto_path && urls[N.recipes[it.receta_id].foto_path] ? `<img class="thumb" src="${esc(urls[N.recipes[it.receta_id].foto_path])}" alt="">` : ""}${esc(itemName(it))}</button>` : `<span>${esc(itemName(it))}</span>`}<b>${itemQty(it)}</b></li>`).join("")}</ul>
    ${o.notas ? `<p class="tiny muted" style="margin:6px 0 0">${esc(o.notas)}</p>` : ""}
    <div class="row" style="margin-top:8px"><span class="tiny muted grow">${r0(m.kcal)} kcal · P ${r0(m.prot)} g · HC ${r0(m.hc)} g · G ${r0(m.grasa)} g</span>${n.registro !== false && !reg ? `<button class="btn ghost sm" data-act="n-log" data-ci="${ci}">Apuntar (opcional)</button>` : ""}</div></div>`; }).join("")}
  ${pautas}${hab}`);
}
function openRecipeView(id) {
  const r = N.recipes[id]; if (!r) return; const m = recipeMacros(r), k = 1 / (+r.raciones || 1);
  signedRecetas([r.foto_path]).then(urls => sheet(`${r.foto_path && urls[r.foto_path] ? `<img class="recimg" src="${esc(urls[r.foto_path])}" alt="Foto de ${esc(r.nombre)}">` : ""}<h2>${esc(r.nombre)}</h2><p class="tiny muted" style="margin:0">Salen ${fmt(r.raciones)} ración${(+r.raciones) === 1 ? "" : "es"} · por ración: ${esc(mTxt({ kcal: m.kcal * k, prot: m.prot * k, hc: m.hc * k, grasa: m.grasa * k }))}</p>
  <h3 style="font-size:15px">Ingredientes <small class="muted">(pesados en crudo)</small></h3><ul class="flist">${(r.ingredientes || []).map(i => `<li><span>${esc(N.foods[i.food_id] ? N.foods[i.food_id].nombre : i.nombre || "")}</span><b>${fmt(i.g, 0)} g</b></li>`).join("")}</ul>
  ${r.pasos ? `<h3 style="font-size:15px">Preparación</h3><ol class="small">${lines(r.pasos).map(p => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}${r.notas ? `<p class="small muted">${esc(r.notas)}</p>` : ""}<button class="btn" data-act="close">Cerrar</button>`));
}
function openMealLog(ci) {
  const cm = N.cplan.comidas[ci];
  sheet(`<h2>${esc(cm.nombre)}</h2><p class="small muted" style="margin:0">Es opcional: apúntalo solo si te ayuda.</p><form id="f-mlog" data-ci="${ci}" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label>¿Qué has tomado?</label><select name="opcion">${cm.opciones.map(o => `<option>${esc(o.nombre)}</option>`).join("")}<option value="__otra">Otra cosa</option></select></div><div class="f"><label>Comentario (opcional)</label><input name="comentario" maxlength="1000"></div><div class="f"><label>Foto (opcional)</label><input name="foto" type="file" accept="image/*"></div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveMealLog(f) {
  const cm = N.cplan.comidas[+f.dataset.ci]; const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    let foto_path = ""; const file = f.foto.files[0];
    if (file) { const blob = await shrink(file); foto_path = `${S.me.cid}/comida-${today()}-${uid()}.jpg`; const { error } = await sb.storage.from("fotos").upload(foto_path, blob, { contentType: "image/jpeg" }); if (error) throw error; }
    const otra = f.opcion.value === "__otra";
    await q(sb.from("meal_logs").insert({ client_id: S.me.cid, fecha: today(), comida: cm.nombre, opcion: otra ? "" : f.opcion.value, cumplido: !otra, comentario: f.comentario.value.trim(), foto_path }));
    sheet(""); toast("Apuntado"); viewNutri();
  } catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ---------- Eventos de nutrición ---------- */
let nT;
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.dataset.calc !== undefined && t.closest("#f-calc")) { N.calc[t.name] = t.value; const box = $("#calc-res"); if (box) box.innerHTML = calcResult(N.calc, N.plan || {}); }
  if (t.dataset.nSearch || t.dataset.recSearch) { clearTimeout(nT); nT = setTimeout(() => nSearch(t), 250); }
  if (t.dataset.nG) { const { it } = nGet(t.dataset.nG); it.g = num(t.value) || 0; const mm = t.parentElement.querySelector(".mm"); if (mm) mm.textContent = r0(itemMacros(it).kcal) + " kcal"; }
  if (t.dataset.nR) { const { it } = nGet(t.dataset.nR); it.raciones = num(t.value) || 1; }
  if (t.dataset.nCm) N.plan.comidas[+t.dataset.nCm].nombre = t.value;
  if (t.dataset.nHora) N.plan.comidas[+t.dataset.nHora].hora = t.value;
  if (t.dataset.nOn) { const { o } = nGet(t.dataset.nOn); o.nombre = t.value; }
  if (t.dataset.nNotas) { const { o } = nGet(t.dataset.nNotas); o.notas = t.value; }
  if (t.closest && t.closest("#f-food")) foodCheck();
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.dataset.calc !== undefined && t.tagName === "SELECT") { N.calc[t.name] = t.value; if (["modo", "reparto"].includes(t.name)) { const w = $(".calcwrap"); if (w) w.innerHTML = `${calcForm(N.calc)}<div id="calc-res">${calcResult(N.calc, N.plan || {})}</div>`; } }
  if (t.dataset.n) N.plan[t.dataset.n] = t.checked;
  if (t.dataset.nG || t.dataset.nR) rerenderPlan();
  if (t.id === "food-fuente") { S.lib.fuente = t.value; viewLib(); }
});
document.addEventListener("click", async ev => {
  const a = ev.target.closest("[data-act]"); if (!a || !a.dataset.act.startsWith("n-") && !/^(food-|rec-)/.test(a.dataset.act)) return;
  const act = a.dataset.act;
  try {
    switch (act) {
      case "n-sub": S.coach.nsub = a.dataset.t; refreshClient(); break;
      case "n-save": await nSavePlan(); break;
      case "n-calc-apply": { const r = calcKcal(N.calc); if (!r) break; const pl = (await q(sb.from("plans").select("nutricion").eq("client_id", S.coach.cid).limit(1)))[0] || {}; const nut = { ...(pl.nutricion || {}), calc: N.calc, objetivo: { kcal: r0(r.kcal), prot: r0(r.prot), hc: r0(r.hc), grasa: r0(r.grasa) } }; await q(sb.from("plans").upsert({ client_id: S.coach.cid, nutricion: nut }, { onConflict: "client_id" })); toast("Objetivo guardado en el plan"); S.coach.nsub = "plan"; refreshClient(); break; }
      case "n-comida-add": { const sel = $("#n-new-comida"); const nombre = sel.value || "Comida"; N.plan.comidas.push({ nombre, hora: "", opciones: [{ nombre: "Opción 1", items: [], notas: "" }] }); rerenderPlan(); break; }
      case "n-cm-del": if (confirmar(a)) { N.plan.comidas.splice(+a.dataset.ci, 1); rerenderPlan(); } break;
      case "n-cm-up": { const i = +a.dataset.ci; if (i > 0) { const c = N.plan.comidas; [c[i - 1], c[i]] = [c[i], c[i - 1]]; rerenderPlan(); } break; }
      case "n-opt-add": { const cm = N.plan.comidas[+a.dataset.ci]; cm.opciones.push({ nombre: `Opción ${cm.opciones.length + 1}`, items: [], notas: "" }); rerenderPlan(); break; }
      case "n-opt-dup": { const { cm, o } = nGet(a.dataset.k); const c = JSON.parse(JSON.stringify(o)); c.nombre = `Opción ${cm.opciones.length + 1}`; cm.opciones.push(c); rerenderPlan(); break; }
      case "n-opt-del": { const { cm, oi } = nGet(a.dataset.k); cm.opciones.splice(oi, 1); rerenderPlan(); break; }
      case "n-it-del": { const { o, ii } = nGet(a.dataset.k); o.items.splice(ii, 1); rerenderPlan(); break; }
      case "n-pick": {
        const k = a.dataset.k;
        if (k === "rec") { // receta en edición
          if (!a.dataset.food) { toast("Dentro de una receta solo puedes añadir alimentos"); break; }
          syncRec(); if (a.dataset.food) { const f = N.foods[a.dataset.food]; N.rec.ingredientes.push({ food_id: f.id, nombre: f.nombre, g: f.racion_g || 100 }); } renderRecipe(); break; }
        const { o } = nGet(k);
        if (a.dataset.rec) { await recipesById([a.dataset.rec]); o.items.push({ receta_id: a.dataset.rec, raciones: 1 }); }
        else { const f = N.foods[a.dataset.food]; o.items.push({ food_id: f.id, nombre: f.nombre, g: f.racion_g || 100 }); }
        rerenderPlan(); break; }
      case "n-copt": S.sub["nopt" + a.dataset.ci] = +a.dataset.oi; viewNutri(); break;
      case "n-rec": openRecipeView(a.dataset.id); break;
      case "n-log": openMealLog(+a.dataset.ci); break;
      case "food-edit": openFood(a.dataset.id); break;
      case "food-del": if (confirmar(a)) { await q(sb.from("foods").delete().eq("id", a.dataset.id)); sheet(""); toast("Alimento borrado"); viewLib(); } break;
      case "food-dup": { const f = (await q(sb.from("foods").select("*").eq("id", a.dataset.id)))[0]; const { id, off_code, created_at, ...rest } = f; await q(sb.from("foods").insert({ ...rest, fuente: "propio", nombre: f.nombre + " (copia)" })); sheet(""); toast("Duplicado"); viewLib(); break; }
      case "rec-new": { const r = await q(sb.from("recipes").insert({ nombre: "Nueva receta" }).select("id")); go("lib-r-" + r[0].id); break; }
      case "rec-ing-del": syncRec(); N.rec.ingredientes.splice(+a.dataset.i, 1); renderRecipe(); break;
      case "rec-del": if (confirmar(a)) { if (N.rec.foto_path) await sb.storage.from("recetas").remove([N.rec.foto_path]); await q(sb.from("recipes").delete().eq("id", a.dataset.id)); toast("Receta borrada"); S.lib.tab = "recetas"; go("lib"); } break;
    }
  } catch (e) { toast(errMsg(e)); }
});
document.addEventListener("submit", ev => {
  const f = ev.target; const m = { "f-food": saveFood, "f-rec": saveRec, "f-mlog": saveMealLog, "f-calc": () => { } };
  if (m[f.id]) { ev.preventDefault(); ev.stopImmediatePropagation(); m[f.id](f); }
}, true);
document.addEventListener("click", ev => { if (!ev.target.closest(".fsearch")) document.querySelectorAll(".fres").forEach(b => b.hidden = true); });


/* ================= Eventos ================= */
function codigoNuevo() { const b = new Uint8Array(4); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase(); }
// Confirmación en dos toques (sin diálogos del navegador)
function confirmar(a) { if (a.dataset.ok) return true; a.dataset.ok = "1"; const t = a.textContent; a.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { delete a.dataset.ok; a.textContent = t; }, 3000); return false; }
const refreshClient = () => { S.coach.keep = true; return viewCoachClient(S.coach.cid); };
function move(row, dir) { const sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling; if (!sib) return; if (dir < 0) row.parentElement.insertBefore(row, sib); else row.parentElement.insertBefore(sib, row); }

document.addEventListener("click", async ev => {
  const a = ev.target.closest("[data-act]"); if (!a) return; const act = a.dataset.act; const id = a.dataset.id;
  if (act === "close-bg") { if (ev.target === a) sheet(""); return; }
  try {
    switch (act) {
      case "go": if (location.hash === "#" + a.dataset.h) route(); else location.hash = a.dataset.h; break;
      case "reload": location.reload(); break;
      case "logout": await sb.auth.signOut(); clearLocal(); S.me = null; S.plan = null; S.sub = {}; history.replaceState(null, "", location.pathname); renderLogin(); break;
      case "login-tab": renderLogin(a.dataset.t); break;
      case "ver-pw": { const i = a.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; const v = i.type === "text"; a.innerHTML = v ? EYE_OFF : EYE; a.setAttribute("aria-label", v ? "Ocultar contraseña" : "Mostrar contraseña"); a.title = a.getAttribute("aria-label"); a.classList.toggle("on", v); i.focus(); break; }
      case "cambiar-pw": openCambiarPw(); break;
      case "close": sheet(""); break;
      // cliente
      case "wellness": { const r = await q(sb.from("wellness").select("*").eq("fecha", today()).limit(1)).catch(() => []); openWellness(r[0]); break; }
      case "scale": { S.sub.well[a.dataset.k] = +a.dataset.v; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); break; }
      case "peso": openPeso(); break;
      case "medidas": openMedidas(); break;
      case "fotos": openFotos(); break;
      case "prog": S.sub.prog = a.dataset.t; viewProgreso(); break;
      case "cal-m": S.sub.calM = a.dataset.m; S.sub.calD = null; viewCal(); break;
      case "cal-d": S.sub.calD = a.dataset.d; S.sub.calM = a.dataset.d.slice(0, 7); viewCal(); break;
      case "item": openItem(id); break;
      case "item-undo": await q(sb.rpc("completar_asignacion", { p_id: id, p_hecho: false, p_respuesta: ($("#it-r") || {}).value || "" })); sheet(""); route(); break;
      // entrenador: navegación
      case "new-client": openNewClient(); break;
      case "go-plan": S.coach.tab = "plan"; S.coach.cid = null; location.hash = "c-" + a.dataset.cid; break;
      case "ctab": S.coach.tab = a.dataset.t; viewCoachClient(S.coach.cid); break;
      case "evo": S.coach.evo = a.dataset.t; refreshClient(); break;
      case "pm": S.coach.calM = a.dataset.m; refreshClient(); break;
      // planificación
      case "asig-new": openAsig(null, a.dataset.d); break;
      case "asig-edit": openAsig(id); break;
      case "asig-tipo": { S.sub.asigTipo = a.dataset.t; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); const f = $("#f-asig"); $("#asig-body").innerHTML = asigBody({ tipo: a.dataset.t, fecha: f.fecha.value, titulo: f.titulo.value, contenido: {}, visible: true }, S.sub.tpls || []); break; }
      case "tpl-load": { const t = (S.sub.tpls || []).find(x => x.id === $("#tpl-sel").value); if (!t) break; const f = a.closest("form"); f.querySelector(".wed").outerHTML = wEditor(t.contenido || {}, S.sub.asigTipo); if (!f.titulo.value) f.titulo.value = t.nombre.replace(/^[^·]+ · /, ""); break; }
      case "w-add": a.closest(".wed").querySelector(".wrows").insertAdjacentHTML("beforeend", wRow()); a.closest(".wed").querySelector(".wrows").lastElementChild.querySelector('[name="r_n"]').focus(); break;
      case "w-up": move(a.closest("[data-row]"), -1); break;
      case "w-down": move(a.closest("[data-row]"), 1); break;
      case "w-del": a.closest("[data-row]").remove(); break;
      case "asig-dup": { const f = a.closest("form"); const x = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; await q(sb.from("assignments").insert({ client_id: x.client_id, fecha: f.dup_fecha.value, orden: x.orden, tipo: x.tipo, titulo: x.titulo, contenido: x.contenido, visible: x.visible, programa: x.programa })); sheet(""); toast("Duplicado"); refreshClient(); break; }
      case "asig-del": if (confirmar(a)) { await q(sb.from("assignments").delete().eq("id", id)); sheet(""); toast("Borrado"); refreshClient(); } break;
      case "ev-edit": openEvent(id); break;
      case "ev-del": if (confirmar(a)) { await q(sb.from("events").delete().eq("id", id)); sheet(""); refreshClient(); } break;
      case "prog-asignar": openAsignarPrograma(id); break;
      case "copiar-semana": openCopiarSemana(); break;
      case "borrar-semana": openBorrarSemana(); break;
      case "meso-edit": openMeso(); break;
      case "mb-add": $("#mbs").insertAdjacentHTML("beforeend", mesoBlock({ semanas: [{ tipo: "carga" }] })); break;
      case "mb-del": if (confirmar(a)) a.closest("[data-b]").remove(); break;
      case "mw-add": { const ws = a.closest("[data-b]").querySelector(".mws"); const last = ws.lastElementChild; const fin = last && last.querySelector('[name="s_f"]').value; const n = ws.children.length + 1; ws.insertAdjacentHTML("beforeend", mesoWeek({ nombre: "S" + n, inicio: fin ? addDays(fin, 1) : "", fin: fin ? addDays(fin, 7) : "", tipo: "carga" })); break; }
      case "mw-del": a.closest("[data-w]").remove(); break;
      // información y nutrición
      case "pend-add": $("#pends").insertAdjacentHTML("beforeend", pendRow()); break;
      case "marca-add": $("#marcas").insertAdjacentHTML("beforeend", marcaRow({ fecha: today() })); break;
      case "row-del": a.closest("[data-p],[data-m]").remove(); break;
      case "sec-add": $("#secs").insertAdjacentHTML("beforeend", secRow()); break;
      case "sec-del": a.closest("[data-s]").remove(); break;
      case "test-del": if (confirmar(a)) { await q(sb.from("tests").delete().eq("id", id)); refreshClient(); } break;
      case "publicar": await q(sb.from("reports").update({ publicado: a.dataset.v === "1", publicado_en: a.dataset.v === "1" ? new Date().toISOString() : null }).eq("id", id)); toast(a.dataset.v === "1" ? "Publicado: ya lo ve el cliente" : "Ocultado"); refreshClient(); break;
      case "ex-hist": openHist(a.dataset.n); break;
      case "rec-w": S.coach.recW = +a.dataset.n; refreshClient(); break;
      case "rep-new": openReportEditor(null, a.dataset.auto === "1"); break;
      case "rep-edit": openReportEditor(id, false); break;
      case "rep-del": if (confirmar(a)) { await q(sb.from("reports").delete().eq("id", id)); sheet(""); toast("Informe borrado"); refreshClient(); } break;
      case "ver-informe": { const r = (await q(sb.from("reports").select("*").eq("id", id).limit(1)))[0]; if (r) sheet(`<h2>Vista del cliente</h2>${reportHTML(r)}<button class="btn" data-act="close">Cerrar</button>`); break; }
      case "nuevo-codigo": await q(sb.from("clients").update({ codigo_alta: codigoNuevo() }).eq("id", a.dataset.cid)); toast("Código nuevo generado"); refreshClient(); break;
      case "desvincular": if (confirmar(a)) { await q(sb.from("clients").update({ user_id: null, codigo_alta: codigoNuevo() }).eq("id", a.dataset.cid)); toast("Cuenta desvinculada. Tiene un código nuevo."); refreshClient(); } break;
      case "copiar-alta": { const c = S.coach.c; const msg = `¡Hola ${c.nombre.split(" ")[0]}! Ya tienes tu app de entrenamiento: ${location.origin + location.pathname}\n\nEntra en «Nuevo atleta» con tu email (${c.email}), crea una contraseña y pon este código de alta: ${c.codigo_alta}\n\nEn el móvil puedes instalarla: Compartir → «Añadir a pantalla de inicio» (iPhone) o menú ⋮ → «Instalar aplicación» (Android).`; try { await navigator.clipboard.writeText(msg); toast("Mensaje copiado: pégalo en WhatsApp"); } catch { sheet(`<h2>Mensaje para el cliente</h2><textarea style="min-height:200px">${esc(msg)}</textarea><button class="btn" data-act="close">Cerrar</button>`); } break; }
      // librería
      case "lib-tab": S.lib.tab = a.dataset.t; viewLib(); break;
      case "ex-new": openEx(null); break;
      case "ex-edit": openEx(id); break;
      case "ex-del": if (confirmar(a)) { await q(sb.from("exercises").delete().eq("id", id)); sheet(""); toast("Ejercicio borrado"); viewLib(); } break;
      case "wt-asignar": openWtAsignar(id); break;
      case "wt-dup": { const t = (await q(sb.from("workout_templates").select("*").eq("id", id).limit(1)))[0]; const r = await q(sb.from("workout_templates").insert({ nombre: t.nombre + " (copia)", tipo: t.tipo, descripcion: t.descripcion, contenido: t.contenido }).select("id")); toast("Duplicado"); location.hash = "lib-w-" + r[0].id; break; }
      case "wt-del": if (confirmar(a)) { await q(sb.from("workout_templates").delete().eq("id", id)); toast("Workout borrado"); location.hash = "lib"; } break;
      case "pi-new": openProgItem(null, +a.dataset.s, +a.dataset.d); break;
      case "pi-edit": openProgItem(+a.dataset.i); break;
      case "pi-tipo": { S.sub.piTipo = a.dataset.t; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); $("#pi-body").innerHTML = piBody({ tipo: a.dataset.t, contenido: {} }, S.sub.tpls || []); break; }
      case "pi-del": S.sub.prog.items.splice(+a.dataset.i, 1); sheet(""); renderProgram($("#f-prog").dataset.id); break;
      case "prog-dup": { const p = (await q(sb.from("programs").select("*").eq("id", id).limit(1)))[0]; const r = await q(sb.from("programs").insert({ nombre: p.nombre + " (copia)", descripcion: p.descripcion, semanas: p.semanas, items: p.items }).select("id")); toast("Duplicado"); location.hash = "lib-p-" + r[0].id; break; }
      case "prog-del": if (confirmar(a)) { await q(sb.from("programs").delete().eq("id", id)); toast("Programa borrado"); location.hash = "lib"; } break;
    }
  } catch (e) { toast(errMsg(e)); }
});
// Arrastrar tareas entre días en la planificación
document.addEventListener("dragstart", ev => { const d = ev.target.closest && ev.target.closest("[data-drag]"); if (d) { ev.dataTransfer.setData("text/plain", d.dataset.drag); ev.dataTransfer.effectAllowed = "move"; } });
document.addEventListener("dragover", ev => { const d = ev.target.closest && ev.target.closest(".pday[data-day]"); if (d) { ev.preventDefault(); d.classList.add("over"); } });
document.addEventListener("dragleave", ev => { const d = ev.target.closest && ev.target.closest(".pday[data-day]"); if (d) d.classList.remove("over"); });
document.addEventListener("drop", async ev => { const d = ev.target.closest && ev.target.closest(".pday[data-day]"); if (!d) return; ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (!id) return; try { await q(sb.from("assignments").update({ fecha: d.dataset.day }).eq("id", id)); refreshClient(); } catch (e) { toast(errMsg(e)); } });
let qT;
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.closest && el.closest("#f-workout")) saveDraftFrom(el);
  if (el.id === "ex-q") { clearTimeout(qT); qT = setTimeout(() => { S.lib.q = el.value; S.lib.focusQ = true; viewLib(); }, 250); }
  if (el.dataset && el.dataset.prog && S.sub.prog) S.sub.prog[el.dataset.prog] = el.dataset.prog === "semanas" ? Math.min(16, Math.max(1, +el.value || 1)) : el.value;
});
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.closest && el.closest("#f-workout")) saveDraftFrom(el);
  if (el.id === "ex-sel") { S.sub.ex = el.value; viewProgreso(); }
  if (el.id === "cex-sel") { S.sub.cex = el.value; refreshClient(); }
  if (el.id === "wt-tipo") { $("#wt-ed").innerHTML = wEditor({}, el.value); }
  if (el.dataset && el.dataset.prog === "semanas" && S.sub.prog) renderProgram($("#f-prog").dataset.id);
});
document.addEventListener("submit", ev => {
  ev.preventDefault(); const f = ev.target;
  const map = { "f-login": doLogin, "f-alta": doAlta, "f-alta-codigo": doAltaCodigo, "f-olvido": doOlvido, "f-nueva": doNueva, "f-well": saveWellness, "f-peso": savePeso, "f-workout": saveWorkout, "f-med": saveMedidas, "f-fotos": saveFotos, "f-item": saveItem,
    "f-newc": saveNewClient, "f-asig": saveAsig, "f-ev": saveEvent, "f-asigprog": asignarPrograma, "f-copsem": copiarSemana, "f-borsem": borrarSemana, "f-meso": saveMeso, "f-info": saveInfo, "f-test": saveTest, "f-nutri": saveNutri, "f-cuenta": saveCuenta,
    "f-ex": saveEx, "f-wt": saveWt, "f-wtas": wtAsignar, "f-pi": saveProgItem, "f-prog": saveProg };
  if (f.id === "f-rep") return saveReport(f, ev.submitter && ev.submitter.value === "1");
  if (map[f.id]) map[f.id](f);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape") sheet(""); });

init();
