/* ═══════════════════════════════════════
   KALORYX by ABG — App Logic v2.2
   Fixes:
   - Timezone: uses America/Santo_Domingo (UTC-4)
   - Gemini: calls /api/gemini proxy (no CORS)
   - Google OAuth: correct redirectTo
   - Session: restored on reload via getSession()
   - Email confirm: disabled in Supabase settings
═══════════════════════════════════════ */

const SUPABASE_URL = 'https://qeijtmlukijewsgixoqw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaWp0bWx1a2lqZXdzZ2l4b3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Mzk2MTAsImV4cCI6MjA5MzQxNTYxMH0.Wg55uzUOFSUq0q78EolrzcnsZ52WMBg8-1-wMI6QQSQ';

// Gemini calls go through our Vercel proxy at /api/gemini
const GEMINI_PROXY = '/api/gemini';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl:true
  }
});

/* ── Constants ── */
const BURNS = {
  Pesas:     { low:4, med:5,  high:7  },
  Cardio:    { low:6, med:9,  high:12 },
  Calistenia:{ low:4, med:6,  high:9  },
  Funcional: { low:5, med:7,  high:10 }
};
const SUGS = {
  Pesas:     ['Press banca','Sentadilla','Peso muerto','Press hombro','Curl bíceps','Tríceps polea','Remo barra','Leg press','Hip thrust','Face pull'],
  Cardio:    ['Correr','Bicicleta','Elíptica','Nadar','Saltar cuerda','Spinning','Caminata rápida','HIIT','Escaladora','Remo ergómetro'],
  Calistenia:['Dominadas','Flexiones','Fondos','Pistol squat','Muscle-up','Plancha','L-sit','Archer push-up','Handstand','Dragon flag'],
  Funcional: ['Burpees','Kettlebell swing','Box jumps','TRX','Battle ropes','Clean & press','Thrusters','Turkish get-up','Sled push','Wall balls']
};
const GOAL_PILL = {
  'Mantenerme en forma':         'pill-green',
  'Perder peso / quemar grasa':  'pill-blue',
  'Ganar músculo / masa':        'pill-amber',
  'Mejorar resistencia / cardio':'pill-purple'
};

/* ── State ── */
let USER     = null;
let PROFILE  = {};
let FOODS    = [];
let WORKOUTS = [];
let WLOG     = [];
let wType    = 'Pesas';
let wInt     = 'med';
let aiPending     = null;
let photoPending  = null;
let photoB64      = null;
let searchPending = null;
let searchTimer   = null;
let authMode      = 'login';
let isDark        = localStorage.getItem('kx_theme') === 'dark';

/* ══════════════════════════════
   TIMEZONE FIX
   Santo Domingo = UTC-4 (no DST)
══════════════════════════════ */
function todayStr() {
  // Always use Dominican Republic local date, never UTC
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Santo_Domingo'
  }); // returns YYYY-MM-DD
}

function localDateLabel() {
  return new Date().toLocaleDateString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/* ══════════════════════════════
   THEME
══════════════════════════════ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  const icon = document.getElementById('theme-dot');
  const lbl  = document.getElementById('theme-label');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = isDark ? 'Claro' : 'Oscuro';
}
function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('kx_theme', isDark ? 'dark' : 'light');
  applyTheme();
}

/* ══════════════════════════════
   SHOW / HIDE SCREENS
══════════════════════════════ */
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  const main = document.getElementById('main-app');
  main.style.display       = 'flex';
  main.style.flexDirection = 'column';
  main.style.minHeight     = '100vh';
  document.getElementById('kx-date').textContent = localDateLabel();
  applyTheme();
  renderSugs();
}

function showAuth() {
  document.getElementById('main-app').style.display    = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  ['auth-email','auth-pass','auth-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-ok').style.display  = 'none';
}

/* ══════════════════════════════
   AUTH TABS
══════════════════════════════ */
function authTab(mode, btn) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-pass2-wrap').style.display =
    mode === 'register' ? 'block' : 'none';
  document.getElementById('auth-btn').textContent =
    mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-ok').style.display  = 'none';
}

/* ══════════════════════════════
   AUTH — Email / Password
══════════════════════════════ */
async function doAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  const okEl  = document.getElementById('auth-ok');
  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!email || !pass) {
    errEl.textContent   = 'Completa todos los campos.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('auth-btn');
  btn.disabled    = true;
  btn.textContent = 'Procesando...';

  try {
    if (authMode === 'register') {
      const p2 = document.getElementById('auth-pass2').value;
      if (pass !== p2) {
        errEl.textContent   = 'Las contraseñas no coinciden.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Crear cuenta';
        return;
      }
      if (pass.length < 6) {
        errEl.textContent   = 'La contraseña debe tener al menos 6 caracteres.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Crear cuenta';
        return;
      }
      const { error } = await sb.auth.signUp({
        email,
        password: pass,
        options: { emailRedirectTo: window.location.href }
      });
      if (error) throw error;
      // Session auto-starts if email confirm is disabled in Supabase
      okEl.textContent   = '¡Cuenta creada! Iniciando sesión...';
      okEl.style.display = 'block';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      // onAuthStateChange handles transition to app
    }
  } catch(e) {
    let msg = e.message || 'Error desconocido.';
    if (msg.includes('Invalid login credentials')) msg = 'Correo o contraseña incorrectos.';
    if (msg.includes('Email not confirmed'))       msg = 'Cuenta pendiente de confirmación. Revisa tu correo o contacta soporte.';
    if (msg.includes('User already registered'))   msg = 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.';
    errEl.textContent   = msg;
    errEl.style.display = 'block';
  }

  btn.disabled    = false;
  btn.textContent = authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
}

/* ══════════════════════════════
   AUTH — Google OAuth
   Redirect must match exactly what
   you set in Google Cloud Console
   AND in Supabase → Auth → URL Config
══════════════════════════════ */
async function doGoogle() {
  const errEl = document.getElementById('auth-err');
  errEl.style.display = 'none';

  // redirectTo must be your Vercel app URL, not localhost
  const redirectTo = window.location.origin + '/';

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo }
  });

  if (error) {
    errEl.textContent   = 'Error con Google: ' + error.message;
    errEl.style.display = 'block';
  }
}

/* ══════════════════════════════
   LOGOUT
══════════════════════════════ */
async function doLogout() {
  try { await sb.auth.signOut(); } catch(e) { console.warn(e); }
  USER = null; PROFILE = {}; FOODS = []; WORKOUTS = []; WLOG = [];
  // Reset nav to dashboard
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const dash = document.getElementById('sec-dashboard');
  if (dash) dash.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navDash = document.getElementById('nav-dashboard');
  if (navDash) navDash.classList.add('active');
  showAuth();
}

/* ══════════════════════════════
   SESSION INIT
══════════════════════════════ */
async function initSession() {
  applyTheme();

  // 1. Restore existing session on reload (key fix)
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    USER = session.user;
    showApp();
    await loadAll();
    return;
  }

  // 2. Listen for auth changes (login, Google redirect, logout)
  sb.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
      if (!USER || USER.id !== session.user.id) {
        USER = session.user;
        showApp();
        await loadAll();
      }
    }
    if (event === 'SIGNED_OUT') {
      USER = null; PROFILE = {}; FOODS = []; WORKOUTS = []; WLOG = [];
      showAuth();
    }
  });

  // 3. No session found — show login
  showAuth();
}

/* ══════════════════════════════
   LOAD ALL DATA
══════════════════════════════ */
async function loadAll() {
  const today = todayStr();
  try {
    const [pRes, fRes, wRes, wlRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', USER.id).maybeSingle(),
      sb.from('foods').select('*').eq('user_id', USER.id).eq('logged_at', today).order('created_at'),
      sb.from('workouts').select('*').eq('user_id', USER.id).eq('logged_at', today).order('created_at'),
      sb.from('weight_log').select('*').eq('user_id', USER.id).order('logged_at', { ascending: false }).limit(7)
    ]);
    PROFILE  = pRes.data  || {};
    FOODS    = fRes.data  || [];
    WORKOUTS = wRes.data  || [];
    WLOG     = wlRes.data || [];
    renderDash();
    renderFoodList();
    renderWorkoutList();
    renderProfileHero();
    renderWeightLog();
  } catch(e) {
    console.error('loadAll error:', e);
  }
}

/* ══════════════════════════════
   NAVIGATION
══════════════════════════════ */
function goTo(sec, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + sec).classList.add('active');
  btn.classList.add('active');
  if (sec === 'profile') { loadProfileForm(); renderWeightLog(); }
}

/* ══════════════════════════════
   FOOD TABS
══════════════════════════════ */
function foodTab(tab, btn) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['manual','search','ai','photo'].forEach(t => {
    document.getElementById('ft-' + t).style.display = t === tab ? 'block' : 'none';
  });
}

/* ══════════════════════════════
   OPEN FOOD FACTS
══════════════════════════════ */
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchFood, 600);
}

async function searchFood() {
  const q  = document.getElementById('search-q').value.trim();
  const el = document.getElementById('search-results');
  if (q.length < 2) { el.style.display = 'none'; return; }

  el.innerHTML     = '<div class="search-item"><div class="si-name">Buscando...</div></div>';
  el.style.display = 'block';

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,nutriments,brands`
    );
    const data     = await res.json();
    const products = (data.products || [])
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g']);

    if (!products.length) {
      el.innerHTML = '<div class="search-item"><div class="si-name">Sin resultados. Intenta otra descripción.</div></div>';
      return;
    }
    el.innerHTML = products.map(p => {
      const cal       = Math.round(p.nutriments['energy-kcal_100g']);
      const name      = p.product_name;
      const brand     = p.brands ? ` · ${p.brands.split(',')[0]}` : '';
      const safeName  = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeBrand = brand.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `<div class="search-item" onclick="selectFood('${safeName}',${cal},'${safeBrand}')">
        <div class="si-name">${name}</div>
        <div class="si-cal">${cal} kcal / 100g${brand}</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="search-item"><div class="si-name">Error de conexión. Intenta de nuevo.</div></div>';
  }
}

function selectFood(name, cal100, brand) {
  searchPending = { name, cal100 };
  document.getElementById('search-results').style.display  = 'none';
  document.getElementById('search-q').value                = name;
  document.getElementById('ss-name').textContent           = name;
  document.getElementById('ss-note').textContent           = `${cal100} kcal por 100g${brand}`;
  document.getElementById('ss-cal').textContent            = `${cal100} kcal (100g)`;
  document.getElementById('search-selected').style.display = 'block';
}

async function confirmSearch() {
  if (!searchPending) return;
  await addFoodDB({ name: searchPending.name, calories: searchPending.cal100, moment: document.getElementById('search-moment').value, source: 'search' });
  searchPending = null;
  document.getElementById('search-selected').style.display = 'none';
  document.getElementById('search-q').value = '';
}

/* ══════════════════════════════
   ADD FOOD — Manual
══════════════════════════════ */
async function addFoodManual() {
  const name   = document.getElementById('f-name').value.trim();
  const cal    = parseInt(document.getElementById('f-cal').value) || 0;
  const moment = document.getElementById('f-moment').value;
  if (!name || cal < 1) { alert('Ingresa el nombre y las calorías.'); return; }
  await addFoodDB({ name, calories: cal, moment, source: 'manual' });
  document.getElementById('f-name').value = '';
  document.getElementById('f-cal').value  = '';
}

async function addFoodDB(food) {
  const { data, error } = await sb
    .from('foods')
    .insert({ user_id: USER.id, ...food, logged_at: todayStr() })
    .select().single();
  if (!error) { FOODS.push(data); renderFoodList(); renderDash(); }
  else { console.error('addFoodDB:', error); alert('Error: ' + error.message); }
}

async function delFood(id) {
  const { error } = await sb.from('foods').delete().eq('id', id);
  if (!error) { FOODS = FOODS.filter(f => f.id !== id); renderFoodList(); renderDash(); }
}

/* ══════════════════════════════
   GEMINI AI — via /api/gemini proxy
   Fixes CORS issue completely
══════════════════════════════ */
async function callGemini(parts) {
  const res = await fetch(GEMINI_PROXY, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ contents: [{ parts }] })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Respuesta vacía de Gemini');
  return text.replace(/```json|```/g, '').trim();
}

/* ── Text estimate ── */
async function estimateAI() {
  const desc = document.getElementById('ai-desc').value.trim();
  if (!desc) { alert('Describe lo que comiste.'); return; }

  const btn = document.getElementById('ai-text-btn');
  btn.disabled  = true;
  btn.innerHTML = '<span>⏳</span> Estimando...';
  document.getElementById('ai-text-result').style.display = 'none';

  try {
    const raw = await callGemini([{
      text: `Eres nutricionista experto. Analiza este alimento y responde SOLO en JSON válido sin backticks ni texto adicional:
{"kcal":número,"nombre":"nombre corto del plato","nota":"explicación breve en 1 oración"}
Alimento: "${desc}"`
    }]);
    const j = JSON.parse(raw);
    aiPending = { name: j.nombre || desc, cal: j.kcal, moment: document.getElementById('ai-moment').value };
    document.getElementById('ai-r-name').textContent = j.nombre || desc;
    document.getElementById('ai-r-note').textContent = j.nota   || '';
    document.getElementById('ai-r-cal').textContent  = j.kcal   + ' kcal estimadas';
    document.getElementById('ai-text-result').style.display = 'block';
  } catch(e) {
    console.error('estimateAI error:', e);
    alert('Error con Gemini AI: ' + e.message);
  }

  btn.disabled  = false;
  btn.innerHTML = '<span>✦</span> Estimar con Gemini AI';
}

async function confirmAI() {
  if (!aiPending) return;
  await addFoodDB({ name: aiPending.name, calories: aiPending.cal, moment: aiPending.moment, source: 'ai' });
  aiPending = null;
  document.getElementById('ai-desc').value            = '';
  document.getElementById('ai-text-result').style.display = 'none';
}

/* ── Photo analysis ── */
function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    photoB64 = ev.target.result.split(',')[1];
    document.getElementById('photo-prev').src           = ev.target.result;
    document.getElementById('photo-prev').style.display = 'block';
    document.getElementById('photo-zone').style.display   = 'none';
    document.getElementById('photo-btn').style.display    = 'flex';
    document.getElementById('photo-result').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function analyzePhoto() {
  if (!photoB64) { alert('Selecciona una imagen.'); return; }
  const btn = document.getElementById('photo-btn');
  btn.disabled  = true;
  btn.innerHTML = '<span>⏳</span> Analizando imagen...';

  try {
    const raw = await callGemini([
      { inline_data: { mime_type: 'image/jpeg', data: photoB64 } },
      { text: 'Eres nutricionista experto. Analiza esta foto de comida y responde SOLO en JSON válido sin backticks: {"kcal":número,"nombre":"nombre del plato","nota":"descripción breve de los alimentos identificados, máx 2 oraciones"}. Si no hay comida responde: {"error":"no es comida"}.' }
    ]);
    const j = JSON.parse(raw);
    if (j.error) {
      alert('No se detectó comida en la imagen. Intenta con otra foto.');
      btn.disabled = false; btn.innerHTML = '<span>✦</span> Analizar con Gemini AI';
      return;
    }
    photoPending = { name: j.nombre, cal: j.kcal, moment: document.getElementById('photo-moment').value };
    document.getElementById('ph-r-name').textContent  = j.nombre;
    document.getElementById('ph-r-note').textContent  = j.nota || '';
    document.getElementById('ph-r-cal').textContent   = j.kcal + ' kcal estimadas';
    document.getElementById('photo-result').style.display = 'block';
  } catch(e) {
    console.error('analyzePhoto error:', e);
    alert('Error al analizar la imagen: ' + e.message);
  }

  btn.disabled  = false;
  btn.innerHTML = '<span>✦</span> Analizar con Gemini AI';
}

async function confirmPhoto() {
  if (!photoPending) return;
  await addFoodDB({ name: photoPending.name, calories: photoPending.cal, moment: photoPending.moment, source: 'photo' });
  photoPending = null;
  resetPhoto();
}

function resetPhoto() {
  photoB64 = null; photoPending = null;
  document.getElementById('photo-prev').style.display    = 'none';
  document.getElementById('photo-zone').style.display    = 'block';
  document.getElementById('photo-btn').style.display     = 'none';
  document.getElementById('photo-result').style.display  = 'none';
  document.getElementById('photo-input').value           = '';
}

/* ══════════════════════════════
   WORKOUTS
══════════════════════════════ */
function pickType(el, type) {
  document.querySelectorAll('#type-chips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on'); wType = type; renderSugs(); calcDur();
}
function pickInt(el, i) {
  document.querySelectorAll('#int-chips .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on'); wInt = i; calcDur();
}
function renderSugs() {
  const el = document.getElementById('w-sugs');
  if (!el) return;
  el.innerHTML = (SUGS[wType] || [])
    .map(s => `<button class="sug" onclick="pickSug('${s.replace(/'/g,"\\'")}')">${s}</button>`)
    .join('');
}
function pickSug(s) { document.getElementById('w-name').value = s; }

function calcDur() {
  const h = parseInt(document.getElementById('w-hrs').value)  || 0;
  const m = parseInt(document.getElementById('w-mins').value) || 0;
  const total = h * 60 + m;
  const box   = document.getElementById('dur-total');
  const bburn = document.getElementById('burn-box');
  if (total > 0) {
    const parts = [];
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'min');
    box.textContent   = `⏱ ${parts.join(' ')} en total (${total} min)`;
    box.style.display = 'block';
    const est = Math.round(total * ((BURNS[wType] || {})[wInt] || 6));
    document.getElementById('burn-est-val').textContent = est + ' kcal';
    bburn.style.display = 'flex';
    document.getElementById('w-cal').value = est;
  } else {
    box.style.display   = 'none';
    bburn.style.display = 'none';
  }
}

async function addWorkout() {
  const name  = document.getElementById('w-name').value.trim();
  const h     = parseInt(document.getElementById('w-hrs').value)  || 0;
  const m     = parseInt(document.getElementById('w-mins').value) || 0;
  const dur   = h * 60 + m;
  const cal   = parseInt(document.getElementById('w-cal').value)  || 0;
  const notes = document.getElementById('w-notes').value.trim();
  if (!name || dur < 1) { alert('Ingresa la actividad y la duración.'); return; }
  const { data, error } = await sb.from('workouts')
    .insert({ user_id: USER.id, name, type: wType, intensity: wInt, duration_mins: dur, calories: cal, notes, logged_at: todayStr() })
    .select().single();
  if (!error) { WORKOUTS.push(data); renderWorkoutList(); renderDash(); }
  else { alert('Error: ' + error.message); return; }
  ['w-name','w-hrs','w-mins','w-cal','w-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('burn-box').style.display  = 'none';
  document.getElementById('dur-total').style.display = 'none';
}

async function delWorkout(id) {
  const { error } = await sb.from('workouts').delete().eq('id', id);
  if (!error) { WORKOUTS = WORKOUTS.filter(w => w.id !== id); renderWorkoutList(); renderDash(); }
}

/* ══════════════════════════════
   PROFILE
══════════════════════════════ */
function calcBMR(p) {
  const w = parseFloat(p.weight), h = parseFloat(p.height), a = parseInt(p.age);
  if (!w || !h || !a || !p.sex) return null;
  return Math.round(p.sex === 'M'
    ? 88.362 + 13.397*w + 4.799*h - 5.677*a
    : 447.593 + 9.247*w + 3.098*h - 4.330*a);
}
function calcTDEE(p) { const b = calcBMR(p); return b ? Math.round(b * parseFloat(p.activity || 1.55)) : null; }

function recalcBMR() {
  const p = {
    weight: document.getElementById('p-weight').value,
    height: document.getElementById('p-height').value,
    age:    document.getElementById('p-age').value,
    sex:    document.getElementById('p-sex').value,
    activity: document.getElementById('p-activity').value
  };
  const bmr = calcBMR(p), tdee = calcTDEE(p);
  document.getElementById('p-bmr-val').textContent  = bmr || '—';
  document.getElementById('p-s-age').textContent    = p.age    || '—';
  document.getElementById('p-s-weight').textContent = p.weight || '—';
  document.getElementById('p-s-height').textContent = p.height || '—';
  const mi = document.getElementById('p-calmeta');
  if (tdee && !mi.value) mi.placeholder = 'Sugerido: ' + tdee + ' kcal';
}

async function saveProfile() {
  const btn = document.querySelector('#sec-profile .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const payload = {};
  const name = document.getElementById('p-name').value.trim();
  const age  = parseInt(document.getElementById('p-age').value);
  const sex  = document.getElementById('p-sex').value;
  const wt   = parseFloat(document.getElementById('p-weight').value);
  const ht   = parseFloat(document.getElementById('p-height').value);
  const goal = document.getElementById('p-goal').value;
  const act  = parseFloat(document.getElementById('p-activity').value);
  const cal  = parseInt(document.getElementById('p-calmeta').value);

  if (name) payload.name     = name;
  if (age)  payload.age      = age;
  if (sex)  payload.sex      = sex;
  if (wt)   payload.weight   = wt;
  if (ht)   payload.height   = ht;
  if (goal) payload.goal     = goal;
  payload.activity            = act || 1.55;
  if (cal)  payload.cal_meta = cal;
  payload.updated_at          = new Date().toISOString();

  const { error } = await sb.from('profiles')
    .upsert({ id: USER.id, ...payload }, { onConflict: 'id' });

  if (!error) {
    PROFILE = { ...PROFILE, ...payload };
    renderProfileHero();
    renderDash();
    const banner = document.getElementById('save-banner');
    banner.style.display = 'block';
    setTimeout(() => banner.style.display = 'none', 2500);
  } else {
    console.error('saveProfile error:', error);
    alert('Error al guardar perfil:\n' + error.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar perfil'; }
}

function loadProfileForm() {
  const p = PROFILE;
  document.getElementById('p-name').value     = p.name     || '';
  document.getElementById('p-age').value      = p.age      || '';
  document.getElementById('p-sex').value      = p.sex      || '';
  document.getElementById('p-weight').value   = p.weight   || '';
  document.getElementById('p-height').value   = p.height   || '';
  document.getElementById('p-goal').value     = p.goal     || '';
  document.getElementById('p-activity').value = p.activity || '1.55';
  document.getElementById('p-calmeta').value  = p.cal_meta || '';
  renderProfileHero();
}

function renderProfileHero() {
  const p = PROFILE;
  const initials = p.name ? p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?';
  document.getElementById('p-avatar').textContent    = initials;
  document.getElementById('p-disp-name').textContent = p.name || 'Tu nombre';
  const gc = GOAL_PILL[p.goal] || 'pill-green';
  document.getElementById('p-disp-goal').innerHTML = p.goal
    ? `<span class="pill ${gc}">${p.goal}</span>`
    : '<span style="color:var(--text-hint)">Sin objetivo definido</span>';
  document.getElementById('p-s-age').textContent    = p.age    || '—';
  document.getElementById('p-s-weight').textContent = p.weight || '—';
  document.getElementById('p-s-height').textContent = p.height || '—';
  document.getElementById('p-bmr-val').textContent  = calcBMR(p) || '—';
}

/* ══════════════════════════════
   WEIGHT LOG
══════════════════════════════ */
async function logWeight() {
  const w = parseFloat(document.getElementById('w-today').value);
  if (!w || w < 30) { alert('Ingresa un peso válido.'); return; }
  const today = todayStr();
  const { error } = await sb.from('weight_log')
    .upsert({ user_id: USER.id, weight: w, logged_at: today }, { onConflict: 'user_id,logged_at' });
  if (!error) {
    WLOG = WLOG.filter(e => e.logged_at !== today);
    WLOG.unshift({ logged_at: today, weight: w });
    document.getElementById('w-today').value = '';
    renderWeightLog();
  } else { alert('Error: ' + error.message); }
}

function renderWeightLog() {
  const el = document.getElementById('weight-log');
  if (!WLOG.length) { el.innerHTML = '<div class="empty" style="padding:12px 0">Sin registros aún</div>'; return; }
  el.innerHTML = WLOG.slice(0,7).map((e,i) => {
    let diff = '';
    if (i < WLOG.length-1) {
      const d = (e.weight - WLOG[i+1].weight).toFixed(1);
      diff = parseFloat(d) > 0
        ? `<span class="diff-up">+${d}kg ↑</span>`
        : `<span class="diff-dn">${d}kg ↓</span>`;
    }
    return `<div class="wlog-row"><span class="wlog-date">${e.logged_at}</span><span class="wlog-val">${e.weight} kg ${diff}</span></div>`;
  }).join('');
}

/* ══════════════════════════════
   RENDER LISTS
══════════════════════════════ */
function renderFoodList() {
  const el    = document.getElementById('food-list');
  const total = FOODS.reduce((a,f) => a + f.calories, 0);
  document.getElementById('food-total').textContent = total + ' kcal';
  if (!FOODS.length) { el.innerHTML = '<div class="empty">Sin comidas registradas hoy</div>'; return; }
  const srcPill = {
    ai:    '<span class="pill pill-blue"  style="margin-left:6px">IA</span>',
    photo: '<span class="pill pill-amber" style="margin-left:6px">Foto</span>',
    search:'<span class="pill pill-green" style="margin-left:6px">OFF</span>'
  };
  el.innerHTML = FOODS.map(f => `
    <div class="item-row">
      <div>
        <div class="item-name">${f.name}${srcPill[f.source]||''}</div>
        <div class="item-sub">${f.moment}</div>
      </div>
      <div class="item-right">
        <span class="item-cal">${f.calories} kcal</span>
        <button class="del-btn" onclick="delFood(${f.id})">×</button>
      </div>
    </div>`).join('');
}

function renderWorkoutList() {
  const el = document.getElementById('workout-list');
  if (!WORKOUTS.length) { el.innerHTML = '<div class="empty" style="padding:20px 0">Sin entrenamientos hoy</div>'; return; }
  const iMap = { low:'Baja', med:'Media', high:'Alta' };
  el.innerHTML = WORKOUTS.map(w => `
    <div class="workout-item">
      <div class="workout-top">
        <div>
          <div class="workout-name">${w.name} <span class="pill pill-green" style="margin-left:6px">${w.type}</span></div>
          <div class="workout-meta">${iMap[w.intensity]||'Media'} intensidad</div>
        </div>
        <button class="del-btn" onclick="delWorkout(${w.id})">×</button>
      </div>
      ${w.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px">${w.notes}</div>` : ''}
      <div class="workout-stats">
        <div class="wstat">Duración: <strong>${fmtDur(w.duration_mins)}</strong></div>
        <div class="wstat">Quemado: <strong>${w.calories} kcal</strong></div>
      </div>
    </div>`).join('');
}

function fmtDur(mins) {
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins/60), m = mins%60;
  return h + 'h' + (m ? ' '+m+'min' : '');
}

/* ══════════════════════════════
   DASHBOARD
══════════════════════════════ */
function renderDash() {
  const consumed = FOODS.reduce((a,f) => a+f.calories, 0);
  const burned   = WORKOUTS.reduce((a,w) => a+w.calories, 0);
  const bmr      = calcBMR(PROFILE);
  const goal     = PROFILE.cal_meta || calcTDEE(PROFILE) || 2000;

  document.getElementById('d-consumed').textContent = consumed;
  document.getElementById('d-burned').textContent   = burned;
  document.getElementById('d-wcount').textContent   = WORKOUTS.length;
  const pctC = Math.min(100, Math.round(consumed/goal*100));
  const pctB = Math.min(100, Math.round(burned/Math.max(goal*0.4,1)*100));
  document.getElementById('d-bar-c').style.width = pctC+'%';
  document.getElementById('d-bar-b').style.width = pctB+'%';
  document.getElementById('d-pct-c').textContent = pctC;
  document.getElementById('d-dc').textContent    = consumed+' kcal';
  document.getElementById('d-db').textContent    = burned+' kcal';
  document.getElementById('d-dbmr').textContent  = bmr ? bmr+' kcal' : 'Completa tu perfil';
  document.getElementById('d-dmeta').textContent = goal+' kcal';

  const netEl = document.getElementById('d-net-val');
  const subEl = document.getElementById('d-net-sub');
  const hero  = document.getElementById('d-hero');
  if (bmr) {
    const net = consumed - burned - bmr;
    netEl.textContent = (net>0?'+':'')+net+' kcal';
    if (net > 200)       { subEl.textContent='Superávit — consumiste más de lo necesario'; netEl.style.color='var(--kx-red)'; hero.style.background='var(--kx-red-light)'; hero.style.borderColor='#E8AAAA'; }
    else if (net < -200) { subEl.textContent='Déficit — estás por debajo de tu gasto';      netEl.style.color=''; hero.style.background=''; hero.style.borderColor=''; }
    else                 { subEl.textContent='En balance — ¡vas muy bien hoy! 💪';           netEl.style.color=''; hero.style.background=''; hero.style.borderColor=''; }
  } else {
    netEl.textContent='—'; netEl.style.color='var(--text-hint)';
    subEl.textContent='Completa tu perfil para ver el balance';
    hero.style.background=''; hero.style.borderColor='';
  }

  document.getElementById('d-foods').innerHTML = !FOODS.length
    ? '<div class="empty">Sin comidas registradas</div>'
    : FOODS.slice(-4).map(f=>`<div class="item-row"><div><div class="item-name">${f.name}</div><div class="item-sub">${f.moment}</div></div><span class="item-cal">${f.calories} kcal</span></div>`).join('');

  document.getElementById('d-workouts').innerHTML = !WORKOUTS.length
    ? '<div class="empty">Sin entrenamientos</div>'
    : WORKOUTS.slice(-3).map(w=>`<div class="item-row"><div><div class="item-name">${w.name}</div><div class="item-sub">${w.type} · ${fmtDur(w.duration_mins)}</div></div><span class="item-cal" style="color:var(--kx-blue)">-${w.calories} kcal</span></div>`).join('');
}

/* ══════════════════════════════
   BOOT
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', initSession);
