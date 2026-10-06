/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, PL = P.plant, pr = P.props, D = C.data;
const pipe = (d, cls) => `<path class="pipe ${cls}" d="${d}"/><path class="flow" d="${d}"/>`;

function loopSvg() {
  const sg = (x, lbl) => `<g class="hs" data-c="sg"><path class="eq" d="M${x},120 L${x},70 Q${x - 8},60 ${x - 8},50 Q${x - 8},28 ${x + 40},28 Q${x + 88},28 ${x + 88},50 Q${x + 88},60 ${x + 80},70 L${x + 80},120 Z"/><path d="M${x + 20},118 L${x + 20},70 Q${x + 40},50 ${x + 60},70 L${x + 60},118" fill="none" stroke="#ff9e64" stroke-width="2.5"/><text class="lbl" x="${x + 16}" y="46">${lbl}</text><path d="M${x + 40},28 L${x + 40},8" stroke="#d8dee9" stroke-width="3"/><text x="${x + 46}" y="14">steam</text><path d="M${x - 26},96 L${x},96" stroke="#58c7a3" stroke-width="3"/><text x="${x - 60}" y="90">feedwater</text></g>`;
  return `<svg class="sch" viewBox="0 0 780 300" role="img" aria-label="Figure-of-eight heat transport loop">
    <rect class="eq" x="300" y="128" width="170" height="124" rx="8"/><text class="lbl" x="352" y="122">Reactor core</text>
    <path d="M312,222 L458,222" stroke="#ffb454" stroke-width="10" stroke-linecap="round"/><path d="M458,160 L312,160" stroke="#ffb454" stroke-width="10" stroke-linecap="round"/>
    <text x="344" y="242">95 channels →</text><text x="344" y="146">← 95 channels</text><text class="val" x="344" y="196" data-v="dp">ΔP 1.25 MPa</text>
    ${pipe('M230,222 L312,222', 'coldp')}${pipe('M312,160 L230,160', 'hotp')}${pipe('M458,222 L540,222', 'hotp')}${pipe('M540,160 L458,160', 'coldp')}
    <g class="hs" data-c="headers"><rect class="eq" x="212" y="212" width="22" height="20" rx="8" style="stroke:var(--cold)"/><rect class="eq" x="212" y="150" width="22" height="20" rx="8" style="stroke:var(--hot)"/><rect class="eq" x="536" y="212" width="22" height="20" rx="8" style="stroke:var(--hot)"/><rect class="eq" x="536" y="150" width="22" height="20" rx="8" style="stroke:var(--cold)"/>
</g>
    <g class="hs" data-c="feeders"><text x="244" y="216">feeders</text><text x="476" y="216">feeders</text></g>
    ${pipe('M212,160 L140,160 L140,120', 'hotp')}${pipe('M100,120 L100,222 L212,222', 'coldp')}
    ${pipe('M558,222 L680,222 L680,120', 'hotp')}${pipe('M640,120 L640,160 L558,160', 'coldp')}
    ${sg(80, 'SG 1')}${sg(620, 'SG 2')}
    <g class="hs" data-c="htpump"><circle class="eq" cx="160" cy="222" r="13"/><text x="155" y="226">P</text><circle class="eq" cx="600" cy="160" r="13"/><text x="595" y="164">P</text></g>
    <g class="hs" data-c="pressurizer"><rect class="eq" x="724" y="150" width="26" height="80" rx="12"/><rect x="726" y="192" width="22" height="36" rx="9" fill="#ff6b5e44"/><path d="M737,230 L737,264 L680,264 L680,222" stroke="#ff6b5e" stroke-width="2" fill="none"/><text x="700" y="144">Pressurizer</text></g>
    <text x="196" y="143">outlet header</text><text x="196" y="262">inlet header</text><text x="524" y="143">inlet header</text><text x="488" y="262">outlet header</text>
    <text class="val" x="150" y="246" data-v="rih"></text><text class="val" x="150" y="184" data-v="roh"></text><text class="val" x="488" y="246" data-v="roh2"></text><text class="val" x="488" y="184" data-v="rih2"></text>
    <text class="val" x="180" y="52" data-v="sg"></text><text class="val" x="180" y="68" data-v="sg2"></text><text class="val" x="8" y="292" data-v="pump"></text>
    <text x="330" y="292">One of two identical loops · each loop cools half the core</text></svg>`;
}

C.views.pht = {
  init(el) {
    this.el = el;
    el.innerHTML = `
      <p class="lead">Two identical figure-of-eight loops each push coolant through the core twice per circuit. The pumps supply the head, the feeders distribute it, the steam generators remove the heat and – through the secondary pressure – fix the temperature at which coolant returns to the core. These plant-level conditions are shared by all 380 channels.</p>
      <div class="grid gside">
        <div class="stack">
          <div class="card"><h4>Operating point</h4><div id="ph-s1"></div></div>
          <div class="card"><h4>Component condition</h4><div id="ph-s2"></div><p class="small mut" style="margin:0">These four are the same quantities the Ageing module moves together with effective full-power years.</p><div class="row" style="margin-top:8px"><button class="btn" id="ph-reset">Reset to design</button></div></div>
        </div>
        <div class="stack">
          <div class="card"><div id="ph-svg"></div></div>
          <div class="card"><div class="kpis" id="ph-k"></div></div>
          <div class="grid g2"><div class="card" id="ph-c1"></div><div class="card" id="ph-c2"></div><div class="card" id="ph-c3"></div><div class="card" id="ph-c4"></div></div>
          <div class="grid g3" id="ph-notes"></div>
        </div>
      </div>`;
    U.$('#ph-svg', el).innerHTML = loopSvg();
    const S = M.S, go = U.debounce(() => M.solveTH(), 60);
    const s1 = U.$('#ph-s1', el), s2 = U.$('#ph-s2', el); this.s = {};
    this.s.power = U.slider(s1, { label: 'Reactor power', min: 20, max: 115, step: 1, value: S.op.power * 100, unit: '% FP', on: v => { S.op.power = v / 100; go(); } });
    this.s.steamP = U.slider(s1, { label: 'Steam-generator pressure', min: 4.0, max: 5.4, step: 0.01, value: S.op.steamP, unit: 'MPa', dec: 2, on: v => { S.op.steamP = v; go(); } });
    this.s.fwT = U.slider(s1, { label: 'Feedwater temperature', min: 120, max: 200, step: 1, value: S.op.fwT, unit: '°C', on: v => { S.op.fwT = v; go(); } });
    this.s.sgUA = U.slider(s2, { label: 'Steam-generator heat transfer (UA)', min: 75, max: 105, step: 0.5, value: S.age.sgUA * 100, unit: '%', dec: 1, on: v => { S.age.sgUA = v / 100; go(); } });
    this.s.pump = U.slider(s2, { label: 'Pump head', min: 85, max: 105, step: 0.5, value: S.age.pump * 100, unit: '%', dec: 1, on: v => { S.age.pump = v / 100; go(); } });
    this.s.kin = U.slider(s2, { label: 'Inlet feeder resistance', min: 90, max: 140, step: 1, value: S.age.kin * 100, unit: '%', on: v => { S.age.kin = v / 100; go(); } });
    this.s.kout = U.slider(s2, { label: 'Outlet feeder resistance', min: 90, max: 140, step: 1, value: S.age.kout * 100, unit: '%', on: v => { S.age.kout = v / 100; go(); } });
    U.$('#ph-reset', el).addEventListener('click', () => { S.op = { power: 1, steamP: P.K.steamP, fwT: P.K.fwT }; const y = S.age.efpy, cr = S.age.creepRate; S.age = P.aging.fromEFPY(0); S.age.efpy = y; S.age.creepRate = cr; this.sync(); M.solveTH(); });
    this.c1 = U.chartBox(U.$('#ph-c1', el), 'Pressure around the loop (hottest channel)');
    U.$('#ph-c1', el).appendChild(U.el('<p class="small mut" style="margin:4px 0 0">0 pump discharge · 1 inlet header · 2 channel inlet · 3 channel exit · 4 outlet header · 5 steam-generator inlet · 6 pump suction · 7 pump discharge. Where the two curves touch, the coolant is boiling.</p>'));
    this.c2 = U.chartBox(U.$('#ph-c2', el), 'Steam generator: temperature against heat transferred');
    this.c3 = U.chartBox(U.$('#ph-c3', el), 'Power sweep: header temperatures');
    this.c4 = U.chartBox(U.$('#ph-c4', el), 'Power sweep: core flow and margin to dryout');
    U.$('#ph-notes', el).innerHTML = ['htpump', 'feeders', 'headers', 'sg', 'pressurizer', 'feedbleed'].map(id => { const c = D.components.find(x => x.id === id); return `<div class="note"><h4>${c.name}</h4>${c.th}</div>`; }).join('');
    U.$$('g.hs', el).forEach(g => g.addEventListener('click', () => C.app.go('library', g.dataset.c)));
    this.sweepL = U.debounce(() => this.sweep(), 450);
    C.app.live('pht', 'th', () => this.update());
  },
  sync() { const S = M.S; this.s.power.set(S.op.power * 100); this.s.steamP.set(S.op.steamP); this.s.fwT.set(S.op.fwT); this.s.sgUA.set(S.age.sgUA * 100); this.s.pump.set(S.age.pump * 100); this.s.kin.set(S.age.kin * 100); this.s.kout.set(S.age.kout * 100); },
  show() { this.sync(); this.update(); },
  update() {
    const S = M.S, th = S.th, el = this.el, set = (k, t) => { const n = U.$(`[data-v="${k}"]`, el); if (n) n.textContent = t; };
    const rih = `${U.f(th.rihT, 1)} °C · ${U.f(th.rihP, 2)} MPa`, roh = `${U.f(th.tROH, 1)} °C · x ${U.f(Math.max(0, th.xROH) * 100, 1)} %`;
    set('rih', rih); set('rih2', rih); set('roh', roh); set('roh2', roh); set('dp', `ΔP ${U.f(th.dpHH, 2)} MPa`);
    set('sg', `${U.f(th.qCore / 4, 0)} MW each`); set('sg2', `${U.f(th.Ts, 1)} °C sat.`); set('pump', `each HT pump: ${U.f(th.wTot / 4, 0)} kg/s · ${U.f(th.pumpDP, 2)} MPa head`);
    const sub = pr.tsat(th.rihP) - th.rihT;
    U.kpis(U.$('#ph-k', el), [['Heat to coolant', U.f(th.qCore, 0), 'MW', 'acc'], ['Core flow', U.f(th.wTot, 0), 'kg/s', th.wTot < 7400 ? 'warn' : ''], ['Inlet header', U.f(th.rihT, 1), '°C', th.rihT > 268 ? 'warn' : ''], ['Inlet sub-cooling', U.f(sub, 1), '°C'],
      ['Outlet header quality', U.f(Math.max(0, th.xROH) * 100, 1), '%', th.xROH > 0.06 ? 'warn' : ''], ['Header-to-header ΔP', U.f(th.dpHH * 1e3, 0), 'kPa'], ['Pinch: RIH − T<sub>sat,sec</sub>', U.f(th.rihT - th.Ts, 1), '°C'], ['SG condensing zone', U.f(th.sg.a1 * 100, 0), '% of area'],
      ['Steam flow', U.f(th.steamFlow, 0), 'kg/s'], ['Gross electric', U.f(th.mwe, 0), 'MWe', 'acc'], ['Min critical power ratio', U.f(S.minCPR, 2), '', S.minCPR < 1.2 ? 'warn' : 'ok'], ['Pressurizer level', U.f(4 + 8.5 * S.op.power, 1), 'm']]);
    // pressure profile through the hottest channel
    const c = S.flux.maxChIdx, d = P.channel.detail(th.ins[c], th.chMW[c]);
    const pOut = th.rihP + 0.08, pSuc = pOut - th.pumpDP;
    const pts = [pOut, th.rihP, th.rihP - d.dpIn / 1e6, d.pExit, th.rohP, th.rohP - 0.06, pSuc, pOut];
    this.c1.draw({ x: [0, 1, 2, 3, 4, 5, 6, 7], xLabel: 'Station around the loop', yLabel: 'MPa', series: [{ name: 'Coolant pressure', y: pts, color: '#4cc2ff', dots: true }, { name: 'Saturation pressure of local coolant', y: [th.rihT, th.rihT, th.rihT, d.TE, th.tROH, th.tROH, th.sg.Tout, th.rihT].map(t => pr.psat(t)), color: '#ff6b5e', dash: [4, 3], dots: true }] });
    // steam generator T-Q
    const sgm = th.sg, hg = pr.hfg(th.rohP), W = th.wTot / 4, qc = W * sgm.x * hg, qs = W * (pr.hL(sgm.Tin) - pr.hL(sgm.Tout)), qt = qc + qs, fc = qc / qt;
    const fpre = 4.6 * (th.Ts - th.fwT) / (pr.hfgH2O(th.steamP) + 4.6 * (th.Ts - th.fwT));
    const qx = [], tp = [], tsx = [];
    for (let i = 0; i <= 40; i++) { const q = i / 40; qx.push(q * 100); tp.push(q <= fc ? sgm.Tin : sgm.Tin - (sgm.Tin - sgm.Tout) * (1 - Math.exp(-2.2 * (q - fc) / (1 - fc))) / (1 - Math.exp(-2.2))); tsx.push(q < 1 - fpre ? th.Ts : th.Ts - (th.Ts - th.fwT) * (q - (1 - fpre)) / fpre); }
    this.c2.draw({ x: qx, xLabel: 'Heat transferred (% of duty, from primary inlet to outlet)', yLabel: '°C', series: [{ name: 'Primary D₂O (tubes)', y: tp, color: '#ff6b5e' }, { name: 'Secondary H₂O (shell)', y: tsx, color: '#4cc2ff' }], vlines: [{ x: (1 - fpre) * 100, color: '#586273', label: 'preheater' }] });
    this.sweepL();
  },
  sweep() {
    const S = M.S, xs = [], rih = [], roh = [], q = [], fl = [], cpr = [];
    const save = { r: PL._rihT, d: PL._dp, w: PL.wGuess.slice() };
    for (let p = 40; p <= 112; p += 8) {
      const th = PL.solve({ flux: S.flux, power: p / 100, age: S.age, creep: S.creep, steamP: S.op.steamP, fwT: S.op.fwT });
      const ccp = PL.ccp(th); let m = 1e9; for (let i = 0; i < ccp.length; i++) m = Math.min(m, ccp[i] / th.chMW[i]);
      xs.push(p); rih.push(th.rihT); roh.push(th.tROH); q.push(Math.max(0, th.xROH) * 100); fl.push(th.wTot); cpr.push(m);
    }
    PL._rihT = save.r; PL._dp = save.d; PL.wGuess = save.w;
    const now = [{ x: S.op.power * 100, color: '#ffffff66', label: 'now' }];
    this.c3.draw({ x: xs, xLabel: 'Reactor power (% FP)', yLabel: '°C', y2Label: 'quality %', y2Min: 0, vlines: now, series: [{ name: 'Inlet header', y: rih, color: '#4cc2ff', dots: true }, { name: 'Outlet header', y: roh, color: '#ff6b5e', dots: true }, { name: 'Outlet quality', y: q, axis: 'r', color: '#b99cff', dash: [4, 3] }] });
    this.c4.draw({ x: xs, xLabel: 'Reactor power (% FP)', yLabel: 'kg/s', y2Label: 'CPR', vlines: now, series: [{ name: 'Core flow', y: fl, color: '#4cc2ff', dots: true }, { name: 'Min critical power ratio', y: cpr, axis: 'r', color: '#7ee0c3', dots: true }], hlines: [{ y: 1, axis: 'r', color: '#ff5d6c', label: 'dryout' }] });
  }
};
})();
