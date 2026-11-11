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
function sheet(html) { $("#modal-root").innerHTML = html ? `<div class="ov" data-act="close-bg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>` : ""; }
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
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || "Gráfica")}">${g}</svg></div>`;
}

/* ================= Estado ================= */
const S = { me: null, email: "", view: "hoy", plan: null, sub: {}, cache: {}, workoutDay: null, coach: { list: [], cid: null, tab: "resumen" } };
const ICON = {
  hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  entreno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  progreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18M5 16l5-5 4 3 6-7"/></svg>',
  informes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 4-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.5 2.3 4 5"/></svg>'
};

/* ================= Arranque y acceso ================= */
async function init() {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => { });
  if (!CFG.supabaseUrl || /TU-PROYECTO/.test(CFG.supabaseUrl)) { if (!window.__SB_MOCK) { $("#app").innerHTML = `<div class="login"><img class="logo" src="./logo.jpg" alt=""><h1>Falta configurar</h1><p>Pon la URL y la clave pública de Supabase en config.js.</p></div>`; return; } }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { S.me = null; clearLocal(); renderLogin(); } });
  const { data } = await sb.auth.getSession();
  if (!data || !data.session) return renderLogin();
  S.email = data.session.user.email || "";
  await afterLogin();
}
function clearLocal() { try { Object.keys(localStorage).filter(k => k.startsWith("arc-")).forEach(k => localStorage.removeItem(k)); } catch { } }
async function afterLogin() {
  try { await sb.rpc("link_me"); const rows = await q(sb.rpc("my_profile")); const p = (rows || []).find(r => r.es_entrenador) || (rows || [])[0];
    if (!p) return renderNoAccess();
    S.me = { role: p.es_entrenador ? "coach" : "client", cid: p.id, nombre: p.nombre };
    if (!location.hash) location.hash = S.me.role === "coach" ? "c" : "hoy";
    route();
  } catch (e) { $("#app").innerHTML = `<div class="login"><img class="logo" src="./logo.jpg" alt=""><h1>No se pudo cargar</h1><p>${esc(errMsg(e))}</p><button class="btn pri" data-act="reload">Reintentar</button><button class="btn ghost" data-act="logout">Cerrar sesión</button></div>`; }
}
function renderNoAccess() {
  $("#app").innerHTML = `<div class="login"><img class="logo" src="./logo.jpg" alt=""><h1>Tu cuenta aún no está activada</h1><p>Has entrado como <b>${esc(S.email)}</b>, pero ese email no está dado de alta. Pídele a Adrián que lo active, o entra con el email que le diste.</p><button class="btn ghost" data-act="logout">Cerrar sesión</button></div>`;
}
function renderLogin(stage, email) {
  if (stage === "code") {
    $("#app").innerHTML = `<form class="login" id="f-code" data-email="${esc(email)}"><img class="logo" src="./logo.jpg" alt=""><h1>Revisa tu correo</h1><p>Te hemos enviado un código a <b>${esc(email)}</b>. Escríbelo aquí. Caduca en unos minutos.</p>
    <div class="f"><label for="code">Código</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required></div>
    <button class="btn pri block">Entrar</button><button type="button" class="btn ghost" data-act="login-back">Usar otro email</button></form>`;
    $("#code").focus(); return;
  }
  $("#app").innerHTML = `<form class="login" id="f-login"><img class="logo" src="./logo.jpg" alt=""><h1>${esc(CFG.nombre || "Adrián Rodríguez Coaching")}</h1><p>Entra con tu email. Te enviaremos un código de un solo uso: sin contraseñas que recordar ni robar.</p>
  <div class="f"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
  <button class="btn pri block">Enviarme el código</button></form>`;
}
async function sendCode(f) {
  const email = f.email.value.trim().toLowerCase(); const b = f.querySelector("button"); b.disabled = true;
  try { await q(sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })); renderLogin("code", email); }
  catch (e) { toast(errMsg(e)); b.disabled = false; }
}
async function verifyCode(f) {
  const email = f.dataset.email, token = f.code.value.trim(); const b = f.querySelector("button"); b.disabled = true;
  try { await q(sb.auth.verifyOtp({ email, token, type: "email" })); S.email = email; await afterLogin(); }
  catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ================= Navegación ================= */
const CLIENT_TABS = [["hoy", "Hoy"], ["entreno", "Entreno"], ["progreso", "Progreso"], ["informes", "Informes"], ["mas", "Perfil"]];
function shell(title, body, opts = {}) {
  const tabs = S.me.role === "coach" ? [["c", "Clientes", "clientes"], ["mas", "Perfil", "mas"]] : CLIENT_TABS.map(([k, l]) => [k, l, k]);
  const cur = S.view.startsWith("c") && S.me.role === "coach" ? "c" : S.view.split("-")[0];
  $("#app").innerHTML = `<header class="top">${opts.back ? `<button class="back" data-act="go" data-h="${esc(opts.back)}" aria-label="Volver">←</button>` : `<img src="./logo.jpg" alt="">`}<h1>${esc(title)}${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ""}</h1></header>
  <main class="${S.me.role === "coach" ? "wide" : ""}" id="main">${body}</main>
  ${opts.noTabs ? "" : `<nav class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)" aria-label="Secciones">${tabs.map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>`}`;
  window.scrollTo(0, 0);
}
function loading(title) { shell(title, `<div class="empty">Cargando…</div>`); }
async function route() {
  if (!S.me) return;
  const h = location.hash.slice(1) || (S.me.role === "coach" ? "c" : "hoy"); S.view = h;
  try {
    if (S.me.role === "coach") { if (h.startsWith("c-")) return await viewCoachClient(h.slice(2)); if (h === "mas") return viewMas(); return await viewCoachList(); }
    if (h === "entreno") return await viewEntreno();
    if (h.startsWith("entreno-")) return await viewWorkout(+h.slice(8));
    if (h === "progreso") return await viewProgreso();
    if (h === "informes") return await viewInformes();
    if (h.startsWith("informe-")) return await viewInforme(decodeURIComponent(h.slice(8)));
    if (h === "mas") return viewMas();
    return await viewHoy();
  } catch (e) { shell("Error", `<div class="banner">${esc(errMsg(e))}</div><button class="btn" data-act="reload">Reintentar</button>`); }
}
window.addEventListener("hashchange", route);

/* ================= Cliente: datos ================= */
async function getPlan() { if (S.plan) return S.plan; const rows = await q(sb.from("plans").select("*").limit(1)); S.plan = rows[0] || { programa: {}, bloques: [], habitos: [], objetivo: "" }; return S.plan; }
function weekNow(plan, d = today()) { for (const b of plan.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= d && d <= s.fin); if (w) return { ...w, bloque: b.nombre }; } return null; }

/* ================= Cliente: Hoy ================= */
async function viewHoy() {
  loading("Hoy");
  const t = today(); const cid = S.me.cid;
  const [plan, wl, wt, wo, rp] = await Promise.all([getPlan(), q(sb.from("wellness").select("*").eq("fecha", t).limit(1)), q(sb.from("weights").select("*").order("fecha", { ascending: false }).limit(1)), q(sb.from("workouts").select("id,fecha,dia").order("fecha", { ascending: false }).limit(10)), q(sb.from("reports").select("id,fecha,titular,semana").order("fecha", { ascending: false }).limit(1))]);
  const w = weekNow(plan); const well = wl[0]; const lastW = wt[0]; const dias = (plan.programa && plan.programa.dias) || [];
  const doneToday = wo.filter(x => x.fecha === t);
  const nextIdx = (() => { if (!dias.length) return -1; const last = wo[0]; const i = last ? dias.findIndex(d => d.nombre === last.dia) : -1; return (i + 1) % dias.length; })();
  const wa = (CFG.whatsappEntrenador || "").replace(/\D/g, "");
  shell(CFG.nombre || "Hoy", `
  <section class="hello"><h2>Hola, ${esc((S.me.nombre || "").split(" ")[0])}</h2><p>${esc(cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })))}${w ? ` · ${esc(w.bloque)} · ${esc(w.nombre)}` : ""}</p></section>
  ${w && w.foco ? `<div class="card"><h2>Esta semana <small>${esc(w.tipo && w.tipo !== "carga" ? cap(w.tipo) : "")}</small></h2><p class="small" style="margin:0">${esc(w.foco)}</p></div>` : ""}
  <div class="card"><h2>Para hoy</h2><div class="list">
    <button class="it" data-act="wellness"><span><b>Cuestionario de hoy</b><br><span class="tiny muted">1 minuto · cómo has dormido y cómo te sientes</span></span>${well ? `<span class="done">Hecho ✓</span>` : `<span class="chip acc">Rellenar</span>`}</button>
    <button class="it" data-act="peso"><span><b>Peso</b><br><span class="tiny muted">${lastW ? `Último: ${fmt(lastW.kg)} kg (${esc(fdate(lastW.fecha))})` : "En ayunas, después de ir al baño"}</span></span>${lastW && lastW.fecha === t ? `<span class="done">Hecho ✓</span>` : `<span class="chip">Apuntar</span>`}</button>
    ${dias.length ? `<button class="it" data-act="go" data-h="entreno-${nextIdx}"><span><b>Entreno: ${esc(dias[nextIdx].nombre)}</b><br><span class="tiny muted">${doneToday.length ? "Ya has registrado un entreno hoy" : "Siguiente sesión de tu rutina"}</span></span><span class="chip ${doneToday.length ? "ok" : "acc"}">${doneToday.length ? "Hecho ✓" : "Empezar"}</span></button>` : ""}
  </div></div>
  ${rp[0] ? `<div class="card"><h2>Tu último informe <small>${esc(fdate(rp[0].fecha))}</small></h2><p style="margin:0 0 10px"><b>${esc(rp[0].titular || rp[0].semana || "Informe semanal")}</b></p><button class="btn block" data-act="go" data-h="informe-${esc(encodeURIComponent(rp[0].id))}">Leer informe</button></div>` : ""}
  ${(plan.habitos || []).length ? `<div class="card"><h2>Tus hábitos</h2><ul class="small" style="margin:0;padding-left:18px">${plan.habitos.map(hb => `<li>${esc(hb)}</li>`).join("")}</ul></div>` : ""}
  ${plan.objetivo ? `<div class="card"><h2>Tu objetivo</h2><p class="small" style="margin:0">${esc(plan.objetivo)}</p></div>` : ""}
  ${wa ? `<a class="btn block" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir a Adrián por WhatsApp</a>` : ""}`);
}
function openWellness(prev) {
  const w = prev || {}; S.sub.well = { ...w };
  sheet(`<h2>¿Cómo estás hoy?</h2><p class="small muted" style="margin:0">Toca un número del 1 al 5. El 5 siempre es lo mejor.</p>
  <form id="f-well" class="col" style="display:flex;flex-direction:column;gap:14px">
  ${WK.map(([k, l, a, b]) => `<div><div class="small" style="font-weight:700;margin-bottom:6px">${l}</div><div class="scale" role="group" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="scale" data-k="${k}" data-v="${n}" aria-pressed="${num(w[k]) === n}">${n}</button>`).join("")}</div><div class="anchors"><span>${a}</span><span>${b}</span></div></div>`).join("")}
  <div class="grid2"><div class="f"><label for="w-h">Horas dormidas</label><input id="w-h" name="sueno_h" inputmode="decimal" value="${esc(w.sueno_h ?? "")}" placeholder="7,5"></div><div class="f"><label for="w-fc">Pulso en reposo (opcional)</label><input id="w-fc" name="fc" inputmode="numeric" value="${esc(w.fc ?? "")}"></div></div>
  <div class="grid2"><div class="f"><label for="w-mz">¿Alguna molestia? Zona</label><input id="w-mz" name="molestia_zona" value="${esc(w.molestia_zona || "")}" placeholder="Rodilla derecha"></div><div class="f"><label for="w-mi">Dolor 0–10</label><input id="w-mi" name="molestia_0a10" inputmode="numeric" value="${esc(w.molestia_0a10 ?? "")}"></div></div>
  <div class="f"><label for="w-c">Comentario (opcional)</label><textarea id="w-c" name="comentario" maxlength="1000">${esc(w.comentario || "")}</textarea></div>
  <button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveWellness(f) {
  const v = S.sub.well || {}; const missing = WK.filter(([k]) => num(v[k]) == null);
  if (missing.length === WK.length) { toast("Marca al menos una respuesta"); return; }
  const row = { client_id: S.me.cid, fecha: today(), comentario: f.comentario.value.trim(), molestia_zona: f.molestia_zona.value.trim(), sueno_h: num(f.sueno_h.value), fc: num(f.fc.value), molestia_0a10: num(f.molestia_0a10.value) };
  WK.forEach(([k]) => row[k] = num(v[k]));
  try { await q(sb.from("wellness").upsert(row, { onConflict: "client_id,fecha" })); sheet(""); toast("Guardado. ¡Gracias!"); route(); } catch (e) { toast(errMsg(e)); }
}
function openPeso() {
  sheet(`<h2>Peso de hoy</h2><p class="small muted" style="margin:0">Mejor por la mañana, en ayunas y después de ir al baño. Lo que cuenta es la media de la semana, no un día suelto.</p>
  <form id="f-peso" style="display:flex;flex-direction:column;gap:12px"><div class="f"><label for="kg">Kilos</label><input id="kg" name="kg" inputmode="decimal" placeholder="80,5" required></div><button class="btn pri block">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
  $("#kg").focus();
}
async function savePeso(f) { const kg = num(f.kg.value); if (kg == null || kg < 25 || kg > 350) { toast("Escribe un peso válido"); return; } try { await q(sb.from("weights").upsert({ client_id: S.me.cid, fecha: today(), kg }, { onConflict: "client_id,fecha" })); sheet(""); toast("Peso guardado"); route(); } catch (e) { toast(errMsg(e)); } }

/* ================= Cliente: Entreno ================= */
async function viewEntreno() {
  loading("Entreno");
  const [plan, wo] = await Promise.all([getPlan(), q(sb.from("workouts").select("id,fecha,dia,sets,comentario").order("fecha", { ascending: false }).limit(30))]);
  const dias = (plan.programa && plan.programa.dias) || [];
  shell("Tu rutina", `
  <div class="card"><h2>${esc(plan.programa.nombre || "Rutina")} <small>${esc(plan.programa.semana || "")}</small></h2>${plan.programa.notas ? `<p class="small muted" style="margin:0 0 8px">${esc(plan.programa.notas)}</p>` : ""}
  ${dias.length ? `<div class="list">${dias.map((d, i) => { const last = wo.find(x => x.dia === d.nombre); return `<button class="it" data-act="go" data-h="entreno-${i}"><span><b>${esc(d.nombre)}</b><br><span class="tiny muted">${(d.ejercicios || []).length} ejercicios${last ? ` · último: ${esc(fdate(last.fecha))}` : ""}</span></span><span class="chip acc">Abrir</span></button>`; }).join("")}</div>` : `<div class="empty">Tu rutina aparecerá aquí en cuanto Adrián la cargue.</div>`}</div>
  <div class="card"><h2>Últimos entrenos</h2>${wo.length ? `<div class="list">${wo.slice(0, 8).map(x => `<div class="it" style="cursor:default"><span><b>${esc(x.dia || "Entreno")}</b><br><span class="tiny muted">${esc(fdate(x.fecha, { weekday: "short", day: "numeric", month: "short" }))} · ${(x.sets || []).length} series</span></span></div>`).join("")}</div>` : `<div class="empty">Aún no has registrado ningún entreno.</div>`}</div>`);
}
const draftKey = i => `arc-draft-${S.me.cid}-${i}`;
async function viewWorkout(i) {
  loading("Entreno");
  const [plan, wo] = await Promise.all([getPlan(), q(sb.from("workouts").select("fecha,dia,sets").order("fecha", { ascending: false }).limit(40))]);
  const d = ((plan.programa && plan.programa.dias) || [])[i]; if (!d) { location.hash = "entreno"; return; }
  let draft = {}; try { draft = JSON.parse(localStorage.getItem(draftKey(i)) || "{}"); } catch { }
  const lastSets = name => { for (const w of wo) { const s = (w.sets || []).filter(x => x.ejercicio === name); if (s.length) return { fecha: w.fecha, s }; } return null; };
  S.workoutDay = i;
  shell(d.nombre, `
  ${d.calentamiento ? `<div class="card"><h2>Calentamiento</h2><p class="small" style="margin:0">${esc(d.calentamiento)}</p></div>` : ""}
  <form id="f-workout" data-i="${i}" style="display:flex;flex-direction:column;gap:12px">
  ${(d.ejercicios || []).map((e, ei) => { const n = seriesOf(e.sxr); const prev = lastSets(e.nombre);
    return `<div class="ex"><div><h3>${esc(e.nombre)}</h3><div class="target">${esc([e.sxr, e.rir && e.rir !== "—" ? "RIR " + e.rir : "", e.descanso && e.descanso !== "—" ? "descanso " + e.descanso : ""].filter(Boolean).join(" · "))}</div>${e.notas ? `<div class="tiny muted" style="margin-top:4px">${esc(e.notas)}</div>` : ""}</div>
    ${n ? `<div class="seth"><span>#</span><span>Kg</span><span>Reps</span><span>Te quedaban</span></div><div class="sets">${Array.from({ length: n }, (_, si) => { const k = `${ei}-${si}`; const dv = draft[k] || {}; const pv = prev && prev.s[si]; return `<div class="set"><span class="n">${si + 1}</span><input inputmode="decimal" aria-label="Kilos serie ${si + 1}" data-k="${k}" data-f="kg" value="${esc(dv.kg ?? "")}" placeholder="${esc(pv && pv.kg != null ? pv.kg : "kg")}"><input inputmode="numeric" aria-label="Repeticiones serie ${si + 1}" data-k="${k}" data-f="reps" value="${esc(dv.reps ?? "")}" placeholder="${esc(pv && pv.reps != null ? pv.reps : "reps")}"><input inputmode="numeric" aria-label="Repeticiones que te quedaban serie ${si + 1}" data-k="${k}" data-f="rir" value="${esc(dv.rir ?? "")}" placeholder="${esc(pv && pv.rir != null ? pv.rir : "RIR")}"></div>`; }).join("")}</div>${prev ? `<div class="prev">La última vez (${esc(fdate(prev.fecha))}): ${prev.s.map(x => `${x.kg ?? "?"}×${x.reps ?? "?"}`).join(" · ")}</div>` : ""}`
      : `<label class="small" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-k="${ei}-done" data-f="hecho" ${draft[`${ei}-done`] && draft[`${ei}-done`].hecho ? "checked" : ""} style="width:22px;height:22px"> Hecho</label>`}</div>`; }).join("")}
  <div class="card"><h2>Al terminar</h2>
    <div class="grid2"><div class="f"><label for="rpe">Dureza de la sesión (1–10)</label><select id="rpe" name="rpe"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${draft.rpe == n ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="f"><label for="dur">Minutos</label><input id="dur" name="dur" inputmode="numeric" value="${esc(draft.dur || "")}"></div></div>
    <div class="f" style="margin-top:10px"><label for="com">¿Algo que contar? (sensaciones, molestias, cambios)</label><textarea id="com" name="com" maxlength="2000">${esc(draft.com || "")}</textarea></div>
    <p class="tiny muted">«Te quedaban» = cuántas repeticiones más podrías haber hecho con buena técnica. Si no lo tienes claro, pon tu mejor estimación.</p>
    <button class="btn pri block">Terminar y guardar</button>
  </div></form>`, { back: "entreno", noTabs: true, sub: plan.programa.semana || "" });
}
function saveDraftFrom(el) {
  const f = el.closest("#f-workout"); if (!f) return; const i = f.dataset.i; let d = {}; try { d = JSON.parse(localStorage.getItem(draftKey(i)) || "{}"); } catch { }
  if (el.dataset.k) { const o = d[el.dataset.k] || {}; o[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; d[el.dataset.k] = o; } else if (["rpe", "dur", "com"].includes(el.name)) d[el.name] = el.value;
  try { localStorage.setItem(draftKey(i), JSON.stringify(d)); } catch { }
}
async function saveWorkout(f) {
  const i = +f.dataset.i; const plan = await getPlan(); const d = plan.programa.dias[i]; const sets = [];
  (d.ejercicios || []).forEach((e, ei) => {
    const n = seriesOf(e.sxr);
    if (!n) { const c = f.querySelector(`[data-k="${ei}-done"]`); if (c && c.checked) sets.push({ ejercicio: e.nombre, serie: 1, hecho: true }); return; }
    for (let si = 0; si < n; si++) { const g = fld => { const el = f.querySelector(`[data-k="${ei}-${si}"][data-f="${fld}"]`); return el ? num(el.value) : null; }; const kg = g("kg"), reps = g("reps"), rir = g("rir"); if (kg != null || reps != null) sets.push({ ejercicio: e.nombre, serie: si + 1, kg, reps, rir }); }
  });
  if (!sets.length) { toast("Apunta al menos una serie"); return; }
  const b = f.querySelector("button.pri"); b.disabled = true;
  try { await q(sb.from("workouts").insert({ client_id: S.me.cid, fecha: today(), dia: d.nombre, sets, rpe_sesion: num(f.rpe.value), duracion_min: num(f.dur.value), comentario: f.com.value.trim() })); try { localStorage.removeItem(draftKey(i)); } catch { } toast("¡Entreno guardado!"); location.hash = "hoy"; }
  catch (e) { toast(errMsg(e)); b.disabled = false; }
}

/* ================= Cliente: Progreso ================= */
async function viewProgreso() {
  loading("Progreso"); const tab = S.sub.prog || "peso";
  const segs = [["peso", "Peso"], ["fuerza", "Fuerza"], ["medidas", "Medidas"], ["fotos", "Fotos"]];
  let body = "";
  if (tab === "peso") {
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
async function saveMedidas(f) { const row = { client_id: S.me.cid, fecha: today() }; let any = false; ["cintura", "cadera", "pecho", "brazo", "muslo"].forEach(k => { const v = num(f[k].value); row[k] = v; if (v != null) any = true; }); if (!any) { toast("Escribe al menos una medida"); return; } try { await q(sb.from("measurements").insert(row)); sheet(""); toast("Medidas guardadas"); route(); } catch (e) { toast(errMsg(e)); } }
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
    await q(sb.from("photos").insert({ client_id: S.me.cid, fecha: today(), vista: f.vista.value, path })); sheet(""); toast("Foto subida"); route();
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
function viewMas() {
  const wa = (CFG.whatsappEntrenador || "").replace(/\D/g, "");
  shell("Perfil", `<div class="card"><h2>${esc(S.me.nombre || "")}</h2><p class="small muted" style="margin:0">${esc(S.email)}${S.me.role === "coach" ? " · entrenador" : ""}</p></div>
  ${S.me.role === "client" && wa ? `<a class="btn block" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir a Adrián por WhatsApp</a>` : ""}
  <div class="card"><h2>Instalar la app</h2><p class="small" style="margin:0"><b>iPhone:</b> en Safari, botón Compartir → «Añadir a pantalla de inicio».<br><b>Android:</b> en Chrome, menú ⋮ → «Instalar aplicación».</p></div>
  <div class="card"><h2>Tus datos</h2><p class="small" style="margin:0">Tus registros, fotos e informes solo los ves tú y tu entrenador. Para entrar se usa un código de un solo uso enviado a tu email; no hay contraseñas. Si pierdes el móvil, cierra la sesión desde otro dispositivo o avisa a Adrián.</p></div>
  <button class="btn block" data-act="logout">Cerrar sesión</button>`);
}

/* ================= Entrenador ================= */
async function viewCoachList() {
  loading("Clientes"); const since = addDays(today(), -7);
  const [cl, wl, wo, ws] = await Promise.all([q(sb.from("clients").select("id,nombre,email,estado,user_id").order("nombre")), q(sb.from("wellness").select("client_id,fecha,sueno,fatiga,dolor,estres,animo,motivacion,articular").gte("fecha", since)), q(sb.from("workouts").select("client_id,fecha").gte("fecha", since)), q(sb.from("weights").select("client_id,fecha,kg").gte("fecha", since))]);
  S.coach.list = cl;
  const row = c => { const w = wl.filter(x => x.client_id === c.id), o = wo.filter(x => x.client_id === c.id), p = ws.filter(x => x.client_id === c.id); const wi = avg(w.map(wellIdx).filter(x => x != null)); return `<tr data-act="go" data-h="c-${esc(c.id)}" style="cursor:pointer"><td><b>${esc(c.nombre)}</b><div class="tiny muted">${c.user_id ? "Cuenta activa" : "Pendiente de primer acceso"}</div></td><td class="n">${o.length}</td><td class="n">${w.length}/7</td><td class="n">${wi != null ? fmt(wi, 2) : "—"}</td><td class="n">${p.length ? fmt(avg(p.map(x => +x.kg)), 1) : "—"}</td><td>${c.estado !== "activo" ? `<span class="chip">${esc(c.estado)}</span>` : ""}</td></tr>`; };
  shell("Clientes", `<div class="row"><p class="small muted grow" style="margin:0">Últimos 7 días</p><button class="btn pri sm" data-act="new-client">+ Nuevo cliente</button></div>
  <div class="card"><div class="tbl"><table><thead><tr><th>Cliente</th><th class="n">Entrenos</th><th class="n">Cuestionarios</th><th class="n">Bienestar</th><th class="n">Peso medio</th><th></th></tr></thead><tbody>${cl.map(row).join("") || `<tr><td colspan="6" class="muted">Sin clientes todavía.</td></tr>`}</tbody></table></div></div>
  <p class="tiny muted">Las revisiones semanales, los informes y los cambios de rutina los hace Claude desde los chats del proyecto con el conector de Supabase. Aquí puedes verlo todo, ajustar la rutina y publicar informes.</p>`);
}
function openNewClient() {
  sheet(`<h2>Nuevo cliente</h2><form id="f-newc" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="nc-n">Nombre (como lo verá él)</label><input id="nc-n" name="nombre" required></div><div class="f"><label for="nc-e">Email con el que entrará</label><input id="nc-e" name="email" type="email" required></div><div class="f"><label for="nc-o">Objetivo</label><textarea id="nc-o" name="objetivo"></textarea></div><p class="tiny muted" style="margin:0">Cuando entre por primera vez con ese email, su cuenta se vincula sola a esta ficha.</p><button class="btn pri block">Crear</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveNewClient(f) {
  const nombre = f.nombre.value.trim(), email = f.email.value.trim().toLowerCase(); let id = slug(nombre.split(" ")[0] + "-" + (nombre.split(" ")[1] || "x").slice(0, 1));
  if (S.coach.list.some(c => c.id === id)) id += "-" + Math.random().toString(36).slice(2, 5);
  try { await q(sb.from("clients").insert({ id, nombre, email })); await q(sb.from("plans").insert({ client_id: id, objetivo: f.objetivo.value.trim() })); sheet(""); toast("Cliente creado"); location.hash = "c-" + id; }
  catch (e) { toast(errMsg(e)); }
}
async function viewCoachClient(cid) {
  loading("Cliente"); const tab = S.coach.tab || "resumen"; const c = (await q(sb.from("clients").select("*").eq("id", cid).limit(1)))[0];
  if (!c) { shell("Cliente", `<div class="empty">No existe.</div>`, { back: "c" }); return; }
  S.coach.cid = cid; const segs = [["resumen", "Resumen"], ["entrenos", "Entrenos"], ["wellness", "Cuestionarios"], ["cuerpo", "Peso y medidas"], ["fotos", "Fotos"], ["plan", "Rutina"], ["informes", "Informes"], ["cuenta", "Cuenta"]];
  let body = "";
  if (tab === "resumen" || tab === "wellness") {
    const wl = await q(sb.from("wellness").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(tab === "resumen" ? 14 : 60));
    if (tab === "resumen") { const wo = await q(sb.from("workouts").select("fecha,dia,sets,comentario").eq("client_id", cid).order("fecha", { ascending: false }).limit(10)); const ws = await q(sb.from("weights").select("fecha,kg").eq("client_id", cid).order("fecha", { ascending: true }).limit(120));
      const w7 = wl.filter(x => x.fecha >= addDays(today(), -7)); const mol = wl.filter(x => x.molestia_zona);
      body = `<div class="kpis"><div class="kpi"><span>Entrenos (7 días)</span><b>${wo.filter(x => x.fecha >= addDays(today(), -7)).length}</b></div><div class="kpi"><span>Cuestionarios (7 días)</span><b>${w7.length}/7</b></div><div class="kpi"><span>Bienestar medio</span><b>${fmt(avg(w7.map(wellIdx).filter(x => x != null)), 2)}</b><em>1–5, 5 = mejor</em></div><div class="kpi"><span>Sueño medio</span><b>${fmt(avg(w7.map(x => num(x.sueno_h)).filter(x => x != null)), 1)} h</b></div></div>
      ${mol.length ? `<div class="banner">Molestias registradas: ${mol.slice(0, 5).map(m => `${esc(m.molestia_zona)} ${m.molestia_0a10 ?? "?"}/10 (${esc(fdate(m.fecha))})`).join(" · ")}</div>` : ""}
      <div class="card"><h2>Peso</h2>${lineChart(ws.map(w => ({ x: w.fecha, y: +w.kg })), { label: "Peso" })}</div>
      <div class="card"><h2>Comentarios recientes</h2>${[...wo.filter(x => x.comentario).map(x => ({ f: x.fecha, t: `${x.dia}: ${x.comentario}` })), ...wl.filter(x => x.comentario).map(x => ({ f: x.fecha, t: x.comentario }))].sort((a, b) => b.f.localeCompare(a.f)).slice(0, 8).map(x => `<p class="small" style="margin:6px 0"><b>${esc(fdate(x.f))}</b> · ${esc(x.t)}</p>`).join("") || `<p class="muted small">Sin comentarios.</p>`}</div>`;
    } else body = `<div class="card"><div class="tbl"><table><thead><tr><th>Fecha</th>${WK.map(([, l]) => `<th class="n">${esc(l.split(" ")[0])}</th>`).join("")}<th class="n">Sueño h</th><th>Molestia</th><th>Comentario</th></tr></thead><tbody>${wl.map(w => `<tr><td>${esc(fdate(w.fecha))}</td>${WK.map(([k]) => `<td class="n">${w[k] ?? "—"}</td>`).join("")}<td class="n">${w.sueno_h ?? "—"}</td><td>${esc(w.molestia_zona || "")}${w.molestia_0a10 != null ? " " + w.molestia_0a10 + "/10" : ""}</td><td class="tiny">${esc(w.comentario || "")}</td></tr>`).join("") || `<tr><td colspan="12" class="muted">Sin cuestionarios.</td></tr>`}</tbody></table></div></div>`;
  } else if (tab === "entrenos") {
    const wo = await q(sb.from("workouts").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40));
    body = wo.length ? wo.map(w => `<div class="card"><h2>${esc(w.dia || "Entreno")} <small>${esc(fdate(w.fecha, { weekday: "short", day: "numeric", month: "short" }))}${w.rpe_sesion != null ? " · dureza " + w.rpe_sesion + "/10" : ""}${w.duracion_min ? " · " + w.duracion_min + " min" : ""}</small></h2><div class="tbl"><table><tbody>${Object.entries((w.sets || []).reduce((a, s) => { (a[s.ejercicio] = a[s.ejercicio] || []).push(s); return a; }, {})).map(([ex, ss]) => `<tr><td>${esc(ex)}</td><td class="n">${ss.map(s => s.hecho ? "hecho" : `${s.kg ?? "?"}×${s.reps ?? "?"}${s.rir != null ? " @" + s.rir : ""}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>${w.comentario ? `<p class="small" style="margin:8px 0 0">${esc(w.comentario)}</p>` : ""}</div>`).join("") : `<div class="empty">Sin entrenos registrados.</div>`;
  } else if (tab === "cuerpo") {
    const [ws, ms] = await Promise.all([q(sb.from("weights").select("fecha,kg").eq("client_id", cid).order("fecha", { ascending: true }).limit(400)), q(sb.from("measurements").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(30))]);
    body = `<div class="card"><h2>Peso</h2>${lineChart(ws.map(w => ({ x: w.fecha, y: +w.kg })), { label: "Peso" })}</div><div class="card"><h2>Medidas</h2>${ms.length ? `<div class="tbl"><table><thead><tr><th>Fecha</th><th class="n">Cintura</th><th class="n">Cadera</th><th class="n">Pecho</th><th class="n">Brazo</th><th class="n">Muslo</th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(fdate(m.fecha))}</td>${["cintura", "cadera", "pecho", "brazo", "muslo"].map(k => `<td class="n">${fmt(m[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin medidas.</div>`}</div>`;
  } else if (tab === "fotos") {
    const ph = await q(sb.from("photos").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(40)); let urls = {};
    if (ph.length) { const { data } = await sb.storage.from("fotos").createSignedUrls(ph.map(p => p.path), 600); (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; }); }
    body = `<div class="card">${ph.length ? `<div class="photos">${ph.map(p => urls[p.path] ? `<figure style="margin:0"><img src="${esc(urls[p.path])}" alt="${esc(p.vista)} ${esc(fdate(p.fecha))}" loading="lazy"><figcaption class="tiny muted">${esc(fdate(p.fecha))} · ${esc(p.vista)}</figcaption></figure>` : "").join("")}</div>` : `<div class="empty">Sin fotos.</div>`}</div>`;
  } else if (tab === "plan") {
    const pl = (await q(sb.from("plans").select("*").eq("client_id", cid).limit(1)))[0] || { programa: {}, bloques: [], habitos: [] }; const p = pl.programa || {};
    body = `<form id="f-plan" data-cid="${esc(cid)}" style="display:flex;flex-direction:column;gap:12px">
    <div class="card"><div class="f"><label for="pl-o">Objetivo (lo ve el cliente)</label><textarea id="pl-o" name="objetivo">${esc(pl.objetivo || "")}</textarea></div><div class="grid2" style="margin-top:10px"><div class="f"><label for="pl-n">Nombre de la rutina</label><input id="pl-n" name="pnombre" value="${esc(p.nombre || "")}"></div><div class="f"><label for="pl-s">Semana</label><input id="pl-s" name="psemana" value="${esc(p.semana || "")}"></div></div><div class="f" style="margin-top:10px"><label for="pl-no">Notas de la rutina</label><textarea id="pl-no" name="pnotas">${esc(p.notas || "")}</textarea></div><div class="f" style="margin-top:10px"><label for="pl-h">Hábitos (uno por línea)</label><textarea id="pl-h" name="habitos">${esc((pl.habitos || []).join("\n"))}</textarea></div></div>
    <div id="dias" style="display:flex;flex-direction:column;gap:10px">${(p.dias && p.dias.length ? p.dias : [{}]).map(diaHTML).join("")}</div>
    <button type="button" class="btn" data-act="add-dia">+ Añadir día</button>
    <div class="card"><div class="f"><label for="pl-b">Bloques / mesociclos (JSON: lo mantiene Claude)</label><textarea id="pl-b" name="bloques" style="min-height:120px;font-family:monospace;font-size:13px">${esc(JSON.stringify(pl.bloques || [], null, 1))}</textarea></div></div>
    <button class="btn pri block">Guardar rutina</button></form>`;
  } else if (tab === "informes") {
    const rp = await q(sb.from("reports").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(30));
    body = rp.length ? rp.map(r => `<div class="card"><h2>${esc(r.titular || "Informe")} <small>${esc(fdate(r.fecha))}</small></h2><div class="row"><span class="chip ${r.publicado ? "ok" : "warn"}">${r.publicado ? "Visible para el cliente" : "Borrador (no lo ve)"}</span><span class="grow"></span><button class="btn sm" data-act="ver-informe" data-id="${esc(r.id)}">Ver</button><button class="btn sm ${r.publicado ? "" : "pri"}" data-act="publicar" data-id="${esc(r.id)}" data-v="${r.publicado ? "0" : "1"}">${r.publicado ? "Ocultar" : "Publicar"}</button></div></div>`).join("") : `<div class="empty">Sin informes. Claude los crea al hacer la revisión semanal en el chat del cliente.</div>`;
  } else if (tab === "cuenta") {
    body = `<form id="f-cuenta" data-cid="${esc(cid)}" class="card" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="cu-n">Nombre</label><input id="cu-n" name="nombre" value="${esc(c.nombre)}"></div><div class="f"><label for="cu-e">Email de acceso</label><input id="cu-e" name="email" type="email" value="${esc(c.email)}"></div><div class="f"><label for="cu-s">Estado</label><select id="cu-s" name="estado">${["activo", "pausa", "baja"].map(s => `<option ${c.estado === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><p class="tiny muted" style="margin:0">«Baja» le quita el acceso a la app al momento. ${c.user_id ? "Cuenta vinculada." : "Aún no ha entrado nunca."}</p><button class="btn pri">Guardar</button></form>`;
  }
  shell(c.nombre, `<div class="seg" role="group" aria-label="Apartado">${segs.map(([k, l]) => `<button data-act="ctab" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body}`, { back: "c" });
}
function diaHTML(d) {
  const ex = (d.ejercicios && d.ejercicios.length ? d.ejercicios : [{}]);
  return `<div class="dia"><div class="row"><input name="d_nombre" value="${esc(d.nombre || "")}" placeholder="Lunes · Pierna A" aria-label="Nombre del día" class="grow" style="font-weight:700"><button type="button" class="btn ghost sm" data-act="del-dia">Quitar</button></div><input name="d_cal" value="${esc(d.calentamiento || "")}" placeholder="Calentamiento" aria-label="Calentamiento">
  <div class="exs" style="display:flex;flex-direction:column;gap:8px">${ex.map(exHTML).join("")}</div><button type="button" class="btn sm" data-act="add-ex">+ Ejercicio</button></div>`;
}
function exHTML(e) { return `<div class="pej" data-ex><input name="e_n" value="${esc(e.nombre || "")}" placeholder="Ejercicio" aria-label="Ejercicio"><input name="e_sxr" value="${esc(e.sxr || "")}" placeholder="3×8–10" aria-label="Series × reps"><input name="e_rir" value="${esc(e.rir || "")}" placeholder="RIR" aria-label="RIR"><input name="e_desc" value="${esc(e.descanso || "")}" placeholder="Descanso" aria-label="Descanso"><input class="full" name="e_not" value="${esc(e.notas || "")}" placeholder="Notas técnicas" aria-label="Notas" style="grid-column:2/-1"></div>`; }
async function savePlan(f) {
  let bloques = []; try { bloques = JSON.parse(f.bloques.value || "[]"); if (!Array.isArray(bloques)) throw 0; } catch { toast("El JSON de bloques no es válido"); return; }
  const dias = [...f.querySelectorAll(".dia")].map(d => ({ nombre: d.querySelector('[name="d_nombre"]').value.trim(), calentamiento: d.querySelector('[name="d_cal"]').value.trim(), ejercicios: [...d.querySelectorAll("[data-ex]")].map(x => { const g = n => x.querySelector(`[name="${n}"]`).value.trim(); return { nombre: g("e_n"), sxr: g("e_sxr"), rir: g("e_rir"), descanso: g("e_desc"), notas: g("e_not") }; }).filter(e => e.nombre) })).filter(d => d.nombre || d.ejercicios.length);
  const row = { client_id: f.dataset.cid, objetivo: f.objetivo.value.trim(), programa: { nombre: f.pnombre.value.trim(), semana: f.psemana.value.trim(), notas: f.pnotas.value.trim(), dias }, bloques, habitos: lines(f.habitos.value) };
  try { await q(sb.from("plans").upsert(row, { onConflict: "client_id" })); toast("Rutina guardada"); } catch (e) { toast(errMsg(e)); }
}

/* ================= Eventos ================= */
document.addEventListener("click", async ev => {
  const a = ev.target.closest("[data-act]"); if (!a) return; const act = a.dataset.act;
  if (act === "close-bg") { if (ev.target === a) sheet(""); return; }
  switch (act) {
    case "go": if (location.hash === "#" + a.dataset.h) route(); else location.hash = a.dataset.h; break;
    case "reload": location.reload(); break;
    case "logout": await sb.auth.signOut(); clearLocal(); S.me = null; S.plan = null; location.hash = ""; renderLogin(); break;
    case "login-back": renderLogin(); break;
    case "close": sheet(""); break;
    case "wellness": { const r = await q(sb.from("wellness").select("*").eq("fecha", today()).limit(1)).catch(() => []); openWellness(r[0]); break; }
    case "scale": { S.sub.well[a.dataset.k] = +a.dataset.v; a.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === a))); break; }
    case "peso": openPeso(); break;
    case "medidas": openMedidas(); break;
    case "fotos": openFotos(); break;
    case "prog": S.sub.prog = a.dataset.t; viewProgreso(); break;
    case "new-client": openNewClient(); break;
    case "ctab": S.coach.tab = a.dataset.t; viewCoachClient(S.coach.cid); break;
    case "add-dia": $("#dias").insertAdjacentHTML("beforeend", diaHTML({})); break;
    case "del-dia": a.closest(".dia").remove(); break;
    case "add-ex": a.closest(".dia").querySelector(".exs").insertAdjacentHTML("beforeend", exHTML({})); break;
    case "publicar": try { await q(sb.from("reports").update({ publicado: a.dataset.v === "1", publicado_en: a.dataset.v === "1" ? new Date().toISOString() : null }).eq("id", a.dataset.id)); toast(a.dataset.v === "1" ? "Publicado: ya lo ve el cliente" : "Ocultado"); viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } break;
    case "ver-informe": { const r = (await q(sb.from("reports").select("*").eq("id", a.dataset.id).limit(1)))[0]; if (r) sheet(`<h2>Vista del cliente</h2>${reportHTML(r)}<button class="btn" data-act="close">Cerrar</button>`); break; }
  }
});
document.addEventListener("input", ev => { if (ev.target.closest && ev.target.closest("#f-workout")) saveDraftFrom(ev.target); });
document.addEventListener("change", ev => {
  if (ev.target.closest && ev.target.closest("#f-workout")) saveDraftFrom(ev.target);
  if (ev.target.id === "ex-sel") { S.sub.ex = ev.target.value; viewProgreso(); }
});
document.addEventListener("submit", ev => {
  ev.preventDefault(); const f = ev.target;
  const map = { "f-login": sendCode, "f-code": verifyCode, "f-well": saveWellness, "f-peso": savePeso, "f-workout": saveWorkout, "f-med": saveMedidas, "f-fotos": saveFotos, "f-newc": saveNewClient, "f-plan": savePlan };
  if (map[f.id]) map[f.id](f);
  if (f.id === "f-cuenta") (async () => { try { await q(sb.from("clients").update({ nombre: f.nombre.value.trim(), email: f.email.value.trim().toLowerCase(), estado: f.estado.value }).eq("id", f.dataset.cid)); toast("Guardado"); } catch (e) { toast(errMsg(e)); } })();
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape") sheet(""); });

init();
