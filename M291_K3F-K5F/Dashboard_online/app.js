// Trainings-Dashboard – Oberfläche
let S = null;                       // State (Aktivitäten, Wellness, Fitness)
let weeks = 8;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};
const fmtDur = s => { const hh = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60); return hh ? `${hh} h ${mm} min` : `${mm} min`; };
const fmtDate = s => parseDay(s).toLocaleDateString("de-CH");
const fmtPace = a => { const p = a.moving_time / 60 / km(a); return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")} min/km`; };
const tClass = t => ["Run", "Ride", "Swim"].includes(t) ? t : "other";
const tColor = t => ({ Run: "var(--run)", Ride: "var(--ride)", Swim: "var(--swim)" }[t] || "var(--other)");
const sleepTarget = () => parseFloat(store.get("sleepTarget", "7.5")) || 7.5;
const actLine = a => `${km(a).toFixed(1)} km · ${fmtDur(a.moving_time || 0)} · Load ${a.icu_training_load ?? "–"}`;

function delta(cur, prev, inverse) {
  if (!prev) return null;
  const p = Math.round(((cur - prev) / prev) * 100), good = inverse ? p <= 0 : p >= 0;
  return h("span", { class: "chip " + (good ? "up" : "down") }, `${p >= 0 ? "▲" : "▼"} ${Math.abs(p)} %`);
}
function kpi(label, value, unit, d) { return h("div", { class: "kpi" }, h("small", {}, label), h("div", { class: "v" }, value, h("small", {}, " " + unit), d || "")); }
function panel(title, ...kids) { return h("div", { class: "panel" }, title ? h("h3", {}, title) : "", ...kids); }
function activityCard(a, big) {
  return h("div", { class: "card " + tClass(a.type) }, h("small", { class: "hint" }, `${fmtDate(a.start_date_local)} · ${a.type}`), h("h3", {}, a.name || "Ohne Titel"), h("p", {}, actLine(a)));
}
function setView(id, ...kids) { const v = $(id); v.innerHTML = ""; v.append(...kids); }

// ---------- Übersicht ----------
function renderOverview() {
  const t = S.today, A = S.activities;
  const cur = summarize(inRange(A, addDays(weekStart(t), -(weeks - 1) * 7), t));
  const prev = summarize(inRange(A, addDays(weekStart(t), -(2 * weeks - 1) * 7), addDays(weekStart(t), -weeks * 7 + 6)));
  const wk = weeklyBuckets(A, weeks, t);
  const kpis = h("div", { class: "kpis" },
    kpi("Aktivitäten", cur.n, "", delta(cur.n, prev.n)), kpi("Distanz", fmtNum(cur.km), "km", delta(cur.km, prev.km)),
    kpi("Zeit", fmtNum(cur.h), "h", delta(cur.h, prev.h)), kpi("Training Load", fmtNum(cur.load), "", delta(cur.load, prev.load)),
    kpi("Höhenmeter", fmtNum(cur.elev), "m", delta(cur.elev, prev.elev)));
  const c1 = h("div"), c2 = h("div"), c3 = h("div"), c4 = h("div");
  const byType = {}; for (const a of inRange(A, addDays(weekStart(t), -(weeks - 1) * 7), t)) byType[a.type] = (byType[a.type] || 0) + (a.moving_time || 0) / 3600;
  const heat = h("div", { class: "heat", "aria-label": "Trainingskalender" });
  const hs = addDays(weekStart(t), -51 * 7), loads = {};
  for (const a of A) { const k = a.start_date_local.slice(0, 10); loads[k] = (loads[k] || 0) + (a.icu_training_load || 0); }
  for (let i = 0; i < 52 * 7; i++) {
    const d = addDays(hs, i), l = loads[iso(d)] || 0, lv = l === 0 ? 0 : l < 40 ? 1 : l < 70 ? 2 : l < 100 ? 3 : 4;
    heat.append(h("div", { class: "cell l" + lv, title: `${d.toLocaleDateString("de-CH")}: Load ${Math.round(l)}` }));
  }
  setView("overview", kpis,
    h("div", { class: "grid2" }, panel("Letzte Aktivität", A[0] ? activityCard(A[0]) : h("p", {}, "Keine Daten")), panel("Sportarten (Stunden)", c4)),
    h("h2", {}, `Pro Woche (${weeks} Wochen)`),
    h("div", { class: "grid2" }, panel("Kilometer", c1), panel("Stunden", c2)), h("div", { style: "margin-top:1rem" }, panel("Training Load", c3)),
    h("h2", {}, "Trainingskalender (52 Wochen)"), panel("", heat, h("p", { class: "hint" }, "Je dunkler, desto höher der Training Load an dem Tag.")));
  barChart(c1, wk.map(w => ({ label: w.label, value: w.km })), { unit: "km" });
  barChart(c2, wk.map(w => ({ label: w.label, value: w.h })), { unit: "h", height: 200 });
  barChart(c3, wk.map(w => ({ label: w.label, value: w.load })), { unit: "Load", height: 200, wide: true });
  barChart(c4, Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: tColor(k) })), { unit: "h", height: 200 });
}

// ---------- Fitness & Form ----------
function renderFitness() {
  const days = weeks * 7, fs = S.fitness.slice(-days), f = S.fitness[S.fitness.length - 1];
  const lab = x => parseDay(x.date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
  const c1 = h("div"), c2 = h("div"), c3 = h("div");
  const prev7 = S.fitness[S.fitness.length - 8];
  setView("fitness",
    h("div", { class: "kpis" }, kpi("Fitness (CTL)", fmtNum(f.ctl), "", prev7 ? delta(f.ctl, prev7.ctl) : null), kpi("Müdigkeit (ATL)", fmtNum(f.atl), "", null),
      kpi("Form (TSB)", fmtNum(f.tsb), "", null), kpi("Ramp (7 Tage)", prev7 ? fmtNum(f.ctl - prev7.ctl) : "–", "CTL/Woche", null)),
    panel("Einordnung", h("p", {}, formStatus(f.tsb)), h("p", { class: "hint" }, "Fitness = Durchschnitt der Belastung über ca. 42 Tage. Müdigkeit = ca. 7 Tage. Form = Fitness − Müdigkeit. Negativ bedeutet: du trainierst gerade hart.")),
    h("h2", {}, "Fitness, Müdigkeit und Form"), panel("", c1),
    h("h2", {}, "Tägliche Belastung"), panel("", c2));
  lineChart(c1, [
    { name: "Fitness (CTL)", color: "var(--accent)", data: fs.map(x => ({ label: lab(x), y: x.ctl })) },
    { name: "Müdigkeit (ATL)", color: "var(--run)", data: fs.map(x => ({ label: lab(x), y: x.atl })) },
    { name: "Form (TSB)", color: "var(--good)", dashed: true, data: fs.map(x => ({ label: lab(x), y: x.tsb })) }], { height: 260, wide: true, label: "Fitness Verlauf" });
  barChart(c2, fs.slice(-Math.min(days, 56)).map(x => ({ label: lab(x), value: x.load })), { unit: "Load", wide: true });
}

// ---------- Erholung ----------
function renderRecovery() {
  const n = Math.min(weeks * 7, 60), ws = wellnessSeries(S, n), lab = w => parseDay(w.date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
  if (!ws.some(w => w.sleep !== null || w.hrv !== null || w.rhr !== null)) {
    setView("recovery", panel("Keine Wellness-Daten", h("p", {}, "Es wurden keine Schlaf-/HRV-/Ruhepuls-Daten gefunden. In intervals.icu musst du unter Settings → Connections z.B. Garmin, Oura oder Whoop verbinden oder Wellness-Daten selbst eintragen.")));
    return;
  }
  const target = sleepTarget(), last7 = ws.slice(-7), sl = last7.map(w => w.sleep).filter(v => v !== null);
  const debt = last7.reduce((s, w) => s + (w.sleep !== null ? Math.max(0, target - w.sleep) : 0), 0);
  const avg7 = (x, arr) => { const v = arr.map(w => w[x]).filter(q => q !== null); return v.length ? avg(v) : null; };
  const input = h("input", { type: "number", step: "0.25", min: "5", max: "11", value: target, "aria-label": "Schlafziel in Stunden", style: "width:90px" });
  input.addEventListener("change", () => { store.set("sleepTarget", input.value); renderRecovery(); renderCoach(); });
  const c1 = h("div"), c2 = h("div"), c3 = h("div");
  const ma = (x) => ws.map((w, i) => { const part = ws.slice(Math.max(0, i - 6), i + 1).map(q => q[x]).filter(v => v !== null); return { label: lab(w), y: part.length ? avg(part) : null }; });
  setView("recovery",
    h("div", { class: "kpis" }, kpi("Ø Schlaf (7 Tage)", fmtNum(avg7("sleep", last7)), "h"), kpi("Schlafschuld (7 Tage)", fmtNum(debt), "h"),
      kpi("Ø HRV (7 Tage)", fmtNum(avg7("hrv", last7)), "ms"), kpi("Ø Ruhepuls (7 Tage)", fmtNum(avg7("rhr", last7)), "bpm")),
    h("p", {}, "Schlafziel (Stunden): ", input),
    h("h2", {}, "Schlaf"), panel("", c1), h("div", { class: "grid2", style: "margin-top:1rem" }, panel("HRV (mit 7-Tage-Schnitt)", c2), panel("Ruhepuls (mit 7-Tage-Schnitt)", c3)));
  barChart(c1, ws.map(w => ({ label: lab(w), value: w.sleep || 0, color: w.sleep !== null && w.sleep < target ? "var(--warn)" : "var(--accent2)" })), { unit: "h", wide: true });
  lineChart(c2, [{ name: "HRV", color: "var(--accent)", data: ws.map(w => ({ label: lab(w), y: w.hrv })) }, { name: "7-Tage-Schnitt", color: "var(--muted)", dashed: true, data: ma("hrv") }], { height: 200 });
  lineChart(c3, [{ name: "Ruhepuls", color: "var(--bad)", data: ws.map(w => ({ label: lab(w), y: w.rhr })) }, { name: "7-Tage-Schnitt", color: "var(--muted)", dashed: true, data: ma("rhr") }], { height: 200 });
}

// ---------- Vergleich ----------
const PRESETS = {
  week: { label: "Diese Woche vs. letzte Woche", f: t => [[weekStart(t), t], [addDays(weekStart(t), -7), addDays(weekStart(t), -1)]] },
  w4: { label: "Letzte 4 Wochen vs. 4 Wochen davor", f: t => [[addDays(t, -27), t], [addDays(t, -55), addDays(t, -28)]] },
  month: { label: "Dieser Monat vs. letzter Monat", f: t => [[new Date(t.getFullYear(), t.getMonth(), 1), t], [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)]] }
};
let comparePreset = "w4", cmpA = null, cmpB = null;
function renderCompare() {
  const sel = h("select", { "aria-label": "Zeiträume vergleichen" }, ...Object.entries(PRESETS).map(([k, p]) => { const o = h("option", { value: k }, p.label); if (k === comparePreset) o.selected = true; return o; }));
  sel.addEventListener("change", () => { comparePreset = sel.value; renderCompare(); });
  const [pa, pb] = PRESETS[comparePreset].f(S.today), A = summarize(inRange(S.activities, ...pa)), B = summarize(inRange(S.activities, ...pb));
  const range = r => `${r[0].toLocaleDateString("de-CH")} – ${r[1].toLocaleDateString("de-CH")}`;
  const rows = [["Aktivitäten", "n", ""], ["Distanz", "km", "km"], ["Zeit", "h", "h"], ["Training Load", "load", ""], ["Höhenmeter", "elev", "m"], ["Ø Herzfrequenz", "hr", "bpm"]];
  const table = h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Kennzahl"), h("th", { class: "num" }, "Zeitraum A"), h("th", { class: "num" }, "Zeitraum B"), h("th", { class: "num" }, "Änderung"))),
    h("tbody", {}, ...rows.map(([n, k, u]) => h("tr", {}, h("td", {}, n), h("td", { class: "num" }, fmtNum(A[k]) + " " + u), h("td", { class: "num" }, fmtNum(B[k]) + " " + u), h("td", { class: "num" }, B[k] ? delta(A[k], B[k]) : "–")))));
  const cv = h("div");
  const types = [...new Set(S.activities.map(a => a.type))];
  const byT = r => Object.fromEntries(types.map(t => [t, inRange(S.activities, ...r).filter(a => a.type === t).reduce((s, a) => s + (a.moving_time || 0) / 3600, 0)]));
  const ta = byT(pa), tb = byT(pb);
  // Aktivitäten-Vergleich
  const list = S.activities.slice(0, 60), opt = (a, i, sel) => { const o = h("option", { value: a.id }, `${fmtDate(a.start_date_local)} · ${a.name}`); if (i === sel) o.selected = true; return o; };
  const idxA = cmpA ? list.findIndex(a => a.id === cmpA) : 0, idxB = cmpB ? list.findIndex(a => a.id === cmpB) : Math.min(1, list.length - 1);
  const sA = h("select", { "aria-label": "Aktivität 1" }, ...list.map((a, i) => opt(a, i, idxA))), sB = h("select", { "aria-label": "Aktivität 2" }, ...list.map((a, i) => opt(a, i, idxB)));
  const cmpBox = h("div");
  const fill = () => {
    cmpA = sA.value; cmpB = sB.value;
    const a = list.find(x => x.id === cmpA), b = list.find(x => x.id === cmpB), rows2 = [
      ["Sportart", x => x.type], ["Distanz", x => km(x).toFixed(2) + " km"], ["Dauer", x => fmtDur(x.moving_time || 0)],
      ["Tempo", x => x.type === "Run" && km(x) ? fmtPace(x) : x.moving_time && km(x) ? (km(x) / (x.moving_time / 3600)).toFixed(1) + " km/h" : "–"],
      ["Ø Herzfrequenz", x => x.average_heartrate ? Math.round(x.average_heartrate) + " bpm" : "–"], ["Höhenmeter", x => x.total_elevation_gain != null ? Math.round(x.total_elevation_gain) + " m" : "–"], ["Training Load", x => x.icu_training_load ?? "–"]];
    cmpBox.innerHTML = ""; if (a && b) cmpBox.append(h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, a.name), h("th", {}, b.name))), h("tbody", {}, ...rows2.map(([n, f]) => h("tr", {}, h("td", {}, n), h("td", {}, f(a)), h("td", {}, f(b)))))));
  };
  sA.addEventListener("change", fill); sB.addEventListener("change", fill);
  setView("compare", h("p", {}, sel), h("div", { class: "grid2" }, panel("Zeitraum A: " + range(pa), h("p", { class: "hint" }, "Vergleich mit B: " + range(pb)), table), panel("Stunden pro Sportart", cv)),
    h("h2", {}, "Zwei Aktivitäten vergleichen"), h("div", { class: "controls" }, sA, sB), panel("", cmpBox));
  const items = []; types.forEach(t => { items.push({ label: t + " A", value: ta[t], color: tColor(t) }); items.push({ label: t + " B", value: tb[t], color: "var(--muted)" }); });
  barChart(cv, items, { unit: "h", height: 220 });
  cv.append(h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--accent)" }), "A = farbig"), h("span", {}, h("i", { style: "background:var(--muted)" }), "B = grau")));
  fill();
}

// ---------- Coach ----------
function renderCoach() {
  const a = analyze(S, sleepTarget()), plan = weeklyPlan(S, a);
  const col = a.readiness >= 75 ? "var(--good)" : a.readiness >= 55 ? "var(--accent2)" : a.readiness >= 35 ? "var(--warn)" : "var(--bad)";
  const C = 2 * Math.PI * 52, ring = svgEl("svg", { viewBox: "0 0 130 130", class: "ring", role: "img", "aria-label": `Bereitschaft ${a.readiness} von 100` });
  ring.append(svgEl("circle", { cx: 65, cy: 65, r: 52, fill: "none", stroke: "var(--line)", "stroke-width": 12 }),
    svgEl("circle", { cx: 65, cy: 65, r: 52, fill: "none", stroke: col, "stroke-width": 12, "stroke-linecap": "round", "stroke-dasharray": `${(C * a.readiness) / 100} ${C}`, transform: "rotate(-90 65 65)" }),
    svgEl("text", { x: 65, y: 72, "text-anchor": "middle", "font-size": 30 }, String(a.readiness)));
  const bars = a.factors.map(f => h("div", { class: "bar-row" }, h("span", {}, f.name), h("div", {}, h("div", { class: "track" }, h("div", { class: "fill", style: `width:${Math.round(f.score)}%;background:${f.score >= 70 ? "var(--good)" : f.score >= 45 ? "var(--warn)" : "var(--bad)"}` })), h("small", { class: "hint" }, f.text))));
  const planTable = h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Tag"), h("th", {}, "Einheit"), h("th", { class: "num" }, "Dauer"))),
    h("tbody", {}, ...plan.days.map(d => h("tr", {}, h("td", {}, d.date.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" })), h("td", {}, d.mins ? `${d.label} (${d.sport})` : d.label), h("td", { class: "num" }, d.mins ? d.mins + " min" : "–")))));
  setView("coach",
    h("p", { class: "hint" }, "Der Coach arbeitet mit festen Regeln (Schlaf, HRV, Ruhepuls, Form, Belastung). Er ist keine echte KI und ersetzt keine Fachperson."),
    h("div", { class: "grid2" },
      panel("Bereitschaft heute", h("div", { class: "gauge" }, ring, h("div", {}, h("div", { class: "trophy" }, a.status), h("p", { class: "hint" }, `Erschöpfung: ${a.fatigue} / 100`)))),
      h("div", { class: "panel rec " + a.rec.level }, h("small", { class: "hint" }, "Empfehlung für heute"), h("h3", {}, a.rec.title), h("p", {}, a.rec.text))),
    a.warnings.length ? h("div", {}, h("h2", {}, "Hinweise"), ...a.warnings.map(w => h("div", { class: "warn" }, w))) : "",
    h("h2", {}, "Woraus sich die Bereitschaft ergibt"), panel("", ...bars, a.hasWellness ? "" : h("p", { class: "hint" }, "Ohne Schlaf-/HRV-Daten basiert die Einschätzung nur auf der Trainingsform.")),
    h("h2", {}, "Vorschlag für die nächsten 7 Tage"), panel("", planTable, h("p", { class: "hint" }, `Zielumfang ca. ${fmtNum(plan.targetH)} h (dein Schnitt der letzten Wochen: ${fmtNum(plan.avgH)} h).`)),
    h("h2", {}, "Wochen-Rückblick"), panel("", h("p", {}, weekReview(S))));
}

// ---------- Aktivitäten ----------
let current = null;
function renderList() {
  const search = h("input", { type: "search", placeholder: "Suchen …", "aria-label": "Suchen" });
  const types = [...new Set(S.activities.map(a => a.type))];
  const type = h("select", { "aria-label": "Sportart" }, h("option", { value: "all" }, "Alle Sportarten"), ...types.map(t => h("option", { value: t }, t)));
  const sort = h("select", { "aria-label": "Sortierung" }, h("option", { value: "date" }, "Datum (neu zuerst)"), h("option", { value: "distance" }, "Distanz"), h("option", { value: "load" }, "Training Load"), h("option", { value: "time" }, "Dauer"));
  const from = h("input", { type: "date", "aria-label": "Von" }), to = h("input", { type: "date", "aria-label": "Bis" });
  const count = h("p", { class: "hint" }), items = h("div", { class: "grid" });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = S.activities.filter(a => (type.value === "all" || a.type === type.value) && (!q || (a.name || "").toLowerCase().includes(q)) && (!from.value || a.start_date_local.slice(0, 10) >= from.value) && (!to.value || a.start_date_local.slice(0, 10) <= to.value));
    if (sort.value === "distance") shown.sort((a, b) => km(b) - km(a)); else if (sort.value === "load") shown.sort((a, b) => (b.icu_training_load || 0) - (a.icu_training_load || 0)); else if (sort.value === "time") shown.sort((a, b) => (b.moving_time || 0) - (a.moving_time || 0));
    count.textContent = `${shown.length} Aktivitäten`; items.innerHTML = "";
    for (const a of shown.slice(0, 120)) { const b = h("button", { class: "card item " + tClass(a.type) }, h("small", { class: "hint" }, `${fmtDate(a.start_date_local)} · ${a.type}`), h("h3", {}, a.name || "Ohne Titel"), h("p", {}, actLine(a))); b.addEventListener("click", () => openDetail(a)); items.append(b); }
  };
  [search, type, sort, from, to].forEach(e => e.addEventListener("input", draw));
  setView("list", h("div", { class: "controls" }, search, type, from, to, sort), count, items); draw();
}
function openDetail(a) {
  current = a; $("dTitle").textContent = a.name || "Ohne Titel"; const g = $("dInfo"); g.innerHTML = "";
  const rows = [["Datum", fmtDate(a.start_date_local)], ["Sportart", a.type], ["Distanz", km(a).toFixed(2) + " km"], ["Dauer", fmtDur(a.moving_time || 0)],
    ["Training Load", a.icu_training_load ?? "–"], ["Ø Herzfrequenz", a.average_heartrate ? Math.round(a.average_heartrate) + " bpm" : "–"], ["Max. Herzfrequenz", a.max_heartrate ? Math.round(a.max_heartrate) + " bpm" : "–"], ["Höhenmeter", a.total_elevation_gain != null ? Math.round(a.total_elevation_gain) + " m" : "–"]];
  for (const [k, v] of rows) g.append(h("span", {}, k), h("b", {}, v));
  $("note").value = store.get("note_" + a.id, ""); $("saved").textContent = ""; $("detail").showModal();
}

// ---------- Rekorde ----------
function recordCard(title, value, sub) { return h("div", { class: "card" }, h("h3", {}, title), h("p", { class: "trophy" }, value), h("small", { class: "hint" }, sub)); }
function renderRecords() {
  const A = S.activities, best = (arr, f) => arr.reduce((m, a) => (m === null || f(a) > f(m)) ? a : m, null), el = h("div", { class: "grid" });
  const runs = A.filter(a => a.type === "Run"), fast = best(runs.filter(a => km(a) >= 3), a => -(a.moving_time / km(a)));
  const lr = best(runs, km), lo = best(A, a => a.moving_time || 0), hd = best(A, a => a.icu_training_load || 0), lb = best(A.filter(a => a.type === "Ride"), km), el2 = best(A, a => a.total_elevation_gain || 0);
  const wk = weeklyBuckets(A, 52, S.today), tw = wk.reduce((m, w) => w.km > m.km ? w : m, wk[0]);
  if (lr) el.append(recordCard("Längster Lauf", km(lr).toFixed(1) + " km", `${lr.name} · ${fmtDate(lr.start_date_local)}`));
  if (fast) el.append(recordCard("Schnellster Lauf (ab 3 km)", fmtPace(fast), `${fast.name} · ${fmtDate(fast.start_date_local)}`));
  if (lb) el.append(recordCard("Längste Velofahrt", km(lb).toFixed(1) + " km", `${lb.name} · ${fmtDate(lb.start_date_local)}`));
  if (lo) el.append(recordCard("Längste Dauer", fmtDur(lo.moving_time), `${lo.name} · ${lo.type}`));
  if (hd && hd.icu_training_load) el.append(recordCard("Höchster Training Load", String(hd.icu_training_load), hd.name));
  if (el2 && el2.total_elevation_gain) el.append(recordCard("Meiste Höhenmeter", Math.round(el2.total_elevation_gain) + " m", el2.name));
  if (tw) el.append(recordCard("Stärkste Woche (12 Monate)", fmtNum(tw.km) + " km", "Woche ab " + tw.label));
  setView("records", h("p", { class: "hint" }, "Rekorde der letzten 12 Monate (soweit von der API geladen)."), el);
}

// ---------- Export ----------
function download(name, text, type) { const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob([text], { type })); l.download = name; l.click(); }
function exportIcs() {
  const pad = n => String(n).padStart(2, "0"), st = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//M291 Dashboard//DE"];
  for (const a of S.activities) { const s = new Date(a.start_date_local), e = new Date(s.getTime() + (a.moving_time || 0) * 1000);
    L.push("BEGIN:VEVENT", `UID:${a.id}@m291-dashboard`, `DTSTAMP:${st(new Date())}`, `DTSTART:${st(s)}`, `DTEND:${st(e)}`, `SUMMARY:${(a.name || a.type).replace(/[,;\n]/g, " ")}`, `DESCRIPTION:${a.type} ${km(a).toFixed(1)} km`, "END:VEVENT"); }
  L.push("END:VCALENDAR"); download("aktivitaeten.ics", L.join("\r\n"), "text/calendar");
}
function exportCsv() {
  const head = ["Datum", "Name", "Sportart", "Distanz_km", "Dauer_min", "Load", "HF_avg", "Hoehenmeter"];
  const rows = S.activities.map(a => [a.start_date_local.slice(0, 10), `"${(a.name || "").replace(/"/g, '""')}"`, a.type, km(a).toFixed(2), Math.round((a.moving_time || 0) / 60), a.icu_training_load ?? "", a.average_heartrate ?? "", a.total_elevation_gain ?? ""]);
  download("aktivitaeten.csv", [head, ...rows].map(r => r.join(";")).join("\n"), "text/csv");
}

