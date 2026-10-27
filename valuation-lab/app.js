'use strict';
/* ---------------------------------------------------------------- shared blocks */
const yrs = d => d.history.years.map(fmt.fy);
function histTable(d, rows, { src = true } = {}) {
  const h = d.history, head = yrs(d).map(y => `<th class="n">${y}</th>`).join('');
  const srcs = d.data_quality.sources || {};
  const body = rows.map(r => {
    if (r.sec) return `<tr class="sec"><td colspan="${h.years.length + 2}">${esc(r.sec)}</td></tr>`;
    const vals = h[r.key]; if (!vals || vals.every(v => v == null)) return '';
    return `<tr class="${r.total ? 'total' : ''}"><td>${esc(r.label)}</td>${vals.map(v => `<td class="n">${r.f(v)}</td>`).join('')}${src ? `<td class="src" title="${esc(srcs[r.src || r.key] || '')}">${esc((srcs[r.src || r.key] || '').split(' (')[0])}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>Rs crore unless stated</th>${head}${src ? '<th>Source</th>' : ''}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function histRows(d) {
  const crf = v => fmt.n(v);
  if (d.meta.financial_company) return [
    { key: 'net_income', label: 'Net income', f: crf }, { key: 'equity', label: 'Shareholders’ funds', f: crf },
    { key: 'roe', label: 'Return on equity', f: v => fmt.pct(v), src: 'equity' }, { key: 'revenue', label: 'Total income', f: crf },
    { key: 'revenue_growth', label: 'Total income growth', f: v => fmt.pct(v), src: 'revenue' },
    { sec: 'Bank lines from exchange filings' }, { key: 'nii', label: 'Net interest income', f: crf },
    { key: 'gross_npa', label: 'Gross NPA', f: crf }, { key: 'advances', label: 'Advances', f: crf }, { key: 'deposits', label: 'Deposits', f: crf },
  ];
  return [
    { sec: 'Profit and loss' }, { key: 'revenue', label: 'Revenue', f: crf }, { key: 'revenue_growth', label: 'Revenue growth', f: v => fmt.pct(v), src: 'revenue' },
    { key: 'net_income', label: 'Net income', f: crf }, { key: 'net_margin', label: 'Net margin', f: v => fmt.pct(v), src: 'net_income' },
    { key: 'da', label: 'Depreciation and amortisation', f: crf },
    { sec: 'Cash flow' }, { key: 'cfo', label: 'Operating cash flow', f: crf }, { key: 'capex', label: 'Capex', f: crf },
    { key: 'fcf', label: 'Free cash flow (reported)', f: crf, total: true, src: 'cfo' }, { key: 'fcf_normalized', label: 'Free cash flow (normalized capex)', f: crf, src: 'cfo' },
    { sec: 'Balance sheet and returns' }, { key: 'equity', label: 'Shareholders’ equity', f: crf }, { key: 'roe', label: 'Return on equity', f: v => fmt.pct(v), src: 'equity' },
    { key: 'debt', label: 'Total debt', f: crf }, { key: 'cash', label: 'Cash and investments', f: crf },
  ];
}
function notesBlock(d) {
  const w = (d.warnings || []).map(x => `<div class="note">${esc(x)}</div>`).join('');
  return w;
}
function verdictCard(d) {
  const v = d.valuation, up = v.vs_price;
  if (v.per_share < 0) return `<div class="card"><div class="muted small">Model value per share</div><div style="font-size:34px;font-weight:600;font-variant-numeric:tabular-nums">${fmt.rs(v.per_share)}</div><div class="small" style="margin-top:6px">Negative: ${v.type === 'fcff_dcf' ? 'under these assumptions debt exceeds the value of the business' : 'the assumed returns are so far below the cost of equity that value falls below zero'}. A share cannot be worth less than zero, so read this as <b>no value for shareholders at these assumptions</b>, not as a price target. Market price is ${fmt.rs(d.meta.price)}.</div><div class="scen">${v.scenarios.map(s => `<div><div class="nm">${esc(s.name)}</div><div class="v">${fmt.rs(s.per_share)}</div><div class="d">${esc(s.definition)}</div></div>`).join('')}</div></div>`;
  const phrase = Math.abs(up) < 0.02 ? 'about the same as' : `${fmt.pct(Math.abs(up), 0)} ${up > 0 ? 'above' : 'below'}`;
  const sc = v.scenarios.map(s => `<div><div class="nm">${esc(s.name)}</div><div class="v">${fmt.rs(s.per_share)}</div><div class="d">${esc(s.definition)}</div></div>`).join('');
  return `<div class="card"><div class="verdict">
    <div><div class="muted small">Base-case value per share (one scenario of three)</div><div class="big">${fmt.rs(v.per_share)}</div></div>
    <div><div class="vs ${up >= 0 ? 'pos' : 'neg'}">Base case is ${phrase} the market price of ${fmt.rs(d.meta.price)}</div>
    <div class="small muted">${v.type === 'fcff_dcf' ? 'Free-cash-flow DCF' : 'Residual income'} under the assumptions on the right. It moves with them, so read the range below and the reverse view, not this one number. Not a recommendation or a prediction.</div>
    ${v.reverse && v.reverse.implied != null ? `<div class="small" style="margin-top:6px"><b>The market price implies ${v.reverse.kind === 'roe' ? 'a long-run return on equity of ' + fmt.pct(v.reverse.implied, 1) : 'year-1 cash flow growth of ' + fmt.pct(v.reverse.implied, 1)}</b> (reverse view below).</div>` : ''}</div></div>
    <div class="scen">${sc}</div></div>`;
}
function dataQuality(d) {
  const q = d.data_quality, srcs = q.sources || {};
  const labels = { revenue: 'Revenue', net_income: 'Net income', cfo: 'Operating cash flow', capex: 'Capex', da: 'Depreciation', equity: 'Equity', debt: 'Debt', cash: 'Cash', nii: 'Net interest income' };
  const rows = Object.entries(labels).filter(([k]) => srcs[k] && srcs[k] !== 'none').map(([k, l]) => `<tr><td>${l}</td><td class="fx">${esc(srcs[k])}</td></tr>`).join('');
  const worst = {};
  (q.reconciliation || []).forEach(r => { if (r.diff != null) worst[r.field] = Math.max(worst[r.field] || 0, Math.abs(r.diff)); });
  const rec = Object.entries(worst).map(([k, v]) => `${esc(k)} ${fmt.pct(v)}`).join(', ');
  return `<div class="card"><h2>Where this data comes from</h2>
    <p class="small muted" style="margin-top:0">${q.fiscal_years} fiscal years. Exchange filings: ${esc(q.filings_basis || 'not available')}. Yahoo Finance fills recent years and cross-checks the filings.</p>
    <table><tbody>${rows}</tbody></table>
    ${rec ? `<p class="small" style="margin-bottom:0"><b>Cross-check, largest gap between filings and Yahoo on shared years:</b> ${rec}. Cash flow, capex, depreciation and net income that match to 0.0% mean Yahoo’s Indian figures are the filing figures.</p>` : ''}
    ${(q.notes || []).map(n => `<div class="note info small">${esc(n)}</div>`).join('')}</div>`;
}

/* ---------------------------------------------------------------- views */
function statusCard(st) {
  if (!st) return '';
  const i = st.inputs;
  return `<div class="card" style="margin-top:22px"><h2>Market inputs behind every discount rate</h2>
    <div class="kv"><span class="k">10-year G-sec yield</span><span class="v">${fmt.pct(i.rf, 2)} · as of ${fmt.date(i.rf_as_of)}</span>
    <span class="k">India equity risk premium</span><span class="v">${fmt.pct(i.erp, 2)} · as of ${fmt.date(i.erp_as_of)}</span>
    <span class="k">India default spread</span><span class="v">${fmt.pct(i.default_spread, 2)}</span></div>
    ${st.warnings.map(w => `<div class="note" style="margin-top:10px">${esc(w)}</div>`).join('')}
    <p class="small muted" style="margin:10px 0 0">Sources: ${esc(i.rf_source)}. ${esc(i.erp_source)}. Edit <code>market_inputs.json</code> to update these.</p></div>`;
}
function aboutView() {
  return `<div class="stack" style="max-width:820px"><h1>Data and method</h1>
  ${statusCard(S.status)}
  <div class="card"><h2>What is built</h2><ul class="small" style="margin:0;padding-left:18px">
    <li><b>Equity research</b>: real financial history, a free-cash-flow DCF for industrials and a residual-income model for banks, scenarios, peers and an A4 report.</li>
    <li><b>Portfolio lab</b>: efficient frontier, correlations, weights, risk contributions and a back-test, from real adjusted prices.</li>
    <li><b>Risk lab</b>: Value at Risk (historical, parametric, Monte Carlo), drawdown, Sharpe, Sortino, beta and stress tests.</li>
    <li>Fixed income, options and factors, wealth planner, private deals and Learn are marked “soon” and are not built.</li></ul></div>
  <div class="card"><h2>How a valuation is built</h2><ol class="small" style="padding-left:18px;margin:0">
    <li>Real statements: NSE XBRL filings (profit and loss from about FY2018, cash flow and balance sheet from FY2023) plus Yahoo Finance for recent years. Where both cover a year they are compared.</li>
    <li>Beta is our own regression of weekly returns against Nifty 50, then Blume-adjusted. Yahoo’s beta is not used.</li>
    <li>Cost of equity: G-sec yield less India’s default spread, plus beta times Damodaran’s India premium. Alternatives are shown side by side.</li>
    <li>Industrials: free cash flow, grown from real history on a fading path, discounted at WACC, with a terminal value. Banks: residual income, with a Gordon-growth DDM for comparison.</li>
    <li>Peers: the largest companies in the same Yahoo industry within the Nifty 500; their P/E and P/B quartiles times the company’s own EPS or book value give the peer bars.</li>
    <li>Scenarios are our own simple definitions, written out under each result so they can be challenged.</li></ol></div>
  <div class="card"><h2>Known limits</h2><ul class="small" style="margin:0;padding-left:18px">
    <li>Only four to nine years of company history. Older cash flows need annual-report PDFs (not built).</li>
    <li>FY2025 and FY2026 come from Yahoo only; NSE’s newer filing format is not parsed yet.</li>
    <li>Yahoo Finance and NSE’s filing endpoints are unofficial and for personal use. This site must not be put online with them.</li>
    <li>Peer multiples are Yahoo’s and may not match our own definitions. EV/EBITDA is left out because Yahoo’s values for Indian stocks are unreliable.</li>
    <li>Portfolio and risk results use past prices. The portfolio back-test is in-sample and flatters optimised weights.</li>
    <li>Mergers (for example HDFC Bank in 2023) break comparability; the site warns when it detects a jump.</li></ul></div></div>`;
}
function loadingView(sym) {
  return `<div class="loading"><div class="spinner"></div><div><b>Loading real data for ${esc(sym)}…</b></div>
  <div class="small">The first load of a company fetches its statements, exchange filings and prices, which takes 10 to 30 seconds. After that it is instant.</div></div>`;
}
function errorView(sym, e) {
  return `<div class="stack" style="max-width:720px"><h1>${esc(sym)}</h1><div class="note err"><b>${e.kind === 'not_meaningful' ? 'A valuation would be meaningless here' : e.kind === 'not_found' ? 'We could not find that company' : e.kind === 'rate_limited' ? 'Yahoo Finance is limiting requests' : 'Something went wrong'}</b><br>${esc(e.message)}</div>
  <div class="small muted">Check the NSE symbol (for example M&amp;M, BAJAJ-AUTO), or try another company.</div>
  <p><a class="btn" href="#/">Back to search</a>${e.kind === 'not_meaningful' ? ' <button class="btn" id="retry-norm">Try normalized capex</button>' : ''}${e.kind === 'rate_limited' ? ' <button class="btn" onclick="location.reload()">Try again</button>' : ''}</p></div>`;
}

function companyShell(d, content) {
  const m = d.meta, tabs = [['overview', 'Overview'], ['business', 'Business'], ['financials', 'Financials'], ['industry', 'Industry'], ['valuation', 'Valuation'], ['report', 'Report']];
  return `<div class="co-head"><div><h1>${esc(m.name)}</h1><div class="sub">${esc(m.ticker)} · ${esc(m.sector)} · ${esc(m.industry)}</div></div>
    <div class="px"><div class="big">${fmt.rs2(m.price)}</div><div class="small">Close of ${fmt.date(m.price_date)} · Market cap ₹${fmt.n(m.market_cap_cr)} crore</div></div></div>
    <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/c/${esc(S.sym)}/${k}" class="${S.tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="content">${content}</div>`;
}

const valOk = d => d.valuation && d.valuation.type !== 'unavailable';
function modelCard(d) {
  const v = d.valuation;
  if (!valOk(d)) return `<div class="card"><h2>Model value</h2><div class="muted" style="font-size:20px;font-weight:600">Not available</div>
    <p class="small muted">${esc(v.reason)}</p>
    <a class="btn primary" href="#/c/${esc(S.sym)}/business">How it makes money</a> <a class="btn" href="#/c/${esc(S.sym)}/valuation">Why</a></div>`;
  return `<div class="card"><h2>Model value</h2><div class="num" style="font-size:28px;font-weight:600">${fmt.rs(v.per_share)}</div>
    <div class="${v.vs_price >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${fmt.spct(v.vs_price)} vs market price</div>
    <p class="small muted">${v.type === 'fcff_dcf' ? 'Free-cash-flow DCF' : 'Residual income'} on default assumptions.</p>
    <a class="btn primary" href="#/c/${esc(S.sym)}/valuation">Open valuation</a></div>`;
}
function unavailableValuation(d) {
  const v = d.valuation, sym = esc(S.sym);
  return `<div class="stack" style="max-width:760px"><div class="card"><h2>A valuation is not available for ${esc(d.meta.name)}</h2>
    <div class="note" style="margin-top:8px">${esc(v.reason)}</div><p class="small">${esc(v.why)}</p>
    <p class="small"><b>Why this matters:</b> a loss-making company that is still investing has negative free cash flow, so a cash-flow DCF would give a meaningless number. We would rather say so than show one.</p>
    <p class="small"><b>What we plan instead:</b> a driver-based model (stores times orders per store times margin, taken from the company's own letters) and a reverse DCF that asks what growth today's price implies. Neither is built yet.</p>
    <p class="small"><b>What you can use now:</b></p>
    <div class="chips" style="margin-top:4px"><a class="chip" href="#/c/${sym}/business">Business: how it makes money</a><a class="chip" href="#/c/${sym}/financials">Financials</a><a class="chip" href="#/c/${sym}/industry">Industry and peers</a></div></div></div>`;
}
function overviewTab(d) {
  const p = d.profile, v = d.valuation, h = d.history, n = h.years.length, last5 = Math.max(0, n - 5);
  const slice = k => h[k].slice(last5);
  const lab = h.years.slice(last5).map(fmt.fy);
  const snap = [['Market cap', '₹' + fmt.n(p.market_cap_cr) + ' crore'], ['P/E (price / diluted EPS)', p.pe ? p.pe.toFixed(1) + 'x' : '–'], ['Price / book', p.pb ? p.pb.toFixed(2) + 'x' : '–'],
    ['Dividend yield', fmt.pct(p.dividend_yield, 2)], ['Return on equity (latest)', fmt.pct(p.roe_latest)], ['EPS', fmt.rs2(p.eps)], ['Book value per share', fmt.rs2(p.bvps)], ['Shares outstanding', fmt.n(p.shares_cr) + ' crore']];
  const bars = d.meta.financial_company
    ? barChart(lab, [{ name: 'Net income', values: slice('net_income'), cls: 'bar' }])
    : barChart(lab, [{ name: 'Revenue', values: slice('revenue'), cls: 'bar2' }, { name: 'Net income', values: slice('net_income'), cls: 'bar' }]);
  const facts = [];
  const g = d.growth_context;
  if (g.y3 != null) facts.push(`Revenue has grown ${fmt.pct(g.y3)} a year over three years${g.y5 != null ? `, ${fmt.pct(g.y5)} over five` : ''}.`);
  if (p.roe_latest != null) facts.push(`Latest return on equity is ${fmt.pct(p.roe_latest)} against a cost of equity of ${fmt.pct(d.ke)}.`);
  if (v.capex_check?.investment_phase) facts.push(`Capex has run at ${v.capex_check.capex_to_da.toFixed(1)} times depreciation, so reported free cash flow understates earning power while it lasts.`);
  if (S.prices?.high_52w) facts.push(`The stock has traded between ${fmt.rs(S.prices.low_52w)} and ${fmt.rs(S.prices.high_52w)} over 52 weeks.`);
  return `<div class="cols"><div class="stack">
      <div class="card"><h2>Share price, 5 years (weekly close)</h2>${S.prices ? lineChart(S.prices.series, { fmtY: v => fmt.n(v) }) : `<p class="muted small">${STATIC ? 'The price chart uses market data that is not republished here. It is in the version that runs on your own computer.' : 'Prices not available.'}</p>`}</div>
      <div class="card"><h2>${d.meta.financial_company ? 'Net income' : 'Revenue and net income'}, last five years</h2>${bars}<p class="small muted" style="margin:6px 0 0">Rs crore; L = lakh crore, k = thousand crore.</p></div>
      <div class="card"><h2>Key figures</h2>${histTable(d, d.meta.financial_company
        ? [{ key: 'net_income', label: 'Net income', f: fmt.n }, { key: 'roe', label: 'Return on equity', f: v => fmt.pct(v), src: 'equity' }, { key: 'revenue', label: 'Total income', f: fmt.n }]
        : [{ key: 'revenue', label: 'Revenue', f: fmt.n }, { key: 'revenue_growth', label: 'Revenue growth', f: v => fmt.pct(v), src: 'revenue' }, { key: 'net_income', label: 'Net income', f: fmt.n }, { key: 'net_margin', label: 'Net margin', f: v => fmt.pct(v), src: 'net_income' }, { key: 'roe', label: 'Return on equity', f: v => fmt.pct(v), src: 'equity' }], { src: false })}</div>
    </div><div class="stack">
      <div class="card"><h2>Snapshot</h2><div class="kv">${snap.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('')}</div></div>
      ${modelCard(d)}
      ${facts.length ? `<div class="card"><h2>What the data says</h2><ul class="small" style="margin:0;padding-left:18px">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      ${notesBlock(d)}
    </div></div>`;
}

function financialsTab(d) {
  const h = d.history, lab = yrs(d);
  const chart = d.meta.financial_company
    ? barChart(lab, [{ name: 'Net income', values: h.net_income, cls: 'bar' }])
    : barChart(lab, [{ name: 'Operating cash flow', values: h.cfo, cls: 'bar2' }, { name: 'Free cash flow (reported)', values: h.fcf, cls: 'bar' }, { name: 'Free cash flow (normalized capex)', values: h.fcf_normalized || [], cls: 'bar3' }]);
  const roeChart = h.roe.some(v => v != null) ? lineChart(h.years.map((y, i) => [fmt.fy(y), h.roe[i]]).filter(p => p[1] != null), { fmtY: v => fmt.pct(v, 0), ref: { value: d.ke, label: 'Cost of equity ' + fmt.pct(d.ke) } }) : '';
  return `<div class="stack">
    <div class="card"><h2>Financial history</h2><p class="small muted" style="margin-top:0">Fiscal years end 31 March. Years with no data are blank, not zero.</p>${histTable(d, histRows(d))}</div>
    <div class="card"><h2>${d.meta.financial_company ? 'Net income' : 'Cash flow'} by year</h2>${chart}</div>
    ${roeChart ? `<div class="card"><h2>Return on equity against the cost of equity</h2>${roeChart}<p class="small muted" style="margin:6px 0 0">Return on equity = net income / average equity, only for years where the previous year is also available.</p></div>` : ''}
    ${dataQuality(d)}${notesBlock(d)}</div>`;
}

/* ----- valuation tab */
function ctl(o) { // o: key,label,min,max,step,value,fmt,auto(boolean|null), hint
  const auto = o.auto != null ? `<label class="auto"><input type="checkbox" data-auto="${o.key}" ${o.auto ? 'checked' : ''}> auto</label>` : '';
  return `<div class="ctl"><label><span>${o.label}</span>${auto}</label>
    <div class="val" style="text-align:right;font-size:13px" data-val="${o.key}">${o.fmt(o.value)}</div>
    <input type="range" data-ctl="${o.key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}" aria-label="${esc(o.label)}">
    ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
}
function panelHtml(d) {
  const v = d.valuation, p = S.params, mi = d.market_inputs, fin = d.meta.financial_company;
  const effErp = p.erp ?? (p.ke_method === 'practitioner' ? 0.06 : mi.erp);
  const keSel = `<div class="ctl"><label><span>Cost of equity method</span></label><select data-ctl="ke_method" aria-label="Cost of equity method">
    ${d.ke_methods.map(k => `<option value="${k.key}" ${k.used ? 'selected' : ''}>${esc(k.label)}: ${fmt.pct(k.value, 2)}</option>`).join('')}</select>
    <div class="hint">Adjusted removes the default spread so country risk is not counted twice.</div></div>`;
  const erp = ctl({ key: 'erp', label: 'Equity risk premium', min: 0.03, max: 0.10, step: 0.0025, value: effErp, fmt: x => fmt.pct(x, 2), auto: p.erp == null });
  const tg = ctl({ key: 'terminal_g', label: 'Terminal growth', min: 0.02, max: 0.08, step: 0.0025, value: p.terminal_g ?? 0.05, fmt: x => fmt.pct(x, 2), hint: 'Capped at the G-sec yield. Nominal GDP growth in India is higher; staying low is cautious.' });
  let body;
  if (!fin) {
    const gv = p.growth ?? v.growth.year1;
    body = keSel + erp +
      ctl({ key: 'growth', label: 'Year-1 cash flow growth', min: -0.05, max: 0.30, step: 0.005, value: gv, fmt: x => fmt.pct(x, 1), auto: p.growth == null, hint: 'Auto uses real revenue growth, bounded to 4–15%. It then fades to terminal growth.' }) +
      tg + ctl({ key: 'years', label: 'Forecast years', min: 5, max: 15, step: 1, value: p.years ?? 10, fmt: x => x + ' years' }) +
      ctl({ key: 'cagr_years', label: 'Growth look-back window', min: 1, max: 7, step: 1, value: p.cagr_years ?? 3, fmt: x => x + ' years', hint: 'A window that starts at the FY21 COVID low flatters growth.' }) +
      `<div class="ctl"><label><span>Capex basis</span></label><div class="seg" role="group" aria-label="Capex basis">
        <button data-seg="capex" data-v="reported" class="${(p.capex || 'reported') === 'reported' ? 'on' : ''}">Reported</button>
        <button data-seg="capex" data-v="normalized" class="${p.capex === 'normalized' ? 'on' : ''}">Normalized</button></div>
        <div class="hint">Normalized = depreciation plus growth on fixed assets, instead of actual capex.</div></div>`;
  } else {
    const lv = p.lr_roe ?? v.assumptions.long_run_roe;
    body = keSel + erp +
      ctl({ key: 'lr_roe', label: 'Long-run return on equity', min: 0.06, max: 0.25, step: 0.0025, value: lv, fmt: x => fmt.pct(x, 2), auto: p.lr_roe == null, hint: 'Auto = cost of equity: no excess return forever. This is the assumption the value depends on most.' }) +
      ctl({ key: 'roe_years', label: 'Years averaged for starting ROE', min: 1, max: 6, step: 1, value: p.roe_years ?? 3, fmt: x => x + ' years', hint: 'Use fewer years if a merger distorted recent ROE.' }) +
      tg + ctl({ key: 'g_cap', label: 'Growth cap for Gordon DDM', min: 0.03, max: 0.09, step: 0.0025, value: p.g_cap ?? 0.06, fmt: x => fmt.pct(x, 2) });
  }
  return `<div class="card panel"><h2>Assumptions</h2><p class="small muted" style="margin:2px 0 0">Move anything. The result updates immediately.</p>${body}
    <div style="margin-top:16px"><button class="btn" id="reset-params">Reset to defaults</button></div></div>`;
}
function peersReady() { return S.peersSym === S.sym && S.peers && !S.peers.error; }
function footballRows(d) {
  const base = d.valuation.football.slice();
  const imp = peersReady() ? (S.peers.implied || []) : [];
  if (!imp.length) return base;
  const rows = imp.map(x => ({ label: x.label, low: x.low, high: x.high, detail: x.detail }));
  const i52 = base.findIndex(r => r.label.startsWith('52-week'));
  return i52 < 0 ? [...base, ...rows] : [...base.slice(0, i52), ...rows, ...base.slice(i52)];
}
function footballNote() {
  if (STATIC) return 'Peer and trading-range bars use live market data, which is not republished here.';
  if (S.peersSym === S.sym && S.peers && S.peers.error) return 'Peer data could not be loaded, so there is no market-multiple bar.';
  if (!peersReady()) return 'Peer bars appear once peer data has loaded.';
  return S.peers.implied.length ? `Peer bars use Yahoo’s P/E${S.data.meta.financial_company ? ' and P/B' : ''} for the largest companies in the same industry (${S.peers.basis}).` : 'Too few peers with usable multiples to draw a peer bar.';
}
function footballInner(d) {
  return `<h2>Football field</h2><p class="small muted" style="margin-top:0">Each bar is a range of values per share from a different reading of the data, against today’s price. ${esc(footballNote())}</p>${footballChart(footballRows(d), d.meta.price)}`;
}
function peerRow(r, cls = '') {
  return `<tr class="${cls}"><td>${esc(r.symbol)}</td><td class="nm-cell">${esc(r.name || '')}</td><td class="n">${r.market_cap_cr == null ? '–' : fmt.n(r.market_cap_cr)}</td><td class="n">${r.pe == null ? '–' : r.pe.toFixed(1) + 'x'}</td><td class="n">${r.pb == null ? '–' : r.pb.toFixed(2) + 'x'}</td><td class="n">${r.roe == null ? '–' : fmt.pct(r.roe, 1)}</td><td class="n">${r.margin == null ? '–' : fmt.pct(r.margin, 1)}</td></tr>`;
}
function industryTab(d) {
  if (S.peersSym === S.sym && S.peers && S.peers.error) return `<div class="note err">${esc(S.peers.error)}</div>`;
  if (!peersReady()) return `<div class="loading"><div class="spinner"></div><b>Loading peers…</b><div class="small">Fetching the largest companies in this industry. The first time takes 5 to 15 seconds.</div></div>`;
  const P = S.peers, st = P.stats, q = (b, f) => b ? `${f(b.median)} <span class="muted small">(${f(b.p25)} to ${f(b.p75)})</span>` : '–';
  return `<div class="stack"><div class="card"><h2>Peers</h2><p class="small muted" style="margin-top:0">${esc(P.peers.length)} largest companies by market cap in the same group (${esc(P.basis)}), out of ${P.count_considered} considered in the Nifty 500 industry “${esc(P.nifty_industry)}”.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Symbol</th><th>Company</th><th class="n">Market cap (Rs crore)</th><th class="n">P/E</th><th class="n">P/B</th><th class="n">ROE</th><th class="n">Net margin</th></tr></thead><tbody>
    ${peerRow(P.company, 'total')}${P.peers.map(r => peerRow(r)).join('')}
    <tr class="sec"><td colspan="7">Peer median (25th to 75th percentile, ${esc(st.pe ? st.pe.n : 0)} peers)</td></tr>
    <tr><td colspan="3">Peers only, excluding ${esc(P.company.symbol)}</td><td class="n">${q(st.pe, x => x.toFixed(1) + 'x')}</td><td class="n">${q(st.pb, x => x.toFixed(2) + 'x')}</td><td class="n">${q(st.roe, x => fmt.pct(x, 0))}</td><td></td></tr></tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">${esc(P.source)}</p></div>
    ${P.implied.length ? `<div class="card"><h2>What peer multiples imply for ${esc(P.company.symbol)}</h2><p class="small muted" style="margin-top:0">Peer multiples applied to this company’s own earnings or book value. They say what the market pays for similar companies, not what this one is worth.</p>
      ${footballChart(P.implied.map(x => ({ label: x.label, low: x.low, high: x.high, detail: x.detail })), d.meta.price)}
      <ul class="small" style="margin:6px 0 0;padding-left:18px">${P.implied.map(x => `<li>${esc(x.detail)}: ${fmt.rs(x.low)} to ${fmt.rs(x.high)} (median ${fmt.rs(x.median)}).</li>`).join('')}</ul></div>` : '<div class="note info">Too few peers with usable multiples to compute an implied range.</div>'}
    ${d.meta.financial_company ? '<div class="note info small">This peer group mixes private and public-sector banks, which trade at very different multiples, so the range is wide.</div>' : ''}</div>`;
}
async function loadPeers(sym) {
  if (S.peersSym === sym && S.peers && !S.peers.error) return;
  S.peers = null; S.peersSym = sym;
  try { S.peers = await api(`/api/peers/${encodeURIComponent(sym)}`); } catch (e) { S.peers = { error: e.message }; }
  if (S.sym !== sym || !S.data || !location.hash.startsWith('#/c/')) return;
  if (S.tab === 'industry') { const c = $('#content'); if (c) c.innerHTML = industryTab(S.data); }
  else if (S.tab === 'valuation') { const fc = $('#football-card'); if (fc) fc.innerHTML = footballInner(S.data); }
  else if (S.tab === 'report') render();
}


/* ----- valuation charts built from the engine output (nothing invented) */
function scenarioRange(v) {
  const vals = (v.scenarios || []).map(x => x.per_share).filter(x => x != null && x > 0);
  return vals.length >= 2 ? { low: Math.min(...vals), high: Math.max(...vals) } : {};
}
function fanCard(d, w = 640, h = 240) {
  if (!S.prices || !S.prices.series) return '';
  const r = scenarioRange(d.valuation);
  return priceFanChart(S.prices.series, { value: d.valuation.per_share, low: r.low, high: r.high, w, h });
}
function waccDonut(w, size = 190) {
  const ke = w.ke * w.equity_weight, kd = w.kd * (1 - w.tax) * w.debt_weight;
  return `<div class="donut-row">${donutChart([{ label: 'Equity', value: w.equity_weight, cls: 'dn-e' }, { label: 'Debt', value: w.debt_weight, cls: 'dn-d' }], { big: fmt.pct(w.wacc, 1), small: 'WACC', size })}
    <div class="donut-legend"><div><i style="background:var(--accent)"></i>Equity ${fmt.pct(w.equity_weight, 0)} at ${fmt.pct(w.ke, 1)}: adds ${fmt.pct(ke, 2)}</div>
    <div><i style="background:var(--muted)"></i>Debt ${fmt.pct(w.debt_weight, 0)} at ${fmt.pct(w.kd, 1)} before tax, ${fmt.pct(w.kd * (1 - w.tax), 1)} after: adds ${fmt.pct(kd, 2)}</div></div></div>`;
}
function evWaterfall(v, h = 230) {
  const steps = v.projection.map(r => ({ label: 'FY' + String(r.fy).slice(2), value: r.pv, kind: 'step' }));
  steps.push({ label: 'Terminal', value: v.bridge.pv_terminal_cr, kind: 'step' }, { label: 'EV', value: null, kind: 'total' });
  return waterfallChart(steps, { h });
}
function bankWaterfall(v, h = 200) {
  const b = v.bridge;
  return waterfallChart([{ label: 'Book value', value: b.book_value, kind: 'step' }, { label: 'PV of RI', value: b.pv_residual_income, kind: 'step' },
    { label: 'PV of terminal', value: b.pv_terminal, kind: 'step' }, { label: 'Value', value: null, kind: 'total' }], { h, fmtY: v => fmt.n(v) });
}

function reverseHtml(d, h = 200) {
  const r = d.valuation.reverse; if (!r) return '';
  const bank = r.kind === 'roe', fx = v => fmt.pct(v, 0);
  const pts = r.curve.filter(c => c.value != null).map(c => [fx(c.x), c.value]);
  let facts;
  if (bank) {
    facts = `<span class="k"><b>Long-run ROE the price implies</b></span><span class="v"><b>${r.implied == null ? 'not reachable' : fmt.pct(r.implied, 1)}</b></span>
      <span class="k">Cost of equity (what shareholders demand)</span><span class="v">${fmt.pct(r.ke, 1)}</span>
      <span class="k">Our base case assumes long-run ROE of</span><span class="v">${fmt.pct(r.assumed, 1)}</span>
      <span class="k">ROE actually achieved: average / best / worst (${r.history.years} years)</span><span class="v">${fmt.pct(r.history.average, 1)} / ${fmt.pct(r.history.max, 1)} / ${fmt.pct(r.history.min, 1)}</span>
      <span class="k">Price / book</span><span class="v">${r.price_to_book.toFixed(2)}x</span>
      ${r.implied_hold_years ? `<span class="k">Or: years starting ROE (${fmt.pct(r.roe_start, 1)}) must hold</span><span class="v">${r.implied_hold_years >= 60 ? '60+' : r.implied_hold_years}</span>` : ''}`;
  } else {
    const c = r.history || {};
    facts = `<span class="k"><b>Year-1 cash flow growth the price implies</b></span><span class="v"><b>${r.implied == null ? 'not reachable' : fmt.pct(r.implied, 1)}</b></span>
      <span class="k">Average yearly growth over the forecast</span><span class="v">${r.implied_average_growth == null ? '–' : fmt.pct(r.implied_average_growth, 1)}</span>
      <span class="k">Our base case assumes year-1 growth of</span><span class="v">${fmt.pct(r.assumed, 1)}</span>
      <span class="k">Revenue growth actually achieved: 3 / 5 / 7 years</span><span class="v">${fmt.pct(c.y3)} / ${fmt.pct(c.y5)} / ${fmt.pct(c.y7)}</span>
      <span class="k">Discount rate used</span><span class="v">${fmt.pct(r.discount_rate, 1)}</span>`;
  }
  const chart = lineChart(pts, { w: 640, h, fmtY: v => fmt.n(v), ref: { value: r.price, label: 'Market price ' + fmt.rs(r.price) } });
  return `<p class="small" style="margin-top:0">${esc(r.reading)}</p><div class="kv">${facts}</div>
    <h4 style="margin:14px 0 4px;font-size:13px;color:inherit;background:none;padding:0">${bank ? 'Value per share for each long-run ROE' : 'Value per share for each year-1 growth rate'}</h4>${chart}
    <p class="small muted" style="margin:6px 0 0">Where the line crosses the dashed price line is the ${bank ? 'return' : 'growth'} the market is paying for. Judge whether that is believable against what the company has actually delivered, shown above. This is the same model run backwards, not a forecast.</p>`;
}

function valuationMain(d) {
  const v = d.valuation, fin = d.meta.financial_company;
  let html = verdictCard(d) + notesBlock(d);
  html += `<div class="card" id="football-card">${footballInner(d)}</div>`;
  if (d.valuation.reverse) html += `<div class="card"><h2>Reverse view: what must be true for today's price?</h2>${reverseHtml(d)}</div>`;
  if (S.prices) html += `<div class="card"><h2>Price, one-year range and model value</h2>${fanCard(d)}</div>`;
  html += `<div class="card"><h2>Cost of equity: three ways</h2><div class="tbl-wrap"><table><thead><tr><th>Method</th><th class="n">Ke</th><th>Formula</th></tr></thead><tbody>
    ${d.ke_methods.map(k => `<tr><td>${esc(k.label)}${k.used ? ' <span class="badge-warn" style="background:var(--accent-soft);color:var(--accent)">used</span>' : ''}</td><td class="n">${fmt.pct(k.value, 2)}</td><td class="fx">${esc(k.formula)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Beta ${d.beta.adjusted.toFixed(2)} (raw ${d.beta.raw.toFixed(2)}, R² ${d.beta.r2.toFixed(2)}, ${d.beta.n} weekly returns, ${esc(d.beta.start)} to ${esc(d.beta.end)}), from our own regression against Nifty 50.</p></div>`;
  if (!fin) {
    const w = v.wacc, b = v.bridge, g = v.growth;
    html += `<div class="card"><h2>Discount rate (WACC)</h2>${waccDonut(w)}<div class="kv">
      <span class="k">Cost of equity</span><span class="v">${fmt.pct(w.ke, 2)}</span>
      <span class="k">Cost of debt, pre-tax</span><span class="v">${fmt.pct(w.kd, 2)}</span>
      <span class="k">Tax rate (3-year effective, bounded 15–30%)</span><span class="v">${fmt.pct(w.tax, 2)}</span>
      <span class="k">Weights: equity / debt (market cap, book debt)</span><span class="v">${fmt.pct(w.equity_weight, 1)} / ${fmt.pct(w.debt_weight, 1)}</span>
      <span class="k"><b>WACC</b></span><span class="v"><b>${fmt.pct(w.wacc, 2)}</b></span></div>${w.kd_note ? `<div class="note info small" style="margin-top:10px">${esc(w.kd_note)}</div>` : ''}</div>`;
    html += `<div class="card"><h2>Cash flow forecast</h2>
      <p class="small" style="margin-top:0"><b>Base cash flow:</b> ₹${fmt.n(v.base_cash_flow.value_cr)} crore, the average ${esc(v.base_cash_flow.basis)} of the last 3 years. <b>Growth is an assumption:</b> ${fmt.pct(g.year1, 2)} in year 1 (${esc(g.year1_source)}), fading to ${fmt.pct(g.terminal, 2)} by year ${g.years}.
      Real revenue growth for context: 3-year ${fmt.pct(g.context.y3)}, 5-year ${fmt.pct(g.context.y5)}, 7-year ${fmt.pct(g.context.y7)}. ${esc(g.note)}</p>
      ${barChart(v.projection.map(r => 'FY' + String(r.fy).slice(2)), [{ name: 'Forecast FCF', values: v.projection.map(r => r.fcf), cls: 'bar2' }, { name: 'Present value', values: v.projection.map(r => r.pv), cls: 'bar' }])}
      <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Fiscal year</th><th class="n">Growth</th><th class="n">FCF</th><th class="n">Years out</th><th class="n">Discount factor</th><th class="n">Present value</th></tr></thead><tbody>
      ${v.projection.map(r => `<tr><td>FY${r.fy}</td><td class="n">${fmt.pct(r.growth, 2)}</td><td class="n">${fmt.n(r.fcf)}</td><td class="n">${r.years_out.toFixed(2)}</td><td class="n">${r.discount_factor.toFixed(3)}</td><td class="n">${fmt.n(r.pv)}</td></tr>`).join('')}</tbody></table></div></div>`;
    html += `<div class="card"><h2>How enterprise value is built (Rs crore)</h2><p class="small muted" style="margin-top:0">Each green bar is one year's cash flow brought back to today's money. The terminal bar is everything after the forecast. Together they make the enterprise value.</p>${evWaterfall(v)}</div>`;
    html += `<div class="card"><h2>From enterprise value to value per share (Rs crore)</h2><div class="kv">
      <span class="k">Present value of forecast cash flows</span><span class="v">${fmt.n(b.pv_explicit_cr)}</span>
      <span class="k">Present value of terminal value (${fmt.pct(b.terminal_share, 0)} of the total)</span><span class="v">${fmt.n(b.pv_terminal_cr)}</span>
      <span class="k"><b>Enterprise value</b></span><span class="v"><b>${fmt.n(b.enterprise_value_cr)}</b></span>
      <span class="k">less: total debt</span><span class="v">${fmt.n(b.debt_cr)}</span><span class="k">add: cash and investments</span><span class="v">${fmt.n(b.cash_cr)}</span>
      <span class="k">less: minority interest (book value)</span><span class="v">${fmt.n(b.minority_cr)}</span>
      <span class="k"><b>Equity value</b></span><span class="v"><b>${fmt.n(b.equity_value_cr)}</b></span>
      <span class="k"><b>Value per share</b></span><span class="v"><b>${fmt.rs(b.per_share)}</b></span></div></div>`;
    if (v.capex_check) {
      const c = v.capex_check;
      html += `<div class="card"><h2>Capex check</h2><p class="small" style="margin-top:0">Last-3-year capex is <b>${c.capex_to_da.toFixed(2)}x</b> depreciation. ${esc(c.message)}</p>
        <div class="scen" style="grid-template-columns:repeat(2,1fr)"><div><div class="nm">Reported FCF</div><div class="v">${fmt.rs(c.reported_per_share)}</div></div><div><div class="nm">Normalized FCF</div><div class="v">${fmt.rs(c.normalized_per_share)}</div></div></div></div>`;
    }
  } else {
    const f = v.fundamentals, a = v.assumptions, b = v.bridge, dd = v.ddm;
    html += `<div class="card"><h2>Why not a cash-flow DCF?</h2><p class="small" style="margin:0">${esc(v.why)}</p></div>
    <div class="card"><h2>Starting point from real data</h2><div class="kv">
      <span class="k">Book value per share</span><span class="v">${fmt.rs2(f.bvps)}</span><span class="k">EPS / dividend per share</span><span class="v">${fmt.rs2(f.eps)} / ${fmt.rs2(f.dps)}</span>
      <span class="k">Payout ratio</span><span class="v">${fmt.pct(f.payout, 1)}</span>
      <span class="k">Starting ROE (average of last ${f.roe_window} years)</span><span class="v">${fmt.pct(f.roe_start)}</span>
      <span class="k">ROE history: ${f.roe_years_available} years, average / range</span><span class="v">${fmt.pct(f.roe_average_all)} / ${fmt.pct(f.roe_min)} to ${fmt.pct(f.roe_max)}</span>
      <span class="k">Years ROE was above the cost of equity</span><span class="v">${f.roe_years_above_ke} of ${f.roe_years_available}</span>
      <span class="k">Price / book</span><span class="v">${f.price_to_book.toFixed(2)}x</span></div></div>
    <div class="card"><h2>Residual income forecast</h2><p class="small" style="margin-top:0"><b>Assumptions:</b> ROE holds at ${fmt.pct(f.roe_start)} for ${a.hold_years} years, then fades to ${fmt.pct(a.long_run_roe, 2)} over ${a.fade_years} years (${esc(a.long_run_roe_source)}). Terminal growth ${fmt.pct(a.terminal_growth, 2)}. Payout held at ${fmt.pct(f.payout, 0)}.</p>
      <div class="tbl-wrap"><table><thead><tr><th>Year</th><th class="n">ROE</th><th class="n">Closing book value</th><th class="n">Residual income</th><th class="n">Present value</th></tr></thead><tbody>
      ${v.projection.map(r => `<tr><td>${r.year}</td><td class="n">${fmt.pct(r.roe, 2)}</td><td class="n">${fmt.n(r.closing_bv)}</td><td class="n">${nf2.format(r.residual_income)}</td><td class="n">${nf2.format(r.pv)}</td></tr>`).join('')}</tbody></table></div>
      <div class="kv" style="margin-top:12px"><span class="k">Book value today</span><span class="v">${fmt.rs(b.book_value)}</span><span class="k">Present value of residual income</span><span class="v">${fmt.rs(b.pv_residual_income)}</span>
      <span class="k">Present value of terminal</span><span class="v">${fmt.rs(b.pv_terminal)}</span><span class="k"><b>Value per share</b></span><span class="v"><b>${fmt.rs(b.per_share)}</b></span></div></div>
    <div class="card"><h2>How the value per share is built (Rs)</h2>${bankWaterfall(v)}</div>
    <div class="card"><h2>Gordon growth DDM (simple method)</h2><div class="kv"><span class="k">Sustainable growth = retention × ROE</span><span class="v">${fmt.pct(dd.sgr, 2)}</span>
      <span class="k">Growth applied${dd.capped ? ' (capped)' : ''}</span><span class="v">${fmt.pct(dd.g_applied, 2)}</span><span class="k">D1 = D0 × (1 + g)</span><span class="v">${fmt.rs2(dd.d1)}</span>
      <span class="k"><b>Value per share</b></span><span class="v"><b>${fmt.rs(dd.per_share)}</b> (${fmt.spct(dd.vs_price)})</span></div>${dd.caution ? `<div class="note" style="margin-top:10px">${esc(dd.caution)}</div>` : ''}</div>`;
  }
  html += `<div class="card"><h2>Sensitivity</h2>${heatTable(v.sensitivity, d.meta.price, x => fmt.pct(x, 2), x => fmt.pct(x, 2))}</div>`;
  html += `<div class="note info small">${(v.notes || []).map(esc).join(' ')}</div>`;
  return html;
}
function valuationTab(d) {
  if (!valOk(d)) return unavailableValuation(d);
  return `<div class="cols"><div class="stack" id="valmain">${valuationMain(d)}</div><div id="panelslot">${panelHtml(d)}</div></div>`;
}

/* ----- report (A4 pages, styled after the reference report) */
function page(d, title, inner, n, total) {
  return `<section class="page"><div class="bar">${esc(d.meta.name.toUpperCase())} – ${esc(title)}</div><div class="inner">${inner}</div>
    <div class="foot"><span>Sources: NSE XBRL filings, Yahoo Finance, CCIL, Damodaran. Educational analysis, not investment advice.</span><span>Page ${n} of ${total} · ${fmt.date(d.meta.generated)}</span></div><div class="endbar"></div></section>`;
}
function reportTab(d) {
  if (!valOk(d)) return `<div class="card" style="max-width:720px"><h2>The A4 report needs a valuation</h2><p class="small">${esc(d.valuation.reason)}</p><p class="small muted">The Business tab has the profile for this company.</p><a class="btn" href="#/c/${esc(S.sym)}/business">Open the Business tab</a></div>`;
  const v = d.valuation, p = d.profile, fin = d.meta.financial_company, m = d.meta, pages = [];
  const miniHist = histTable(d, fin
    ? [{ key: 'revenue', label: 'Total income', f: fmt.n }, { key: 'net_income', label: 'Net income', f: fmt.n }, { key: 'net_margin', label: 'Net margin', f: x => fmt.pct(x), src: 'net_income' }, { key: 'equity', label: 'Shareholders’ funds', f: fmt.n }, { key: 'roe', label: 'Return on equity', f: x => fmt.pct(x), src: 'equity' }]
    : [{ key: 'revenue', label: 'Revenue', f: fmt.n }, { key: 'revenue_growth', label: 'Revenue growth', f: x => fmt.pct(x), src: 'revenue' }, { key: 'net_income', label: 'Net income', f: fmt.n }, { key: 'net_margin', label: 'Net margin', f: x => fmt.pct(x), src: 'net_income' }, { key: 'fcf', label: 'Free cash flow', f: fmt.n, src: 'cfo' }, { key: 'roe', label: 'Return on equity', f: x => fmt.pct(x), src: 'equity' }], { src: false });
  const snap = [['Share price', fmt.rs2(m.price)], ['Market cap (Rs crore)', fmt.n(m.market_cap_cr)], ['P/E', p.pe ? p.pe.toFixed(1) + 'x' : '–'], ['Price / book', p.pb ? p.pb.toFixed(2) + 'x' : '–'], ['Dividend yield', fmt.pct(p.dividend_yield, 2)], ['EPS', fmt.rs2(p.eps)], ['Book value per share', fmt.rs2(p.bvps)], ['Return on equity', fmt.pct(p.roe_latest)]];
  const obs = [];
  if (d.growth_context.y3 != null) obs.push(`Revenue growth: ${fmt.pct(d.growth_context.y3)} a year over three years.`);
  obs.push(`Model value ${fmt.rs(v.per_share)} per share, ${fmt.spct(v.vs_price)} against the market price, under the stated assumptions.`);
  if (S.prices?.high_52w) obs.push(`52-week range ${fmt.rs(S.prices.low_52w)} to ${fmt.rs(S.prices.high_52w)}.`);
  if (v.capex_check?.investment_phase) obs.push(`Capex is ${v.capex_check.capex_to_da.toFixed(1)}x depreciation (investment phase).`);
  const total = 8;
  pages.push(page(d, 'One page profile', `<div class="two"><div><h4>Snapshot</h4><div class="kv">${snap.map(([k, x]) => `<span class="k">${k}</span><span class="v">${x}</span>`).join('')}</div></div>
      <div><h4>Share price, 5 years</h4>${S.prices ? lineChart(S.prices.series, { w: 330, h: 170 }) : ''}</div></div>
    <h4>Key financial metrics</h4>${miniHist}<h4>Valuation summary</h4>
    <div class="kv"><span class="k">Method</span><span class="v">${fin ? 'Residual income (bank)' : 'Free-cash-flow DCF'}</span><span class="k">Cost of equity</span><span class="v">${fmt.pct(d.ke, 2)}</span>
    ${fin ? '' : `<span class="k">WACC</span><span class="v">${fmt.pct(v.wacc.wacc, 2)}</span>`}<span class="k">Model value per share</span><span class="v"><b>${fmt.rs(v.per_share)}</b></span><span class="k">Versus market price</span><span class="v">${fmt.spct(v.vs_price)}</span></div>
    <h4>Observations</h4><ul>${obs.map(o => `<li>${esc(o)}</li>`).join('')}</ul>`, 1, total));
  pages.push(page(d, 'Financial history', `<h4>Statements as filed, Rs crore</h4>${histTable(d, histRows(d), { src: false })}<h4>${fin ? 'Net income' : 'Cash flow'}</h4>${fin ? barChart(yrs(d), [{ name: 'Net income', values: d.history.net_income, cls: 'bar' }], { w: 640, h: 190 }) : barChart(yrs(d), [{ name: 'Operating cash flow', values: d.history.cfo, cls: 'bar2' }, { name: 'Free cash flow (reported)', values: d.history.fcf, cls: 'bar' }], { w: 640, h: 190 })}`, 2, total));
  pages.push(page(d, 'Returns and growth', `<h4>Return on equity against the cost of equity</h4>${lineChart(d.history.years.map((y, i) => [fmt.fy(y), d.history.roe[i]]).filter(q => q[1] != null), { fmtY: x => fmt.pct(x, 0), ref: { value: d.ke, label: 'Ke ' + fmt.pct(d.ke) }, w: 640, h: 190 })}
    <h4>Revenue growth context (real data)</h4><div class="kv"><span class="k">3-year</span><span class="v">${fmt.pct(d.growth_context.y3)}</span><span class="k">5-year</span><span class="v">${fmt.pct(d.growth_context.y5)}</span><span class="k">7-year</span><span class="v">${fmt.pct(d.growth_context.y7)}</span></div>
    <div class="note info" style="margin-top:8px">A window that starts at the FY21 COVID low flatters growth.</div>`, 3, total));
  pages.push(page(d, 'Discount rate', `<h4>Cost of equity: three methods</h4><table><thead><tr><th>Method</th><th class="n">Ke</th><th>Formula</th></tr></thead><tbody>${d.ke_methods.map(k => `<tr><td>${esc(k.label)}${k.used ? ' (used)' : ''}</td><td class="n">${fmt.pct(k.value, 2)}</td><td>${esc(k.formula)}</td></tr>`).join('')}</tbody></table>
    <h4>Beta (own regression vs Nifty 50)</h4><div class="kv"><span class="k">Raw beta</span><span class="v">${d.beta.raw.toFixed(2)}</span><span class="k">Blume-adjusted</span><span class="v">${d.beta.adjusted.toFixed(2)}</span><span class="k">R²</span><span class="v">${d.beta.r2.toFixed(2)}</span><span class="k">Weekly returns</span><span class="v">${d.beta.n} (${esc(d.beta.start)} to ${esc(d.beta.end)})</span></div>
    <h4>Market inputs</h4><div class="kv"><span class="k">10-year G-sec yield (${fmt.date(d.market_inputs.rf_as_of)})</span><span class="v">${fmt.pct(d.market_inputs.rf, 2)}</span><span class="k">India equity risk premium (${fmt.date(d.market_inputs.erp_as_of)})</span><span class="v">${fmt.pct(d.market_inputs.erp, 2)}</span><span class="k">India default spread</span><span class="v">${fmt.pct(d.market_inputs.default_spread, 2)}</span></div>
    ${fin ? '' : `<h4>WACC</h4>${waccDonut(v.wacc, 130)}<div class="kv"><span class="k">Cost of debt (pre-tax)</span><span class="v">${fmt.pct(v.wacc.kd, 2)}</span><span class="k">Tax rate</span><span class="v">${fmt.pct(v.wacc.tax, 2)}</span><span class="k">Equity / debt weights</span><span class="v">${fmt.pct(v.wacc.equity_weight, 1)} / ${fmt.pct(v.wacc.debt_weight, 1)}</span><span class="k"><b>WACC</b></span><span class="v"><b>${fmt.pct(v.wacc.wacc, 2)}</b></span></div>`}`, 4, total));
  pages.push(page(d, fin ? 'Residual income valuation' : 'Discounted cash flow', fin
    ? `<div class="note info">${esc(v.why)}</div><h4>Forecast</h4><table><thead><tr><th>Year</th><th class="n">ROE</th><th class="n">Closing BV</th><th class="n">Resid. income</th><th class="n">PV</th></tr></thead><tbody>${v.projection.map(r => `<tr><td>${r.year}</td><td class="n">${fmt.pct(r.roe, 2)}</td><td class="n">${fmt.n(r.closing_bv)}</td><td class="n">${nf2.format(r.residual_income)}</td><td class="n">${nf2.format(r.pv)}</td></tr>`).join('')}</tbody></table>
       <h4>How the value per share is built, Rs</h4>${bankWaterfall(v, 150)}
       <h4>Value per share</h4><div class="kv"><span class="k">Book value today</span><span class="v">${fmt.rs(v.bridge.book_value)}</span><span class="k">PV of residual income</span><span class="v">${fmt.rs(v.bridge.pv_residual_income)}</span><span class="k">PV of terminal</span><span class="v">${fmt.rs(v.bridge.pv_terminal)}</span><span class="k"><b>Value per share</b></span><span class="v"><b>${fmt.rs(v.bridge.per_share)}</b></span><span class="k">Gordon DDM (cross-check)</span><span class="v">${fmt.rs(v.ddm.per_share)}</span></div>`
    : `<div class="note info">Growth is an assumption: ${fmt.pct(v.growth.year1, 2)} in year 1 (${esc(v.growth.year1_source)}), fading to ${fmt.pct(v.growth.terminal, 2)}. Base cash flow ₹${fmt.n(v.base_cash_flow.value_cr)} crore (${esc(v.base_cash_flow.basis)}, 3-year average).</div>
       <h4>Present value of free cash flow, Rs crore</h4><table><thead><tr><th>FY</th><th class="n">Growth</th><th class="n">FCF</th><th class="n">Disc. factor</th><th class="n">PV</th></tr></thead><tbody>${v.projection.map(r => `<tr><td>FY${r.fy}</td><td class="n">${fmt.pct(r.growth, 2)}</td><td class="n">${fmt.n(r.fcf)}</td><td class="n">${r.discount_factor.toFixed(3)}</td><td class="n">${fmt.n(r.pv)}</td></tr>`).join('')}</tbody></table>
       <h4>How enterprise value is built, Rs crore</h4>${evWaterfall(v, 170)}
       <h4>Enterprise value to value per share</h4><div class="kv"><span class="k">PV of forecast cash flows</span><span class="v">${fmt.n(v.bridge.pv_explicit_cr)}</span><span class="k">PV of terminal value</span><span class="v">${fmt.n(v.bridge.pv_terminal_cr)}</span><span class="k"><b>Enterprise value</b></span><span class="v"><b>${fmt.n(v.bridge.enterprise_value_cr)}</b></span><span class="k">less debt / add cash / less minority</span><span class="v">${fmt.n(v.bridge.debt_cr)} / ${fmt.n(v.bridge.cash_cr)} / ${fmt.n(v.bridge.minority_cr)}</span><span class="k"><b>Value per share</b></span><span class="v"><b>${fmt.rs(v.bridge.per_share)}</b></span></div>`, 5, total));
  pages.push(page(d, 'Scenarios and sensitivity', `<h4>Scenarios (our definitions)</h4><table><thead><tr><th>Scenario</th><th class="n">Per share</th><th>Definition</th></tr></thead><tbody>${v.scenarios.map(s => `<tr><td>${esc(s.name)}</td><td class="n">${fmt.rs(s.per_share)}</td><td>${esc(s.definition)}</td></tr>`).join('')}</tbody></table>
    <h4>Sensitivity of value per share</h4>${heatTable(v.sensitivity, m.price, x => fmt.pct(x, 2), x => fmt.pct(x, 2))}
    ${v.reverse ? `<h4>Reverse view: what must be true for today’s price?</h4>${reverseHtml(d, 150)}` : ''}`, 6, total));
  pages.push(page(d, 'Football field analysis', `<h4>Valuation summary, Rs per share</h4>${footballChart(footballRows(d), m.price, { w: 640 })}<div class="note info" style="margin-top:10px">${esc(footballNote())} ${STATIC ? 'Bars come from the model’s own sensitivity and scenarios.' : 'Other bars come from the model’s own sensitivity and scenarios and from actual trading prices.'}</div>${S.prices ? `<h4>Price, one-year range and model value</h4>${fanCard(d, 640, 190)}` : ''}`, 7, total));
  pages.push(page(d, 'Sources, assumptions and caveats', `<h4>Data sources</h4><table><tbody>${Object.entries(d.data_quality.sources || {}).filter(([, s]) => s && s !== 'none').map(([k, s]) => `<tr><td>${esc(k)}</td><td>${esc(s)}</td></tr>`).join('')}</tbody></table>
    <h4>Market inputs</h4><ul><li>${esc(d.market_inputs.rf_source)}</li><li>${esc(d.market_inputs.erp_source)}</li></ul>
    <h4>Caveats</h4><ul>${[...(d.warnings || []), ...(d.data_quality.notes || []), ...(v.notes || [])].map(n => `<li>${esc(n)}</li>`).join('')}
    <li>Yahoo Finance and NSE filing endpoints are unofficial sources for personal use.</li><li>Forecast growth and scenario definitions are assumptions, not data.</li><li>This is educational analysis from public data, not investment advice or a recommendation to buy or sell.</li></ul>`, 8, total));
  return `<div class="report-bar no-print"><div class="small muted">A4 report in the style of your reference. Use Print, then choose “Save as PDF”.</div><button class="btn primary" id="print-btn">Print or save as PDF</button></div>${pages.join('')}`;
}

/* ---------------------------------------------------------------- rendering and routing */
function render() {
  const view = $('#view');
  if (!S.sym || !location.hash.startsWith('#/c/')) { return; }
  if (S.error) { view.innerHTML = errorView(S.sym, S.error); const b = $('#retry-norm'); if (b) b.onclick = () => { S.params.capex = 'normalized'; loadCompany(S.sym); }; return; }
  if (!S.data) { view.innerHTML = loadingView(S.sym); return; }
  const d = S.data;
  const body = { overview: overviewTab, business: businessTab, financials: financialsTab, industry: industryTab, valuation: valuationTab, report: reportTab }[S.tab] || overviewTab;
  view.innerHTML = companyShell(d, body(d));
  document.title = `${d.meta.name} · Valuation Lab`;
}
let debounceT = null;
function schedule() { clearTimeout(debounceT); debounceT = setTimeout(refetch, 220); }
async function refetch(rebuildPanel = false) {
  const seq = ++S.seq, sym = S.sym;
  $('#valmain')?.classList.add('updating');
  try {
    const d = await api(`/api/analyze/${encodeURIComponent(sym)}?${qs(S.params)}`);
    if (seq !== S.seq || sym !== S.sym) return;
    S.data = d; S.error = null;
    const vm = $('#valmain'); if (vm && S.tab === 'valuation') { vm.innerHTML = valuationMain(d); vm.classList.remove('updating'); syncPanel(d); if (rebuildPanel) { const ps = $('#panelslot'); if (ps) ps.innerHTML = panelHtml(d); } }
    else render();
  } catch (e) {
    if (seq !== S.seq) return;
    const vm = $('#valmain'); vm?.classList.remove('updating');
    const note = `<div class="note err" id="ctl-err">${esc(e.message)}</div>`;
    if (vm && S.tab === 'valuation') { $('#ctl-err')?.remove(); vm.insertAdjacentHTML('afterbegin', note); } else { S.error = e; render(); }
  }
}
function syncPanel(d) { // keep auto-driven controls in step with the effective values, without rebuilding the panel
  const v = d.valuation, p = S.params;
  const set = (k, val, f) => { const r = $(`[data-ctl="${k}"]`); if (r && document.activeElement !== r) r.value = val; const lab = $(`[data-val="${k}"]`); if (lab) lab.textContent = f(val); };
  if (p.erp == null) set('erp', p.ke_method === 'practitioner' ? 0.06 : d.market_inputs.erp, x => fmt.pct(x, 2));
  if (v.type === 'fcff_dcf' && p.growth == null) set('growth', v.growth.year1, x => fmt.pct(x, 1));
  if (v.type === 'residual_income' && p.lr_roe == null) set('lr_roe', v.assumptions.long_run_roe, x => fmt.pct(x, 2));
  const ks = $('[data-ctl="ke_method"]'); if (ks) ks.innerHTML = d.ke_methods.map(k => `<option value="${k.key}" ${k.used ? 'selected' : ''}>${esc(k.label)}: ${fmt.pct(k.value, 2)}</option>`).join('');
}
async function loadCompany(sym) {
  const seq = ++S.seq;
  S.sym = sym; S.data = null; S.prices = null; S.error = null; S.peers = null; S.peersSym = null; render();
  try {
    const [d, pr] = await Promise.allSettled([api(`/api/analyze/${encodeURIComponent(sym)}?${qs(S.params)}`), api(`/api/prices/${encodeURIComponent(sym)}`)]);
    if (seq !== S.seq) return;
    if (d.status === 'rejected') { S.error = d.reason; } else { S.data = d.value; }
    S.prices = pr.status === 'fulfilled' ? pr.value : null;
  } catch (e) { S.error = e; }
  if (S.data) { rememberRecent(sym); loadPeers(sym); }
  render();
}
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean);
  const view = $('#view');
  clearTimeout(marketTimer);
  const show = (key, html, title) => { setActive(key); view.innerHTML = html; document.title = title + ' · Valuation Lab'; window.scrollTo(0, 0); };
  if (parts[0] === 'c' && parts[1]) {
    setActive('equity');
    const sym = decodeURIComponent(parts[1]).toUpperCase(), tab = parts[2] || 'overview';
    const same = S.sym === sym && (S.data || S.error);
    S.tab = ['overview', 'business', 'financials', 'industry', 'valuation', 'report'].includes(tab) ? tab : 'overview';
    if (same) { render(); if (S.tab === 'industry' && !S.peers) loadPeers(sym); } else { S.params = {}; loadCompany(sym); }
    window.scrollTo(0, 0);
  } else if (parts[0] === 'about') { show('about', aboutView(), 'Data and method');
  } else if (parts[0] === 'equity') { show('equity', equityView(), 'Equity research'); wireSearch($('#hero-search'));
  } else if (parts[0] === 'portfolio') { show('portfolio', portfolioView(), 'Portfolio lab'); wireLabPicker('pf');
  } else if (parts[0] === 'risk') { show('risk', riskView(), 'Risk lab'); wireLabPicker('rk');
  } else if (parts[0] === 'soon' && parts[1]) { show(parts[1], soonView(parts[1]), (modOf(parts[1]) || {}).label || 'Not found');
  } else { show('home', homeView(), 'Home'); wireSearch($('#hero-search')); loadMarket(); }
}

/* ---------------------------------------------------------------- search */
function wireSearch(box) {
  if (!box) return;
  const input = $('input', box), list = $('.suggest', box); let items = [], idx = -1;
  const go = sym => { list.hidden = true; input.value = ''; input.blur(); location.hash = `#/c/${encodeURIComponent(sym)}`; };
  const draw = () => {
    list.innerHTML = items.map((c, i) => `<button type="button" data-sym="${esc(c.symbol)}" class="${i === idx ? 'on' : ''}"><span class="sym">${esc(c.symbol)}</span><span class="nm">${esc(c.name)}</span></button>`).join('');
    list.hidden = !items.length;
  };
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase(); idx = -1;
    if (!q) { items = []; draw(); return; }
    const scored = S.universe.map(c => { const s = c.symbol.toLowerCase(), n = c.name.toLowerCase(); let k = 9; if (s === q) k = 0; else if (s.startsWith(q)) k = 1; else if (n.startsWith(q)) k = 2; else if (n.includes(q)) k = 3; else if (s.includes(q)) k = 4; return [k, c]; }).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0]);
    items = scored.slice(0, 8).map(x => x[1]); draw();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(-1, idx - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Escape') { list.hidden = true; }
    else if (e.key === 'Enter') {
      const typed = input.value.trim(); if (!typed) return;
      if (idx >= 0) go(items[idx].symbol); else if (items.length) go(items[0].symbol); else go(typed.toUpperCase());
    }
  });
  list.addEventListener('mousedown', e => { const b = e.target.closest('button[data-sym]'); if (b) { e.preventDefault(); go(b.dataset.sym); } });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
}

/* ---------------------------------------------------------------- events */
document.addEventListener('input', e => {
  const r = e.target.closest('[data-ctl]'); if (!r || r.tagName !== 'INPUT') return;
  const k = r.dataset.ctl, val = parseFloat(r.value);
  S.params[k] = val;
  const f = { erp: x => fmt.pct(x, 2), growth: x => fmt.pct(x, 1), terminal_g: x => fmt.pct(x, 2), lr_roe: x => fmt.pct(x, 2), g_cap: x => fmt.pct(x, 2) }[k] || (x => x + ' years');
  const lab = $(`[data-val="${k}"]`); if (lab) lab.textContent = f(val);
  const a = $(`[data-auto="${k}"]`); if (a) a.checked = false;
  schedule();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('select[data-ctl="ke_method"]')) { S.params.ke_method = t.value; schedule(); }
  if (t.matches('[data-auto]')) {
    const k = t.dataset.auto;
    if (t.checked) { S.params[k] = null; } else { const r = $(`[data-ctl="${k}"]`); S.params[k] = parseFloat(r.value); }
    schedule();
  }
});
document.addEventListener('click', e => {
  const seg = e.target.closest('[data-seg]');
  if (seg) { S.params[seg.dataset.seg] = seg.dataset.v; $$(`[data-seg="${seg.dataset.seg}"]`).forEach(b => b.classList.toggle('on', b === seg)); schedule(); }
  if (e.target.closest('#reset-params')) { S.params = {}; clearTimeout(debounceT); refetch(true); }
  if (e.target.closest('#print-btn')) window.print();
});

/* ---------------------------------------------------------------- boot */
async function boot() {
  restoreLab(); setActive('home'); wireSearch($('#nav-search'));
  window.addEventListener('hashchange', route);
  api('/api/universe').then(u => { S.universe = u.companies; if (location.hash.startsWith('#/equity')) route(); }).catch(() => { });
  api('/api/business').then(b => { S.bizList = b.companies; if (location.hash.startsWith('#/equity')) route(); }).catch(() => { });
  try {
    S.status = await api('/api/status');
    if (S.status.warnings.length) $('#status-badge').innerHTML = `<a href="#/about" class="badge-warn" style="text-decoration:none">${S.status.warnings.length} input warning${S.status.warnings.length > 1 ? 's' : ''}</a>`;
  } catch (_) { /* status is optional */ }
  route();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-browse]'); if (b) { S.browse = b.dataset.browse; $('#view').innerHTML = equityView(); wireSearch($('#hero-search')); } });
boot();
