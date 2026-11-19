// Auswertungen für Insights, Prognosen und Ziele (alles lokal berechnet)
function pearson(xs, ys) {
  const n = xs.length; if (n < 5) return null;
  const mx = avg(xs), my = avg(ys); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const fmtHMS = s => { s = Math.round(s); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0"); };

function buildInsights(state, sleepTarget) {
  const A = state.activities, t = state.today, out = [];
  const add = (level, title, text) => out.push({ level, title, text });
  const wk = weeklyBuckets(A, 12, t);

  // 1. Trend
  const l4 = avg(wk.slice(8).map(w => w.load)), p4 = avg(wk.slice(4, 8).map(w => w.load));
  if (p4 > 0) { const d = Math.round(((l4 - p4) / p4) * 100);
    add(d > 40 ? "warn" : "info", "Trend der Belastung", `In den letzten 4 Wochen war dein Load im Schnitt ${d >= 0 ? "+" : ""}${d} % gegenüber den 4 Wochen davor.${d > 40 ? " Das ist ein schneller Anstieg, Verletzungsgefahr beachten." : d < -25 ? " Du trainierst deutlich weniger als zuvor." : " Das ist ein gleichmässiger Verlauf."}`); }

  // 2. Konstanz
  const active = wk.filter(w => w.n >= 3).length;
  add(active >= 9 ? "good" : "info", "Konstanz", `In ${active} von 12 Wochen hast du mindestens 3 Mal trainiert. ${active >= 9 ? "Sehr regelmässig!" : "Regelmässigkeit bringt mehr als einzelne harte Wochen."}`);

  // 3. Serien (Tage in Folge) + Ruhetage
  const days = new Set(A.map(a => a.start_date_local.slice(0, 10)));
  let streak = 0, d = new Date(t); if (!days.has(iso(d))) d = addDays(d, -1); while (days.has(iso(d))) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0; for (let i = HISTORY_DAYS; i >= 0; i--) { if (days.has(iso(addDays(t, -i)))) { run++; best = Math.max(best, run); } else run = 0; }
  const restPerWeek = avg(wk.slice(8).map(w => 7 - new Set(inRange(A, w.start, addDays(w.start, 6)).map(a => a.start_date_local.slice(0, 10))).size));
  add(restPerWeek < 1 ? "warn" : "info", "Serien und Ruhetage", `Aktuelle Serie: ${streak} Tage in Folge, längste Serie im Verlauf: ${best} Tage. Ruhetage pro Woche (letzte 4 Wochen): ${fmtNum(restPerWeek)}.${restPerWeek < 1 ? " Plane mindestens einen freien Tag pro Woche ein." : ""}`);

  // 4. Intensitätsverteilung
  const recent = inRange(A, addDays(t, -55), t).filter(a => a.moving_time > 0 && a.icu_training_load != null);
  const tot = { easy: 0, mod: 0, hard: 0 };
  for (const a of recent) { const i = a.icu_training_load / (a.moving_time / 3600); tot[i < 45 ? "easy" : i < 70 ? "mod" : "hard"] += a.moving_time; }
  const sum = tot.easy + tot.mod + tot.hard;
  if (sum) { const pe = Math.round((tot.easy / sum) * 100), ph = Math.round((tot.hard / sum) * 100);
    add(ph > 30 ? "warn" : pe >= 70 ? "good" : "info", "Intensitätsverteilung (8 Wochen)", `${pe} % locker, ${100 - pe - ph} % mittel, ${ph} % hart (geschätzt aus Load pro Stunde). Als Faustregel gelten ca. 80 % locker und 20 % hart.${ph > 30 ? " Du trainierst eher zu oft hart." : pe < 60 ? " Mehr lockere Einheiten würden die Erholung verbessern." : ""}`); }

  // 5. Wochentage
  const byDow = Array.from({ length: 7 }, () => []); for (const w of wk) for (let i = 0; i < 7; i++) byDow[i].push(summarize(inRange(A, addDays(w.start, i), addDays(w.start, i))).load);
  const names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], means = byDow.map(avg), top = means.indexOf(Math.max(...means)), low = means.indexOf(Math.min(...means));
  add("info", "Deine Trainingstage", `Am meisten trainierst du am ${names[top]} (Ø Load ${fmtNum(means[top])}), am wenigsten am ${names[low]} (Ø Load ${fmtNum(means[low])}).`);

  // 6. Schlaf und HRV
  const xs = [], ys = [];
  for (let i = 0; i < 120; i++) { const w = state.wellness[iso(addDays(t, -i))]; if (w && w.sleepSecs && w.hrv) { xs.push(w.sleepSecs / 3600); ys.push(w.hrv); } }
  const r = pearson(xs, ys);
  if (r !== null) add("info", "Schlaf und HRV", `Zusammenhang zwischen Schlafdauer und HRV: r = ${r.toFixed(2)}. ${r > 0.3 ? "Mehr Schlaf geht bei dir mit besserer Erholung (höhere HRV) einher." : r < -0.1 ? "Bei dir ist kein klarer positiver Zusammenhang erkennbar." : "Der Zusammenhang ist schwach."}`);
  const ws = wellnessSeries(state, 14).map(w => w.sleep).filter(v => v !== null);
  if (ws.length >= 5) { const a = avg(ws); add(a < sleepTarget - 0.5 ? "warn" : "good", "Schlaf", `Durchschnitt der letzten 14 Tage: ${a.toFixed(1)} h (Ziel ${sleepTarget} h).`); }

  // 7. Belastungssprünge
  const spikes = []; for (let i = 3; i < wk.length; i++) { const base = avg(wk.slice(i - 3, i).map(w => w.load)); if (base > 0 && wk[i].load > base * 1.3) spikes.push(`Woche ab ${wk[i].label} (+${Math.round((wk[i].load / base - 1) * 100)} %)`); }
  if (spikes.length) add("warn", "Belastungssprünge", "Wochen mit über 30 % mehr Load als der Schnitt der 3 Wochen davor: " + spikes.join(", ") + ".");

  // 8. Längster Lauf Entwicklung
  const lr = (a, b) => Math.max(0, ...inRange(A, a, b).filter(x => x.type === "Run").map(km));
  const l1 = lr(addDays(t, -27), t), l0 = lr(addDays(t, -55), addDays(t, -28));
  if (l1 && l0) add("info", "Längster Lauf", `Letzte 4 Wochen: ${l1.toFixed(1)} km, davor: ${l0.toFixed(1)} km.`);
  return out;
}

// Riegel-Formel: T2 = T1 * (D2 / D1) ^ 1.06
function racePredictions(state) {
  const runs = inRange(state.activities, addDays(state.today, -90), state.today).filter(a => a.type === "Run" && km(a) >= 3 && a.moving_time > 0);
  if (!runs.length) return null;
  const best = runs.reduce((m, a) => a.moving_time / km(a) < m.moving_time / km(m) ? a : m);
  const d1 = km(best), t1 = best.moving_time;
  const targets = [["5 km", 5], ["10 km", 10], ["Halbmarathon", 21.0975], ["Marathon", 42.195]];
  return { base: best, rows: targets.map(([n, d]) => { const T = t1 * Math.pow(d / d1, 1.06); return { name: n, time: T, pace: T / 60 / d }; }) };
}

function forecast(state, loads) {
  const f = state.fitness[state.fitness.length - 1]; let ctl = f.ctl, atl = f.atl;
  const out = [{ label: "Heute", ctl, atl, tsb: ctl - atl }];
  loads.forEach((l, i) => { ctl += (l - ctl) / 42; atl += (l - atl) / 7; out.push({ label: addDays(state.today, i + 1).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }), ctl, atl, tsb: ctl - atl }); });
  return out;
}

function monthlyBuckets(acts, today) {
  const out = [];
  for (let i = 11; i >= 0; i--) { const s = new Date(today.getFullYear(), today.getMonth() - i, 1), e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    out.push({ label: s.toLocaleDateString("de-CH", { month: "short" }), ...summarize(inRange(acts, s, e)) }); }
  return out;
}
