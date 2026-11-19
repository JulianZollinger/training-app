// Kleine eigene SVG-Diagramme (keine Bibliothek nötig)
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
function fmtNum(v) {
  if (v === null || v === undefined || isNaN(v)) return "–";
  const a = Math.abs(v);
  return a >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const CH = { W: 600, m: { l: 42, r: 10, t: 14, b: 28 } };

function barChart(container, items, opt = {}) {
  container.innerHTML = "";
  const H = opt.height || 220, { m } = CH, W = Math.max(280, Math.round(container.clientWidth || CH.W)), iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg", role: "img", "aria-label": opt.label || "Balkendiagramm" });
  const max = niceMax(Math.max(...items.map(i => i.value), 0.0001));
  for (let i = 0; i <= 4; i++) {
    const y = m.t + ih - (ih * i) / 4;
    svg.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "grid" }));
    svg.append(svgEl("text", { x: m.l - 6, y: y + 4, class: "axis", "text-anchor": "end" }, fmtNum((max * i) / 4)));
  }
  const bw = iw / items.length, step = Math.ceil(items.length / Math.max(3, Math.floor(iw / 52)));
  items.forEach((it, i) => {
    const h = (ih * it.value) / max, x = m.l + i * bw + bw * 0.15;
    const r = svgEl("rect", { x, y: m.t + ih - h, width: bw * 0.7, height: Math.max(h, 0), rx: 3, fill: it.color || "var(--accent)" });
    r.append(svgEl("title", {}, `${it.label}: ${fmtNum(it.value)} ${opt.unit || ""}`));
    svg.append(r);
    if (items.length <= Math.floor(iw / 26) && it.value > 0) svg.append(svgEl("text", { x: x + bw * 0.35, y: m.t + ih - h - 4, class: "vlabel", "text-anchor": "middle" }, fmtNum(it.value)));
    if (i % step === 0) svg.append(svgEl("text", { x: x + bw * 0.35, y: H - 8, class: "axis", "text-anchor": "middle" }, it.label));
  });
  container.append(svg);
}

// series: [{name,color,dashed,data:[{label,y}|null y]}]  (alle gleich lang)
function lineChart(container, series, opt = {}) {
  container.innerHTML = "";
  const H = opt.height || 220, { m } = CH, W = Math.max(280, Math.round(container.clientWidth || CH.W)), iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = series[0].data.length;
  const ys = series.flatMap(s => s.data.map(d => d.y)).filter(y => y !== null && y !== undefined && !isNaN(y));
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg", role: "img", "aria-label": opt.label || "Liniendiagramm" });
  if (!ys.length || n < 2) { container.append(h("p", { class: "hint" }, "Keine Daten vorhanden.")); return; }
  let lo = opt.min ?? Math.min(...ys), hi = opt.max ?? Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; if (opt.min === undefined) lo -= pad; if (opt.max === undefined) hi += pad;
  const X = i => m.l + (iw * i) / (n - 1), Y = v => m.t + ih - (ih * (v - lo)) / (hi - lo);
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4, y = Y(v);
    svg.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "grid" }));
    svg.append(svgEl("text", { x: m.l - 6, y: y + 4, class: "axis", "text-anchor": "end" }, fmtNum(v)));
  }
  if (lo < 0 && hi > 0) svg.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: "zero" }));
  const step = Math.ceil(n / Math.max(3, Math.floor(iw / 62)));
  series[0].data.forEach((d, i) => { if (i % step === 0) svg.append(svgEl("text", { x: X(i), y: H - 8, class: "axis", "text-anchor": "middle" }, d.label)); });
  for (const s of series) {
    let path = "", pen = false;
    s.data.forEach((d, i) => {
      if (d.y === null || d.y === undefined || isNaN(d.y)) { pen = false; return; }
      path += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(d.y).toFixed(1)} `; pen = true;
    });
    svg.append(svgEl("path", { d: path, fill: "none", stroke: s.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-dasharray": s.dashed ? "5 4" : "none" }));
    if (n <= 40) s.data.forEach((d, i) => { if (d.y !== null && d.y !== undefined && !isNaN(d.y)) { const c = svgEl("circle", { cx: X(i), cy: Y(d.y), r: 3, fill: s.color }); c.append(svgEl("title", {}, `${s.name} ${d.label}: ${fmtNum(d.y)}`)); svg.append(c); } });
  }
  container.append(svg);
  const legend = h("div", { class: "legend" }, ...series.map(s => h("span", {}, h("i", { style: `background:${s.color}` }), s.name)));
  container.append(legend);
}

// Kleiner Helfer zum Erzeugen von HTML-Elementen (textContent => sicher)
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) { if (k === "class") e.className = props[k]; else e.setAttribute(k, props[k]); }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return e;
}
