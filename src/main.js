import { createClient } from "@supabase/supabase-js";

/* ================= Configuración y cliente ================= */
const CFG = window.APP_CONFIG || {};
const sb = window.__SB_MOCK || createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
// Solo enlaces https (evita javascript:, data:, etc.)
const safeUrl = u => { try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.href : ""; } catch { return ""; } };
// No permitir que otra web meta la app dentro de un marco (clickjacking)
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch { document.documentElement.innerHTML = ""; } }
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
/* ================= Modo sin conexión ================= */
// Lectura: guarda en el móvil solo la planificación (tareas, plan, entrenos registrados, eventos) y la identidad.
// Escritura: si no hay red, los registros se guardan en cola y se envían solos al volver la conexión.
const OFF_K = "arc-off", OFFQ_K = "arc-offq";
const OFF_RE = /\/rest\/v1\/(assignments|plans|workouts|events)$/;
const isNet = e => !navigator.onLine || /failed to fetch|networkerror|network request|load failed|fetch failed|the internet connection/i.test(String((e && (e.message || e.details)) || e || ""));
function offKey(p) {
  try { if (!p || !p.url) return null; const u = p.url; const path = u.pathname || "";
    if (/\/rpc\/my_profile$/.test(path)) return "rpc:my_profile";
    if (p.method !== "GET" || !OFF_RE.test(path)) return null;
    if (!S.me || S.me.role === "coach") return null;
    return path.replace(/^.*\/rest\/v1\//, "") + u.search;
  } catch { return null; }
}
function offLoad() { try { return JSON.parse(localStorage.getItem(OFF_K) || "{}"); } catch { return {}; } }
function offSave(m) { try { const ks = Object.keys(m).sort((a, b) => m[b].t - m[a].t); const keep = {}; ks.slice(0, 120).forEach(k => keep[k] = m[k]); let s = JSON.stringify(keep); if (s.length > 2.5e6) return; localStorage.setItem(OFF_K, s); } catch { } }
function offPut(k, d) { const m = offLoad(); m[k] = { t: Date.now(), d }; offSave(m); }
function offGet(k) { const m = offLoad(); return m[k] ? m[k].d : undefined; }
async function q(p) {
  const k = offKey(p); let res;
  try { res = await p; } catch (e) { res = { error: e }; }
  if (res.error) {
    if (k && isNet(res.error)) { const c = offGet(k); if (c !== undefined) { setOffline(true); return c; } }
    // sin red y sin copia: el cliente ve la pantalla vacía en vez de un error (lo indica la barra «Sin conexión»)
    if (isNet(res.error) && S.me && S.me.role !== "coach" && p && p.method === "GET") { setOffline(true); return []; }
    throw res.error;
  }
  if (k) { offPut(k, res.data); }
  if (S.offline && k) setOffline(false);
  return res.data;
}
function setOffline(v) { if (S.offline === v) return; S.offline = v; offBanner(); }
// ---- cola de envíos
const offQ = () => { try { return JSON.parse(localStorage.getItem(OFFQ_K) || "[]"); } catch { return []; } };
const offQset = a => { try { localStorage.setItem(OFFQ_K, JSON.stringify(a)); } catch { } offBanner(); };
function opBuild(o) {
  if (o.t === "rpc") return sb.rpc(o.fn, o.args);
  const t = sb.from(o.table);
  if (o.t === "insert") return t.insert(o.row);
  if (o.t === "upsert") return t.upsert(o.row, { onConflict: o.oc });
}
// Ejecuta una operación; sin red la deja en cola (manteniendo el orden) y devuelve {queued:true}
async function op(o) {
  if (offQ().length) { offQset([...offQ(), o]); offMark(o); S.queued = true; return { queued: true }; }
  try { const { data, error } = await opBuild(o); if (error) throw error; return data; }
  catch (e) { if (!isNet(e)) throw e; offQset([...offQ(), o]); offMark(o); S.queued = true; setOffline(true); return { queued: true }; }
}
function offMark(o) { // refleja en lo guardado en el móvil que la tarea ya está hecha
  if (o.t !== "rpc" || o.fn !== "completar_asignacion" || !o.args.p_hecho) return;
  const m = offLoad(); Object.values(m).forEach(v => { if (Array.isArray(v.d)) v.d.forEach(x => { if (x && x.id === o.args.p_id) { x.hecho = true; x.hecho_en = new Date().toISOString(); } }); }); offSave(m);
}
let flushing = false;
async function offFlush() {
  if (flushing || !navigator.onLine) return; const a = offQ(); if (!a.length) return; flushing = true; let n = 0;
  try {
    while (offQ().length) { const o = offQ()[0];
      try { const { error } = await opBuild(o); if (error) { if (isNet(error)) break; console.warn("Descartado de la cola", error); } } catch (e) { if (isNet(e)) break; }
      offQset(offQ().slice(1)); n++; }
  } finally { flushing = false; }
  if (n && !offQ().length) { toast(n > 1 ? `Conexión recuperada: ${n} registros enviados` : "Conexión recuperada: registro enviado"); setOffline(false); if (S.me && S.me.role !== "coach") route(); }
}
const savedMsg = m => { const qd = S.queued; S.queued = false; return qd ? "Guardado en el móvil · se enviará al conectarte" : m; };
function offBanner() {
  let b = document.getElementById("offbar"); const pend = offQ().length; const show = S.me && S.me.role !== "coach" && (S.offline || !navigator.onLine || pend);
  if (!show) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "offbar"; document.body.appendChild(b); }
  b.innerHTML = `<span class="odot"></span><span>${!navigator.onLine || S.offline ? "Sin conexión · ves lo último guardado" : "Enviando registros…"}${pend ? ` · <b>${pend} pendiente${pend > 1 ? "s" : ""}</b>` : ""}</span>`;
}
window.addEventListener("online", () => { setOffline(false); offFlush(); offBanner(); });
window.addEventListener("offline", () => offBanner());
// Precarga en segundo plano los entrenos de los próximos días para poder abrirlos sin cobertura
async function offPrefetch(asig) {
  if (!navigator.onLine) return;
  try { const ws = asig.filter(x => x.tipo === "workout" && !x.hecho && x.fecha >= addDays(today(), -2) && x.fecha <= addDays(today(), 7)).slice(0, 10);
    if (!ws.length) return;
    await q(sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(150));
    for (const w of ws) await q(sb.from("assignments").select("*").eq("id", w.id).limit(1));
  } catch { }
}

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
  let g = tk.filter(v => v >= y0 && v <= y1).map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, y1 - y0 < 1 ? 2 : 1)}</text>`).join("");
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
  t_cardio: svg('<path d="M3 12h4l2-5 4 10 2-5h6"/>'),
  t_msg: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  t_peso: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a4 4 0 0 1 8 0M12 9l1.5-2"/>'),
  t_foto: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  t_med: svg('<path d="M3 15 15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>'),
  t_tarea: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>'),
  comunidad: svg('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>'),
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>'),
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
const TIPOS = { workout: "Workout", cardio: "Cardio", formulario: "Formulario", nota: "Mensaje", peso: "Peso", fotos: "Fotos", medidas: "Medidas", tarea: "Tarea" };
// Abanico de medidas que Adrián puede pedir (cm)
const MEDIDAS = [["cuello", "Cuello", "Justo debajo de la nuez"], ["hombros", "Hombros", "Contorno a la altura de los deltoides"], ["pecho", "Pecho", "A la altura de los pezones, tras soltar el aire"], ["brazo_rel", "Brazo relajado", "Parte media del brazo, colgando"], ["brazo", "Brazo contraído", "Parte más gruesa del bíceps en tensión"], ["antebrazo", "Antebrazo", "Parte más gruesa"], ["cintura", "Cintura", "A la altura del ombligo, tras soltar el aire"], ["abdomen", "Abdomen", "Parte más ancha de la barriga"], ["cadera", "Cadera", "Parte más ancha del glúteo"], ["muslo", "Muslo", "Parte más ancha, de pie"], ["gemelo", "Gemelo", "Parte más gruesa, de pie"]];
const MED_DEF = ["cintura", "cadera", "pecho", "brazo", "muslo"];
const medLabel = k => (MEDIDAS.find(m => m[0] === k) || [k, k])[1];
// Un mensaje programado no se muestra al cliente hasta su fecha y hora
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const yaVisible = x => x.tipo !== "nota" || x.fecha < today() || (x.fecha === today() && (!(x.contenido || {}).hora || x.contenido.hora <= nowHM()));
// Al registrar peso, fotos, medidas o cuestionario se completan solas las tareas pendientes de ese tipo (hoy o atrasadas)
async function completarAccion(tipo) {
  try { const xs = await q(sb.from("assignments").select("id,hecho,fecha").eq("tipo", tipo).eq("hecho", false).lte("fecha", today()).gte("fecha", addDays(today(), -14)));
    for (const x of xs) await op({ t: "rpc", fn: "completar_asignacion", args: { p_id: x.id, p_hecho: true, p_respuesta: "", p_resultado: null } });
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
  if (!$("#upd-bar")) document.body.insertAdjacentHTML("beforeend", `<div id="upd-bar" class="upd" role="status">Hay una versión nueva de la app <button type="button" class="btn sm pri" data-act="reload">Actualizar</button></div>`);
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
  if (!data || !data.session) return location.hash === "#empezar" ? renderEmpezar() : renderLogin();
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
    if (S.me.role === "client") { const ob = await q(sb.from("onboarding").select("client_id").limit(1)).catch(() => [{}]); S.needCom = !ob.length; if (S.needCom && location.hash !== "#comienzo") { location.hash = "comienzo"; return; } }
    await route();
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
  <button class="btn pri block">Entrar</button><button type="button" class="btn ghost" data-act="login-tab" data-t="olvido">He olvidado mi contraseña</button><p class="tiny muted" style="text-align:center;margin:6px 0 0">¿Aún no eres cliente? <a href="#empezar">Quiero empezar</a></p></form>`;
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
const COACH_TABS = [["inicio", "Inicio", "hoy"], ["c", "Clientes", "clientes"], ["lib", "Librería", "lib"], ["tablon", "Comunidad", "comunidad"], ["mas", "Perfil", "mas"]];
const isCoachHash = h => ["inicio", "c", "lib", "tablon"].includes(h) || h.startsWith("c-") || h.startsWith("lib-");
function grow(t) { if (!t || t.closest("[hidden]")) return; t.style.height = "auto"; let h = t.scrollHeight; if (!t.value && t.placeholder) { t.value = t.placeholder; h = Math.max(h, t.scrollHeight); t.value = ""; } t.style.height = Math.min(Math.max(h + 2, 64), 460) + "px"; }
function shell(title, body, opts = {}) {
  const coach = S.me.role === "coach";
  const v = S.view; document.body.classList.toggle("is-coach", coach);
  S.backTo = coach ? ((opts.crumb || []).filter(c => c[0]).slice(-1)[0] || [null])[0] : (opts.back || null);
  if (coach) {
    const cur = v.startsWith("c") ? "c" : v.startsWith("lib") ? "lib" : v;
    const crumb = opts.crumb || [[null, title]];
    $("#app").innerHTML = `<header class="hnav"><a class="hlogo" href="#inicio" aria-label="Inicio"><img src="./logo.jpg" alt=""></a>
    <nav class="hmenu" aria-label="Secciones">${COACH_TABS.filter(t => t[0] !== "mas").map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>
    <span class="grow"></span><button class="hme" data-act="go" data-h="mas" aria-label="Tu perfil" aria-current="${cur === "mas"}">${avatar(S.me.nombre || "A", "dark")}</button></header>
    <div class="crumb"><div class="crumbin">${S.backTo ? `<button class="cback" data-act="go-back" aria-label="Volver">‹</button>` : ""}${crumb.map(([h, l, av], k) => `${k ? `<span class="sep">/</span>` : ""}${h ? `<a href="#${esc(h)}">${esc(l)}</a>` : `<b>${av ? avatar(l, "xs") : ""}${esc(l)}</b>`}`).join("")}${opts.sub ? `<span class="csub">${esc(opts.sub)}</span>` : ""}<span class="grow"></span>${opts.right || ""}</div></div>
    <main class="wide" id="main">${body}</main>`;
  } else {
    const tabs = CLIENT_TABS; const cur = v.split("-")[0];
    const nb = (S.tab && S.tab.n) || 0; const right = !opts.back ? `<span class="tright"><button class="bell" data-act="go" data-h="tablon" aria-label="Comunidad${nb ? ", " + nb + " publicaciones nuevas" : ""}">${ICON.bell}${nb ? `<i>${nb > 9 ? "9+" : nb}</i>` : ""}</button><button class="back" data-act="go" data-h="mas" aria-label="Tu perfil">${avatar(S.me.nombre)}</button></span>` : (opts.right || "");
    $("#app").innerHTML = `<header class="top">${opts.back ? `<button class="back" data-act="go" data-h="${esc(opts.back)}" aria-label="Volver">←</button>` : `<img src="./logo.jpg" alt="">`}<h1>${esc(title)}${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ""}</h1>${right}</header>
    <main id="main">${body}</main>
    ${opts.noTabs ? "" : `<nav class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)" aria-label="Secciones">${tabs.map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>`}`;
  }
  if (S.lastView !== v) { const m = $("#main"); if (m) m.classList.add("pgin"); S.lastView = v; }
  if (!opts.keepScroll) window.scrollTo(0, 0);
  requestAnimationFrame(() => { document.querySelectorAll("#app textarea").forEach(grow); document.querySelectorAll('#app [aria-current="true"],#app [aria-selected="true"],#app .tabs .on').forEach(r => { const p = r.parentElement; if (p && p.scrollWidth > p.clientWidth + 4) p.scrollLeft = r.offsetLeft - p.offsetLeft - 12; }); });
}
function loading(title) { shell(title, `<div class="empty">Cargando…</div>`); }
async function route() {
  offBanner(); if (navigator.onLine && offQ().length) offFlush();
  if (!S.me) { const h0 = location.hash.slice(1); if (h0 === "empezar") renderEmpezar(); else if (document.body.classList.contains("pub")) { document.body.classList.remove("pub"); renderLogin(); } return; }
  if (location.hash === "#empezar") { renderEmpezar(); return; }
  document.body.classList.remove("pub");
  const coach = S.me.role === "coach";
  let h = location.hash.slice(1) || (coach ? "inicio" : "hoy");
  if (!coach && isCoachHash(h) && h !== "tablon") h = "hoy"; // la vista de entrenador no existe para clientes
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
      if (h === "tablon") return await viewTablonCoach();
      return await viewInicio();
    }
    if (h !== "tablon") await tablonUnread();
    if (h === "tablon") return await viewTablon();
    if (h === "comienzo") return await viewComienzo();
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
/* ================= Navegación fluida: gestos ================= */
// Cerrar hojas con animación
function closeSheet() {
  const sh = document.querySelector("#modal-root .sheet"); if (!sh) return;
  const ov = sh.parentElement; sh.style.transition = "transform .2s cubic-bezier(.2,.8,.2,1)"; sh.style.transform = "translateY(105%)";
  ov.style.transition = "opacity .2s"; ov.style.opacity = "0"; setTimeout(() => { if (document.querySelector("#modal-root .sheet") === sh) sheet(""); }, 190);
}
// Arrastrar hacia abajo para cerrar una hoja
(() => {
  let g = null;
  document.addEventListener("touchstart", ev => {
    const sh = ev.target.closest && ev.target.closest("#modal-root .sheet"); if (!sh || ev.touches.length !== 1) return;
    if (ev.target.closest("input,textarea,select,[data-drag],.scale,.tpick,.prows,.tbl,.heat")) { const r = sh.getBoundingClientRect(); if (ev.touches[0].clientY - r.top > 64) return; }
    const t = ev.touches[0]; g = { sh, y0: t.clientY, x0: t.clientX, t0: Date.now(), dy: 0, on: false, top: sh.scrollTop <= 0, head: t.clientY - sh.getBoundingClientRect().top < 64 };
  }, { passive: true });
  document.addEventListener("touchmove", ev => {
    if (!g) return; const t = ev.touches[0]; const dy = t.clientY - g.y0, dx = t.clientX - g.x0;
    if (!g.on) { if (dy > 6 && Math.abs(dy) > Math.abs(dx) * 1.2 && (g.head || (g.top && g.sh.scrollTop <= 0))) { g.on = true; g.sh.style.transition = "none"; } else if (Math.abs(dy) > 10 || Math.abs(dx) > 10) { g = null; return; } else return; }
    g.dy = Math.max(0, dy); const k = g.dy < 0 ? 0 : g.dy; g.sh.style.transform = `translateY(${k}px)`; g.sh.parentElement.style.opacity = String(Math.max(.35, 1 - k / 600));
    if (ev.cancelable) ev.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", () => {
    if (!g) return; const s = g; g = null; if (!s.on) return;
    const v = s.dy / Math.max(1, Date.now() - s.t0);
    if (s.dy > 120 || (v > .55 && s.dy > 40)) closeSheet();
    else { s.sh.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)"; s.sh.style.transform = ""; s.sh.parentElement.style.transition = "opacity .2s"; s.sh.parentElement.style.opacity = ""; }
  });
})();
// Volver atrás deslizando desde el borde izquierdo (como en iPhone)
function goBack() {
  if (document.querySelector("#modal-root .sheet")) { closeSheet(); return; }
  if (S.backTo) { location.hash = S.backTo; return; }
}
(() => {
  let g = null; let tip = null;
  document.addEventListener("touchstart", ev => {
    if (ev.touches.length !== 1 || document.querySelector("#modal-root .sheet") || !S.backTo) return;
    const t = ev.touches[0]; if (t.clientX > 24) return; g = { x0: t.clientX, y0: t.clientY, dx: 0, on: false };
  }, { passive: true });
  document.addEventListener("touchmove", ev => {
    if (!g) return; const t = ev.touches[0]; const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.on) { if (dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) { g.on = true; tip = document.createElement("div"); tip.className = "backtip"; tip.innerHTML = "‹"; document.body.appendChild(tip); } else if (Math.abs(dy) > 10) { g = null; return; } else return; }
    g.dx = Math.max(0, dx); const p = Math.min(1, g.dx / 90); tip.style.transform = `translate(${Math.min(70, g.dx * .6) - 40}px,-50%) scale(${.7 + p * .3})`; tip.style.opacity = String(p); tip.classList.toggle("go", p >= 1);
    const m = $("#main"); if (m) { m.style.transition = "none"; m.style.transform = `translateX(${Math.min(60, g.dx * .25)}px)`; }
    if (ev.cancelable) ev.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", () => {
    if (!g) return; const s = g; g = null; const m = $("#main");
    if (tip) { tip.remove(); tip = null; }
    if (m) { m.style.transition = "transform .2s"; m.style.transform = ""; }
    if (s.on && s.dx >= 90) goBack();
  });
})();
// Botón atrás de Android / gesto del navegador: si hay una hoja abierta, solo la cierra
S.navIdx = 0; try { history.replaceState({ i: 0 }, ""); } catch { }
window.addEventListener("hashchange", () => {
  const st = history.state;
  if (S.skipNext) { S.skipNext = false; S.skipRoute = true; return; }
  if (st && typeof st.i === "number") { // viaje por el historial (atrás/adelante)
    if (st.i < S.navIdx && document.querySelector("#modal-root .sheet")) { closeSheet(); S.skipNext = true; S.skipRoute = true; history.forward(); return; }
    S.navIdx = st.i;
  } else { S.navIdx++; try { history.replaceState({ i: S.navIdx }, ""); } catch { } }
}, true);
window.addEventListener("hashchange", () => { if (S.skipRoute) { S.skipRoute = false; return; } route(); });

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
  const btn = { workout: "Empezar", nota: "Leer", peso: "Apuntar", fotos: "Subir", medidas: "Medir", formulario: "Rellenar" }[x.tipo] || (late ? "Pendiente" : "Abrir");
  return `<button class="it" ${h}><span class="itl"><i class="dot dot-${esc(x.tipo)}"></i><span><b>${esc(x.titulo)}</b><br><span class="tiny muted">${esc(sub)}</span></span></span>${x.hecho ? `<span class="done">${x.tipo === "nota" ? "Leído ✓" : "Hecho ✓"}</span>` : `<span class="chip ${late && x.tipo !== "nota" ? "warn" : "acc"}">${btn}</span>`}</button>`;
}

/* ================= Comunidad: tablón de Adrián ================= */
const POST_T = { pildora: ["Píldora educativa", "💡"], enlace: ["Enlace recomendado", "🔗"], motivacion: ["Motivación", "🔥"], aviso: ["Aviso", "📣"] };
const linkify = t => esc(t).replace(/https:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 48 ? u.slice(0, 45) + "…" : u}</a>`);
function postCard(p, o = {}) {
  const [tl, ic] = POST_T[p.tipo] || POST_T.pildora; const u = safeUrl(p.url);
  return `<article class="post t-${esc(p.tipo)}${p.fijado ? " pin" : ""}${o.nuevo ? " nuevo" : ""}">
    <header class="ph"><span class="pic">${ic}</span><span class="grow"><span class="ptl">${esc(tl)}${p.fijado ? ` · <b>Fijado</b>` : ""}</span><span class="pdt">${esc(o.fecha || relTime(p.publicar_en))}</span></span>${o.nuevo ? `<span class="pnew">Nuevo</span>` : ""}${o.right || ""}</header>
    <h3>${esc(p.titulo)}</h3>${p.cuerpo ? `<div class="pbody">${linkify(p.cuerpo)}</div>` : ""}
    ${u ? `<a class="plink" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(u.replace(/^https:\/\/(www\.)?/, "").split("/")[0])}</span><b>Abrir enlace ↗</b></a>` : ""}
    ${o.foot || ""}</article>`;
}
const REACTS = ["👍", "❤️", "🔥", "💪", "👏", "😂"];
const reactCount = rows => { const m = {}; (rows || []).forEach(r => { (m[r.post_id] = m[r.post_id] || {})[r.emoji] = (m[r.post_id] || {})[r.emoji] ? m[r.post_id][r.emoji] + r.n : r.n; }); return m; };
function reactBar(pid, cnt = {}, mine = new Set(), interactive = true, names = {}) {
  const list = interactive ? REACTS : REACTS.filter(e => cnt[e]);
  if (!list.length) return `<span class="tiny muted">Sin reacciones todavía</span>`;
  return `<div class="reacts">${list.map(e => { const n = cnt[e] || 0; const on = mine.has(e);
    return interactive ? `<button type="button" class="rx${on ? " on" : ""}${n ? " has" : ""}" data-act="post-react" data-id="${esc(pid)}" data-e="${e}" aria-pressed="${on}" aria-label="Reaccionar ${e}${n ? ", " + n : ""}"><span>${e}</span><b>${n || ""}</b></button>`
      : `<span class="rx has" title="${esc((names[e] || []).join(", "))}"><span>${e}</span><b>${n}</b></span>`; }).join("")}</div>`;
}
// ---- Cliente
async function tablonUnread(force) {
  if (!S.me || S.me.role === "coach" || !S.me.cid) return 0;
  if (!force && S.tab && Date.now() - S.tab.t < 60000) return S.tab.n;
  try { const [ps, rs] = await Promise.all([q(sb.from("posts").select("id").lte("publicar_en", new Date().toISOString()).order("publicar_en", { ascending: false }).limit(60)), q(sb.from("post_reads").select("post_id"))]);
    const leidos = new Set(rs.map(r => r.post_id)); S.tab = { t: Date.now(), n: ps.filter(p => !leidos.has(p.id)).length }; } catch { S.tab = { t: Date.now(), n: 0 }; }
  return S.tab.n;
}
async function viewTablon() {
  loading("Comunidad");
  const [ps, rs, mine] = await Promise.all([q(sb.from("posts").select("*").lte("publicar_en", new Date().toISOString()).order("publicar_en", { ascending: false }).limit(60)), q(sb.from("post_reads").select("post_id")), q(sb.from("post_reactions").select("post_id,emoji")).catch(() => [])]);
  const cnt = reactCount(ps.length ? await q(sb.rpc("reacciones_posts", { p_ids: ps.map(p => p.id) })).catch(() => []) : []);
  const M = {}; mine.forEach(r => (M[r.post_id] = M[r.post_id] || new Set()).add(r.emoji));
  const R = new Set(rs.map(r => r.post_id)); const orden = [...ps.filter(p => p.fijado), ...ps.filter(p => !p.fijado)];
  shell("Comunidad", `<p class="small muted" style="margin:0">Píldoras, recursos y avisos de Adrián para todo el equipo. Las reacciones son anónimas: solo se ve cuántas hay.</p>
  ${orden.length ? orden.map(p => postCard(p, { nuevo: !R.has(p.id), foot: `<footer class="pf2">${reactBar(p.id, cnt[p.id], M[p.id])}</footer>` })).join("") : `<div class="card empty">Aún no hay publicaciones. Cuando Adrián comparta algo aparecerá aquí.</div>`}`, { back: "hoy", noTabs: true });
  const nuevos = ps.filter(p => !R.has(p.id)).map(p => ({ post_id: p.id, client_id: S.me.cid }));
  if (nuevos.length) { try { await q(sb.from("post_reads").upsert(nuevos, { onConflict: "post_id,client_id", ignoreDuplicates: true })); } catch { } }
  S.tab = { t: Date.now(), n: 0 };
}
async function postReact(b) {
  const on = b.getAttribute("aria-pressed") !== "true"; const n0 = +(b.querySelector("b").textContent || 0); const n = Math.max(0, n0 + (on ? 1 : -1));
  b.setAttribute("aria-pressed", on); b.classList.toggle("on", on); b.classList.toggle("has", n > 0); b.querySelector("b").textContent = n || "";
  try { if (on) await q(sb.from("post_reactions").insert({ post_id: b.dataset.id, client_id: S.me.cid, emoji: b.dataset.e }));
    else await q(sb.from("post_reactions").delete().eq("post_id", b.dataset.id).eq("client_id", S.me.cid).eq("emoji", b.dataset.e));
  } catch (e) { toast(errMsg(e)); b.setAttribute("aria-pressed", !on); b.classList.toggle("on", !on); b.querySelector("b").textContent = n0 || ""; }
}
async function tablonHoy() { // bloque para «Hoy»: fijados + lo no leído
  try { const [ps, rs] = await Promise.all([q(sb.from("posts").select("*").lte("publicar_en", new Date().toISOString()).order("publicar_en", { ascending: false }).limit(20)), q(sb.from("post_reads").select("post_id"))]);
    const L = new Set(rs.map(r => r.post_id)); const nuevos = ps.filter(p => !L.has(p.id)); const fij = ps.filter(p => p.fijado && L.has(p.id));
    const show = [...nuevos.slice(0, 2), ...fij.slice(0, Math.max(0, 1 - nuevos.length))];
    if (!ps.length) return "";
    return `<section class="card tbh"><h2 class="hh">${ICON.comunidad}Comunidad ${nuevos.length ? `<span class="pnew">${nuevos.length} nuevo${nuevos.length > 1 ? "s" : ""}</span>` : ""}<span class="grow"></span><a href="#tablon" class="tiny">Ver todo</a></h2>
    ${show.length ? show.map(p => `<button class="tbi" data-act="go" data-h="tablon"><span class="pic">${(POST_T[p.tipo] || POST_T.pildora)[1]}</span><span class="grow"><b>${esc(p.titulo)}</b><span class="tiny muted">${esc((POST_T[p.tipo] || POST_T.pildora)[0])} · ${esc(relTime(p.publicar_en))}</span></span>${L.has(p.id) ? "" : `<i class="ndot"></i>`}</button>`).join("") : `<button class="tbi" data-act="go" data-h="tablon"><span class="grow tiny muted">Estás al día. Toca para ver todas las publicaciones.</span></button>`}</section>`;
  } catch { return ""; }
}
// ---- Entrenador
async function viewTablonCoach() {
  loading("Comunidad");
  const [ps, rs, cl, rx] = await Promise.all([q(sb.from("posts").select("*").order("publicar_en", { ascending: false }).limit(200)), q(sb.from("post_reads").select("post_id,client_id")), loadClients(), q(sb.from("post_reactions").select("post_id,client_id,emoji")).catch(() => [])]);
  const act = cl.filter(c => c.estado === "activo" && c.user_id); const ahora = new Date().toISOString();
  const st = p => { const r = rs.filter(x => x.post_id === p.id); const dest = p.para && p.para.length ? act.filter(c => p.para.includes(c.id)) : act; const cnt = {}, names = {}; rx.filter(x => x.post_id === p.id).forEach(x => { cnt[x.emoji] = (cnt[x.emoji] || 0) + 1; (names[x.emoji] = names[x.emoji] || []).push(clientName(x.client_id)); }); return { vistos: r.length, total: dest.length, cnt, names }; };
  const prog = ps.filter(p => p.publicar_en > ahora), pub = ps.filter(p => p.publicar_en <= ahora);
  const orden = [...pub.filter(p => p.fijado), ...pub.filter(p => !p.fijado)];
  const card = p => { const s = st(p); const prx = p.publicar_en > ahora;
    return postCard(p, { fecha: prx ? "Programado · " + new Date(p.publicar_en).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : relTime(p.publicar_en) + (p.publicado ? "" : " · oculto"),
      right: `<details class="more"><summary class="btn ghost sm" aria-label="Opciones">•••</summary><div class="menu"><button data-act="post-edit" data-id="${esc(p.id)}">Editar</button><button data-act="post-pin" data-id="${esc(p.id)}">${p.fijado ? "Quitar de fijados" : "Fijar arriba"}</button><button data-act="post-hide" data-id="${esc(p.id)}">${p.publicado ? "Ocultar" : "Volver a mostrar"}</button><button data-act="post-del" data-id="${esc(p.id)}" style="color:var(--bad)">Borrar</button></div></details>`,
      foot: `<footer class="pf2 muted tiny"><span>${p.para && p.para.length ? "Para " + esc(p.para.map(clientName).join(", ")) : "Para todos"}</span><span class="grow"></span>${prx ? "" : `${reactBar(p.id, s.cnt, new Set(), false, s.names)}<span title="Clientes que lo han visto">👁 ${s.vistos}/${s.total}</span>`}</footer>` }); };
  shell("Comunidad", `<div class="pghead"><h1 class="ptitle">Comunidad <span class="cnt">${pub.length}</span></h1><button class="btn pri" data-act="post-new">+ Publicar</button></div>
  <p class="small muted" style="margin:-6px 0 4px">Tu tablón para todos los clientes: píldoras educativas, enlaces, mensajes motivadores y avisos. Les aparece en «Hoy» con aviso de novedad.</p>
  <div class="tbgrid"><div class="tbcol">${orden.length ? orden.map(card).join("") : `<div class="card empty">Todavía no has publicado nada. Empieza con una píldora educativa o un mensaje para el equipo.</div>`}</div>
  <aside class="tbcol">${prog.length ? `<h2 class="tbh2">${ICON.cal}Programados <span class="cnt">${prog.length}</span></h2>${prog.sort((a, b) => a.publicar_en.localeCompare(b.publicar_en)).map(card).join("")}` : `<div class="card"><h2 class="hh">${ICON.cal}Programados</h2><p class="small muted" style="margin:0">Puedes dejar publicaciones programadas para que salgan en la fecha y hora que elijas.</p></div>`}</aside></div>`, { crumb: [[null, "Comunidad"]] });
}
async function openPostForm(id) {
  const p = id ? (await q(sb.from("posts").select("*").eq("id", id).limit(1)))[0] || {} : { tipo: "pildora" };
  const cl = (S.coach.list || await loadClients()).filter(c => c.estado === "activo");
  const loc = p.publicar_en ? new Date(new Date(p.publicar_en).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const todos = !(p.para && p.para.length);
  sheet(`<h2>${id ? "Editar publicación" : "Nueva publicación"}</h2>
  <form id="f-post" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:12px">
    <div class="choice-row" role="radiogroup" aria-label="Tipo">${Object.entries(POST_T).map(([k, [l, ic]]) => `<label class="ptype"><input type="radio" name="tipo" value="${k}" ${(p.tipo || "pildora") === k ? "checked" : ""}><span>${ic} ${l}</span></label>`).join("")}</div>
    <div class="f"><label for="po-t">Título</label><input id="po-t" name="titulo" required maxlength="160" value="${esc(p.titulo || "")}" placeholder="Por qué dormir bien te hace progresar más"></div>
    <div class="f"><label for="po-c">Texto</label><textarea id="po-c" name="cuerpo" maxlength="6000" placeholder="Explícalo en pocas líneas. Los enlaces https se convierten en clicables.">${esc(p.cuerpo || "")}</textarea></div>
    <div class="f"><label for="po-u">Enlace <span class="opt-l">opcional</span></label><input id="po-u" name="url" type="url" inputmode="url" value="${esc(p.url || "")}" placeholder="https://…"></div>
    <div class="grid2"><div class="f"><label for="po-w">Publicar</label><input id="po-w" name="cuando" type="datetime-local" value="${esc(loc)}"><span class="tiny muted">Vacío = ahora mismo</span></div>
    <div class="f"><label>Opciones</label><label class="mchk"><input type="checkbox" name="fijado" ${p.fijado ? "checked" : ""}><span>Fijar arriba del tablón</span></label></div></div>
    <fieldset class="opts"><legend>¿Quién lo ve?</legend><label class="mchk"><input type="checkbox" name="todos" data-act-change="post-todos" ${todos ? "checked" : ""}><span>Todos los clientes</span></label>
    <div class="post-para" ${todos ? "hidden" : ""}>${cl.map(c => `<label class="mchk"><input type="checkbox" name="para" value="${esc(c.id)}" ${(p.para || []).includes(c.id) ? "checked" : ""}><span>${esc(c.nombre)}</span></label>`).join("")}</div></fieldset>
    <button class="btn pri block">${id ? "Guardar cambios" : "Publicar"}</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function savePost(f) {
  const url = f.url.value.trim(); if (url && !safeUrl(url)) { toast("El enlace debe empezar por https://"); return; }
  const para = f.todos.checked ? null : [...f.querySelectorAll('[name="para"]:checked')].map(i => i.value);
  if (para && !para.length) { toast("Elige al menos un cliente o marca «Todos»"); return; }
  const row = { tipo: f.tipo.value, titulo: f.titulo.value.trim(), cuerpo: f.cuerpo.value.trim(), url: url || null, fijado: f.fijado.checked, para, publicar_en: f.cuando.value ? new Date(f.cuando.value).toISOString() : new Date().toISOString() };
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { if (f.dataset.id) await q(sb.from("posts").update(row).eq("id", f.dataset.id)); else await q(sb.from("posts").insert({ ...row, publicado: true }));
    sheet(""); toast(f.dataset.id ? "Publicación guardada" : row.publicar_en > new Date(Date.now() + 60000).toISOString() ? "Publicación programada" : "¡Publicado en la comunidad!"); route();
  } catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ================= Cliente: Hoy ================= */
async function viewHoy() {
  loading("Hoy");
  const t = today();
  const [plan, wl, wt, asig, rp, ev] = await Promise.all([getPlan(), q(sb.from("wellness").select("id").eq("fecha", t).limit(1)), q(sb.from("weights").select("*").order("fecha", { ascending: false }).limit(1)), getAsig(addDays(t, -7), addDays(t, 7)), q(sb.from("reports").select("id,fecha,titular,semana,leido_en").order("fecha", { ascending: false }).limit(1)), q(sb.from("events").select("*").gte("fecha", t).order("fecha").limit(3))]);
  const w = weekNow(plan); const lastW = wt[0]; const tbh = await tablonHoy();
  const msgs = asig.filter(x => x.tipo === "nota" && x.fecha <= t && (!x.hecho || x.fecha === t)).slice(-3);
  const hoy = asig.filter(x => x.fecha === t && x.tipo !== "nota"), atras = asig.filter(x => x.fecha < t && !x.hecho && x.tipo !== "nota"), prox = asig.filter(x => x.fecha > t && x.tipo !== "nota").slice(0, 4);
  shell(CFG.nombre || "Hoy", `
  ${S.needCom ? `<button class="card com-cta" data-act="go" data-h="comienzo"><b>Antes de empezar: tu cuestionario inicial</b><span class="small">10 minutos para que Adrián prepare tu plan. Pulsa aquí →</span></button>` : ""}
  <section class="hero"><p class="hdate">${esc(cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })))}</p><h2>Hola, ${esc((S.me.nombre || "").split(" ")[0])}</h2>${w ? `<div class="hweek"><span>${esc(w.nombre)}</span>${esc(w.bloque)}${w.tipo && w.tipo !== "carga" ? " · " + esc(cap(w.tipo)) : ""}</div>${w.foco ? `<p class="hfoco">${esc(w.foco)}</p>` : ""}` : ""}</section>
  ${msgs.map(m => `<button class="msg ${m.hecho ? "leido" : ""}" data-act="item" data-id="${esc(m.id)}">${avatar("Adrián Rodríguez", "sm")}<span><b>Adrián</b> <span class="tiny muted">${esc(fdate(m.fecha, { weekday: "short", day: "numeric" }))}${(m.contenido || {}).hora ? " · " + esc(m.contenido.hora) : ""}</span><br>${esc(((m.contenido || {}).detalle || m.titulo).slice(0, 220))}</span></button>`).join("")}
  ${rp[0] && !rp[0].leido_en ? `<button class="card revnew" data-act="go" data-h="informe-${esc(encodeURIComponent(rp[0].id))}"><span class="ricon">${ICON.doc}</span><span class="grow"><span class="pnew">Nueva</span> <span class="tiny">Revisión del ${esc(fdate(rp[0].fecha, { day: "numeric", month: "long" }))}</span><br><b>${esc(rp[0].titular || "Tu revisión semanal")}</b><br><span class="tiny muted">Toca para leerla</span></span><span class="chev">›</span></button>` : ""}
  ${tbh}
  <div class="card"><h2>Para hoy</h2><div class="list">
    ${hoy.length ? hoy.map(asigRow).join("") : `<div class="it rest" style="cursor:default"><span><b>${prox[0] || atras.length ? "Día de descanso" : "Nada programado para hoy"}</b><br><span class="tiny muted">${prox[0] ? `Lo siguiente: ${esc(prox[0].titulo)} · ${esc(fdate(prox[0].fecha, { weekday: "long" }))}` : atras.length ? "Recupera bien" : "Cuando Adrián te programe algo, aparecerá aquí"}</span></span></div>`}
  </div></div>
  ${atras.length ? `<div class="card"><h2>Pendiente de días anteriores</h2><div class="list">${atras.map(asigRow).join("")}</div></div>` : ""}
  ${prox.length ? `<div class="card"><h2>Próximos días <small><a href="#cal">Ver calendario</a></small></h2><div class="list">${prox.map(asigRow).join("")}</div></div>` : ""}
  ${ev.length ? `<div class="card"><h2>Fechas importantes</h2><div class="evl">${ev.map(e => `<div class="evi"><span class="evd"><b>${esc(fdate(e.fecha, { day: "numeric" }))}</b><span>${esc(fdate(e.fecha, { month: "short" }))}</span></span><span class="grow"><b>${esc(e.titulo)}</b><br><span class="tiny muted">${daysBetween(t, e.fecha) === 0 ? "Hoy" : "En " + daysBetween(t, e.fecha) + " días"}</span></span></div>`).join("")}</div></div>` : ""}
  ${rp[0] && rp[0].leido_en ? `<button class="card rowcard" data-act="go" data-h="informe-${esc(encodeURIComponent(rp[0].id))}"><span class="ricon">${ICON.doc}</span><span class="grow"><span class="tiny muted">Tu última revisión · ${esc(fdate(rp[0].fecha))}</span><br><b>${esc(rp[0].titular || rp[0].semana || "Revisión semanal")}</b></span><span class="chev">›</span></button>` : ""}
  <div class="qlog"><span>Apuntar por tu cuenta</span><button class="btn sm" data-act="peso">Peso${lastW && lastW.fecha === t ? " ✓" : ""}</button><button class="btn sm" data-act="wellness">Cómo estoy hoy${wl[0] ? " ✓" : ""}</button></div>`);
  offPrefetch(asig);
}
async function openItem(id) {
  const x = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; if (!x) return;
  const c = x.contenido || {};
  if (!x.hecho) { if (x.tipo === "peso") return openPeso(c); if (x.tipo === "fotos") return openFotos(c); if (x.tipo === "medidas") return openMedidas(c.medidas, c); }
  if (x.tipo === "formulario" && c.wellness) { const r = await q(sb.from("wellness").select("*").eq("fecha", today()).limit(1)).catch(() => []); return openWellness(r[0], c); }
  const pre = (c.preguntas || []).map(parseQ); const R0 = x.resultado || {}; const prevR = R0.respuestas || [];
  const regs = x.tipo === "cardio" ? (c.registrar && c.registrar.length ? c.registrar : ["min", "rpe"]) : [];
  const ck = c.checklist || []; const resumen = x.tipo === "cardio" ? cardioResumen(c) : "";
  const responde = x.tipo !== "nota" || c.responder;
  const scale = (i, n, v) => `<div class="scale${n > 5 ? " s10" : ""}" role="group">${Array.from({ length: n }, (_, k) => k + 1).map(k => `<button type="button" data-act="qscale" data-q="${i}" data-v="${k}" aria-pressed="${String(v) === String(k)}">${k}</button>`).join("")}</div>`;
  sheet(`<h2>${esc(x.titulo)}</h2><p class="tiny muted" style="margin:0">${esc(TIPOS[x.tipo] || "")} · ${esc(fdate(x.fecha, { weekday: "long", day: "numeric", month: "long" }))}${x.tipo === "nota" && c.hora ? " · " + esc(c.hora) : ""}</p>
  ${resumen ? `<div class="obj">🎯 ${esc(resumen)}</div>` : ""}
  ${c.detalle ? `<p class="small" style="white-space:pre-wrap;margin:0">${esc(c.detalle)}</p>` : ""}
  ${safeUrl(c.enlace) ? `<a class="btn sm" href="${esc(safeUrl(c.enlace))}" target="_blank" rel="noopener noreferrer" style="align-self:flex-start">Abrir enlace ↗</a>` : ""}
  <form id="f-item" data-id="${esc(x.id)}" style="display:flex;flex-direction:column;gap:12px">
  ${ck.length ? `<div class="cklist">${ck.map((t, i) => `<label class="mchk"><input type="checkbox" name="ck" value="${i}" ${(R0.check || [])[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>` : ""}
  ${pre.map((qq, i) => { const v = (prevR[i] && prevR[i].r) || ""; return `<div class="f"><label for="q${i}">${esc(qq.texto)}</label>${qq.tipo === "txt" ? `<textarea id="q${i}" name="q${i}" maxlength="1000" style="min-height:60px">${esc(v)}</textarea>` : `<input type="hidden" id="q${i}" name="q${i}" value="${esc(v)}">${qq.tipo === "sn" ? `<div class="scale sn" role="group">${["Sí", "No"].map(k => `<button type="button" data-act="qscale" data-q="${i}" data-v="${k}" aria-pressed="${v === k}">${k}</button>`).join("")}</div>` : scale(i, qq.tipo === "1-10" ? 10 : 5, v)}${qq.tipo !== "sn" ? (/estr[eé]s|dolor|fatiga|molest|cansa|agujet/i.test(qq.texto) ? `<div class="anchors"><span>Nada</span><span>Muchísimo</span></div>` : `<div class="anchors"><span>Muy mal</span><span>Muy bien</span></div>`) : ""}`}</div>`; }).join("")}
  ${regs.length ? `<div class="grid2">${regs.map(k => { const l = (CARDIO_REG.find(r => r[0] === k) || [k, k])[1]; return k === "rpe" ? `<div class="f"><label for="r-rpe">${l}</label><select id="r-rpe" name="r_rpe"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${R0.rpe == n ? "selected" : ""}>${n}</option>`).join("")}</select></div>` : `<div class="f"><label for="r-${k}">${l}</label><input id="r-${k}" name="r_${k}" inputmode="decimal" value="${esc(R0[k] ?? "")}"></div>`; }).join("")}</div>` : ""}
  ${responde && (x.tipo !== "tarea" || c.pedir_comentario || !ck.length) ? `<div class="f"><label for="it-r">${x.tipo === "nota" ? "Tu respuesta" : x.tipo === "tarea" && c.pedir_comentario ? "Comentario para Adrián" : "Comentario para Adrián (opcional)"}</label><textarea id="it-r" name="respuesta" maxlength="2000" style="min-height:60px" ${x.tipo === "tarea" && c.pedir_comentario ? "required" : ""}>${esc(x.respuesta || "")}</textarea></div>` : ""}
  <button class="btn pri block">${x.tipo === "nota" ? (c.responder ? "Enviar" : x.hecho ? "Leído ✓" : "Marcar como leído") : x.hecho ? "Guardar" : x.tipo === "formulario" ? "Enviar respuestas" : "Marcar como hecho"}</button>
  ${x.hecho && x.tipo !== "nota" ? `<button type="button" class="btn ghost" data-act="item-undo" data-id="${esc(x.id)}">Marcar como no hecho</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveItem(f) {
  const x = (await q(sb.from("assignments").select("tipo,contenido").eq("id", f.dataset.id).limit(1)))[0] || {}; const c = x.contenido || {};
  const pre = (c.preguntas || []).map(parseQ); const resultado = {};
  if (pre.length) { const rs = pre.map((qq, i) => ({ p: qq.texto, r: ((f[`q${i}`] || {}).value || "").trim() })); if (rs.some(r => !r.r)) { toast("Te falta alguna respuesta"); return; } resultado.respuestas = rs; }
  if ((c.checklist || []).length) resultado.check = c.checklist.map((_, i) => !!f.querySelector(`input[name=ck][value="${i}"]:checked`));
  if (x.tipo === "cardio") ["min", "km", "pasos", "fc", "rpe"].forEach(k => { const e = f[`r_${k}`]; if (e && num(e.value) != null) resultado[k] = num(e.value); });
  try { await op({ t: "rpc", fn: "completar_asignacion", args: { p_id: f.dataset.id, p_hecho: true, p_respuesta: f.respuesta ? f.respuesta.value.trim() : "", p_resultado: Object.keys(resultado).length ? resultado : null } }); sheet(""); toast(savedMsg(x.tipo === "nota" ? (c.responder ? "Enviado" : "Leído") : "¡Hecho!")); route(); } catch (e) { toast(errMsg(e)); }
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
  <div class="calg"><span class="dh">L</span><span class="dh">M</span><span class="dh">X</span><span class="dh">J</span><span class="dh">V</span><span class="dh">S</span><span class="dh">D</span>${cells}</div></div>
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
// Referencia discreta: lo que hizo la última vez en ese ejercicio
function exMarks(nombre, wo, prev) {
  if (!prev || !prev.s.length) return { html: "", best: 0 };
  const ss = prev.s.map(x => `<i><b>${esc(x.kg != null ? fmt(x.kg, 2) : "?")}</b> kg × <b>${esc(x.reps ?? "?")}</b></i>`).join("");
  return { best: 0, html: `<div class="mk-prev"><span class="mkl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>Anterior · ${esc(fdate(prev.fecha, { day: "numeric", month: "short" }))}</span><span class="mks">${ss}</span></div>` };
}
async function viewWorkout(id) {
  loading("Entreno");
  const [ar, wo] = await Promise.all([q(sb.from("assignments").select("*").eq("id", id).limit(1)), q(sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(150))]);
  const a = ar[0]; if (!a) { location.hash = "entreno"; return; }
  const c = a.contenido || {}; let draft = {}; try { draft = JSON.parse(localStorage.getItem(draftKey(id)) || "{}"); } catch { }
  const lastSets = name => { for (const w of wo) { const s = (w.sets || []).filter(x => x.ejercicio === name); if (s.length) return { fecha: w.fecha, s }; } return null; };
  const exs = c.ejercicios || [];
  shell(a.titulo, `
  ${a.hecho ? `<div class="banner" style="background:var(--ok-soft);border-color:var(--ok)">Ya registraste este entreno. Si lo guardas otra vez se añade como un registro nuevo.</div>` : ""}
  ${c.objetivo || c.dur_est ? `<div class="card obj-card"><h2>Objetivo de hoy${c.dur_est ? ` <small>≈ ${esc(c.dur_est)} min</small>` : ""}</h2>${c.objetivo ? `<p class="small" style="margin:0">${esc(c.objetivo)}</p>` : ""}</div>` : ""}
  ${c.calentamiento ? `<div class="card"><h2>Calentamiento</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.calentamiento)}</p></div>` : ""}
  ${c.notas ? `<div class="card"><h2>Notas</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.notas)}</p></div>` : ""}
  ${c.detalle ? `<div class="card"><p class="small" style="margin:0;white-space:pre-wrap">${esc(c.detalle)}</p></div>` : ""}
  <form id="f-workout" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:12px">
  ${exs.map((e, ei) => { const n = seriesOf(e.sxr); const prev = lastSets(e.nombre); if (e.series && e.series.length) return presClient(e, ei, prev, draft, wo);
    const prevKg = prev ? Math.max(...prev.s.map(x => num(x.kg)).filter(x => x != null), -Infinity) : null; const pk = prevKg != null && isFinite(prevKg) ? prevKg : null;
    const pg = progTxt(e.prog, pk); const mk = exMarks(e.nombre, wo, prev);
    return `<div class="ex"><div>${e.bloque ? `<span class="chip">${esc(e.bloque)}</span> ` : ""}<h3 style="display:inline">${esc(e.nombre)}</h3> <button type="button" class="btn ghost sm hist" data-act="ex-hist" data-n="${esc(e.nombre)}">Historial</button>${pg ? `<div class="prog">🎯 ${esc(pg.t)}</div>` : ""}<div class="target">${esc([e.sxr, e.rir && e.rir !== "—" ? "RIR " + e.rir : "", e.descanso && e.descanso !== "—" ? "descanso " + e.descanso : ""].filter(Boolean).join(" · "))}</div>${e.notas ? `<div class="tiny muted" style="margin-top:4px">${esc(e.notas)}</div>` : ""}${safeUrl(e.video) ? `<a class="vbtn" href="${esc(safeUrl(e.video))}" target="_blank" rel="noopener noreferrer">▶ Vídeo</a>` : ""}</div>${n ? mk.html : ""}
    ${n ? `<div class="seth"><span>#</span><span>Kg</span><span>Reps</span><span>Te quedaban</span></div><div class="sets">${Array.from({ length: n }, (_, si) => { const k = `${ei}-${si}`; const dv = draft[k] || {}; const pv = prev && prev.s[si]; return `<div class="set"><span class="n">${si + 1}</span><input inputmode="decimal" aria-label="Kilos serie ${si + 1}" data-k="${k}" data-f="kg" value="${esc(dv.kg ?? "")}" placeholder="${esc(pg && pg.kg != null ? pg.kg : pv && pv.kg != null ? pv.kg : "kg")}"><input inputmode="numeric" aria-label="Repeticiones serie ${si + 1}" data-k="${k}" data-f="reps" value="${esc(dv.reps ?? "")}" placeholder="${esc(pv && pv.reps != null ? pv.reps : "reps")}"><input inputmode="numeric" aria-label="Repeticiones que te quedaban serie ${si + 1}" data-k="${k}" data-f="rir" value="${esc(dv.rir ?? "")}" placeholder="${esc(pv && pv.rir != null ? pv.rir : "RIR")}"></div>`; }).join("")}</div>`
      : `<label class="small" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-k="${ei}-done" data-f="hecho" ${draft[`${ei}-done`] && draft[`${ei}-done`].hecho ? "checked" : ""} style="width:22px;height:22px"> Hecho</label>`}</div>`; }).join("")}
  <div class="card"><h2>Al terminar</h2>
    <div class="grid2"><div class="f"><label for="rpe">Dureza (1–10)</label><select id="rpe" name="rpe"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${draft.rpe == n ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="f"><label for="dur">Minutos</label><input id="dur" name="dur" inputmode="numeric" value="${esc(draft.dur || "")}"></div></div>
    <div class="f" style="margin-top:10px"><label for="com">Comentario para Adrián <span class="opt-l">opcional</span></label><textarea id="com" name="com" maxlength="2000">${esc(draft.com || "")}</textarea></div>
    <p class="tiny muted">«Te quedaban»: repeticiones que aún podías hacer con buena técnica.</p>
    <button class="btn pri block">Terminar y guardar</button>
  </div></form>`, { back: "entreno", noTabs: true, sub: [TIPOS[a.tipo], fdate(a.fecha, { weekday: "long", day: "numeric", month: "long" })].join(" · ") });
}

/* Series ordenadas: carga, repeticiones y RIR */
const kgTxt = v => v == null || v === "" ? "—" : fmt(v, 2) + " kg";
const setPill = y => y.hecho ? `<span class="sp ok">Hecho ✓</span>` : `<span class="sp"><b>${esc(y.kg != null ? fmt(y.kg, 2) : "—")}</b><small>kg</small> × <b>${esc(y.reps ?? "—")}</b>${y.rpe != null ? `<em>RPE ${esc(y.rpe)}</em>` : y.rir != null && y.rir !== "" ? `<em>RIR ${esc(y.rir)}</em>` : ""}${y.vel != null ? `<em>${esc(y.vel)} m/s</em>` : ""}${y.tipo ? `<i>${esc(pTipo(y.tipo))}</i>` : ""}</span>`;
const groupSets = sets => { const g = []; (sets || []).forEach(x => { let e = g.find(z => z.n === x.ejercicio); if (!e) g.push(e = { n: x.ejercicio, s: [] }); e.s.push(x); }); return g; };
function sessionTable(sets) {
  const g = groupSets(sets); if (!g.length) return `<div class="empty">Sin series registradas.</div>`;
  return `<div class="tbl"><table class="stab"><thead><tr><th>Ejercicio</th><th class="n">Serie</th><th class="n">Carga</th><th class="n">Reps</th><th class="n">RIR</th><th class="n">1RM est.</th></tr></thead><tbody>${g.map(e => e.s.map((y, i) => `<tr class="${i === 0 ? "first" : ""}">${i === 0 ? `<td rowspan="${e.s.length}" class="exn"><button class="lnk linkbtn" data-act="ex-hist" data-n="${esc(e.n)}">${esc(e.n)}</button></td>` : ""}<td class="n muted">${i + 1}${y.tipo ? `<div class="tiny">${esc(pTipo(y.tipo))}</div>` : ""}</td>${y.hecho ? `<td class="n" colspan="4"><span class="sp ok">Hecho ✓</span></td>` : `<td class="n"><b>${esc(kgTxt(y.kg))}</b></td><td class="n">${esc(y.reps ?? "—")}</td><td class="n">${y.rpe != null ? "RPE " + esc(y.rpe) : esc(y.rir ?? "—")}${y.vel != null ? `<div class="tiny muted">${esc(y.vel)} m/s</div>` : ""}</td><td class="n muted">${e1rm(y.kg, y.reps, y.rir) ? fmt(e1rm(y.kg, y.reps, y.rir)) + " kg" : "—"}</td>`}</tr>`).join("")).join("")}</tbody></table></div>`;
}
const sesStats = w => { const ss = (w.sets || []).filter(x => !x.hecho); const vol = ss.reduce((a, x) => a + (num(x.kg) || 0) * (num(x.reps) || 0), 0); return { series: (w.sets || []).length, ej: groupSets(w.sets).length, vol }; };

async function openHist(nombre) {
  let qy = sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(200);
  if (S.me.role === "coach") qy = qy.eq("client_id", S.coach.cid);
  const wo = await q(qy);
  const ses = wo.map(w => ({ fecha: w.fecha, s: (w.sets || []).filter(x => x.ejercicio === nombre && !x.hecho) })).filter(x => x.s.length);
  const best = ses.flatMap(x => x.s.map(y => ({ ...y, fecha: x.fecha, e: e1rm(y.kg, y.reps, y.rir) }))).filter(y => y.e).sort((a, b) => b.e - a.e)[0];
  const top = ses.flatMap(x => x.s.map(y => ({ ...y, fecha: x.fecha }))).filter(y => num(y.kg) != null).sort((a, b) => b.kg - a.kg)[0];
  sheet(`<h2>${esc(nombre)}</h2>${ses.length ? `<div class="kpis"><div class="kpi"><span>Última vez</span><b>${esc(fdate(ses[0].fecha))}</b><em>${ses[0].s.length} series</em></div><div class="kpi"><span>Mayor carga</span><b>${top ? fmt(top.kg) + " kg" : "—"}</b><em>${top ? `${esc(top.reps ?? "?")} reps · ${esc(fdate(top.fecha))}` : ""}</em></div><div class="kpi"><span>Mejor 1RM estimado</span><b>${best ? fmt(best.e) + " kg" : "—"}</b><em>${best ? "con " + esc(kgTxt(best.kg)) + " × " + esc(best.reps) + (best.rir != null ? " · RIR " + esc(best.rir) : "") : ""}</em></div></div>
  ${lineChart(ses.map(x => ({ x: x.fecha, y: Math.max(...x.s.map(y => e1rm(y.kg, y.reps, y.rir) || 0)) || null, tip: x.s.map(y => `${y.kg ?? "?"}×${y.reps ?? "?"}`).join(" ") })), { label: "1RM estimado", unit: "kg", empty: "Hace falta registrar al menos dos días para ver la evolución" })}
  <div class="tbl"><table class="htab"><thead><tr><th>Fecha</th><th>Series · carga × reps · RIR</th><th class="n">1RM est.</th></tr></thead><tbody>${ses.slice(0, 20).map(x => `<tr><td style="white-space:nowrap">${esc(fdate(x.fecha, { day: "numeric", month: "short" }))}</td><td><div class="spw">${x.s.map(setPill).join("")}</div></td><td class="n"><b>${(() => { const e = Math.max(...x.s.map(y => e1rm(y.kg, y.reps, y.rir) || 0)); return e ? fmt(e) + " kg" : "—"; })()}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted">Aún no hay registros de este ejercicio.</p>`}<button class="btn" data-act="close">Cerrar</button>`);
}
function saveDraftFrom(el) {
  const f = el.closest("#f-workout"); if (!f) return; const id = f.dataset.id; let d = {}; try { d = JSON.parse(localStorage.getItem(draftKey(id)) || "{}"); } catch { }
  if (el.dataset.k) { const o = d[el.dataset.k] || {}; o[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; d[el.dataset.k] = o; } else if (["rpe", "dur", "com"].includes(el.name)) d[el.name] = el.value;
  try { localStorage.setItem(draftKey(id), JSON.stringify(d)); } catch { }
}
// Vista del cliente para un ejercicio programado serie a serie: solo ve lo que se le pauta
function presClient(e, ei, prev, draft, wo) {
  const cols = e.cols || []; const ss = e.series;
  const best = wo.flatMap(w => (w.sets || []).filter(x => x.ejercicio === e.nombre)).map(x => e1rm(x.kg, x.reps, x.rir)).filter(Boolean);
  const rm = best.length ? Math.max(...best) : null; const r125 = v => Math.round(v / 1.25) * 1.25;
  const eff = cols.includes("rpe") ? ["rpe", "RPE"] : cols.includes("rpe_e") ? ["esf", "Esfuerzo"] : ["rir", "RIR"];
  const topI = ss.findIndex(x => x.tipo === "top");
  const pg = progTxt(e.prog, prev ? Math.max(...prev.s.map(x => num(x.kg)).filter(x => x != null), -Infinity) : null);
  const rows = ss.map((x, si) => {
    const k = `${ei}-${si}`; const dv = draft[k] || {}; const pv = prev && prev.s[si];
    let kgPh = x.kg || (cols.includes("pct") && x.pct && rm ? fmt(r125(rm * x.pct / 100)) : "") || (pv && pv.kg != null ? pv.kg : "kg");
    const top = (x.tipo === "backoff" && topI >= 0 && x.rel ? ` data-rel="${esc(x.rel)}" data-ei="${ei}"` : "") + (x.kg || (cols.includes("pct") && x.pct && rm) || (x.tipo === "backoff" && x.rel) ? " data-plan" : "");
    const inp = (f, ph, mode = "decimal", extra = "") => `<label><span>${ph}</span><input inputmode="${mode}" data-k="${k}" data-f="${f}" value="${esc(dv[f] ?? "")}" placeholder="${esc(f === "kg" ? kgPh : (pv && pv[f] != null ? pv[f] : ""))}"${extra} aria-label="${ph} serie ${si + 1}"></label>`;
    return `<div class="pset t-${esc(x.tipo)}"><div class="pl"><span class="n">${si + 1}</span>${x.tipo !== "normal" ? `<span class="ptag">${esc(pTipo(x.tipo))}</span>` : ""}<span class="pt">${esc(presTarget(x, cols, { rm }))}</span></div>${x.nota ? `<div class="tiny muted pnote">${esc(x.nota)}</div>` : ""}
      <div class="pin">${inp("kg", "Kg", "decimal", (si === topI ? ` data-top data-ei="${ei}"` : "") + top)}${inp("reps", x.tipo === "iso" ? "Seg." : x.tipo === "cluster" ? "Reps tot." : "Reps", "numeric")}${inp(eff[0], eff[1], "decimal")}${cols.includes("vel") || cols.includes("vl") ? inp("vel", "m/s", "decimal") : ""}</div></div>`;
  }).join("");
  const mk = exMarks(e.nombre, wo, prev);
  return `<div class="ex"><div>${e.bloque ? `<span class="chip">${esc(e.bloque)}</span> ` : ""}<h3 style="display:inline">${esc(e.nombre)}</h3> <button type="button" class="btn ghost sm hist" data-act="ex-hist" data-n="${esc(e.nombre)}">Historial</button>${pg ? `<div class="prog">🎯 ${esc(pg.t)}</div>` : ""}${e.descanso && e.descanso !== "—" ? `<div class="target">Descanso ${esc(e.descanso)}</div>` : ""}${e.notas ? `<div class="tiny muted" style="margin-top:4px">${esc(e.notas)}</div>` : ""}${safeUrl(e.video) ? `<a class="vbtn" href="${esc(safeUrl(e.video))}" target="_blank" rel="noopener noreferrer">▶ Vídeo</a>` : ""}</div>
${mk.html}
  <div class="psets">${rows}</div>
  ${eff[0] === "rpe" ? `<p class="tiny muted" style="margin:6px 0 0">RPE: 10 = no podías hacer ni una más · 9 = te quedaba 1 · 8 = te quedaban 2.</p>` : eff[0] === "esf" ? `<p class="tiny muted" style="margin:6px 0 0">Esfuerzo: cómo de dura te ha parecido la serie, de 0 a 10.</p>` : ""}</div>`;
}
function topSync(el) { // back-off: se calcula con lo que levantas en el top set
  const kg = num(el.value); document.querySelectorAll(`[data-rel][data-ei="${el.dataset.ei}"]`).forEach(i => { i.placeholder = kg ? fmt(Math.round(kg * num(i.dataset.rel) / 100 / 1.25) * 1.25) : "kg"; });
}
async function saveWorkout(f) {
  const id = f.dataset.id; const a = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; if (!a) return;
  const sets = [];
  ((a.contenido || {}).ejercicios || []).forEach((e, ei) => {
    if (e.series && e.series.length) { e.series.forEach((x, si) => { const g = fld => { const el = f.querySelector(`[data-k="${ei}-${si}"][data-f="${fld}"]`); return el ? num(el.value) : null; }; let kg = g("kg"); const reps = g("reps"), rpe = g("rpe"), esf = g("esf"), vel = g("vel"); let rir = g("rir");
      if (kg == null) { const el = f.querySelector(`[data-k="${ei}-${si}"][data-f="kg"]`); if (el && el.dataset.plan != null && reps != null && num(el.placeholder) != null) kg = num(el.placeholder); }
      if (rir == null && rpe != null) rir = Math.max(0, 10 - rpe);
      if (kg != null || reps != null) { const o = { ejercicio: e.nombre, serie: si + 1, kg, reps, rir }; if (rpe != null) o.rpe = rpe; if (esf != null) o.esf = esf; if (vel != null) o.vel = vel; if (x.tipo && x.tipo !== "normal") o.tipo = x.tipo; sets.push(o); } }); return; }
    const n = seriesOf(e.sxr);
    if (!n) { const c = f.querySelector(`[data-k="${ei}-done"]`); if (c && c.checked) sets.push({ ejercicio: e.nombre, serie: 1, hecho: true }); return; }
    for (let si = 0; si < n; si++) { const g = fld => { const el = f.querySelector(`[data-k="${ei}-${si}"][data-f="${fld}"]`); return el ? num(el.value) : null; }; const kg = g("kg"), reps = g("reps"), rir = g("rir"); if (kg != null || reps != null) sets.push({ ejercicio: e.nombre, serie: si + 1, kg, reps, rir }); }
  });
  if (!sets.length && a.tipo === "workout" && ((a.contenido || {}).ejercicios || []).length) { toast("Apunta al menos una serie"); return; }
  const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    await op({ t: "insert", table: "workouts", row: { client_id: S.me.cid, fecha: today(), dia: a.titulo, sets, rpe_sesion: num(f.rpe.value), duracion_min: num(f.dur.value), comentario: f.com.value.trim(), assignment_id: id } });
    await op({ t: "rpc", fn: "completar_asignacion", args: { p_id: id, p_hecho: true, p_respuesta: f.com.value.trim() } });
    try { localStorage.removeItem(draftKey(id)); } catch { } toast(savedMsg("¡Entreno guardado!")); location.hash = "hoy";
  } catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ================= Cliente: Nutrición ================= */

function openWellness(prev, c = {}) {
  const w = prev || {}; S.sub.well = { ...w }; const on = k => !(c.campos) || c.campos.includes(k);
  sheet(`<h2>¿Cómo estás hoy?</h2><p class="small muted" style="margin:0">${c.detalle ? esc(c.detalle) + " " : ""}Toca un número del 1 al 5. El 5 siempre es lo mejor.</p>
  <form id="f-well" class="col" style="display:flex;flex-direction:column;gap:14px">
  ${WK.map(([k, l, a, b]) => `<div><div class="small" style="font-weight:700;margin-bottom:6px">${l}</div><div class="scale" role="group" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="scale" data-k="${k}" data-v="${n}" aria-pressed="${num(w[k]) === n}">${n}</button>`).join("")}</div><div class="anchors"><span>${a}</span><span>${b}</span></div></div>`).join("")}
  <div class="grid2">${on("sueno_h") ? `<div class="f"><label for="w-h">Horas dormidas</label><input id="w-h" name="sueno_h" inputmode="decimal" value="${esc(w.sueno_h ?? "")}" placeholder="7,5"></div>` : ""}${on("fc") ? `<div class="f"><label for="w-fc">Pulso en reposo</label><input id="w-fc" name="fc" inputmode="numeric" value="${esc(w.fc ?? "")}" placeholder="lpm, nada más despertar"></div>` : ""}${on("hrv") ? `<div class="f"><label for="w-hrv">HRV / VFC en ms</label><input id="w-hrv" name="hrv" inputmode="numeric" value="${esc(w.hrv ?? "")}" placeholder="La que marque tu reloj"></div>` : ""}${on("apetito") ? `<div class="f"><label for="w-ap">Apetito</label><select id="w-ap" name="apetito"><option value="">—</option>${[[1, "1 · Sin ganas de comer"], [2, "2 · Poco apetito"], [3, "3 · Normal"], [4, "4 · Más hambre de lo normal"], [5, "5 · Hambre voraz"]].map(([v, l]) => `<option value="${v}" ${num(w.apetito) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}${c.campos && on("peso") ? `<div class="f"><label for="w-kg">Peso en ayunas (kg)</label><input id="w-kg" name="kg" inputmode="decimal" placeholder="80,5"></div>` : ""}</div>
  ${on("molestia") ? `<div class="grid2"><div class="f"><label for="w-mz">¿Alguna molestia? Zona</label><input id="w-mz" name="molestia_zona" value="${esc(w.molestia_zona || "")}" placeholder="Rodilla derecha"></div><div class="f"><label for="w-mi">Dolor 0–10</label><input id="w-mi" name="molestia_0a10" inputmode="numeric" value="${esc(w.molestia_0a10 ?? "")}"></div></div>` : ""}
  ${on("comentario") ? `<div class="f"><label for="w-c">Comentario (opcional)</label><textarea id="w-c" name="comentario" maxlength="1000">${esc(w.comentario || "")}</textarea></div>` : ""}
  <button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveWellness(f) {
  const v = S.sub.well || {}; const missing = WK.filter(([k]) => num(v[k]) == null);
  if (missing.length === WK.length) { toast("Marca al menos una respuesta"); return; }
  const val = n => f[n] ? f[n].value : null; const prev = S.sub.well || {};
  const row = { client_id: S.me.cid, fecha: today(), comentario: f.comentario ? f.comentario.value.trim() : (prev.comentario || ""), molestia_zona: f.molestia_zona ? f.molestia_zona.value.trim() : (prev.molestia_zona || "") };
  ["sueno_h", "fc", "hrv", "apetito", "molestia_0a10"].forEach(k => { row[k] = f[k] ? num(val(k)) : (prev[k] ?? null); });
  WK.forEach(([k]) => row[k] = num(v[k]));
  const kg = f.kg ? num(f.kg.value) : null; if (kg != null && (kg < 25 || kg > 350)) { toast("Revisa el peso"); return; }
  try { await op({ t: "upsert", table: "wellness", row, oc: "client_id,fecha" });
    if (kg != null) { await op({ t: "upsert", table: "weights", row: { client_id: S.me.cid, fecha: today(), kg }, oc: "client_id,fecha" }); await completarAccion("peso"); }
    // completa los formularios de wellness pendientes (hoy o atrasados)
    try { const xs = await q(sb.from("assignments").select("id,contenido").eq("tipo", "formulario").eq("hecho", false).lte("fecha", today()).gte("fecha", addDays(today(), -14)));
      for (const x of xs.filter(x => (x.contenido || {}).wellness)) await op({ t: "rpc", fn: "completar_asignacion", args: { p_id: x.id, p_hecho: true, p_respuesta: "", p_resultado: null } }); } catch { }
    sheet(""); toast(savedMsg("Guardado. ¡Gracias!")); route(); } catch (e) { toast(errMsg(e)); }
}
function openPeso(c = {}) {
  const mom = { ayunas: "Por la mañana, en ayunas y después de ir al baño.", libre: "Cuando puedas, pero intenta que sea siempre a la misma hora.", noche: "Por la noche, antes de dormir." }[c.momento || "ayunas"];
  sheet(`<h2>Peso de hoy</h2><div class="tips"><p>⏰ ${esc(mom)}</p>${c.misma_bascula !== false ? `<p>⚖️ Siempre con la misma báscula y en suelo duro (nada de alfombras).</p>` : ""}<p>📈 Lo que cuenta es la media de la semana, no un día suelto.</p></div>${c.detalle ? `<p class="small" style="white-space:pre-wrap;margin:0">${esc(c.detalle)}</p>` : ""}
  <form id="f-peso" style="display:flex;flex-direction:column;gap:12px"><div class="f"><label for="kg">Kilos</label><input id="kg" name="kg" inputmode="decimal" placeholder="80,5" required></div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
  $("#kg").focus();
}
async function savePeso(f) { const kg = num(f.kg.value); if (kg == null || kg < 25 || kg > 350) { toast("Escribe un peso válido"); return; } try { await op({ t: "upsert", table: "weights", row: { client_id: S.me.cid, fecha: today(), kg }, oc: "client_id,fecha" }); await completarAccion("peso"); sheet(""); toast(savedMsg("Peso guardado")); route(); } catch (e) { toast(errMsg(e)); } }

/* ================= Cliente: Progreso ================= */
async function viewProgreso() {
  loading("Progreso"); const plan = await getPlan();
  const vis = Array.isArray(plan.progreso_visible) ? plan.progreso_visible : ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"];
  const segs = [["fuerza", "Cargas"], ["peso", "Peso"], ["bienestar", "Bienestar"], ["medidas", "Medidas"], ["tests", "Tests"], ["fotos", "Fotos"]].filter(([k]) => vis.includes(k));
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
    body = testsHTML(ts, false);
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
    body = exs.length ? `<div class="card"><h2>1RM estimado</h2><select id="ex-sel" aria-label="Ejercicio">${exs.map(x => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>${lineChart(pts, { label: "1RM estimado", unit: "kg" })}<p class="tiny muted">Es el peso que podrías levantar una sola vez, calculado a partir de tu mejor serie de cada día (kilos, repeticiones y las que te quedaban). Sirve para comparar días aunque cambien los kilos o las repeticiones.</p></div>` : `<div class="empty">Registra entrenos con kilos para ver cómo suben tus cargas.</div>`;
  } else if (tab === "medidas") {
    const ms = await q(sb.from("measurements").select("*").order("fecha", { ascending: false }).limit(30));
    body = `<div class="card"><h2>Medidas <small>cm</small></h2>${ms.length ? `<div class="tbl">${medTable(ms)}</div>` : `<div class="empty">Sin medidas todavía.</div>`}<button class="btn pri block" style="margin-top:10px" data-act="medidas">Añadir medidas</button></div>`;
  } else {
    const ph = await q(sb.from("photos").select("*").order("fecha", { ascending: false }).limit(30));
    let urls = {}; if (ph.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ph.map(p => p.path), 600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); }
    body = `<div class="card"><h2>Fotos de progreso</h2><p class="tiny muted" style="margin-top:0">Solo las ves tú y Adrián. Misma luz, misma ropa y misma hora para poder comparar.</p>${ph.length ? `<div class="photos">${ph.map(p => urls[p.path] ? `<figure style="margin:0"><img src="${esc(urls[p.path])}" alt="Foto de ${esc(p.vista)} del ${esc(fdate(p.fecha))}" loading="lazy"><figcaption class="tiny muted">${esc(fdate(p.fecha))} · ${esc(p.vista)}</figcaption></figure>` : "").join("")}</div>` : `<div class="empty">Aún no has subido fotos.</div>`}<button class="btn pri block" style="margin-top:10px" data-act="fotos">Subir fotos</button></div>`;
  }
  shell("Tu progreso", `<div class="seg" role="group" aria-label="Apartado">${segs.map(([k, l]) => `<button data-act="prog" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body}`);
}
// Tabla con solo las medidas que tienen algún dato
function medTable(ms) {
  const ks = MEDIDAS.map(m => m[0]).filter(k => ms.some(m => m[k] != null));
  return `<table><thead><tr><th>Fecha</th>${ks.map(k => `<th class="n">${esc(medLabel(k))}</th>`).join("")}</tr></thead><tbody>${ms.map(m => `<tr><td>${esc(fdate(m.fecha))}</td>${ks.map(k => `<td class="n">${fmt(m[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
// El cliente ve solo las medidas que le ha pedido Adrián (si no hay nada pedido, las básicas)
async function openMedidas(sel, c = {}) {
  if (!sel) { const p = await q(sb.from("assignments").select("contenido").eq("tipo", "medidas").eq("hecho", false).lte("fecha", today()).order("fecha", { ascending: false }).limit(1)).catch(() => []); sel = p[0] && (p[0].contenido || {}).medidas; }
  const ks = (sel && sel.length ? sel : MED_DEF).filter(k => MEDIDAS.some(m => m[0] === k));
  sheet(`<h2>Medidas</h2><p class="small muted" style="margin:0">Por la mañana, en ayunas, con cinta métrica pegada a la piel y sin apretar. Brazo, muslo y gemelo del lado <b>${esc(c.lado || "derecho")}</b>.</p>${c.detalle ? `<p class="small" style="margin:0">${esc(c.detalle)}</p>` : ""}
  <form id="f-med" data-ks="${esc(ks.join(","))}" style="display:flex;flex-direction:column;gap:10px"><div class="grid2">${ks.map(k => { const m = MEDIDAS.find(x => x[0] === k); return `<div class="f"><label for="m-${k}">${esc(m[1])}<br><span class="tiny muted" style="font-weight:400">${esc(m[2])}</span></label><input id="m-${k}" name="${k}" inputmode="decimal" placeholder="cm"></div>`; }).join("")}</div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveMedidas(f) { const row = { client_id: S.me.cid, fecha: today() }; let any = false; f.dataset.ks.split(",").filter(Boolean).forEach(k => { const v = num(f[k].value); row[k] = v; if (v != null) any = true; }); if (!any) { toast("Escribe al menos una medida"); return; } try { await op({ t: "insert", table: "measurements", row }); await completarAccion("medidas"); sheet(""); toast(savedMsg("Medidas guardadas")); route(); } catch (e) { toast(errMsg(e)); } }
function openFotos(c) {
  const vs = c && (c.vistas || []).length ? c.vistas : null;
  const conds = c ? (c.condiciones || []) : [];
  sheet(`<h2>Subir fotos</h2>${conds.length ? `<div class="tips">${conds.map(t => `<p>✓ ${esc(t)}</p>`).join("")}</div>` : ""}${c && c.detalle ? `<p class="small" style="white-space:pre-wrap;margin:0">${esc(c.detalle)}</p>` : ""}
  <form id="f-fotos" style="display:flex;flex-direction:column;gap:10px">
  ${vs ? vs.map(v => `<div class="f fotoin"><label for="ph-${v}">${esc((FOTO_V.find(x => x[0] === v) || [v, v])[1])}</label><input id="ph-${v}" type="file" accept="image/*" data-vista="${esc(v)}" required></div>`).join("")
    : `<div class="f"><label for="ph-v">Vista</label><select id="ph-v" name="vista">${FOTO_V.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}<option value="otra">Otra</option></select></div><div class="f"><label for="ph-f">Foto</label><input id="ph-f" type="file" accept="image/*" data-vista="" required></div>`}
  <p class="tiny muted" style="margin:0">Solo las ves tú y Adrián. Se reducen y se les quita la ubicación y los datos de la cámara antes de subirlas.</p>
  <button class="btn pri block">Subir</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
// Reduce la foto antes de subirla: lado largo máx. 1600 px, JPEG ~80 % (≈200–400 KB en vez de 3–5 MB)
async function shrink(file, max = 1600, calidad = 0.8) {
  try {
    let img; try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); }); }
    const w0 = img.width, h0 = img.height; const k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, c.width, c.height); if (img.close) img.close();
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", calidad));
    return blob && blob.size < file.size ? blob : (/jpe?g$/i.test(file.type) ? file : blob || file);
  } catch { return file; }
}
async function saveFotos(f) {
  if (!navigator.onLine) { toast("Las fotos necesitan conexión. Súbelas cuando tengas cobertura."); return; }
  const ins = [...f.querySelectorAll("input[type=file]")].filter(i => i.files[0]); if (!ins.length) return;
  const b = f.querySelector("button.pri"); b.disabled = true;
  try {
    for (const [k, i] of ins.entries()) { b.textContent = `Subiendo ${k + 1} de ${ins.length}…`; const vista = i.dataset.vista || f.vista.value; const blob = await shrink(i.files[0]); const path = `${S.me.cid}/${today()}-${vista}-${uid()}.jpg`;
      const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg", upsert: false }); if (error) throw error;
      await q(sb.from("photos").insert({ client_id: S.me.cid, fecha: today(), vista, path })); }
    await completarAccion("fotos"); sheet(""); toast(ins.length > 1 ? `${ins.length} fotos subidas` : "Foto subida"); route();
  } catch (e) { toast(errMsg(e)); b.disabled = false; b.textContent = "Subir"; }
}

/* ================= Cliente: Informes ================= */
async function viewInformes() {
  loading("Revisiones"); const rp = await q(sb.from("reports").select("id,fecha,semana,titular,leido_en,adjuntos,video_url,respuesta").order("fecha", { ascending: false }).limit(52));
  shell("Tus revisiones", `<p class="small muted" style="margin:0">Cada domingo Adrián revisa tu semana y te deja aquí su análisis, tu foco para la semana siguiente y, a veces, un vídeo o un archivo.</p>${rp.length ? `<div class="card"><div class="list">${rp.map(r => `<button class="it" data-act="go" data-h="informe-${esc(encodeURIComponent(r.id))}"><span class="grow"><b>${esc(r.titular || "Revisión semanal")}</b><br><span class="tiny muted">${esc(fdate(r.fecha, { day: "numeric", month: "long" }))}${r.semana ? " · " + esc(r.semana) : ""}${(r.adjuntos || []).length || r.video_url ? " · 📎 " + ((r.adjuntos || []).length + (r.video_url ? 1 : 0)) : ""}${r.respuesta ? " · Respondida" : ""}</span></span>${r.leido_en ? `<span aria-hidden="true" class="chev">›</span>` : `<span class="pnew">Nueva</span>`}</button>`).join("")}</div></div>` : `<div class="card empty">Aquí aparecerán las revisiones que te haga Adrián cada domingo.</div>`}`, { back: "hoy" });
}
function reportHTML(r) {
  const box = (cls, title, items) => { const it = (items || []).map(splitItem).filter(i => i.t); return it.length ? `<div class="box ${cls}"><h3>${title}</h3><ul>${it.map(i => `<li><b>${esc(i.t)}</b>${i.p ? `<span>${esc(i.p)}</span>` : ""}</li>`).join("")}</ul></div>` : ""; };
  const k = r.kpis || {}; const foco = (r.foco || []).map(splitItem).filter(i => i.t);
  return `<div class="card"><h2 style="font-size:20px">${esc(r.titular || "Tu semana")}</h2>
  ${Object.keys(k).length ? `<div class="kpis">${Object.entries(k).filter(([key]) => r.mostrar_peso || !/peso/i.test(key)).map(([key, val]) => `<div class="kpi"><span>${esc(key)}</span><b>${esc(val && val.valor != null ? val.valor : val)}</b>${val && val.nota ? `<em>${esc(val.nota)}</em>` : ""}</div>`).join("")}</div>` : ""}</div>
  ${box("ok", "Lo que has hecho bien", r.logros)}${box("acc", "A mejorar", r.mejorar)}${box("dark", "A tener en cuenta", r.tener_en_cuenta)}
  ${foco.length ? `<div class="card"><h2>Tu foco para la semana que viene</h2><ol class="steps">${foco.map(i => `<li><div><b>${esc(i.t)}</b>${i.p ? `<span>${esc(i.p)}</span>` : ""}</div></li>`).join("")}</ol></div>` : ""}
  ${r.mensaje ? `<div class="card"><h2>Mensaje de Adrián</h2><p class="small" style="margin:0;white-space:pre-wrap">${esc(r.mensaje)}</p></div>` : ""}
  `;
}
async function viewInforme(id) {
  loading("Informe"); const rows = await q(sb.from("reports").select("*").eq("id", id).limit(1)); const r = rows[0];
  if (!r) { shell("Informe", `<div class="empty">Este informe no está disponible.</div>`, { back: "informes" }); return; }
  const adj = r.adjuntos || []; let urls = {};
  if (adj.length) { try { const { data } = await sb.storage.from("revisiones").createSignedUrls(adj.map(a => a.path), 3600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); } catch { } }
  const vid = safeUrl(r.video_url);
  const media = (vid || adj.length) ? `<div class="card"><h2>Material de la revisión</h2><div class="adjv">${vid ? `<a class="plink" href="${esc(vid)}" target="_blank" rel="noopener noreferrer"><span>🎬 Vídeo de Adrián</span><b>Ver vídeo ↗</b></a>` : ""}${adj.map(a => { const u = urls[a.path]; if (!u) return ""; if (/^image/.test(a.tipo)) return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="adjimg"><img src="${esc(u)}" alt="${esc(a.nombre)}" loading="lazy"></a>`; if (/^video/.test(a.tipo)) return `<video controls playsinline preload="metadata" src="${esc(u)}"></video>`; if (/^audio/.test(a.tipo)) return `<div class="adja"><span>🎙️ ${esc(a.nombre)}</span><audio controls preload="none" src="${esc(u)}"></audio></div>`; return `<a class="plink" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${adjIco(a.tipo)} ${esc(a.nombre)}</span><b>Abrir ↗</b></a>`; }).join("")}</div></div>` : "";
  const resp = `<div class="card"><h2>¿Algo que comentar?</h2><p class="tiny muted" style="margin:0 0 8px">Tu respuesta le llega a Adrián junto a esta revisión.</p>${r.respuesta ? `<div class="rresp mine"><b>Tu respuesta</b> <span class="tiny muted">${esc(relTime(r.respondido_en))}</span><p>${esc(r.respuesta)}</p></div>` : ""}<textarea id="rev-r" maxlength="3000" placeholder="Dudas, cómo te has sentido, algo que quieras cambiar…">${esc(r.respuesta || "")}</textarea><button class="btn pri block" style="margin-top:10px" data-act="rev-resp" data-id="${esc(r.id)}">${r.respuesta ? "Actualizar respuesta" : "Enviar a Adrián"}</button></div>`;
  shell("Tu revisión", reportHTML(r) + media + resp, { back: "informes", sub: `${fdate(r.fecha, { day: "numeric", month: "long" })}${r.semana ? " · " + r.semana : ""}` });
  if (!r.leido_en) { try { await q(sb.rpc("revision_leida", { p_id: r.id })); } catch { } }
}

/* ================= Perfil ================= */
async function viewMas() {
  const wa = (CFG.whatsappEntrenador || "").replace(/\D/g, "");
  const coach = S.me.role === "coach"; const plan = coach ? null : await getPlan(); const bkc = coach ? await backupCard() : "";
  shell("Perfil", `<div class="card pcard">${avatar(S.me.nombre || "?")}<div><h2>${esc(S.me.nombre || "")}</h2><p class="small muted" style="margin:0">${esc(S.email)}${coach ? " · Entrenador" : ""}</p></div></div>
  <div class="card menu-l">${coach ? "" : `<button class="it" data-act="go" data-h="informes"><span><b>Mis revisiones</b></span><span class="chev">›</span></button>`}${!coach && wa ? `<a class="it" href="https://wa.me/${wa}" target="_blank" rel="noopener"><span><b>Escribir a Adrián</b></span><span class="chev">›</span></a>` : ""}<button class="it" data-act="cambiar-pw"><span><b>Cambiar contraseña</b></span><span class="chev">›</span></button><button class="it danger" data-act="logout"><span><b>Cerrar sesión</b></span></button></div>
  ${bkc}
  <p class="tiny muted foot">Tus datos solo los ves tú y Adrián.<br>Para instalar la app: iPhone → Compartir → «Añadir a pantalla de inicio» · Android → menú ⋮ → «Instalar aplicación».</p>`, coach ? {} : { back: "hoy" });
}
/* ================= Copias de seguridad ================= */
const BK_ORDEN = ["clients", "plans", "exercises", "foods", "recipes", "workout_templates", "programs", "assignments", "workouts", "wellness", "weights", "measurements", "photos", "meal_logs", "tests", "events", "reports", "reviews", "payments", "leads", "onboarding", "posts", "post_reads", "post_reactions"];
const BK_PK = { plans: "client_id", onboarding: "client_id", post_reads: "post_id,client_id", post_reactions: "post_id,client_id,emoji", exercises: "nombre" };
const kb = n => n > 1048576 ? fmt(n / 1048576, 1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
async function backupCard() {
  const log = await q(sb.from("backup_log").select("*").order("creado", { ascending: false }).limit(8)).catch(() => []);
  const ok = log.find(x => x.ok); const dias = ok ? Math.floor((Date.now() - new Date(ok.creado)) / 864e5) : null;
  return `<div class="card bk"><h2 class="hh">${ICON.key || ""}Copias de seguridad</h2>
  <div class="bkst ${ok && dias <= 2 ? "ok" : "warn"}"><b>${ok ? `Última copia: ${esc(relTime(ok.creado))}` : "Aún no hay ninguna copia"}</b><span>${ok ? `${esc(ok.origen === "auto" ? "Automática" : "Desde la app")} · ${ok.filas} registros · ${ok.archivos} fotos · ${esc(kb(ok.bytes))}` : "Haz la primera ahora."}</span></div>
  <p class="small muted" style="margin:0">La copia incluye todos los datos (clientes, planificación, entrenos, bienestar, peso, medidas, fotos, nutrición, comunidad…) y la estructura de la base de datos. Va <b>cifrada</b> con tu contraseña de copias: sin ella nadie puede abrirla.</p>
  <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn pri" data-act="bk-now">Hacer copia y descargar</button><button class="btn" data-act="bk-restore">Restaurar desde una copia</button></div>
  ${log.length ? `<details class="bklog"><summary class="tiny muted">Historial</summary>${log.map(x => `<div class="tiny"><span class="${x.ok ? "" : "bad"}">${x.ok ? "✓" : "✕"}</span> ${esc(new Date(x.creado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))} · ${esc(x.origen)}${x.ok ? " · " + esc(kb(x.bytes)) : " · " + esc((x.nota || "").slice(0, 120))}</div>`).join("")}</details>` : ""}</div>`;
}
async function backupNow(b) {
  b.disabled = true; const t0 = b.textContent; b.textContent = "Creando copia…";
  try {
    const { data, error } = await sb.functions.invoke("backup", { method: "POST", body: {} });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch { } throw new Error(m); }
    const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `arc-backup-${today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast("Copia creada y descargada"); route();
  } catch (e) { toast("No se pudo crear la copia: " + (e.message || e)); b.disabled = false; b.textContent = t0; }
}
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function descifrar(env, pass) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(env.salt), iterations: env.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.datos));
  const txt = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(txt);
}
function openRestore() {
  sheet(`<h2>Restaurar desde una copia</h2>
  <p class="small muted" style="margin:0">Elige el archivo <b>arc-backup-….json</b> y escribe tu contraseña de copias. Antes de tocar nada verás lo que contiene.</p>
  <form id="f-restore" style="display:flex;flex-direction:column;gap:12px"><div class="f"><label for="bk-f">Archivo de copia</label><input id="bk-f" name="archivo" type="file" accept=".json,application/json" required></div>
  ${pwField("pass", "Contraseña de copias", "off")}
  <div id="bk-prev"></div><button class="btn pri block">Abrir copia</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function restoreOpen(f) {
  const b = f.querySelector("button.pri"); const box = $("#bk-prev");
  if (S.bk && f.dataset.ready) return restoreRun(b);
  const file = f.archivo.files[0]; if (!file) return;
  b.disabled = true; b.textContent = "Descifrando…";
  try { const env = JSON.parse(await file.text()); if (env.formato !== "arc-backup-v1") throw new Error("No es una copia de esta app");
    S.bk = await descifrar(env, f.pass.value);
    const otro = S.bk.proyecto && CFG.supabaseUrl && S.bk.proyecto !== CFG.supabaseUrl;
    const tot = Object.values(S.bk.tablas).reduce((a, r) => a + r.length, 0);
    box.innerHTML = `<div class="bkst ok"><b>Copia del ${esc(new Date(S.bk.creado).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</b><span>${tot} registros · ${Object.keys(S.bk.archivos || {}).length} fotos${otro ? " · de otro proyecto: las cuentas de los clientes se volverán a vincular con su código de alta" : ""}</span></div>
    <div class="bktab">${BK_ORDEN.filter(t => (S.bk.tablas[t] || []).length).map(t => `<span>${esc(t)} <b>${S.bk.tablas[t].length}</b></span>`).join("")}</div>
    <p class="small" style="margin:0">Al restaurar se <b>recuperan y sobrescriben</b> los registros de la copia. No se borra nada que se haya creado después.</p>`;
    f.dataset.ready = "1"; f.pass.closest(".f").hidden = true; f.archivo.closest(".f").hidden = true; b.textContent = "Restaurar ahora"; b.disabled = false;
  } catch (e) { b.disabled = false; b.textContent = "Abrir copia"; box.innerHTML = `<div class="banner">${esc(/decrypt|operation/i.test(String(e)) ? "Contraseña incorrecta o archivo dañado." : (e.message || String(e)))}</div>`; }
}
async function restoreRun(b) {
  const bk = S.bk; const otro = bk.proyecto && CFG.supabaseUrl && bk.proyecto !== CFG.supabaseUrl; b.disabled = true; const box = $("#bk-prev"); let hechos = 0, fallos = [];
  for (const t of BK_ORDEN) {
    let rows = (bk.tablas[t] || []).map(r => ({ ...r })); if (!rows.length) continue;
    if (t === "clients" && otro) rows = rows.map(r => ({ ...r, user_id: null }));
    for (let i = 0; i < rows.length; i += 400) {
      b.textContent = `Restaurando ${t}… (${Math.min(i + 400, rows.length)}/${rows.length})`;
      try { await q(sb.from(t).upsert(rows.slice(i, i + 400), { onConflict: BK_PK[t] || "id" })); hechos += Math.min(400, rows.length - i); } catch (e) { fallos.push(`${t}: ${errMsg(e)}`); break; }
    }
  }
  const fs = Object.entries(bk.archivos || {}); let nf = 0;
  for (const [p, d] of fs) { const i = p.indexOf("/"); b.textContent = `Restaurando fotos… (${++nf}/${fs.length})`;
    try { const { error } = await sb.storage.from(p.slice(0, i)).upload(p.slice(i + 1), new Blob([unb64(d)]), { upsert: true, contentType: /\.png$/i.test(p) ? "image/png" : "image/jpeg" }); if (error) throw error; } catch (e) { fallos.push(`${p}: ${e.message || e}`); } }
  S.bk = null;
  box.innerHTML = fallos.length ? `<div class="banner">Restaurado con avisos (${hechos} registros). Revisa:<br>${fallos.slice(0, 8).map(esc).join("<br>")}</div>` : `<div class="bkst ok"><b>¡Restauración completa!</b><span>${hechos} registros y ${fs.length} fotos recuperados.</span></div>`;
  b.textContent = "Hecho"; b.dataset.act = "close"; b.type = "button"; b.disabled = false; toast("Restauración terminada");
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
/* ================= Programación avanzada por series ================= */
const P_COLS = [["kg", "Carga (kg)"], ["rir", "RIR"], ["rpe", "RPE carga"], ["rpe_e", "RPE esfuerzo"], ["pct", "%1RM"], ["vel", "Velocidad (m/s)"], ["vl", "%VL"], ["tempo", "Tempo"]];
const P_TIPOS = [["normal", "Serie"], ["aprox", "Aproximación"], ["top", "Top set"], ["backoff", "Back-off"], ["amrap", "AMRAP"], ["drop", "Drop set"], ["cluster", "Cluster"], ["rp", "Rest-pause"], ["myo", "Myo-reps"], ["iso", "Isométrico (s)"]];
const P_HINT = { rpe: "6–10 (10 = sin repeticiones en reserva)", rpe_e: "Esfuerzo percibido 0–10", vel: "Velocidad media propulsiva objetivo", vl: "Corta la serie al perder este % de velocidad", pct: "Se calcula con su 1RM estimado", tempo: "Excéntrica-pausa-concéntrica-pausa, p. ej. 3-1-1-0" };
const pTipo = k => (P_TIPOS.find(t => t[0] === k) || P_TIPOS[0])[1];
// Resumen corto de la programación (lo que se ve en calendario, listados…)
function presSummary(p) {
  const ss = (p && p.series) || []; if (!ss.length) return "";
  const allSame = ss.every(x => x.tipo === ss[0].tipo && x.reps === ss[0].reps);
  if (allSame && ss[0].tipo === "normal") return `${ss.length}×${ss[0].reps || "?"}`;
  const g = []; ss.forEach(x => { const l = g[g.length - 1]; const rr = x.tipo === "cluster" ? (x.cl_n && x.cl_r ? `${x.cl_n}×${x.cl_r}` : "") : x.reps; if (l && l.t === x.tipo && l.r === rr) l.n++; else g.push({ t: x.tipo, r: x.tipo === "cluster" ? (x.cl_n && x.cl_r ? `${x.cl_n}×${x.cl_r}` : "") : x.reps, n: 1 }); });
  return g.map(z => `${z.n > 1 ? z.n + "×" : ""}${z.t === "normal" ? "" : pTipo(z.t) + " "}${z.r || ""}`.trim()).join(" + ");
}
// Texto del objetivo de una serie para el cliente
function presTarget(x, cols, ctx = {}) {
  const p = [];
  if (x.tipo === "cluster") p.push(`${x.cl_n || "?"} bloques × ${x.cl_r || "?"} reps${x.cl_p ? ` · ${x.cl_p}″ entre bloques` : ""}`);
  else if (x.tipo === "iso") p.push(`${x.reps || "?"} s`);
  else if (x.tipo === "amrap") p.push(`máximas reps${x.reps ? " (≥ " + x.reps + ")" : ""}`);
  else if (x.reps) p.push(`${x.reps} reps`);
  if (cols.includes("kg") && x.kg) p.push(`${x.kg} kg`);
  if (cols.includes("pct") && x.pct) p.push(`${x.pct} % 1RM${ctx.rm ? ` ≈ ${fmt(Math.round(ctx.rm * x.pct / 100 / 1.25) * 1.25)} kg` : ""}`);
  if (x.tipo === "backoff" && x.rel) p.push(`${x.rel} % del top set`);
  if (cols.includes("rir") && x.rir !== "" && x.rir != null) p.push(`RIR ${x.rir}`);
  if (cols.includes("rpe") && x.rpe) p.push(`RPE ${x.rpe}`);
  if (cols.includes("rpe_e") && x.rpe_e) p.push(`esfuerzo ${x.rpe_e}/10`);
  if (cols.includes("vel") && x.vel) p.push(`${x.vel} m/s`);
  if (cols.includes("vl") && x.vl) p.push(`para al perder ${x.vl} % de velocidad`);
  if (cols.includes("tempo") && x.tempo) p.push(`tempo ${x.tempo}`);
  if (x.desc) p.push(`descanso ${x.desc}`);
  return p.join(" · ");
}
function presRow(x = {}, cols, i) {
  const c = k => cols.includes(k);
  const LB = { reps: "Reps", kg: "Kg", pct: "%1RM", rel: "% del top", rir: "RIR", rpe: "RPE", rpe_e: "Esfuerzo", vel: "m/s", vl: "%VL", tempo: "Tempo", desc: "Descanso", nota: "Nota", cl_n: "Bloques", cl_r: "Reps/bloque", cl_p: "Pausa (s)" };
  const inp = (k, ph, w = "") => `<label class="pf ${w}"><span>${k === "reps" && x.tipo === "iso" ? "Segundos" : k === "reps" && x.tipo === "amrap" ? "Mín. reps" : LB[k] || ph}</span><input data-p="${k}" value="${esc(x[k] ?? "")}" placeholder="${esc(ph)}" aria-label="${esc(LB[k] || ph)}"></label>`;
  return `<div class="prow" data-prow><span class="pn">${i + 1}</span>
    <label class="pf"><span>Tipo</span><select data-p="tipo" aria-label="Tipo de serie">${P_TIPOS.map(([k, l]) => `<option value="${k}" ${(x.tipo || "normal") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    ${(x.tipo || "normal") === "cluster" ? `${inp("cl_n", "4", "s")}${inp("cl_r", "2", "s")}${inp("cl_p", "20", "s")}` : inp("reps", x.tipo === "iso" ? "30" : "8", "s")}
    ${c("kg") ? inp("kg", "kg", "s") : ""}${c("pct") ? inp("pct", "%1RM", "s") : ""}${(x.tipo || "") === "backoff" ? inp("rel", "% top", "s") : ""}${c("rir") ? inp("rir", "RIR", "s") : ""}${c("rpe") ? inp("rpe", "RPE", "s") : ""}${c("rpe_e") ? inp("rpe_e", "esfuerzo", "s") : ""}${c("vel") ? inp("vel", "m/s", "s") : ""}${c("vl") ? inp("vl", "%VL", "s") : ""}${c("tempo") ? inp("tempo", "3-1-1-0", "m") : ""}
    ${inp("desc", "2'", "s")}${inp("nota", "opcional", "m")}
    <button type="button" class="btn ghost sm" data-act="p-dup" aria-label="Duplicar serie">⧉</button><button type="button" class="btn ghost sm" data-act="p-del" aria-label="Quitar serie">✕</button></div>`;
}
function presPanel(p = {}) {
  const cols = p.cols && p.cols.length ? p.cols : ["kg", "rir"]; const ss = p.series || [];
  return `<div class="presp" data-pres><div class="pcols"><span class="tiny muted">Qué le indicas:</span>${P_COLS.map(([k, l]) => `<label class="pchk" title="${esc(P_HINT[k] || "")}"><input type="checkbox" data-pc="${k}" ${cols.includes(k) ? "checked" : ""}>${l}</label>`).join("")}</div>
    <div class="prows">${ss.map((x, i) => presRow(x, cols, i)).join("")}</div>
    <div class="ptools"><button type="button" class="btn sm" data-act="p-add">+ Serie</button><span class="tiny muted">Plantillas:</span><button type="button" class="btn ghost sm" data-act="p-tpl" data-t="recto">Series iguales</button><button type="button" class="btn ghost sm" data-act="p-tpl" data-t="topbo">Top set + back-offs</button><button type="button" class="btn ghost sm" data-act="p-tpl" data-t="aprox">Aproximaciones + efectivas</button><button type="button" class="btn ghost sm" data-act="p-tpl" data-t="piram">Pirámide</button><button type="button" class="btn ghost sm" data-act="p-tpl" data-t="cluster">Clusters</button>${ss.length ? `<span class="grow"></span><button type="button" class="btn ghost sm" data-act="p-clear" style="color:var(--bad)">Quitar programación por series</button>` : ""}</div></div>`;
}
function readPres(row) {
  const pn = row.querySelector("[data-pres]"); if (!pn) return null;
  const cols = [...pn.querySelectorAll("[data-pc]:checked")].map(i => i.dataset.pc);
  const series = [...pn.querySelectorAll("[data-prow]")].map(r => { const o = {}; r.querySelectorAll("[data-p]").forEach(i => { const v = i.value.trim(); if (v !== "") o[i.dataset.p] = v; }); o.tipo = o.tipo || "normal"; return o; });
  return series.length ? { cols, series } : null;
}
function presRerender(pn, mutate) {
  const row = pn.closest("[data-row]"); const cur = readPres(row) || { cols: [...pn.querySelectorAll("[data-pc]:checked")].map(i => i.dataset.pc), series: [] };
  const nx = mutate ? mutate(cur) : cur; pn.outerHTML = presPanel(nx); presSync(row);
}
function presSync(row) { // la casilla de series×reps muestra el resumen
  const p = readPres(row); const sx = row.querySelector('[name="r_sxr"]'); const btn = row.querySelector('[data-act="p-toggle"]');
  if (sx) { sx.readOnly = !!p; if (p) sx.value = presSummary(p); }
  if (btn) btn.classList.toggle("on", !!p);
}
const P_TPL = {
  recto: c => ({ ...c, series: Array.from({ length: 4 }, () => ({ tipo: "normal", reps: "8", rir: "2" })) }),
  topbo: c => ({ cols: [...new Set([...c.cols.filter(k => k !== "rir"), "rpe"])], series: [{ tipo: "top", reps: "3", rpe: "8" }, ...Array.from({ length: 3 }, () => ({ tipo: "backoff", reps: "5", rel: "88", rpe: "7" }))] }),
  aprox: c => ({ cols: [...new Set([...c.cols, "pct"])], series: [{ tipo: "aprox", reps: "5", pct: "50" }, { tipo: "aprox", reps: "3", pct: "65" }, { tipo: "aprox", reps: "1", pct: "75" }, ...Array.from({ length: 3 }, () => ({ tipo: "normal", reps: "5", pct: "82", rir: "2" }))] }),
  piram: c => ({ ...c, series: [{ tipo: "normal", reps: "10", rir: "3" }, { tipo: "normal", reps: "8", rir: "2" }, { tipo: "normal", reps: "6", rir: "1" }, { tipo: "normal", reps: "8", rir: "1" }] }),
  cluster: c => ({ cols: [...new Set([...c.cols, "pct"])], series: Array.from({ length: 3 }, () => ({ tipo: "cluster", cl_n: "4", cl_r: "2", cl_p: "20", pct: "85", desc: "3'" })) })
};

function wRow(e = {}) {
  return `<div class="wrow" data-row><input name="r_b" value="${esc(e.bloque || "")}" placeholder="A1" aria-label="Bloque" class="rb"><input name="r_n" list="dl-ex" value="${esc(e.nombre || "")}" placeholder="Ejercicio" aria-label="Ejercicio" class="rn"><input name="r_sxr" value="${esc(e.series && e.series.length ? presSummary(e) : (e.sxr || ""))}" ${e.series && e.series.length ? "readonly" : ""} placeholder="3×8–10" aria-label="Series × reps"><input name="r_rir" value="${esc(e.rir || "")}" placeholder="RIR" aria-label="RIR o RPE"><input name="r_des" value="${esc(e.descanso || "")}" placeholder="Descanso" aria-label="Descanso"><select name="r_prog" class="rprog" aria-label="Progresión de carga">${PROG.map(([v, l]) => `<option value="${v}" ${(e.prog || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select><input name="r_not" value="${esc(e.notas || "")}" placeholder="Notas técnicas" aria-label="Notas técnicas" class="rnot"><span class="ra"><button type="button" class="btn ghost sm" data-act="w-up" aria-label="Subir">↑</button><button type="button" class="btn ghost sm" data-act="w-down" aria-label="Bajar">↓</button><button type="button" class="btn ghost sm" data-act="w-del" aria-label="Quitar">✕</button></span><button type="button" class="pbtn ${e.series && e.series.length ? "on" : ""}" data-act="p-toggle">⚙︎ Programar por series<small>Top set, back-off, clusters, %1RM, RPE, velocidad…</small></button>${e.series && e.series.length ? presPanel(e) : ""}</div>`;
}
function wEditor(c = {}, tipo = "workout") {
  if (tipo === "cardio") return cardioEditor(c);
  return `<div class="wed"><div class="f"><label>Calentamiento</label><textarea name="w_cal" style="min-height:60px">${esc(c.calentamiento || "")}</textarea></div>
  <div class="whead tiny muted"><span>Bloque</span><span>Ejercicio</span><span>Series×reps</span><span>RIR/RPE</span><span>Descanso</span></div>
  <div class="wrows">${((c.ejercicios && c.ejercicios.length) ? c.ejercicios : [{}]).map(wRow).join("")}</div>
  <button type="button" class="btn sm" data-act="w-add">+ Ejercicio</button>
  <div class="f"><label>Notas del workout</label><textarea name="w_not" style="min-height:60px">${esc(c.notas || "")}</textarea></div></div>`;
}
function readWEditor(root, tipo) {
  if (tipo === "cardio") return readCardio(root);
  const vid = n => { const e = (S.lib.ex || []).find(x => x.nombre.toLowerCase() === n.toLowerCase()); return e && e.video_url ? e.video_url : ""; };
  const ejercicios = [...root.querySelectorAll("[data-row]")].map(r => { const g = n => r.querySelector(`[name="${n}"]`).value.trim(); const nombre = g("r_n"); const o = { bloque: g("r_b"), nombre, sxr: g("r_sxr"), rir: g("r_rir"), descanso: g("r_des"), notas: g("r_not"), prog: (r.querySelector('[name="r_prog"]') || {}).value || "", video: vid(nombre) }; const pr = readPres(r); return pr ? { ...o, cols: pr.cols, series: pr.series, sxr: presSummary(pr) } : o; }).filter(e => e.nombre);
  return { calentamiento: root.querySelector('[name="w_cal"]').value.trim(), notas: root.querySelector('[name="w_not"]').value.trim(), ejercicios };
}
async function newExercisesFrom(c) { // añade a la librería los ejercicios escritos a mano
  const known = new Set((S.lib.ex || []).map(e => e.nombre.toLowerCase()));
  const nuevos = [...new Set((c.ejercicios || []).map(e => e.nombre).filter(n => n && !known.has(n.toLowerCase()) && !/^finisher/i.test(n)))];
  if (nuevos.length) { try { await q(sb.from("exercises").upsert(nuevos.map(nombre => ({ nombre })), { onConflict: "nombre", ignoreDuplicates: true })); await exLib(true); } catch { } }
}

/* ================= Entrenador: Inicio ================= */
async function viewInicio() {
  loading("Inicio"); const t = today(); const sinceTs = new Date(Date.now() - 7 * 864e5).toISOString();
  const WKC = WK.map(([k]) => k).join(",");
  const [cl, wo, wl, ws, as, asAll, ev, leads, onb, drafts, resp] = await Promise.all([loadClients(),
    q(sb.from("workouts").select("client_id,dia,created_at").gte("created_at", sinceTs)),
    q(sb.from("wellness").select(`client_id,fecha,created_at,molestia_zona,molestia_0a10,${WKC}`).gte("created_at", sinceTs)),
    q(sb.from("weights").select("client_id,kg,created_at").gte("created_at", sinceTs)),
    q(sb.from("assignments").select("client_id,titulo,tipo,hecho_en").eq("hecho", true).neq("tipo", "workout").gte("hecho_en", sinceTs)),
    q(sb.from("assignments").select("client_id,fecha,hecho,visible").gte("fecha", addDays(monday(t), -28)).lte("fecha", addDays(t, 120))),
    q(sb.from("events").select("*").gte("fecha", t).lte("fecha", addDays(t, 45)).order("fecha")),
    q(sb.from("leads").select("id,nombre,objetivo,estado,created_at").order("created_at", { ascending: false }).limit(30)).catch(() => []),
    q(sb.from("onboarding").select("client_id,enviado_en,revisado").eq("revisado", false)).catch(() => []),
    q(sb.from("reports").select("id,client_id,fecha").eq("publicado", false)).catch(() => []), q(sb.from("reports").select("id,client_id,respondido_en").gte("respondido_en", sinceTs)).catch(() => [])]);
  const activos = cl.filter(c => c.estado === "activo"); const mon = monday(t);
  const pct = (cid, from) => { const r = asAll.filter(x => x.client_id === cid && x.visible && x.fecha >= from && x.fecha <= t); return r.length ? Math.round(100 * r.filter(x => x.hecho).length / r.length) : null; };
  const hasta = cid => asAll.filter(x => x.client_id === cid).map(x => x.fecha).sort().pop();
  const act = [...wo.map(x => ({ c: x.client_id, ts: x.created_at, t: x.dia || "Entreno", k: "Workout" })), ...wl.map(x => ({ c: x.client_id, ts: x.created_at, t: "Cuestionario diario", k: "Formulario" })), ...ws.map(x => ({ c: x.client_id, ts: x.created_at, t: `Peso: ${fmt(x.kg)} kg`, k: "Evolución" })), ...as.map(x => ({ c: x.client_id, ts: x.hecho_en, t: x.titulo, k: TIPOS[x.tipo] || "Tarea" })), ...resp.map(x => ({ c: x.client_id, ts: x.respondido_en, t: "Ha respondido a su revisión", k: "Revisión" }))].filter(a => a.ts).sort((a, b) => b.ts.localeCompare(a.ts));
  const ultimo = cid => (act.find(a => a.c === cid) || {}).ts;
  const well7 = cid => { const v = wl.filter(w => w.client_id === cid).map(wellIdx).filter(x => x != null); return v.length ? avg(v) : null; };
  // ---- Lo que requiere atención, por prioridad
  const at = [];
  const go = (cid, tab) => `data-act="go-tab" data-cid="${esc(cid)}" data-t="${tab}"`;
  wl.filter(w => w.molestia_zona && num(w.molestia_0a10) >= 4 && w.fecha >= addDays(t, -3)).forEach(w => at.push({ p: 0, k: "bad", c: w.client_id, t: `Molestia: ${w.molestia_zona} (${w.molestia_0a10}/10)`, s: `${clientName(w.client_id)} · ${fdate(w.fecha, { weekday: "short", day: "numeric" })}`, a: go(w.client_id, "evo"), b: "Ver" }));
  activos.forEach(c => { const v = wl.filter(w => w.client_id === c.id && w.fecha >= addDays(t, -3)).map(wellIdx).filter(x => x != null); if (v.length && avg(v) < 2.5) at.push({ p: 1, k: "bad", c: c.id, t: "Bienestar bajo los últimos días", s: `${c.nombre} · ${fmt(avg(v), 1)} de 5`, a: go(c.id, "evo"), b: "Ver" }); });
  leads.filter(l => l.estado === "nuevo").forEach(l => at.push({ p: 2, k: "acc", c: null, n: l.nombre, t: "Nueva solicitud de contacto", s: `${l.nombre} · ${l.objetivo || "sin objetivo"} · ${relTime(l.created_at)}`, a: `data-act="lead" data-id="${esc(l.id)}"`, b: "Responder" }));
  onb.forEach(o => at.push({ p: 3, k: "acc", c: o.client_id, t: "Cuestionario inicial sin revisar", s: `${clientName(o.client_id)} · ${relTime(o.enviado_en)}`, a: `data-act="go-inicial" data-cid="${esc(o.client_id)}"`, b: "Revisar" }));
  resp.forEach(r => at.push({ p: 2, k: "info", c: r.client_id, t: "Ha respondido a su revisión", s: `${clientName(r.client_id)} · ${relTime(r.respondido_en)}`, a: go(r.client_id, "informes"), b: "Leer" }));
  activos.forEach(c => { const f = hasta(c.id); const d = f ? daysBetween(t, f) : null; if (d == null || d <= 3) at.push({ p: 4, k: "warn", c: c.id, t: d == null ? "No tiene nada programado" : d < 0 ? `Sin tareas desde hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "Se queda sin tareas hoy" : `Se queda sin tareas en ${d} día${d === 1 ? "" : "s"}`, s: c.nombre, a: `data-act="go-plan" data-cid="${esc(c.id)}"`, b: "Planificar" }); });
  activos.filter(c => c.user_id && !ultimo(c.id)).forEach(c => at.push({ p: 5, k: "warn", c: c.id, t: "Sin registrar nada en 7 días", s: c.nombre, a: go(c.id, "plan"), b: "Ver" }));
  drafts.forEach(r => at.push({ p: 6, k: "info", c: r.client_id, t: "Informe en borrador", s: `${clientName(r.client_id)} · ${fdate(r.fecha, { day: "numeric", month: "short" })}`, a: go(r.client_id, "informes"), b: "Publicar" }));
  at.sort((a, b) => a.p - b.p);
  // ---- KPIs
  const sem = activos.map(c => pct(c.id, mon)).filter(x => x != null); const semAvg = sem.length ? Math.round(avg(sem)) : null;
  const usanApp = activos.filter(c => c.user_id).length;
  const kc = v => v == null ? "" : v >= 80 ? "ok" : v >= 50 ? "warn" : "bad";
  const h = new Date().getHours(); const saludo = h < 13 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  // ---- Actividad agrupada por día
  const grupo = ts => { const d = daysBetween(iso(new Date(ts)), t); return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : "Esta semana"; };
  const feed = act.slice(0, 14); let lastG = "";
  const feedHTML = feed.map(a => { const g = grupo(a.ts); const hd = g !== lastG ? `<div class="fg">${g}</div>` : ""; lastG = g; return `${hd}<button class="fi" data-act="go" data-h="c-${esc(encodeURIComponent(a.c))}">${avatar(clientName(a.c), "sm")}<span class="grow"><b>${esc(clientName(a.c))}</b> · ${esc(a.t)}<br><span class="tag tag-${esc(slug(a.k))}">${esc(a.k)}</span> <span class="tiny muted">${esc(new Date(a.ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }))}</span></span></button>`; }).join("");
  const link = location.origin + location.pathname.replace(/[^/]*$/, "") + "empezar";
  const leadsAbiertos = leads.filter(l => l.estado === "nuevo" || l.estado === "contactado");
  shell("Inicio", `<div class="home">
  <section class="hhead"><div><h1>${saludo}, Adrián</h1><p>${esc(cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })))}</p></div>
    <div class="hq"><button class="btn sm dark" data-act="new-client"><span class="plus">+</span>Cliente</button><button class="btn sm" data-act="go" data-h="lib-w-new">+ Workout</button><button class="btn sm" data-act="go" data-h="lib-p-new">+ Programa</button><button class="btn sm" data-act="go" data-h="lib">${ICON.lib}Librería</button></div></section>
  <div class="kgrid">
    <button class="ktile" data-act="go" data-h="c"><span>Clientes activos</span><b>${activos.length}</b><em>${usanApp} usan la app</em></button>
    <div class="ktile"><span>Cumplimiento semanal</span><b class="${kc(semAvg)}">${semAvg == null ? "—" : semAvg + " %"}</b><div class="kbar"><i class="${kc(semAvg)}" style="width:${semAvg || 0}%"></i></div></div>
    <div class="ktile"><span>Entrenos registrados</span><b>${wo.length}</b><em>últimos 7 días · ${wl.length} cuestionarios</em></div>
    <div class="ktile ${at.length ? "hot" : ""}"><span>Pendiente de ti</span><b>${at.length}</b><em>${at.length ? "mira la lista de abajo" : "todo al día"}</em></div>
  </div>
  <div class="hgrid"><div class="hmain">
    <section class="card"><h2 class="hh">${ICON.progreso}Requiere tu atención <span class="cnt">${at.length}</span></h2>
      ${at.length ? `<div class="att">${at.map(x => `<button class="ai ${x.k}" ${x.a}><i class="ab"></i>${avatar(x.c ? clientName(x.c) : x.n || "?", "sm")}<span class="grow"><b>${esc(x.t)}</b><br><span class="tiny muted">${esc(x.s)}</span></span><span class="chip ${x.k === "bad" ? "bad" : x.k === "acc" ? "acc" : x.k === "warn" ? "warn" : ""}">${esc(x.b)}</span></button>`).join("")}</div>` : `<div class="allok">✓ Todo al día. Nada pendiente.</div>`}</section>
    <section class="card"><h2 class="hh">${ICON.clientes}Mis clientes <span class="cnt">${activos.length}</span></h2>
      ${activos.length ? `<div class="tbl"><table class="ctab"><thead><tr><th>Cliente</th><th>Esta semana</th><th class="n c-b">Bienestar</th><th class="c-u">Último registro</th><th>Plan hasta</th></tr></thead><tbody>${activos.map(c => { const s = pct(c.id, mon), w = well7(c.id), u = ultimo(c.id), f = hasta(c.id), d = f ? daysBetween(t, f) : null;
        return `<tr data-act="go" data-h="c-${esc(encodeURIComponent(c.id))}"><td><span class="feedn">${avatar(c.nombre, "sm")}<span><span class="lnk">${esc(c.nombre)}</span><div class="tiny muted">${c.user_id ? "Usa la app" : "Sin cuenta todavía"}</div></span></span></td>
        <td><div class="mbar2"><div class="kbar"><i class="${kc(s)}" style="width:${s || 0}%"></i></div><span class="tiny">${s == null ? "—" : s + " %"}</span></div></td>
        <td class="n c-b">${w == null ? `<span class="tiny muted">—</span>` : `<span class="chip ${w >= 3.5 ? "ok" : w >= 2.5 ? "warn" : "bad"}">${fmt(w, 1)}</span>`}</td>
        <td class="tiny c-u ${u ? "" : "muted"}">${u ? esc(relTime(u)) : "Nada en 7 días"}</td>
        <td>${d == null ? `<span class="chip bad">Sin plan</span>` : `<span class="chip ${d <= 3 ? "warn" : "ok"}">${esc(fdate(f, { day: "numeric", month: "short" }))}</span>`}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">Aún no tienes clientes activos.</div>`}</section>
  </div><div class="hside">
    <section class="card embudo"><h2 class="hh">${ICON.clientes}Embudo <span class="cnt">${leadsAbiertos.length + onb.length}</span></h2>
      <div class="emb"><div><b>${leads.filter(l => l.estado === "nuevo").length}</b><span>nuevas</span></div><div><b>${leads.filter(l => l.estado === "contactado").length}</b><span>contactados</span></div><div><b>${leads.filter(l => l.estado === "alta").length}</b><span>altas</span></div></div>
      ${leadsAbiertos.length ? `<div class="list">${leadsAbiertos.slice(0, 4).map(l => `<button class="fi" data-act="lead" data-id="${esc(l.id)}">${avatar(l.nombre, "sm")}<span class="grow"><b>${esc(l.nombre)}</b><br><span class="tiny muted">${esc(l.objetivo || "Solicitud")} · ${esc(LEAD_EST[l.estado])}</span></span></button>`).join("")}</div>` : ""}
      <div class="elink"><span class="tiny muted">Tu enlace para Instagram</span><div class="row"><code class="sel grow">${esc(link.replace(/^https:\/\//, ""))}</code><button class="btn ghost sm" data-act="copy-txt" data-t="${esc(link)}">Copiar</button></div></div></section>
    <section class="card"><h2 class="hh">${ICON.cal}Próximos eventos <span class="cnt">${ev.length}</span></h2>${ev.length ? `<div class="evl">${ev.slice(0, 6).map(e => `<button class="evi" data-act="go" data-h="c-${esc(encodeURIComponent(e.client_id))}"><span class="evd"><b>${esc(fdate(e.fecha, { day: "numeric" }))}</b><span>${esc(fdate(e.fecha, { month: "short" }))}</span></span><span class="grow"><b>${esc(e.titulo)}</b><br><span class="tiny muted">${esc(clientName(e.client_id))} · ${esc(EV_TIPOS[e.tipo] || "")}${daysBetween(t, e.fecha) >= 0 ? " · en " + daysBetween(t, e.fecha) + " días" : ""}</span></span></button>`).join("")}</div>` : `<p class="small muted" style="margin:0">Nada en las próximas semanas.</p>`}</section>
    <section class="card"><h2 class="hh">${ICON.evo}Actividad reciente <span class="cnt">${act.length}</span></h2>${feed.length ? `<div class="feedl">${feedHTML}</div>` : `<div class="empty">Sin actividad esta semana.</div>`}</section>
  </div></div></div>`);
}

/* ================= Embudo: Contacto (público) y Cuestionario inicial ================= */
const OBJ_CONTACTO = ["Ganar masa muscular", "Perder grasa", "Ganar fuerza", "Mejorar mi salud/hábitos", "Mejorar mi resistencia/cardio"];
const COMIENZO = [
  { b: "Datos personales y generales", i: "Vamos a empezar por lo básico. Quiero ponerle cara y contexto a la persona con la que voy a trabajar, y entender cómo es tu día a día.", q: [
    { k: "nombre", t: "Nombre y apellidos", y: "t", r: 1 }, { k: "edad", t: "Edad", y: "n", r: 1 },
    { k: "sexo", t: "Sexo", y: "r", o: ["Hombre", "Mujer", "Prefiero no especificarlo"], r: 1 },
    { k: "altura", t: "Altura (cm)", y: "n", r: 1 }, { k: "peso", t: "Peso actual (kg)", y: "n", r: 1 },
    { k: "peso_obj", t: "¿Tienes en mente un peso objetivo o de referencia? Coméntame cuál y por qué", y: "l", r: 1 },
    { k: "profesion", t: "¿A qué te dedicas? (profesión/ocupación)", y: "t", r: 1 },
    { k: "jornada", t: "¿Cómo es tu jornada laboral en cuanto a actividad física?", y: "r", r: 1, o: ["Predominantemente sentado/a (oficina, teletrabajo, conducción...)", "Predominantemente de pie, pero sin gran esfuerzo físico", "Actividad física moderada (caminar mucho, cargar peso ocasionalmente)", "Actividad física intensa (trabajo físico exigente, esfuerzo constante)"] },
    { k: "dia_normal", t: "Describe brevemente un día normal de tu semana (horario laboral, comidas, momentos libres...)", y: "l", r: 1 },
    { k: "como_conociste", t: "¿Cómo me conociste y qué te ha hecho decidirte a empezar esta asesoría?", y: "l", r: 1 }] },
  { b: "Salud, lesiones y condiciones médicas", i: "Esta parte es clave para tu seguridad. Quiero conocer tu historial para elegir los ejercicios adecuados y evitar cualquier movimiento que pueda perjudicarte. Ante la duda, cuéntamelo todo, siempre podemos adaptar.", q: [
    { k: "lesion", t: "¿Tienes actualmente alguna lesión o molestia (aunque sea leve)?", y: "r", o: ["Sí", "No"], r: 1 },
    { k: "lesion_det", t: "Descríbela (zona, tipo de dolor, cuándo aparece y desde cuándo la sufres)", y: "l", r: 1, if: ["lesion", "Sí"] },
    { k: "lesiones_pasadas", t: "¿Has sufrido lesiones importantes en el pasado (aunque ya estén recuperadas)? Indica zona y tipo.", y: "l", r: 1 },
    { k: "cirugias", t: "¿Te has sometido a alguna cirugía u operación? ¿Cuál y cuándo?", y: "l", r: 1 },
    { k: "enfermedad", t: "¿Padeces alguna enfermedad, patología o condición médica diagnosticada?", y: "r", o: ["Sí", "No"], r: 1 },
    { k: "enfermedad_det", t: "Especifica cuál/es y si tienes alguna limitación indicada por tu médico", y: "l", r: 1, if: ["enfermedad", "Sí"] },
    { k: "medicacion", t: "¿Tomas algún medicamento de forma habitual?", y: "r", o: ["Sí", "No"], r: 1 },
    { k: "medicacion_det", t: "Indica cuál y para qué", y: "l", r: 1, if: ["medicacion", "Sí"] },
    { k: "molestias_ej", t: "¿Hay algún ejercicio o movimiento que sepas, por experiencia, que te genera molestias?", y: "l", r: 1 }] },
  { b: "Experiencia y hábitos de entrenamiento", i: "Ahora vamos a hablar de tu relación con el entrenamiento de fuerza. Esto me permite poner el punto de partida exacto, sin quedarme corto ni pasarme.", q: [
    { k: "entrena", t: "¿Entrenas actualmente o has entrenado en los últimos 3 meses?", y: "r", r: 1, o: ["Sí, de forma regular", "Sí, pero de forma irregular", "No, llevo un tiempo parado/a"] },
    { k: "exp_fuerza", t: "¿Cuánto tiempo llevas entrenando fuerza de forma continua?", y: "r", r: 1, o: ["Nunca he entrenado fuerza", "Menos de 3 meses", "Entre 3 y 6 meses", "Entre 6 meses y 1 año", "Entre 1 y 3 años", "Más de 3 años"] },
    { k: "entrenador_previo", t: "¿Has trabajado antes con un entrenador personal (presencial u online)?", y: "r", o: ["Sí", "No"], r: 1 },
    { k: "entrenador_exp", t: "¿Qué fue lo que más te gustó y lo que menos de esa experiencia?", y: "l", if: ["entrenador_previo", "Sí"] },
    { k: "basicos", t: "¿Qué ejercicios básicos dominas técnicamente? (marca los que haces con confianza)", y: "c", r: 1, o: ["Sentadilla libre", "Peso muerto", "Press de banca", "Press militar", "Dominadas", "Remo", "Ninguno de los anteriores / no estoy seguro"] },
    { k: "otros_deportes", t: "¿Has entrenado otras disciplinas deportivas (pasadas o presentes)?", y: "l", r: 1 },
    { k: "forma", t: "¿Cómo puntuarías tu nivel de forma física general en este momento?", y: "s", min: 0, max: 10, a: ["Empiezo de cero", "Mi mejor forma"], r: 1 }] },
  { b: "Objetivos y disponibilidad", i: "Vamos a hablar del «para qué» y el «cómo»: tu objetivo principal y el contexto real en el que vas a entrenar.", q: [
    { k: "objetivos", t: "¿Cuáles son tus objetivos?", y: "c", r: 1, otro: 1, o: ["Ganar masa muscular (hipertrofia)", "Perder grasa corporal", "Ganar fuerza", "Mejorar mi salud y mis hábitos", "Preparación para una competición o evento específico"] },
    { k: "objetivos_sec", t: "Si tienes objetivos secundarios, cuéntame cuáles", y: "l" },
    { k: "lugar", t: "¿Dónde vas a entrenar principalmente?", y: "r", r: 1, o: ["Gimnasio completo", "Gimnasio pequeño con equipamiento limitado", "En casa con material básico", "En casa sin apenas material", "Parque de calistenia / Peso corporal", "Combinación de varios de los anteriores"] },
    { k: "horario", t: "¿Tu horario laboral es fijo o rotativo/irregular?", y: "r", r: 1, o: ["Fijo y estable", "Rotativo/turnos", "Irregular (viajes, cambios frecuentes...)"] },
    { k: "dias", t: "¿Cuántos días a la semana puedes comprometerte a entrenar de forma realista?", y: "r", r: 1, o: ["2 días", "3 días", "4 días", "5 días", "6 días"] },
    { k: "tiempo", t: "¿Cuánto tiempo tienes disponible por sesión?", y: "r", r: 1, o: ["Menos de 30 minutos", "30-45 minutos", "45-60 minutos", "60-75 minutos", "Más de 75 minutos"] },
    { k: "franjas", t: "¿Hay franjas horarias del día que prefieras o que te condicionen (mañana, mediodía, noche)?", y: "t", r: 1 }] },
  { b: "Estilo de vida, descanso y estrés", i: "El entrenamiento es solo una pieza del puzle. Lo que haces el resto del día influye directamente en tus resultados y en cómo debo dosificar tu carga.", q: [
    { k: "neat", t: "¿Cómo describirías tu nivel de actividad diaria fuera del entrenamiento?", y: "r", r: 1, o: ["Muy bajo (paso la mayor parte del día sentado/a)", "Bajo (algo de movimiento, pero mayormente sedentario)", "Moderado (camino con regularidad, me muevo bastante)", "Alto (trabajo físico o vida muy activa)"] },
    { k: "pasos", t: "Si usas reloj o móvil para contar pasos, ¿cuántos das de media al día?", y: "n" },
    { k: "alimentacion", t: "¿Consideras que llevas una alimentación equilibrada actualmente?", y: "r", r: 1, o: ["Sí, cuido bastante mi alimentación", "Más o menos, tengo margen de mejora", "No, mi alimentación es bastante desordenada"] },
    { k: "habitos_alim", t: "Cuéntame un poco más sobre tus hábitos alimentarios (número de comidas, restricciones, alergias, intolerancias, si sigues alguna dieta particular...)", y: "l", r: 1 },
    { k: "sueno_h", t: "¿Cuántas horas duermes de media por noche?", y: "r", r: 1, o: ["Menos de 5 horas", "Entre 5 y 6 horas", "Entre 6 y 7 horas", "Entre 7 y 8 horas", "Más de 8 horas"] },
    { k: "sueno_cal", t: "¿Cómo calificarías la calidad de tu sueño?", y: "r", r: 1, o: ["Duermo mal, me cuesta conciliar el sueño o me despierto varias veces", "Duermo de forma irregular", "Duermo bien la mayoría de las noches", "Duermo muy bien y me levanto descansado/a"] },
    { k: "estres", t: "¿Cómo describirías tu nivel de estrés habitual?", y: "r", r: 1, o: ["Bajo, llevo una vida bastante tranquila", "Moderado, tengo días buenos y días más intensos", "Alto, vivo con estrés de forma frecuente", "Muy alto, siento que el estrés me desborda"] },
    { k: "relacion", t: "¿Cuál es tu relación actual con el ejercicio físico?", y: "r", r: 1, o: ["Me encanta, disfruto entrenando", "Me gusta, aunque no siempre tengo ganas", "Me resulta indiferente, pero cumplo porque sé que es bueno para mí", "Me cuesta motivarme, lo veo más como una obligación", "Tengo una relación complicada con el ejercicio"] },
    { k: "dificultades", t: "¿Hay algo de tu estilo de vida actual que creas que puede dificultar seguir el plan? Cuéntamelo con confianza", y: "l", r: 1 }] },
  { b: "Adherencia, motivación y mentalidad", i: "Y para cerrar, lo más importante: tú. Cómo te sientes, qué esperas de este proceso y qué necesitas para mantenerte constante.", q: [
    { k: "animo", t: "¿Cómo describirías tu estado de ánimo habitual en el último mes?", y: "r", r: 1, o: ["Alegre y con energía", "Tranquilo/a y relajado/a", "Cambiante, con altibajos frecuentes", "Estresado/a", "Desanimado/a con poca energía"] },
    { k: "valoras", t: "¿Qué es lo que más valoras en un proceso de entrenamiento?", y: "r", r: 1, o: ["Ver resultados visibles", "Sentirme acompañado/a y guiado/a", "Aprender y entender el porqué de lo que hago", "Disfrutar del proceso, no solo del resultado", "Tener una estructura clara", "Flexibilidad para adaptar el plan a mi día a día"] },
    { k: "motivacion", t: "Del 1 al 10, ¿cómo valorarías tu motivación actual para empezar este proceso?", y: "s", min: 1, max: 10, a: ["Muy poca", "Al máximo"], r: 1 },
    { k: "abandono", t: "¿Qué es lo que más veces te ha hecho abandonar un plan de entrenamiento en el pasado (si te ha pasado)?", y: "l", r: 1 },
    { k: "espera", t: "¿Qué esperas conseguir exactamente con esta programación (resultados físicos, sensaciones, hábitos, plazos...)?", y: "l", r: 1 },
    { k: "comunicacion", t: "¿Cómo prefieres que sea la comunicación conmigo durante el proceso?", y: "r", r: 1, o: ["Contacto frecuente y cercano (dudas, seguimiento constante)", "Contacto puntual, prefiero autonomía y consultar solo si es necesario", "Un punto intermedio"] },
    { k: "algo_mas", t: "¿Hay algo más que quieras contarme y que creas importante para entenderte mejor antes de empezar?", y: "l" }] }];
const COM_Q = COMIENZO.flatMap(b => b.q);
// Avisos para Adrián a partir del cuestionario inicial
function comienzoAlertas(r = {}) {
  const a = [];
  if (r.lesion === "Sí") a.push(["bad", "Lesión o molestia actual: " + (r.lesion_det || "sin detallar") + " → valorar fisioterapeuta antes de cargar la zona"]);
  if (r.enfermedad === "Sí") a.push(["bad", "Condición médica: " + (r.enfermedad_det || "sin detallar") + " → confirmar con su médico si hay limitaciones"]);
  if (r.medicacion === "Sí") a.push(["warn", "Medicación habitual: " + (r.medicacion_det || "sin detallar")]);
  if (r.cirugias && !/^\s*(no|ninguna|nada)\b/i.test(r.cirugias)) a.push(["warn", "Cirugías: " + r.cirugias]);
  if (r.sueno_h === "Menos de 5 horas") a.push(["warn", "Duerme menos de 5 h"]);
  if (/^Muy alto/.test(r.estres || "")) a.push(["warn", "Estrés muy alto"]);
  if (/^Desanimado/.test(r.animo || "")) a.push(["warn", "Ánimo bajo el último mes: tenerlo en cuenta y preguntar con tacto"]);
  if (/complicada/.test(r.relacion || "")) a.push(["warn", "Relación complicada con el ejercicio"]);
  if (/desordenada/.test(r.alimentacion || "")) a.push(["warn", "Alimentación desordenada: si hay algo más que hábitos, derivar a dietista-nutricionista"]);
  return a;
}
const comAns = (q, v) => Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v);

/* ---- Página pública «Quiero empezar» ---- */
const OBJ_TXT = { "Mejorar mi salud/hábitos": "Salud y hábitos", "Mejorar mi resistencia/cardio": "Resistencia y cardio" };
const OBJ_ICO = { "Ganar masa muscular": "💪", "Perder grasa": "🔥", "Ganar fuerza": "🏋️", "Mejorar mi salud/hábitos": "🌿", "Mejorar mi resistencia/cardio": "🫀" };
function renderEmpezar(ok) {
  document.body.classList.add("pub");
  const wa = (CFG.whatsappEntrenador || "").replace(/\D/g, "");
  if (ok) { $("#app").innerHTML = `<div class="ctw"><header class="cth"><img src="./logo-blanco.png" alt="" class="ctlogo"><span class="ctbrand">Adrián Rodríguez Coaching</span></header>
    <section class="ctcard ctok"><div class="okmark" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
    <h1>¡Solicitud enviada!</h1><p class="ctlead">Gracias por dar el paso. Lo más difícil ya está hecho.</p>
    <ol class="ctsteps"><li><b>Reviso tu información</b><span>Leo con calma lo que me has contado.</span></li><li><b>Te escribo por WhatsApp</b><span>Para conocerte y resolver tus dudas.</span></li><li><b>Hablamos y empezamos</b><span>Vemos si encajamos y preparo tu plan.</span></li></ol>
    ${wa ? `<a class="btn pri block" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">Escribirme ya por WhatsApp</a>` : ""}</section>
    <p class="ctfoot">Adrián Rodríguez · Graduado en Ciencias de la Actividad Física y del Deporte</p></div>`; return; }
  const ch = (name, v, label, ico = "", req = false) => `<label class="ctch"><input type="radio" name="${name}" value="${esc(v)}" ${req ? "required" : ""}><span>${ico ? `<i>${ico}</i>` : ""}${esc(label)}</span></label>`;
  $("#app").innerHTML = `<div class="ctw"><header class="cth"><img src="./logo-blanco.png" alt="" class="ctlogo"><span class="ctbrand">Adrián Rodríguez Coaching</span></header>
  <section class="cthero"><span class="ctkick">Asesoría online 1:1</span><h1>Empieza tu cambio</h1>
  <p>Entrenamiento hecho para ti, tu cuerpo y tu vida, con seguimiento real cada semana. Cuéntame un poco sobre ti: en <b>2 minutos</b> lo tienes y te escribo personalmente para conocerte. Sin compromiso.</p>
  <div class="ctpills"><span>✓ Plan 100 % personalizado</span><span>✓ Revisión cada semana</span><span>✓ App propia</span></div></section>
  <form class="ctcard" id="f-contacto" novalidate>
  <div class="ctsec"><h2><i>1</i>Sobre ti</h2>
    <div class="f"><label for="ct-n">Nombre y apellidos</label><input id="ct-n" name="nombre" autocomplete="name" required maxlength="120" placeholder="Tu nombre"></div>
    <div class="ctrow"><div class="f"><label for="ct-e">Edad</label><input id="ct-e" name="edad" inputmode="numeric" required maxlength="3" placeholder="25"></div>
    <div class="f grow"><label>Sexo</label><div class="ctseg">${["Hombre", "Mujer", "Otro"].map((o, i) => `<label><input type="radio" name="sexo" value="${o}" ${i ? "" : "required"}><span>${o}</span></label>`).join("")}</div></div></div></div>
  <div class="ctsec"><h2><i>2</i>Cómo te contacto</h2>
    <div class="f"><label for="ct-t">WhatsApp</label><input id="ct-t" name="telefono" type="tel" autocomplete="tel" required maxlength="30" placeholder="600 000 000"></div>
    <div class="f"><label for="ct-m">Email</label><input id="ct-m" name="email" type="email" autocomplete="email" required maxlength="200" placeholder="tu@email.com"></div></div>
  <div class="ctsec"><h2><i>3</i>Tu objetivo principal</h2>
    <div class="ctgrid">${OBJ_CONTACTO.map((o, i) => ch("objetivo", o, OBJ_TXT[o] || o, OBJ_ICO[o] || "", !i)).join("")}${ch("objetivo", "__otro", "Otro", "✨")}</div>
    <input name="objetivo_otro" placeholder="¿Cuál es tu objetivo?" maxlength="150" hidden></div>
  <div class="ctsec"><h2><i>4</i>¿Has tenido entrenador personal antes?</h2>
    <div class="ctseg big"><label><input type="radio" name="previo" value="si" required><span>Sí</span></label><label><input type="radio" name="previo" value="no"><span>No, sería la primera vez</span></label></div></div>
  <div class="ctsec"><h2><i>5</i>Cuéntame qué buscas</h2>
    <div class="f"><textarea id="ct-x" name="mensaje" rows="5" required maxlength="2000" aria-label="Qué buscas" placeholder="Qué te gustaría conseguir, qué has probado antes y cuánto tiempo tienes para entrenar."></textarea></div></div>
  <input name="web" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  <label class="ctok2"><input type="checkbox" name="ok" required><span>Acepto que Adrián Rodríguez use estos datos solo para contactarme sobre las asesorías. Puedo pedir que se borren cuando quiera.</span></label>
  <button class="btn pri block ctsend">Quiero empezar <span aria-hidden="true">→</span></button></form>
  <p class="ctfoot">Adrián Rodríguez · Graduado en Ciencias de la Actividad Física y del Deporte</p></div>`;
  requestAnimationFrame(() => document.querySelectorAll("#app textarea").forEach(grow));
}
async function enviarContacto(f) {
  const v = n => (f[n] && f[n].value || "").trim(); const obj = (f.querySelector('[name="objetivo"]:checked') || {}).value || ""; const prev = (f.querySelector('[name="previo"]:checked') || {}).value || "";
  const edad = num(v("edad"));
  const falta = !v("nombre") ? "tu nombre" : !(edad >= 12 && edad <= 100) ? "tu edad" : !v("sexo") ? "el sexo" : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email")) ? "un email válido" : v("telefono").replace(/\D/g, "").length < 9 ? "un teléfono válido" : !obj || (obj === "__otro" && !v("objetivo_otro")) ? "tu objetivo" : !prev ? "si has tenido entrenador" : !v("mensaje") ? "qué buscas" : !f.ok.checked ? "aceptar el uso de tus datos" : "";
  if (falta) { toast("Falta " + falta); return; }
  const b = f.querySelector("button.pri"); b.disabled = true; b.textContent = "Enviando…";
  try { await q(sb.rpc("enviar_contacto", { p: { nombre: v("nombre"), edad: String(edad), sexo: v("sexo"), email: v("email"), telefono: v("telefono"), objetivo: obj === "__otro" ? v("objetivo_otro") : obj, entrenador_previo: prev, mensaje: v("mensaje"), web: v("web"), consentimiento: true } })); renderEmpezar(true); window.scrollTo(0, 0); }
  catch (e) { toast(errMsg(e)); b.disabled = false; b.innerHTML = "Quiero empezar <span aria-hidden=\"true\">→</span>"; }
}

/* ---- Entrenador: solicitudes ---- */
const LEAD_EST = { nuevo: "Nueva", contactado: "Contactado", alta: "Dado de alta", descartado: "Descartado" };
const telWa = t => { let d = String(t || "").replace(/\D/g, ""); if (d.length === 9) d = "34" + d; return d; };
async function openLead(id) {
  const l = (await q(sb.from("leads").select("*").eq("id", id).limit(1)))[0]; if (!l) return;
  const msg = `¡Hola ${l.nombre.split(" ")[0]}! Soy Adrián. He recibido tu mensaje sobre las asesorías 💪 ¿Te viene bien que hablemos un momento para contarte cómo funciona?`;
  sheet(`<h2>${esc(l.nombre)}</h2><p class="tiny muted" style="margin:0">${esc(relTime(l.created_at))} · ${esc(LEAD_EST[l.estado])}</p>
  <div class="tbl"><table><tbody>
  <tr><td>Edad / sexo</td><td>${esc(l.edad ?? "—")} · ${esc(l.sexo || "—")}</td></tr>
  <tr><td>Email</td><td>${esc(l.email)}</td></tr><tr><td>Teléfono</td><td>${esc(l.telefono || "—")}</td></tr>
  <tr><td>Objetivo</td><td>${esc(l.objetivo || "—")}</td></tr><tr><td>Entrenador antes</td><td>${l.entrenador_previo == null ? "—" : l.entrenador_previo ? "Sí" : "No"}</td></tr>
  </tbody></table></div>${l.mensaje ? `<div class="tips"><p style="white-space:pre-wrap">${esc(l.mensaje)}</p></div>` : ""}
  <div class="row" style="flex-wrap:wrap">${l.telefono ? `<a class="btn sm" href="https://wa.me/${telWa(l.telefono)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<a class="btn sm" href="mailto:${esc(l.email)}?subject=${encodeURIComponent("Asesorías · Adrián Rodríguez Coaching")}&body=${encodeURIComponent(msg)}">Email</a></div>
  <form id="f-lead" data-id="${esc(l.id)}" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="ld-e">Estado</label><select id="ld-e" name="estado">${Object.entries(LEAD_EST).filter(([k]) => k !== "alta" || l.estado === "alta").map(([k, v]) => `<option value="${k}" ${l.estado === k ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="f"><label for="ld-n">Notas (solo tú)</label><textarea id="ld-n" name="notas">${esc(l.notas || "")}</textarea></div>
  <button class="btn block">Guardar</button>
  ${l.estado !== "alta" ? `<button type="button" class="btn pri block" data-act="lead-alta" data-id="${esc(l.id)}">Dar de alta como cliente</button>` : l.client_id ? `<button type="button" class="btn block" data-act="go" data-h="c-${esc(encodeURIComponent(l.client_id))}">Ver cliente</button>` : ""}
  ${l.estado !== "alta" ? `<button type="button" class="btn ghost" data-act="lead-del" data-id="${esc(l.id)}" style="color:var(--bad)">Borrar solicitud y sus datos</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveLead(f) { try { await q(sb.from("leads").update({ estado: f.estado.value, notas: f.notas.value.trim() }).eq("id", f.dataset.id)); sheet(""); toast("Guardado"); route(); } catch (e) { toast(errMsg(e)); } }
async function leadAlta(id) {
  const l = (await q(sb.from("leads").select("*").eq("id", id).limit(1)))[0]; if (!l) return;
  if (!S.coach.list.length) await loadClients();
  const p = l.nombre.trim().split(/\s+/); let cid = slug(p[0] + "-" + (p[1] || "x").slice(0, 1)); if (S.coach.list.some(c => c.id === cid)) cid += "-" + Math.random().toString(36).slice(2, 5);
  const obj = /masa/i.test(l.objetivo) ? "hipertrofia" : /fuerza/i.test(l.objetivo) ? "fuerza" : /grasa|salud/i.test(l.objetivo) ? "salud" : "";
  try {
    const r = await q(sb.from("clients").insert({ id: cid, nombre: l.nombre, email: l.email, estado: "activo", ficha: { telefono: l.telefono, edad: l.edad != null ? String(l.edad) : "", sexo: l.sexo, fechaInicio: today(), ...(obj ? { perfil: obj } : {}), origen: "Contacto web", objetivo: l.objetivo || "" } }).select("id,codigo_alta"));
    await q(sb.from("plans").insert({ client_id: cid }));
    await q(sb.from("leads").update({ estado: "alta", client_id: cid }).eq("id", id));
    let cod = r && r[0] && r[0].codigo_alta; if (!cod) cod = ((await q(sb.from("clients").select("codigo_alta").eq("id", cid).limit(1)))[0] || {}).codigo_alta;
    S.coach.list = []; bienvenida({ id: cid, codigo_alta: cod || "(míralo en su pestaña Cuenta)", nombre: l.nombre, email: l.email, telefono: l.telefono });
  } catch (e) { toast(errMsg(e)); }
}
function bienvenida(c) {
  const url = location.origin + location.pathname.replace(/[^/]*$/, "");
  const txt = `¡Bienvenid@ ${c.nombre.split(" ")[0]}! 🎉 Ya tienes tu acceso a la app de las asesorías:\n\n1️⃣ Entra en ${url}\n2️⃣ Pulsa «Nuevo atleta»\n3️⃣ Pon este email: ${c.email}\n4️⃣ Crea tu contraseña y escribe el código: ${c.codigo_alta}\n\nLo primero que verás es el cuestionario inicial: tómate 10 minutos y sé lo más sincer@ posible. Con eso preparo tu plan. ¡Vamos a por ello! 💪`;
  sheet(`<h2>Cliente creado</h2><p class="small" style="margin:0">Mándale este mensaje. Al registrarse, lo primero que hará es el cuestionario inicial y te aparecerá en Inicio.</p>
  <textarea id="bv-t" style="min-height:220px" readonly>${esc(txt)}</textarea>
  <div class="row" style="flex-wrap:wrap"><button class="btn pri sm" data-act="copy" data-src="bv-t">Copiar</button>${c.telefono ? `<a class="btn sm" href="https://wa.me/${telWa(c.telefono)}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ""}<a class="btn sm" href="mailto:${esc(c.email)}?subject=${encodeURIComponent("Tu acceso a la app · Adrián Rodríguez Coaching")}&body=${encodeURIComponent(txt)}">Enviar por email</a></div>
  <button class="btn block" data-act="go" data-h="c-${esc(encodeURIComponent(c.id))}">Ir a su ficha</button><button type="button" class="btn ghost" data-act="close">Cerrar</button>`);
}
// Bloque de Inicio del entrenador
function inicioEmbudo(leads, onb) {
  const ls = leads.filter(l => l.estado === "nuevo" || l.estado === "contactado"), os = onb.filter(o => !o.revisado);
  if (!ls.length && !os.length) return `<div class="card embudo"><h2 class="hh">${ICON.clientes}Embudo</h2><p class="small muted" style="margin:0">Sin solicitudes nuevas. Tu enlace para Instagram: <b class="sel">${esc(location.origin + location.pathname.replace(/[^/]*$/, ""))}empezar</b> <button class="btn ghost sm" data-act="copy-txt" data-t="${esc(location.origin + location.pathname.replace(/[^/]*$/, ""))}empezar">Copiar</button></p></div>`;
  return `<div class="card embudo"><h2 class="hh">${ICON.clientes}Embudo <span class="cnt">${ls.length + os.length}</span></h2><div class="list">
  ${ls.map(l => `<button class="it feed" data-act="lead" data-id="${esc(l.id)}">${avatar(l.nombre)}<span class="grow"><span class="lnk">${esc(l.nombre)}</span> <span class="chip ${l.estado === "nuevo" ? "acc" : ""}">${esc(LEAD_EST[l.estado])}</span><br><span class="tiny muted">${esc(l.objetivo || "Solicitud de contacto")} · ${esc(relTime(l.created_at))}</span></span></button>`).join("")}
  ${os.map(o => `<button class="it feed" data-act="go-inicial" data-cid="${esc(o.client_id)}">${avatar(clientName(o.client_id))}<span class="grow"><span class="lnk">${esc(clientName(o.client_id))}</span> <span class="chip ok">Cuestionario inicial</span><br><span class="tiny muted">Rellenado ${esc(relTime(o.enviado_en))} · sin revisar</span></span></button>`).join("")}
  </div><p class="tiny muted" style="margin:8px 0 0">Enlace para Instagram: <b class="sel">${esc(location.origin + location.pathname.replace(/[^/]*$/, ""))}empezar</b></p></div>`;
}

/* ---- Cliente: cuestionario inicial ---- */
const COM_KEY = () => "arc-comienzo-" + (S.me && S.me.cid);
function comDraft() { try { return JSON.parse(localStorage.getItem(COM_KEY()) || "{}"); } catch { return {}; } }
async function viewComienzo(step) {
  const ex = (await q(sb.from("onboarding").select("client_id,revisado,enviado_en").limit(1)))[0];
  if (ex && step == null) { shell("Cuestionario inicial", `<div class="card"><h2>¡Hecho! ✅</h2><p class="small" style="margin:0">Enviaste tu cuestionario inicial ${esc(relTime(ex.enviado_en))}. Adrián lo está usando para preparar tu plan.</p>${ex.revisado ? "" : `<button class="btn block" style="margin-top:10px" data-act="com-step" data-s="0">Revisar o cambiar respuestas</button>`}</div>`); return; }
  const d = comDraft(); if (!d.nombre && S.me.nombre) d.nombre = S.me.nombre;
  if (ex && !d.__cargado) { const r = (await q(sb.from("onboarding").select("respuestas").limit(1)))[0]; Object.assign(d, r ? r.respuestas : {}, { __cargado: 1 }); }
  S.sub.com = d; const s = Math.max(0, Math.min(COMIENZO.length, step ?? d.__paso ?? 0));
  if (s === COMIENZO.length) {
    shell("Cuestionario inicial", `<div class="comp"><div class="combar"><i style="width:100%"></i></div></div><div class="card"><h2>¡Eso es todo!</h2><p class="small">Gracias por dedicarle tiempo y sinceridad. Con esta información voy a diseñar un plan pensado específicamente para ti, tu cuerpo, tu vida y tus objetivos.</p>
    <form id="f-com-fin" style="display:flex;flex-direction:column;gap:12px"><label class="small consent"><input type="checkbox" name="ok" required> Acepto que Adrián Rodríguez trate estos datos, incluidos los de salud, solo para prepararme y ajustarme el entrenamiento. Solo él puede verlos y puedo pedir que se borren cuando quiera.</label>
    <button class="btn pri block">Enviar a Adrián</button><button type="button" class="btn ghost" data-act="com-step" data-s="${COMIENZO.length - 1}">Atrás</button></form></div>`); return;
  }
  const bl = COMIENZO[s];
  shell("Cuestionario inicial", `<div class="comp"><div class="tiny muted">Parte ${s + 1} de ${COMIENZO.length}</div><div class="combar"><i style="width:${Math.round(100 * s / COMIENZO.length)}%"></i></div></div>
  ${s === 0 ? `<div class="card com-hi"><h2>¡Hola! Estás a un paso de empezar 💪</h2><p class="small" style="margin:0">Para crear un plan que se adapte a ti necesito saber algunas cosas sobre tu rutina y tus preferencias. No hay respuestas correctas ni incorrectas: sé totalmente sincero/a. Se guarda solo mientras avanzas.</p></div>` : ""}
  <form id="f-com" data-s="${s}" class="card" style="display:flex;flex-direction:column;gap:16px"><div><h2 style="margin-bottom:4px">${esc(bl.b)}</h2><p class="small muted" style="margin:0">${esc(bl.i)}</p></div>
  ${bl.q.map(qq => comField(qq, d)).join("")}
  <div class="row"><button type="button" class="btn" data-act="com-step" data-s="${s - 1}" ${s === 0 ? "hidden" : ""}>Atrás</button><span class="grow"></span><button class="btn pri">${s === COMIENZO.length - 1 ? "Terminar" : "Siguiente"}</button></div></form>`);
}
function comField(qq, d) {
  const v = d[qq.k]; const hide = qq.if && d[qq.if[0]] !== qq.if[1];
  const lab = `<div class="cq-t">${esc(qq.t)}${qq.r ? ' <span class="req">*</span>' : ""}</div>`;
  let inp;
  if (qq.y === "t" || qq.y === "n") inp = `<input name="${qq.k}" value="${esc(v ?? "")}" ${qq.y === "n" ? 'inputmode="decimal"' : ""} maxlength="300" aria-label="${esc(qq.t)}">`;
  else if (qq.y === "l") inp = `<textarea name="${qq.k}" maxlength="2000" aria-label="${esc(qq.t)}">${esc(v ?? "")}</textarea>`;
  else if (qq.y === "r") inp = `<div class="opts">${qq.o.map(o => `<label class="choice"><input type="radio" name="${qq.k}" value="${esc(o)}" ${v === o ? "checked" : ""} data-com-if="${qq.k}"><span>${esc(o)}</span></label>`).join("")}</div>`;
  else if (qq.y === "c") { const arr = Array.isArray(v) ? v : []; const extra = arr.filter(x => !qq.o.includes(x)).join(", ");
    inp = `<div class="opts">${qq.o.map(o => `<label class="choice"><input type="checkbox" name="${qq.k}" value="${esc(o)}" ${arr.includes(o) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}${qq.otro ? `<input name="${qq.k}__otro" value="${esc(extra)}" placeholder="Otro (opcional)" maxlength="150">` : ""}</div>`; }
  else inp = `<input type="hidden" name="${qq.k}" value="${esc(v ?? "")}"><div class="scale${qq.max - qq.min > 5 ? " s10" : ""}${qq.min === 0 ? " s11" : ""}" role="group">${Array.from({ length: qq.max - qq.min + 1 }, (_, i) => qq.min + i).map(n => `<button type="button" data-act="cq-scale" data-k="${qq.k}" data-v="${n}" aria-pressed="${String(v) === String(n)}">${n}</button>`).join("")}</div><div class="anchors"><span>${esc(qq.a[0])}</span><span>${esc(qq.a[1])}</span></div>`;
  return `<div class="cq" data-k="${qq.k}" ${hide ? "hidden" : ""}>${lab}${inp}</div>`;
}
function comRead(f) {
  const d = S.sub.com || {}; const s = +f.dataset.s;
  for (const qq of COMIENZO[s].q) {
    if (qq.y === "r") d[qq.k] = (f.querySelector(`[name="${qq.k}"]:checked`) || {}).value || "";
    else if (qq.y === "c") { const a = [...f.querySelectorAll(`[name="${qq.k}"]:checked`)].map(i => i.value); const o = f[`${qq.k}__otro`] ? f[`${qq.k}__otro`].value.trim() : ""; d[qq.k] = o ? [...a, o] : a; }
    else d[qq.k] = (f[qq.k] && f[qq.k].value || "").trim();
  }
  return d;
}
function comSaveDraft(d) { try { localStorage.setItem(COM_KEY(), JSON.stringify(d)); } catch { } }
async function comNext(f) {
  const d = comRead(f); const s = +f.dataset.s;
  const falta = COMIENZO[s].q.find(qq => qq.r && !(qq.if && d[qq.if[0]] !== qq.if[1]) && (Array.isArray(d[qq.k]) ? !d[qq.k].length : !String(d[qq.k] ?? "").trim()));
  if (falta) { toast("Te falta: " + falta.t.slice(0, 60) + (falta.t.length > 60 ? "…" : "")); const el = f.querySelector(`.cq[data-k="${falta.k}"]`); if (el) { el.classList.add("err"); el.scrollIntoView({ behavior: "smooth", block: "center" }); } return; }
  for (const k of ["edad", "altura", "peso", "pasos"]) if (d[k] && num(d[k]) == null) { toast("Revisa: " + (COM_Q.find(x => x.k === k) || {}).t); return; }
  d.__paso = s + 1; comSaveDraft(d); window.scrollTo(0, 0); viewComienzo(s + 1);
}
async function comEnviar(f) {
  if (!f.ok.checked) { toast("Marca la casilla para poder enviarlo"); return; }
  const d = { ...(S.sub.com || comDraft()) }; delete d.__paso; delete d.__cargado;
  const b = f.querySelector("button.pri"); b.disabled = true; b.textContent = "Enviando…";
  try {
    await q(sb.from("onboarding").upsert({ client_id: S.me.cid, respuestas: d, consentimiento: true, revisado: false, enviado_en: new Date().toISOString() }, { onConflict: "client_id" }));
    const kg = num(d.peso); if (kg && kg >= 25 && kg <= 350) await q(sb.from("weights").upsert({ client_id: S.me.cid, fecha: today(), kg }, { onConflict: "client_id,fecha" })).catch(() => { });
    try { localStorage.removeItem(COM_KEY()); } catch { }
    toast("¡Enviado! Gracias 🙌"); location.hash = "hoy";
  } catch (e) { toast(errMsg(e)); b.disabled = false; b.textContent = "Enviar a Adrián"; }
}

/* ---- Entrenador: pestaña Cuestionario inicial ---- */
async function tabInicial(c) {
  const o = (await q(sb.from("onboarding").select("*").eq("client_id", c.id).limit(1)))[0];
  if (!o) return `<div class="card"><p class="small" style="margin:0">${c.user_id ? "Aún no ha rellenado el cuestionario inicial. Le aparece nada más entrar en la app." : "Cuando se registre en la app, lo primero que verá es el cuestionario inicial."}</p></div>`;
  const r = o.respuestas || {}; const al = comienzoAlertas(r);
  return `<div class="row" style="margin-bottom:10px;flex-wrap:wrap"><span class="small muted">Enviado ${esc(relTime(o.enviado_en))} · ${o.consentimiento ? "con consentimiento" : "sin consentimiento"}</span><span class="grow"></span><button class="btn sm" data-act="com-ficha" data-cid="${esc(c.id)}">Pasar datos básicos a la ficha</button>${o.revisado ? `<span class="chip ok">Revisado</span>` : `<button class="btn sm pri" data-act="com-rev" data-cid="${esc(c.id)}">Marcar como revisado</button>`}</div>
  ${al.length ? `<div class="card"><h2>A tener en cuenta</h2>${al.map(([k, t]) => `<div class="alr ${k}">${k === "bad" ? "⚠️" : "•"} ${esc(t)}</div>`).join("")}</div>` : `<div class="card"><div class="alr ok">✓ Sin avisos de salud en el cuestionario.</div></div>`}
  ${COMIENZO.map(bl => `<div class="card"><h2>${esc(bl.b)}</h2><div class="qa-list">${bl.q.filter(qq => !(qq.if && r[qq.if[0]] !== qq.if[1])).map(qq => `<div class="qa-i"><div class="tiny muted">${esc(qq.t)}</div><div class="small">${esc(comAns(qq, r[qq.k]))}</div></div>`).join("")}</div></div>`).join("")}`;
}
async function comFicha(cid) {
  const o = (await q(sb.from("onboarding").select("respuestas").eq("client_id", cid).limit(1)))[0]; const c = (await q(sb.from("clients").select("ficha").eq("id", cid).limit(1)))[0]; if (!o || !c) return;
  const r = o.respuestas; const f = { ...(c.ficha || {}) };
  if (r.edad) f.edad = r.edad; if (r.altura) f.altura = r.altura; if (r.peso) f.pesoInicial = r.peso; if (r.sexo) f.sexo = r.sexo;
  const salud = (f.salud || []).slice(); comienzoAlertas(r).filter(a => a[0] === "bad").forEach(a => { const t = "!" + a[1]; if (!salud.includes(t)) salud.push(t); }); f.salud = salud;
  try { await q(sb.from("clients").update({ ficha: f }).eq("id", cid)); toast("Ficha actualizada"); S.coach.keep = true; viewCoachClient(cid); } catch (e) { toast(errMsg(e)); }
}

/* ---- Tests: agrupados por nombre y comparados en el tiempo ---- */
const tKey = n => String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const tMain = x => x.valor != null ? +x.valor : (x.izq != null && x.der != null ? (+x.izq + +x.der) / 2 : x.izq != null ? +x.izq : x.der != null ? +x.der : null);
const tLsi = x => x.izq && x.der ? Math.round(100 * Math.min(+x.izq, +x.der) / Math.max(+x.izq, +x.der)) : null;
function tDelta(a, b, menos, u) {
  if (a == null || b == null) return "";
  const d = a - b, pc = b ? 100 * d / Math.abs(b) : null; const good = d === 0 ? null : (d > 0) !== !!menos;
  return `<span class="tdelta ${good == null ? "" : good ? "up" : "down"}">${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${d > 0 ? "+" : ""}${fmt(d, 2)}${u ? " " + esc(u) : ""}${pc != null && d !== 0 ? ` <em>(${d > 0 ? "+" : ""}${fmt(pc, 1)} %)</em>` : ""}</span>`;
}
function testsHTML(ts, coach) {
  const g = {}; ts.forEach(x => { const k = tKey(x.nombre); (g[k] = g[k] || []).push(x); });
  const grupos = Object.values(g).map(xs => xs.slice().sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.created_at || "").localeCompare(String(b.created_at || ""))))
    .sort((a, b) => String(b[b.length - 1].fecha || "").localeCompare(String(a[a.length - 1].fecha || "")));
  if (!grupos.length) return `<div class="card"><div class="empty">${coach ? "Sin tests todavía. Añade el primero abajo; si repites un test con el mismo nombre, se compara solo." : "Aquí verás tus tests y cómo mejoran cada vez que los repitas."}</div></div>`;
  return `<div class="tgrid">${grupos.map(xs => {
    const last = xs[xs.length - 1], prev = xs[xs.length - 2], first = xs[0], u = last.unidad || "", menos = !!last.mejor_es_menos;
    const lv = tMain(last), bil = xs.some(x => x.izq != null || x.der != null);
    const best = xs.map(tMain).filter(v => v != null).reduce((m, v) => m == null ? v : menos ? Math.min(m, v) : Math.max(m, v), null);
    const pts = xs.filter(x => x.fecha && tMain(x) != null).map(x => ({ x: x.fecha, y: tMain(x) }));
    return `<div class="card tcard"><div class="thead"><div><h2>${esc(last.nombre)}</h2><span class="tiny muted">${esc(cap(last.categoria || ""))}${xs.length > 1 ? ` · ${xs.length} mediciones` : ""}${menos ? " · mejor cuanto menos" : ""}</span></div>${best != null && lv === best && xs.length > 1 ? `<span class="chip ok">Mejor marca</span>` : ""}</div>
      <div class="tkpis"><div><span>Último${last.fecha ? " · " + esc(fdate(last.fecha, { day: "numeric", month: "short" })) : ""}</span><b>${lv != null ? fmt(lv, 2) : "—"}<small>${esc(u)}</small></b>${bil ? `<em>I ${fmt(last.izq, 2)} · D ${fmt(last.der, 2)}${tLsi(last) != null ? ` · LSI ${tLsi(last)} %` : ""}</em>` : ""}</div>
      ${prev ? `<div><span>Vs. anterior${prev.fecha ? " · " + esc(fdate(prev.fecha, { day: "numeric", month: "short" })) : ""}</span>${tDelta(lv, tMain(prev), menos, u)}<em>antes ${fmt(tMain(prev), 2)} ${esc(u)}${bil && tLsi(prev) != null ? ` · LSI ${tLsi(prev)} %` : ""}</em></div>` : `<div class="tsolo"><span>Progreso</span><em>Repite este test para compararlo</em></div>`}
      ${xs.length > 2 ? `<div><span>Desde el inicio${first.fecha ? " · " + esc(fdate(first.fecha, { day: "numeric", month: "short", year: "2-digit" })) : ""}</span>${tDelta(lv, tMain(first), menos, u)}<em>al empezar ${fmt(tMain(first), 2)} ${esc(u)}</em></div>` : ""}</div>
      ${pts.length >= 2 ? lineChart(pts, { label: last.nombre, unit: u, dec: Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y)) < 2 ? 2 : 1 }) : ""}
      <details class="thist"><summary>Historial (${xs.length})</summary><table><tbody>${xs.slice().reverse().map((x, i, arr) => { const p = arr[i + 1]; return `<tr><td>${x.fecha ? esc(fdate(x.fecha)) : "—"}</td><td class="n"><b>${tMain(x) != null ? fmt(tMain(x), 2) : "—"}</b> ${esc(x.unidad || "")}${x.izq != null || x.der != null ? `<div class="tiny muted">I ${fmt(x.izq, 2)} · D ${fmt(x.der, 2)}${tLsi(x) != null ? ` · LSI ${tLsi(x)} %` : ""}</div>` : ""}</td><td class="n">${p ? tDelta(tMain(x), tMain(p), x.mejor_es_menos, "") : ""}</td><td class="tiny muted">${esc(x.notas || "")}</td>${coach ? `<td class="n"><button class="btn ghost sm" data-act="test-del" data-id="${esc(x.id)}">Borrar</button></td>` : ""}</tr>`; }).join("")}</tbody></table></details></div>`;
  }).join("")}</div>`;
}

/* ================= Entrenador: Clientes ================= */
async function viewCoachList() {
  loading("Clientes"); const since = addDays(today(), -7);
  const [cl, wl, wo, as] = await Promise.all([loadClients(), q(sb.from("wellness").select("client_id,fecha,sueno,fatiga,dolor,estres,animo,motivacion,articular").gte("fecha", since)), q(sb.from("workouts").select("client_id,fecha").gte("fecha", since)), q(sb.from("assignments").select("client_id,fecha").gte("fecha", since))]);
  const row = c => { const w = wl.filter(x => x.client_id === c.id), o = wo.filter(x => x.client_id === c.id); const wi = avg(w.map(wellIdx).filter(x => x != null)); const hasta = as.filter(x => x.client_id === c.id).map(x => x.fecha).sort().pop();
    return `<tr data-act="go" data-h="c-${esc(encodeURIComponent(c.id))}" style="cursor:pointer"><td><span class="feedn">${avatar(c.nombre)}<span><span class="lnk">${esc(c.nombre)}</span><div class="tiny muted">${c.user_id ? "Usa la app" : "Sin cuenta todavía"}</div></span></span></td><td class="n">${o.length}</td><td class="n">${w.length}/7</td><td class="n">${wi != null ? fmt(wi, 2) : "—"}</td><td>${hasta ? esc(fdate(hasta)) : `<span class="chip bad">Nada</span>`}</td><td>${c.estado !== "activo" ? `<span class="chip">${esc(c.estado)}</span>` : ""}</td></tr>`; };
  shell("Clientes", `<div class="pghead"><h1 class="ptitle">Mis clientes <span class="cnt">${cl.length}</span></h1><span class="grow"></span><button class="btn dark" data-act="new-client"><span class="plus">+</span>Añadir cliente</button></div><p class="small muted" style="margin:0">Datos de los últimos 7 días</p>
  <div class="card"><div class="tbl"><table class="ctab"><thead><tr><th>Cliente</th><th class="n">Entrenos</th><th class="n">Cuestionarios</th><th class="n">Bienestar</th><th>Planificado hasta</th><th></th></tr></thead><tbody>${cl.map(row).join("") || `<tr><td colspan="6" class="muted">Sin clientes todavía.</td></tr>`}</tbody></table></div></div>`);
}
function openNewClient() {
  sheet(`<h2>Nuevo cliente</h2><form id="f-newc" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="nc-n">Nombre (como lo verá él)</label><input id="nc-n" name="nombre" required></div><div class="f"><label for="nc-e">Email con el que entrará</label><input id="nc-e" name="email" type="email" required></div><div class="f"><label for="nc-o">Objetivo</label><textarea id="nc-o" name="objetivo"></textarea></div><p class="tiny muted" style="margin:0">Al crearla tendrás su código de alta en la pestaña «Cuenta»: se lo das junto con el enlace de la app para que se registre en «Nuevo atleta».</p><button class="btn pri block">Crear</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveNewClient(f) {
  const nombre = f.nombre.value.trim(), email = f.email.value.trim().toLowerCase(); let id = slug(nombre.split(" ")[0] + "-" + (nombre.split(" ")[1] || "x").slice(0, 1));
  if (!S.coach.list.length) await loadClients();
  if (S.coach.list.some(c => c.id === id)) id += "-" + Math.random().toString(36).slice(2, 5);
  try { await q(sb.from("clients").insert({ id, nombre, email, ficha: { objetivo: f.objetivo.value.trim() } })); await q(sb.from("plans").insert({ client_id: id })); sheet(""); toast("Cliente creado"); S.coach.tab = "cuenta"; location.hash = "c-" + id; }
  catch (e) { toast(errMsg(e)); }
}

/* ================= Entrenador: ficha del cliente ================= */
const CTABS = [["plan", "Planificación", "plan"], ["info", "Información", "info"], ["inicial", "Cuestionario inicial", "doc"], ["evo", "Evolución", "evo"], ["nutri", "Nutrición", "nutri"], ["informes", "Revisiones", "doc"], ["cuenta", "Cuenta", "key"]];
async function viewCoachClient(cid) {
  if (S.coach.cid !== cid) { S.coach.cid = cid; S.coach.calM = null; }
  const tab = S.coach.tab || "plan";
  const c = (await q(sb.from("clients").select("*").eq("id", cid).limit(1)))[0];
  if (!c) { shell("Cliente", `<div class="empty">No existe.</div>`, { back: "c" }); return; }
  const pl = (await q(sb.from("plans").select("*").eq("client_id", cid).limit(1)))[0] || { client_id: cid, bloques: [], habitos: [], objetivo: "", progreso_visible: ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"] };
  const MZ = (c.ficha || {}).mesos || []; pl.bloques = (pl.bloques || []).map((b, i) => ({ ...b, ...(MZ[i] || {}) }));
  S.coach.c = c; S.coach.pl = pl;
  const body = tab === "plan" ? await tabPlan(c, pl) : tab === "info" ? tabInfo(c, pl) : tab === "inicial" ? await tabInicial(c) : tab === "evo" ? await tabEvo(c, pl) : tab === "nutri" ? await tabNutri(c, pl) : tab === "informes" ? await tabInformes(c) : tabCuenta(c, pl);
  const alertas = ((c.ficha || {}).salud || []).filter(s => String(s).startsWith("!"));
  shell(c.nombre, `<div class="cwrap"><nav class="rail" aria-label="Apartados del cliente">${CTABS.map(([k, l, i]) => `<button data-act="ctab" data-t="${k}" aria-current="${tab === k}" title="${l}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>
  <div class="cmain"><div class="chead">${avatar(c.nombre, "lg")}<div class="grow"><h1>${esc(c.nombre)}</h1><div class="cmeta">${(c.ficha || {}).perfil && PERFILES[c.ficha.perfil] ? `<span class="chip">${esc(PERFILES[c.ficha.perfil])}</span>` : ""}<span class="chip ${c.estado === "activo" ? "ok" : "warn"}">${esc(c.estado === "activo" ? "Activo" : cap(c.estado))}</span><span class="tiny muted">${c.user_id ? "Usa la app" : "Sin cuenta todavía"}</span></div></div>${alertas.length ? `<div class="calert" title="Salud y limitaciones (pestaña Información)"><b>⚠ Salud</b>${alertas.map(s => `<span>${esc(String(s).slice(1))}</span>`).join("")}</div>` : ""}</div>${body}</div></div>`, { crumb: [["c", "Clientes"], ["c", "Mis clientes"], [null, c.nombre, true]], keepScroll: S.coach.keep, sub: c.estado !== "activo" ? cap(c.estado) : "" });
  S.coach.keep = false;
}

/* ---- Planificación ---- */
async function tabPlan(c, pl) {
  const t = today(); const m = S.coach.calM || t.slice(0, 7); S.coach.calM = m;
  const first = m + "-01", last = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
  const g0 = monday(first), g1 = addDays(monday(last), 6);
  const [as, ev, wo] = await Promise.all([q(sb.from("assignments").select("*").eq("client_id", c.id).gte("fecha", g0).lte("fecha", g1).order("orden")), q(sb.from("events").select("*").eq("client_id", c.id).lte("fecha", g1).order("fecha")), q(sb.from("workouts").select("id,fecha,dia,assignment_id").eq("client_id", c.id).gte("fecha", g0).lte("fecha", g1))]);
  S.coach.asig = as;
  const weekInfo = d => { for (const b of pl.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= addDays(d, 6) && d <= s.fin); if (w) return { b: b.nombre, s: w.nombre, tipo: w.tipo || "carga", foco: w.foco || "" }; } return null; };
  const DN = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let rows = "", lastB = "";
  for (let d = g0; d <= g1; d = addDays(d, 7)) {
    const wi = weekInfo(d); const wa = as.filter(x => x.fecha >= d && x.fecha <= addDays(d, 6) && x.visible && x.tipo !== "nota"); const wp = wa.filter(x => x.fecha <= t); const wh = wp.filter(x => x.hecho).length;
    const nb = wi && wi.b !== lastB; if (wi) lastB = wi.b;
    rows += `<div class="pweek">${wi ? `<div class="pwl2"><span class="wtag t-${esc(wi.tipo)}">${esc(wi.s)}</span><span class="wname">${[nb ? wi.b : "", wi.tipo !== "carga" ? cap(wi.tipo) : ""].filter(Boolean).map(esc).join(" · ")}</span></div>` : ""}<div class="pgrid">`;
    for (let k = 0; k < 7; k++) {
      const day = addDays(d, k); const items = as.filter(x => x.fecha === day); const evs = ev.filter(e => e.fecha <= day && day <= (e.fin || e.fecha)); const libres = wo.filter(w => w.fecha === day && !w.assignment_id);
      const cls = `${day.slice(0, 7) !== m ? " out" : ""}${day === t ? " hoy" : ""}${day < t ? " past" : ""}${k >= 5 ? " we" : ""}`;
      if (day.slice(0, 7) !== m) { rows += `<div class="pday out" data-day="${day}"></div>`; continue; }
      rows += `<div class="pday${cls}" data-day="${day}" data-act="day-open" data-d="${day}" role="button" tabindex="0" aria-label="Ver el ${esc(fdate(day, { weekday: "long", day: "numeric" }))}"><div class="pdh"><span class="dn">${+day.slice(8)}</span><button class="padd" data-act="asig-new" data-d="${day}" aria-label="Añadir el ${esc(fdate(day))}">+</button></div>
      ${evs.map(e => `<button class="pch tp-evento" data-act="ev-edit" data-id="${esc(e.id)}"><i class="pi">★</i>${esc(e.titulo)}</button>`).join("")}
      ${items.map(x => `<button class="pch tp-${esc(x.tipo)}${x.hecho ? " ok" : !x.hecho && day < t ? " late" : ""}${x.visible ? "" : " hid"}" data-act="asig-edit" data-id="${esc(x.id)}" data-drag="${esc(x.id)}" title="${esc(TIPOS[x.tipo] || "")}${x.hecho ? " · hecho" : day < t ? " · sin hacer" : ""}${x.visible ? "" : " · oculto"}">${x.hecho ? `<i class="pi ok">✓</i>` : !x.hecho && day < t && x.tipo !== "nota" ? `<i class="pi no">!</i>` : ""}${esc(x.titulo)}</button>`).join("")}
      ${libres.map(w => `<span class="pch tp-workout ok"><i class="pi ok">✓</i>${esc(w.dia || "Entreno libre")}</span>`).join("")}</div>`;
    }
    rows += `</div></div>`;
  }
  const mN = parseD(first).toLocaleDateString("es-ES", { month: "long" }), yN = first.slice(0, 4);
  const prevM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7), nextM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
  const tot = as.filter(x => x.fecha >= first && x.fecha <= last && x.fecha <= t && x.visible && x.tipo !== "nota"); const pct = tot.length ? Math.round(100 * tot.filter(x => x.hecho).length / tot.length) : null;
  const mes = as.filter(x => x.fecha >= first && x.fecha <= last && x.tipo !== "nota");
  return `<div class="card cal"><div class="calhead"><div class="calnav"><button class="cnav" data-act="pm" data-m="${prevM}" aria-label="Mes anterior">‹</button><h2>${esc(cap(mN))} <span>${esc(yN)}</span></h2><button class="cnav" data-act="pm" data-m="${nextM}" aria-label="Mes siguiente">›</button>${m !== t.slice(0, 7) ? `<button class="btn ghost sm" data-act="pm" data-m="${t.slice(0, 7)}">Hoy</button>` : ""}</div>
    <div class="calact"><button class="btn sm pri" data-act="asig-new" data-d="${t}">+ Añadir</button>
    <details class="more"><summary class="btn sm" aria-label="Más opciones">Más ▾</summary><div class="menu"><button data-act="prog-asignar">Programar un programa</button><button data-act="prog-desde-cal">Guardar semanas como programa</button><hr><button data-act="copiar-semana">Copiar semana</button><button data-act="borrar-semana">Vaciar semana</button><hr><button data-act="meso-edit">Mesociclos</button></div></details></div></div>
  <div class="pgrid phead">${DN.map(n => `<span>${n}</span>`).join("")}</div>${rows}</div>`;
}
async function openAsig(id, fecha) {
  await exLib(); const tpls = await tplLib();
  const x = id ? (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0] : { tipo: "workout", fecha, titulo: "", contenido: {}, visible: true };
  if (!x) return; S.sub.asigTipo = x.tipo; S.sub.tpls = tpls;
  const logs = id && x.tipo === "workout" ? await q(sb.from("workouts").select("*").eq("assignment_id", id)) : [];
  const res = (x.resultado && x.resultado.respuestas) || [];
  sheet(`<h2>${id ? "Editar" : "Añadir"} · ${esc(fdate(x.fecha, { weekday: "long", day: "numeric", month: "long" }))}</h2>
  <form id="f-asig" class="sform" data-id="${esc(id || "")}">
  ${!id ? `<div class="tpick" role="group" aria-label="Tipo">${[...Object.entries(TIPOS), ["evento", "Evento"]].map(([k, l]) => `<button type="button" class="tp-${k}" data-act="asig-tipo" data-t="${k}" aria-pressed="${x.tipo === k}">${ICON[{ workout: "entreno", cardio: "t_cardio", formulario: "doc", nota: "t_msg", peso: "t_peso", fotos: "t_foto", medidas: "t_med", tarea: "t_tarea", evento: "cal" }[k]] || ""}<span>${l}</span></button>`).join("")}</div>` : `<p class="small" style="margin:0">${tipoChip(x.tipo)}${x.hecho ? ` <span class="chip ok">Hecho ${x.hecho_en ? esc(relTime(x.hecho_en)) : ""}</span>` : ""}${x.programa ? ` <span class="chip">${esc(x.programa)}</span>` : ""}</p>`}
  <div id="asig-body">${asigBody(x, tpls)}</div>
  ${logs.length ? `<div class="card"><h2>Lo que registró</h2>${logs.map(w => `<p class="tiny muted" style="margin:0 0 4px">${esc(fdate(w.fecha))}${w.rpe_sesion != null ? " · dureza " + w.rpe_sesion + "/10" : ""}${w.duracion_min ? " · " + w.duracion_min + " min" : ""}</p><table><tbody>${Object.entries((w.sets || []).reduce((a, s) => { (a[s.ejercicio] = a[s.ejercicio] || []).push(s); return a; }, {})).map(([ex, ss]) => `<tr><td>${esc(ex)}</td><td class="n">${esc(ss.map(s => s.hecho ? "hecho" : `${s.kg ?? "?"}×${s.reps ?? "?"}${s.rir != null ? " @" + s.rir : ""}`).join(" · "))}</td></tr>`).join("")}</tbody></table>${w.comentario ? `<p class="small">${esc(w.comentario)}</p>` : ""}`).join("")}</div>` : ""}
  ${resExtra(x)}${res.length || x.respuesta ? `<div class="card"><h2>Respuesta del cliente</h2>${res.map(r => `<p class="small" style="margin:4px 0"><b>${esc(r.p)}</b><br>${esc(r.r || "—")}</p>`).join("")}${x.respuesta ? `<p class="small" style="margin:4px 0"><b>Comentario:</b> ${esc(x.respuesta)}</p>` : ""}</div>` : ""}
  <button class="btn pri block">Guardar</button>
  ${id ? `<div class="row"><input type="date" name="dup_fecha" value="${esc(addDays(x.fecha, 7))}" aria-label="Fecha para duplicar" style="width:auto"><button type="button" class="btn sm" data-act="asig-dup" data-id="${esc(id)}">Duplicar en esa fecha</button><span class="grow"></span><button type="button" class="btn sm ghost" data-act="asig-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button></div>` : ""}
  <button type="button" class="btn ghost" data-act="close">Cerrar</button></form>${exDatalist()}`, "wide");
}
/* ================= Detalles propios de cada tipo ================= */
const CARDIO_MOD = [["pasos", "Pasos / caminar"], ["correr", "Correr"], ["bici", "Bici"], ["eliptica", "Elíptica"], ["remo", "Remo"], ["airbike", "Air-bike"], ["natacion", "Natación"], ["comba", "Comba"], ["otro", "Otro"]];
const CARDIO_FMT = [["continuo", "Continuo"], ["intervalos", "Intervalos"], ["diario", "Objetivo diario"]];
const CARDIO_REG = [["min", "Minutos"], ["km", "Distancia (km)"], ["pasos", "Pasos"], ["fc", "FC media"], ["rpe", "Dureza 1–10"]];
const CARDIO_REG_DEF = { pasos: ["pasos"], correr: ["min", "km", "fc", "rpe"], bici: ["min", "km", "fc", "rpe"], natacion: ["min", "km", "rpe"] };
const ZONAS = [["", "Sin indicar"], ["Z1", "Z1 · Muy suave (RPE 2–3)"], ["Z2", "Z2 · Suave, puedes hablar (RPE 3–4)"], ["Z3", "Z3 · Moderado (RPE 5–6)"], ["Z4", "Z4 · Duro (RPE 7–8)"], ["Z5", "Z5 · Máximo (RPE 9–10)"]];
const FOTO_V = [["frente", "De frente"], ["perfil_d", "Perfil derecho"], ["perfil_i", "Perfil izquierdo"], ["espalda", "De espaldas"], ["frente_c", "Frente contraído"], ["espalda_c", "Espalda contraída"]];
const FOTO_DEF = ["frente", "perfil_d", "espalda"];
const FOTO_COND = ["Misma luz y mismo sitio que la última vez", "Ropa interior o bañador", "Por la mañana, en ayunas", "Móvil a la altura del ombligo, a 2–3 metros", "Postura relajada, brazos a los lados"];
const PESO_MOM = [["ayunas", "En ayunas, después de ir al baño"], ["libre", "Cuando pueda (siempre a la misma hora)"], ["noche", "Por la noche, antes de dormir"]];
const MSG_PLANT = ["Buenos días 💪 Hoy toca entreno. ¡A por ello!", "Recuerda rellenar el cuestionario por la mañana, en ayunas y después de ir al baño.", "Recuerda pesarte mañana en ayunas, después de ir al baño.", "¿Qué tal va la semana? Cualquier cosa me escribes.", "Esta semana es de descarga: baja el ritmo y recupera. Es parte del plan.", "Mañana toca revisión semanal: fotos, medidas y cuestionario. ¡Gracias!"];
const REV_SEMANAL = ["1-10: ¿Cómo valoras la semana en general?", "1-10: ¿Cómo has cumplido los entrenos?", "1-10: ¿Y los hábitos (pasos, sueño, comida)?", "1-5: Estrés medio de la semana", "Sí/No: ¿Has tenido alguna molestia o dolor?", "¿Qué ha ido mejor esta semana?", "¿Qué te ha costado más?", "¿Algo que deba saber para la semana que viene?"];
const WELL_OPC = [["sueno_h", "Horas de sueño"], ["fc", "Pulso en reposo"], ["hrv", "HRV / VFC"], ["apetito", "Apetito"], ["molestia", "Molestias (zona y dolor)"], ["peso", "Peso en ayunas"], ["comentario", "Comentario libre"]];
const WELL_DEF = ["sueno_h", "fc", "hrv", "apetito", "molestia", "comentario"];
const chk = (name, val, on, label, sub) => `<label class="mchk"><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? "checked" : ""}><span><b>${esc(label)}</b>${sub ? `<br><span class="tiny muted">${esc(sub)}</span>` : ""}</span></label>`;
const chkSet = (root, name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
const gv = (root, n) => { const e = root.querySelector(`[name="${n}"]`); return e ? (e.type === "checkbox" ? e.checked : e.value.trim()) : ""; };
// Preguntas: "1-10: texto", "1-5: texto", "Sí/No: texto" o texto libre
const parseQ = p => { const m = String(p).match(/^\s*(1-10|1-5|s[ií]\/no)\s*:\s*(.+)$/i); return m ? { tipo: /s/i.test(m[1]) ? "sn" : m[1], texto: m[2] } : { tipo: "txt", texto: String(p) }; };

function cardioEditor(c = {}) {
  const mod = c.modalidad || "", reg = c.registrar || CARDIO_REG_DEF[mod] || ["min", "rpe"];
  return `<div class="wed"><div class="grid3"><div class="f"><label>Modalidad</label><select name="c_mod" data-act-change="c-mod">${CARDIO_MOD.map(([k, l]) => `<option value="${k}" ${mod === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="f"><label>Formato</label><select name="c_fmt" data-act-change="c-fmt">${CARDIO_FMT.map(([k, l]) => `<option value="${k}" ${(c.formato || "continuo") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="f"><label>Intensidad</label><select name="c_zona">${ZONAS.map(([k, l]) => `<option value="${k}" ${(c.zona || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
  <div class="grid4"><div class="f"><label>Minutos</label><input name="c_min" inputmode="numeric" value="${esc(c.min ?? "")}" placeholder="45"></div><div class="f"><label>Distancia (km)</label><input name="c_km" inputmode="decimal" value="${esc(c.km ?? "")}"></div><div class="f"><label>Pasos</label><input name="c_pasos" inputmode="numeric" value="${esc(c.pasos ?? "")}" placeholder="10000"></div><div class="f"><label>FC objetivo (ppm)</label><input name="c_fc" value="${esc(c.fc || "")}" placeholder="120–140"></div></div>
  <div class="grid3 c-int" ${(c.formato || "continuo") === "intervalos" ? "" : "hidden"}><div class="f"><label>Series</label><input name="c_series" inputmode="numeric" value="${esc(c.series ?? "")}" placeholder="6"></div><div class="f"><label>Trabajo</label><input name="c_trabajo" value="${esc(c.trabajo || "")}" placeholder="1' fuerte"></div><div class="f"><label>Descanso</label><input name="c_desc" value="${esc(c.descanso || "")}" placeholder="2' suave"></div></div>
  <div class="f"><label>Explicación para el cliente</label><textarea name="w_det" placeholder="5' suave para calentar, luego…">${esc(c.detalle || "")}</textarea></div>
  <fieldset class="medpick"><legend>Qué tiene que apuntar al terminar</legend>${CARDIO_REG.map(([k, l]) => chk("c_reg", k, reg.includes(k), l)).join("")}</fieldset></div>`;
}
function readCardio(root) {
  const n = k => num(gv(root, k));
  return { modalidad: gv(root, "c_mod"), formato: gv(root, "c_fmt"), zona: gv(root, "c_zona"), min: n("c_min"), km: n("c_km"), pasos: n("c_pasos"), fc: gv(root, "c_fc"), series: n("c_series"), trabajo: gv(root, "c_trabajo"), descanso: gv(root, "c_desc"), detalle: gv(root, "w_det"), registrar: chkSet(root, "c_reg") };
}
// Resumen del objetivo de cardio en una línea
function cardioResumen(c = {}) {
  const mod = (CARDIO_MOD.find(m => m[0] === c.modalidad) || [])[1];
  const p = [mod, c.formato === "intervalos" && c.series ? `${c.series} × ${c.trabajo || "?"}${c.descanso ? " / " + c.descanso : ""}` : "", c.min ? c.min + " min" : "", c.km ? fmt(c.km) + " km" : "", c.pasos ? Number(c.pasos).toLocaleString("es-ES") + " pasos" : "", c.zona || "", c.fc ? c.fc + " ppm" : ""].filter(Boolean);
  return p.join(" · ");
}

// Campos extra del editor del entrenador según el tipo
function typeExtras(t, c = {}) {
  if (t === "workout") return `<div class="grid2"><div class="f"><label>Objetivo de la sesión (lo ve el cliente)</label><input name="x_obj" value="${esc(c.objetivo || "")}" placeholder="Técnica en sentadilla y subir el press"></div><div class="f"><label>Duración aproximada (min)</label><input name="x_dur" inputmode="numeric" value="${esc(c.dur_est ?? "")}" placeholder="60"></div></div>${wEditor(c, "workout")}`;
  if (t === "cardio") return cardioEditor(c);
  if (t === "formulario") { const pre = c.wellness ? "wellness" : (c.preset || ((c.preguntas || []).length ? "libre" : "wellness")); const opc = c.campos || WELL_DEF;
    return `<div class="f"><label>Tipo de formulario</label><select name="f_tipo" data-act-change="f-preset"><option value="wellness" ${pre === "wellness" ? "selected" : ""}>Wellness diario (sueño, energía, agujetas, estrés…)</option><option value="revision" ${pre === "revision" ? "selected" : ""}>Revisión semanal</option><option value="libre" ${pre === "libre" ? "selected" : ""}>Personalizado</option></select></div>
    <div class="f-well" ${pre === "wellness" ? "" : "hidden"}><p class="tiny muted" style="margin:0 0 6px">Siempre pregunta calidad de sueño, energía, agujetas, estrés, ánimo, ganas de entrenar y salud articular (1–5). Además:</p><fieldset class="medpick"><legend>Datos extra</legend>${WELL_OPC.map(([k, l]) => chk("f_opc", k, opc.includes(k), l)).join("")}</fieldset></div>
    <div class="f-q" ${pre === "wellness" ? "hidden" : ""}><div class="f"><label>Preguntas (una por línea)</label><textarea name="preguntas" style="min-height:150px">${esc((c.preguntas && c.preguntas.length ? c.preguntas : pre === "revision" ? REV_SEMANAL : []).join("\n"))}</textarea></div><p class="tiny muted" style="margin:4px 0 0">Empieza la línea con <b>1-10:</b>, <b>1-5:</b> o <b>Sí/No:</b> para que responda tocando; sin nada, responde escribiendo.</p></div>
    <div class="f"><label>Instrucciones (opcional)</label><textarea name="detalle" style="min-height:60px" placeholder="Rellénalo por la mañana, en ayunas">${esc(c.detalle || "")}</textarea></div>`; }
  if (t === "nota") return `<div class="grid2"><div class="f"><label>Hora a la que le aparece</label><input type="time" name="hora" value="${esc(c.hora || "08:00")}"></div><div class="f"><label>Plantilla</label><select data-act-change="msg-plant"><option value="">Escribir uno nuevo…</option>${MSG_PLANT.map(m => `<option>${esc(m)}</option>`).join("")}</select></div></div>
    <div class="f"><label>Mensaje</label><textarea name="detalle" style="min-height:110px" required>${esc(c.detalle || "")}</textarea></div>
    <label class="small"><input type="checkbox" name="x_resp" ${c.responder ? "checked" : ""}> Que pueda contestarte desde el mensaje</label>`;
  if (t === "peso") return `<div class="f"><label>Cuándo se tiene que pesar</label><select name="x_mom">${PESO_MOM.map(([k, l]) => `<option value="${k}" ${(c.momento || "ayunas") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <label class="small"><input type="checkbox" name="x_misma" ${c.misma_bascula !== false ? "checked" : ""}> Recordarle usar siempre la misma báscula, en suelo duro</label>
    <div class="f"><label>Nota (opcional)</label><textarea name="detalle" style="min-height:60px">${esc(c.detalle || "")}</textarea></div>`;
  if (t === "fotos") { const v = c.vistas || FOTO_DEF, co = c.condiciones || FOTO_COND.slice(0, 4);
    return `<fieldset class="medpick"><legend>Qué fotos tiene que subir</legend>${FOTO_V.map(([k, l]) => chk("x_vis", k, v.includes(k), l)).join("")}</fieldset>
    <fieldset class="medpick one"><legend>Condiciones que le recuerdas</legend>${FOTO_COND.map(l => chk("x_cond", l, co.includes(l), l)).join("")}</fieldset>
    <div class="f"><label>Nota (opcional)</label><textarea name="detalle" style="min-height:60px">${esc(c.detalle || "")}</textarea></div>`; }
  if (t === "medidas") return `${medPicker(c.medidas)}<div class="grid2"><div class="f"><label>Lado para brazo, muslo y gemelo</label><select name="x_lado"><option value="derecho" ${(c.lado || "derecho") === "derecho" ? "selected" : ""}>Derecho</option><option value="izquierdo" ${c.lado === "izquierdo" ? "selected" : ""}>Izquierdo</option></select></div><div class="f"><label>Nota (opcional)</label><input name="detalle" value="${esc(c.detalle || "")}"></div></div>`;
  return `<div class="f"><label>Qué tiene que hacer</label><textarea name="detalle" style="min-height:90px">${esc(c.detalle || "")}</textarea></div>
    <div class="f"><label>Pasos para marcar (uno por línea, opcional)</label><textarea name="x_check" style="min-height:70px" placeholder="Comprar cinta métrica\nDescargar app de pasos">${esc((c.checklist || []).join("\n"))}</textarea></div>
    <div class="grid2"><div class="f"><label>Enlace (opcional)</label><input name="x_link" type="url" value="${esc(c.enlace || "")}" placeholder="https://"></div><label class="small" style="align-self:end"><input type="checkbox" name="x_com" ${c.pedir_comentario ? "checked" : ""}> Pedirle un comentario al terminar</label></div>`;
}
function readTypeExtras(root, t) {
  if (t === "workout") { const c = readWEditor(root, "workout"); c.objetivo = gv(root, "x_obj"); c.dur_est = num(gv(root, "x_dur")); return c; }
  if (t === "cardio") return readCardio(root);
  if (t === "formulario") { const p = gv(root, "f_tipo") || "libre"; if (p === "wellness") return { wellness: true, campos: chkSet(root, "f_opc"), detalle: gv(root, "detalle") }; return { preset: p, preguntas: lines(gv(root, "preguntas")), detalle: gv(root, "detalle") }; }
  if (t === "nota") return { hora: gv(root, "hora"), detalle: gv(root, "detalle"), responder: gv(root, "x_resp") };
  if (t === "peso") return { momento: gv(root, "x_mom"), misma_bascula: gv(root, "x_misma"), detalle: gv(root, "detalle") };
  if (t === "fotos") return { vistas: chkSet(root, "x_vis"), condiciones: chkSet(root, "x_cond"), detalle: gv(root, "detalle") };
  if (t === "medidas") return { medidas: chkSet(root, "med"), lado: gv(root, "x_lado"), detalle: gv(root, "detalle") };
  return { detalle: gv(root, "detalle"), checklist: lines(gv(root, "x_check")), enlace: /^https:\/\//.test(gv(root, "x_link")) ? gv(root, "x_link") : "", pedir_comentario: gv(root, "x_com") };
}
function validExtras(t, c) {
  if (t === "medidas" && !(c.medidas || []).length) return "Elige al menos una medida";
  if (t === "fotos" && !(c.vistas || []).length) return "Elige al menos una foto";
  if (t === "nota" && !c.detalle) return "Escribe el mensaje";
  if (t === "formulario" && !c.wellness && !(c.preguntas || []).length) return "Escribe al menos una pregunta";
  return "";
}

// Lo que registró el cliente en cardio y tareas con pasos (vista del entrenador)
function resExtra(x) {
  const r = x.resultado || {}, c = x.contenido || {}; const out = [];
  if (x.tipo === "cardio") { const p = [["min", " min"], ["km", " km"], ["pasos", " pasos"], ["fc", " ppm"], ["rpe", "/10 dureza"]].filter(([k]) => r[k] != null).map(([k, u]) => `${k === "pasos" ? Number(r[k]).toLocaleString("es-ES") : fmt(r[k])}${u}`); if (p.length) out.push(`<p class="small" style="margin:0"><b>Hizo:</b> ${esc(p.join(" · "))}</p>${cardioResumen(c) ? `<p class="tiny muted" style="margin:2px 0 0">Objetivo: ${esc(cardioResumen(c))}</p>` : ""}`); }
  if ((c.checklist || []).length && r.check) out.push(c.checklist.map((t, i) => `<p class="small" style="margin:2px 0">${r.check[i] ? "✅" : "⬜️"} ${esc(t)}</p>`).join(""));
  return out.length ? `<div class="card"><h2>Lo que registró</h2>${out.join("")}</div>` : "";
}
function medPicker(sel) {
  const on = new Set(sel && sel.length ? sel : MED_DEF);
  return `<fieldset class="medpick"><legend>Qué medidas tiene que tomar <span class="tiny"><button type="button" class="lnk" data-act="med-all" data-v="1">Todas</button> · <button type="button" class="lnk" data-act="med-all" data-v="0">Ninguna</button></span></legend>${MEDIDAS.map(([k, l, d]) => `<label class="mchk"><input type="checkbox" name="med" value="${k}" ${on.has(k) ? "checked" : ""}><span><b>${esc(l)}</b><br><span class="tiny muted">${esc(d)}</span></span></label>`).join("")}</fieldset>`;
}
function asigBody(x, tpls) {
  const t = x.tipo; const c = x.contenido || {};
  if (t === "evento") return `<div class="grid2"><div class="f"><label>Título</label><input name="titulo" required value="${esc(x.titulo || "")}" placeholder="Torneo nacional"></div><div class="f"><label>Tipo de evento</label><select name="ev_tipo">${Object.entries(EV_TIPOS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div></div>
  <div class="grid2"><div class="f"><label>Desde</label><input type="date" name="fecha" value="${esc(x.fecha)}" required></div><div class="f"><label>Hasta (opcional)</label><input type="date" name="fin"></div></div>
  <div class="f"><label>Notas</label><textarea name="notas"></textarea></div><label class="small"><input type="checkbox" name="visible" checked> Lo ve el cliente</label>`;
  const opts = tpls.filter(p => (t === "cardio" ? p.tipo === "cardio" : p.tipo === "workout"));
  return `<div class="grid2"><div class="f"><label>Título</label><input name="titulo" required value="${esc(x.titulo || "")}" placeholder="${{ workout: "Pierna A", cardio: "Rodaje Z2", formulario: "Revisión semanal", nota: "Buenos días", peso: "Pesarte en ayunas", fotos: "Fotos de progreso", medidas: "Medidas", tarea: "Comprar cinta métrica" }[t] || ""}"></div><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${esc(x.fecha)}" required></div></div>
  ${(t === "workout" || t === "cardio") && opts.length ? `<div class="row tplrow"><select id="tpl-sel" aria-label="Cargar de la librería" style="flex:1"><option value="">Cargar de la librería…</option>${opts.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("")}</select><button type="button" class="btn sm" data-act="tpl-load">Cargar</button></div>` : ""}
  ${typeExtras(t, c)}
  <label class="chkrow"><input type="checkbox" name="visible" ${x.visible !== false ? "checked" : ""}><span><b>Lo ve el cliente</b><small>Si lo desmarcas, queda como borrador solo para ti</small></span></label>
  ${!x.id ? `<div class="grid2"><div class="f"><label>Repetir</label><select name="rep"><option value="">No repetir</option><option value="1">Cada día</option><option value="2">Cada 2 días</option><option value="7">Cada semana</option></select></div><div class="f"><label>Hasta el</label><input type="date" name="rep_hasta"></div></div>` : ""}`;
}
async function saveAsig(f) {
  const id = f.dataset.id; const tipo = S.sub.asigTipo; const cid = S.coach.cid;
  try {
    if (tipo === "evento") {
      await q(sb.from("events").insert({ client_id: cid, titulo: f.titulo.value.trim(), tipo: f.ev_tipo.value, fecha: f.fecha.value, fin: f.fin.value || null, notas: f.notas.value.trim(), visible_cliente: f.visible.checked }));
    } else {
      const contenido = readTypeExtras(f, tipo); const bad = validExtras(tipo, contenido); if (bad) { toast(bad); return; }
      if (tipo === "workout") await newExercisesFrom(contenido);
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
  const [ps] = await Promise.all([q(sb.from("programs").select("id,nombre,semanas,descripcion,items").order("nombre")), S.coach.list.length ? null : loadClients()]);
  if (!ps.length) { sheet(`<h2>Programar programa</h2><p class="small">Aún no tienes programas hechos. Puedes crearlos en <b>Librería → Programas</b> o guardar semanas ya planificadas de un cliente con <b>«Guardar como programa»</b> en su calendario.</p><button class="btn pri block" data-act="go" data-h="lib">Ir a la Librería</button><button type="button" class="btn ghost" data-act="close">Cerrar</button>`); return; }
  S.sub.progs = ps; const nm = monday(addDays(today(), 7)); const p0 = ps.find(p => p.id === programId) || ps[0];
  sheet(`<h2>Programar programa</h2><form id="f-asigprog" style="display:flex;flex-direction:column;gap:10px">
  ${S.view.startsWith("lib") ? `<div class="f"><label>Cliente</label><select name="cid">${S.coach.list.filter(c => c.estado !== "baja").map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select></div>` : ""}
  <div class="f"><label>Programa</label><select name="pid" data-act-change="ap-prev">${ps.map(p => `<option value="${esc(p.id)}" ${p.id === p0.id ? "selected" : ""}>${esc(p.nombre)} · ${p.semanas} sem.</option>`).join("")}</select></div>
  <div class="grid2"><div class="f"><label>Empieza la semana del lunes</label><input type="date" name="inicio" value="${nm}" required data-act-change="ap-prev"></div><div class="f"><label>Desde la semana del programa</label><select name="desde" data-act-change="ap-prev">${Array.from({ length: p0.semanas }, (_, i) => `<option value="${i + 1}">Semana ${i + 1}</option>`).join("")}</select></div></div>
  <label class="small"><input type="checkbox" name="reemplazar"> Borrar antes lo <b>no hecho</b> que ya tenga en esas semanas</label>
  <label class="small"><input type="checkbox" name="ocultar"> Programarlo oculto (el cliente no lo ve hasta que lo muestres)</label>
  <div id="ap-prev" class="card flat">${apPreview(p0, nm, 1)}</div>
  <button class="btn pri block">Programar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`, "wide");
}
function apPreview(p, inicio, desde) {
  const its = (p.items || []).filter(it => it.semana >= desde); if (!its.length) return `<p class="small muted" style="margin:0">Este programa no tiene nada a partir de esa semana.</p>`;
  const sems = [...new Set(its.map(it => it.semana))].sort((a, b) => a - b); const ini = monday(inicio);
  return `<p class="small" style="margin:0 0 6px"><b>${its.length}</b> elementos en <b>${sems.length}</b> semanas · del ${esc(fdate(ini))} al ${esc(fdate(addDays(ini, (Math.max(...sems) - desde) * 7 + 6)))}</p>${p.descripcion ? `<p class="tiny muted" style="margin:0 0 6px">${esc(p.descripcion)}</p>` : ""}<div class="tbl"><table><tbody>${sems.map(s => `<tr><td style="white-space:nowrap"><b>S${s}</b> · ${esc(fdate(addDays(ini, (s - desde) * 7), { day: "numeric", month: "short" }))}</td><td>${its.filter(it => it.semana === s).sort((a, b) => a.dia - b.dia).map(it => `<span class="pch tp-${esc(it.tipo)}" style="display:inline-block;margin:1px 2px">${esc(DSEM[it.dia].slice(0, 2))} · ${esc(it.titulo || TIPOS[it.tipo])}</span>`).join("")}</td></tr>`).join("")}</tbody></table></div>`;
}
function apRefresh(f) {
  const p = (S.sub.progs || []).find(x => x.id === f.pid.value); if (!p) return;
  if (f.desde.options.length !== p.semanas) { const v = Math.min(+f.desde.value || 1, p.semanas); f.desde.innerHTML = Array.from({ length: p.semanas }, (_, i) => `<option value="${i + 1}" ${i + 1 === v ? "selected" : ""}>Semana ${i + 1}</option>`).join(""); }
  $("#ap-prev").innerHTML = apPreview(p, f.inicio.value || today(), +f.desde.value || 1);
}
async function asignarPrograma(f) {
  const cid = f.cid ? f.cid.value : S.coach.cid; const inicio = monday(f.inicio.value); const desde = +f.desde.value || 1;
  try {
    const p = (await q(sb.from("programs").select("*").eq("id", f.pid.value).limit(1)))[0]; const tpls = await tplLib();
    const its = (p.items || []).filter(it => it.semana >= desde);
    const rows = its.map((it, i) => { const tp = it.template_id && tpls.find(x => x.id === it.template_id); return { client_id: cid, fecha: addDays(inicio, (it.semana - desde) * 7 + (it.dia - 1)), orden: i, tipo: it.tipo, titulo: it.titulo || (tp && tp.nombre.replace(/^[^·]+ · /, "")) || TIPOS[it.tipo], contenido: tp ? tp.contenido : (it.contenido || {}), programa: p.nombre, visible: !f.ocultar.checked }; });
    if (!rows.length) { toast("No hay nada que programar"); return; }
    if (f.reemplazar.checked) { const fin = rows.reduce((m, r) => r.fecha > m ? r.fecha : m, inicio); await q(sb.from("assignments").delete().eq("client_id", cid).eq("hecho", false).gte("fecha", inicio).lte("fecha", addDays(monday(fin), 6))); }
    await q(sb.from("assignments").insert(rows)); sheet(""); toast(`Programado: ${rows.length} elementos`);
    if (S.view.startsWith("lib")) { S.coach.tab = "plan"; S.coach.cid = null; location.hash = "c-" + cid; S.coach.calM = inicio.slice(0, 7); } else { S.coach.calM = inicio.slice(0, 7); S.coach.keep = true; viewCoachClient(cid); }
  } catch (e) { toast(errMsg(e)); }
}
/* Guardar semanas ya planificadas de un cliente como programa reutilizable */
function openProgDesdeCal() {
  const mon = monday(today());
  sheet(`<h2>Guardar como programa</h2><form id="f-progcal" style="display:flex;flex-direction:column;gap:10px">
  <div class="f"><label>Nombre del programa</label><input name="nombre" required placeholder="Hipertrofia torso-pierna · 4 semanas"></div>
  <div class="grid2"><div class="f"><label>Desde la semana del lunes</label><input type="date" name="de" value="${mon}" required></div><div class="f"><label>Número de semanas</label><input name="n" type="number" min="1" max="16" value="4"></div></div>
  <fieldset class="medpick"><legend>Qué incluir</legend>${Object.entries(TIPOS).map(([k, l]) => `<label class="mchk"><input type="checkbox" name="tip" value="${k}" ${k === "nota" ? "" : "checked"}><span><b>${esc(l)}</b></span></label>`).join("")}</fieldset>
  <div class="f"><label>Descripción (opcional)</label><input name="descripcion"></div>
  <p class="tiny muted" style="margin:0">Se guarda una copia en Librería → Programas (sin lo que haya hecho el cliente). Luego puedes editarlo y programárselo a quien quieras.</p>
  <button class="btn pri block">Guardar programa</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function progDesdeCal(f) {
  const de = monday(f.de.value), n = Math.min(16, Math.max(1, +f.n.value || 1)), tips = [...f.querySelectorAll("input[name=tip]:checked")].map(i => i.value);
  try {
    const src = await q(sb.from("assignments").select("fecha,orden,tipo,titulo,contenido").eq("client_id", S.coach.cid).gte("fecha", de).lte("fecha", addDays(de, n * 7 - 1)).order("fecha").order("orden"));
    const items = src.filter(x => tips.includes(x.tipo)).map(x => { const d = daysBetween(de, x.fecha); const c = { ...(x.contenido || {}) }; delete c.harbiz_id; return { semana: Math.floor(d / 7) + 1, dia: (d % 7) + 1, tipo: x.tipo, titulo: x.titulo, contenido: c }; });
    if (!items.length) { toast("No hay nada planificado en esas semanas"); return; }
    const r = await q(sb.from("programs").insert({ nombre: f.nombre.value.trim(), descripcion: f.descripcion.value.trim(), semanas: n, items }).select("id"));
    sheet(""); toast(`Programa guardado (${items.length} elementos)`); location.hash = "lib-p-" + r[0].id;
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
function mesoBlock(b = {}) { return `<div class="mb card" data-b><div class="grid2"><div class="f"><label>Nombre</label><input name="b_n" value="${esc(b.nombre || "")}" placeholder="Mesociclo 2 · Hipertrofia"></div><div class="f"><label>Objetivo (privado)</label><input name="b_o" value="${esc(b.objetivo || "")}"></div></div><div class="f"><label>Notas (privadas)</label><input name="b_no" value="${esc(b.notas || "")}"></div><div class="mws">${(b.semanas || []).map(mesoWeek).join("")}</div><div class="row"><button type="button" class="btn sm" data-act="mw-add">+ Semana</button><span class="grow"></span><button type="button" class="btn ghost sm" data-act="mb-del" style="color:var(--bad)">Quitar mesociclo</button></div></div>`; }
function openMeso() {
  sheet(`<h2>Mesociclos</h2><p class="tiny muted" style="margin:0">El cliente solo ve el nombre del mesociclo, las semanas y el foco de cada semana. El objetivo y las notas son privados.</p><form id="f-meso" style="display:flex;flex-direction:column;gap:12px"><div id="mbs" style="display:flex;flex-direction:column;gap:12px">${(S.coach.pl.bloques || []).map(mesoBlock).join("")}</div><button type="button" class="btn" data-act="mb-add">+ Mesociclo</button><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`, "wide");
}
async function saveMeso(f) {
  const bloques = [...f.querySelectorAll("[data-b]")].map((b, i) => { const g = n => b.querySelector(`[name="${n}"]`).value.trim(); const semanas = [...b.querySelectorAll("[data-w]")].map(w => { const h = n => w.querySelector(`[name="${n}"]`).value.trim(); return { nombre: h("s_n"), inicio: h("s_i"), fin: h("s_f"), tipo: h("s_t"), foco: h("s_fo") }; }).filter(w => w.nombre || w.inicio);
    const old = (S.coach.pl.bloques || [])[i] || {}; return { ...old, nombre: g("b_n"), objetivo: g("b_o"), notas: g("b_no"), inicio: semanas.length ? semanas[0].inicio : old.inicio || "", fin: semanas.length ? semanas[semanas.length - 1].fin : old.fin || "", semanas }; }).filter(b => b.nombre || b.semanas.length);
  const mesos = bloques.map(b => ({ objetivo: b.objetivo || "", notas: b.notas || "" })); const pub = bloques.map(({ objetivo, notas, ...b }) => b);
  try { await q(sb.from("plans").upsert({ client_id: S.coach.cid, bloques: pub }, { onConflict: "client_id" })); await q(sb.from("clients").update({ ficha: { ...(S.coach.c.ficha || {}), mesos } }).eq("id", S.coach.cid)); sheet(""); toast("Mesociclos guardados"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); }
}

/* ---- Información ---- */
const PERFILES = { hipertrofia: "Hipertrofia / estética", fuerza: "Fuerza / rendimiento", combate: "Deportes de combate", salud: "Salud / principiante / pérdida de grasa" };
function pendRow(p = {}) { return `<div class="row pend" data-p><input type="checkbox" name="p_d" ${p.done ? "checked" : ""} aria-label="Hecho" style="width:22px;height:22px"><input name="p_t" value="${esc(p.t || "")}" class="grow" aria-label="Pendiente"><button type="button" class="btn ghost sm" data-act="row-del" aria-label="Quitar">✕</button></div>`; }
function marcaRow(m = {}) { return `<div class="mrow" data-m><input name="m_e" list="dl-ex" value="${esc(m.ejercicio || "")}" placeholder="Ejercicio" aria-label="Ejercicio"><input type="date" name="m_f" value="${esc(m.fecha || "")}" aria-label="Fecha"><input name="m_c" inputmode="decimal" value="${esc(m.carga ?? "")}" placeholder="kg" aria-label="Carga"><input name="m_r" inputmode="numeric" value="${esc(m.reps ?? "")}" placeholder="reps" aria-label="Repeticiones"><input name="m_i" inputmode="numeric" value="${esc(m.rir ?? "")}" placeholder="RIR" aria-label="RIR"><input name="m_n" value="${esc(m.nota || "")}" placeholder="Nota" aria-label="Nota" class="mrn"><button type="button" class="btn ghost sm" data-act="row-del" aria-label="Quitar">✕</button></div>`; }
function tabInfo(c, pl) {
  const f = c.ficha || {}; const pg = f.pago || {};
  const fld = (n, l, v, o = "") => `<div class="f"><label for="i-${n}">${l}</label><input id="i-${n}" name="${n}" value="${esc(v ?? "")}" ${o}></div>`;
  const ta = (n, l, v, h = 80) => `<div class="f"><label for="i-${n}">${l}</label><textarea id="i-${n}" name="${n}" style="min-height:${h}px">${esc(v ?? "")}</textarea></div>`;
  return `<div class="privnote">🔒 Todo lo de esta pestaña es privado: el cliente no puede verlo ni desde la app ni accediendo a los datos.</div><form id="f-info" class="cols" style="align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px">
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Datos</h2>${fld("nombre", "Nombre", c.nombre, "required")}
   <div class="f"><label for="i-perfil">Perfil</label><select id="i-perfil" name="perfil">${Object.entries(PERFILES).map(([k, l]) => `<option value="${k}" ${f.perfil === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
   <div class="grid2">${fld("fechaInicio", "Cliente desde", f.fechaInicio, 'type="date"')}${fld("telefono", "Teléfono", f.telefono, 'inputmode="tel"')}</div>
   <div class="grid3">${fld("edad", "Edad", f.edad)}${fld("altura", "Altura", f.altura)}${fld("pesoInicial", "Peso inicial (kg)", f.pesoInicial, 'inputmode="decimal"')}</div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Objetivo</h2>${ta("objetivo", "Objetivo", f.objetivo, 110)}${ta("ejerciciosClave", "Ejercicios clave (uno por línea)", (f.ejerciciosClave || []).join("\n"), 60)}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Salud y limitaciones</h2>${ta("salud", "Una por línea · empieza con «!» las que deben destacarse arriba", (f.salud || []).join("\n"), 120)}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Pago</h2><div class="grid2">${fld("cuota", "Cuota (€)", pg.cuota, 'inputmode="decimal"')}<div class="f"><label for="i-per">Periodicidad</label><select id="i-per" name="periodicidad">${["mensual", "trimestral", "semestral", "anual", "pago único"].map(p => `<option value="${p}" ${pg.periodicidad === p ? "selected" : ""}>${cap(p)}</option>`).join("")}</select></div>${fld("metodo", "Método", pg.metodo)}${fld("proximoCobro", "Próximo cobro", pg.proximoCobro, 'type="date"')}</div></div>
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
  try { await q(sb.from("clients").update({ nombre: v("nombre"), ficha }).eq("id", c.id)); toast("Información guardada"); S.coach.keep = true; viewCoachClient(c.id); } catch (e) { toast(errMsg(e)); }
}

/* ---- Evolución ---- */
const EVO = [["recuperacion", "Recuperación"], ["fuerza", "Progreso de cargas"], ["entrenos", "Sesiones"], ["actividad", "Cumplimiento"], ["wellness", "Bienestar diario"], ["cuerpo", "Peso y medidas"], ["fotos", "Fotos"], ["tests", "Tests"]];
async function tabEvo(c) {
  const sub = S.coach.evo || "recuperacion"; const cid = c.id; let body = "";
  if (sub === "recuperacion") body = await tabRecup(c);
  else if (sub === "actividad") {
    const as = await q(sb.from("assignments").select("*").eq("client_id", cid).lte("fecha", today()).gte("fecha", addDays(today(), -28)).order("fecha", { ascending: false }));
    const byW = {}; as.forEach(x => { const k = monday(x.fecha); (byW[k] = byW[k] || []).push(x); });
    body = `<div class="card"><h2>Cumplimiento por semana</h2>${Object.keys(byW).length ? `<table><tbody>${Object.entries(byW).map(([k, v]) => { const p = Math.round(100 * v.filter(x => x.hecho).length / v.length); return `<tr><td>Semana del ${esc(fdate(k))}</td><td class="n">${v.filter(x => x.hecho).length}/${v.length}</td><td class="n"><span class="chip ${p >= 80 ? "ok" : p >= 50 ? "warn" : "bad"}">${p} %</span></td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">Sin tareas programadas en las últimas 4 semanas.</div>`}</div>
    <div class="card"><h2>Últimas tareas</h2>${as.length ? `<table><tbody>${as.slice(0, 40).map(x => `<tr data-act="asig-edit" data-id="${esc(x.id)}" style="cursor:pointer"><td style="white-space:nowrap" class="tiny muted">${esc(fdate(x.fecha, { day: "numeric", month: "short" }))}</td><td>${tipoChip(x.tipo)} ${esc(x.titulo)}${x.respuesta ? `<div class="tiny muted">«${esc(x.respuesta)}»</div>` : ""}</td><td>${x.hecho ? `<span class="chip ok">Hecho</span>` : `<span class="chip bad">No hecho</span>`}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">—</div>`}</div>`;
  } else if (sub === "entrenos") {
    const wo = await q(sb.from("workouts").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40));
    body = wo.length ? wo.map(w => { const st = sesStats(w); return `<div class="card ses"><div class="seshd"><div><h2>${esc(w.dia || "Entreno")}</h2><span class="tiny muted">${esc(cap(fdate(w.fecha, { weekday: "long", day: "numeric", month: "long" })))}</span></div>
      <div class="sesk">${w.rpe_sesion != null ? `<span><b>${esc(w.rpe_sesion)}<small>/10</small></b><em>dureza</em></span>` : ""}${w.duracion_min ? `<span><b>${esc(w.duracion_min)}<small> min</small></b><em>duración</em></span>` : ""}<span><b>${st.ej}</b><em>ejercicios</em></span><span><b>${st.series}</b><em>series</em></span>${st.vol ? `<span><b>${fmt(st.vol, 0)}<small> kg</small></b><em>volumen</em></span>` : ""}${w.rpe_sesion != null && w.duracion_min ? `<span><b>${w.rpe_sesion * w.duracion_min}<small> UA</small></b><em>carga interna</em></span>` : ""}</div></div>
      ${sessionTable(w.sets)}${w.comentario ? `<div class="sescom">💬 ${esc(w.comentario)}</div>` : ""}</div>`; }).join("") : `<div class="empty">Aún no ha registrado ningún entreno.</div>`;
  } else if (sub === "fuerza") {
    const wo = await q(sb.from("workouts").select("fecha,sets").eq("client_id", cid).order("fecha", { ascending: true }).limit(400));
    const exs = [...new Set(wo.flatMap(w => (w.sets || []).filter(s => s.kg != null).map(s => s.ejercicio)))]; const sel = exs.includes(S.sub.cex) ? S.sub.cex : exs[0];
    const pts = wo.map(w => { const v = (w.sets || []).filter(s => s.ejercicio === sel).map(s => e1rm(s.kg, s.reps, s.rir)).filter(Boolean); return { x: w.fecha, y: v.length ? Math.max(...v) : null }; });
    const rows = exs.map(x => { const ses = wo.map(w => ({ f: w.fecha, s: (w.sets || []).filter(y => y.ejercicio === x && y.kg != null) })).filter(z => z.s.length); const l = ses[ses.length - 1], p0 = ses[ses.length - 2];
      const e1 = z => Math.max(...z.s.map(y => e1rm(y.kg, y.reps, y.rir) || 0)); const bestSet = z => z.s.slice().sort((a, b) => (e1rm(b.kg, b.reps, b.rir) || 0) - (e1rm(a.kg, a.reps, a.rir) || 0))[0];
      const best = Math.max(...ses.map(e1)); const mx = Math.max(...ses.flatMap(z => z.s.map(y => +y.kg))); const ch = p0 ? e1(l) - e1(p0) : null; const chT = ses.length > 1 ? e1(l) - e1(ses[0]) : null;
      return { x, l, ses, best, mx, ch, chT, bs: bestSet(l) }; }).sort((a, b) => b.l.f.localeCompare(a.l.f));
    const chip = v => v == null ? `<span class="muted">—</span>` : `<span class="chip ${v > 0 ? "ok" : v < 0 ? "bad" : ""}">${v > 0 ? "+" : ""}${fmt(v)} kg</span>`;
    body = exs.length ? `<div class="card"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap"><h2 class="grow" style="margin:0">1RM estimado por ejercicio</h2><select id="cex-sel" aria-label="Ejercicio" style="max-width:320px">${exs.map(x => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>${lineChart(pts, { label: "1RM estimado", unit: "kg" })}<p class="tiny muted" style="margin:6px 0 0">Calculado con la mejor serie de cada sesión (carga, repeticiones y RIR).</p></div>
    <div class="card flat"><div class="tbl"><table class="htable ptab"><thead><tr><th>Ejercicio</th><th>Última sesión</th><th>Mejor serie de esa sesión</th><th class="n">Carga máx.</th><th class="n">1RM est.</th><th class="n">vs. anterior</th><th class="n">vs. inicio</th></tr></thead><tbody>${rows.map(r => `<tr data-act="ex-hist" data-n="${esc(r.x)}"><td><span class="lnk">${esc(r.x)}</span><div class="tiny muted">${r.ses.length} sesiones</div></td><td>${esc(fdate(r.l.f, { day: "numeric", month: "short" }))}<div class="tiny muted">${r.l.s.length} series</div></td><td>${setPill(r.bs)}</td><td class="n"><b>${fmt(r.mx)}</b> kg</td><td class="n">${r.best ? fmt(r.best) + " kg" : "—"}</td><td class="n">${chip(r.ch)}</td><td class="n">${chip(r.chT)}</td></tr>`).join("")}</tbody></table></div><p class="tiny muted" style="margin:8px 0 0">Pulsa un ejercicio para ver todas sus series.</p></div>` : `<div class="empty">Aún no hay series con carga registradas.</div>`;
  } else if (sub === "wellness") {
    const wl = await q(sb.from("wellness").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(60));
    body = `<div class="card"><h2>Bienestar diario <small>1–5 (5 = mejor)</small></h2>${lineChart(wl.map(w => ({ x: w.fecha, y: wellIdx(w) })), { label: "Bienestar", yMin: 1, yMax: 5, dec: 2 })}</div><div class="card"><div class="tbl"><table><thead><tr><th>Fecha</th>${WK.map(([, l]) => `<th class="n">${esc(l.split(" ")[0])}</th>`).join("")}<th class="n">Sueño h</th><th class="n">FC</th><th class="n">VFC</th><th>Molestia</th><th>Comentario</th></tr></thead><tbody>${wl.map(w => `<tr><td>${esc(fdate(w.fecha))}</td>${WK.map(([k]) => `<td class="n">${w[k] ?? "—"}</td>`).join("")}<td class="n">${w.sueno_h ?? "—"}</td><td class="n">${w.fc ?? "—"}</td><td class="n">${w.hrv ?? "—"}</td><td>${esc(w.molestia_zona || "")}${w.molestia_0a10 != null ? " " + w.molestia_0a10 + "/10" : ""}</td><td class="tiny">${esc(w.comentario || "")}</td></tr>`).join("") || `<tr><td colspan="14" class="muted">Sin cuestionarios.</td></tr>`}</tbody></table></div></div>`;
  } else if (sub === "cuerpo") {
    const [ws, ms] = await Promise.all([q(sb.from("weights").select("fecha,kg").eq("client_id", cid).order("fecha", { ascending: true }).limit(400)), q(sb.from("measurements").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(30))]);
    const byW = {}; ws.forEach(w => { const k = monday(w.fecha); (byW[k] = byW[k] || []).push(+w.kg); });
    body = `<div class="card"><h2>Peso medio semanal</h2>${lineChart(Object.entries(byW).map(([x, v]) => ({ x, y: avg(v) })), { label: "Peso medio semanal" })}</div><div class="card"><h2>Medidas <small>cm</small></h2>${ms.length ? `<div class="tbl">${medTable(ms)}</div>` : `<div class="empty">Sin medidas.</div>`}</div>`;
  } else if (sub === "fotos") {
    const ph = await q(sb.from("photos").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40)); let urls = {};
    if (ph.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ph.map(p => p.path), 600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); }
    body = `<div class="card">${ph.length ? `<div class="photos">${ph.map(p => urls[p.path] ? `<figure style="margin:0"><img src="${esc(urls[p.path])}" alt="${esc(p.vista)} ${esc(fdate(p.fecha))}" loading="lazy"><figcaption class="tiny muted">${esc(fdate(p.fecha))} · ${esc(p.vista)}</figcaption></figure>` : "").join("")}</div>` : `<div class="empty">Sin fotos.</div>`}</div>`;
  } else {
    const ts = await q(sb.from("tests").select("*").eq("client_id", cid).order("fecha", { ascending: false, nullsFirst: false })); S.coach.tests = ts.slice().reverse();
    body = testsHTML(ts, true) + `<form id="f-test" class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Añadir test</h2><p class="tiny muted" style="margin:-4px 0 0">Usa el mismo nombre para repetir un test y se comparará solo con los anteriores.</p><div class="grid2"><div class="f"><label>Test</label><input name="nombre" required placeholder="CMJ, 1RM, salto…" list="tests-dl" data-act-change="test-name"><datalist id="tests-dl">${[...new Map(ts.map(x => [tKey(x.nombre), x])).values()].map(x => `<option value="${esc(x.nombre)}">`).join("")}</datalist></div><div class="f"><label>Categoría</label><select name="categoria">${[["fuerza", "Fuerza"], ["salto", "Salto"], ["velocidad", "Velocidad"], ["resistencia", "Resistencia"], ["movilidad", "Movilidad"], ["composicion", "Composición corporal"], ["otro", "Otro"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div></div>
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
  return `<div class="row" style="flex-wrap:wrap"><button class="btn pri" data-act="rep-new" data-auto="1" title="Se rellena con los datos de la semana. Nada se publica hasta que pulses «Publicar».">+ Nueva revisión</button><button class="btn" data-act="rep-new" data-auto="0">En blanco</button></div>
  ${rp.length ? rp.map(r => `<div class="card"><h2>${esc(r.titular || "Revisión")} <small>${esc(fdate(r.fecha))}${r.semana ? " · " + esc(r.semana) : ""}</small></h2><div class="row" style="flex-wrap:wrap"><span class="chip ${r.publicado ? "ok" : "warn"}">${r.publicado ? "Visible para el cliente" : "Borrador (no lo ve)"}</span><span class="tag tag-${r.autor === "adrian" ? "workout" : "formulario"}">${r.autor === "adrian" ? "Hecho por ti" : "Hecho por Claude"}</span>${r.publicado ? `<span class="chip ${r.leido_en ? "ok" : ""}">${r.leido_en ? "Leída " + esc(relTime(r.leido_en)) : "Sin leer"}</span>` : ""}${(r.adjuntos || []).length ? `<span class="chip">📎 ${(r.adjuntos || []).length}</span>` : ""}<span class="grow"></span><button class="btn sm" data-act="ver-informe" data-id="${esc(r.id)}">Vista del cliente</button><button class="btn sm" data-act="rep-edit" data-id="${esc(r.id)}">Editar</button><button class="btn sm ${r.publicado ? "" : "pri"}" data-act="publicar" data-id="${esc(r.id)}" data-v="${r.publicado ? "0" : "1"}">${r.publicado ? "Ocultar" : "Publicar"}</button></div>${r.respuesta ? `<div class="rresp"><b>Respuesta de ${esc(clientName(r.client_id))}</b> <span class="tiny muted">${esc(relTime(r.respondido_en))}</span><p>${esc(r.respuesta)}</p></div>` : ""}</div>`).join("") : `<div class="empty">Aún no hay revisiones.</div>`}`;
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
  const tareas = as.filter(a => ["tarea", "formulario", "peso", "fotos", "medidas"].includes(a.tipo) && a.visible);
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
  if (!r) return; S.repAdjOld = (r.adjuntos || []).map(a => a.path);
  const kp = Object.entries(r.kpis || {}); while (kp.length < 4) kp.push(["", { valor: "", nota: "" }]);
  sheet(`<h2>${id ? "Editar revisión" : "Nueva revisión"}</h2>${auto && !id ? `<p class="tiny muted" style="margin:0">Relleno automático con los datos de la semana (${esc(fdate(addDays(r.fecha, -6)))}–${esc(fdate(r.fecha))}). Revisa y escribe lo que quieras; nada se publica hasta que pulses Publicar.</p>` : ""}
  <form id="f-rep" data-id="${esc(id || "")}" style="display:flex;flex-direction:column;gap:12px">
  <div class="grid3"><div class="f"><label>Fecha (fin de semana)</label><input name="fecha" type="date" value="${esc(r.fecha)}" required></div><div class="f"><label>Semana</label><input name="semana" value="${esc(r.semana || "")}" placeholder="Mesociclo 1 · S3"></div><div class="f"><label>Titular</label><input name="titular" value="${esc(r.titular || "")}" required></div></div>
  <div><div class="small" style="font-weight:700;margin-bottom:6px">Datos destacados</div>${kp.map(([k, v]) => `<div class="kprow" data-kp><input name="k_l" value="${esc(k)}" placeholder="Etiqueta (Entrenos)"><input name="k_v" value="${esc(v && v.valor != null ? v.valor : v || "")}" placeholder="Valor (4/4)"><input name="k_n" value="${esc((v && v.nota) || "")}" placeholder="Nota (100 %)"></div>`).join("")}</div>
  <p class="tiny muted" style="margin:0">Una línea por punto. Formato: <b>frase corta | explicación sencilla</b> (la explicación es opcional).</p>
  <div class="grid2"><div class="f"><label>Lo que ha hecho bien</label><textarea name="logros">${esc(repLines(r.logros))}</textarea></div><div class="f"><label>A mejorar</label><textarea name="mejorar">${esc(repLines(r.mejorar))}</textarea></div><div class="f"><label>A tener en cuenta</label><textarea name="tener">${esc(repLines(r.tener_en_cuenta))}</textarea></div><div class="f"><label>Foco para la semana que viene</label><textarea name="foco">${esc(repLines(r.foco))}</textarea></div></div>
  <div class="f"><label>Mensaje</label><textarea name="mensaje" style="min-height:90px">${esc(r.mensaje || "")}</textarea></div>
  <div class="f"><label>Vídeo de la revisión <span class="opt-l">enlace opcional (YouTube, Loom, Drive…)</span></label><input name="video_url" type="url" inputmode="url" value="${esc(r.video_url || "")}" placeholder="https://…"></div>
  <div class="f"><label>Archivos <span class="opt-l">PDF, fotos, vídeo o audio · máx. 50 MB cada uno</span></label><div class="adjl" id="rep-adj">${(r.adjuntos || []).map(a => `<div class="adji" data-path="${esc(a.path)}" data-nombre="${esc(a.nombre)}" data-tipo="${esc(a.tipo)}" data-size="${esc(a.size || 0)}"><span>${adjIco(a.tipo)}</span><b>${esc(a.nombre)}</b><button type="button" class="btn ghost sm" data-act="adj-del" aria-label="Quitar">✕</button></div>`).join("")}</div><input type="file" name="archivos" multiple accept="application/pdf,image/*,video/*,audio/*"></div>
  <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="mostrar_peso" ${r.mostrar_peso !== false ? "checked" : ""}> Mostrar el peso al cliente</label>
  <div class="row" style="flex-wrap:wrap"><button class="btn pri" name="pub" value="0">Guardar borrador</button><button class="btn dark" name="pub" value="1">Guardar y publicar</button><span class="grow"></span>${id ? `<button type="button" class="btn ghost sm bad" data-act="rep-del" data-id="${esc(id)}">Borrar</button>` : ""}</div></form>`, true);
}
async function saveReport(f, pub) {
  const cid = S.coach.cid; const L = n => lines(f[n].value);
  const kpis = {}; f.querySelectorAll("[data-kp]").forEach(r => { const g = n => r.querySelector(`[name="${n}"]`).value.trim(); if (g("k_l")) kpis[g("k_l")] = { valor: g("k_v"), nota: g("k_n") }; });
  const vurl = f.video_url.value.trim(); if (vurl && !safeUrl(vurl)) { toast("El enlace del vídeo debe empezar por https://"); return; }
  const row = { client_id: cid, fecha: f.fecha.value, semana: f.semana.value.trim(), titular: f.titular.value.trim(), kpis, logros: L("logros"), mejorar: L("mejorar"), tener_en_cuenta: L("tener"), foco: L("foco"), mensaje: f.mensaje.value.trim(), mostrar_peso: f.mostrar_peso.checked, video_url: vurl || null };
  if (pub) { row.publicado = true; row.publicado_en = new Date().toISOString(); }
  const btns = [...f.querySelectorAll("button[name=pub]")]; btns.forEach(b => b.disabled = true);
  try {
    let id = f.dataset.id;
    if (!id) { id = `${cid}-${row.fecha}`; const ex = await q(sb.from("reports").select("id").eq("id", id)); if (ex.length) id += "-" + Math.random().toString(36).slice(2, 5); }
    const adj = [...f.querySelectorAll(".adji")].map(e => ({ path: e.dataset.path, nombre: e.dataset.nombre, tipo: e.dataset.tipo, size: +e.dataset.size || 0 }));
    const files = [...(f.archivos.files || [])];
    for (const [k, file] of files.entries()) {
      if (file.size > 52428800) { toast(`«${file.name}» pesa más de 50 MB`); continue; }
      btns[0].textContent = `Subiendo ${k + 1} de ${files.length}…`;
      const img = /^image\//.test(file.type) && !/heic/i.test(file.type); const blob = img ? await shrink(file, 2000, .85) : file;
      const limpio = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80); const path = `${cid}/${id}/${uid()}-${img ? limpio.replace(/\.\w+$/, "") + ".jpg" : limpio}`;
      const { error } = await sb.storage.from("revisiones").upload(path, blob, { contentType: img ? "image/jpeg" : file.type || "application/octet-stream", upsert: false }); if (error) throw error;
      adj.push({ path, nombre: file.name, tipo: img ? "image/jpeg" : file.type, size: blob.size });
    }
    row.adjuntos = adj;
    if (f.dataset.id) await q(sb.from("reports").update(row).eq("id", id)); else await q(sb.from("reports").insert({ id, autor: "adrian", publicado: !!pub, ...row }));
    const quitados = (S.repAdjOld || []).filter(p => !adj.some(a => a.path === p)); if (quitados.length) await sb.storage.from("revisiones").remove(quitados);
    sheet(""); toast(pub ? "Revisión publicada: ya la ve el cliente" : "Borrador guardado"); refreshClient();
  } catch (e) { toast(errMsg(e)); btns.forEach(b => b.disabled = false); btns[0].textContent = "Guardar borrador"; }
}
const adjIco = t => /pdf/.test(t) ? "📄" : /^image/.test(t) ? "🖼️" : /^video/.test(t) ? "🎬" : /^audio/.test(t) ? "🎙️" : "📎";
function tabCuenta(c, pl) {
  return `<form id="f-cuenta" class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Cuenta</h2><div class="f"><label for="cu-e">Email de acceso</label><input id="cu-e" name="email" type="email" value="${esc(c.email)}"></div><div class="f"><label for="cu-s">Estado</label><select id="cu-s" name="estado">${[["activo", "Activo"], ["pausa", "En pausa"], ["baja", "Baja"]].map(([v, l]) => `<option value="${v}" ${c.estado === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><p class="tiny muted" style="margin:0">«Baja» le quita el acceso a la app al momento.</p>
  <h2 style="margin-top:6px">Qué progreso ve</h2><div class="row">${[["fuerza", "Cargas"], ["peso", "Peso"], ["bienestar", "Bienestar"], ["medidas", "Medidas"], ["tests", "Tests"], ["fotos", "Fotos"]].map(([k, l]) => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="pv" value="${k}" ${(pl.progreso_visible || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div><div class="row"><span class="grow"></span><button class="btn pri">Guardar cambios</button></div></form>
  <div class="card"><h2>Acceso a la app</h2>${c.user_id ? `<p class="small" style="margin:0 0 10px">Cuenta creada y vinculada.</p><button class="btn sm" data-act="desvincular" data-cid="${esc(c.id)}">Desvincular cuenta</button><p class="tiny muted">Úsalo si cambia de email o pierde el acceso: tendrá un código nuevo para registrarse otra vez.</p>` : `<p class="small" style="margin:0">Mándale el enlace de la app, su <b>email</b> (${esc(c.email)}) y este <b>código de alta</b> para que se registre en «Nuevo atleta»:</p><p style="font-size:26px;font-weight:800;letter-spacing:3px;margin:10px 0">${esc(c.codigo_alta || "—")}</p><div class="row"><button class="btn sm" data-act="copiar-alta">Copiar mensaje</button><button class="btn sm" data-act="nuevo-codigo" data-cid="${esc(c.id)}">Generar otro código</button></div>`}</div>`;
}
async function saveCuenta(f) { try { await q(sb.from("clients").update({ email: f.email.value.trim().toLowerCase(), estado: f.estado.value }).eq("id", S.coach.cid)); await q(sb.from("plans").upsert({ client_id: S.coach.cid, progreso_visible: [...f.querySelectorAll('[name="pv"]:checked')].map(x => x.value) }, { onConflict: "client_id" })); toast("Guardado"); S.coach.keep = true; viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } }

/* ================= Librería ================= */
async function viewLib() {
  loading("Librería"); const tab = S.lib.tab || "workouts"; let body = ""; const qy = (S.lib.q || "").toLowerCase();
  const LT = [["workouts", "Workouts"], ["programas", "Programas"], ["ejercicios", "Ejercicios"], ["alimentos", "Alimentos"], ["recetas", "Recetas"]];
  const head = (titulo, n, act, h, label) => `<div class="pghead"><h1 class="ptitle">${titulo} <span class="cnt">${n}</span></h1></div><div class="row"><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ex-q" type="search" placeholder="Buscar por nombre o descripción…" value="${esc(S.lib.q || "")}" aria-label="Buscar"></label><span class="grow"></span><button class="btn dark" data-act="${act}" ${h ? `data-h="${h}"` : ""}><span class="plus">+</span>${label}</button></div>`;
  const desc = c => { const ej = (c && c.ejercicios) || []; return ej.length ? ej.map(e => e.nombre).join(", ") : ((c && c.detalle) || ""); };
  if (tab === "alimentos") body = await libFoodsHTML();
  else if (tab === "recetas") body = await libRecipesHTML();
  else if (tab === "ejercicios") {
    const ex = await exLib(true); const list = ex.filter(e => !qy || (e.nombre + " " + e.grupo + " " + e.material).toLowerCase().includes(qy));
    body = head("Ejercicios", ex.length, "ex-new", "", "Añadir ejercicio") + `<div class="card flat"><div class="tbl"><table class="htable libtab"><thead><tr><th>Nombre</th><th>Grupo / patrón</th><th>Material</th><th>Vídeo</th></tr></thead><tbody>${list.map(e => `<tr data-act="ex-edit" data-id="${esc(e.id)}"><td><span class="lnk">${esc(e.nombre)}</span>${e.notas ? `<div class="tiny muted clamp">${esc(e.notas)}</div>` : ""}</td><td>${esc(e.grupo)}</td><td>${esc(e.material)}</td><td>${e.video_url ? `<span class="tag tag-workout">▶ vídeo</span>` : ""}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sin resultados.</td></tr>`}</tbody></table></div></div>`;
  } else if (tab === "workouts") {
    const ts = await tplLib(); const list = ts.filter(t => !qy || (t.nombre + " " + t.descripcion + " " + desc(t.contenido)).toLowerCase().includes(qy));
    body = head("Workouts", ts.length, "go", "lib-w-new", "Añadir workout") + `<div class="card flat"><div class="tbl"><table class="htable libtab"><thead><tr><th>Nombre</th><th>Tipo</th><th>Descripción</th><th>Actualizado</th></tr></thead><tbody>${list.map(t => `<tr data-act="go" data-h="lib-w-${esc(t.id)}"><td><span class="lnk">${esc(t.nombre)}</span></td><td><span class="tag tag-${esc(t.tipo)}">${esc(TIPOS[t.tipo])}</span></td><td><div class="tiny muted clamp">${esc(t.descripcion ? t.descripcion + ". " : "")}${esc(desc(t.contenido))}</div></td><td class="tiny muted">${esc(fdate((t.updated_at || "").slice(0, 10)))}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sin workouts.</td></tr>`}</tbody></table></div></div>`;
  } else {
    const ps = await q(sb.from("programs").select("id,nombre,descripcion,semanas,items").order("nombre")); const list = ps.filter(p => !qy || (p.nombre + " " + p.descripcion).toLowerCase().includes(qy));
    body = head("Programas", ps.length, "go", "lib-p-new", "Añadir programa") + `<div class="card flat"><div class="tbl"><table class="htable libtab"><thead><tr><th>Nombre</th><th>Duración</th><th>Descripción</th><th>Elementos</th></tr></thead><tbody>${list.map(p => `<tr data-act="go" data-h="lib-p-${esc(p.id)}"><td><span class="lnk">${esc(p.nombre)}</span></td><td>${p.semanas} semanas</td><td><div class="tiny muted clamp">${esc(p.descripcion || "")}</div></td><td class="n">${(p.items || []).length}</td></tr>`).join("") || `<tr><td colspan="4" class="tempty">Aún no hay programas. Crea uno o guarda semanas de un cliente desde su calendario («Más ▾»).</td></tr>`}</tbody></table></div></div>`;
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
  const p = S.sub.prog; let grid = `<div class="pgrid phead">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(n => `<span>${n}</span>`).join("")}</div>`;
  for (let s = 1; s <= p.semanas; s++) {
    grid += `<div class="pweek"><div class="pwl2"><span class="wtag">S${s}</span><span class="wname">Semana ${s}</span></div><div class="pgrid">`;
    for (let d = 1; d <= 7; d++) { const its = p.items.map((it, i) => ({ ...it, i })).filter(it => it.semana === s && it.dia === d);
      grid += `<div class="pday"><div class="pdh"><span></span><button type="button" class="padd" data-act="pi-new" data-s="${s}" data-d="${d}" aria-label="Añadir en semana ${s}, ${DSEM[d]}">+</button></div>${its.map(it => `<button type="button" class="pch tp-${esc(it.tipo)}" data-act="pi-edit" data-i="${it.i}">${esc(it.titulo || TIPOS[it.tipo])}</button>`).join("")}</div>`; }
    grid += `</div></div>`;
  }
  shell(p.nombre || "Nuevo programa", `<form id="f-prog" data-id="${esc(id)}" style="display:flex;flex-direction:column;gap:12px"><div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="grid2"><div class="f"><label>Nombre</label><input name="nombre" required value="${esc(p.nombre)}" placeholder="Hipertrofia 4 días" data-prog="nombre"></div><div class="f"><label>Semanas</label><input name="semanas" type="number" min="1" max="16" value="${p.semanas}" data-prog="semanas"></div></div><div class="f"><label>Descripción</label><input name="descripcion" value="${esc(p.descripcion || "")}" data-prog="descripcion"></div></div>
  <div class="card cal">${grid}<p class="tiny muted" style="margin:10px 0 0">Pulsa «+» en un día para añadir algo.</p></div>
  <div class="savebar row"><button class="btn pri">Guardar programa</button>${id !== "new" ? `<button type="button" class="btn" data-act="prog-asignar" data-id="${esc(id)}">Programar a un cliente</button><button type="button" class="btn" data-act="prog-dup" data-id="${esc(id)}">Duplicar</button><span class="grow"></span><button type="button" class="btn ghost" data-act="prog-del" data-id="${esc(id)}" style="color:var(--bad)">Borrar</button>` : ""}</div></form>`, { crumb: [["lib", "Librería"], ["lib", "Programas"], [null, p.nombre || "Nuevo programa"]], keepScroll: true });
}
function openProgItem(i, s, d) {
  const it = i != null ? S.sub.prog.items[i] : { semana: s, dia: d, tipo: "workout", titulo: "", contenido: {} }; S.sub.piTipo = it.tipo;
  const tpls = S.sub.tpls || [];
  sheet(`<h2>Semana ${it.semana} · ${DSEM[it.dia]}</h2><form id="f-pi" data-i="${i ?? ""}" data-s="${it.semana}" data-d="${it.dia}" style="display:flex;flex-direction:column;gap:10px">
  <div class="seg wrap" role="group" aria-label="Tipo">${Object.entries(TIPOS).map(([k, l]) => `<button type="button" data-act="pi-tipo" data-t="${k}" aria-pressed="${it.tipo === k}">${l}</button>`).join("")}</div>
  <div id="pi-body">${piBody(it, tpls)}</div>
  <button class="btn pri block">Aceptar</button>${i != null ? `<button type="button" class="btn ghost" data-act="pi-del" data-i="${i}" style="color:var(--bad)">Quitar del programa</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
function piBody(it, tpls) {
  const t = it.tipo; const c = it.contenido || {};
  if (t === "workout" || t === "cardio") {
    const opts = tpls.filter(p => p.tipo === t); const propio = !it.template_id && ((c.ejercicios || []).length || !opts.length);
    return `<div class="f"><label>${t === "workout" ? "Workout" : "Cardio"}</label><select name="tpl" data-act-change="pi-src"><option value="" ${propio ? "selected" : ""}>Propio de este programa (lo editas aquí)</option>${opts.map((p, k) => `<option value="${esc(p.id)}" ${!propio && (it.template_id ? it.template_id === p.id : k === 0) ? "selected" : ""}>Librería · ${esc(p.nombre)}</option>`).join("")}</select></div>
    <div class="f"><label>Título para el cliente</label><input name="titulo" value="${esc(it.titulo || "")}" placeholder="${t === "workout" ? "Pierna A" : "Rodaje Z2"}"></div>
    <div id="pi-ed" ${propio ? "" : "hidden"}>${typeExtras(t, c)}</div>
    <p class="tiny muted" style="margin:0">Si eliges uno de la librería, se usa la versión que haya en la librería al programarlo.</p>`;
  }
  return `<div class="f"><label>Título</label><input name="titulo" required value="${esc(it.titulo || "")}" placeholder="${esc(TIPOS[t] || "")}"></div>${typeExtras(t, c)}`;
}
function saveProgItem(f) {
  const t = S.sub.piTipo; const it = { semana: +f.dataset.s, dia: +f.dataset.d, tipo: t, titulo: f.titulo ? f.titulo.value.trim() : "" };
  if (t === "workout" || t === "cardio") {
    if (f.tpl.value) { it.template_id = f.tpl.value; if (!it.titulo) it.titulo = ((S.sub.tpls.find(x => x.id === it.template_id) || {}).nombre || "").replace(/^[^·]+ · /, ""); it.contenido = {}; }
    else { it.contenido = readTypeExtras($("#pi-ed"), t); if (!it.titulo) { toast("Ponle un título"); return; } }
  } else {
    it.contenido = readTypeExtras(f, t); const bad = validExtras(t, it.contenido); if (bad) { toast(bad); return; }
    if (!it.titulo) it.titulo = TIPOS[t];
  }
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
  const [wl, wo, ca] = await Promise.all([q(sb.from("wellness").select("*").eq("client_id", c.id).gte("fecha", d0).order("fecha")), q(sb.from("workouts").select("fecha,rpe_sesion,duracion_min,dia").eq("client_id", c.id).gte("fecha", d0).order("fecha")), q(sb.from("assignments").select("fecha,resultado").eq("client_id", c.id).eq("tipo", "cardio").eq("hecho", true).gte("fecha", d0))]);
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
  ca.forEach(x => { const r = x.resultado || {}; if (r.rpe != null && r.min) load[x.fecha] = (load[x.fecha] || 0) + r.rpe * r.min; }); // el cardio también suma carga
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
  return `<div class="row" style="flex-wrap:wrap"><div class="subtabs">${W.map(([n, l]) => `<button data-act="rec-w" data-n="${n}" aria-current="${win === n}">${l}</button>`).join("")}</div></div>
  ${al.length || ok.length ? `<div class="card"><h2 class="hh">${ICON.evo}Estado de recuperación</h2>${al.map(a => `<div class="alr bad">⚠ ${esc(a)}</div>`).join("")}${ok.map(a => `<div class="alr ok">✓ ${esc(a)}</div>`).join("")}</div>` : ""}
  <div class="cols2">
  <div class="card"><h2>HRV / VFC <small>ms</small></h2>${multiChart(days, [{ name: "HRV", color: "#2b7de9", v: hrv, w: 1.4, dots: true }, { name: "Media 7 días", color: "#173f8a", v: hrv7, w: 2.6 }], { band, bandName: "Rango normal (60 días)", empty: "Sin datos de HRV" })}</div>
  <div class="card"><h2>FC en reposo <small>lpm</small></h2>${multiChart(days, [{ name: "FC", color: "#e5484d", v: fc, w: 1.4, dots: true }, { name: "Media 7 días", color: "#8c1d22", v: fc7, w: 2.6 }], { band: fcBase, bandName: "Habitual (30 días ± 1 DE)", empty: "Sin datos de FC en reposo" })}</div>
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
    N.calc = { ...CALC_DEF, peso: lastW.length ? r1(avg(lastW)) : (f.pesoInicial || ""), altura: num(String(f.altura || "").replace(/[^\d,.]/g, "").replace(",", ".")) ? (num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", ".")) < 3 ? r0(num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", ".")) * 100) : num(String(f.altura).replace(/[^\d,.]/g, "").replace(",", "."))) : "", edad: num(String(f.edad || "").match(/\d+/)) || "", ...(f.calc || n.calc || {}) };
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
  <div class="opts">${opts.map((o, oi) => { const m = optMacros(o); return `<div class="choice"><div class="row"><input class="otit" value="${esc(o.nombre || `Opción ${oi + 1}`)}" data-n-on="${ci}.${oi}" aria-label="Nombre de la opción"><span class="grow"></span><button class="btn ghost sm" data-act="n-opt-dup" data-k="${ci}.${oi}">Duplicar</button><button class="btn ghost sm" data-act="n-opt-del" data-k="${ci}.${oi}" aria-label="Quitar opción">✕</button></div>
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
  return `<div class="pghead"><h1 class="ptitle">Alimentos <span class="cnt">${cnt.count ?? fs.length}</span></h1></div><div class="row" style="flex-wrap:wrap"><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ex-q" type="search" placeholder="Buscar alimento o marca…" value="${esc(qy)}" aria-label="Buscar"></label><select id="food-fuente" aria-label="Origen"><option value="">Todos</option><option value="mercadona" ${fu === "mercadona" ? "selected" : ""}>Mercadona (Open Food Facts)</option><option value="generico" ${fu === "generico" ? "selected" : ""}>Genéricos</option><option value="propio" ${fu === "propio" ? "selected" : ""}>Añadidos por ti</option></select><span class="grow"></span><button class="btn dark" data-act="food-edit" data-id=""><span class="plus">+</span>Añadir alimento</button></div>
  <div class="card flat"><div class="tbl"><table class="htable"><thead><tr><th>Alimento</th><th>Origen</th><th class="n">kcal</th><th class="n">Prot.</th><th class="n">HC</th><th class="n">Grasa</th><th>Ración</th></tr></thead><tbody>${fs.map(f => `<tr data-act="food-edit" data-id="${esc(f.id)}"><td><span class="feedn">${f.foto_url ? `<img class="thumb sm" src="${esc(f.foto_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span><span class="lnk">${esc(f.nombre)}</span>${f.marca ? `<div class="tiny muted">${esc(f.marca)}</div>` : ""}</span></span></td><td><span class="tag tag-${f.fuente === "mercadona" ? "workout" : f.fuente === "generico" ? "tarea" : "nota"}">${f.fuente === "mercadona" ? "Mercadona" : f.fuente === "generico" ? "Genérico" : "Propio"}</span></td><td class="n">${r0(f.kcal)}</td><td class="n">${r1(f.prot)}</td><td class="n">${r1(f.hc)}</td><td class="n">${r1(f.grasa)}</td><td class="tiny">${f.racion_g ? `${fmt(f.racion_g, 0)} g${f.racion_nombre ? " · " + esc(f.racion_nombre) : ""}` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="tempty">Sin resultados.</td></tr>`}</tbody></table></div></div><p class="tiny muted" style="margin-top:8px">Valores por 100 g en crudo. Los de Mercadona vienen de Open Food Facts: revisa los que uses a menudo.</p>`;
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
  return `<div class="pghead"><h1 class="ptitle">Recetas <span class="cnt">${rs.length}</span></h1><span class="grow"></span><button class="btn dark" data-act="rec-new"><span class="plus">+</span>Añadir receta</button></div>
  <div class="grid-cards">${rs.map(r => { const m = recipeMacros(r), k = 1 / (+r.raciones || 1); return `<button class="card tcard rcard" data-act="go" data-h="lib-r-${esc(r.id)}">${r.foto_path && urls[r.foto_path] ? `<img src="${esc(urls[r.foto_path])}" alt="" loading="lazy">` : `<span class="noimg">${ICON.nutri}</span>`}<b>${esc(r.nombre)}</b><span class="tiny muted">${r0(m.kcal * k)} kcal · P ${r0(m.prot * k)} · HC ${r0(m.hc * k)} · G ${r0(m.grasa * k)} por ración</span></button>`; }).join("") || `<div class="empty" style="grid-column:1/-1">Aún no hay recetas. Crea la primera con «Añadir receta».</div>`}</div>`;
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
  if (!n.activo || !(n.comidas || []).length) { shell("Nutrición", `${!n.activo ? `<div class="card empty-st"><span class="ricon">${ICON.nutri}</span><div><h2>Tu plan llegará pronto</h2><p class="small muted" style="margin:0">Aparecerá aquí cuando Adrián lo active.</p></div></div>` : ""}${n.activo ? pautas : ""}${hab}`); return; }
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
      case "n-calc-apply": { const r = calcKcal(N.calc); if (!r) break; const pl = (await q(sb.from("plans").select("nutricion").eq("client_id", S.coach.cid).limit(1)))[0] || {}; const { calc: _c, ...nut0 } = pl.nutricion || {}; const nut = { ...nut0, objetivo: { kcal: r0(r.kcal), prot: r0(r.prot), hc: r0(r.hc), grasa: r0(r.grasa) } }; await q(sb.from("plans").upsert({ client_id: S.coach.cid, nutricion: nut }, { onConflict: "client_id" })); const cc = (await q(sb.from("clients").select("ficha").eq("id", S.coach.cid).limit(1)))[0] || {}; await q(sb.from("clients").update({ ficha: { ...(cc.ficha || {}), calc: N.calc } }).eq("id", S.coach.cid)); toast("Objetivo guardado en el plan"); S.coach.nsub = "plan"; refreshClient(); break; }
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
  if (DR.justDragged && Date.now() - DR.justDragged < 450) { ev.preventDefault(); ev.stopPropagation(); return; }
  let a = ev.target.closest("[data-act]"); if (!a) return;
  // en el móvil, tocar una tarea dentro del calendario abre el día en grande (las tareas ahí son muy pequeñas)
  if (a.matches(".cal .pday .pch") && window.matchMedia("(max-width:700px)").matches) a = a.closest(".pday");
  const act = a.dataset.act; const id = a.dataset.id; const dd = a.closest("details.more"); if (dd) dd.removeAttribute("open");
  if (act === "close-bg") { if (ev.target === a) closeSheet(); return; }
  try {
    switch (act) {
      case "go": if (location.hash === "#" + a.dataset.h) route(); else location.hash = a.dataset.h; break;
      case "reload": location.reload(); break;
      case "lead": openLead(id); break;
      case "lead-alta": await leadAlta(id); break;
      case "lead-del": if (confirm("¿Borrar esta solicitud y sus datos?")) { await q(sb.from("leads").delete().eq("id", id)); sheet(""); toast("Borrada"); route(); } break;
      case "day-open": await openDay(a.dataset.d); break;
      case "go-tab": S.coach.tab = a.dataset.t; S.coach.cid = null; if (location.hash === "#c-" + a.dataset.cid) route(); else location.hash = "c-" + a.dataset.cid; break;
      case "go-inicial": S.coach.tab = "inicial"; S.coach.cid = null; location.hash = "c-" + a.dataset.cid; break;
      case "copy": { const t = $("#" + a.dataset.src); try { await navigator.clipboard.writeText(t.value); toast("Copiado"); } catch { t.select(); document.execCommand("copy"); toast("Copiado"); } break; }
      case "copy-txt": try { await navigator.clipboard.writeText(a.dataset.t); toast("Copiado"); } catch { toast(a.dataset.t); } break;
      case "com-step": { const f = $("#f-com"); if (f) { const d = comRead(f); comSaveDraft(d); } window.scrollTo(0, 0); viewComienzo(+a.dataset.s); break; }
      case "cq-scale": { const w = a.closest(".cq"); w.querySelector("input[type=hidden]").value = a.dataset.v; w.querySelectorAll("[data-act=cq-scale]").forEach(b => b.setAttribute("aria-pressed", String(b === a))); w.classList.remove("err"); break; }
      case "com-rev": await q(sb.from("onboarding").update({ revisado: true }).eq("client_id", a.dataset.cid)); toast("Marcado como revisado"); S.coach.keep = true; viewCoachClient(a.dataset.cid); break;
      case "com-ficha": await comFicha(a.dataset.cid); break;
      case "logout": await sb.auth.signOut(); clearLocal(); S.me = null; S.plan = null; S.sub = {}; history.replaceState(null, "", location.pathname); renderLogin(); break;
      case "login-tab": renderLogin(a.dataset.t); break;
      case "ver-pw": { const i = a.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; const v = i.type === "text"; a.innerHTML = v ? EYE_OFF : EYE; a.setAttribute("aria-label", v ? "Ocultar contraseña" : "Mostrar contraseña"); a.title = a.getAttribute("aria-label"); a.classList.toggle("on", v); i.focus(); break; }
      case "cambiar-pw": openCambiarPw(); break;
      case "close": closeSheet(); break;
      case "go-back": goBack(); break;
      case "bk-now": backupNow(a); break;
      case "bk-restore": openRestore(); break;
      case "post-new": openPostForm(); break;
      case "post-edit": a.closest("details") && a.closest("details").removeAttribute("open"); openPostForm(id); break;
      case "post-pin": { const p = (await q(sb.from("posts").select("fijado").eq("id", id).limit(1)))[0]; await q(sb.from("posts").update({ fijado: !p.fijado }).eq("id", id)); toast(p.fijado ? "Quitado de fijados" : "Fijado arriba"); route(); break; }
      case "post-hide": { const p = (await q(sb.from("posts").select("publicado").eq("id", id).limit(1)))[0]; await q(sb.from("posts").update({ publicado: !p.publicado }).eq("id", id)); toast(p.publicado ? "Oculto para los clientes" : "Visible otra vez"); route(); break; }
      case "post-del": if (confirmar(a)) { await q(sb.from("posts").delete().eq("id", id)); toast("Publicación borrada"); route(); } break;
      case "post-react": postReact(a); break;
      // cliente
      case "wellness": { const r = await q(sb.from("wellness").select("*").eq("fecha", today()).limit(1)).catch(() => []); openWellness(r[0]); break; }
      case "qscale": { const h = $("#q" + a.dataset.q); if (h) h.value = a.dataset.v; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); break; }
      case "scale": { S.sub.well[a.dataset.k] = +a.dataset.v; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); break; }
      case "peso": openPeso(); break;
      case "medidas": openMedidas(); break;
      case "med-all": a.closest("fieldset").querySelectorAll("input[name=med]").forEach(i => { i.checked = a.dataset.v === "1"; }); break;
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
      case "p-toggle": { const row = a.closest("[data-row]"); const pn = row.querySelector("[data-pres]");
        if (pn) { pn.hidden = !pn.hidden; break; }
        const sx = row.querySelector('[name="r_sxr"]').value; const n = seriesOf(sx) || 3; const reps = (sx.match(/[x×]\s*([\d–\-]+)/i) || [])[1] || ""; const rir = row.querySelector('[name="r_rir"]').value.trim(); const des = row.querySelector('[name="r_des"]').value.trim();
        row.insertAdjacentHTML("beforeend", presPanel({ cols: ["kg", "rir"], series: Array.from({ length: n }, () => ({ tipo: "normal", reps, rir, desc: des })) })); presSync(row); break; }
      case "p-add": { const pn = a.closest("[data-pres]"); presRerender(pn, c => ({ ...c, series: [...c.series, { ...(c.series[c.series.length - 1] || { tipo: "normal" }) }] })); break; }
      case "p-dup": { const pn = a.closest("[data-pres]"); const i = [...pn.querySelectorAll("[data-prow]")].indexOf(a.closest("[data-prow]")); presRerender(pn, c => { const ss = [...c.series]; ss.splice(i + 1, 0, { ...ss[i] }); return { ...c, series: ss }; }); break; }
      case "p-del": { const pn = a.closest("[data-pres]"); const i = [...pn.querySelectorAll("[data-prow]")].indexOf(a.closest("[data-prow]")); presRerender(pn, c => ({ ...c, series: c.series.filter((_, k) => k !== i) })); break; }
      case "p-tpl": { const pn = a.closest("[data-pres]"); presRerender(pn, c => P_TPL[a.dataset.t](c)); break; }
      case "p-clear": { const row = a.closest("[data-row]"); a.closest("[data-pres]").remove(); presSync(row); const sx = row.querySelector('[name="r_sxr"]'); sx.readOnly = false; break; }
      case "asig-dup": { const f = a.closest("form"); const x = (await q(sb.from("assignments").select("*").eq("id", id).limit(1)))[0]; await q(sb.from("assignments").insert({ client_id: x.client_id, fecha: f.dup_fecha.value, orden: x.orden, tipo: x.tipo, titulo: x.titulo, contenido: x.contenido, visible: x.visible, programa: x.programa })); sheet(""); toast("Duplicado"); refreshClient(); break; }
      case "asig-del": if (confirmar(a)) { await q(sb.from("assignments").delete().eq("id", id)); sheet(""); toast("Borrado"); refreshClient(); } break;
      case "ev-edit": openEvent(id); break;
      case "ev-del": if (confirmar(a)) { await q(sb.from("events").delete().eq("id", id)); sheet(""); refreshClient(); } break;
      case "prog-asignar": openAsignarPrograma(id); break;
      case "copiar-semana": openCopiarSemana(); break;
      case "prog-desde-cal": openProgDesdeCal(); break;
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
      case "adj-del": a.closest(".adji").remove(); break;
      case "rev-resp": { const ta = $("#rev-r"); try { await q(sb.rpc("revision_responder", { p_id: a.dataset.id, p_texto: ta.value })); toast(ta.value.trim() ? "Respuesta enviada a Adrián" : "Respuesta borrada"); route(); } catch (e) { toast(errMsg(e)); } break; }
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

/* Día ampliado del calendario del entrenador */
async function openDay(day) {
  const cid = S.coach.cid; const pl = S.coach.pl || {}; const t = today();
  const [as, ev, wo] = await Promise.all([q(sb.from("assignments").select("*").eq("client_id", cid).eq("fecha", day).order("orden")), q(sb.from("events").select("*").eq("client_id", cid).lte("fecha", day).order("fecha")), q(sb.from("workouts").select("id,dia,assignment_id,rpe_sesion,duracion_min").eq("client_id", cid).eq("fecha", day))]);
  const evs = ev.filter(e => (e.fin || e.fecha) >= day); const libres = wo.filter(w => !w.assignment_id);
  let wk = null; for (const b of pl.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= day && day <= s.fin); if (w) { wk = { b: b.nombre, ...w }; break; } }
  const sub = x => { const c = x.contenido || {}; const p = [TIPOS[x.tipo] || x.tipo];
    if (x.tipo === "workout") { const ex = c.ejercicios || []; if (ex.length) p.push(ex.length + " ejercicios"); if (c.dur_est) p.push("≈" + c.dur_est + " min"); }
    if (x.tipo === "cardio" && cardioResumen(c)) p.push(cardioResumen(c));
    if (x.tipo === "nota" && c.hora) p.push(c.hora);
    if (x.tipo === "medidas" && (c.medidas || []).length) p.push(c.medidas.map(medLabel).join(", "));
    return p.join(" · "); };
  const det = x => { const c = x.contenido || {};
    if (x.tipo === "workout" && (c.ejercicios || []).length) return `<ol class="dex">${c.ejercicios.slice(0, 8).map(e => `<li><b>${esc(e.nombre)}</b> <span>${esc([e.sxr, e.rir && e.rir !== "—" ? "RIR " + e.rir : ""].filter(Boolean).join(" · "))}</span></li>`).join("")}${c.ejercicios.length > 8 ? `<li class="muted">y ${c.ejercicios.length - 8} más…</li>` : ""}</ol>`;
    if (c.detalle) return `<p class="ddet">${esc(String(c.detalle).slice(0, 220))}</p>`; return ""; };
  const st = x => x.hecho ? `<span class="chip ok">Hecho ✓</span>` : day < t && x.tipo !== "nota" ? `<span class="chip bad">Sin hacer</span>` : `<span class="chip">Pendiente</span>`;
  const prev = addDays(day, -1), next = addDays(day, 1);
  sheet(`<div class="dayhd"><button class="cnav" data-act="day-open" data-d="${prev}" aria-label="Día anterior">‹</button><div class="grow"><h2>${esc(cap(fdate(day, { weekday: "long", day: "numeric", month: "long" })))}</h2><span class="tiny muted">${day === t ? "Hoy · " : ""}${wk ? `${esc(wk.b)} · ${esc(wk.nombre)}${wk.foco ? " · " + esc(wk.foco) : ""}` : (as.length ? as.length + " programadas" : "Sin nada programado")}</span></div><button class="cnav" data-act="day-open" data-d="${next}" aria-label="Día siguiente">›</button></div>
  ${evs.map(e => `<button class="dit tp-evento" data-act="ev-edit" data-id="${esc(e.id)}"><i></i><div class="grow"><b>★ ${esc(e.titulo)}</b><span>${esc(EV_TIPOS[e.tipo] || "Evento")}${e.fin && e.fin !== e.fecha ? ` · hasta el ${esc(fdate(e.fin, { day: "numeric", month: "short" }))}` : ""}</span></div></button>`).join("")}
  ${as.length || libres.length ? `<div class="dlist">${as.map(x => `<button class="dit tp-${esc(x.tipo)}${x.visible ? "" : " hid"}" data-act="asig-edit" data-id="${esc(x.id)}"><i></i><div class="grow"><b>${esc(x.titulo)}</b><span>${esc(sub(x))}${x.visible ? "" : " · oculto al cliente"}</span>${det(x)}${x.respuesta ? `<p class="ddet">«${esc(x.respuesta.slice(0, 160))}»</p>` : ""}</div>${st(x)}</button>`).join("")}${libres.map(w => `<div class="dit tp-workout"><i></i><div class="grow"><b>${esc(w.dia || "Entreno libre")}</b><span>Entreno registrado por el cliente${w.rpe_sesion != null ? " · dureza " + esc(w.rpe_sesion) + "/10" : ""}${w.duracion_min ? " · " + esc(w.duracion_min) + " min" : ""}</span></div><span class="chip ok">Hecho ✓</span></div>`).join("")}</div>` : `<div class="empty">Nada programado este día.</div>`}
  <div class="row dayft"><button class="btn ghost" data-act="close">Cerrar</button><span class="grow"></span><button class="btn pri" data-act="asig-new" data-d="${day}">+ Añadir este día</button></div>`, "wide");
}

/* Arrastrar tareas del calendario a otro día, con ratón o con el dedo (mantener pulsado) */
const DR = { el: null, on: false };
function dragStart(x, y) {
  DR.on = true; const r = DR.el.getBoundingClientRect(); try { window.getSelection().removeAllRanges(); } catch { }
  DR.gh = DR.el.cloneNode(true); DR.gh.classList.add("drag-ghost"); if (!DR.touch) DR.gh.style.width = r.width + "px"; document.body.appendChild(DR.gh);
  DR.dx = DR.touch ? 24 : x - r.left; DR.dy = DR.touch ? 54 : y - r.top; DR.el.classList.add("dragging"); document.body.classList.add("dragmode");
  try { if (navigator.vibrate) navigator.vibrate(12); } catch { }
  dragMove(x, y);
}
function dragMove(x, y) {
  DR.gh.style.transform = `translate(${x - DR.dx}px,${y - DR.dy}px)`;
  const t = document.elementFromPoint(x, y); const d = t && t.closest(".pday[data-day]");
  document.querySelectorAll(".pday.over").forEach(p => { if (p !== d) p.classList.remove("over"); }); if (d) d.classList.add("over"); DR.over = d;
  // desplazamiento automático cerca de los bordes de la pantalla
  const m = 60; if (y < m) window.scrollBy(0, -12); else if (y > window.innerHeight - m) window.scrollBy(0, 12);
}
function dragEnd() {
  clearTimeout(DR.t); if (DR.gh) DR.gh.remove(); if (DR.el) DR.el.classList.remove("dragging", "press");
  document.querySelectorAll(".pday.over").forEach(p => p.classList.remove("over")); document.body.classList.remove("dragmode");
  DR.el = null; DR.gh = null; DR.on = false; DR.over = null;
}
document.addEventListener("pointerdown", ev => {
  const chip = ev.target.closest && ev.target.closest(".pch[data-drag]"); if (!chip || ev.button > 0) return;
  dragEnd(); DR.el = chip; DR.id = chip.dataset.drag; DR.from = chip.closest(".pday") && chip.closest(".pday").dataset.day; DR.x = ev.clientX; DR.y = ev.clientY; DR.touch = ev.pointerType !== "mouse";
  if (DR.touch) { chip.classList.add("press"); DR.t = setTimeout(() => { if (DR.el === chip) { chip.classList.remove("press"); dragStart(DR.x, DR.y); } }, 320); }
});
document.addEventListener("pointermove", ev => {
  if (!DR.el) return;
  if (!DR.on) { const d = Math.hypot(ev.clientX - DR.x, ev.clientY - DR.y); if (DR.touch) { if (d > 10) dragEnd(); else { DR.x = ev.clientX; DR.y = ev.clientY; } return; } if (d < 6) return; dragStart(ev.clientX, ev.clientY); }
  ev.preventDefault(); dragMove(ev.clientX, ev.clientY);
}, { passive: false });
document.addEventListener("touchmove", ev => { if (!DR.on) return; ev.preventDefault(); const t = ev.touches[0]; if (t) dragMove(t.clientX, t.clientY); }, { passive: false });
document.addEventListener("touchend", () => { if (DR.on) dragDrop(); });
document.addEventListener("contextmenu", ev => { if (DR.el || (ev.target.closest && ev.target.closest(".pch[data-drag]"))) ev.preventDefault(); });
document.addEventListener("pointerup", () => dragDrop());
async function dragDrop() {
  if (!DR.el) return; const was = DR.on, over = DR.over, id = DR.id, from = DR.from, chip = DR.el; dragEnd();
  if (!was) return; DR.justDragged = Date.now();
  const to = over && over.dataset.day; if (!to || to === from) return;
  over.appendChild(chip); // se ve movido al instante
  try { await q(sb.from("assignments").update({ fecha: to }).eq("id", id)); toast(`Movido al ${fdate(to, { weekday: "long", day: "numeric" })}`); refreshClient(); } catch (e) { toast(errMsg(e)); refreshClient(); }
}
document.addEventListener("pointercancel", () => { if (!DR.on) dragEnd(); });
let qT;
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.tagName === "TEXTAREA") grow(el);
  if (el.closest && el.closest("#f-workout")) { saveDraftFrom(el); if (el.dataset.top != null) topSync(el); }
  if (el.closest && el.closest("[data-pres]") && el.dataset.p) presSync(el.closest("[data-row]"));
  if (el.id === "ex-q") { clearTimeout(qT); qT = setTimeout(() => { S.lib.q = el.value; S.lib.focusQ = true; viewLib(); }, 250); }
  if (el.dataset && el.dataset.prog && S.sub.prog) S.sub.prog[el.dataset.prog] = el.dataset.prog === "semanas" ? Math.min(16, Math.max(1, +el.value || 1)) : el.value;
});
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.closest && el.closest("#f-workout")) saveDraftFrom(el);
  if (el.closest && el.closest("[data-pres]") && (el.dataset.pc || el.dataset.p === "tipo")) presRerender(el.closest("[data-pres]"));
  if (el.dataset && el.dataset.actChange === "ap-prev") apRefresh(el.form);
  if (el.dataset && el.dataset.actChange === "post-todos") { const b = el.form.querySelector(".post-para"); if (b) b.hidden = el.checked; }
  if (el.dataset && el.dataset.actChange === "test-name") { const t = (S.coach.tests || []).filter(x => tKey(x.nombre) === tKey(el.value)).pop(); if (t) { const f = el.form; f.categoria.value = t.categoria || f.categoria.value; f.unidad.value = t.unidad || ""; f.menos.checked = !!t.mejor_es_menos; f.nombre.value = t.nombre; } }
  if (el.form && el.form.id === "f-com") { const d = comRead(el.form); comSaveDraft(d); el.closest(".cq") && el.closest(".cq").classList.remove("err");
    el.form.querySelectorAll(".cq").forEach(w => { const qq = COM_Q.find(x => x.k === w.dataset.k); if (qq && qq.if) w.hidden = d[qq.if[0]] !== qq.if[1]; }); }
  if (el.form && el.form.id === "f-contacto" && el.name === "objetivo") { const o = el.form.objetivo_otro; o.hidden = el.value !== "__otro"; if (!o.hidden) o.focus(); }
  if (el.dataset && el.dataset.actChange === "c-mod") { const w = el.closest(".wed"); const def = CARDIO_REG_DEF[el.value] || ["min", "rpe"]; w.querySelectorAll('input[name="c_reg"]').forEach(i => { i.checked = def.includes(i.value); }); }
  if (el.dataset && el.dataset.actChange === "c-fmt") { const w = el.closest(".wed"); const b = w && w.querySelector(".c-int"); if (b) b.hidden = el.value !== "intervalos"; }
  if (el.dataset && el.dataset.actChange === "f-preset") { const fm = el.form; fm.querySelector(".f-well").hidden = el.value !== "wellness"; fm.querySelector(".f-q").hidden = el.value === "wellness"; const ta = fm.querySelector('[name="preguntas"]'); if (el.value === "revision" && ta && !ta.value.trim()) ta.value = REV_SEMANAL.join("\n"); }
  if (el.dataset && el.dataset.actChange === "msg-plant" && el.value) { const ta = el.form.querySelector('[name="detalle"]'); if (ta) ta.value = el.value; el.value = ""; }
  if (el.dataset && el.dataset.actChange === "pi-src") { const ed = $("#pi-ed"); if (ed) ed.hidden = !!el.value; }
  if (el.id === "ex-sel") { S.sub.ex = el.value; viewProgreso(); }
  if (el.id === "cex-sel") { S.sub.cex = el.value; refreshClient(); }
  if (el.id === "wt-tipo") { $("#wt-ed").innerHTML = wEditor({}, el.value); }
  if (el.dataset && el.dataset.prog === "semanas" && S.sub.prog) renderProgram($("#f-prog").dataset.id);
});
document.addEventListener("submit", ev => {
  ev.preventDefault(); const f = ev.target;
  const map = { "f-restore": restoreOpen, "f-post": savePost, "f-login": doLogin, "f-contacto": enviarContacto, "f-lead": saveLead, "f-com": comNext, "f-com-fin": comEnviar, "f-alta": doAlta, "f-alta-codigo": doAltaCodigo, "f-olvido": doOlvido, "f-nueva": doNueva, "f-well": saveWellness, "f-peso": savePeso, "f-workout": saveWorkout, "f-med": saveMedidas, "f-fotos": saveFotos, "f-item": saveItem,
    "f-newc": saveNewClient, "f-asig": saveAsig, "f-ev": saveEvent, "f-asigprog": asignarPrograma, "f-progcal": progDesdeCal, "f-copsem": copiarSemana, "f-borsem": borrarSemana, "f-meso": saveMeso, "f-info": saveInfo, "f-test": saveTest, "f-nutri": saveNutri, "f-cuenta": saveCuenta,
    "f-ex": saveEx, "f-wt": saveWt, "f-wtas": wtAsignar, "f-pi": saveProgItem, "f-prog": saveProg };
  if (f.id === "f-rep") return saveReport(f, ev.submitter && ev.submitter.value === "1");
  if (map[f.id]) map[f.id](f);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeSheet(); });

// Pantalla de carga: se queda un mínimo para que no parpadee y sale con un fundido
const SPLASH_T0 = performance.now();
function hideSplash() {
  const sp = document.getElementById("splash"); if (!sp || sp.classList.contains("out")) return;
  setTimeout(() => { sp.classList.add("out"); document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff"); setTimeout(() => sp.remove(), 450); }, Math.max(0, 1100 - (performance.now() - SPLASH_T0)));
}
setTimeout(hideSplash, 9000);
init().finally(hideSplash);
