/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, CORE = P.core, K = P.K;

const OVERLAYS = {
  power: { name: 'Channel power', why: 'Flattened by burnup zoning and adjusters: a wide plateau near 6.5–6.9 MW, falling to under 3 MW at the edge. The licence limit is 7.3 MW.', get: S => ({ values: S.th.chMW, unit: 'MW', cmap: 'heat' }) },
  flow: { name: 'Coolant flow', why: 'Feeder sizes throttle the outer channels so that flow follows power. Notice that flow is not exactly proportional to power once ageing or flux tilts move the core away from its design point.', get: S => ({ values: S.th.W, unit: 'kg/s', cmap: 'cool' }) },
  xexit: { name: 'Channel exit quality', why: 'Thermodynamic quality at the end of the fuel string. Positive means net boiling. More flashing occurs in the outlet feeder as pressure drops toward the header.', get: S => ({ values: Array.from(S.th.xE, v => v * 100), unit: '% quality', cmap: 'heat', fmt: v => U.f(v, 1) }) },
  cpr: { name: 'Critical power ratio (CCP / power)', why: 'The margin to dryout of each channel. The minimum over the core is what the ROP trips protect. Channels at the edge of the plateau are usually limiting.', get: S => ({ values: Array.from(S.ccp, (v, i) => v / S.th.chMW[i]), unit: 'CPR', cmap: 'margin', min: 1.0, max: 2.4, fmt: v => U.f(v, 2) }) },
  ccp: { name: 'Critical channel power', why: 'Power at which each channel would first dry out, with today\'s header conditions. Depends on the feeder resistance, axial flux shape and creep of that channel.', get: S => ({ values: S.ccp, unit: 'MW', cmap: 'heat' }) },
  chfr: { name: 'Minimum CHF ratio at present power', why: 'Local critical heat flux divided by local heat flux, at the worst axial location. Larger than CPR because raising power also raises quality and lowers flow.', get: S => ({ values: S.th.chfr, unit: 'CHFR', cmap: 'margin', min: 1, max: 5, fmt: v => U.f(v, 2) }) },
  bun: { name: 'Maximum bundle power', why: 'Hottest of the 12 bundles in each channel. Licence limit 935 kW.', get: S => ({ values: CORE.ch.map((c, i) => { let m = 0; for (let b = 0; b < 12; b++) m = Math.max(m, S.flux.bunRel[i * 12 + b]); return m * K.bunAvgKW * S.op.power; }), unit: 'kW', cmap: 'heat', fmt: v => U.f(v, 0) }) },
  creep: { name: 'Peak pressure-tube diametral creep', why: 'Creep follows fast flux and temperature, so the high-power channels grow most – exactly the channels with the least margin.', get: S => ({ values: CORE.ch.map((c, i) => { let m = 0; for (let b = 0; b < 12; b++) m = Math.max(m, S.creep[i * 12 + b]); return m; }), unit: '% of diameter', cmap: 'heat', min: 0, max: Math.max(1, S.der.creepMax), fmt: v => U.f(v, 2) }) },
  loop: { name: 'Loop and pass (flow direction)', why: 'Two loops split the core left/right; within each loop adjacent channels flow in opposite directions (figure-of-eight). • flows toward you, × flows away. A break only voids one loop – half the core.', get: () => ({ values: CORE.ch.map(c => (c.loop - 1) * 2 + (c.dir > 0 ? 0 : 1)), cats: [{ label: 'Loop 1, pass A→C', short: 'L1 →', color: '#5aa9ff' }, { label: 'Loop 1, pass C→A', short: 'L1 ←', color: '#2f5f9e' }, { label: 'Loop 2, pass A→C', short: 'L2 →', color: '#ff9e64' }, { label: 'Loop 2, pass C→A', short: 'L2 ←', color: '#a85a2c' }], arrows: true, loops: true }) },
  zone: { name: 'Liquid zone control regions', why: 'Each face region is controlled by two zone compartments (front and back half of the core): 14 zones in total.', get: () => ({ values: CORE.ch.map(c => c.zone), cats: ['Zone 1 / 8', 'Zone 2 / 9', 'Zone 3 / 10', 'Zone 4 / 11', 'Zone 5 / 12', 'Zone 6 / 13', 'Zone 7 / 14'].map((l, i) => ({ label: l, short: 'Z' + (i + 1) + '/' + (i + 8), color: ['#4cc2ff', '#2b6fd6', '#7ee0c3', '#ffd166', '#58c7a3', '#ff9e64', '#f2543d'][i] })), zones: true }) },
  feeder: { name: 'Design flow (feeder sizing)', why: 'Feeder size and orificing give each channel a design flow proportional to its time-average power.', get: () => ({ values: P.plant.des.map(d => d.wd), unit: 'kg/s', cmap: 'cool' }) },
  burn: { name: 'Fuelling state', why: '0 = just refuelled (reactive, above its time-average power), 1 = due for refuelling. Turn on the "instantaneous snapshot" in the Flux lab to see the resulting ripple.', get: () => ({ values: Array.from(CORE.burn), unit: 'cycle fraction', cmap: 'div', min: 0, max: 1, fmt: v => U.f(v, 2) }) }
};

C.views.coremap = {
  init(el) {
    this.el = el; this.ov = 'power';
    el.innerHTML = `
      <p class="lead">The reactor face seen from the fuelling machine: 22 rows (A–W) by 22 columns, 380 channels. Choose what to colour, hover for values, click a channel to inspect it. Everything here responds to the power, ageing and flux-shape settings you make in the other modules.</p>
      <div class="grid g64">
        <div class="card">
          <div class="row" style="margin-bottom:8px"><label class="mut small" for="cm-ov">Colour by</label><select id="cm-ov">${Object.keys(OVERLAYS).map(k => `<option value="${k}">${OVERLAYS[k].name}</option>`).join('')}</select></div>
          <canvas class="coremap" id="cm-map"></canvas>
          <div class="note" id="cm-why" style="margin-top:10px"></div>
        </div>
        <div class="stack">
          <div class="card"><h4>Core summary</h4><div class="kpis" id="cm-k"></div></div>
          <div class="card"><h4>Ten channels closest to dryout</h4><div class="scroll"><table class="tbl" id="cm-low"></table></div></div>
          <div class="card"><div class="row"><h3 id="cm-id" style="margin:0"></h3><span class="sp"></span><button class="btn pri sm" id="cm-open">Open in channel lab →</button></div>
            <div class="kpis" id="cm-ck" style="margin:10px 0"></div>
            <div id="cm-c1"></div><div id="cm-c2"></div></div>
        </div>
      </div>`;
    this.map = new U.CoreMap(U.$('#cm-map', el), { onClick: ch => { M.S.sel = ch; this.inspect(); } });
    U.$('#cm-ov', el).addEventListener('change', e => { this.ov = e.target.value; this.update(); });
    U.$('#cm-open', el).addEventListener('click', () => C.app.go('channel', { ch: M.S.sel }));
    this.c1 = U.chartBox(U.$('#cm-c1', el), 'Bundle power and CHF ratio along the flow path', 'short');
    this.c2 = U.chartBox(U.$('#cm-c2', el), 'Coolant and sheath temperature, quality', 'short');
    C.app.live('coremap', 'th', () => this.update());
  },
  show(arg) { if (arg && arg.ov) { this.ov = arg.ov; U.$('#cm-ov', this.el).value = arg.ov; } this.update(); },
  update() {
    const S = M.S, o = OVERLAYS[this.ov], d = o.get(S);
    this.map.sel = S.sel;
    d.info = ch => `${U.f(S.th.chMW[ch], 2)} MW · ${U.f(S.th.W[ch], 1)} kg/s · CPR ${U.f(S.ccp[ch] / S.th.chMW[ch], 2)}`;
    d.marks = [{ ch: S.minCPRch, color: '#ff5d6c' }];
    this.map.draw(d);
    U.$('#cm-why', this.el).innerHTML = `<h4>${o.name}</h4>${o.why} <span class="mut">Red ring: channel with the lowest critical power ratio.</span>`;
    const th = S.th;
    let maxW = 0, minW = 99; for (const w of th.W) { maxW = Math.max(maxW, w); minW = Math.min(minW, w); }
    U.kpis(U.$('#cm-k', this.el), [['Max channel power', U.f(S.flux.maxCh * S.op.power, 2), 'MW', S.flux.maxCh * S.op.power > 7.3 ? 'bad' : ''], ['Max bundle power', U.f(S.flux.maxBun * S.op.power, 0), 'kW', S.flux.maxBun * S.op.power > 935 ? 'bad' : ''],
      ['Radial form factor', U.f(S.flux.radFF, 3), ''], ['Overall form factor', U.f(S.flux.overallFF, 3), ''], ['Channel flow range', U.f(minW, 1) + '–' + U.f(maxW, 1), 'kg/s'], ['Min CPR', U.f(S.minCPR, 3), CORE.ch[S.minCPRch].id, S.minCPR < 1.15 ? 'warn' : 'ok']]);
    const order = Array.from(S.ccp, (v, i) => [i, v / th.chMW[i]]).sort((a, b) => a[1] - b[1]).slice(0, 10);
    U.$('#cm-low', this.el).innerHTML = '<tr><th>Channel</th><th class="n">Power (MW)</th><th class="n">Flow (kg/s)</th><th class="n">Exit quality (%)</th><th class="n">CCP (MW)</th><th class="n">CPR</th></tr>' + order.map(o => `<tr class="click" data-c="${o[0]}"><td>${CORE.ch[o[0]].id}</td><td class="n">${U.f(th.chMW[o[0]], 2)}</td><td class="n">${U.f(th.W[o[0]], 1)}</td><td class="n">${U.f(th.xE[o[0]] * 100, 1)}</td><td class="n">${U.f(S.ccp[o[0]], 2)}</td><td class="n">${U.f(o[1], 3)}</td></tr>`).join('');
    U.$$('#cm-low tr.click', this.el).forEach(tr => tr.addEventListener('click', () => { S.sel = +tr.dataset.c; this.map.sel = S.sel; this.map.render(); this.inspect(); }));
    this.inspect();
  },
  inspect() {
    const S = M.S, c = S.sel, ch = CORE.ch[c], th = S.th;
    U.$('#cm-id', this.el).textContent = 'Channel ' + ch.id;
    const det = P.channel.detail(th.ins[c], th.chMW[c]);
    U.kpis(U.$('#cm-ck', this.el), [['Power', U.f(th.chMW[c], 2), 'MW'], ['Flow', U.f(th.W[c], 1), 'kg/s'], ['Exit quality', U.f(th.xE[c] * 100, 1), '%'], ['CCP', U.f(S.ccp[c], 2), 'MW'], ['CPR', U.f(S.ccp[c] / th.chMW[c], 2), '', S.ccp[c] / th.chMW[c] < 1.15 ? 'warn' : 'ok'],
      ['Loop / zone', ch.loop + ' / ' + (ch.zone + 1), ''], ['Flow direction', ch.dir > 0 ? 'A → C' : 'C → A', ''], ['Peak creep', U.f(Math.max(...S.creep.subarray(c * 12, c * 12 + 12)), 2), '%']]);
    const x = Array.from({ length: 12 }, (v, i) => i + 1), ax = th.ins[c].axial;
    this.c1.draw({ x, xLabel: 'Bundle position from channel inlet', yLabel: 'kW', y2Label: 'CHFR', y2Min: 0, series: [{ name: 'Bundle power', y: ax.map(v => v * th.chMW[c] * 1e3), color: '#ffb454', dots: true }, { name: 'CHF ratio', y: Array.from(det.chfr, v => Math.min(v, 12)), axis: 'r', color: '#7ee0c3' }], hlines: [{ y: 1, axis: 'r', color: '#ff5d6c', label: 'dryout' }] });
    this.c2.draw({ x, xLabel: 'Bundle position from channel inlet', yLabel: '°C', y2Label: 'quality %', series: [{ name: 'Coolant', y: Array.from(det.T), color: '#4cc2ff' }, { name: 'Sheath', y: Array.from(det.Tsh), color: '#ff6b5e' }, { name: 'Quality', y: Array.from(det.x, v => v * 100), axis: 'r', color: '#b99cff', dash: [4, 3] }] });
  }
};
})();
