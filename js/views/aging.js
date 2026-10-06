/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, CORE = P.core, PL = P.plant, AG = P.aging, ROP = P.rop, K = P.K;

C.views.aging = {
  init(el) {
    this.el = el; this.r = { creep: 1, sg: 0.35, feed: 1, clean: false }; this.rp = { unc: 0.07, cppf: 1.08, mreq: 0.05, sds: 1 }; this.ov = 'creep'; this.selShape = 'nom'; this.shapes = null;
    el.innerHTML = `
      <p class="lead">Regional Overpower Protection (ROP) is the set of in-core detector trips that shuts the reactor down before any fuel channel dries out, whatever shape the neutron flux takes. Its set-point is derived from the critical channel power of every channel – so as pressure tubes creep, steam generators foul and feeders roughen, the set-point must come down. This module ages the plant and recomputes that set-point.</p>
      <div class="grid gside">
        <div class="stack">
          <div class="card"><h4>Plant age</h4><div id="ag-s1"></div>
            <div class="row" style="margin-bottom:8px"><button class="btn sm" data-y="0">New</button><button class="btn sm" data-y="10">10</button><button class="btn sm" data-y="20">20</button><button class="btn sm" data-y="30">30 EFPY</button></div>
            <h4 style="margin-top:12px">Ageing rates</h4><div id="ag-s2"></div><div id="ag-cl"></div></div>
          <div class="card"><h4>ROP assumptions</h4><div id="ag-s3"></div><div id="ag-sds" style="margin-top:6px"></div></div>
          <div class="card"><h4>Component condition</h4><div id="ag-der"></div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="kpis" id="ag-k"></div><div class="note" id="ag-verdict" style="margin-top:10px"></div>
            <div class="row" style="margin-top:10px"><button class="btn pri" id="ag-apply">Install the required set-point</button><button class="btn" id="ag-sim">Try a loss of regulation in the simulator →</button><span class="small mut" id="ag-busy"></span></div></div>
          <div class="grid g64">
            <div class="card"><div class="row" style="margin-bottom:8px"><label class="mut small" for="ag-ov">Map</label><select id="ag-ov"><option value="creep">Peak diametral creep (%)</option><option value="dccp">Loss of critical channel power vs new (%)</option><option value="cpr">Critical power ratio at 100 % FP</option><option value="shape">Selected flux shape: channel power change (%) + detectors</option></select></div>
              <canvas class="coremap" id="ag-map"></canvas><p class="small mut" id="ag-mn" style="margin:6px 0 0"></p></div>
            <div class="stack"><div class="card" id="ag-c1"></div><div class="card" id="ag-c2"></div></div>
          </div>
          <div class="card"><h4>Trip set-point analysis: one row per design-basis flux shape</h4>
            <div class="scroll"><table class="tbl" id="ag-tbl"></table></div>
            <p class="small mut" style="margin:8px 0 0">Click a row to see that flux shape on the map. <b>Dryout power</b> = reactor power at which the first channel reaches its critical channel power in that shape. <b>Detector factor</b> = reading of the second-highest logic channel relative to its reading in the nominal shape (two of three channels must vote to trip). Required set-point = dryout power × detector factor ÷ (1 + uncertainty).</p></div>
          <div class="grid g2">
            <div class="note"><h4>How the set-point is built</h4><ol class="tight" style="padding-left:18px;margin:0"><li>For every channel find the <b>critical channel power</b> with today's header conditions, feeder resistance and creep.</li><li>For each credible flux shape, find how far reactor power could rise before the worst channel dries out.</li><li>For the same shape, find what the detectors would read at that power.</li><li>The lowest value over all shapes, less uncertainties, is the highest set-point that still protects the fuel.</li></ol></div>
            <div class="note warn"><h4>Why operators care</h4>Detectors are calibrated to read power × CPPF (≈ 1.08), so at full power they already read ≈ 108 %. A set-point of 122 % leaves 13 % of margin to a spurious trip; at 112 % only 4 % is left, and the unit must be derated – or the margin recovered by cleaning boilers, re-optimising fuelling, better CHF fuel or retubing.</div>
          </div>
        </div>
      </div>`;
    const S = M.S, go = () => this.changed();
    this.sy = U.slider(U.$('#ag-s1', el), { label: 'Effective full-power years', min: 0, max: 35, step: 0.5, value: S.age.efpy, unit: 'EFPY', dec: 1, on: v => { this.y = v; go(); } });
    this.y = S.age.efpy;
    U.$$('[data-y]', el).forEach(b => b.addEventListener('click', () => { this.y = +b.dataset.y; this.sy.set(this.y); go(); }));
    const s2 = U.$('#ag-s2', el);
    U.slider(s2, { label: 'Pressure-tube creep rate', min: 0.5, max: 1.5, step: 0.05, value: 1, unit: '× (0.15 %/EFPY peak)', dec: 2, on: v => { this.r.creep = v; go(); } });
    U.slider(s2, { label: 'Steam-generator fouling', min: 0, max: 0.8, step: 0.05, value: 0.35, unit: '% UA per EFPY', dec: 2, on: v => { this.r.sg = v; go(); } });
    U.slider(s2, { label: 'Feeder roughening / deposits', min: 0, max: 2, step: 0.1, value: 1, unit: '×', dec: 1, on: v => { this.r.feed = v; go(); } });
    U.check(U.$('#ag-cl', el), 'Steam generators cleaned (recovers 70 % of UA)', false, v => { this.r.clean = v; go(); });
    const s3 = U.$('#ag-s3', el);
    this.stsp = U.slider(s3, { label: 'Installed trip set-point', min: 100, max: 130, step: 0.5, value: S.tsp * 100, unit: '% FP', dec: 1, on: v => { S.tsp = v / 100; this.render(); } });
    U.slider(s3, { label: 'Uncertainty allowance', min: 0, max: 12, step: 0.5, value: 7, unit: '%', dec: 1, on: v => { this.rp.unc = v / 100; this.evalNow(); this.sweepL(); } });
    U.slider(s3, { label: 'Channel power peaking factor (detector calibration)', min: 1.02, max: 1.14, step: 0.005, value: 1.08, dec: 3, on: v => { this.rp.cppf = v; this.render(); this.sweepL(); } });
    U.slider(s3, { label: 'Operating margin to trip wanted', min: 0, max: 10, step: 0.5, value: 5, unit: '%', dec: 1, on: v => { this.rp.mreq = v / 100; this.render(); this.sweepL(); } });
    U.seg(U.$('#ag-sds', el), [[1, 'SDS1 detectors (34, vertical)'], [2, 'SDS2 detectors (24, horizontal)']], 1, v => { this.rp.sds = +v; this.evalNow(); this.sweepL(); });
    U.$('#ag-ov', el).addEventListener('change', e => { this.ov = e.target.value; this.drawMap(); });
    U.$('#ag-apply', el).addEventListener('click', () => { if (!this.res) return; S.tsp = Math.floor(this.res.tsp * 200) / 200; this.stsp.set(S.tsp * 100); this.render(); });
    U.$('#ag-sim', el).addEventListener('click', () => C.app.go('sim', { scenario: ['lor', { rate: 0.05 }] }));
    this.map = new U.CoreMap(U.$('#ag-map', el), { onClick: ch => { S.sel = ch; } });
    this.c1 = U.chartBox(U.$('#ag-c1', el), 'Over the life of the pressure tubes: set-point and achievable power');
    this.c2 = U.chartBox(U.$('#ag-c2', el), 'Over life: inlet temperature, core flow and margin');
    this.sweepL = U.debounce(() => this.sweep(), 500);
  },
  ageAt(y) { const r = this.r; return { efpy: y, creepRate: r.creep, kin: 1 + 0.004 * r.feed * y, kout: 1 + 0.003 * r.feed * y, sgUA: 1 - r.sg / 100 * y * (r.clean ? 0.3 : 1), pump: 1 - 0.0005 * y, rough: 1 + 0.002 * r.feed * y }; },
  show() {
    this.y = M.S.age.efpy; this.sy.set(this.y); this.stsp.set(M.S.tsp * 100);
    if (!this.shapes) this.buildShapes(); else { this.addCurrent(); this.evalNow(); this.sweepL(); }
  },
  busy(t) { U.$('#ag-busy', this.el).innerHTML = t ? '<span class="spin"></span> ' + t : ''; },
  buildShapes() {
    const list = ROP.shapes(null), out = []; let i = 0;
    const save = { phi: CORE._phi, k: CORE._k };
    const next = () => {
      if (C.app.cur !== 'aging' && i < list.length) { /* keep going in the background */ }
      if (i >= list.length) { CORE._phi = save.phi; CORE._k = save.k; this.shapes = out; this.th0 = PL.solve({ flux: CORE.nominal, power: 1 }); this.ccp0 = PL.ccp(this.th0); this.addCurrent(); this.busy(''); this.evalNow(); this.sweep(); return; }
      this.busy(`solving flux shape ${i + 1} of ${list.length}…`);
      const s = list[i++]; s.flux = s.id === 'nom' ? CORE.nominal : CORE.solve(s.pos, { noStore: true }); out.push(s);
      setTimeout(next, 5);
    };
    next();
  },
  addCurrent() {
    const S = M.S; this.shapes = this.shapes.filter(s => s.id !== 'cur');
    if (S.flux !== CORE.nominal && (S.pos.targets.length || Math.abs(S.flux.maxCh - CORE.nominal.maxCh) > 0.02)) this.shapes.push({ id: 'cur', name: 'Your current configuration from the Flux lab' + (S.pos.targets.length ? ' (with isotope target)' : ''), group: 'User', flux: S.flux });
  },
  changed() { M.S.age = this.ageAt(this.y); M.solveTH(); if (this.shapes) { this.evalNow(); this.sweepL(); } },
  state(age) {
    const creep = AG.creep(age, CORE.nominal), th = PL.solve({ flux: CORE.nominal, power: 1, age, creep }), ccp = PL.ccp(th);
    const res = ROP.evaluate(this.shapes, CORE.nominal, th, ccp, this.rp);
    let m = 1e9; for (let i = 0; i < ccp.length; i++) m = Math.min(m, ccp[i] / th.chMW[i]);
    return { th, ccp, res, creep, minCPR: m };
  },
  evalNow() {
    if (!this.shapes) return;
    const save = { r: PL._rihT, d: PL._dp, w: PL.wGuess.slice() };
    const st = this.state(M.S.age); this.cur = st; this.res = st.res;
    PL._rihT = save.r; PL._dp = save.d; PL.wGuess = save.w;
    this.render();
  },
  derate(tsp) { const use = Math.min(tsp, M.S.tsp); return { use, margin: use / this.rp.cppf - 1, pmax: Math.min(1, use / (this.rp.cppf * (1 + this.rp.mreq))) }; },
  render() {
    const st = this.cur; if (!st) return;
    const S = M.S, el = this.el, res = st.res, d = this.derate(res.tsp), der = AG.derived(S.age, st.creep), bad = S.tsp > res.tsp + 0.0005;
    U.kpis(U.$('#ag-k', el), [['Peak diametral creep', U.f(der.creepMax, 2), '%', der.creepMax > 5 ? 'bad' : der.creepMax > 3.5 ? 'warn' : ''], ['Inlet header temp.', U.f(st.th.rihT, 1), '°C', st.th.rihT > 268 ? 'warn' : ''], ['Core flow', U.f(st.th.wTot, 0), 'kg/s'], ['Min critical power ratio', U.f(st.minCPR, 3), '', st.minCPR < 1.25 ? 'warn' : 'ok'],
      ['Required trip set-point', U.f(res.tsp * 100, 1), '% FP', 'acc'], ['Installed set-point', U.f(S.tsp * 100, 1), '% FP', bad ? 'bad' : 'ok'], ['Margin to trip at 100 % FP', U.f(d.margin * 100, 1), '%', d.margin < this.rp.mreq ? 'bad' : d.margin < 0.08 ? 'warn' : 'ok'], ['Power for wanted margin', U.f(d.pmax * 100, 1), '% FP', d.pmax < 0.999 ? 'warn' : 'ok'], ['Output lost to derating', U.f((1 - d.pmax) * K.mwe, 0), 'MWe', d.pmax < 0.999 ? 'bad' : '']]);
    const v = U.$('#ag-verdict', el); v.className = 'note ' + (bad ? 'bad' : d.pmax < 0.999 ? 'warn' : 'ok');
    v.innerHTML = `<h4>${bad ? 'Installed set-point no longer protects the fuel' : d.pmax < 0.999 ? 'Protected, but the unit must be derated' : 'Protected with full operating margin'}</h4>
      Limiting flux shape: <b>${res.lim.name}</b>. In that shape channel <b>${CORE.ch[res.lim.lim].id}</b> would dry out at ${U.f(res.lim.r * 100, 1)} % FP, when the voting detector channel reads ${U.f(res.lim.m * 100, 1)} % of its nominal signal.
      ${bad ? ` The installed ${U.f(S.tsp * 100, 1)} % is above the required ${U.f(res.tsp * 100, 1)} % – in this shape dryout could occur before the trip.` : ''} ${d.pmax < 0.999 ? ` With detectors reading power × ${this.rp.cppf.toFixed(2)}, keeping ${U.f(this.rp.mreq * 100, 0)} % margin to trip limits power to ${U.f(d.pmax * 100, 1)} % FP.` : ''}`;
    U.$('#ag-der', el).innerHTML = U.spec([['Peak diametral creep', U.f(der.creepMax, 2) + ' % <span class="mut">(design basis ≈ 5 %)</span>'], ['Pressure-tube inside diameter (peak)', U.f(103.4 * (1 + der.creepMax / 100), 1) + ' mm'], ['By-pass gap above bundle', U.f(103.4 * (1 + der.creepMax / 100) - 102.4, 1) + ' mm'], ['Axial elongation', U.f(der.elong, 0) + ' mm <span class="mut">(bearing travel ≈ 150–180)</span>'], ['Mid-span sag', U.f(der.sag, 0) + ' mm'],
      ['Wall thickness', U.f(der.wall, 2) + ' mm <span class="mut">(new 4.19)</span>'], ['Hydrogen-equivalent at outlet', U.f(der.heq, 0) + ' ppm'], ['Thinnest outlet-feeder wall', U.f(der.feederWall, 1) + ' mm'], ['Steam-generator UA', U.f(S.age.sgUA * 100, 1) + ' %'], ['Feeder resistance in / out', U.f(S.age.kin * 100, 0) + ' / ' + U.f(S.age.kout * 100, 0) + ' %']]);
    const rows = res.rows.slice().sort((a, b) => a.tsp - b.tsp);
    U.$('#ag-tbl', el).innerHTML = `<tr><th>Flux shape</th><th>Group</th><th class="n">Reactivity (mk)</th><th class="n">Max channel (MW)</th><th>Limiting channel</th><th class="n">Dryout power (% FP)</th><th class="n">Detector factor</th><th class="n">Required TSP (%)</th></tr>` +
      rows.map(r => `<tr class="click ${r === res.lim ? 'lim' : ''} ${r.id === this.selShape ? 'sel' : ''}" data-id="${r.id}"><td>${r.name}</td><td>${r.group}</td><td class="n">${r.rho >= 0 ? '+' : ''}${U.f(r.rho, 2)}</td><td class="n">${U.f(r.maxCh, 2)}</td><td>${CORE.ch[r.lim].id}</td><td class="n">${U.f(r.r * 100, 1)}</td><td class="n">${U.f(r.m, 3)} <span class="mut">(${r.logic}${r.det})</span></td><td class="n"><b>${U.f(r.tsp * 100, 1)}</b></td></tr>`).join('');
    U.$$('#ag-tbl tr.click', el).forEach(tr => tr.addEventListener('click', () => { this.selShape = tr.dataset.id; this.ov = 'shape'; U.$('#ag-ov', el).value = 'shape'; this.render(); }));
    this.drawMap();
  },
  drawMap() {
    const st = this.cur; if (!st) return;
    const S = M.S, nom = CORE.nominal; let d, note = '';
    if (this.ov === 'creep') { d = { values: CORE.ch.map((c, i) => Math.max(...st.creep.subarray(i * 12, i * 12 + 12))), unit: '% creep', cmap: 'heat', min: 0, max: Math.max(1, AG.derived(S.age, st.creep).creepMax), fmt: v => U.f(v, 2) }; note = 'Creep is driven by fast flux, stress and temperature: the central, high-power channels grow most.'; }
    else if (this.ov === 'dccp') { d = { values: Array.from(st.ccp, (v, i) => (v / this.ccp0[i] - 1) * 100), unit: '% CCP', cmap: 'div', sym: true, symMin: 3, fmt: v => U.f(v, 1) }; note = 'Combined effect of creep, higher inlet temperature and lower flow on each channel.'; }
    else if (this.ov === 'cpr') { d = { values: Array.from(st.ccp, (v, i) => v / st.th.chMW[i]), unit: 'CPR', cmap: 'margin', min: 1, max: 2.4, fmt: v => U.f(v, 2) }; note = 'Critical channel power divided by channel power at 100 % FP in the nominal flux shape.'; }
    else {
      const sh = this.shapes.find(s => s.id === this.selShape) || this.shapes[0], row = st.res.rows.find(r => r.id === sh.id), dets = this.rp.sds === 2 ? CORE.det2 : CORE.det1, key = this.rp.sds === 2 ? 'det2' : 'det1';
      d = { values: Array.from(sh.flux.chRel, (v, i) => (v / nom.chRel[i] - 1) * 100), unit: '% power', cmap: 'div', sym: true, symMin: 3, fmt: v => (v > 0 ? '+' : '') + U.f(v, 1), zones: true,
        dets: dets.map((t, i) => { const r = sh.flux[key][i] / nom[key][i]; return { x: t.x, y: t.y, color: r >= (row ? row.m - 1e-9 : 9) ? '#ffffff' : r > 1 ? '#ffd166' : '#6b7a90', size: r >= (row ? row.m - 1e-9 : 9) ? 6 : 4 }; }), marks: row ? [{ ch: row.lim, color: '#ff5d6c' }] : [] };
      note = `<b>${sh.name}</b>. Diamonds are detectors: white = at or above the voting reading, yellow = reading higher than nominal, grey = reading lower. Red ring = channel that dries out first.`;
    }
    d.select = false; this.map.draw(d); U.$('#ag-mn', this.el).innerHTML = note;
  },
  sweep() {
    if (!this.shapes) return; this.busy('computing 35-year history…');
    setTimeout(() => {
      const save = { r: PL._rihT, d: PL._dp, w: PL.wGuess.slice() }, xs = [], tsp = [], pmax = [], rih = [], fl = [], cpr = [];
      for (let y = 0; y <= 35; y += 5) { const st = this.state(this.ageAt(y)), d = { pmax: Math.min(1, st.res.tsp / (this.rp.cppf * (1 + this.rp.mreq))) }; xs.push(y); tsp.push(st.res.tsp * 100); pmax.push(d.pmax * 100); rih.push(st.th.rihT); fl.push(st.th.wTot / 77); cpr.push(st.minCPR); }
      PL._rihT = save.r; PL._dp = save.d; PL.wGuess = save.w;
      const now = [{ x: this.y, color: '#ffffff66', label: 'now' }];
      this.c1.draw({ x: xs, xLabel: 'Effective full-power years', yLabel: '% FP', vlines: now, series: [{ name: 'Required trip set-point', y: tsp, color: '#ff6b5e', dots: true }, { name: 'Power with wanted margin', y: pmax, color: '#7ee0c3', dots: true }], hlines: [{ y: M.S.tsp * 100, color: '#ffb454', label: 'installed set-point' }] });
      this.c2.draw({ x: xs, xLabel: 'Effective full-power years', yLabel: '°C', y2Label: 'flow % · CPR×100', vlines: now, series: [{ name: 'Inlet header temperature', y: rih, color: '#ffb454', dots: true }, { name: 'Core flow (% of design)', y: fl, axis: 'r', color: '#4cc2ff', dots: true }, { name: 'Min CPR × 100', y: cpr.map(v => v * 100), axis: 'r', color: '#b99cff', dots: true }] });
      this.busy('');
    }, 30);
  }
};
})();
