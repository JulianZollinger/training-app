// Navigation + neue Ansichten (Heute, Kalender, Schlaf, VO2max, Kalorien, Timer, Einstellungen)
const GROUPS = {
  today: { title: "Heute", icon: "M4 11l8-7 8 7M6 10v10h12V10", subs: [["today", "Tagebuch"]] },
  training: { title: "Training", icon: "M3 12h4l3-8 4 16 3-8h4", subs: [["calendar", "Kalender"], ["list", "Aktivitäten"], ["compare", "Vergleich"], ["records", "Rekorde"], ["timer", "Timer"], ["gear", "Ausrüstung"]] },
  stats: { title: "Statistik", icon: "M5 20V10M12 20V4M19 20v-7", subs: [["overview", "Wochen"], ["fitness", "Form"], ["goals", "Ziele"], ["streak", "Serie"]] },
  body: { title: "Körper", icon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z", subs: [["sleep", "Schlaf"], ["recovery", "HRV & Puls"], ["vo2", "VO2max"], ["body", "Kalorien"]] },
  coach: { title: "Coach", icon: "M13 2L4 14h7l-1 8 9-12h-7z", subs: [["coach", "Coach"], ["insights", "Insights"], ["assistant", "KI"]] }
};
const RENDER = { today: renderToday, calendar: renderCalendar, list: renderList, compare: renderCompare, records: renderRecords, timer: renderTimer,
  overview: renderOverview, fitness: renderFitness, goals: renderGoals, sleep: renderSleep, recovery: renderRecovery, vo2: renderVo2, body: renderBody,
  coach: renderCoach, insights: renderInsights, assistant: renderAssistant, gear: renderGear, streak: renderStreak };
let group = "today", sub = "today", selDay = null, calMonth = null;
const kcalGoal = () => parseFloat(store.get("kcalGoal", "700")) || 700;
const iconSvg = d => { const s = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }); s.append(svgEl("path", { d })); return s; };

function buildNav() {
  const nav = $("bottomNav"); nav.innerHTML = "";
  for (const [g, G] of Object.entries(GROUPS)) {
    const b = h("button", { "data-g": g, "aria-label": G.title }, iconSvg(G.icon), h("span", {}, G.title));
    b.addEventListener("click", () => S && go(g)); nav.append(b);
  }
}
function go(g, s) {
  group = g; sub = s || (GROUPS[g].subs.find(x => x[0] === store.get("sub_" + g, ""))?.[0]) || GROUPS[g].subs[0][0];
  store.set("sub_" + g, sub); store.set("nav", g);
  document.querySelectorAll("#bottomNav button").forEach(b => b.classList.toggle("on", b.dataset.g === g));
  $("title").textContent = GROUPS[g].title;
  $("subtitle").textContent = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
  $("weeks").hidden = !["stats", "body"].includes(g);
  const seg = $("seg"); seg.innerHTML = ""; seg.hidden = GROUPS[g].subs.length < 2;
  for (const [id, label] of GROUPS[g].subs) { const b = h("button", { class: id === sub ? "on" : "", role: "tab" }, label); b.addEventListener("click", () => go(g, id)); seg.append(b); }
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== sub);
  RENDER[sub](); window.scrollTo(0, 0);
}

// ---------- Kachel-Baustein ----------
function tile(label, value, unit, sub, pct, o = {}) {
  return h("div", { class: "tile" + (o.dark ? " dark" : "") + (o.wide ? " wide" : "") }, h("div", { class: "tile-top" }, h("span", {}, label), o.action || ""),
    h("div", { class: "big" }, value, unit ? h("small", {}, unit) : ""), sub ? h("div", { class: "tile-sub" }, sub) : "", pct != null ? h("div", { class: "tbar" }, h("i", { style: `width:${clamp(pct)}%` })) : "");
}
const dayKey = a => a.start_date_local.slice(0, 10);

// ---------- Wochenplan (einmal pro Woche automatisch, gespeichert) ----------
function getWeekPlan(force) {
  const key = "plan_" + iso(weekStart(S.today));
  let p = null; try { p = JSON.parse(store.get(key, "null")); } catch (e) {}
  if (!p || force) { p = makeWeekPlan(S); store.set(key, JSON.stringify(p)); }
  return p;
}
function renderPlanCard() {
  const p = getWeekPlan(), todayKey = iso(S.today);
  const doneMin = date => S.activities.filter(a => dayKey(a) === date).reduce((s, a) => s + (a.moving_time || 0) / 60, 0);
  let planned = 0, done = 0;
  const rows = p.days.map(d => {
    let status = "";
    if (d.mins === 0) status = "frei";
    else if (d.date > todayKey) status = "geplant";
    else if (d.date < p.created) status = "–";
    else if (doneMin(d.date) >= d.mins * 0.5) status = "erledigt ✓";
    else status = d.date === todayKey ? "heute" : "verpasst";
    if (d.mins && d.date >= p.created) { planned += d.mins; if (d.date <= todayKey) done += Math.min(doneMin(d.date), d.mins); }
    const date = parseDay(d.date);
    return h("tr", { class: d.date === todayKey ? "now" : "" }, h("td", {}, date.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" })),
      h("td", {}, d.mins ? `${d.label} (${d.sport})` : d.label), h("td", { class: "num" }, d.mins ? d.mins + " min" : "–"), h("td", { class: "num" }, status));
  });
  const again = h("button", { class: "secondary" }, "Plan neu berechnen");
  again.addEventListener("click", () => { getWeekPlan(true); renderToday(); });
  return h("div", { class: "panel" },
    h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Tag"), h("th", {}, "Einheit"), h("th", { class: "num" }, "Dauer"), h("th", { class: "num" }, "Status"))), h("tbody", {}, ...rows)),
    h("div", { class: "tbar", style: "margin:.8rem 0 .3rem" }, h("i", { style: `width:${planned ? clamp((done / planned) * 100) : 0}%` })),
    h("p", { class: "hint" }, `${Math.round(done)} von ${planned} geplanten Minuten gemacht. Zielumfang der Woche: ca. ${fmtNum(p.targetH)} h (dein Schnitt der letzten 4 Wochen: ${fmtNum(p.avgH)} h). Erstellt am ${parseDay(p.created).toLocaleDateString("de-CH")}, Bereitschaft damals: ${p.readiness} (${p.status}).`), again);
}

// ---------- Heute ----------
function renderToday() {
  if (!selDay) selDay = new Date(S.today);
  const key = iso(selDay), isToday = key === iso(S.today), w = S.wellness[key] || {};
  const acts = S.activities.filter(a => dayKey(a) === key), tgt = sleepTarget();
  const prev = h("button", { class: "round", "aria-label": "Vorheriger Tag" }, "‹"), next = h("button", { class: "round", "aria-label": "Nächster Tag" }, "›");
  prev.addEventListener("click", () => { selDay = addDays(selDay, -1); renderToday(); });
  next.addEventListener("click", () => { selDay = addDays(selDay, 1); renderToday(); }); next.disabled = isToday;
  const nav = h("div", { class: "daynav" }, prev, h("div", { class: "lbl" }, isToday ? "Heute · " : "", selDay.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })), next);
  const sleepH = w.sleepSecs ? w.sleepSecs / 3600 : null;
  const burned = acts.reduce((s, a) => s + actKcal(a).v, 0), steps = w.steps ?? null, sGoal = parseFloat(store.get("stepGoal", "10000")) || 10000;
  const water = parseFloat(store.get("water_" + key, "0")) || 0, wGoal = parseFloat(store.get("waterGoal", "2500")) || 2500;
  const f = S.fitness.find(x => x.date === key);
  const plus = h("button", { class: "mini", "aria-label": "250 ml Wasser hinzufügen" }, "+250");
  plus.addEventListener("click", () => { store.set("water_" + key, water + 250); renderToday(); });
  const tiles = h("div", { class: "tiles" });
  if (isToday) { const a = analyze(S, tgt); tiles.append(tile("Bereitschaft", a.readiness, "/100", a.status, a.readiness)); }
  else tiles.append(tile("Form (TSB)", f ? fmtNum(f.tsb) : "–", "", f ? formStatus(f.tsb) : "", null));
  tiles.append(tile("Schlaf", sleepH ? sleepH.toFixed(1) : "–", "h", `von ${tgt} h`, sleepH ? (sleepH / tgt) * 100 : 0),
    tile("Aktiv-Kalorien", Math.round(burned), "kcal", `von ${kcalGoal()} kcal`, (burned / kcalGoal()) * 100),
    tile("Schritte", steps != null ? Math.round(steps).toLocaleString("de-CH") : "–", "", `von ${sGoal.toLocaleString("de-CH")}`, steps != null ? (steps / sGoal) * 100 : 0),
    tile("Wasser", water, "ml", `von ${wGoal} ml`, (water / wGoal) * 100, { action: plus }),
    tile("Ruhepuls", w.restingHR ?? "–", "bpm", w.hrv ? `HRV ${Math.round(w.hrv)} ms` : "", null, { dark: true }));
  const raceDate = store.get("raceDate", ""), raceName = store.get("raceName", "");
  if (raceDate) { const days = Math.ceil((new Date(raceDate + "T00:00:00") - S.today) / DAY);
    tiles.append(tile(raceName || "Wettkampf", days >= 0 ? days : "–", "Tage", days > 0 ? new Date(raceDate).toLocaleDateString("de-CH") : days === 0 ? "Heute ist es so weit!" : "vorbei", null, { dark: true })); }
  const parts = [nav, tiles];
  if (isToday) { const a = analyze(S, tgt); parts.push(h("h2", {}, "Empfehlung"), h("div", { class: "panel rec " + a.rec.level }, h("h3", {}, a.rec.title), h("p", {}, a.rec.text)), ...a.warnings.map(x => h("div", { class: "warn" }, x)), h("h2", {}, "Wochenplan"), renderPlanCard()); }
  parts.push(h("h2", {}, acts.length ? "Aktivitäten" : "Keine Aktivität"));
  if (acts.length) parts.push(h("div", { class: "grid" }, ...acts.map(a => { const c = h("button", { class: "card item " + tClass(a.type) }, h("small", { class: "hint" }, a.type), h("h3", {}, a.name || "Ohne Titel"), h("p", {}, actLine(a) + " · " + actKcal(a).v + (actKcal(a).est ? " kcal (geschätzt)" : " kcal"))); c.addEventListener("click", () => openDetail(a)); return c; })));
  else parts.push(h("p", { class: "hint" }, "An diesem Tag wurde nichts aufgezeichnet."));
  // Stimmung + Notiz
  const mood = store.get("mood_" + key, ""), moods = ["Mies", "Naja", "Okay", "Gut", "Top"];
  const mrow = h("div", { class: "moods" }, ...moods.map((m, i) => { const b = h("button", { class: String(i + 1) === mood ? "on" : "" }, m); b.addEventListener("click", () => { store.set("mood_" + key, String(i + 1)); renderToday(); }); return b; }));
  const note = h("textarea", { rows: "3", placeholder: "Notiz zum Tag …", "aria-label": "Tagesnotiz" }); note.value = store.get("daynote_" + key, ""); note.addEventListener("change", () => store.set("daynote_" + key, note.value));
  parts.push(h("h2", {}, "Wie fühlst du dich?"), mrow, h("div", { style: "margin-top:.6rem" }, note));
  setView("today", ...parts);
}

// ---------- Kalender ----------
function renderCalendar() {
  if (!calMonth) calMonth = new Date(S.today.getFullYear(), S.today.getMonth(), 1);
  const first = calMonth, last = new Date(first.getFullYear(), first.getMonth() + 1, 0), pad = (first.getDay() + 6) % 7;
  const p = h("button", { class: "round", "aria-label": "Vorheriger Monat" }, "‹"), n = h("button", { class: "round", "aria-label": "Nächster Monat" }, "›");
  p.addEventListener("click", () => { calMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1); renderCalendar(); });
  n.addEventListener("click", () => { calMonth = new Date(first.getFullYear(), first.getMonth() + 1, 1); renderCalendar(); });
  const cal = h("div", { class: "cal" }, ...["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => h("div", { class: "dow" }, d)));
  const planMap = {}; for (const d of getWeekPlan().days) planMap[d.date] = d;
  for (let i = 0; i < pad; i++) cal.append(h("div"));
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(first.getFullYear(), first.getMonth(), d), key = iso(date), acts = S.activities.filter(a => dayKey(a) === key), load = acts.reduce((s, a) => s + (a.icu_training_load || 0), 0);
    const future = date > S.today, planned = planMap[key] && planMap[key].mins ? planMap[key] : null;
    const b = h("button", { class: "day" + (key === iso(S.today) ? " today" : "") + (future ? " future" : ""), title: planned ? `Vorschlag: ${planned.label}, ${planned.mins} min` : "", style: !future && load ? `background:rgba(95,243,234,${Math.min(0.5, 0.08 + load / 400)})` : "" }, String(d),
      h("div", { class: "dots" }, ...acts.slice(0, 3).map(a => h("i", { style: `background:${tColor(a.type)}` })), planned && !acts.length ? h("i", { style: "background:transparent;border:1px solid var(--muted)" }) : ""));
    b.addEventListener("click", () => { selDay = date; go("today", "today"); }); cal.append(b);
  }
  const m = summarize(inRange(S.activities, first, last));
  setView("calendar", h("div", { class: "monthnav" }, p, h("b", {}, first.toLocaleDateString("de-CH", { month: "long", year: "numeric" })), n), cal,
    h("p", { class: "hint", style: "margin-top:.6rem" }, "Farbige Punkte = Aktivitäten, Hintergrund = Belastung. Hohler Punkt = Trainingsvorschlag des Coaches. Tippe auf einen Tag."),
    h("div", { class: "kpis", style: "margin-top:.8rem" }, kpi("Aktivitäten", m.n, ""), kpi("Distanz", fmtNum(m.km), "km"), kpi("Zeit", fmtNum(m.h), "h"), kpi("Load", fmtNum(m.load), "")),
    h("div", { class: "row" }, (() => { const b = h("button", { class: "secondary" }, "Kalender (.ics) exportieren"); b.addEventListener("click", exportIcs); return b; })()));
}

// ---------- Schlaf ----------
const PH = { deep: ["Tiefschlaf", "#3b5bdb"], rem: ["REM", "#b06cff"], light: ["Leichtschlaf", "#5ff3ea"], awake: ["Wach", "#ff9a3c"] };
function renderSleep() {
  const tgt = sleepTarget(), ws = wellnessSeries(S, 30), lab = w => parseDay(w.date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
  if (!ws.some(w => w.sleep !== null)) { setView("sleep", h("div", { class: "panel" }, h("h3", {}, "Keine Schlafdaten"), h("p", { class: "hint" }, "intervals.icu hat keine Schlafdaten. Verbinde in intervals.icu unter Settings → Connections z.B. Garmin, Oura, Whoop oder Polar."))); return; }
  const lastW = [...ws].reverse().find(w => w.sleep !== null), full = S.wellness[lastW.date] || {}, ph = sleepPhases(full), sleepH = lastW.sleep;
  const vals = ws.map(w => w.sleep).filter(v => v !== null), mean = avg(vals), sd = Math.sqrt(avg(vals.map(v => (v - mean) ** 2)));
  const debt = ws.slice(-7).reduce((s, w) => s + (w.sleep !== null ? Math.max(0, tgt - w.sleep) : 0), 0);
  const phaseBox = h("div", { class: "panel" }, h("h3", {}, "Schlafphasen letzte Nacht"));
  if (ph) { const tot = ph.deep + ph.rem + ph.light + ph.awake || 1;
    phaseBox.append(h("div", { class: "phasebar" }, ...Object.entries(PH).map(([k, [n, c]]) => h("i", { style: `width:${(ph[k] / tot) * 100}%;background:${c}`, title: `${n}: ${fmtDur(ph[k] * 3600)}` }))),
      h("div", { class: "legend" }, ...Object.entries(PH).map(([k, [n, c]]) => h("span", {}, h("i", { style: `background:${c}` }), `${n} ${fmtDur(ph[k] * 3600)} (${Math.round((ph[k] / tot) * 100)} %)`))),
      h("p", { class: "hint" }, "Als Richtwert: Tiefschlaf ca. 13–23 %, REM ca. 20–25 %."));
  } else phaseBox.append(h("p", { class: "hint" }, "Für diese Nacht liefert deine Quelle keine Schlafphasen. intervals.icu zeigt sie nur, wenn die Uhr oder App sie übermittelt."));
  const c1 = h("div"), c2 = h("div");
  setView("sleep",
    h("div", { class: "tiles" }, tile("Letzte Nacht", sleepH.toFixed(1), "h", `Ziel ${tgt} h`, (sleepH / tgt) * 100), tile("Schlafscore", lastW.score ?? "–", "", "von 100", lastW.score ?? 0),
      tile("Schlafschuld", fmtNum(debt), "h", "letzte 7 Tage", null, { dark: true }), tile("Regelmässigkeit", sd.toFixed(1), "h", "Abweichung (je kleiner, desto besser)", null, { dark: true })),
    h("div", { style: "margin-top:.8rem" }, phaseBox), h("h2", {}, "Letzte 30 Nächte"), h("div", { class: "panel" }, c1), h("h2", {}, "Schlaf und Erholung"), h("div", { class: "panel" }, c2));
  barChart(c1, ws.map(w => ({ label: lab(w), value: w.sleep || 0, color: w.sleep !== null && w.sleep < tgt ? "var(--warn)" : "var(--accent)" })), { unit: "h", wide: true });
  lineChart(c2, [{ name: "HRV", color: "var(--accent)", data: ws.map(w => ({ label: lab(w), y: w.hrv })) }, { name: "Schlafscore", color: "var(--accent2)", dashed: true, data: ws.map(w => ({ label: lab(w), y: w.score })) }], { height: 200, wide: true });
}

// ---------- VO2max ----------
function estimateVo2(state) {
  const A = state.activities.filter(a => a.type === "Run" && a.average_heartrate && km(a) > 2 && a.moving_time > 900);
  if (!A.length) return [];
  const hrMax = Math.max(parseFloat(store.get("hrMax", "0")) || 0, ...state.activities.map(a => a.max_heartrate || 0));
  const rhrs = Object.values(state.wellness).map(w => w.restingHR).filter(Boolean).sort((a, b) => a - b), rest = rhrs.length ? rhrs[Math.floor(rhrs.length / 2)] : 55;
  const pts = [];
  for (const a of A) {
    const v = (km(a) * 1000) / (a.moving_time / 60), vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v, frac = (a.average_heartrate - rest) / (hrMax - rest);
    if (frac > 0.55 && frac < 0.95) { const est = vo2 / frac; if (est > 25 && est < 85) pts.push({ date: dayKey(a), y: est }); }
  }
  const byWeek = {}; for (const p of pts) { const k = iso(weekStart(parseDay(p.date))); (byWeek[k] = byWeek[k] || []).push(p.y); }
  return Object.entries(byWeek).sort().map(([k, v]) => ({ date: k, y: avg(v) }));
}
function renderVo2() {
  const api = Object.entries(S.wellness).filter(([, w]) => w.vo2max).sort().map(([d, w]) => ({ date: d, y: w.vo2max })), est = estimateVo2(S);
  const cur = api.length ? api[api.length - 1].y : null, e = est.length ? est[est.length - 1].y : null, c = h("div");
  const first = api.length ? api[Math.max(0, api.length - 13)].y : null;
  setView("vo2", h("div", { class: "tiles" }, tile("VO2max (Uhr)", cur !== null ? cur.toFixed(1) : "–", "ml/kg/min", first && cur ? `${cur - first >= 0 ? "+" : ""}${(cur - first).toFixed(1)} in ca. 4 Wochen` : "", null),
    tile("VO2max (Schätzung)", e !== null ? e.toFixed(1) : "–", "ml/kg/min", "aus deinen Läufen", null, { dark: true })),
    h("h2", {}, "Verlauf"), h("div", { class: "panel" }, c),
    h("p", { class: "hint", style: "margin-top:.6rem" }, "„Uhr“ sind die Werte, die dein Gerät an intervals.icu liefert. Die Schätzung berechnet die Sauerstoffaufnahme aus Tempo und Herzfrequenz deiner Läufe. Sie ist ungenau und hängt von deiner maximalen Herzfrequenz ab (Einstellungen)."));
  if (!api.length && !est.length) { c.append(h("p", { class: "hint" }, "Keine VO2max-Daten und keine Läufe mit Herzfrequenz gefunden.")); return; }
  const dates = [...new Set([...api, ...est].map(p => p.date))].sort(), m1 = Object.fromEntries(api.map(p => [p.date, p.y])), m2 = Object.fromEntries(est.map(p => [p.date, p.y]));
  const lbl = d => parseDay(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
  lineChart(c, [{ name: "Uhr / API", color: "var(--accent)", data: dates.map(d => ({ label: lbl(d), y: m1[d] ?? null })) }, { name: "Schätzung (Läufe)", color: "var(--run)", dashed: true, data: dates.map(d => ({ label: lbl(d), y: m2[d] ?? null })) }], { height: 240, wide: true });
}

// ---------- Kalorien & Gewicht ----------
function renderBody() {
  const t = S.today, bmr = parseFloat(store.get("bmr", "1700")) || 1700, lab = d => d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)), actDay = d => S.activities.filter(a => dayKey(a) === iso(d)).reduce((s, a) => s + actKcal(a).v, 0);
  const intake = d => { const l = parseFloat(store.get("kcal_" + iso(d), "")); return !isNaN(l) ? l : (S.wellness[iso(d)]?.kcalConsumed ?? null); };
  const todayIn = intake(t), inp = h("input", { type: "number", min: "0", step: "10", placeholder: "kcal", value: todayIn ?? "", "aria-label": "Kalorien heute", style: "width:130px" });
  inp.addEventListener("change", () => { store.set("kcal_" + iso(t), inp.value); renderBody(); });
  const burnT = bmr + actDay(t), bal = todayIn != null ? todayIn - burnT : null;
  const wt = Object.entries(S.wellness).filter(([, w]) => w.weight).sort().slice(-90).map(([d, w]) => ({ label: lab(parseDay(d)), y: w.weight }));
  const c1 = h("div"), c2 = h("div"), c3 = h("div"), wk = summarize(inRange(S.activities, addDays(t, -6), t));
  const kc7 = inRange(S.activities, addDays(t, -6), t).reduce((s, a) => s + actKcal(a).v, 0);
  setView("body",
    h("div", { class: "tiles" }, tile("Verbrannt heute", Math.round(burnT), "kcal", `Grundumsatz ${bmr} + Aktiv ${actDay(t)}`, null), tile("Gegessen heute", todayIn ?? "–", "kcal", bal !== null ? `Bilanz ${bal >= 0 ? "+" : ""}${Math.round(bal)} kcal` : "unten eintragen", null, { dark: true }),
      tile("Aktiv (7 Tage)", Math.round(kc7), "kcal", `${wk.n} Einheiten`, null), tile("Gewicht", wt.length ? wt[wt.length - 1].y.toFixed(1) : "–", "kg", wt.length > 7 ? `${(wt[wt.length - 1].y - wt[wt.length - 8].y >= 0 ? "+" : "")}${(wt[wt.length - 1].y - wt[wt.length - 8].y).toFixed(1)} kg in 7 Tagen` : "", null, { dark: true })),
    h("p", { style: "margin-top:.8rem" }, "Heute gegessen: ", inp, h("span", { class: "hint" }, "  (nur in diesem Browser gespeichert)")),
    h("h2", {}, "Aktiv-Kalorien pro Tag"), h("div", { class: "panel" }, c1), h("h2", {}, "Gegessen und Verbrauch"), h("div", { class: "panel" }, c2), h("h2", {}, "Gewicht"), h("div", { class: "panel" }, c3),
    h("p", { class: "hint", style: "margin-top:.6rem" }, "Kalorien der Aktivitäten stammen aus intervals.icu. Fehlen sie, werden sie grob aus Dauer und Sportart geschätzt. Den Grundumsatz stellst du in den Einstellungen ein."));
  barChart(c1, days.map(d => ({ label: lab(d), value: actDay(d), color: "var(--run)" })), { unit: "kcal", wide: true });
  lineChart(c2, [{ name: "Verbrauch", color: "var(--run)", data: days.map(d => ({ label: lab(d), y: bmr + actDay(d) })) }, { name: "Gegessen", color: "var(--accent)", data: days.map(d => ({ label: lab(d), y: intake(d) })) }], { height: 200, wide: true });
  if (wt.length > 1) lineChart(c3, [{ name: "Gewicht (kg)", color: "var(--accent2)", data: wt }], { height: 200, wide: true }); else c3.append(h("p", { class: "hint" }, "Keine Gewichtsdaten gefunden."));
}

// ---------- Intervall-Timer ----------
const TM = { phases: [], i: 0, end: 0, running: false, timer: null, left: 0 };
function tmBuild() {
  const g = k => Math.max(0, parseInt(store.get("tm_" + k, { warm: "10", work: "30", rest: "15", rounds: "8" }[k])) || 0), P = [];
  if (g("warm")) P.push({ n: "Aufwärmen", s: g("warm"), k: "rest" });
  for (let r = 1; r <= g("rounds"); r++) { P.push({ n: `Belastung ${r}/${g("rounds")}`, s: g("work"), k: "work" }); if (r < g("rounds") && g("rest")) P.push({ n: "Pause", s: g("rest"), k: "rest" }); }
  TM.phases = P; TM.i = 0; TM.left = P[0] ? P[0].s : 0; TM.running = false; clearInterval(TM.timer);
}
function beep(f = 880, ms = 150) { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, ms); } catch (e) {} try { navigator.vibrate && navigator.vibrate(120); } catch (e) {} }
function tmDraw() {
  const p = TM.phases[TM.i]; if (!$("tmTime")) return;
  $("tmTime").textContent = p ? `${String(Math.floor(TM.left / 60)).padStart(2, "0")}:${String(TM.left % 60).padStart(2, "0")}` : "00:00";
  $("tmPhase").textContent = p ? p.n : "Fertig"; $("tmBox").className = "timer " + (p ? p.k : "");
  const total = TM.phases.reduce((s, x) => s + x.s, 0), done = TM.phases.slice(0, TM.i).reduce((s, x) => s + x.s, 0) + (p ? p.s - TM.left : 0);
  $("tmBar").style.width = total ? Math.min(100, (done / total) * 100) + "%" : "0"; $("tmGo").textContent = TM.running ? "Pause" : "Start";
}
function tmTick() {
  const left = Math.ceil((TM.end - Date.now()) / 1000);
  if (left !== TM.left) { TM.left = Math.max(0, left); if (TM.left > 0 && TM.left <= 3) beep(660, 80); }
  if (left <= 0) { TM.i++; if (TM.i >= TM.phases.length) { TM.running = false; clearInterval(TM.timer); beep(1200, 500); } else { TM.left = TM.phases[TM.i].s; TM.end = Date.now() + TM.left * 1000; beep(TM.phases[TM.i].k === "work" ? 1000 : 600, 300); } }
  tmDraw();
}
function renderTimer() {
  if (!TM.phases.length) tmBuild();
  const f = (k, label, def) => { const i = h("input", { type: "number", min: "0", value: store.get("tm_" + k, def), "aria-label": label }); i.addEventListener("change", () => { store.set("tm_" + k, i.value); tmBuild(); renderTimer(); }); return h("label", {}, label, i); };
  const go1 = h("button", { id: "tmGo", class: "primary bigbtn" }, "Start"), reset = h("button", { class: "secondary" }, "Zurücksetzen");
  go1.addEventListener("click", () => { if (!TM.phases.length) return; if (TM.i >= TM.phases.length) tmBuild(); TM.running = !TM.running; clearInterval(TM.timer); if (TM.running) { TM.end = Date.now() + TM.left * 1000; TM.timer = setInterval(tmTick, 250); beep(); } tmDraw(); });
  reset.addEventListener("click", () => { tmBuild(); tmDraw(); });
  setView("timer", h("div", { class: "panel timer", id: "tmBox" }, h("div", { id: "tmPhase", class: "ph" }), h("div", { id: "tmTime", class: "t" }), h("div", { class: "tbar", style: "margin:.6rem 0 1rem" }, h("i", { id: "tmBar" })), h("div", { class: "row", style: "justify-content:center;align-items:center" }, go1, reset)),
    h("div", { class: "fields" }, f("warm", "Aufwärmen (s)", "10"), f("work", "Belastung (s)", "30"), f("rest", "Pause (s)", "15"), f("rounds", "Runden", "8")),
    h("p", { class: "hint" }, "Intervall-Timer mit Signalton und Vibration. Der Timer läuft weiter, wenn du den Reiter wechselst."));
  tmDraw();
}

// ---------- Einstellungen ----------
function openSettings(msg) {
  const d = $("settings"), c = cfg(); d.innerHTML = "";
  const field = (label, key, def, type = "number", extra = {}) => { const i = h("input", { type, value: store.get(key, def), "aria-label": label, ...extra }); i.dataset.key = key; return [h("label", {}, label), i]; };
  const form = h("div", { class: "form" },
    msg ? h("div", { class: "info" }, msg) : "",
    h("h2", {}, "Einstellungen"),
    h("label", {}, "intervals.icu API-Key"), (() => { const i = h("input", { type: "password", value: store.get("apiKey", ""), placeholder: c.keyOk ? "(Key aus config.js wird verwendet)" : "API-Key einfügen", autocomplete: "off" }); i.dataset.key = "apiKey"; return i; })(),
    h("label", {}, "Athlete-ID (meist 0 oder i12345)"), (() => { const i = h("input", { type: "text", value: store.get("athleteId", ""), placeholder: c.ATHLETE_ID }); i.dataset.key = "athleteId"; return i; })(),
    ...field("Schlafziel (h)", "sleepTarget", "7.5", "number", { step: "0.25" }), ...field("Aktiv-Kalorien-Ziel pro Tag", "kcalGoal", "700"), ...field("Schrittziel", "stepGoal", "10000"),
    ...field("Wasserziel (ml)", "waterGoal", "2500"), ...field("Grundumsatz (kcal pro Tag)", "bmr", "1700"), ...field("Wettkampf (Name)", "raceName", "", "text"), ...field("Wettkampf (Datum)", "raceDate", "", "date"), ...field("Maximale Herzfrequenz (für VO2max-Schätzung, 0 = automatisch)", "hrMax", "0"));
  const save = h("button", { class: "primary" }, "Speichern"), close = h("button", { class: "secondary" }, "Abbrechen");
  const theme = h("button", { class: "secondary" }, "Hell / Dunkel"), ics = h("button", { class: "secondary" }, "Kalender .ics"), csv = h("button", { class: "secondary" }, "Export .csv"), wipe = h("button", { class: "secondary" }, "Lokale Daten löschen");
  save.addEventListener("click", async () => { form.querySelectorAll("input[data-key]").forEach(i => store.set(i.dataset.key, i.value.trim())); d.close(); await start(); });
  close.addEventListener("click", () => d.close());
  theme.addEventListener("click", () => { const r = document.documentElement, dark = (r.dataset.theme || "dark") === "dark"; r.dataset.theme = dark ? "light" : "dark"; store.set("theme", r.dataset.theme); });
  ics.addEventListener("click", () => S && exportIcs()); csv.addEventListener("click", () => S && exportCsv());
  wipe.addEventListener("click", () => { if (confirm("Alle lokal gespeicherten Daten (Notizen, Wasser, Key, Einstellungen) löschen?")) { try { localStorage.clear(); } catch (e) {} location.reload(); } });
  const loaded = S && S.activities.length ? `Geladen: ${S.activities.length} Aktivitäten vom ${fmtDate(S.activities[S.activities.length - 1].start_date_local)} bis ${fmtDate(S.activities[0].start_date_local)} und ${Object.keys(S.wellness).length} Tage Schlaf-/Wellnessdaten.` : "Noch keine Daten geladen.";
  d.append(form, h("p", { class: "hint" }, loaded), h("p", { class: "hint" }, "Der Key bleibt nur in diesem Browser. Gib die App nicht mit eingetragenem Key weiter und stelle keine config.js mit Key ins Internet."), h("div", { class: "row" }, save, close), h("div", { class: "row", style: "margin-top:.8rem" }, theme, ics, csv, wipe));
  d.showModal();
}

// ---------- Start ----------
async function start() {
  $("error").hidden = true; $("info").hidden = true; $("loading").hidden = false;
  try {
    const raw = await loadData();
    if (!raw.activities.length) throw new Error("Keine Aktivitäten im Zeitraum gefunden.");
    S = buildState(raw);
    if (S.note) { $("info").textContent = S.note; $("info").hidden = false; }
    getWeekPlan();                                   // neue Woche = neuer Plan (automatisch beim ersten Öffnen)
    selDay = null; calMonth = null; go(store.get("nav", "today") in GROUPS ? store.get("nav", "today") : "today");
  } catch (e) { $("error").textContent = "Fehler: " + e.message; $("error").hidden = false; document.querySelectorAll(".view").forEach(v => v.hidden = true); openSettings("Die Daten konnten nicht geladen werden. Prüfe API-Key und Athlete-ID."); }
  finally { $("loading").hidden = true; }
}
(function init() {
  const th = store.get("theme", ""); if (th) document.documentElement.dataset.theme = th;
  weeks = parseInt(store.get("weeks", "8")) || 8; $("weeks").value = String(weeks); buildNav();
  $("weeks").addEventListener("change", e => { weeks = parseInt(e.target.value); store.set("weeks", weeks); if (S) go(group, sub); });
  $("btnSettings").addEventListener("click", () => openSettings());
  $("saveNote").addEventListener("click", () => { $("saved").textContent = store.set("note_" + current.id, $("note").value) ? "Gespeichert." : "Speichern nicht möglich."; });
  $("closeDetail").addEventListener("click", () => $("detail").close());
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  start();
})();
