'use strict';
/* Loaded only on the published snapshot (after app.js's own script has run, before boot continues it is harmless on the local app). */
(function () {
  if (!window.__STATIC__) return;
  document.body.classList.add('static');
  // keep the sidebar to what works from saved files; the labs need a live server
  const keep = ['home', 'equity', 'portfolio', 'risk'];
  for (let i = MODULES.length - 1; i >= 0; i--) if (!keep.includes(MODULES[i].key)) MODULES.splice(i, 1);
  for (const k of ['portfolio', 'risk']) {
    const m = modOf(k); m.built = false; m.href = '#/soon/' + k;
    m.what = k === 'portfolio' ? 'Efficient frontier, correlations, weights and risk contributions for a basket of stocks, from real prices.' : 'Value at Risk three ways, drawdown, Sharpe, beta and stress tests for a basket of stocks.';
    m.needs = 'A live price feed and a few seconds of computing per run, so it works in the version that runs on your own computer, not on this saved snapshot.';
    m.reuse = 'The code is in the project on GitHub.';
  }
  // the assumption sliders need the engine, so show the saved default case instead
  panelHtml = d => `<div class="card"><h2>Assumptions</h2><p class="small" style="margin:0">This page shows the default assumptions, saved on ${esc(window.__SNAPSHOT__ || '')}. Every one is listed in the sections to the left. Run the tool on your own computer to move them and watch the value change.</p></div>`;
})();
