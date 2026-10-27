'use strict';
/* Business tab (pilot): how a company makes money, with the source and our confidence on every statement.
   Draws any profile served by /api/business/{symbol}. Nothing here is computed except plain shares and ratios of figures in the profile. */

S.biz = {}; S.bizList = null;

const CF = {
  primary: ['Primary', 'Read in the company’s own document, page cited'],
  derived: ['Derived', 'Our arithmetic from the figures cited'],
  claim: ['Claim', 'A management statement, not independently verified'],
  press: ['Press', 'A press report or company web page; the primary document has not been read'],
};
const VERDICT = {
  in_sync: ['In sync', 'vd-ok'], partly: ['Partly', 'vd-part'], mismatch: ['Mismatch', 'vd-bad'],
  context: ['Needs context', 'vd-ctx'], cannot_verify: ['Cannot verify', 'vd-unk'],
};
const STATUS = {
  delivered: ['Delivered', 'vd-ok'], partly: ['Partly', 'vd-part'], pending: ['Pending', 'vd-unk'],
  changed: ['Changed', 'vd-ctx'], in_progress: ['In progress', 'vd-ctx'],
};
const chip = (map, k) => { const [l, c] = map[k] || [k, 'vd-unk']; return `<span class="vd ${c}">${esc(l)}</span>`; };
const cfChip = c => { const [l, t] = CF[c] || [c, '']; return `<span class="cf cf-${esc(c)}" title="${esc(t)}">${esc(l)}</span>`; };
function srcTags(p, refs) {
  return (refs || []).map(ref => {
    const [id, page] = String(ref).split(':'), s = p.sources[id];
    if (!s) return '';
    const label = s.short + (page && page !== '0' ? ' p.' + page : '');
    return /^https:\/\//.test(s.url) ? `<a class="srcref" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(label)}</a>` : `<span class="srcref">${esc(label)}</span>`;
  }).join(' ');
}
const sg = v => v == null ? '–' : `<span class="${v < 0 ? 'neg' : ''}">${v < 0 ? '−' : ''}${nf0.format(Math.abs(Math.round(v)))}</span>`;
const pc = (v, d = 1) => v == null || !isFinite(v) ? '–' : (v * 100).toFixed(d) + '%';
const numCell = (v, dec = 0) => v == null ? '–' : (dec ? (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : sg(v));

function mixBar(title, items, total) {
  const parts = items.filter(i => i.val > 0);
  return `<div class="mix"><div class="mix-t">${esc(title)}</div><div class="mixbar">${parts.map((i, k) => `<span style="width:${(i.val / total * 100).toFixed(2)}%;background:var(--c${(k % 5) + 1})" title="${esc(i.name)}: ${pc(i.val / total)}"></span>`).join('')}</div>
    <div class="mixleg">${parts.map((i, k) => `<span><i style="background:var(--c${(k % 5) + 1})"></i>${esc(i.name)} ${pc(i.val / total, 0)}</span>`).join('')}</div></div>`;
}

function bizSegments(p) {
  const sg_ = p.segments, rows = sg_.rows, tot = sg_.total;
  const totRev = tot ? tot.revenue : null;
  const ovRows = rows.filter(r => r.order_value != null);
  const totOv = tot && tot.order_value ? tot.order_value : ovRows.reduce((a, r) => a + r.order_value, 0);
  const head = `<tr><th>Segment</th><th class="n">Revenue</th><th class="n">% of revenue</th><th class="n">Order value</th><th class="n">% of order value</th><th class="n">${esc(sg_.result_label)}</th><th class="n">Result, % of order value</th><th class="n">Revenue per 100 of order value</th><th>Source</th></tr>`;
  const body = rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${sg(r.revenue)}</td><td class="n">${totRev ? pc(r.revenue / totRev) : '–'}</td>
    <td class="n">${sg(r.order_value)}</td><td class="n">${r.order_value != null ? pc(r.order_value / totOv) : '–'}</td><td class="n">${sg(r.result)}</td>
    <td class="n">${r.order_value ? pc(r.result / r.order_value) : '–'}</td><td class="n">${r.order_value ? (r.revenue / r.order_value * 100).toFixed(1) : '–'}</td><td class="src">${srcTags(p, r.src)}</td></tr>`).join('');
  const foot = tot ? `<tr class="total"><td>Total</td><td class="n">${sg(tot.revenue)}</td><td class="n">100%</td><td class="n">${sg(tot.order_value)}</td><td class="n">100%</td><td class="n">${sg(tot.result)}</td><td class="n">${tot.order_value ? pc(tot.result / tot.order_value) : '–'}</td><td></td><td></td></tr>` : '';
  const bars = (totRev ? mixBar('Mix of audited revenue', rows.map(r => ({ name: r.name, val: r.revenue })), totRev) : '') +
    mixBar(totRev ? 'Mix of order value' : 'Mix of consumer order value', ovRows.map(r => ({ name: r.name, val: r.order_value })), totOv);
  return `<div class="card"><h2>${esc(sg_.title)} ${cfChip(sg_.confidence)}</h2><p class="small muted" style="margin-top:0">${esc(sg_.basis)}</p>
    <div class="mixes">${bars}</div><div class="tbl-wrap"><table class="compact"><thead>${head}</thead><tbody>${body}${foot}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Shares and ratios are our division of the figures shown.</p></div>`;
}

function bizMoney(p) {
  let h = '';
  const rt = p.revenue_types;
  if (rt) {
    const mx = Math.max(...rt.rows.map(r => r.value));
    h += `<div class="card"><h2>${esc(rt.title)}</h2><p class="small muted" style="margin-top:0">${esc(rt.note)}</p>
      <div class="hbars">${rt.rows.map(r => `<div class="hb"><span class="hb-l">${esc(r.name)}</span><span class="hb-t"><span class="hb-f" style="width:${(r.value / mx * 100).toFixed(1)}%"></span></span><span class="hb-v">${nf0.format(r.value)}</span></div>`).join('')}</div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="compact"><thead><tr><th>Type</th><th class="n">Revenue</th><th class="n">Share</th><th>Confidence</th><th>Source</th></tr></thead><tbody>${rt.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${sg(r.value)}</td><td class="n">${pc(r.value / rt.total)}</td><td>${cfChip(r.confidence)}</td><td class="src">${srcTags(p, r.src)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  if (p.bridge) {
    const b = p.bridge;
    h += `<div class="card"><h2>${esc(b.title)} ${cfChip(b.confidence)}</h2><div class="tbl-wrap"><table><tbody>${b.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${sg(r.value)}</td></tr>`).join('')}
      <tr class="total"><td>${esc(b.total.label)}</td><td class="n">${sg(b.total.value)}</td></tr></tbody></table></div><p class="small" style="margin:8px 0 0">${srcTags(p, b.src)}</p></div>`;
  }
  (p.reconciliations || []).forEach(rec => {
    h += `<div class="card"><h2>${esc(rec.title)} ${cfChip(rec.confidence)}</h2><div class="tbl-wrap"><table><tbody>${rec.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="n">${sg(v)}</td></tr>`).join('')}<tr class="total"><td>${esc(rec.total[0])}</td><td class="n">${sg(rec.total[1])}</td></tr></tbody></table></div><p class="small" style="margin:8px 0 0">${srcTags(p, rec.src)}</p></div>`;
  });
  if (p.cash) {
    const c = p.cash;
    h += `<div class="card"><h2>${esc(c.title)} ${cfChip(c.confidence)}</h2><p class="small muted" style="margin-top:0">${esc(c.note)}</p><div class="tbl-wrap"><table class="compact"><thead><tr><th>Period</th><th class="n">Opening</th><th class="n">Cash burn</th><th class="n">Working capital</th><th class="n">Raised</th><th class="n">Divested</th><th class="n">Closing</th><th>Source</th></tr></thead><tbody>${c.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${sg(r.opening)}</td><td class="n">${sg(r.burn)}</td><td class="n">${sg(r.working_capital)}</td><td class="n">${sg(r.raised)}</td><td class="n">${sg(r.divested)}</td><td class="n"><b>${sg(r.closing)}</b></td><td class="src">${srcTags(p, r.src)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  return h;
}

function bizKpis(p) {
  const k = p.kpis; if (!k) return '';
  return `<div class="card"><h2>${esc(k.title)}</h2><div class="kpi-cards">${k.items.map(i => `<div class="kpi"><div class="muted small">${esc(i.label)}</div><div class="kpi-v">${esc(i.value)}</div><div class="small muted">${esc(i.note || '')}</div><div class="kpi-f">${cfChip(i.confidence)} ${srcTags(p, i.src)}</div></div>`).join('')}</div></div>`;
}

function rowDecimals(values) {   // show every value in a row with the same number of decimals (at most two)
  const d = values.filter(v => v != null).map(v => (String(v).split('.')[1] || '').length);
  return Math.min(2, d.length ? Math.max(...d) : 0);
}
function seriesTable(p, tbl, withUnit = true) {
  const head = `<tr><th></th>${tbl.labels.map(l => `<th class="n">${esc(l)}</th>`).join('')}${withUnit ? '<th>Unit</th>' : ''}</tr>`;
  const body = tbl.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.values.map(v => `<td class="n">${v == null ? '–' : numCell(v, rowDecimals(r.values))}</td>`).join('')}${withUnit ? `<td class="src">${esc(r.unit || '')}</td>` : ''}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="compact"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
function bizCapacity(p) {
  const c = p.capacity; if (!c) return '';
  const charts = c.rows.filter(r => r.chart).map(r => `<div class="minichart"><div class="small"><b>${esc(r.label)}</b> <span class="muted">(${esc(r.unit)})</span></div>${lineChart(c.labels.map((l, i) => [l, r.values[i]]), { w: 320, h: 170, fmtY: v => nf0.format(v) })}</div>`).join('');
  return `<div class="card"><h2>${esc(c.title)} ${cfChip(c.confidence)}</h2><p class="small muted" style="margin-top:0">${esc(c.definition)}</p>
    ${charts ? `<div class="minicharts">${charts}</div>` : ''}${seriesTable(p, c)}
    <p class="small" style="margin:8px 0">${srcTags(p, c.src)}</p>
    <ul class="claims">${(c.claims || []).map(x => `<li>${cfChip(x.confidence)} ${esc(x.text)} ${srcTags(p, x.src)}</li>`).join('')}</ul>
    ${c.reading ? `<div class="note" style="margin-top:10px"><b>How to read it:</b> ${esc(c.reading)}</div>` : ''}</div>`;
}
function bizMomentum(p) {
  const m = p.momentum; if (!m) return '';
  const g = m.rows.find(r => /growth/i.test(r.label));
  return `<div class="card"><h2>${esc(m.title)} ${cfChip(m.confidence)}</h2>
    ${g ? `<div class="minichart" style="max-width:520px"><div class="small"><b>${esc(g.label)}</b> <span class="muted">(%)</span></div>${lineChart(m.labels.map((l, i) => [l, g.values[i]]), { w: 520, h: 170, fmtY: v => v.toFixed(0) + '%' })}</div>` : ''}
    ${seriesTable(p, m)}<p class="small" style="margin:8px 0">${srcTags(p, m.src)}</p>
    ${m.reading ? `<div class="note"><b>How to read it:</b> ${esc(m.reading)}</div>` : ''}</div>`;
}

function bizSync(p) {
  return `<div class="card"><h2>Management says, statutory shows</h2><p class="small muted" style="margin-top:0">Each row tests a statement from the company against its audited or reported numbers. A claim is only called "in sync" when the two agree.</p>
    <div class="tbl-wrap"><table class="syncT"><thead><tr><th>Management says</th><th>The numbers show</th><th>Verdict</th><th>Sources</th></tr></thead><tbody>${p.sync.map(s => `<tr><td>${esc(s.claim)}</td><td>${esc(s.statutory)}${s.why ? `<div class="small muted">${esc(s.why)}</div>` : ''}</td><td>${chip(VERDICT, s.verdict)}</td><td class="src">${srcTags(p, s.src)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Guidance ledger</h2><p class="small muted" style="margin-top:0">What the company said it would do, and what happened. Over time this shows how far its targets can be trusted.</p>
    <div class="tbl-wrap"><table class="syncT"><thead><tr><th>Said</th><th>Outcome so far</th><th>Status</th><th>Sources</th></tr></thead><tbody>${p.guidance.map(g => `<tr><td>${esc(g.item)}</td><td>${esc(g.outcome)}</td><td>${chip(STATUS, g.status)}</td><td class="src">${srcTags(p, g.src)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function bizNotes(p) {
  return `<div class="card"><h2>Comparability and definitions</h2><div class="note">${p.comparability.map(x => `<div style="margin:4px 0">${esc(x)}</div>`).join('')}</div>
    <dl class="defs">${p.definitions.map(d => `<dt>${esc(d.term)}</dt><dd>${esc(d.meaning)}</dd>`).join('')}</dl></div>
    <div class="card"><h2>Risks to check</h2><ul class="claims">${p.risks.map(r => `<li>${cfChip(r.confidence)} ${esc(r.text)} ${srcTags(p, r.src)}</li>`).join('')}</ul></div>
    <div class="card"><h2>Still open</h2><ul style="margin:0;padding-left:18px">${p.open_questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>`;
}

const COMPARE_LABELS = [['model', 'Business'], ['order_value', 'Order-value measure'], ['revenue_distortion', 'What distorts reported revenue'], ['profit_segments', 'Where the profit is'], ['capacity_measure', 'Capacity measure'], ['capacity_latest', 'Latest capacity reading'], ['cash', 'Cash'], ['b2b_part', 'B2B part'], ['evidence', 'Quality of evidence']];
function bizCompare(p, o) {
  if (!o || o.error) return '';
  return `<div class="card"><h2>The same questions, side by side</h2><p class="small muted" style="margin-top:0">Compare like with like: the two companies define their order value and "adjusted" figures differently, and the evidence for ${esc(o.name.split(' (')[0])} is weaker.</p>
    <div class="tbl-wrap"><table class="syncT"><thead><tr><th></th><th>${esc(p.name.split(' (')[0])}</th><th>${esc(o.name.split(' (')[0])}</th></tr></thead><tbody>${COMPARE_LABELS.map(([k, l]) => `<tr><td><b>${esc(l)}</b></td><td>${esc(p.compare[k])}</td><td>${esc(o.compare[k])}</td></tr>`).join('')}</tbody></table></div>
    <p class="small" style="margin:8px 0 0"><a href="#/c/${esc(o.symbol)}/business">Open the ${esc(o.name.split(' (')[0])} profile</a></p></div>`;
}

function bizSources(p) {
  const kinds = { primary: 'Company document', press: 'Press report', 'company-site': 'Company web page' };
  return `<div class="card"><h2>Sources</h2><div class="tbl-wrap"><table><tbody>${Object.values(p.sources).map(s => `<tr><td>${esc(kinds[s.kind] || s.kind)}</td><td><a class="srcref" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Page numbers are PDF pages. Statements are summarised in our own words; follow the links for the originals.</p></div>`;
}

/* ----- reverse view: what must be true for today's price (loss-making companies) */
S.rev = { g1: 0.30, tg: 0.05, ytm: 7, ri: 0.02, margin: 0.05 };
function bizReverse(p) {
  if (!p.reverse_inputs) return '';
  setTimeout(() => bizReverseLoad(p.symbol), 0);
  return `<div class="card" id="rev-card"><h2>Reverse view: what must be true for today’s price?</h2><div id="rev-slot"><div class="loading"><div class="spinner"></div><b>Working backwards from the market price…</b></div></div></div>`;
}
let revTimer = null;
async function bizReverseLoad(sym) {
  const slot = $('#rev-slot'); if (!slot) return;
  const r = S.rev, q = `g1=${r.g1}&terminal_g=${r.tg}&years_to_mature=${r.ytm}&reinvest=${r.ri}&margin=${r.margin}`;
  try {
    const x = await api(`/api/business/${encodeURIComponent(sym)}/reverse?${q}`);
    if (!$('#rev-slot')) return;
    $('#rev-slot').innerHTML = bizReverseHtml(S.biz[sym], x);
    bizReverseWire(sym);
  } catch (e) {
    if ($('#rev-slot')) $('#rev-slot').innerHTML = `<div class="note err">${esc(e.message)}${e.kind === 'rate_limited' ? ' <button class="btn" id="rev-retry">Try again</button>' : ''}</div>`;
    const b = $('#rev-retry'); if (b) b.onclick = () => bizReverseLoad(sym);
  }
}
function bizReverseWire(sym) {
  const map = { 'rv-g1': 'g1', 'rv-tg': 'tg', 'rv-ytm': 'ytm', 'rv-ri': 'ri', 'rv-m': 'margin' };
  for (const [id, key] of Object.entries(map)) {
    const el = $('#' + id); if (!el) continue;
    el.oninput = () => { S.rev[key] = +el.value; const o = $('#' + id + '-o'); if (o) o.textContent = key === 'ytm' ? el.value + ' years' : (el.value * 100).toFixed(key === 'ri' ? 1 : 0) + '%'; };
    el.onchange = () => { clearTimeout(revTimer); revTimer = setTimeout(() => bizReverseLoad(sym), 150); };
  }
  const rs = $('#rv-reset'); if (rs) rs.onclick = () => { S.rev = { g1: 0.30, tg: 0.05, ytm: 7, ri: 0.02, margin: 0.05 }; bizReverseLoad(sym); };
}
function bizReverseHtml(p, x) {
  const ri = p.reverse_inputs, inp = x.inputs, path = x.path, m = x.implied_margin;
  const esopDa = -(ri.ebit_parts[1].value + ri.ebit_parts[2].value) / ri.base_gov;
  const slider = (id, label, min, max, step, val, out, hint) => `<div class="ctl"><label>${label} <span class="val" id="${id}-o">${out}</span></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><div class="hint">${hint}</div></div>`;
  let head;
  if (m == null || !path) {
    head = `<div class="note">No operating margin up to 35% of order value reproduces today’s price under these assumptions (price ${fmt.rs(inp.price)}). The market is pricing something this model cannot express, such as much faster growth.</div>`;
  } else {
    const last = path.rows[path.rows.length - 1], tvShare = path.pv_terminal / (path.pv_explicit + path.pv_terminal);
    head = `<p class="small" style="margin-top:0">At <b>${fmt.rs(inp.price)}</b> (market value ₹${fmt.n(x.market_cap)} crore, or ₹${fmt.n(x.enterprise_value)} crore after the ₹${fmt.n(ri.cash)} crore of cash), the market is pricing an operating margin of
      <b>${pc(m, 1)} of order value</b>, after share-based pay and depreciation, reached in year ${inp.years_to_mature} and held after that. That assumes order value grows ${pc(inp.g1, 0)} in year 1, fading to ${pc(inp.terminal_g, 0)}, which takes it from ₹${fmt.n(ri.base_gov)} crore to ₹${fmt.n(last.gov)} crore in year ${inp.years} (${(last.gov / ri.base_gov).toFixed(1)} times today).</p>
      <div class="kv"><span class="k"><b>Steady-state operating margin the price implies</b></span><span class="v"><b>${pc(m, 1)}</b></span>
      <span class="k">Operating margin in FY26 (segment results less share-based pay and depreciation)</span><span class="v">${pc(inp.margin0, 1)}</span>
      <span class="k">Share-based pay plus depreciation, FY26, as % of order value</span><span class="v">${pc(esopDa, 1)}</span>
      <span class="k">If that cost share stayed, the same margin before those two costs would be about</span><span class="v">${pc(m + esopDa, 1)}</span>
      <span class="k">Year-1 growth needed instead, if the margin reaches ${pc(x.at_margin, 0)}</span><span class="v">${x.implied_g1 == null ? 'not reachable' : pc(x.implied_g1, 1)}</span>
      <span class="k">Share of today’s value that comes after year ${inp.years}</span><span class="v">${pc(tvShare, 0)}</span></div>`;
  }
  const bench = ri.benchmarks.map(b => `<tr><td>${esc(b.label)}</td><td class="n">${pc(b.value, 1)}</td><td class="small muted">${esc(b.basis)}</td><td>${cfChip(b.confidence)} ${srcTags(p, b.src)}</td></tr>`).join('');
  const curve = lineChart(x.curve.map(c => [pc(c.margin, 0), c.value]), { fmtY: v => '₹' + fmt.n(v), ref: { value: inp.price, label: 'Market price ' + fmt.rs(inp.price) } });
  const fcf = path ? barChart(path.rows.map(r => 'Y' + r.year), [{ name: 'Free cash flow', values: path.rows.map(r => r.fcf), cls: 'bar' }]) : '';
  const rows = path ? path.rows.map(r => `<tr><td>Year ${r.year}</td><td class="n">${pc(r.growth, 1)}</td><td class="n">${fmt.n(r.gov)}</td><td class="n">${pc(r.margin, 1)}</td><td class="n">${sg(r.ebit)}</td><td class="n">${sg(r.fcf)}</td></tr>`).join('') : '';
  return `${head}
    <div class="note info small" style="margin:12px 0">This is not a forecast. It runs a small model backwards: it keeps the assumptions below fixed and asks what profit margin the share price needs. Change an assumption and the answer moves.</div>
    <div class="note info small static-only">On this published snapshot the assumptions are fixed at their defaults. Run the tool on your own computer to move the sliders and see the answers change.</div>
    <div class="rev-ctl">
      ${slider('rv-g1', 'Order value growth, year 1', 0.05, 0.60, 0.01, inp.g1, pc(inp.g1, 0), 'FY26 actual: food 20%, Instamart 94% (annual report)')}
      ${slider('rv-ytm', 'Years to reach the mature margin', 3, 10, 1, inp.years_to_mature, inp.years_to_mature + ' years', 'Straight line from today’s margin')}
      ${slider('rv-tg', 'Long-run growth', 0.03, 0.07, 0.005, inp.terminal_g, pc(inp.terminal_g, 0), 'Capped at the G-sec yield')}
      ${slider('rv-ri', 'Reinvestment per rupee of added order value', 0, 0.06, 0.005, inp.reinvest, pc(inp.reinvest, 1), 'Net capex and working capital; our assumption')}
      ${slider('rv-m', 'Margin to test for the growth answer', 0.02, 0.12, 0.01, x.at_margin, pc(x.at_margin, 0), 'Used only for the “growth needed” line')}
    </div><p style="margin:6px 0 12px"><button class="btn" id="rv-reset">Reset to defaults</button> <span class="small muted">Cost of equity ${pc(inp.ke, 1)} (our regression beta against Nifty 50), tax ${pc(inp.tax, 1)} on positive profit only, no credit for past losses. Price as of ${fmt.date(inp.price_date)}${inp.stale ? ' (saved copy)' : ''}.</span></p>
    <h4 style="margin:6px 0 4px;font-size:13px">Value per share for each steady-state margin</h4>${curve}
    <p class="small muted" style="margin:4px 0 12px">Where the line crosses the dashed price line is the margin the market is paying for.</p>
    ${path ? `<h4 style="margin:6px 0 4px;font-size:13px">Free cash flow on the implied path, Rs crore</h4>${fcf}
    <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Year</th><th class="n">GOV growth</th><th class="n">Order value</th><th class="n">Operating margin</th><th class="n">Operating profit</th><th class="n">Free cash flow</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="kv" style="margin-top:12px"><span class="k">Present value of cash flows, years 1 to ${inp.years}</span><span class="v">${sg(path.pv_explicit)}</span><span class="k">Present value of everything after</span><span class="v">${sg(path.pv_terminal)}</span>
    <span class="k">Cash (company figure, June 2026)</span><span class="v">${sg(path.cash)}</span><span class="k"><b>Equity value</b></span><span class="v"><b>${sg(path.equity)}</b></span><span class="k"><b>Per share (equals the price)</b></span><span class="v"><b>${fmt.rs(path.per_share)}</b></span></div>` : ''}
    <h4 style="margin:14px 0 6px;font-size:13px">What the company has actually delivered or said</h4>
    <div class="tbl-wrap"><table><thead><tr><th>Measure</th><th class="n">Value</th><th>Definition</th><th>Source</th></tr></thead><tbody>${bench}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">${esc(ri.note)} ${cfChip(ri.confidence)} ${srcTags(p, ri.src)}</p>`;
}

/* ----- segment-wise sum of the parts */
S.sp = {};
let spTimer = null;
function bizSotp(p) {
  if (!p.sotp_inputs) return '';
  setTimeout(() => bizSotpLoad(p.symbol), 0);
  return `<div class="card" id="sp-card"><h2>Segment-wise sum of the parts</h2><div id="sp-slot"><div class="loading"><div class="spinner"></div><b>Valuing each segment…</b></div></div></div>`;
}
const SP_MAP = { 'sp-fg': 'f_g1', 'sp-ft': 'f_t', 'sp-ig': 'i_g1', 'sp-it': 'i_t', 'sp-iy': 'i_y', 'sp-og': 'o_g1', 'sp-ot': 'o_t', 'sp-ct': 'c_t', 'sp-ri': 'ri' };
async function bizSotpLoad(sym) {
  if (!$('#sp-slot')) return;
  const q = Object.entries(S.sp).map(([k, v]) => `${k}=${v}`).join('&');
  try {
    const x = await api(`/api/business/${encodeURIComponent(sym)}/sotp?${q}`);
    if (!$('#sp-slot')) return;
    $('#sp-slot').innerHTML = bizSotpHtml(S.biz[sym], x);
    for (const [id, key] of Object.entries(SP_MAP)) {
      const el = $('#' + id); if (!el) continue;
      el.oninput = () => { S.sp[key] = +el.value; const o = $('#' + id + '-o'); if (o) o.textContent = key === 'i_y' ? el.value + ' years' : (el.value * 100).toFixed(key === 'ri' ? 1 : 0) + '%'; };
      el.onchange = () => { clearTimeout(spTimer); spTimer = setTimeout(() => bizSotpLoad(sym), 150); };
    }
    const rs = $('#sp-reset'); if (rs) rs.onclick = () => { S.sp = {}; bizSotpLoad(sym); };
  } catch (e) {
    if ($('#sp-slot')) $('#sp-slot').innerHTML = `<div class="note err">${esc(e.message)}${e.kind === 'rate_limited' ? ' <button class="btn" id="sp-retry">Try again</button>' : ''}</div>`;
    const b = $('#sp-retry'); if (b) b.onclick = () => bizSotpLoad(sym);
  }
}
function bizSotpHtml(p, x) {
  const si = p.sotp_inputs, inp = x.inputs, b = x.base, price = inp.price, vs = b.per_share / price - 1;
  const slider = (id, label, min, max, step, val, out, hint) => `<div class="ctl"><label>${label} <span class="val" id="${id}-o">${out}</span></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><div class="hint">${hint}</div></div>`;
  const seg = k => inp.segs.find(s => s.key === k), F = seg('food'), I = seg('instamart'), O = seg('ooh');
  const total = Object.values(b.segments).reduce((a, v) => a + v.pv, 0);
  const rows = inp.segs.map(s => {
    const v = b.segments[s.key], si_ = si.segments.find(z => z.key === s.key);
    return `<tr><td>${esc(s.name.split(' (')[0])}</td><td class="n">${fmt.n(s.gov)}</td><td class="n">${pc(s.margin0, 1)}</td><td class="n">${pc(s.g1, 0)}</td><td class="n">${pc(s.target, 1)} (${s.years}y)</td><td class="n">${sg(v.pv)}</td><td class="n">${(v.pv / s.gov).toFixed(2)}x</td><td class="n">${sg(x.marginal[s.key])}</td></tr>`;
  }).join('');
  const steps = [...inp.segs.map(s => ({ label: s.name.split(' (')[0].replace('Out-of-home', 'Out of home').replace('Food delivery', 'Food'), value: b.segments[s.key].pv, kind: 'step' })),
    { label: 'Central costs', value: b.central, kind: 'step' }, { label: 'Other', value: b.other, kind: 'step' }, { label: 'Tax', value: b.tax, kind: 'step' },
    { label: 'Cash', value: b.cash, kind: 'step' }, { label: 'Equity', value: null, kind: 'total' }];
  const wf = waterfallChart(steps, { h: 250, fmtY: v => fmt.n(v) });
  const yrs = b.paths.food.map(r => 'Y' + r.year);
  const res = barChart(yrs, inp.segs.map((s, i) => ({ name: s.name.split(' (')[0], values: b.paths[s.key].map(r => r.result), cls: ['bar', 'bar2', 'bar3'][i] })));
  const imp = x.implied_target, ik = x.solve_key;
  const head = `<p class="small" style="margin-top:0">Each segment is valued on its own growth and margin path, then the parts are added. Under the assumptions below the parts add up to <b>${fmt.rs(b.per_share)} a share</b>, which is ${pc(Math.abs(vs), 0)} ${vs < 0 ? 'below' : 'above'} the market price of ${fmt.rs(price)}. That is one set of assumptions, not a verdict.</p>
    ${imp == null ? `<div class="note">No Instamart margin up to 40% reproduces today’s price with the other assumptions held, so the market is pricing something this model cannot express.</div>` :
      `<div class="note info"><b>What the price needs from Instamart.</b> Holding every other assumption fixed, ${fmt.rs(price)} needs Instamart’s segment margin to reach <b>${pc(imp, 1)} of order value</b> in ${I.years} years (it is ${pc(I.margin0, 1)} today, and the base assumption here is ${pc(I.target, 1)}). At that margin Instamart adds <b>₹${fmt.n(x.implied_marginal)} crore</b> to equity, ${pc(x.implied_marginal / x.market_cap, 0)} of the market value. Management says the top tenth of stores earn 3 to 5% contribution margin, before overheads (claim, Q4 FY26 letter).</div>`}`;
  const evid = si.segments.map(s => `<li><b>${esc(s.name)}:</b> ${esc(s.evidence)}</li>`).join('');
  return `${head}
    <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Segment</th><th class="n">Order value</th><th class="n">Margin FY26</th><th class="n">Growth</th><th class="n">Target</th><th class="n">Segment value</th><th class="n">Value / order value</th><th class="n">Adds to equity</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted" style="margin:6px 0 12px">FY26 figures: ${inp.segs.map(s => esc(s.name.split(' (')[0]) + ' ' + srcTags(p, si.segments.find(z => z.key === s.key).src)).join('; ')}. Segment value is before central costs and tax. Margin is segment result divided by order value, before share-based pay and depreciation. “Adds to equity” is the equity value with the segment minus the value without it, so it includes its share of central costs and tax, and the three do not add to the total.</p>
    <h4 style="margin:6px 0 4px;font-size:13px">From the parts to equity value, Rs crore</h4>${wf}
    <div class="kv" style="margin-top:8px"><span class="k">Sum of the three segments</span><span class="v">${sg(total)}</span><span class="k">Share-based pay and depreciation, treated as one cost (${pc(inp.central0, 1)} of order value, falling to ${pc(inp.central_target, 1)})</span><span class="v">${sg(b.central)}</span>
      <span class="k">Supply chain and platform innovations (${sg(si.other.result)} a year for ${si.other.years} years)</span><span class="v">${sg(b.other)}</span><span class="k">Tax on combined profit (${pc(inp.tax, 1)}, positive profit only)</span><span class="v">${sg(b.tax)}</span>
      <span class="k">Cash (company figure, June 2026)</span><span class="v">${sg(b.cash)}</span><span class="k"><b>Equity value</b></span><span class="v"><b>${sg(b.equity)}</b></span><span class="k"><b>Per share</b></span><span class="v"><b>${fmt.rs(b.per_share)}</b> (${fmt.spct(vs)})</span></div>
    <h4 style="margin:14px 0 4px;font-size:13px">Segment result by year, Rs crore</h4>${res}
    <h4 class="ctl-h" style="margin:14px 0 6px;font-size:13px">Change the assumptions</h4>
    <div class="note info small static-only">On this published snapshot the assumptions are fixed at their defaults. Run the tool on your own computer to move the sliders and see the answers change.</div>
    <div class="rev-ctl">
      ${slider('sp-fg', 'Food delivery: order value growth, year 1', 0.05, 0.40, 0.01, F.g1, pc(F.g1, 0), 'Guided 18 to 20%; 17.4% in Q1 FY27')}
      ${slider('sp-ft', 'Food delivery: target margin', 0.0, 0.10, 0.005, F.target, pc(F.target, 1), 'Management target 5% (adjusted EBITDA, claim)')}
      ${slider('sp-ig', 'Instamart: order value growth, year 1', 0.05, 0.80, 0.01, I.g1, pc(I.g1, 0), 'FY26 +94%, flat since Q4 FY26')}
      ${slider('sp-it', 'Instamart: target margin (the base case, not the solved one)', 0.0, 0.12, 0.005, I.target, pc(I.target, 1), 'Top stores 3 to 5% contribution (claim)')}
      ${slider('sp-iy', 'Instamart: years to reach it', 3, 10, 1, I.years, I.years + ' years', 'Straight line from today’s margin')}
      ${slider('sp-og', 'Out of home: growth, year 1', 0.0, 0.50, 0.01, O.g1, pc(O.g1, 0), 'Our assumption; no company guidance')}
      ${slider('sp-ot', 'Out of home: target margin', 0.0, 0.15, 0.005, O.target, pc(O.target, 1), 'Our assumption')}
      ${slider('sp-ct', 'Share pay and depreciation, share of order value at maturity', 0.005, 0.04, 0.0025, inp.central_target, pc(inp.central_target, 1), 'FY26: ' + pc(inp.central0, 1))}
      ${slider('sp-ri', 'Reinvestment per rupee of added order value', 0, 0.06, 0.005, inp.ri, pc(inp.ri, 1), 'Our assumption')}
    </div><p style="margin:6px 0 12px"><button class="btn" id="sp-reset">Reset to defaults</button> <span class="small muted">Cost of equity ${pc(inp.ke, 1)}, long-run growth ${pc(inp.tg, 0)}, price as of ${fmt.date(inp.price_date)}${inp.stale ? ' (saved copy)' : ''}.</span></p>
    <h4 style="margin:6px 0 4px;font-size:13px">What each segment’s numbers rest on</h4><ul class="small" style="margin:0 0 8px;padding-left:18px">${evid}</ul>
    <div class="note small"><b>Read with care.</b> The growth and margin targets are assumptions; only the FY26 starting points are audited figures. ${esc(si.central.note)} ${esc(si.other.note)} Lease liabilities are not deducted, and past losses earn no tax credit. Supply chain gets no standalone value. There is no peer multiple here because we do not have reliable multiples for these businesses, so each segment is valued on its own cash flows. ${cfChip(si.central.confidence)} ${srcTags(p, si.central.src)}</div>`;
}

function businessView(p, other) {
  const q = p.answers.map(a => `<div class="card qa"><div class="qa-q">${esc(a.q)}</div><div class="qa-a">${esc(a.a)}</div><div class="kpi-f">${cfChip(a.confidence)} ${srcTags(p, a.src)}</div></div>`).join('');
  const legend = Object.keys(CF).map(k => `<span>${cfChip(k)} <span class="small muted">${esc(CF[k][1])}</span></span>`).join('');
  const strong = p.evidence_quality === 'primary';
  return `<div class="stack">
    <div class="card pilot"><div class="muted small">Business profile · pilot · prepared ${fmt.date(p.prepared)} · ${esc(p.period)}</div>
      <div class="headline">${esc(p.headline.text)}</div>
      <div class="kpi-f">${cfChip(p.headline.confidence)} ${srcTags(p, p.headline.src)}</div>
      <div class="note ${strong ? 'info' : ''}" style="margin-top:12px"><b>Evidence quality: ${strong ? 'primary documents' : 'press reports, not yet checked'}.</b> ${esc(p.evidence_note)}</div>
      <div class="legend2">${legend}</div></div>
    <h2 class="sec" style="margin:6px 0 0">The seven questions</h2><div class="qa-grid">${q}</div>
    ${bizSegments(p)}${bizMoney(p)}${bizReverse(p)}${bizSotp(p)}${bizKpis(p)}${bizCapacity(p)}${bizMomentum(p)}${bizSync(p)}${bizNotes(p)}${bizCompare(p, other)}${bizSources(p)}</div>`;
}

function businessTab(d) {
  const sym = d.meta.ticker.replace('.NS', '');
  const p = S.biz[sym];
  if (p === undefined) { loadBusiness(sym); }
  if (p === undefined || p === null) return `<div class="loading"><div class="spinner"></div><b>Loading the business profile…</b></div>`;
  if (p.error) {
    const av = (p.available || []).map(c => `<a class="chip" href="#/c/${esc(c.symbol)}/business">${esc(c.name.split(' (')[0])}</a>`).join(' ');
    return `<div class="stack" style="max-width:760px"><div class="card"><h2>${esc(d.meta.name)} is not covered yet</h2>
      <p class="small">Business profiles are written company by company, from the company's own documents, and every statement shows its source and how sure we are. This company does not have one yet. Nothing is hidden or broken: the Financials, Industry and Valuation tabs still work for it.</p>
      <p class="small">A profile answers: what it sells, what contributes most to revenue, who the customers are, B2B or B2C, domestic or export, manufacturing or service, and its capacity and utilisation. It then tests what management says against the audited numbers.</p>
      <p class="small"><b>Covered so far:</b></p><div class="chips" style="margin-top:6px">${av || '<span class="muted small">none yet</span>'}</div>
      <p class="small muted" style="margin:12px 0 0">This is a pilot, so coverage is limited to these companies.</p></div></div>`;
  }
  const other = (S.bizList || []).map(c => S.biz[c.symbol]).find(o => o && !o.error && o.symbol !== p.symbol);
  return businessView(p, other);
}
async function loadBusiness(sym) {
  if (S.biz[sym] !== undefined) return;
  S.biz[sym] = null;
  try {
    S.biz[sym] = await api(`/api/business/${encodeURIComponent(sym)}`);
    const list = await api('/api/business'); S.bizList = list.companies;
    for (const c of list.companies) {
      if (c.symbol !== sym && S.biz[c.symbol] === undefined) { try { S.biz[c.symbol] = await api(`/api/business/${encodeURIComponent(c.symbol)}`); } catch (_) { S.biz[c.symbol] = { error: 'unavailable' }; } }
    }
  } catch (e) { S.biz[sym] = { error: e.message, available: e.body?.available || [] }; }
  if (S.data && S.data.meta.ticker.replace('.NS', '') === sym && S.tab === 'business' && location.hash.startsWith('#/c/')) { const c = $('#content'); if (c) c.innerHTML = businessTab(S.data); }
}
