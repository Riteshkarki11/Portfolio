'use strict';
/* Valuation Lab front end. All figures come from /api/analyze; nothing is computed or invented here
   except layout (scales, shading) and plain restatements of API numbers. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = {
  n: v => v == null ? '–' : nf0.format(Math.round(v)),
  rs: v => v == null ? '–' : (v < -0.5 ? '−₹' + nf0.format(Math.round(-v)) : '₹' + nf0.format(Math.abs(v) < 0.5 ? 0 : Math.round(v))),
  rs2: v => v == null ? '–' : (v < 0 ? '−₹' + nf2.format(-v) : '₹' + nf2.format(v)),
  pct: (v, d = 1) => v == null ? '–' : (v * 100).toFixed(d) + '%',
  spct: (v, d = 0) => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%',
  x: v => v == null ? '–' : v.toFixed(2) + 'x',
  fy: iso => 'Mar-' + iso.slice(2, 4),
  date: iso => { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); },
  cc: v => Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + 'L' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0),
};

const S = { universe: [], status: null, market: null, sym: null, tab: 'overview', data: null, prices: null, params: {}, seq: 0, error: null,
  peers: null, peersSym: null, pf: { symbols: [], years: 3, mu_method: 'capm', max_weight: 0.25, result: null, pick: 'Maximum Sharpe' },
  rk: { symbols: [], years: 3, confidence: 0.95, horizon: 1, value: 1000000, source: 'equal', result: null } };

/* ---------------------------------------------------------------- API */
const STATIC = !!window.__STATIC__;   // true on the published snapshot: answers come from saved files, not a server
function staticUrl(path) {
  const p = path.split('?')[0];
  let m;
  if (p === '/api/status') return 'data/status.json';
  if (p === '/api/universe') return 'data/universe.json';
  if (p === '/api/market') return 'data/market.json';
  if (p === '/api/business') return 'data/business.json';
  if ((m = p.match(/^\/api\/business\/([^/]+)\/(reverse|sotp)$/))) return `data/business/${m[1].toUpperCase()}.${m[2]}.json`;
  if ((m = p.match(/^\/api\/(analyze|prices|peers|business)\/([^/]+)$/))) return `data/${m[1]}/${decodeURIComponent(m[2]).toUpperCase().replace('.NS', '')}.json`;
  return null;
}
async function api(path) {
  if (STATIC) { const u = staticUrl(path); if (!u) throw new Error('This feature runs on your own computer, not on the published snapshot.'); path = u; }
  const r = await fetch(path);
  let body = null;
  try { body = await r.json(); } catch (_) { /* non-JSON error */ }
  if (STATIC && r.ok && body && body.error && body.kind) { const e = new Error(body.error); e.kind = body.kind; e.status = 404; e.body = body; throw e; }
  if (STATIC && !r.ok) { const e = new Error(body?.error || 'This company is not part of the published snapshot. The full tool runs on your own computer.'); e.kind = 'not_found'; e.status = r.status; e.body = body; throw e; }
  if (!r.ok) { const e = new Error(body?.error || body?.detail || `Request failed (${r.status})`); e.kind = body?.kind; e.status = r.status; e.body = body; throw e; }
  return body;
}
function qs(p) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined) q.set(k, v);
  return q.toString();
}

/* ---------------------------------------------------------------- charts (plain SVG) */
function niceTicks(lo, hi, n = 4) {
  if (hi === lo) { hi = lo + 1; }
  const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const t0 = Math.floor(lo / step) * step, out = [];
  for (let t = t0; t <= hi + step * 0.001; t += step) out.push(+t.toFixed(10));
  return out;
}
function lineChart(points, { w = 640, h = 210, fmtY = v => fmt.n(v), ref = null } = {}) {
  if (!points || points.length < 2) return '<p class="muted small">Not enough data for a chart.</p>';
  const m = { l: 52, r: 14, t: 12, b: 26 };
  const ys = points.map(p => p[1]).filter(v => v != null);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (ref) { lo = Math.min(lo, ref.value); hi = Math.max(hi, ref.value); }
  const ticks = niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const X = i => m.l + (w - m.l - m.r) * i / (points.length - 1), Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  let d = '', area = '';
  points.forEach((p, i) => { if (p[1] == null) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
  area = d + `L${X(points.length - 1)} ${Y(lo)}L${X(0)} ${Y(lo)}Z`;
  let g = ticks.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`).join('');
  let lastYear = null, lastX = -999, xl = '';
  points.forEach((p, i) => {
    const isDate = /^\d{4}-\d\d-\d\d$/.test(p[0]), lab = isDate ? String(p[0]).slice(0, 4) : String(p[0]);
    if (isDate && lab === lastYear) return;
    if (X(i) - lastX < 44) { if (isDate) lastYear = lab; return; }
    lastYear = isDate ? lab : lastYear; lastX = X(i);
    xl += `<text x="${X(i)}" y="${h - 8}" text-anchor="${X(i) > w - m.r - 24 ? 'end' : 'middle'}">${esc(lab)}</text>`;
  });
  const refl = ref ? `<line class="pricev" x1="${m.l}" x2="${w - m.r}" y1="${Y(ref.value)}" y2="${Y(ref.value)}"/><text x="${w - m.r}" y="${Y(ref.value) - 5}" text-anchor="end">${esc(ref.label)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart">${g}<path class="area" d="${area}"/><path class="line" d="${d}"/>${refl}${xl}</svg>`;
}
function barChart(labels, series, { w = 640, h = 220, fmtY = fmt.cc } = {}) {
  const all = series.flatMap(s => s.values).filter(v => v != null);
  if (!all.length) return '<p class="muted small">No data for a chart.</p>';
  const m = { l: 46, r: 10, t: 14, b: 26 };
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const ticks = niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  const band = (w - m.l - m.r) / labels.length, bw = Math.min(26, band * 0.8 / series.length);
  let g = ticks.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`).join('');
  let bars = '';
  labels.forEach((lab, i) => {
    const cx = m.l + band * (i + 0.5);
    series.forEach((s, j) => {
      const v = s.values[i]; if (v == null) return;
      const x = cx - (bw * series.length) / 2 + bw * j, y0 = Y(0), y1 = Y(v);
      bars += `<rect class="${s.cls}" x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="1.5"><title>${esc(s.name)} ${esc(lab)}: ${esc(fmtY(v))}</title></rect>`;
    });
    bars += `<text x="${cx}" y="${h - 8}" text-anchor="middle">${esc(lab)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart">${g}${bars}<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${Y(0)}" y2="${Y(0)}"/></svg>` +
    (series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="${s.cls}" style="background:${s.cls === 'bar' ? 'var(--accent)' : s.cls === 'bar2' ? 'var(--muted)' : 'var(--pos)'}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
}
function footballChart(rows, price, { w = 640 } = {}) {
  if (!rows || !rows.length) return '';
  const m = { l: 190, r: 28, t: 24, b: 26 }, rh = 38, h = m.t + rows.length * rh + m.b;
  let lo = Math.min(price, ...rows.map(r => r.low)), hi = Math.max(price, ...rows.map(r => r.high));
  const span = hi - lo; lo = Math.max(0, lo - span * 0.17); hi += span * 0.12;
  const ticks = niceTicks(lo, hi, 5);
  const X = v => m.l + (w - m.l - m.r) * (v - lo) / (hi - lo);
  let s = ticks.filter(t => t >= lo && t <= hi).map(t => `<line class="axis" x1="${X(t)}" x2="${X(t)}" y1="${m.t - 6}" y2="${h - m.b}"/><text x="${X(t)}" y="${h - 8}" text-anchor="middle">${fmt.n(t)}</text>`).join('');
  rows.forEach((r, i) => {
    const y = m.t + i * rh + 6, x1 = X(Math.max(r.low, lo)), x2 = Math.max(X(Math.max(r.high, lo)), x1 + 3);
    s += `<text class="big" x="${m.l - 10}" y="${y + 14}" text-anchor="end">${esc(r.label)}</text>` +
      `<rect class="bar" x="${x1}" y="${y}" width="${x2 - x1}" height="20" rx="3"><title>${esc(r.label)}: ${fmt.rs(r.low)} to ${fmt.rs(r.high)}. ${esc(r.detail || '')}</title></rect>` +
      (x1 - m.l < 44 ? `<text x="${x2 + 5}" y="${y + 14}">${fmt.n(r.low)} to ${fmt.n(r.high)}</text>`
        : `<text x="${x1 - 5}" y="${y + 14}" text-anchor="end">${fmt.n(r.low)}</text><text x="${x2 + 5}" y="${y + 14}">${fmt.n(r.high)}</text>`);
  });
  s += `<line class="pricev" x1="${X(price)}" x2="${X(price)}" y1="${m.t - 10}" y2="${h - m.b}"/><text class="lbl" x="${X(price)}" y="${m.t - 13}" text-anchor="middle">Market price ${fmt.rs(price)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Football field chart of valuation ranges">${s}</svg>`;
}
function heatTable(sens, price, fRow, fCol) {
  const head = sens.cols.map(c => `<th class="n">${fCol(c)}</th>`).join('');
  const body = sens.rows.map((r, i) => `<tr><th>${fRow(r)}</th>` + sens.grid[i].map((v, j) => {
    const center = sens.center && sens.center[0] === i && sens.center[1] === j;
    const above = v != null && v >= price;
    return `<td class="cell ${center ? 'center' : ''}" style="${above ? 'background:var(--pos-soft)' : ''}">${v == null ? '–' : fmt.n(v)}</td>`;
  }).join('') + '</tr>').join('');
  return `<div class="tbl-wrap"><table class="heat"><thead><tr><th>${esc(sens.row_label)} ↓ / ${esc(sens.col_label)} →</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  <p class="small muted" style="margin:8px 0 0">Shaded cells are above today's market price (${fmt.rs(price)}). Outlined cell = your assumptions.</p>`;
}

/* ---------------------------------------------------------------- more charts */
function sparkline(values, { w = 120, h = 34 } = {}) {
  if (!values || values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), pad = 3;
  const X = i => pad + (w - 2 * pad) * i / (values.length - 1), Y = v => pad + (h - 2 * pad) * (1 - (v - lo) / ((hi - lo) || 1));
  const d = values.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const up = values[values.length - 1] >= values[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" style="fill:none;stroke:${up ? 'var(--pos)' : 'var(--neg)'};stroke-width:1.6"/></svg>`;
}
const SERIES_CLS = ['s1', 's2', 's3', 's4', 's5'];
function multiLine(series, { w = 640, h = 240, fmtY = v => v.toFixed(0), base = null } = {}) {
  const names = Object.keys(series).filter(n => series[n] && series[n].length > 1);
  if (!names.length) return '<p class="muted small">No data.</p>';
  const m = { l: 48, r: 12, t: 12, b: 26 };
  const all = names.flatMap(n => series[n].map(p => p[1]));
  let lo = Math.min(...all), hi = Math.max(...all);
  const ticks = niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const n0 = series[names[0]].length;
  const X = i => m.l + (w - m.l - m.r) * i / (n0 - 1), Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  let g = ticks.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`).join('');
  const dates = series[names[0]].map(p => p[0]); let lastY = null, lastX = -99, xl = '';
  dates.forEach((d, i) => { const y = d.slice(0, 4); if (y !== lastY) { lastY = y; if (X(i) - lastX >= 44) { lastX = X(i); xl += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle">${y}</text>`; } } });
  const lines = names.map((n, k) => `<path class="ln ${SERIES_CLS[k % 5]}" d="${series[n].map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}"><title>${esc(n)}</title></path>`).join('');
  const ref = base != null ? `<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${Y(base)}" y2="${Y(base)}"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart">${g}${ref}${lines}${xl}</svg>
    <div class="legend">${names.map((n, k) => `<span><i class="sw ${SERIES_CLS[k % 5]}"></i>${esc(n)}</span>`).join('')}</div>`;
}
function frontierChart(front, assets, ports, rf, { w = 640, h = 320 } = {}) {
  const m = { l: 52, r: 16, t: 14, b: 38 };
  const xs = [...front.map(p => p.vol), ...assets.map(a => a.vol), ...ports.map(p => p.vol)];
  const ys = [...front.map(p => p.ret), ...assets.map(a => a.mu_used), ...ports.map(p => p.ret)];
  let xlo = 0, xhi = Math.max(...xs) * 1.08, ylo = Math.min(...ys, rf) - 0.01, yhi = Math.max(...ys) + 0.01;
  const yt = niceTicks(ylo, yhi, 5), xt = niceTicks(xlo, xhi, 5); ylo = Math.min(ylo, yt[0]); yhi = Math.max(yhi, yt[yt.length - 1]); xhi = Math.max(xhi, xt[xt.length - 1]);
  const X = v => m.l + (w - m.l - m.r) * (v - xlo) / (xhi - xlo), Y = v => m.t + (h - m.t - m.b) * (1 - (v - ylo) / (yhi - ylo));
  let s = yt.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt.pct(t, 0)}</text>`).join('') +
    xt.map(t => `<text x="${X(t)}" y="${h - 20}" text-anchor="middle">${fmt.pct(t, 0)}</text>`).join('') +
    `<text x="${(m.l + w - m.r) / 2}" y="${h - 4}" text-anchor="middle">Risk (annual volatility)</text><text x="12" y="${(m.t + h - m.b) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(m.t + h - m.b) / 2})">Expected return</text>`;
  s += `<line class="pricev" x1="${m.l}" x2="${w - m.r}" y1="${Y(rf)}" y2="${Y(rf)}"/><text x="${w - m.r}" y="${Y(rf) - 5}" text-anchor="end">G-sec ${fmt.pct(rf, 1)}</text>`;
  s += `<path class="ln s1" d="${front.map((p, i) => (i ? 'L' : 'M') + X(p.vol).toFixed(1) + ' ' + Y(p.ret).toFixed(1)).join('')}"/>`;
  s += assets.map(a => `<circle class="dot" cx="${X(a.vol)}" cy="${Y(a.mu_used)}" r="4"><title>${esc(a.symbol)}: ${fmt.pct(a.mu_used)} return, ${fmt.pct(a.vol)} risk</title></circle><text x="${X(a.vol) + 6}" y="${Y(a.mu_used) + 3}" style="font-size:10px">${esc(a.symbol)}</text>`).join('');
  const cls = { 'Minimum variance': 's2', 'Maximum Sharpe': 's3', 'Equal weight': 's4', 'Your weights': 's5' };
  s += ports.map(p => `<rect class="pt ${cls[p.name] || 's2'}" x="${X(p.vol) - 6}" y="${Y(p.ret) - 6}" width="12" height="12" rx="2"><title>${esc(p.name)}: ${fmt.pct(p.ret)} return, ${fmt.pct(p.vol)} risk</title></rect>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Efficient frontier">${s}</svg>
    <div class="legend"><span><i class="sw s1"></i>Efficient frontier</span><span><i class="sw dotsw"></i>Single stocks</span>${ports.map(p => `<span><i class="sw ${cls[p.name] || 's2'}" style="border-radius:2px"></i>${esc(p.name)}</span>`).join('')}</div>`;
}
function histChart(hist, lines, { w = 640, h = 220 } = {}) {
  const m = { l: 40, r: 12, t: 18, b: 30 }, c = hist.counts, e = hist.edges, mx = Math.max(...c);
  const lo = Math.min(e[0], ...lines.map(l => l.x)), hi = e[e.length - 1];
  const X = v => m.l + (w - m.l - m.r) * (v - lo) / (hi - lo), Y = v => m.t + (h - m.t - m.b) * (1 - v / mx);
  let s = c.map((n, i) => `<rect class="bar2" x="${X(e[i]) + 0.5}" y="${Y(n)}" width="${Math.max(1, X(e[i + 1]) - X(e[i]) - 1)}" height="${(h - m.b) - Y(n)}"><title>${n} days between ${fmt.pct(e[i], 1)} and ${fmt.pct(e[i + 1], 1)}</title></rect>`).join('');
  s += niceTicks(lo, hi, 6).filter(t => t >= lo && t <= hi).map(t => `<text x="${X(t)}" y="${h - 12}" text-anchor="middle">${fmt.pct(t, 1)}</text>`).join('');
  s += lines.map((l, i) => `<line class="pricev" x1="${X(l.x)}" x2="${X(l.x)}" y1="${m.t - 4}" y2="${h - m.b}"/><text class="lbl" x="${X(l.x)}" y="${m.t - 6 - (i % 2) * 0}" text-anchor="${i % 2 ? 'start' : 'end'}" dx="${i % 2 ? 4 : -4}">${esc(l.label)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Histogram of daily portfolio returns">${s}<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}"/></svg>`;
}
function corrTable(syms, mat) {
  const head = syms.map(s => `<th class="n corr-h">${esc(s.slice(0, 7))}</th>`).join('');
  const body = syms.map((s, i) => `<tr><th>${esc(s)}</th>` + mat[i].map((v, j) => {
    const a = i === j ? 0 : Math.max(0, Math.min(1, v));
    return `<td class="cell corr" style="background:color-mix(in srgb, var(--accent) ${Math.round(a * 70)}%, transparent)">${i === j ? '–' : v.toFixed(2)}</td>`;
  }).join('') + '</tr>').join('');
  return `<div class="tbl-wrap"><table class="heat"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function hbars(items, { fmtV = v => fmt.pct(v, 1), max = null } = {}) {
  const mx = max || Math.max(...items.map(i => i.value), 0.0001);
  return `<div class="hbars">${items.map(i => `<div class="hb"><span class="hb-l">${esc(i.label)}</span><span class="hb-t"><span class="hb-f ${i.cls || ''}" style="width:${Math.max(0, i.value / mx * 100).toFixed(1)}%"></span></span><span class="hb-v">${fmtV(i.value)}</span></div>`).join('')}</div>`;
}

/* ---------------------------------------------------------------- stock picker (used by both labs) */
function pickerHtml(id, symbols) {
  return `<div class="picker" id="${id}"><div class="search"><input type="search" placeholder="Add a stock: name or NSE symbol" autocomplete="off" aria-label="Add a stock"><div class="suggest" hidden></div></div>
    <div class="pick-chips">${symbols.map(s => `<span class="pchip">${esc(s)}<button type="button" data-rm="${esc(s)}" aria-label="Remove ${esc(s)}">×</button></span>`).join('') || '<span class="muted small">No stocks yet. Search above, or load the sample.</span>'}</div></div>`;
}
function wirePicker(id, getList, setList) {
  const box = document.getElementById(id); if (!box) return;
  const input = $('input', box), list = $('.suggest', box); let items = [], idx = -1;
  const add = sym => { const l = getList(); if (!l.includes(sym) && l.length < 20) { setList([...l, sym]); } input.value = ''; list.hidden = true; };
  const draw = () => { list.innerHTML = items.map((c, i) => `<button type="button" data-sym="${esc(c.symbol)}" class="${i === idx ? 'on' : ''}"><span class="sym">${esc(c.symbol)}</span><span class="nm">${esc(c.name)}</span></button>`).join(''); list.hidden = !items.length; };
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase(); idx = -1; if (!q) { items = []; draw(); return; }
    items = S.universe.map(c => { const s = c.symbol.toLowerCase(), n = c.name.toLowerCase(); let k = 9; if (s === q) k = 0; else if (s.startsWith(q)) k = 1; else if (n.startsWith(q)) k = 2; else if (n.includes(q)) k = 3; return [k, c]; }).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0]).slice(0, 7).map(x => x[1]); draw();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(-1, idx - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { const pick = idx >= 0 ? items[idx] : items[0]; if (pick) add(pick.symbol); else if (input.value.trim()) add(input.value.trim().toUpperCase()); e.preventDefault(); }
  });
  list.addEventListener('mousedown', e => { const b = e.target.closest('button[data-sym]'); if (b) { e.preventDefault(); add(b.dataset.sym); } });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  box.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) setList(getList().filter(s => s !== r.dataset.rm)); });
}
const SAMPLE = ['TCS', 'HDFCBANK', 'RELIANCE', 'ITC', 'INFY', 'HINDUNILVR', 'LT', 'SUNPHARMA', 'MARUTI', 'BHARTIARTL'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('vl:' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('vl:' + k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
};
async function post(path, body) {
  if (STATIC) throw new Error('The labs run on your own computer, not on the published snapshot.');
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) { /* not json */ }
  if (!r.ok) { const d = j?.error || (Array.isArray(j?.detail) ? j.detail.map(x => x.msg).join('; ') : j?.detail) || `Request failed (${r.status})`; const e = new Error(d); e.kind = j?.kind; throw e; }
  return j;
}

/* ---------------------------------------------------------------- valuation charts */
function donutChart(parts, { big = '', small = '', size = 190 } = {}) {
  const tot = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  if (!tot) return '';
  const r = 70, c = 2 * Math.PI * r; let off = 0;
  const arcs = parts.map(p => {
    const len = c * Math.max(0, p.value) / tot, s = `<circle class="dn ${p.cls}" cx="100" cy="100" r="${r}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)"><title>${esc(p.label)}</title></circle>`;
    off += len; return s;
  }).join('');
  return `<svg class="chart donut" viewBox="0 0 200 200" style="max-width:${size}px" role="img" aria-label="Donut chart">${arcs}
    <text class="lbl" x="100" y="${small ? 100 : 106}" text-anchor="middle" style="font-size:25px">${esc(big)}</text>${small ? `<text x="100" y="120" text-anchor="middle">${esc(small)}</text>` : ''}</svg>`;
}
/* steps: [{label, value, kind: 'step' | 'total'}]; a 'total' bar is drawn from zero to the running sum (or its own value) */
function waterfallChart(steps, { w = 640, h = 230, fmtY = v => fmt.n(v) } = {}) {
  if (!steps || !steps.length) return '';
  const m = { l: 56, r: 10, t: 18, b: 30 };
  let run = 0; const bars = steps.map(s => {
    if (s.kind === 'total') { const v = s.value != null ? s.value : run; run = v; return { ...s, from: 0, to: v }; }
    const from = run; run += s.value; return { ...s, from, to: run };
  });
  let lo = Math.min(0, ...bars.flatMap(b => [b.from, b.to])), hi = Math.max(0, ...bars.flatMap(b => [b.from, b.to]));
  const ticks = niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo)), band = (w - m.l - m.r) / bars.length, bw = Math.min(40, band * 0.7);
  let g = ticks.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`).join('');
  bars.forEach((b, i) => {
    const cx = m.l + band * (i + 0.5), y1 = Y(Math.max(b.from, b.to)), y2 = Y(Math.min(b.from, b.to));
    const cls = b.kind === 'total' ? 'wf-total' : b.value >= 0 ? 'wf-up' : 'wf-down';
    g += `<rect class="${cls}" x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5, y2 - y1).toFixed(1)}" rx="2"><title>${esc(b.label)}: ${esc(fmtY(b.kind === 'total' ? b.to : b.value))}</title></rect>`;
    if (i < bars.length - 1) g += `<line class="axis" x1="${(cx + bw / 2).toFixed(1)}" x2="${(cx + band - bw / 2).toFixed(1)}" y1="${Y(b.to)}" y2="${Y(b.to)}" style="stroke-dasharray:2 2"/>`;
    if (bars.length <= 9 || b.kind === 'total' || i === bars.length - 2) g += `<text x="${cx}" y="${y1 - 4}" text-anchor="middle" class="lbl" style="font-size:10px">${esc(fmtY(b.kind === 'total' ? b.to : b.value))}</text>`;
    g += `<text x="${cx}" y="${h - 10}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Waterfall chart">${g}<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${Y(0)}" y2="${Y(0)}"/></svg>`;
}
/* Two years of weekly closes, then a one-year range cone from the stock's own historical volatility (no drift assumed),
   with the model's bear-to-bull range shaded and the base value dashed. */
function priceFanChart(series, { value = null, low = null, high = null, w = 640, h = 240 } = {}) {
  if (!series || series.length < 60) return '<p class="muted small">Not enough price history for a range chart.</p>';
  const closes = series.map(p => p[1]), rets = [];
  for (let i = Math.max(1, closes.length - 156); i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length, sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  const hist = series.slice(-104), S0 = closes[closes.length - 1], H = 52, z = { p5: -1.645, p25: -0.674, p50: 0, p75: 0.674, p95: 1.645 };
  const q = (k, t) => S0 * Math.exp(-0.5 * sd * sd * t + sd * Math.sqrt(t) * z[k]);
  const m = { l: 52, r: 12, t: 14, b: 26 }, n = hist.length + H;
  const vals = [...hist.map(p => p[1]), q('p5', H), q('p95', H)]; if (value) vals.push(value); if (low) vals.push(low); if (high) vals.push(high);
  let lo = Math.min(...vals), hi = Math.max(...vals); const ticks = niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const X = i => m.l + (w - m.l - m.r) * i / (n - 1), Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo)), x0 = hist.length - 1;
  const path = k => Array.from({ length: H + 1 }, (_, t) => (t ? 'L' : 'M') + X(x0 + t).toFixed(1) + ' ' + Y(t ? q(k, t) : S0).toFixed(1)).join('');
  const poly = (a, b) => path(a) + Array.from({ length: H + 1 }, (_, t) => 'L' + X(x0 + H - t).toFixed(1) + ' ' + Y(H - t ? q(b, H - t) : S0).toFixed(1)).join('') + 'Z';
  let g = ticks.map(t => `<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmt.n(t))}</text>`).join('');
  if (low && high) g += `<rect class="vband" x="${m.l}" y="${Y(high)}" width="${w - m.l - m.r}" height="${Math.max(2, Y(low) - Y(high))}"><title>Model bear to bull: ${esc(fmt.rs(low))} to ${esc(fmt.rs(high))}</title></rect>`;
  g += `<path class="fan2" d="${poly('p5', 'p95')}"><title>90% range</title></path><path class="fan1" d="${poly('p25', 'p75')}"><title>50% range</title></path>`;
  g += `<path class="line" d="${hist.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}"/><path class="fanmid" d="${path('p50')}"/>`;
  if (value) g += `<line class="pricev" x1="${m.l}" x2="${w - m.r}" y1="${Y(value)}" y2="${Y(value)}"/><text class="lbl" x="${m.l + 4}" y="${Y(value) - 5}">Model value ${esc(fmt.rs(value))}</text>`;
  g += `<line class="axis" x1="${X(x0)}" x2="${X(x0)}" y1="${m.t}" y2="${h - m.b}" style="stroke-dasharray:3 3"/><text x="${X(x0) - 4}" y="${h - 8}" text-anchor="end">today</text><text x="${w - m.r}" y="${h - 8}" text-anchor="end">+1 year</text>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Price history with a one-year range from historical volatility">${g}</svg>
    <p class="small muted" style="margin:6px 0 0">Right of the dashed line: the range of one-year prices if the stock keeps its last ${rets.length} weeks' volatility (${(sd * Math.sqrt(52) * 100).toFixed(0)}% a year), with no drift assumed. Dark band: 50% of outcomes. Light band: 90%.${low && high ? ' Green band: our bear-to-bull model range.' : ''} A statistical range, not a forecast.</p>`;
}
