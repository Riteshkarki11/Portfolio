'use strict';
/* Portfolio lab and Risk lab. Everything shown comes from /api/portfolio and /api/risk (real adjusted prices). */

const persistLab = () => { store.set('pf', { symbols: S.pf.symbols, years: S.pf.years, mu_method: S.pf.mu_method, max_weight: S.pf.max_weight });
  store.set('rk', { symbols: S.rk.symbols, years: S.rk.years, confidence: S.rk.confidence, horizon: S.rk.horizon, value: S.rk.value }); };
function restoreLab() {
  const p = store.get('pf', null), r = store.get('rk', null);
  if (p) Object.assign(S.pf, p); if (r) Object.assign(S.rk, r);
}
function seg(attr, key, options, current) {
  return `<div class="seg" role="group">${options.map(([v, l]) => `<button type="button" data-${attr}="${key}" data-v="${v}" class="${String(current) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function refreshPicker(which) {
  const L = which === 'pf' ? S.pf : S.rk, id = which + '-picker', el = document.getElementById(id); if (!el) return;
  el.outerHTML = pickerHtml(id, L.symbols);
  wirePicker(id, () => L.symbols, l => { L.symbols = l; persistLab(); refreshPicker(which); });
}
const errBox = e => `<div class="note err">${esc(e.message)}</div>`;

/* ---------------------------------------------------------------- portfolio lab */
function portfolioView() {
  const P = S.pf;
  return `<div class="page-head"><h1>Portfolio lab</h1><p class="muted">Choose 8 to 15 stocks. The lab builds the efficient frontier, three reference portfolios, correlations, risk contributions and a back-test, all from real adjusted prices.</p></div>
  <div class="cols"><div class="stack" id="pf-out">${P.result ? portfolioResults(P.result) : `<div class="card"><p class="muted" style="margin:0">Add stocks on the right, then press <b>Run analysis</b>. The sample button loads ten large Indian companies across sectors.</p></div>`}</div>
  <div class="card panel"><h2>Your stocks</h2>${pickerHtml('pf-picker', P.symbols)}
    <div class="row-btns"><button class="btn" data-pf-act="sample">Load sample</button><button class="btn" data-pf-act="clear">Clear</button></div>
    <div class="ctl"><label><span>History used</span></label>${seg('pf', 'years', [[1, '1 year'], [3, '3 years'], [5, '5 years']], P.years)}</div>
    <div class="ctl"><label><span>Expected returns</span></label>${seg('pf', 'mu_method', [['capm', 'CAPM'], ['historical', 'Past average']], P.mu_method)}
      <div class="hint">CAPM: G-sec less default spread plus beta times the India premium. Past average is each stock’s own history and chases recent winners.</div></div>
    <div class="ctl"><label><span>Maximum weight per stock</span><span class="val" id="pf-cap-val">${fmt.pct(P.max_weight, 0)}</span></label>
      <input type="range" data-pf="max_weight" min="0.10" max="0.50" step="0.05" value="${P.max_weight}" aria-label="Maximum weight per stock"><div class="hint">Stops the optimiser putting everything in one or two stocks.</div></div>
    <div style="margin-top:16px"><button class="btn primary" data-pf-act="run" id="pf-run" style="width:100%">Run analysis</button></div><div id="pf-msg"></div></div></div>`;
}
function portfolioResults(R) {
  const ports = R.portfolios, sel = ports.find(p => p.name === S.pf.pick) || ports[1] || ports[0];
  const cards = ports.map(p => `<div class="card pcard ${p.name === sel.name ? 'sel' : ''}"><div class="nm">${esc(p.name)}</div>
    <div class="kv"><span class="k">Expected return</span><span class="v">${fmt.pct(p.ret)}</span><span class="k">Risk (volatility)</span><span class="v">${fmt.pct(p.vol)}</span>
    <span class="k">Sharpe ratio</span><span class="v">${p.sharpe.toFixed(2)}</span><span class="k">Effective number of stocks</span><span class="v">${p.effective_n.toFixed(1)}</span>
    <span class="k">Diversification ratio</span><span class="v">${p.diversification_ratio.toFixed(2)}</span>
    <span class="k">Back-test growth a year</span><span class="v">${fmt.pct(p.backtest.cagr)}</span><span class="k">Worst fall</span><span class="v">${fmt.pct(p.backtest.max_drawdown, 1)}</span></div>
    <div class="row-btns"><button class="btn" data-pf-act="select" data-name="${esc(p.name)}">Focus</button><button class="btn" data-pf-act="torisk" data-name="${esc(p.name)}">Open in Risk lab</button></div></div>`).join('');
  const syms = R.inputs.symbols;
  const wRows = syms.map(s => `<tr><td>${esc(s)}</td>${ports.map(p => { const w = p.weights[s]; return `<td class="n"><span class="wbar"><span style="width:${(w / R.inputs.max_weight * 100).toFixed(0)}%"></span></span> ${fmt.pct(w, 1)}</td>`; }).join('')}</tr>`).join('');
  const rc = syms.map(s => ({ label: s, w: sel.weights[s], r: sel.risk_contribution[s] })).sort((a, b) => b.r - a.r);
  const sect = Object.entries(sel.sectors).map(([k, v]) => ({ label: k, value: v }));
  const bm = R.benchmark;
  return `${(R.warnings || []).map(w => `<div class="note">${esc(w)}</div>`).join('')}
  <p class="small muted" style="margin:0">${R.inputs.days} trading days, ${fmt.date(R.inputs.start)} to ${fmt.date(R.inputs.end)}. Risk-free rate ${fmt.pct(R.inputs.rf, 2)} (10-year G-sec).</p>
  <div class="pcards">${cards}</div>
  <div class="card"><h2>Efficient frontier</h2><p class="small muted" style="margin-top:0">Each point on the curve is the lowest-risk portfolio for its expected return, with every stock capped at ${fmt.pct(R.inputs.max_weight, 0)}. Dots are single stocks; squares are the reference portfolios.</p>${frontierChart(R.frontier, R.assets, ports, R.inputs.rf)}</div>
  <div class="card"><h2>Weights</h2><div class="tbl-wrap"><table><thead><tr><th>Stock</th>${ports.map(p => `<th class="n">${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${wRows}</tbody></table></div></div>
  <div class="card"><h2>Where the risk comes from: ${esc(sel.name)}</h2><p class="small muted" style="margin-top:0">A stock’s share of portfolio risk is often very different from its weight.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Stock</th><th class="n">Weight</th><th class="n">Share of risk</th><th></th></tr></thead><tbody>${rc.map(x => `<tr><td>${esc(x.label)}</td><td class="n">${fmt.pct(x.w, 1)}</td><td class="n">${fmt.pct(x.r, 1)}</td><td><span class="wbar wide"><span class="${x.r > x.w * 1.3 ? 'hot' : ''}" style="width:${Math.min(100, x.r * 100 * 2.2)}%"></span></span></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h2>Sector mix: ${esc(sel.name)}</h2>${hbars(sect, { max: 1 })}</div>
  <div class="card"><h2>Correlations</h2><p class="small muted" style="margin-top:0">Average pairwise correlation ${R.correlation.average.toFixed(2)}. Lower is better for diversification; darker cells move together.</p>${corrTable(R.correlation.symbols, R.correlation.matrix)}</div>
  <div class="card"><h2>Growth of ₹100 (back-test)</h2>${multiLine(R.growth, { base: 100 })}
    <p class="small muted" style="margin:8px 0 0">Nifty 50 over the same period: ${fmt.pct(bm.cagr)} a year, worst fall ${fmt.pct(bm.max_drawdown, 1)}. Weights are today’s, applied to the same past period used to pick them, with daily rebalancing, so this is in-sample.</p></div>
  <div class="card"><h2>The stocks</h2><div class="tbl-wrap"><table><thead><tr><th>Stock</th><th>Industry</th><th class="n">Beta</th><th class="n">Volatility</th><th class="n">CAPM return</th><th class="n">Past average return</th></tr></thead><tbody>${R.assets.map(a => `<tr><td>${esc(a.symbol)}</td><td class="src">${esc(a.industry)}</td><td class="n">${a.beta.toFixed(2)}</td><td class="n">${fmt.pct(a.vol)}</td><td class="n">${fmt.pct(a.mu_capm)}</td><td class="n">${fmt.pct(a.mu_hist)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="note info small">Educational analysis from past prices, not investment advice. Optimised weights are sensitive to inputs; treat them as one view, not an answer.</div>`;
}
async function runPortfolio() {
  const P = S.pf, out = $('#pf-out'), msg = $('#pf-msg'), btn = $('#pf-run');
  if (P.symbols.length < 4) { msg.innerHTML = errBox(new Error('Add at least 4 stocks (8 to 15 works best).')); return; }
  msg.innerHTML = ''; btn.disabled = true; btn.textContent = 'Running…'; out.classList.add('updating');
  try {
    P.result = await post('/api/portfolio', { symbols: P.symbols, years: P.years, mu_method: P.mu_method, max_weight: P.max_weight });
    out.innerHTML = portfolioResults(P.result);
  } catch (e) { msg.innerHTML = errBox(e); }
  finally { btn.disabled = false; btn.textContent = 'Run analysis'; out.classList.remove('updating'); }
}

/* ---------------------------------------------------------------- risk lab */
function riskView() {
  const R = S.rk, pr = S.pf.result;
  const srcOpts = [['equal', 'Equal weight']];
  if (pr) pr.portfolios.forEach(p => srcOpts.push(['pf:' + p.name, 'From Portfolio lab: ' + p.name]));
  return `<div class="page-head"><h1>Risk lab</h1><p class="muted">How much could this basket lose? Value at Risk three ways, drawdowns, Sharpe, beta and stress tests, from real adjusted prices.</p></div>
  <div class="cols"><div class="stack" id="rk-out">${R.result ? riskResults(R.result) : `<div class="card"><p class="muted" style="margin:0">Add stocks on the right and press <b>Run risk analysis</b>. If you have run the Portfolio lab, you can use its weights.</p></div>`}</div>
  <div class="card panel"><h2>Holdings</h2>${pickerHtml('rk-picker', R.symbols)}
    <div class="row-btns"><button class="btn" data-rk-act="sample">Load sample</button><button class="btn" data-rk-act="clear">Clear</button></div>
    <div class="ctl"><label><span>Weights</span></label><select data-rk-sel="source" aria-label="Weights">${srcOpts.map(([v, l]) => `<option value="${esc(v)}" ${R.source === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="ctl"><label><span>Portfolio value (₹)</span></label><input type="number" min="1000" step="50000" value="${R.value}" data-rk-num="value" class="numin" aria-label="Portfolio value in rupees"><div class="hint" id="rk-val-hint">${lakh(R.value)}</div></div>
    <div class="ctl"><label><span>History used</span></label>${seg('rk', 'years', [[1, '1 year'], [3, '3 years'], [5, '5 years']], R.years)}</div>
    <div class="ctl"><label><span>Confidence</span></label>${seg('rk', 'confidence', [[0.9, '90%'], [0.95, '95%'], [0.99, '99%']], R.confidence)}</div>
    <div class="ctl"><label><span>Horizon</span></label>${seg('rk', 'horizon', [[1, '1 day'], [5, '5 days'], [10, '10 days']], R.horizon)}</div>
    <div style="margin-top:16px"><button class="btn primary" data-rk-act="run" id="rk-run" style="width:100%">Run risk analysis</button></div><div id="rk-msg"></div></div></div>`;
}
const lakh = v => v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} crore` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)} lakh` : fmt.rs(v);
function riskResults(R) {
  const v = R.var, i = R.inputs, s = R.stats, c = Math.round(i.confidence * 100), per = Math.round(100 - c);
  const hz = i.horizon === 1 ? '1 day' : `${i.horizon} days`;
  const row = (name, o, mc) => `<tr><td>${name}</td><td class="n">${fmt.pct(o.pct, 2)}</td><td class="n">${fmt.rs(o.amount)}</td><td class="n">${o.cvar_pct != null ? fmt.pct(o.cvar_pct, 2) : '–'}</td><td class="n">${o.cvar_amount != null ? fmt.rs(o.cvar_amount) : '–'}</td></tr>`;
  const stat = (k, val) => `<div class="card stat"><div class="muted small">${k}</div><div class="stat-v">${val}</div></div>`;
  return `<div class="card"><div class="muted small">Value at Risk, ${c}% confidence, ${hz}</div><div class="bigline">${fmt.rs(v.historical.amount)}</div>
    <p style="margin:6px 0 0">On a ${lakh(i.value)} portfolio, a loss larger than this should happen on about ${per} in every 100 ${i.horizon === 1 ? 'days' : 'periods of ' + hz}, judged from the actual returns of the last ${i.days} trading days. It is the edge of the bad outcomes, not the worst case: when it is exceeded, the average loss is ${fmt.rs(v.historical.cvar_amount)}.</p></div>
  <div class="card"><h2>Three ways to measure it</h2><div class="tbl-wrap"><table><thead><tr><th>Method</th><th class="n">VaR %</th><th class="n">VaR ₹</th><th class="n">Average loss beyond VaR %</th><th class="n">₹</th></tr></thead><tbody>
    ${row('Historical (actual days)', v.historical)}${row('Parametric (normal)', v.parametric)}${row('Monte Carlo (20,000 paths)', v.monte_carlo)}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">Historical uses what actually happened. Parametric and Monte Carlo assume a bell curve, which understates fat tails; real returns here have excess kurtosis ${s.excess_kurtosis.toFixed(1)} (a normal distribution has 0).</p></div>
  <div class="card"><h2>Daily returns, ${fmt.date(i.start)} to ${fmt.date(i.end)}</h2>${histChart(R.histogram, [{ x: -v.historical.pct / Math.sqrt(i.horizon), label: `VaR ${c}%` }])}
    <p class="small muted" style="margin:6px 0 0">Each bar counts days. The dashed line marks the 1-day historical VaR.</p></div>
  <div class="stats-grid">${stat('Annual return (past)', fmt.pct(s.annual_return))}${stat('Annual volatility', fmt.pct(s.annual_vol))}${stat('Sharpe ratio', s.sharpe.toFixed(2))}${stat('Sortino ratio', s.sortino.toFixed(2))}${stat('Beta to Nifty 50', s.beta.toFixed(2))}${stat('Worst fall (drawdown)', fmt.pct(s.max_drawdown, 1))}</div>
  <p class="small muted" style="margin:-6px 0 0">Sharpe and Sortino use the 10-year G-sec yield (${fmt.pct(s.rf, 2)}) as the risk-free rate. A negative Sharpe means the basket earned less than a government bond over this window.</p>
  <div class="card"><h2>Drawdown</h2><p class="small muted" style="margin-top:0">How far below its previous peak the basket was. Deepest fall ${fmt.pct(s.max_drawdown, 1)}, from ${fmt.date(s.drawdown_peak)} to ${fmt.date(s.drawdown_trough)}.</p>${lineChart(R.drawdown, { fmtY: x => fmt.pct(x, 0) })}</div>
  <div class="grid2"><div class="card"><h2>Worst days for this basket</h2><div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Basket</th><th class="n">Nifty 50</th></tr></thead><tbody>${R.worst_days.map(d => `<tr><td>${fmt.date(d.date)}</td><td class="n neg">${fmt.pct(d.portfolio, 2)}</td><td class="n">${fmt.pct(d.nifty, 2)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h2>On the Nifty’s worst days</h2><div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Basket</th><th class="n">Nifty 50</th></tr></thead><tbody>${R.nifty_worst_days.map(d => `<tr><td>${fmt.date(d.date)}</td><td class="n">${fmt.pct(d.portfolio, 2)}</td><td class="n neg">${fmt.pct(d.nifty, 2)}</td></tr>`).join('')}</tbody></table></div></div></div>
  <div class="card"><h2>Stress test</h2><p class="small muted" style="margin-top:0">If the Nifty 50 fell by the amount shown, the basket’s beta of ${s.beta.toFixed(2)} suggests this loss. A straight-line estimate: real crashes are messier.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Nifty 50 move</th><th class="n">Estimated basket move</th><th class="n">On ${lakh(i.value)}</th></tr></thead><tbody>${R.stress.map(x => `<tr><td>${fmt.spct(x.nifty_move, 0)}</td><td class="n neg">${fmt.pct(x.estimated_portfolio, 1)}</td><td class="n neg">${fmt.rs(x.amount)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h2>Where the risk comes from</h2>${hbars(R.contributions.slice().sort((a, b) => b.risk_share - a.risk_share).map(x => ({ label: `${x.symbol} (${fmt.pct(x.weight, 0)} of money)`, value: x.risk_share })), { max: Math.max(...R.contributions.map(x => x.risk_share)) })}</div>
  ${R.notes.map(n => `<div class="note info small">${esc(n)}</div>`).join('')}`;
}
function riskWeights() {
  const R = S.rk;
  if (R.source.startsWith('pf:') && S.pf.result) {
    const p = S.pf.result.portfolios.find(x => 'pf:' + x.name === R.source);
    if (p) { const w = {}; R.symbols.forEach(s => { w[s] = p.weights[s] ?? 0; }); return w; }
  }
  return null;
}
async function runRisk() {
  const R = S.rk, out = $('#rk-out'), msg = $('#rk-msg'), btn = $('#rk-run');
  if (R.symbols.length < 4) { msg.innerHTML = errBox(new Error('Add at least 4 stocks.')); return; }
  msg.innerHTML = ''; btn.disabled = true; btn.textContent = 'Running…'; out.classList.add('updating');
  try {
    R.result = await post('/api/risk', { symbols: R.symbols, weights: riskWeights(), years: R.years, confidence: R.confidence, horizon: R.horizon, value: R.value });
    out.innerHTML = riskResults(R.result);
  } catch (e) { msg.innerHTML = errBox(e); }
  finally { btn.disabled = false; btn.textContent = 'Run risk analysis'; out.classList.remove('updating'); }
}

/* ---------------------------------------------------------------- events (own attribute names, no clashes) */
document.addEventListener('click', e => {
  const t = e.target;
  const pa = t.closest('[data-pf-act]');
  if (pa) {
    const a = pa.dataset.pfAct;
    if (a === 'sample') { S.pf.symbols = SAMPLE.slice(); persistLab(); refreshPicker('pf'); }
    if (a === 'clear') { S.pf.symbols = []; S.pf.result = null; persistLab(); $('#pf-out').innerHTML = '<div class="card"><p class="muted" style="margin:0">Cleared. Add stocks on the right.</p></div>'; refreshPicker('pf'); }
    if (a === 'run') runPortfolio();
    if (a === 'select') { S.pf.pick = pa.dataset.name; $('#pf-out').innerHTML = portfolioResults(S.pf.result); }
    if (a === 'torisk') {
      const p = S.pf.result.portfolios.find(x => x.name === pa.dataset.name);
      S.rk.symbols = S.pf.result.inputs.symbols.filter(s => p.weights[s] > 0.0005); S.rk.source = 'pf:' + p.name; S.rk.result = null; persistLab(); location.hash = '#/risk';
    }
  }
  const ra = t.closest('[data-rk-act]');
  if (ra) {
    const a = ra.dataset.rkAct;
    if (a === 'sample') { S.rk.symbols = SAMPLE.slice(); S.rk.source = 'equal'; persistLab(); refreshPicker('rk'); }
    if (a === 'clear') { S.rk.symbols = []; S.rk.result = null; persistLab(); $('#rk-out').innerHTML = '<div class="card"><p class="muted" style="margin:0">Cleared. Add stocks on the right.</p></div>'; refreshPicker('rk'); }
    if (a === 'run') runRisk();
  }
  const ps = t.closest('[data-pf][data-v]'); if (ps) { S.pf[ps.dataset.pf] = ps.dataset.pf === 'mu_method' ? ps.dataset.v : Number(ps.dataset.v); $$(`[data-pf="${ps.dataset.pf}"]`).forEach(b => b.classList.toggle('on', b === ps)); persistLab(); }
  const rs = t.closest('[data-rk][data-v]'); if (rs) { S.rk[rs.dataset.rk] = Number(rs.dataset.v); $$(`[data-rk="${rs.dataset.rk}"]`).forEach(b => b.classList.toggle('on', b === rs)); persistLab(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-pf="max_weight"]')) { S.pf.max_weight = parseFloat(t.value); $('#pf-cap-val').textContent = fmt.pct(S.pf.max_weight, 0); persistLab(); }
  if (t.matches('[data-rk-num="value"]')) { const v = parseFloat(t.value); if (v > 0) { S.rk.value = v; $('#rk-val-hint').textContent = lakh(v); persistLab(); } }
});
document.addEventListener('change', e => { if (e.target.matches('[data-rk-sel="source"]')) { S.rk.source = e.target.value; } });

function wireLabPicker(which) {
  const L = which === 'pf' ? S.pf : S.rk;
  wirePicker(which + '-picker', () => L.symbols, l => { L.symbols = l; persistLab(); refreshPicker(which); });
}
