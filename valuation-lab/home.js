'use strict';
/* Shell (sidebar), home dashboard, equity-research landing, and pages for modules not built yet. */

const MODULES = [
  { key: 'home', label: 'Home', href: '#/', built: true },
  { key: 'equity', label: 'Equity research', href: '#/equity', built: true, blurb: 'Financial history, DCF or residual income, peers, scenarios and an A4 report for any Nifty 500 company.' },
  { key: 'portfolio', label: 'Portfolio lab', href: '#/portfolio', built: true, blurb: 'Pick 8 to 15 stocks: efficient frontier, correlations, weights, risk contributions and a back-test, from real prices.' },
  { key: 'risk', label: 'Risk lab', href: '#/risk', built: true, blurb: 'Value at Risk three ways, drawdown, Sharpe, beta and stress tests for any basket of stocks.' },
  { key: 'fixed', label: 'Fixed income', href: '#/soon/fixed', built: false,
    what: 'Price a bond from its cash flows: yield to maturity, duration, convexity, and the loss from a rate shock. Credit-spread analysis for corporate bonds.',
    needs: 'Bond prices and ratings. The G-sec yield is already in the site; individual bond quotes and credit ratings need a licensed source or manual entry.',
    reuse: 'The 10-year G-sec yield and its date are already tracked on every page.' },
  { key: 'options', label: 'Options and factors', href: '#/soon/options', built: false,
    what: 'Black-Scholes pricing with the Greeks and implied volatility; Fama-French and APT factor regressions to explain a stock’s return.',
    needs: 'Option-chain data (not freely available in a reliable form) and Indian factor returns (size, value, momentum), which must be sourced or built from Nifty 500 market caps and book values.',
    reuse: 'The price store and beta regression already used by the labs.' },
  { key: 'wealth', label: 'Wealth planner', href: '#/soon/wealth', built: false,
    what: 'A risk-profile questionnaire (tolerance and capacity), an asset-allocation proposal, and a Monte Carlo estimate of the chance of reaching a goal.',
    needs: 'No special data. Needs careful wording: in India, advice to real clients falls under SEBI investment-adviser rules, so this would be practice with example client profiles.',
    reuse: 'The Portfolio lab’s optimiser and the Risk lab’s Monte Carlo.' },
  { key: 'deals', label: 'Private deals', href: '#/soon/deals', built: false,
    what: 'Track funding rounds and acquisitions, compute unit economics (CAC, LTV, payback, burn, runway) and build the five-slide deal deck.',
    needs: 'Private-market deal data is sold by vendors and cannot be reused freely, so this module would rely on deals you enter yourself, with a source link.',
    reuse: 'Nothing yet; it is a separate dataset.' },
  { key: 'learn', label: 'Learn', href: '#/soon/learn', built: false,
    what: 'Each method on the site explained in plain language with the formula, a worked example on a real company, and the CFA, FRM or CMA topic it belongs to.',
    needs: 'Writing, not data. The formulas and tests already exist in the code.',
    reuse: 'Every calculation here already shows its inputs and formula.' },
];
const modOf = k => MODULES.find(m => m.key === k);

function sideHtml(active) {
  return MODULES.map(m => `<a href="${m.href}" class="side-item ${m.key === active ? 'on' : ''}">${esc(m.label)}${m.built ? '' : '<span class="soon">soon</span>'}</a>`).join('') +
    `<a href="#/about" class="side-item minor ${active === 'about' ? 'on' : ''}">Data and method</a>`;
}
function setActive(key) { const s = $('#side'); if (s) s.innerHTML = sideHtml(key); }

/* ---------------------------------------------------------------- market snapshot */
let marketTimer = null;
async function loadMarket() {
  clearTimeout(marketTimer);
  try {
    S.market = await api('/api/market');
  } catch (e) { S.market = { ready: false, error: e.message }; }
  const slot = $('#market-slot'); if (slot) slot.innerHTML = marketHtml(S.market);
  if (!S.market.ready || S.market.refreshing && !S.market.indices) marketTimer = setTimeout(() => { if ($('#market-slot')) loadMarket(); }, 4000);
}
function chg(v, d = 2) { return `<span class="${v >= 0 ? 'pos' : 'neg'}">${fmt.spct(v, d)}</span>`; }
function marketHtml(mk) {
  if (!mk || !mk.ready) {
    return `<div class="card"><div class="loading" style="padding:30px 0"><div class="spinner"></div><b>Loading today’s market…</b><div class="small">Fetching index levels and prices for 500 stocks. The first load takes about 20 seconds.</div></div></div>`;
  }
  const idx = (mk.indices || []).map(i => `<div class="card idx"><div class="muted small">${esc(i.name)}</div>
      <div class="idx-l">${i.name.includes('VIX') || i.name.includes('INR') ? nf2.format(i.last) : fmt.n(i.last)}</div>
      <div>${chg(i.change)} <span class="muted small">on ${fmt.date(i.as_of)}</span></div>${sparkline(i.spark, { w: 160, h: 36 })}
      <div class="muted small">This year ${i.ytd == null ? '–' : fmt.spct(i.ytd, 1)}</div></div>`).join('');
  const mv = mk.movers || {};
  const rows = list => list.map(r => `<tr><td><a href="#/c/${esc(r.symbol)}">${esc(r.symbol)}</a></td><td class="nm-cell">${esc(r.name)}</td><td class="n">${fmt.rs2(r.price)}</td><td class="n">${chg(r.change)}</td></tr>`).join('');
  const total = (mv.advancers || 0) + (mv.decliners || 0) + (mv.unchanged || 0) || 1;
  const inds = (mv.industries || []);
  const mxI = Math.max(...inds.map(i => Math.abs(i.change)), 0.001);
  return `<div class="idx-grid">${idx}</div>
  ${mv.count ? `<div class="grid2" style="margin-top:16px">
    <div class="card"><h2>Top gainers</h2><div class="tbl-wrap"><table><tbody>${rows(mv.gainers)}</tbody></table></div></div>
    <div class="card"><h2>Top losers</h2><div class="tbl-wrap"><table><tbody>${rows(mv.losers)}</tbody></table></div></div>
  </div>
  <div class="grid2" style="margin-top:16px">
    <div class="card"><h2>Market breadth</h2><p class="small muted" style="margin-top:0">${mv.count} Nifty 500 stocks, session of ${fmt.date(mv.as_of)}</p>
      <div class="breadth"><span class="b-up" style="width:${mv.advancers / total * 100}%"></span><span class="b-flat" style="width:${mv.unchanged / total * 100}%"></span><span class="b-dn" style="width:${mv.decliners / total * 100}%"></span></div>
      <div class="legend"><span><i class="sw" style="background:var(--pos)"></i>${mv.advancers} up</span><span><i class="sw" style="background:var(--muted)"></i>${mv.unchanged} flat</span><span><i class="sw" style="background:var(--neg)"></i>${mv.decliners} down</span></div></div>
    <div class="card"><h2>Industries: best and worst average move</h2><div class="hbars">${inds.slice().reverse().slice(0, 4).map(i => `<div class="hb"><span class="hb-l">${esc(i.industry)}</span><span class="hb-t"><span class="hb-f ${i.change < 0 ? 'neg' : 'pos'}" style="width:${Math.abs(i.change) / mxI * 100}%"></span></span><span class="hb-v">${fmt.spct(i.change, 1)}</span></div>`).join('')}</div>
      <div class="hbars" style="margin-top:6px">${inds.slice(0, 3).map(i => `<div class="hb"><span class="hb-l">${esc(i.industry)}</span><span class="hb-t"><span class="hb-f neg" style="width:${Math.abs(i.change) / mxI * 100}%"></span></span><span class="hb-v">${fmt.spct(i.change, 1)}</span></div>`).join('')}</div></div>
  </div>` : ''}
  <p class="small muted" style="margin:10px 0 0">Prices from Yahoo Finance, end of day. ${mk.refreshing ? 'Refreshing in the background…' : ''}${mk.error ? ' Last refresh failed; showing the previous snapshot.' : ''}</p>`;
}

/* ---------------------------------------------------------------- home */
function homeView() {
  const cards = MODULES.filter(m => m.key !== 'home').map(m => `<a class="card mod ${m.built ? '' : 'mod-soon'}" href="${m.href}"><h3>${esc(m.label)}${m.built ? '' : ' <span class="soon">soon</span>'}</h3><p class="muted small" style="margin:0">${esc(m.blurb || m.what)}</p></a>`).join('');
  return `<section class="hero"><h1>Value, build and stress-test with real Indian market data.</h1>
    <p>Historical numbers come from exchange filings and Yahoo Finance. Every discount rate uses the G-sec yield of the day. Every forecast assumption is visible${STATIC ? '' : ' and yours to change'}.</p>
    <div class="search" id="hero-search"><input type="search" placeholder="${STATIC ? 'Search: TCS, Infosys, ICICI Bank, Swiggy' : 'Search a Nifty 500 company: TCS, Reliance, ICICI Bank…'}" autocomplete="off" aria-label="Search company" id="hero-q"><div class="suggest" hidden></div></div>
    <div class="chips">${(STATIC ? ['TCS', 'INFY', 'ICICIBANK', 'SWIGGY'] : ['TCS', 'RELIANCE', 'ITC', 'ICICIBANK', 'HDFCBANK', 'INFY']).map(s => `<a class="chip" href="#/c/${s}">${s}</a>`).join('')}</div></section>
    ${STATIC ? '' : `<h2 class="sec">Today’s market</h2><div id="market-slot">${marketHtml(S.market)}</div>`}
    <h2 class="sec">Modules</h2><div class="grid3">${cards}</div>
    <div id="home-status">${statusCard(S.status)}</div>`;
}

/* ---------------------------------------------------------------- equity research landing */
function equityView() {
  const rec = store.get('recent', []);
  const inds = {};
  S.universe.forEach(c => { (inds[c.industry] = inds[c.industry] || []).push(c); });
  const names = Object.keys(inds).sort((a, b) => inds[b].length - inds[a].length);
  const cur = S.browse && inds[S.browse] ? S.browse : names[0];
  return `<section class="hero" style="padding-top:8px"><h1>Equity research</h1>
    <p>Search any Nifty 500 company for its financial history, valuation, peers and a printable report.</p>
    <div class="search" id="hero-search"><input type="search" placeholder="Search by name or NSE symbol" autocomplete="off" aria-label="Search company" id="hero-q"><div class="suggest" hidden></div></div></section>
    ${rec.length ? `<h2 class="sec">Recently viewed</h2><div class="chips" style="margin-top:0">${rec.map(s => `<a class="chip" href="#/c/${esc(s)}">${esc(s)}</a>`).join('')}</div>` : ''}
    ${S.bizList && S.bizList.length ? `<h2 class="sec">Business profiles (pilot)</h2><p class="small muted" style="margin:-6px 0 10px">How the company makes money, tested against its own numbers, with every statement sourced.</p><div class="chips" style="margin-top:0">${S.bizList.map(c => `<a class="chip" href="#/c/${esc(c.symbol)}/business">${esc(c.name.split(' (')[0])} <span class="muted">${c.evidence_quality === 'primary' ? 'primary documents' : 'press'}</span></a>`).join('')}</div>` : ''}
    <h2 class="sec">Browse by industry</h2>
    ${names.length ? `<div class="chips" style="margin-top:0">${names.map(n => `<button class="chip ${n === cur ? 'on' : ''}" data-browse="${esc(n)}">${esc(n)} <span class="muted">${inds[n].length}</span></button>`).join('')}</div>
    <div class="card" style="margin-top:14px"><div class="browse">${inds[cur].slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<a href="#/c/${esc(c.symbol)}"><b>${esc(c.symbol)}</b><span class="muted small">${esc(c.name)}</span></a>`).join('')}</div></div>` : '<div class="note">The Nifty 500 list could not be loaded. You can still type any NSE symbol into the search box.</div>'}`;
}
function rememberRecent(sym) { const r = [sym, ...store.get('recent', []).filter(s => s !== sym)].slice(0, 8); store.set('recent', r); }

/* ---------------------------------------------------------------- modules not built yet */
function soonView(key) {
  const m = modOf(key);
  if (!m || m.built) return '<div class="note">That page does not exist.</div>';
  return `<div class="stack" style="max-width:760px"><div><span class="soon big-soon">Not built yet</span><h1 style="margin-top:8px">${esc(m.label)}</h1></div>
    <div class="card"><h2>What it will do</h2><p style="margin:0">${esc(m.what)}</p></div>
    <div class="card"><h2>What it needs</h2><p style="margin:0">${esc(m.needs)}</p></div>
    <div class="card"><h2>What already exists for it</h2><p style="margin:0">${esc(m.reuse)}</p></div>
    <p class="small muted">This page is a placeholder so the plan is visible. Nothing here is simulated data. Tell me which module to build next.</p>
    <p><a class="btn" href="#/">Back to home</a></p></div>`;
}
