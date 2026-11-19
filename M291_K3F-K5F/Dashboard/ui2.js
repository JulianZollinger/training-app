// Zusätzliche Reiter: Insights, Prognosen & Ziele, Assistent
function renderInsights() {
  const list = buildInsights(S, sleepTarget());
  setView("insights",
    h("p", { class: "hint" }, "Automatische Auswertung deiner Daten der letzten Monate. Die Regeln laufen lokal in deinem Browser."),
    h("div", { class: "grid2" }, ...list.map(i => h("div", { class: "panel rec " + (i.level === "warn" ? "easy" : i.level === "good" ? "hard" : "moderate") }, h("h3", {}, i.title), h("p", {}, i.text)))));
}

let scenario = "normal";
function renderGoals() {
  const t = S.today, A = S.activities;
  // Ziele
  const wGoal = parseFloat(store.get("goalWeek", "40")) || 40, yGoal = parseFloat(store.get("goalYear", "1500")) || 1500;
  const weekKm = summarize(inRange(A, weekStart(t), t)).km, ytd = summarize(inRange(A, new Date(t.getFullYear(), 0, 1), t)).km;
  const dayOfYear = Math.floor((t - new Date(t.getFullYear(), 0, 1)) / DAY) + 1, proj = (ytd / dayOfYear) * 365;
  const inp = (key, val) => { const i = h("input", { type: "number", min: "1", value: val, style: "width:110px", "aria-label": key }); i.addEventListener("change", () => { store.set(key, i.value); renderGoals(); }); return i; };
  const bar = (v, goal) => h("div", { class: "track" }, h("div", { class: "fill", style: `width:${Math.min(100, (v / goal) * 100)}%;background:${v >= goal ? "var(--good)" : "var(--accent)"}` }));
  // Prognose
  const pred = racePredictions(S);
  const predTable = pred ? h("div", {}, h("p", { class: "hint" }, `Basis: ${pred.base.name}, ${km(pred.base).toFixed(1)} km in ${fmtHMS(pred.base.moving_time)} (${fmtDate(pred.base.start_date_local)}). Schätzung nach der Riegel-Formel, nur ein grober Richtwert.`),
    h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Distanz"), h("th", { class: "num" }, "Zeit"), h("th", { class: "num" }, "Tempo"))),
      h("tbody", {}, ...pred.rows.map(r => h("tr", {}, h("td", {}, r.name), h("td", { class: "num" }, fmtHMS(r.time)), h("td", { class: "num" }, `${Math.floor(r.pace)}:${String(Math.round((r.pace % 1) * 60)).padStart(2, "0")} min/km`)))))) : h("p", { class: "hint" }, "Für eine Prognose braucht es einen Lauf über 3 km in den letzten 90 Tagen.");
  // Szenarien
  const avgDay = (summarize(inRange(A, addDays(t, -27), t)).load / 28) || 30;
  const SC = { rest: ["Ruhe", 0], easy: ["Locker", avgDay * 0.6], normal: ["Normal", avgDay], hard: ["Hart", avgDay * 1.5] };
  const btns = h("div", { class: "controls" }, ...Object.entries(SC).map(([k, [n]]) => { const b = h("button", { class: k === scenario ? "primary" : "secondary" }, n); b.addEventListener("click", () => { scenario = k; renderGoals(); }); return b; }));
  const fc = forecast(S, Array(7).fill(SC[scenario][1])), c1 = h("div"), c2 = h("div"), c3 = h("div");
  setView("goals",
    h("h2", {}, "Ziele"),
    h("div", { class: "grid2" },
      panel("Wochenziel (km)", h("p", {}, inp("goalWeek", wGoal), ` km · bisher ${fmtNum(weekKm)} km`), bar(weekKm, wGoal)),
      panel("Jahresziel (km)", h("p", {}, inp("goalYear", yGoal), ` km · bisher ${fmtNum(ytd)} km`), bar(ytd, yGoal), h("p", { class: "hint" }, `Hochrechnung bis Jahresende: ${fmtNum(proj)} km (${proj >= yGoal ? "Ziel erreichbar" : "es fehlen ca. " + fmtNum(yGoal - proj) + " km"}).`))),
    h("h2", {}, "Rennprognose"), panel("", predTable),
    h("h2", {}, "Was wäre, wenn? Form der nächsten 7 Tage"), btns,
    h("p", { class: "hint" }, `Szenario „${SC[scenario][0]}": ca. ${fmtNum(SC[scenario][1])} Load pro Tag.`), panel("", c1),
    h("h2", {}, "Monatsübersicht (12 Monate)"), h("div", { class: "grid2" }, panel("Kilometer pro Monat", c2), panel("Stunden pro Monat", c3)));
  lineChart(c1, [{ name: "Fitness", color: "var(--accent)", data: fc.map(x => ({ label: x.label, y: x.ctl })) }, { name: "Müdigkeit", color: "var(--run)", data: fc.map(x => ({ label: x.label, y: x.atl })) }, { name: "Form", color: "var(--good)", dashed: true, data: fc.map(x => ({ label: x.label, y: x.tsb })) }], { height: 220, wide: true });
  const mb = monthlyBuckets(A, t);
  barChart(c2, mb.map(m => ({ label: m.label, value: m.km })), { unit: "km", height: 200 });
  barChart(c3, mb.map(m => ({ label: m.label, value: m.h, color: "var(--accent2)" })), { unit: "h", height: 200 });
}

// ---------- Claude-Assistent (optional, eigener Anthropic-Key) ----------
function dataSummary() {
  const a = analyze(S, sleepTarget()), t = S.today, f = a.form;
  return JSON.stringify({
    heute: iso(t), bereitschaft: a.readiness, status: a.status, empfehlung_regelbasiert: a.rec.title,
    form: { fitness_ctl: Math.round(f.ctl), muedigkeit_atl: Math.round(f.atl), form_tsb: Math.round(f.tsb) },
    belastung_7d: Math.round(a.load7), belastung_28d: Math.round(a.load28), acwr: a.acwr ? +a.acwr.toFixed(2) : null, schlafschuld_7d_h: +a.sleepDebt.toFixed(1),
    wochen: weeklyBuckets(S.activities, 8, t).map(w => ({ ab: iso(w.start), n: w.n, km: Math.round(w.km), h: +w.h.toFixed(1), load: Math.round(w.load) })),
    letzte_aktivitaeten: S.activities.slice(0, 8).map(x => ({ datum: x.start_date_local.slice(0, 10), name: x.name, typ: x.type, km: +km(x).toFixed(1), min: Math.round((x.moving_time || 0) / 60), load: x.icu_training_load })),
    wellness_7d: wellnessSeries(S, 7).map(w => ({ tag: w.date, schlaf_h: w.sleep ? +w.sleep.toFixed(1) : null, hrv: w.hrv, ruhepuls: w.rhr }))
  });
}
function renderAssistant() {
  const key = h("input", { type: "password", placeholder: "Anthropic API-Key (sk-ant-…)", value: store.get("anthropicKey", ""), "aria-label": "Anthropic API-Key", autocomplete: "off" });
  const model = h("input", { type: "text", value: store.get("anthropicModel", "claude-sonnet-4-5"), "aria-label": "Modellname", style: "width:220px" });
  const q = h("textarea", { rows: "3", placeholder: "Frage an den Coach, z.B. Wie soll ich diese Woche trainieren? Bin ich übertrainiert?" }); q.value = store.get("lastQ", "");
  const out = h("div", { class: "panel" }, h("p", { class: "hint" }, "Hier erscheint die Antwort."));
  const send = h("button", { class: "primary" }, "Fragen");
  const clear = h("button", { class: "secondary" }, "Key löschen");
  clear.addEventListener("click", () => { store.set("anthropicKey", ""); key.value = ""; });
  send.addEventListener("click", async () => {
    if (!key.value.trim()) { out.textContent = "Bitte zuerst deinen Anthropic API-Key eintragen."; return; }
    store.set("anthropicKey", key.value.trim()); store.set("anthropicModel", model.value.trim()); store.set("lastQ", q.value);
    out.textContent = "Claude denkt nach …"; send.disabled = true;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key.value.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: model.value.trim(), max_tokens: 700,
          system: "Du bist ein erfahrener Ausdauer-Coach. Antworte auf Deutsch, kurz und konkret (max. 200 Wörter), beziehe dich auf die gelieferten Trainingsdaten. Gib keine medizinischen Diagnosen; bei Schmerzen oder Krankheitszeichen verweise auf Fachpersonen.",
          messages: [{ role: "user", content: `Meine Trainingsdaten (JSON):\n${dataSummary()}\n\nFrage: ${q.value || "Wie soll ich in den nächsten Tagen trainieren?"}` }] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status}: ${data.error?.message || res.statusText}`);
      out.textContent = (data.content || []).map(c => c.text || "").join("\n");
      out.style.whiteSpace = "pre-wrap";
    } catch (e) { out.textContent = "Fehler: " + e.message; } finally { send.disabled = false; }
  });
  setView("assistant",
    h("div", { class: "info" }, "Optional: Dieser Reiter sendet eine Zusammenfassung deiner Trainingsdaten (Wochenwerte, letzte Aktivitäten, Schlaf, HRV) an die Anthropic-API. Dafür brauchst du einen eigenen Anthropic API-Key (kostet etwas). Der Key bleibt nur in deinem Browser gespeichert. Nutze ihn nicht auf fremden Computern."),
    h("div", { class: "controls" }, key, model, clear), q, h("div", { class: "row", style: "margin:.5rem 0" }, send), out);
}
