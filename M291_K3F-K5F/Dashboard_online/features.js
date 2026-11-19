// Neue Reiter: Ausrüstung (Schuhe/Velo) und Serie (Wochen-Konstanz)
function loadGear() { try { return JSON.parse(store.get("gear", "[]")) || []; } catch (e) { return []; } }

function renderGear() {
  const gear = loadGear(), A = S.activities;
  const save = () => { store.set("gear", JSON.stringify(gear)); renderGear(); };
  const rows = gear.map((g, i) => {
    const used = A.filter(a => (g.type === "Alle" || a.type === g.type) && dayKey(a) >= g.since).reduce((s, a) => s + km(a), 0);
    const total = g.start + used, pct = (total / g.max) * 100;
    const color = pct >= 100 ? "var(--bad, #ff5d5d)" : pct >= 80 ? "var(--warn, #f5b942)" : "var(--accent)";
    const del = h("button", { class: "secondary" }, "Löschen");
    del.addEventListener("click", () => { if (confirm(`"${g.name}" löschen?`)) { gear.splice(i, 1); save(); } });
    const msg = pct >= 100 ? "Zeit für Ersatz." : pct >= 80 ? "Bald fällig." : "Alles gut.";
    return h("div", { class: "panel" }, h("h3", {}, g.name),
      h("p", {}, `${total.toFixed(0)} von ${g.max} km (${g.type}) – ${msg}`),
      h("div", { class: "track" }, h("div", { class: "fill", style: `width:${Math.min(100, pct)}%;background:${color}` })), del);
  });
  const name = h("input", { type: "text", placeholder: "z. B. Laufschuhe Nike", "aria-label": "Name" });
  const start = h("input", { type: "number", min: "0", value: "0", style: "width:90px", "aria-label": "Start-km" });
  const max = h("input", { type: "number", min: "1", value: "700", style: "width:90px", "aria-label": "Max-km" });
  const type = h("select", { "aria-label": "Typ" }, ...["Run", "Ride", "Walk", "Alle"].map(t => h("option", { value: t }, t)));
  const add = h("button", { class: "primary" }, "Hinzufügen");
  add.addEventListener("click", () => {
    if (!name.value.trim()) return;
    gear.push({ name: name.value.trim(), type: type.value, start: parseFloat(start.value) || 0, max: parseFloat(max.value) || 700, since: iso(S.today) });
    save();
  });
  setView("gear",
    h("h2", {}, "Ausrüstung"),
    h("p", { class: "hint" }, "Zählt die Kilometer deiner Schuhe oder deines Velos ab heute. Schon gelaufene Kilometer trägst du bei «Start-km» ein."),
    ...(rows.length ? rows : [h("p", { class: "hint" }, "Noch nichts eingetragen.")]),
    h("div", { class: "panel" }, h("h3", {}, "Neu"), h("div", { class: "controls" }, name, type),
      h("div", { class: "controls" }, h("label", {}, "Start-km "), start, h("label", {}, " Max-km "), max), add));
}

function renderStreak() {
  const A = S.activities, goal = parseInt(store.get("weekSessions", "3")) || 3, mon = weekStart(S.today);
  const weeks = [];
  for (let i = 51; i >= 0; i--) {
    const from = addDays(mon, -7 * i), n = inRange(A, from, addDays(from, 6)).length;
    weeks.push({ from, n, ok: n >= goal });
  }
  let cur = 0, best = 0, run = 0;
  weeks.forEach((w, i) => { if (w.ok) { run++; best = Math.max(best, run); } else if (i < weeks.length - 1) run = 0; });
  for (let i = weeks.length - 1; i >= 0; i--) { if (weeks[i].ok) cur++; else if (i === weeks.length - 1) continue; else break; }
  const days30 = new Set(inRange(A, addDays(S.today, -29), S.today).map(dayKey)).size;
  const input = h("input", { type: "number", min: "1", max: "14", value: goal, style: "width:80px", "aria-label": "Einheiten pro Woche" });
  input.addEventListener("change", () => { store.set("weekSessions", input.value); renderStreak(); });
  const boxes = weeks.map(w => h("div", { title: `${w.from.toLocaleDateString("de-CH")}: ${w.n} Einheiten`,
    style: `width:14px;height:14px;border-radius:3px;background:${w.ok ? "var(--accent)" : w.n ? "rgba(95,243,234,.3)" : "rgba(255,255,255,.1)"}` }));
  setView("streak",
    h("h2", {}, "Serie"),
    h("div", { class: "tiles" }, tile("Aktuelle Serie", cur, "Wochen", `mit mind. ${goal} Einheiten`), tile("Längste Serie", best, "Wochen", "im letzten Jahr", null, { dark: true }),
      tile("Aktive Tage", days30, "von 30", "letzte 30 Tage", (days30 / 30) * 100)),
    h("div", { class: "panel" }, h("h3", {}, "Letzte 52 Wochen"), h("div", { style: "display:flex;flex-wrap:wrap;gap:4px" }, ...boxes),
      h("p", { class: "hint" }, "Hell = Ziel erreicht, blass = trainiert, grau = Pause. Die laufende Woche bricht die Serie nicht.")),
    h("div", { class: "controls" }, h("label", {}, "Ziel: Einheiten pro Woche "), input));
}
