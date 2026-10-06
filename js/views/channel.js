/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, CORE = P.core, CH = P.channel, K = P.K, pr = P.props;

const SHAPES = {
  core: ['As in the core', null],
  flat: ['Flattened cosine', () => CH.defaultAxial(12)],
  cos: ['Pure cosine', () => norm(i => Math.sin(Math.PI * (i + 0.5) / 12))],
  inl: ['Inlet-skewed', () => norm(i => Math.sin(Math.PI * (i + 0.5) / 12) * (1.45 - 0.9 * (i + 0.5) / 12))],
  out: ['Outlet-skewed', () => norm(i => Math.sin(Math.PI * (i + 0.5) / 12) * (0.55 + 0.9 * (i + 0.5) / 12))],
  uni: ['Uniform', () => norm(() => 1)]
};
function norm(f) { const a = Array.from({ length: 12 }, (v, i) => f(i)), s = a.reduce((x, y) => x + y, 0); return a.map(v => v / s); }
const CREEP0 = Array.from({ length: 12 }, (v, i) => Math.sin(Math.PI * (i + 0.5) / 12) * (0.7 + 0.6 * (i + 0.5) / 12));

function crossSection(creep) {
  const s = 1.55, cx = 170, cy = 165;
  const rPT = 51.7 * (1 + creep / 100), rPTo = rPT + 4.19 * (1 - 0.6 * creep / 100), rCT = 64.5, off = rPT - 51.2, gap = 2 * rPT - 102.4;
  const rings = [[0, 1, 0, 0.78], [14.88, 6, 0, 0.82], [28.75, 12, 15, 0.92], [43.33, 18, 0, 1.13]];
  let els = '';
  rings.forEach(r => { for (let k = 0; k < r[1]; k++) { const a = (r[2] + k * 360 / r[1]) * Math.PI / 180, x = cx + r[0] * Math.cos(a) * s, y = cy + off * s + r[0] * Math.sin(a) * s;
    els += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(6.54 * s).toFixed(1)}" fill="${U.cmap('heat')(0.35 + 0.55 * (r[3] - 0.78) / 0.35)}" stroke="#d9dfe8" stroke-width="1"><title>Fuel element – UO₂ in Zircaloy-4 sheath. Relative ring power ${r[3]}</title></circle>`; } });
  return `<svg class="sch" viewBox="0 0 340 330" role="img" aria-label="Fuel channel cross-section" style="max-width:440px;margin:0 auto">
    <rect x="0" y="0" width="340" height="330" fill="#7dcfff14"><title>Moderator: cool, low-pressure D₂O at ≈ 70 °C</title></rect>
    <circle cx="${cx}" cy="${cy}" r="${(rCT + 1.37) * s}" fill="#aab4c3"><title>Calandria tube – Zircaloy-2, 1.37 mm wall</title></circle>
    <circle cx="${cx}" cy="${cy}" r="${rCT * s}" fill="#262f3d"><title>Annulus gas – dry CO₂ (insulation and leak detection)</title></circle>
    <circle cx="${cx}" cy="${cy}" r="${rPTo * s}" fill="#e7c08a"><title>Pressure tube – Zr-2.5Nb, 4.19 mm wall, 10–11 MPa inside</title></circle>
    <circle cx="${cx}" cy="${cy}" r="${rPT * s}" fill="#1d4f8a"><title>D₂O coolant, 266–312 °C</title></circle>
    ${els}
    <text x="8" y="16">moderator D₂O ≈ 70 °C</text><text x="8" y="322">calandria tube · CO₂ annulus · pressure tube</text>
    <text class="val" x="${cx}" y="${cy - rPT * s + 13}" text-anchor="middle" style="fill:#fff">${gap > 1.2 ? 'by-pass gap ' + gap.toFixed(1) + ' mm' : ''}</text>
    <text class="val" x="332" y="16" text-anchor="end">Ø ${(2 * rPT).toFixed(1)} mm</text></svg>`;
}

C.views.channel = {
  init(el) {
    this.el = el;
    el.innerHTML = `
      <p class="lead">One fuel channel between the inlet and outlet headers. Coolant enters sub-cooled, heats up along 12 bundles and starts to boil near the outlet. The channel's flow is not imposed – it is whatever balances the header-to-header pressure difference – so power, feeder resistance, creep and inlet temperature all move both the flow and the margin to dryout.</p>
      <div class="grid gside">
        <div class="stack">
          <div class="card"><h4>Channel</h4>
            <div class="row" style="margin-bottom:8px"><input type="text" id="ch-id" size="5" aria-label="Channel identifier"><button class="btn sm" id="ch-load">Load</button><button class="btn sm" id="ch-max">Hottest</button><button class="btn sm" id="ch-lim">Limiting</button></div>
            <div id="ch-sl"></div>
            <div class="row"><label class="mut small" for="ch-shape">Axial power shape</label><select id="ch-shape">${Object.keys(SHAPES).map(k => `<option value="${k}">${SHAPES[k][0]}</option>`).join('')}</select></div>
            <div class="row" style="margin-top:10px"><button class="btn" id="ch-reset">Reset to core conditions</button></div>
          </div>
          <div class="card"><h4>Cross-section at the peak-creep location</h4><div id="ch-xs"></div>
            <p class="small mut" style="margin:6px 0 0">The bundle rests on the bottom of the tube. As the tube creeps outward the gap above the bundle grows and coolant takes the easy path over the top instead of between the elements.</p></div>
        </div>
        <div class="stack">
          <div class="card"><div class="kpis" id="ch-k"></div></div>
          <div class="card"><h4>Along the channel: coolant temperature (colour), vapour (bubbles) and dryout (red)</h4><canvas id="ch-strip" style="height:120px"></canvas>
            <div id="ch-dp" style="margin-top:8px"></div></div>
          <div class="grid g2">
            <div class="card" id="ch-c1"></div><div class="card" id="ch-c2"></div><div class="card" id="ch-c3"></div><div class="card" id="ch-c4"></div>
          </div>
          <div class="card"><div class="row"><h4 style="margin:0">Sensitivity explorer – what moves the critical channel power?</h4><span class="sp"></span><select id="ch-sens" aria-label="Sensitivity parameter"></select></div><div id="ch-c5"></div><div class="note" id="ch-sn" style="margin-top:8px"></div></div>
          <div class="grid g2">
            <div class="note"><h4>Things to try</h4><ul class="tight"><li>Raise the power slowly: flow falls, boiling moves upstream, the CHF ratio closes to 1 near bundle 9–11.</li><li>Add 4–5 % creep: flow <i>rises</i> but CCP falls.</li><li>Double the outlet-feeder resistance: a small peripheral feeder on a big channel.</li><li>Raise RIH temperature by 4 °C – a fouled steam generator.</li></ul></div>
            <div class="note warn"><h4>Model notes</h4>1-D homogeneous two-phase model with a teaching CHF correlation calibrated to a critical power ratio of ≈ 1.33 for the limiting channel. Sub-cooled boiling and sub-channel effects are not resolved; trends are right, absolute numbers are illustrative.</div>
          </div>
        </div>
      </div>`;
    const sl = U.$('#ch-sl', el), up = () => this.update();
    const mk = (key, o) => { this.s[key] = U.slider(sl, Object.assign(o, { on: v => { this.st[key] = v; up(); } })); };
    this.s = {}; this.st = {};
    mk('power', { label: 'Channel power', min: 1, max: 12, step: 0.05, value: 6.5, unit: 'MW', dec: 2 });
    mk('rihT', { label: 'Inlet header temperature', min: 250, max: 285, step: 0.5, value: 266, unit: '°C', dec: 1 });
    mk('rihP', { label: 'Inlet header pressure', min: 10.4, max: 12.4, step: 0.01, value: 11.24, unit: 'MPa', dec: 2 });
    mk('rohP', { label: 'Outlet header pressure', min: 9.0, max: 10.9, step: 0.01, value: 9.99, unit: 'MPa', dec: 2 });
    mk('creep', { label: 'Peak diametral creep', min: 0, max: 6, step: 0.1, value: 0, unit: '%', dec: 1 });
    mk('kin', { label: 'Inlet feeder resistance', min: 0.4, max: 3, step: 0.05, value: 1, unit: '× design', dec: 2 });
    mk('kout', { label: 'Outlet feeder resistance', min: 0.4, max: 3, step: 0.05, value: 1, unit: '× design', dec: 2 });
    this.st.shape = 'core';
    U.$('#ch-shape', el).addEventListener('change', e => { this.st.shape = e.target.value; up(); });
    U.$('#ch-load', el).addEventListener('click', () => { const id = U.$('#ch-id', el).value.trim().toUpperCase(), c = CORE.ch.find(x => x.id === id); if (c) this.load(c.i); else U.$('#ch-id', el).value = CORE.ch[this.ch].id; });
    U.$('#ch-id', el).addEventListener('keydown', e => { if (e.key === 'Enter') U.$('#ch-load', el).click(); });
    U.$('#ch-max', el).addEventListener('click', () => this.load(M.S.flux.maxChIdx));
    U.$('#ch-lim', el).addEventListener('click', () => this.load(M.S.minCPRch));
    U.$('#ch-reset', el).addEventListener('click', () => this.load(this.ch));
    this.c1 = U.chartBox(U.$('#ch-c1', el), 'Temperatures'); this.c2 = U.chartBox(U.$('#ch-c2', el), 'Steam quality and void fraction');
    this.c3 = U.chartBox(U.$('#ch-c3', el), 'Heat flux against critical heat flux'); this.c4 = U.chartBox(U.$('#ch-c4', el), 'Fuel temperature and coolant pressure');
    this.c5 = U.chartBox(U.$('#ch-c5', el), '', 'tall');
    this.SENS = {
      rihT: ['Inlet header temperature (°C)', 256, 280, 'Each °C of inlet temperature costs roughly 1 % of critical channel power: less sub-cooling means boiling starts earlier, which also cuts the flow.'],
      creep: ['Peak diametral creep (%)', 0, 6, 'Flow rises with creep because the tube is less restrictive, yet CCP falls because the extra flow by-passes the bundle.'],
      kout: ['Outlet feeder resistance (× design)', 0.5, 2.5, 'The outlet feeder carries two-phase flow, so its resistance is amplified as soon as the channel boils – it has the strongest leverage on flow at high power.'],
      kin: ['Inlet feeder resistance (× design)', 0.5, 2.5, 'Single-phase resistance upstream of the fuel: lowers flow but also stabilises it.'],
      rohP: ['Outlet header pressure (MPa)', 9.2, 10.8, 'Raising the outlet pressure (with the same pump head) raises saturation temperature: more sub-cooling and less void.'],
      power: ['Channel power (MW)', 2, 10, 'Flow–power coupling: flow drops as the channel boils. CCP itself does not depend on the present power.']
    };
    U.$('#ch-sens', el).innerHTML = Object.keys(this.SENS).map(k => `<option value="${k}">${this.SENS[k][0]}</option>`).join('');
    U.$('#ch-sens', el).addEventListener('change', () => this.sens());
    new ResizeObserver(() => this.strip()).observe(U.$('#ch-strip', el));
    this.load(M.S.sel);
  },
  show(arg) { if (arg && arg.ch != null) this.load(arg.ch); else if (C.app.stale.channel) { C.app.stale.channel = false; this.load(this.ch); } },
  load(c) {
    const S = M.S, th = S.th; this.ch = c; S.sel = c;
    this.base = th.ins[c];
    const cr = S.creep.subarray(c * 12, c * 12 + 12), mx = Math.max(...cr);
    this.creepShape = mx > 0.01 ? Array.from(cr, v => v / mx) : CREEP0.map(v => v / Math.max(...CREEP0));
    const v = { power: th.chMW[c], rihT: th.rihT, rihP: th.rihP, rohP: th.rohP, creep: mx, kin: 1, kout: 1 };
    for (const k in v) { this.st[k] = v[k]; this.s[k].set(v[k]); }
    this.st.shape = 'core'; U.$('#ch-shape', this.el).value = 'core'; U.$('#ch-id', this.el).value = CORE.ch[c].id;
    this.update();
  },
  input(over) {
    const st = Object.assign({}, this.st, over || {}), b = this.base;
    const ax = st.shape === 'core' ? b.axial : SHAPES[st.shape][1]();
    return { axial: CH.refine(ax, 2), creep: Float32Array.from(CH.refineVals(this.creepShape.map(v => v * st.creep), 2)), rihP: Math.max(st.rihP, st.rohP + 0.2), rihT: st.rihT, rohP: st.rohP, kin: b.kin * st.kin, kout: b.kout * st.kout, rough: b.rough };
  },
  update() {
    const st = this.st, inp = this.input(), d = this.det = CH.detail(inp, st.power), el = this.el;
    const ccp = CH.ccp(inp, Math.max(2, st.power)), cpr = ccp / st.power, n = d.z.length;
    let iTs = 0, iTc = 0; for (let i = 0; i < n; i++) { if (d.Tsh[i] > d.Tsh[iTs]) iTs = i; if (d.Tcl[i] > d.Tcl[iTc]) iTc = i; }
    const dry = d.minR < 1, tsIn = pr.tsat(st.rihP - d.dpIn / 1e6);
    U.kpis(U.$('#ch-k', el), [
      ['Channel flow', U.f(d.W, 2), 'kg/s', 'acc'], ['Mass flux', U.f(d.G, 0), 'kg/m²s'], ['Inlet sub-cooling', U.f(tsIn - st.rihT, 1), '°C'], ['Channel exit quality', U.f(d.xE * 100, 1), '%'],
      ['Quality at outlet header', U.f(d.xR * 100, 1), '%', '', 'Pressure falls along the outlet feeder, so more liquid flashes to steam'], ['Exit void fraction', U.f(d.alpha[n - 1] * 100, 0), '%'],
      ['Min CHF ratio', U.f(d.minR, 2), '@ bundle ' + (Math.floor(d.minI / 2) + 1), dry ? 'bad' : d.minR < 1.3 ? 'warn' : 'ok'], ['Critical channel power', U.f(ccp, 2), 'MW', 'acc'], ['Critical power ratio', U.f(cpr, 2), '', cpr < 1 ? 'bad' : cpr < 1.2 ? 'warn' : 'ok'],
      ['Max sheath temp.', U.f(d.Tsh[iTs], 0), '°C', d.Tsh[iTs] > 400 ? 'bad' : ''], ['Max fuel centre-line', U.f(d.Tcl[iTc], 0), '°C', d.Tcl[iTc] > 2600 ? 'bad' : ''], ['Peak linear rating', U.f(Math.max(...d.qf) * Math.PI * K.elOD, 1), 'kW/m']]);
    U.bars(U.$('#ch-dp', el), [['Inlet feeder + end fitting', d.dpIn / 1e3, 'var(--cold)', U.f(d.dpIn / 1e3, 0) + ' kPa'], ['Fuel string (12 bundles)', d.dpCore / 1e3, 'var(--warm)', U.f(d.dpCore / 1e3, 0) + ' kPa'], ['Outlet end fitting + feeder', d.dpOut / 1e3, 'var(--hot)', U.f(d.dpOut / 1e3, 0) + ' kPa']], { max: (st.rihP - st.rohP) * 1e3, lw: 190 });
    U.$('#ch-xs', el).innerHTML = crossSection(st.creep);
    const z = Array.from(d.z), tsat = Array.from(d.p, p => pr.tsat(p));
    const vl = dry ? [{ x: d.z[d.minI], color: '#ff5d6c', label: 'dryout' }] : [];
    this.c1.draw({ x: z, xLabel: 'Distance from channel inlet (m)', yLabel: '°C', vlines: vl, series: [{ name: 'Coolant', y: Array.from(d.T), color: '#4cc2ff' }, { name: 'Saturation', y: tsat, color: '#93a1b5', dash: [4, 3] }, { name: 'Sheath (outer ring)', y: Array.from(d.Tsh), color: '#ff6b5e' }] });
    this.c2.draw({ x: z, xLabel: 'Distance from channel inlet (m)', yLabel: 'quality %', y2Label: 'void %', y2Min: 0, vlines: vl, series: [{ name: 'Thermodynamic quality', y: Array.from(d.x, v => v * 100), color: '#b99cff' }, { name: 'Void fraction', y: Array.from(d.alpha, v => v * 100), axis: 'r', color: '#7ee0c3' }], hlines: [{ y: 0, color: '#586273' }] });
    this.c3.draw({ x: z, xLabel: 'Distance from channel inlet (m)', yLabel: 'kW/m²', y2Label: 'CHFR', y2Min: 0, y2Max: 6, yMin: 0, vlines: vl, series: [{ name: 'Local heat flux', y: Array.from(d.qf), color: '#ffb454' }, { name: 'Critical heat flux', y: Array.from(d.qc, v => Math.min(v, 6000)), color: '#ff6b5e', dash: [5, 3] }, { name: 'CHF ratio', y: Array.from(d.chfr, v => Math.min(v, 6)), axis: 'r', color: '#7ee0c3' }], yMax: Math.max(2500, Math.max(...d.qf) * 1.4), hlines: [{ y: 1, axis: 'r', color: '#ff5d6c' }] });
    this.c4.draw({ x: z, xLabel: 'Distance from channel inlet (m)', yLabel: '°C', y2Label: 'MPa', vlines: vl, series: [{ name: 'Fuel centre-line', y: Array.from(d.Tcl), color: '#ff6b5e' }, { name: 'Pellet surface', y: Array.from(d.Tfs), color: '#ffb454' }, { name: 'Coolant pressure', y: Array.from(d.p), axis: 'r', color: '#4cc2ff', dash: [4, 3] }] });
    this.strip(); this.sens();
  },
  strip() {
    const d = this.det; if (!d) return;
    const g = U.fit(U.$('#ch-strip', this.el)); if (!g) return;
    const { ctx, w, h } = g, n = d.z.length, x0 = 86, x1 = w - 86, cw = (x1 - x0) / n, y0 = 34, ch = 44, cm = U.cmap('heat');
    ctx.font = '11px "Segoe UI", sans-serif'; ctx.textBaseline = 'middle';
    // end fittings and feeders
    ctx.fillStyle = '#3a475a'; ctx.fillRect(x0 - 40, y0 - 3, 40, ch + 6); ctx.fillRect(x1, y0 - 3, 40, ch + 6);
    ctx.strokeStyle = '#5aa9ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 - 26, y0 - 3); ctx.lineTo(x0 - 26, 6); ctx.lineTo(8, 6); ctx.stroke();
    ctx.strokeStyle = '#ff6b5e'; ctx.beginPath(); ctx.moveTo(x1 + 26, y0 - 3); ctx.lineTo(x1 + 26, 6); ctx.lineTo(w - 8, 6); ctx.stroke();
    ctx.fillStyle = '#93a1b5'; ctx.textAlign = 'left'; ctx.fillText('inlet', 4, y0 + 14); ctx.fillText('feeder', 4, y0 + 27); ctx.fillText(`${U.f(this.st.rihT, 0)} °C`, 4, y0 + 42); ctx.textAlign = 'right'; ctx.fillText('outlet', w - 4, y0 + 14); ctx.fillText('feeder', w - 4, y0 + 27); ctx.fillText(`x ${U.f(d.xR * 100, 1)} %`, w - 4, y0 + 42);
    ctx.textAlign = 'center'; ctx.fillStyle = '#c5d0df'; ctx.fillText('end', x0 - 20, y0 + ch / 2 - 6); ctx.fillText('fitting', x0 - 20, y0 + ch / 2 + 7); ctx.fillText('end', x1 + 20, y0 + ch / 2 - 6); ctx.fillText('fitting', x1 + 20, y0 + ch / 2 + 7);
    const rnd = P.rng(7);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cm((d.T[i] - 255) / 62); ctx.fillRect(x0 + i * cw, y0, cw + 0.6, ch);
      const nb = Math.round(d.alpha[i] * 26); ctx.fillStyle = '#ffffffcc';
      for (let k = 0; k < nb; k++) { ctx.beginPath(); ctx.arc(x0 + (i + rnd()) * cw, y0 + 3 + rnd() * (ch - 6), 1.2 + rnd() * 1.6, 0, 7); ctx.fill(); }
      if (d.chfr[i] < 1) { ctx.fillStyle = '#ff2d3f'; ctx.fillRect(x0 + i * cw, y0 + ch + 3, cw + 0.6, 6); }
    }
    ctx.strokeStyle = '#0b0f1499'; ctx.lineWidth = 1;
    for (let b = 0; b <= 12; b++) { const x = x0 + b * (x1 - x0) / 12; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + ch); ctx.stroke(); if (b < 12) { ctx.fillStyle = '#93a1b5'; ctx.fillText(b + 1, x + (x1 - x0) / 24, y0 + ch + 20); } }
    ctx.fillStyle = '#93a1b5'; ctx.fillText('bundle position', (x0 + x1) / 2, h - 8);
    ctx.fillStyle = '#fff'; ctx.fillText('flow →', x0 + 28, y0 - 10);
  },
  sens() {
    const k = U.$('#ch-sens', this.el).value, s = this.SENS[k], xs = [], ccp = [], fl = [], xe = [];
    for (let i = 0; i <= 12; i++) {
      const v = s[1] + (s[2] - s[1]) * i / 12, inp = this.input({ [k]: v }), pw = k === 'power' ? v : this.st.power;
      const f = CH.flow(inp, pw); xs.push(v); fl.push(f.W); xe.push(f.xE * 100); ccp.push(CH.ccp(inp, Math.max(2, this.st.power)));
    }
    this.c5.draw({ x: xs, xLabel: s[0], yLabel: 'MW', y2Label: 'kg/s', series: [{ name: 'Critical channel power', y: ccp, color: '#ff6b5e', dots: true }, { name: 'Channel power now', y: xs.map(v => k === 'power' ? v : this.st.power), color: '#ffb454', dash: [5, 3] }, { name: 'Channel flow', y: fl, axis: 'r', color: '#4cc2ff', dots: true }], vlines: [{ x: this.st[k], color: '#ffffff66', label: 'now' }] });
    U.$('#ch-sn', this.el).innerHTML = s[3];
  }
};
})();
