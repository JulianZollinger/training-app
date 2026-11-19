// Daten von intervals.icu laden + Berechnungen
const DAY = 864e5;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = s => new Date(s.slice(0, 10) + "T00:00:00");
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const HISTORY_DAYS = 365;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
// Einstellungen: zuerst aus der App (Zahnrad), sonst aus config.js
function cfg() {
  const B = typeof CONFIG !== "undefined" ? CONFIG : {};
  const key = (lsGet("apiKey") || B.API_KEY || "").trim();
  const id = (lsGet("athleteId") || B.ATHLETE_ID || "0").trim();
  return { API_KEY: key, ATHLETE_ID: id, keyOk: key !== "" && !key.includes("HIER_DEIN") };
}
function apiBase() { return `https://intervals.icu/api/v1/athlete/${cfg().ATHLETE_ID}`; }
function apiHeaders() { return { Authorization: "Basic " + btoa("API_KEY:" + cfg().API_KEY) }; }
function actKcal(a) {
  if (a.calories > 0) return { v: Math.round(a.calories), est: false };
  const rate = { Run: 650, Ride: 500, Swim: 450 }[a.type] || 400;
  return { v: Math.round(((a.moving_time || 0) / 3600) * rate), est: true };
}
function sleepPhases(w) {
  if (!w) return null;
  const g = (...k) => { for (const x of k) if (w[x] != null) return w[x] / 3600; return null; };
  const deep = g("sleepDeepSecs", "deepSleepSecs", "deepSecs"), rem = g("sleepRemSecs", "remSleepSecs", "remSecs"),
    light = g("sleepLightSecs", "lightSleepSecs", "lightSecs"), awake = g("sleepAwakeSecs", "awakeSleepSecs", "awakeSecs");
  if (deep === null && rem === null && light === null) return null;
  return { deep: deep || 0, rem: rem || 0, light: light || 0, awake: awake || 0 };
}
async function apiGet(path) {
  let res;
  try { res = await fetch(apiBase() + path, { headers: apiHeaders() }); }
  catch (e) { throw new Error("Keine Verbindung zu intervals.icu (" + e.message + "). Mögliche Ursachen: kein Internet, Browser blockiert die Anfrage (CORS) oder ein Werbeblocker/Adblocker. Öffne mit F12 die Konsole für Details. Abgefragt: " + path.split("?")[0]); }
  if (!res.ok) {
    const hint = res.status === 401 ? " – API-Key prüfen" : res.status === 403 ? " – Zugriff verweigert" : res.status === 404 ? " – Athlete-ID/URL prüfen" : "";
    throw new Error(`Status ${res.status} (${res.statusText})${hint}`);
  }
  return res.json();
}

// Nur die Felder behalten, die die App braucht (spart Speicher)
const ACT_FIELDS = ["id", "name", "type", "start_date_local", "distance", "moving_time", "icu_training_load", "average_heartrate", "max_heartrate", "total_elevation_gain", "calories"];
const WELL_FIELDS = ["id", "sleepSecs", "sleepScore", "hrv", "restingHR", "steps", "weight", "vo2max", "ctl", "atl", "kcalConsumed",
  "sleepDeepSecs", "sleepRemSecs", "sleepLightSecs", "sleepAwakeSecs", "deepSleepSecs", "remSleepSecs", "lightSleepSecs", "awakeSleepSecs"];
const pick = (o, fields) => { const r = {}; for (const f of fields) if (o[f] != null) r[f] = o[f]; return r; };

// Das Jahr in Etappen von ca. 3 Monaten laden (sicherer als eine riesige Anfrage)
async function getRange(path, from, to, label) {
  const out = [], seen = new Set(), total = Math.ceil((to - from) / DAY / 92);
  let n = 0;
  for (let start = new Date(from); start <= to; start = addDays(start, 92)) {
    n++; const el = document.getElementById("loading"); if (el) el.textContent = `Lade ${label} (${n}/${total}) …`;
    const end = new Date(Math.min(addDays(start, 91).getTime(), to.getTime()));
    const part = await apiGet(`${path}?oldest=${iso(start)}&newest=${iso(end)}`);
    if (!Array.isArray(part)) throw new Error("Unerwartete Antwort (kein JSON-Array).");
    for (const x of part) { const k = x.id ?? JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  }
  return out;
}

async function loadData() {
  if (!cfg().keyOk) throw new Error("Es ist noch kein API-Key eingetragen.");
  const to = new Date(), from = addDays(to, -HISTORY_DAYS);
  try {
    const acts = await getRange("/activities", from, to, "Aktivitäten");
    let wellness = [], note = "";
    try { wellness = await getRange("/wellness", from, to, "Schlaf-Daten"); }
    catch (e) { note = "Schlaf-/HRV-Daten konnten nicht geladen werden: " + e.message; }
    const data = { activities: acts.map(a => pick(a, ACT_FIELDS)), wellness: wellness.map(w => pick(w, WELL_FIELDS)), note, time: Date.now() };
    try { localStorage.setItem("cache", JSON.stringify(data)); } catch (e) {}      // für den Notfall merken
    return data;
  } catch (e) {
    const old = loadCache();                                                       // Fehler: zuletzt geladene Daten nehmen
    if (!old) throw e;
    old.note = `Die Verbindung hat nicht geklappt (${e.message}). Gezeigt werden die Daten vom ${new Date(old.time).toLocaleString("de-CH")}.`;
    return old;
  }
}
function loadCache() { try { return JSON.parse(localStorage.getItem("cache")); } catch (e) { return null; } }

// ---- Fitness (CTL/ATL/TSB) aus Aktivitäten berechnet, falls Wellness keine Werte hat ----
function computeFitness(activities, from, to) {
  const load = {};
  for (const a of activities) { const k = a.start_date_local.slice(0, 10); load[k] = (load[k] || 0) + (a.icu_training_load || 0); }
  const out = []; let ctl = 0, atl = 0;
  const first = new Date(Math.min(parseDay(activities[activities.length - 1]?.start_date_local || iso(from)), from));
  for (let d = first; d <= to; d = addDays(d, 1)) {
    const l = load[iso(d)] || 0;
    ctl += (l - ctl) / 42; atl += (l - atl) / 7;
    out.push({ date: iso(d), ctl, atl, tsb: ctl - atl, load: l });
  }
  return out;
}

function buildState(raw) {
  const acts = raw.activities.filter(a => a.start_date_local)
    .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  const wMap = {};
  for (const w of raw.wellness) if (w.id) wMap[String(w.id).slice(0, 10)] = w;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const calc = acts.length ? computeFitness(acts, addDays(today, -HISTORY_DAYS), today) : [];
  const fitness = calc.map(f => {
    const w = wMap[f.date];
    const ctl = w && w.ctl != null ? w.ctl : f.ctl, atl = w && w.atl != null ? w.atl : f.atl;
    return { date: f.date, ctl, atl, tsb: ctl - atl, load: f.load };
  });
  return { activities: acts, wellness: wMap, fitness, today, note: raw.note || "" };
}

// ---- Auswertungen ----
const km = a => (a.distance || 0) / 1000;
function summarize(acts) {
  const hrs = acts.filter(a => a.average_heartrate);
  return {
    n: acts.length,
    km: acts.reduce((s, a) => s + km(a), 0),
    h: acts.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600,
    load: acts.reduce((s, a) => s + (a.icu_training_load || 0), 0),
    elev: acts.reduce((s, a) => s + (a.total_elevation_gain || 0), 0),
    hr: hrs.length ? hrs.reduce((s, a) => s + a.average_heartrate, 0) / hrs.length : null
  };
}
const inRange = (acts, from, to) => acts.filter(a => { const d = parseDay(a.start_date_local); return d >= from && d <= to; });
function weeklyBuckets(acts, weeks, today) {
  const start = addDays(weekStart(today), -(weeks - 1) * 7), out = [];
  for (let i = 0; i < weeks; i++) {
    const s = addDays(start, i * 7), e = addDays(s, 6);
    out.push({ start: s, label: s.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }), ...summarize(inRange(acts, s, e)) });
  }
  return out;
}
