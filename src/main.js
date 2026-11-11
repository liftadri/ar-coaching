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
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  nutri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-4 0-7-3.5-7-8 0-3 2-5 4.5-5 1.2 0 1.8.5 2.5.5s1.3-.5 2.5-.5C17 8 19 10 19 13c0 4.5-3 8-7 8z"/><path d="M12 8c0-2 1-4 3-5"/></svg>',
  progreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18M5 16l5-5 4 3 6-7"/></svg>',
  informes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 4-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.5 2.3 4 5"/></svg>'
};

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
    const hc = location.hash === "#c" || location.hash.startsWith("#c-");
    if (!location.hash || (S.me.role === "coach") !== hc) location.hash = S.me.role === "coach" ? "c" : "hoy";
    route();
  } catch (e) { $("#app").innerHTML = `<div class="login">${LOGO}<h1>No se pudo cargar</h1><p>${esc(errMsg(e))}</p><button class="btn pri" data-act="reload">Reintentar</button><button class="btn ghost" data-act="logout">Cerrar sesión</button></div>`; }
}
function renderNoAccess() {
  $("#app").innerHTML = `<form class="login" id="f-alta-codigo">${LOGO}<h1>Activa tu cuenta</h1><p>Has entrado como <b>${esc(S.email)}</b>. Escribe el código de alta que te ha dado Adrián para vincular tu cuenta.</p>
  <div class="f"><label for="ac">Código de alta</label><input id="ac" name="codigo" autocomplete="off" autocapitalize="characters" required maxlength="12"></div>
  <button class="btn pri block">Activar</button><button type="button" class="btn ghost" data-act="logout">Cerrar sesión</button></form>`;
}
const pwField = (id, label, ac) => `<div class="f"><label for="${id}">${label}</label><div class="pw"><input id="${id}" name="${id}" type="password" autocomplete="${ac}" minlength="8" maxlength="72" required><button type="button" class="btn ghost sm" data-act="ver-pw" aria-label="Mostrar contraseña">Ver</button></div></div>`;
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
function shell(title, body, opts = {}) {
  const coach = S.me.role === "coach";
  const tabs = coach ? [["c", "Clientes", "clientes"], ["mas", "Perfil", "mas"]] : CLIENT_TABS;
  const cur = coach && (S.view === "c" || S.view.startsWith("c-")) ? "c" : S.view.split("-")[0];
  const right = !coach && !opts.back ? `<button class="back" data-act="go" data-h="mas" aria-label="Tu perfil">${ICON.mas}</button>` : "";
  $("#app").innerHTML = `<header class="top">${opts.back ? `<button class="back" data-act="go" data-h="${esc(opts.back)}" aria-label="Volver">←</button>` : `<img src="./logo.jpg" alt="">`}<h1>${esc(title)}${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ""}</h1>${right}</header>
  <main class="${coach ? "wide" : ""}" id="main">${body}</main>
  ${opts.noTabs ? "" : `<nav class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)" aria-label="Secciones">${tabs.map(([k, l, i]) => `<button data-act="go" data-h="${k}" aria-current="${cur === k}">${ICON[i]}<span>${l}</span></button>`).join("")}</nav>`}`;
  window.scrollTo(0, 0);
}
function loading(title) { shell(title, `<div class="empty">Cargando…</div>`); }
async function route() {
  if (!S.me) return;
  let h = location.hash.slice(1) || (S.me.role === "coach" ? "c" : "hoy");
  const isCoachRoute = h === "c" || h.startsWith("c-");
  if (S.me.role !== "coach" && isCoachRoute) h = "hoy"; // la vista de entrenador no existe para clientes
  S.view = h;
  try {
    if (S.me.role === "coach") { if (h.startsWith("c-")) return await viewCoachClient(h.slice(2)); if (h === "mas") return viewMas(); return await viewCoachList(); }
    if (h === "cal") return await viewCal();
    if (h === "entreno") return await viewEntreno();
    if (h.startsWith("entreno-")) return await viewWorkout(+h.slice(8));
    if (h === "nutri") return await viewNutri();
    if (h === "progreso") return await viewProgreso();
    if (h === "tareas") return await viewTareas();
    if (h === "informes") return await viewInformes();
    if (h.startsWith("informe-")) return await viewInforme(decodeURIComponent(h.slice(8)));
    if (h === "mas") return await viewMas();
    return await viewHoy();
  } catch (e) { shell("Error", `<div class="banner">${esc(errMsg(e))}</div><button class="btn" data-act="reload">Reintentar</button>`); }
}
window.addEventListener("hashchange", route);

/* ================= Cliente: datos ================= */
async function getPlan() { if (S.plan) return S.plan; const rows = await q(sb.from("plans").select("*").limit(1)); S.plan = rows[0] || { programa: {}, bloques: [], habitos: [], objetivo: "", progreso_visible: ["peso", "fuerza", "medidas", "fotos", "bienestar", "tests"] }; S.plan.programa = S.plan.programa || {}; return S.plan; }
function weekNow(plan, d = today()) { for (const b of plan.bloques || []) { const w = (b.semanas || []).find(s => s.inicio <= d && d <= s.fin); if (w) return { ...w, bloque: b.nombre }; } return null; }
const DSEM = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dow = s => ((parseD(s).getDay() + 6) % 7) + 1;
const diasPlan = plan => ((plan.programa && plan.programa.dias) || []).map((d, i) => ({ ...d, i }));
const plannedOn = (plan, fecha) => diasPlan(plan).filter(d => +d.dia_semana === dow(fecha));
function nextPlanned(plan, from) { for (let k = 1; k <= 7; k++) { const f = addDays(from, k); const p = plannedOn(plan, f); if (p.length) return { fecha: f, dia: p[0] }; } return null; }
const TT = { tarea: "Tarea", habito: "Hábito", control: "Control", formulario: "Cuestionario" };

/* ================= Cliente: Hoy ================= */
async function viewHoy() {
  loading("Hoy");
  const t = today();
  const [plan, wl, wt, wo, rp, tk] = await Promise.all([getPlan(), q(sb.from("wellness").select("*").eq("fecha", t).limit(1)), q(sb.from("weights").select("*").order("fecha", { ascending: false }).limit(1)), q(sb.from("workouts").select("id,fecha,dia").order("fecha", { ascending: false }).limit(10)), q(sb.from("reports").select("id,fecha,titular,semana").order("fecha", { ascending: false }).limit(1)), q(sb.from("tasks").select("*").eq("hecho", false).order("fecha", { ascending: true, nullsFirst: false }).limit(50))]);
  const w = weekNow(plan); const well = wl[0]; const lastW = wt[0]; const dias = diasPlan(plan);
  const doneToday = wo.filter(x => x.fecha === t);
  const conDia = dias.some(d => d.dia_semana);
  let entreno = "";
  if (dias.length) {
    if (conDia) {
      const hoyD = plannedOn(plan, t);
      if (hoyD.length) entreno = hoyD.map(d => { const done = doneToday.some(x => x.dia === d.nombre); return `<button class="it" data-act="go" data-h="entreno-${d.i}"><span><b>Entreno: ${esc(d.nombre)}</b><br><span class="tiny muted">${(d.ejercicios || []).length} ejercicios</span></span><span class="chip ${done ? "ok" : "acc"}">${done ? "Hecho ✓" : "Empezar"}</span></button>`; }).join("");
      else { const nx = nextPlanned(plan, t); entreno = `<div class="it" style="cursor:default"><span><b>Hoy toca descanso</b><br><span class="tiny muted">${nx ? `Próximo entreno: ${esc(nx.dia.nombre)} · ${esc(DSEM[dow(nx.fecha)].toLowerCase())}` : "Recupera bien"}</span></span>${doneToday.length ? `<span class="done">Entreno hecho ✓</span>` : ""}</div>`; }
    } else {
      const last = wo[0]; const i0 = last ? dias.findIndex(d => d.nombre === last.dia) : -1; const nd = dias[(i0 + 1) % dias.length];
      entreno = `<button class="it" data-act="go" data-h="entreno-${nd.i}"><span><b>Entreno: ${esc(nd.nombre)}</b><br><span class="tiny muted">${doneToday.length ? "Ya has registrado un entreno hoy" : "Siguiente sesión de tu rutina"}</span></span><span class="chip ${doneToday.length ? "ok" : "acc"}">${doneToday.length ? "Hecho ✓" : "Empezar"}</span></button>`;
    }
  }
  const pend = tk.filter(x => !x.fecha || x.fecha <= addDays(t, 2));
  shell(CFG.nombre || "Hoy", `
  <section class="hello"><h2>Hola, ${esc((S.me.nombre || "").split(" ")[0])}</h2><p>${esc(cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })))}${w ? ` · ${esc(w.bloque)} · ${esc(w.nombre)}` : ""}</p></section>
  ${w && w.foco ? `<div class="card"><h2>Esta semana <small>${esc(w.tipo && w.tipo !== "carga" ? cap(w.tipo) : "")}</small></h2><p class="small" style="margin:0">${esc(w.foco)}</p></div>` : ""}
  <div class="card"><h2>Para hoy</h2><div class="list">
    ${entreno}
    <button class="it" data-act="wellness"><span><b>Cuestionario diario</b><br><span class="tiny muted">1 minuto · cómo has dormido y cómo te sientes</span></span>${well ? `<span class="done">Hecho ✓</span>` : `<span class="chip acc">Rellenar</span>`}</button>
    <button class="it" data-act="peso"><span><b>Peso</b><br><span class="tiny muted">${lastW ? `Último: ${fmt(lastW.kg)} kg (${esc(fdate(lastW.fecha))})` : "En ayunas, después de ir al baño"}</span></span>${lastW && lastW.fecha === t ? `<span class="done">Hecho ✓</span>` : `<span class="chip">Apuntar</span>`}</button>
  </div></div>
  <div class="card"><h2>Tus tareas <small><a href="#tareas">Ver todas</a></small></h2>${pend.length ? `<div class="list">${pend.slice(0, 6).map(taskRow).join("")}</div>` : `<p class="small muted" style="margin:0">No tienes tareas pendientes. ¡Bien!</p>`}</div>
  ${rp[0] ? `<div class="card"><h2>Tu último informe <small>${esc(fdate(rp[0].fecha))}</small></h2><p style="margin:0 0 10px"><b>${esc(rp[0].titular || rp[0].semana || "Informe semanal")}</b></p><button class="btn block" data-act="go" data-h="informe-${esc(encodeURIComponent(rp[0].id))}">Leer informe</button></div>` : ""}
  ${(plan.habitos || []).length ? `<div class="card"><h2>Tus hábitos</h2><ul class="small" style="margin:0;padding-left:18px">${plan.habitos.map(hb => `<li>${esc(hb)}</li>`).join("")}</ul></div>` : ""}`);
}
function taskRow(x) {
  const late = x.fecha && x.fecha < today() && !x.hecho;
  return `<button class="it" data-act="tarea" data-id="${esc(x.id)}"><span><b>${esc(x.titulo)}</b><br><span class="tiny muted">${esc(TT[x.tipo] || "Tarea")}${x.fecha ? ` · ${late ? "era para el " : "para el "}${esc(fdate(x.fecha, { weekday: "short", day: "numeric", month: "short" }))}` : ""}</span></span>${x.hecho ? `<span class="done">Hecha ✓</span>` : `<span class="chip ${late ? "warn" : "acc"}">${late ? "Pendiente" : "Hacer"}</span>`}</button>`;
}
async function openTarea(id) {
  const x = (await q(sb.from("tasks").select("*").eq("id", id).limit(1)))[0]; if (!x) return;
  sheet(`<h2>${esc(x.titulo)}</h2><p class="tiny muted" style="margin:0">${esc(TT[x.tipo] || "Tarea")}${x.fecha ? " · " + esc(fdate(x.fecha, { weekday: "long", day: "numeric", month: "long" })) : ""}</p>
  ${x.detalle ? `<p class="small" style="white-space:pre-wrap">${esc(x.detalle)}</p>` : ""}
  <form id="f-tarea" data-id="${esc(x.id)}" data-hecho="${x.hecho ? "1" : "0"}" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="t-r">Comentario para Adrián (opcional)</label><textarea id="t-r" name="respuesta" maxlength="2000">${esc(x.respuesta || "")}</textarea></div>
  <button class="btn pri block">${x.hecho ? "Guardar comentario" : "Marcar como hecha"}</button>${x.hecho ? `<button type="button" class="btn ghost" data-act="tarea-deshacer" data-id="${esc(x.id)}">Marcar como no hecha</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cerrar</button></form>`);
}
async function saveTarea(f) { try { await q(sb.rpc("completar_tarea", { p_id: f.dataset.id, p_hecho: true, p_respuesta: f.respuesta.value.trim() })); sheet(""); toast("¡Hecho!"); route(); } catch (e) { toast(errMsg(e)); } }
async function viewTareas() {
  loading("Tareas"); const tk = await q(sb.from("tasks").select("*").order("fecha", { ascending: false, nullsFirst: true }).limit(200));
  const pend = tk.filter(x => !x.hecho).sort((a, b) => (a.fecha || "0").localeCompare(b.fecha || "0")), done = tk.filter(x => x.hecho);
  shell("Tus tareas", `<div class="card"><h2>Pendientes</h2>${pend.length ? `<div class="list">${pend.map(taskRow).join("")}</div>` : `<p class="small muted" style="margin:0">Nada pendiente.</p>`}</div>
  ${done.length ? `<div class="card"><h2>Hechas</h2><div class="list">${done.slice(0, 30).map(taskRow).join("")}</div></div>` : ""}`, { back: "hoy" });
}

/* ================= Cliente: Calendario ================= */
async function viewCal() {
  loading("Calendario");
  const t = today(); const m = S.sub.calM || t.slice(0, 7); const sel = S.sub.calD && S.sub.calD.startsWith(m) ? S.sub.calD : (t.startsWith(m) ? t : m + "-01");
  const first = m + "-01"; const last = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
  const [plan, wo, ev, tk] = await Promise.all([getPlan(), q(sb.from("workouts").select("fecha,dia").gte("fecha", first).lte("fecha", last)), q(sb.from("events").select("*").lte("fecha", last).order("fecha")), q(sb.from("tasks").select("*").gte("fecha", first).lte("fecha", last))]);
  const evOn = d => ev.filter(e => e.fecha <= d && d <= (e.fin || e.fecha));
  const lead = dow(first) - 1; const nDays = +last.slice(8);
  let cells = Array.from({ length: lead }, () => `<span></span>`).join("");
  for (let k = 1; k <= nDays; k++) {
    const d = m + "-" + String(k).padStart(2, "0");
    const dots = [plannedOn(plan, d).length && !wo.some(x => x.fecha === d) && d >= t ? `<i class="dp"></i>` : "", wo.some(x => x.fecha === d) ? `<i class="dw"></i>` : "", evOn(d).length ? `<i class="de"></i>` : "", tk.some(x => x.fecha === d) ? `<i class="dt"></i>` : ""].join("");
    cells += `<button class="cd${d === t ? " hoy" : ""}" data-act="cal-d" data-d="${d}" aria-pressed="${d === sel}" aria-label="${esc(fdate(d, { weekday: "long", day: "numeric", month: "long" }))}"><span>${k}</span><span class="dots">${dots}</span></button>`;
  }
  const w = weekNow(plan, sel);
  const items = [
    ...wo.filter(x => x.fecha === sel).map(x => `<div class="it" style="cursor:default"><span><b>${esc(x.dia || "Entreno")}</b><br><span class="tiny muted">Entreno registrado</span></span><span class="done">Hecho ✓</span></div>`),
    ...(sel >= t ? plannedOn(plan, sel).filter(d => !wo.some(x => x.fecha === sel && x.dia === d.nombre)).map(d => `<button class="it" data-act="go" data-h="entreno-${d.i}"><span><b>${esc(d.nombre)}</b><br><span class="tiny muted">Entreno previsto</span></span><span class="chip acc">Ver</span></button>`) : []),
    ...evOn(sel).map(e => `<div class="it" style="cursor:default"><span><b>${esc(e.titulo)}</b><br><span class="tiny muted">${esc(cap(e.tipo || ""))}${e.notas ? " · " + esc(e.notas) : ""}</span></span></div>`),
    ...tk.filter(x => x.fecha === sel).map(taskRow)];
  const mName = cap(parseD(first).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const prevM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7), nextM = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
  shell("Calendario", `<div class="card"><div class="row"><button class="btn ghost sm" data-act="cal-m" data-m="${prevM}" aria-label="Mes anterior">‹</button><h2 class="grow" style="text-align:center;margin:0">${esc(mName)}</h2><button class="btn ghost sm" data-act="cal-m" data-m="${nextM}" aria-label="Mes siguiente">›</button></div>
  <div class="calg"><span class="dh">L</span><span class="dh">M</span><span class="dh">X</span><span class="dh">J</span><span class="dh">V</span><span class="dh">S</span><span class="dh">D</span>${cells}</div>
  <div class="leg tiny muted"><span><i class="dp"></i>Entreno previsto</span><span><i class="dw"></i>Entreno hecho</span><span><i class="de"></i>Evento</span><span><i class="dt"></i>Tarea</span></div></div>
  <div class="card"><h2>${esc(cap(fdate(sel, { weekday: "long", day: "numeric", month: "long" })))}${w ? ` <small>${esc(w.bloque)} · ${esc(w.nombre)}</small>` : ""}</h2>${items.length ? `<div class="list">${items.join("")}</div>` : `<p class="small muted" style="margin:0">Nada previsto este día.</p>`}</div>`);
}

/* ================= Cliente: Nutrición ================= */
async function viewNutri() {
  loading("Nutrición"); const plan = await getPlan(); const n = plan.nutricion;
  const hab = (plan.habitos || []).length ? `<div class="card"><h2>Tus hábitos</h2><ul class="small" style="margin:0;padding-left:18px">${plan.habitos.map(hb => `<li>${esc(hb)}</li>`).join("")}</ul></div>` : "";
  if (!n) { shell("Nutrición", `<div class="card"><h2>Próximamente</h2><p class="small" style="margin:0">Aquí tendrás tu plan de alimentación cuando Adrián lo active. Mientras tanto, céntrate en tus hábitos.</p></div>${hab}`); return; }
  shell("Nutrición", `${n.titulo || n.notas ? `<div class="card">${n.titulo ? `<h2>${esc(n.titulo)}</h2>` : ""}${n.notas ? `<p class="small" style="margin:0;white-space:pre-wrap">${esc(n.notas)}</p>` : ""}</div>` : ""}
  ${(n.secciones || []).map(sec => `<div class="card"><h2>${esc(sec.titulo || "")}</h2><ul class="small" style="margin:0;padding-left:18px">${(sec.items || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}${hab}`);
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
  const dias = diasPlan(plan).sort((a, b) => (+a.dia_semana || 9) - (+b.dia_semana || 9));
  shell("Tu rutina", `
  <div class="card"><h2>${esc(plan.programa.nombre || "Rutina")} <small>${esc(plan.programa.semana || "")}</small></h2>${plan.programa.notas ? `<p class="small muted" style="margin:0 0 8px">${esc(plan.programa.notas)}</p>` : ""}
  ${dias.length ? `<div class="list">${dias.map(d => { const last = wo.find(x => x.dia === d.nombre); return `<button class="it" data-act="go" data-h="entreno-${d.i}"><span><b>${esc(d.nombre)}</b><br><span class="tiny muted">${d.dia_semana ? esc(DSEM[d.dia_semana]) + " · " : ""}${(d.ejercicios || []).length} ejercicios${last ? ` · último: ${esc(fdate(last.fecha))}` : ""}</span></span><span class="chip acc">Abrir</span></button>`; }).join("")}</div>` : `<div class="empty">Tu rutina aparecerá aquí en cuanto Adrián la cargue.</div>`}</div>
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
  sheet(`<h2>Nuevo cliente</h2><form id="f-newc" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="nc-n">Nombre (como lo verá él)</label><input id="nc-n" name="nombre" required></div><div class="f"><label for="nc-e">Email con el que entrará</label><input id="nc-e" name="email" type="email" required></div><div class="f"><label for="nc-o">Objetivo</label><textarea id="nc-o" name="objetivo"></textarea></div><p class="tiny muted" style="margin:0">Al crearla tendrás su código de alta en la pestaña «Cuenta»: se lo das junto con el enlace de la app para que se registre en «Nuevo atleta».</p><button class="btn pri block">Crear</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></form>`);
}
async function saveNewClient(f) {
  const nombre = f.nombre.value.trim(), email = f.email.value.trim().toLowerCase(); let id = slug(nombre.split(" ")[0] + "-" + (nombre.split(" ")[1] || "x").slice(0, 1));
  if (S.coach.list.some(c => c.id === id)) id += "-" + Math.random().toString(36).slice(2, 5);
  try { await q(sb.from("clients").insert({ id, nombre, email })); await q(sb.from("plans").insert({ client_id: id, objetivo: f.objetivo.value.trim() })); sheet(""); toast("Cliente creado"); S.coach.tab = "cuenta"; location.hash = "c-" + id; }
  catch (e) { toast(errMsg(e)); }
}
async function viewCoachClient(cid) {
  loading("Cliente"); const tab = S.coach.tab || "resumen"; const c = (await q(sb.from("clients").select("*").eq("id", cid).limit(1)))[0];
  if (!c) { shell("Cliente", `<div class="empty">No existe.</div>`, { back: "c" }); return; }
  S.coach.cid = cid; const segs = [["resumen", "Resumen"], ["entrenos", "Entrenos"], ["wellness", "Cuestionarios"], ["cuerpo", "Peso y medidas"], ["fotos", "Fotos"], ["plan", "Rutina"], ["tareas", "Tareas"], ["informes", "Informes"], ["cuenta", "Cuenta"]];
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
    <div class="card"><h2>Progreso que ve el cliente</h2><div class="row" style="flex-wrap:wrap">${[["fuerza", "Fuerza"], ["peso", "Peso"], ["bienestar", "Bienestar"], ["medidas", "Medidas"], ["tests", "Tests"], ["fotos", "Fotos"]].map(([k, l]) => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="pv" value="${k}" ${(pl.progreso_visible || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div></div>
    <div class="card"><div class="f"><label for="pl-nu">Nutrición (JSON; vacío = «Próximamente»). Formato: {"titulo","notas","secciones":[{"titulo","items":[…]}]}</label><textarea id="pl-nu" name="nutricion" style="min-height:80px;font-family:monospace;font-size:13px">${pl.nutricion ? esc(JSON.stringify(pl.nutricion, null, 1)) : ""}</textarea></div></div>
    <div class="card"><div class="f"><label for="pl-b">Bloques / mesociclos (JSON: lo mantiene Claude)</label><textarea id="pl-b" name="bloques" style="min-height:120px;font-family:monospace;font-size:13px">${esc(JSON.stringify(pl.bloques || [], null, 1))}</textarea></div></div>
    <button class="btn pri block">Guardar rutina</button></form>`;
  } else if (tab === "tareas") {
    const tk = await q(sb.from("tasks").select("*").eq("client_id", cid).order("created_at", { ascending: false }).limit(100));
    body = `<form id="f-ntarea" data-cid="${esc(cid)}" class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Nueva tarea</h2><div class="f"><label for="nt-t">Qué tiene que hacer</label><input id="nt-t" name="titulo" required maxlength="200" placeholder="Medirse la cintura en ayunas"></div><div class="f"><label for="nt-d">Detalle (opcional)</label><textarea id="nt-d" name="detalle"></textarea></div><div class="grid2"><div class="f"><label for="nt-ti">Tipo</label><select id="nt-ti" name="tipo">${Object.entries(TT).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div><div class="f"><label for="nt-f">Para el día</label><input id="nt-f" name="fecha" type="date"></div></div><button class="btn pri">Mandar tarea</button></form>
    <div class="card"><h2>Tareas</h2>${tk.length ? `<div class="tbl"><table><tbody>${tk.map(x => `<tr><td><b>${esc(x.titulo)}</b><div class="tiny muted">${esc(TT[x.tipo] || "")}${x.fecha ? " · " + esc(fdate(x.fecha)) : ""}${x.respuesta ? ` · «${esc(x.respuesta)}»` : ""}</div></td><td>${x.hecho ? `<span class="chip ok">Hecha${x.hecho_en ? " " + esc(fdate(x.hecho_en.slice(0, 10))) : ""}</span>` : `<span class="chip warn">Pendiente</span>`}</td><td><button class="btn ghost sm" data-act="del-tarea" data-id="${esc(x.id)}">Borrar</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin tareas.</div>`}</div>`;
  } else if (tab === "informes") {
    const rp = await q(sb.from("reports").select("*").eq("client_id", cid).order("fecha", { ascending: false }).limit(30));
    body = rp.length ? rp.map(r => `<div class="card"><h2>${esc(r.titular || "Informe")} <small>${esc(fdate(r.fecha))}</small></h2><div class="row"><span class="chip ${r.publicado ? "ok" : "warn"}">${r.publicado ? "Visible para el cliente" : "Borrador (no lo ve)"}</span><span class="grow"></span><button class="btn sm" data-act="ver-informe" data-id="${esc(r.id)}">Ver</button><button class="btn sm ${r.publicado ? "" : "pri"}" data-act="publicar" data-id="${esc(r.id)}" data-v="${r.publicado ? "0" : "1"}">${r.publicado ? "Ocultar" : "Publicar"}</button></div></div>`).join("") : `<div class="empty">Sin informes. Claude los crea al hacer la revisión semanal en el chat del cliente.</div>`;
  } else if (tab === "cuenta") {
    body = `<form id="f-cuenta" data-cid="${esc(cid)}" class="card" style="display:flex;flex-direction:column;gap:10px"><div class="f"><label for="cu-n">Nombre</label><input id="cu-n" name="nombre" value="${esc(c.nombre)}"></div><div class="f"><label for="cu-e">Email de acceso</label><input id="cu-e" name="email" type="email" value="${esc(c.email)}"></div><div class="f"><label for="cu-s">Estado</label><select id="cu-s" name="estado">${["activo", "pausa", "baja"].map(s => `<option ${c.estado === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><p class="tiny muted" style="margin:0">«Baja» le quita el acceso a la app al momento.</p><button class="btn pri">Guardar</button></form>
    <div class="card"><h2>Acceso a la app</h2>${c.user_id ? `<p class="small" style="margin:0 0 10px">Cuenta creada y vinculada.</p><button class="btn sm" data-act="desvincular" data-cid="${esc(cid)}">Desvincular cuenta</button><p class="tiny muted">Úsalo si cambia de email o pierde el acceso: después genera un código nuevo y que se registre otra vez.</p>` : `<p class="small" style="margin:0">Mándale el enlace de la app, su <b>email</b> (${esc(c.email)}) y este <b>código de alta</b> para que se registre en «Nuevo atleta»:</p><p style="font-size:26px;font-weight:800;letter-spacing:3px;margin:10px 0">${esc(c.codigo_alta || "—")}</p><button class="btn sm" data-act="nuevo-codigo" data-cid="${esc(cid)}">Generar otro código</button>`}</div>`;
  }
  shell(c.nombre, `<div class="seg" role="group" aria-label="Apartado">${segs.map(([k, l]) => `<button data-act="ctab" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body}`, { back: "c" });
}
function diaHTML(d) {
  const ex = (d.ejercicios && d.ejercicios.length ? d.ejercicios : [{}]);
  return `<div class="dia"><div class="row"><input name="d_nombre" value="${esc(d.nombre || "")}" placeholder="Pierna A" aria-label="Nombre del día" class="grow" style="font-weight:700"><select name="d_sem" aria-label="Día de la semana" style="width:auto"><option value="">Sin día fijo</option>${DSEM.slice(1).map((n, k) => `<option value="${k + 1}" ${+d.dia_semana === k + 1 ? "selected" : ""}>${n}</option>`).join("")}</select><button type="button" class="btn ghost sm" data-act="del-dia">Quitar</button></div><input name="d_cal" value="${esc(d.calentamiento || "")}" placeholder="Calentamiento" aria-label="Calentamiento">
  <div class="exs" style="display:flex;flex-direction:column;gap:8px">${ex.map(exHTML).join("")}</div><button type="button" class="btn sm" data-act="add-ex">+ Ejercicio</button></div>`;
}
function exHTML(e) { return `<div class="pej" data-ex><input name="e_n" value="${esc(e.nombre || "")}" placeholder="Ejercicio" aria-label="Ejercicio"><input name="e_sxr" value="${esc(e.sxr || "")}" placeholder="3×8–10" aria-label="Series × reps"><input name="e_rir" value="${esc(e.rir || "")}" placeholder="RIR" aria-label="RIR"><input name="e_desc" value="${esc(e.descanso || "")}" placeholder="Descanso" aria-label="Descanso"><input class="full" name="e_not" value="${esc(e.notas || "")}" placeholder="Notas técnicas" aria-label="Notas" style="grid-column:2/-1"></div>`; }
async function savePlan(f) {
  let bloques = []; try { bloques = JSON.parse(f.bloques.value || "[]"); if (!Array.isArray(bloques)) throw 0; } catch { toast("El JSON de bloques no es válido"); return; }
  let nutricion = null; if (f.nutricion.value.trim()) { try { nutricion = JSON.parse(f.nutricion.value); } catch { toast("El JSON de nutrición no es válido"); return; } }
  const dias = [...f.querySelectorAll(".dia")].map(d => ({ nombre: d.querySelector('[name="d_nombre"]').value.trim(), dia_semana: num(d.querySelector('[name="d_sem"]').value), calentamiento: d.querySelector('[name="d_cal"]').value.trim(), ejercicios: [...d.querySelectorAll("[data-ex]")].map(x => { const g = n => x.querySelector(`[name="${n}"]`).value.trim(); return { nombre: g("e_n"), sxr: g("e_sxr"), rir: g("e_rir"), descanso: g("e_desc"), notas: g("e_not") }; }).filter(e => e.nombre) })).filter(d => d.nombre || d.ejercicios.length);
  const row = { client_id: f.dataset.cid, objetivo: f.objetivo.value.trim(), programa: { nombre: f.pnombre.value.trim(), semana: f.psemana.value.trim(), notas: f.pnotas.value.trim(), dias }, bloques, habitos: lines(f.habitos.value), nutricion, progreso_visible: [...f.querySelectorAll('[name="pv"]:checked')].map(x => x.value) };
  try { await q(sb.from("plans").upsert(row, { onConflict: "client_id" })); toast("Rutina guardada"); } catch (e) { toast(errMsg(e)); }
}

function codigoNuevo() { const b = new Uint8Array(4); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase(); }
// Confirmación en dos toques (sin diálogos del navegador)
function confirmar(a) { if (a.dataset.ok) return true; a.dataset.ok = "1"; const t = a.textContent; a.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { delete a.dataset.ok; a.textContent = t; }, 3000); return false; }
async function saveNTarea(f) {
  const row = { client_id: f.dataset.cid, titulo: f.titulo.value.trim(), detalle: f.detalle.value.trim(), tipo: f.tipo.value, fecha: f.fecha.value || null };
  try { await q(sb.from("tasks").insert(row)); toast("Tarea mandada"); viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); }
}

/* ================= Eventos ================= */
document.addEventListener("click", async ev => {
  const a = ev.target.closest("[data-act]"); if (!a) return; const act = a.dataset.act;
  if (act === "close-bg") { if (ev.target === a) sheet(""); return; }
  switch (act) {
    case "go": if (location.hash === "#" + a.dataset.h) route(); else location.hash = a.dataset.h; break;
    case "reload": location.reload(); break;
    case "logout": await sb.auth.signOut(); clearLocal(); S.me = null; S.plan = null; S.sub = {}; history.replaceState(null, "", location.pathname); renderLogin(); break;
    case "login-tab": renderLogin(a.dataset.t); break;
    case "ver-pw": { const i = a.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; a.textContent = i.type === "password" ? "Ver" : "Ocultar"; break; }
    case "cambiar-pw": openCambiarPw(); break;
    case "tarea": openTarea(a.dataset.id); break;
    case "tarea-deshacer": try { await q(sb.rpc("completar_tarea", { p_id: a.dataset.id, p_hecho: false, p_respuesta: ($("#t-r") || {}).value || "" })); sheet(""); route(); } catch (e) { toast(errMsg(e)); } break;
    case "cal-m": S.sub.calM = a.dataset.m; S.sub.calD = null; viewCal(); break;
    case "cal-d": S.sub.calD = a.dataset.d; S.sub.calM = a.dataset.d.slice(0, 7); viewCal(); break;
    case "del-tarea": if (confirmar(a)) { try { await q(sb.from("tasks").delete().eq("id", a.dataset.id)); toast("Tarea borrada"); viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } } break;
    case "nuevo-codigo": try { await q(sb.from("clients").update({ codigo_alta: codigoNuevo() }).eq("id", a.dataset.cid)); toast("Código nuevo generado"); viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } break;
    case "desvincular": if (confirmar(a)) { try { await q(sb.from("clients").update({ user_id: null, codigo_alta: codigoNuevo() }).eq("id", a.dataset.cid)); toast("Cuenta desvinculada. Tiene un código nuevo."); viewCoachClient(S.coach.cid); } catch (e) { toast(errMsg(e)); } } break;
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
  const map = { "f-login": doLogin, "f-alta": doAlta, "f-alta-codigo": doAltaCodigo, "f-olvido": doOlvido, "f-nueva": doNueva, "f-tarea": saveTarea, "f-ntarea": saveNTarea, "f-well": saveWellness, "f-peso": savePeso, "f-workout": saveWorkout, "f-med": saveMedidas, "f-fotos": saveFotos, "f-newc": saveNewClient, "f-plan": savePlan };
  if (map[f.id]) map[f.id](f);
  if (f.id === "f-cuenta") (async () => { try { await q(sb.from("clients").update({ nombre: f.nombre.value.trim(), email: f.email.value.trim().toLowerCase(), estado: f.estado.value }).eq("id", f.dataset.cid)); toast("Guardado"); } catch (e) { toast(errMsg(e)); } })();
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape") sheet(""); });

init();
