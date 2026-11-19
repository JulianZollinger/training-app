// Regelbasierter Coach: wertet Schlaf, HRV, Ruhepuls und Trainingslast aus.
// Das ist KEINE echte KI, sondern nachvollziehbare Wenn-dann-Regeln.
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

function wellnessSeries(state, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = iso(addDays(state.today, -i)), w = state.wellness[d] || {};
    out.push({ date: d, sleep: w.sleepSecs ? w.sleepSecs / 3600 : null, hrv: w.hrv ?? null, rhr: w.restingHR ?? null, score: w.sleepScore ?? null });
  }
  return out;
}

function analyze(state, sleepTarget) {
  const ws = wellnessSeries(state, 29), last = ws[ws.length - 1];
  const recent = x => avg(ws.slice(-3).map(w => w[x]).filter(v => v !== null));
  const base = x => avg(ws.slice(0, -3).map(w => w[x]).filter(v => v !== null));
  const f = state.fitness[state.fitness.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
  const factors = [];

  const sleepNow = last.sleep ?? ws.slice(-2).reverse().map(w => w.sleep).find(v => v !== null);
  if (sleepNow != null) factors.push({ name: "Schlaf", weight: 0.3, score: clamp((sleepNow / sleepTarget) * 100), text: `${sleepNow.toFixed(1)} h (Ziel ${sleepTarget} h)` });
  const hrvNow = recent("hrv"), hrvBase = base("hrv");
  if (hrvNow != null && hrvBase) { const r = hrvNow / hrvBase; factors.push({ name: "HRV", weight: 0.3, score: clamp(100 - (1 - r) * 300), text: `${Math.round(hrvNow)} vs. Ø ${Math.round(hrvBase)} (${r >= 1 ? "+" : ""}${Math.round((r - 1) * 100)} %)` }); }
  const rhrNow = recent("rhr"), rhrBase = base("rhr");
  if (rhrNow != null && rhrBase) { const diff = rhrNow - rhrBase; factors.push({ name: "Ruhepuls", weight: 0.15, score: clamp(100 - Math.max(0, diff) * 8), text: `${Math.round(rhrNow)} vs. Ø ${Math.round(rhrBase)} (${diff >= 0 ? "+" : ""}${diff.toFixed(1)})` }); }
  factors.push({ name: "Form (TSB)", weight: 0.25, score: clamp(((f.tsb + 30) / 40) * 100), text: `${fmtNum(f.tsb)} (Fitness ${fmtNum(f.ctl)}, Müdigkeit ${fmtNum(f.atl)})` });

  const wSum = factors.reduce((s, x) => s + x.weight, 0);
  const readiness = Math.round(factors.reduce((s, x) => s + x.score * x.weight, 0) / wSum);
  const status = readiness >= 75 ? "Frisch" : readiness >= 55 ? "Okay" : readiness >= 35 ? "Müde" : "Erschöpft";

  // Belastung
  const acts = state.activities, t = state.today;
  const load7 = summarize(inRange(acts, addDays(t, -6), t)).load;
  const load28 = summarize(inRange(acts, addDays(t, -27), t)).load;
  const acwr = load28 > 0 ? load7 / (load28 / 4) : null;
  const hardLast3 = inRange(acts, addDays(t, -2), t).filter(a => (a.icu_training_load || 0) >= 80).length;
  const warnings = [];
  if (acwr !== null && acwr > 1.5) warnings.push(`Die Belastung der letzten 7 Tage ist ${acwr.toFixed(2)}× so hoch wie dein 28-Tage-Schnitt (über 1.5 = erhöhtes Verletzungsrisiko).`);
  if (f.tsb < -30) warnings.push("Deine Form ist sehr tief (TSB unter −30): Du bist stark ermüdet.");
  if (sleepNow != null && sleepNow < 6) warnings.push("Du hast weniger als 6 Stunden geschlafen. Das bremst die Erholung.");
  if (hrvNow != null && hrvBase && hrvNow / hrvBase < 0.85) warnings.push("Deine HRV liegt deutlich unter deinem Durchschnitt. Mögliche Zeichen von Stress oder Erschöpfung.");
  if (rhrNow != null && rhrBase && rhrNow - rhrBase >= 5) warnings.push("Dein Ruhepuls ist deutlich erhöht. Gehe es ruhig an.");
  const sleepDebt = ws.slice(-7).reduce((s, w) => s + (w.sleep != null ? Math.max(0, sleepTarget - w.sleep) : 0), 0);
  if (sleepDebt > 5) warnings.push(`Schlafschuld der letzten 7 Tage: ${sleepDebt.toFixed(1)} h.`);

  // Empfehlung für heute
  let rec;
  if (readiness < 35) rec = { level: "rest", title: "Ruhetag", text: "Du bist erschöpft. Gönn dir Pause oder höchstens 20–30 Minuten Spaziergang bzw. Mobilität. Schlaf hat jetzt Priorität." };
  else if (readiness < 55) rec = { level: "easy", title: "Lockere Einheit", text: "45–60 Minuten ganz locker (Zone 1–2), du solltest dich dabei noch gut unterhalten können. Keine Intervalle." };
  else if (readiness < 75 || hardLast3 >= 2) rec = { level: "moderate", title: "Grundlagen-Einheit", text: hardLast3 >= 2 ? "Du hattest in den letzten 3 Tagen schon zwei harte Einheiten. Heute 60–90 Minuten Grundlage (Zone 2) statt Intensität." : "60–90 Minuten Grundlage (Zone 2), eventuell ein paar kurze Steigerungen am Schluss." };
  else rec = { level: "hard", title: "Qualitätseinheit möglich", text: "Du bist frisch. Heute passen Intervalle oder ein Tempolauf (Aufwärmen 15 Min, 4×5 Min zügig, Auslaufen)." };

  return { readiness, fatigue: 100 - readiness, status, factors, warnings, rec, load7, load28, acwr, form: f, sleepDebt,
    hasWellness: ws.some(w => w.sleep !== null || w.hrv !== null || w.rhr !== null) };
}

function formStatus(tsb) {
  if (tsb > 15) return "Sehr frisch (evtl. zu wenig Training)";
  if (tsb > 5) return "Frisch, bereit für Wettkampf/Qualität";
  if (tsb > -10) return "Neutral";
  if (tsb > -30) return "Produktiv ermüdet (Trainingsphase)";
  return "Überlastungsrisiko";
}

// 7-Tage-Vorschlag, skaliert auf dein bisheriges Training
function weeklyPlan(state, a) {
  const t = state.today;
  const weeks = weeklyBuckets(state.activities, 5, t).slice(0, 4);
  const avgH = avg(weeks.map(w => w.h).filter(x => x > 0)) || 4;
  const factor = a.readiness >= 55 ? 1.05 : a.readiness >= 35 ? 0.9 : 0.7;
  const target = avgH * factor;
  const byType = {}; for (const x of inRange(state.activities, addDays(t, -27), t)) byType[x.type] = (byType[x.type] || 0) + (x.moving_time || 0);
  const sport = Object.entries(byType).sort((x, y) => y[1] - x[1])[0]?.[0] || "Lauf";
  const names = { Run: "Lauf", Ride: "Velo", Swim: "Schwimmen" }, sp = names[sport] || sport;
  const pattern = { 1: ["Ruhetag / Mobilität", 0], 2: ["Qualität: Intervalle", .14], 3: ["Locker", .12], 4: ["Grundlage", .16], 5: ["Ruhetag", 0], 6: ["Lange Einheit", .26], 0: ["Locker", .12] };
  const sum = Object.values(pattern).reduce((s, p) => s + p[1], 0);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, i), p = pattern[d.getDay()];
    let [label, share] = p;
    if (i === 0) { label = a.rec.level === "rest" ? "Ruhetag" : a.rec.level === "hard" ? "Qualität: Intervalle" : a.rec.level === "easy" ? "Locker" : "Grundlage"; share = a.rec.level === "rest" ? 0 : (label === "Locker" ? .12 : label === "Grundlage" ? .16 : .14); }
    else if (label.startsWith("Qualität") && a.readiness < 55) label = "Locker (Qualität wegen Müdigkeit ersetzt)";
    const mins = Math.round(((share / sum) * target * 60) / 5) * 5;
    out.push({ date: d, label, sport: mins ? sp : "", mins });
  }
  return { days: out, targetH: target, avgH };
}

function weekReview(state) {
  const t = state.today, ws = weeklyBuckets(state.activities, 2, t), cur = ws[1], prev = ws[0];
  const d = (c, p) => p > 0 ? Math.round(((c - p) / p) * 100) : null;
  const dl = d(cur.load, prev.load), dh = d(cur.h, prev.h);
  const parts = [`Diese Woche: ${cur.n} Einheiten, ${fmtNum(cur.km)} km, ${fmtNum(cur.h)} h, Load ${fmtNum(cur.load)}.`];
  if (dl !== null) parts.push(`Gegenüber letzter Woche ${dl >= 0 ? "+" : ""}${dl} % Load und ${dh >= 0 ? "+" : ""}${dh} % Zeit.`);
  if (dl !== null && dl > 30) parts.push("Das ist ein grosser Sprung. Plane danach eine leichtere Woche ein.");
  else if (dl !== null && dl < -30) parts.push("Deutlich weniger als letzte Woche. Das passt, wenn es eine Erholungswoche war.");
  return parts.join(" ");
}

// Wochenplan Montag bis Sonntag. Wird einmal pro Woche erstellt (siehe getWeekPlan in nav.js).
function makeWeekPlan(state) {
  const t = state.today, mon = weekStart(t), sleep = parseFloat(lsGet("sleepTarget")) || 7.5;
  const a = analyze(state, sleep);
  const past = weeklyBuckets(state.activities, 4, addDays(mon, -1));            // die 4 Wochen vor dieser Woche
  const avgH = avg(past.map(w => w.h).filter(x => x > 0)) || 4;
  let factor = a.readiness >= 55 ? 1.05 : a.readiness >= 35 ? 0.9 : 0.7;        // müde = weniger Training
  if (a.acwr !== null && a.acwr > 1.5) factor = Math.min(factor, 0.85);         // zu schneller Anstieg = bremsen
  const target = avgH * factor;
  const byType = {};
  for (const x of inRange(state.activities, addDays(mon, -28), addDays(mon, -1))) byType[x.type] = (byType[x.type] || 0) + (x.moving_time || 0);
  const sport = Object.entries(byType).sort((x, y) => y[1] - x[1])[0]?.[0] || "Lauf";
  const sportName = { Run: "Lauf", Ride: "Velo", Swim: "Schwimmen" }[sport] || sport;
  const pattern = [["Ruhetag / Mobilität", 0], ["Qualität: Intervalle", .14], ["Locker", .12], ["Grundlage", .16], ["Ruhetag", 0], ["Lange Einheit", .26], ["Locker", .12]];  // Mo bis So
  const sum = pattern.reduce((s, p) => s + p[1], 0);
  const days = pattern.map(([label, share], i) => {
    if (label.startsWith("Qualität") && a.readiness < 55) label = "Locker (Qualität wegen Müdigkeit ersetzt)";
    const mins = Math.round(((share / sum) * target * 60) / 5) * 5;
    return { date: iso(addDays(mon, i)), label, sport: mins ? sportName : "", mins };
  });
  return { week: iso(mon), created: iso(t), targetH: target, avgH, readiness: a.readiness, status: a.status, days };
}
