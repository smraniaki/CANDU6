/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys;

const SCEN = [
  { id: 'loca', name: 'Inlet-header break (LOCA)', cls: 'danger', sl: { label: 'Break size', min: 1, max: 100, step: 1, value: 100, unit: '% of 2× header area' }, speed: 1, run: (s, v) => s.act('loca', { size: v / 100 }), tip: 'Coolant voids in the broken loop → positive reactivity → power pulse. Watch which trip fires first, then the ECC sequence. Try 3 % for a small break.' },
  { id: 'pumps', name: 'Loss of Class IV power (all pumps)', cls: 'warn', speed: 1, run: s => s.act('pumps'), tip: 'Flow coasts down on pump inertia. Stepback, then a low-flow trip. Afterwards decay heat is removed by thermosyphoning.' },
  { id: 'lor', name: 'Loss of regulation', cls: 'warn', sl: { label: 'Reactivity insertion rate', min: 0.01, max: 1, step: 0.01, value: 0.05, unit: 'mk/s', dec: 2 }, speed: 1, run: (s, v) => s.act('lor', { rate: v }), tip: 'The zone controllers drain uncontrollably. The ROP detectors must trip the reactor before the limiting channel dries out – lower the trip set-point margin and see.' },
  { id: 'feed', name: 'Loss of feedwater', cls: 'warn', speed: 10, run: s => s.act('feed'), tip: 'Steam-generator inventory boils down for about a minute before the low-level trip.' },
  { id: 'msb', name: 'Main steam line break', cls: 'warn', speed: 1, run: s => s.act('msb'), tip: 'Secondary depressurises, primary over-cools and shrinks: low-pressure trip. Note that reactivity goes slightly negative.' },
  { id: 'modcool', name: 'Loss of moderator cooling', cls: 'warn', speed: 10, run: s => s.act('modcool'), tip: 'Moderator heats ≈ 5 °C/min. The positive moderator coefficient makes the zones fill.' },
  { id: 'ext', name: 'Insert absorber / isotope target', cls: '', sl: { label: 'Reactivity worth', min: -8, max: 3, step: 0.1, value: -2, unit: 'mk', dec: 1 }, speed: 1, run: (s, v) => s.act('ext', { mk: v, time: 8, label: v < 0 ? 'Target inserted' : 'Absorber withdrawn' }), tip: 'Up to ≈ −3 mk the zones simply drain to compensate. Beyond their range the adjusters must come out and power sags. A positive value simulates a fast withdrawal.' },
  { id: 'refuel', name: 'Refuel a channel', cls: '', speed: 10, run: s => s.act('ext', { mk: 0.2, time: 120, label: 'Channel refuelled' }), tip: '+0.2 mk over two minutes, absorbed by a few per cent of zone level.' },
  { id: 'setpoint', name: 'Change power set-point', cls: '', sl: { label: 'Target power', min: 2, max: 100, step: 1, value: 60, unit: '% FP' }, speed: 60, run: (s, v) => s.act('setpoint', { power: v / 100, rate: 0.005 }), tip: 'After reducing power, speed up to 600× or 3600× and watch xenon build up, the zones drain and adjusters withdraw.' },
  { id: 'sds1', name: 'Manual trip: SDS1 (shutoff rods)', cls: 'danger', speed: 1, run: s => s.act('sds1'), tip: '28 rods, about −80 mk in 2 s. Then run at 3600× to follow the xenon transient: can the reactor be restarted after 30 minutes? After 10 hours?' },
  { id: 'sds2', name: 'Manual trip: SDS2 (poison injection)', cls: 'danger', speed: 1, run: s => s.act('sds2'), tip: 'Gadolinium nitrate into the moderator: more than −300 mk.' }
];
const TU = t => t > 7200 ? [3600, 'h'] : t > 300 ? [60, 'min'] : [1, 's'];

C.views.sim = {
  init(el) {
    this.el = el; this.sim = new P.Sim(); this.run = false; this.speed = 1; this.logY = false; this.vals = {};
    el.innerHTML = `
      <p class="lead">A point-kinetics model of the whole plant: six delayed-neutron groups, fuel and coolant temperature feedback, void, xenon, the regulating system (zones, adjusters, absorbers, stepback), both shutdown systems with their trip parameters, steam generators, pressurizer, emergency core cooling and the moderator heat sink. Start it, trigger an event, and read the sequence in the charts and the event log.</p>
      <div class="card row" id="sm-bar">
        <button class="btn pri" id="sm-run">▶ Run</button><button class="btn" id="sm-reset">Reset</button>
        <span class="mut small">initial power</span><select id="sm-p0" aria-label="Initial power"><option value="1">100 %</option><option value="0.8">80 %</option><option value="0.6">60 %</option></select>
        <span class="mut small">speed</span><span id="sm-speed"></span>
        <span class="sp"></span><span class="mono" id="sm-t" style="font-size:16px">t = 0.0 s</span><span class="tag" id="sm-state">critical</span>
      </div>
      <div class="grid gside" style="margin-top:14px">
        <div class="stack">
          <div class="card"><h4>Initiating events</h4><div id="sm-sc"></div><div class="note" id="sm-tip" style="margin-top:8px">Press Run, then choose an event.</div></div>
          <div class="card"><h4>What is available</h4><div id="sm-av" class="stack" style="--g:4px"></div><div id="sm-tsp" style="margin-top:10px"></div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="kpis" id="sm-k"></div></div>
          <div class="grid g64">
            <div class="card"><h4>Reactor mimic</h4><canvas id="sm-mim" style="height:230px"></canvas></div>
            <div class="card"><h4>Trip parameters and status</h4><div class="tiles" id="sm-tiles"></div></div>
          </div>
          <div class="card"><div class="row"><h4 style="margin:0">Event log</h4><span class="sp"></span><label class="chk"><input type="checkbox" id="sm-log"> log scale for power</label></div><div class="log" id="sm-ev" style="margin-top:6px"></div></div>
          <div class="grid g2"><div class="card" id="sm-c1"></div><div class="card" id="sm-c2"></div><div class="card" id="sm-c3"></div><div class="card" id="sm-c4"></div><div class="card" id="sm-c5"></div><div class="card" id="sm-c6"></div></div>
        </div>
      </div>`;
    U.$('#sm-run', el).addEventListener('click', () => this.toggle());
    U.$('#sm-reset', el).addEventListener('click', () => this.reset());
    U.$('#sm-log', el).addEventListener('change', e => { this.logY = e.target.checked; this.draw(true); });
    this.spd = U.seg(U.$('#sm-speed', el), [[0.2, '0.2×'], [1, '1×'], [10, '10×'], [60, '60×'], [600, '600×'], [3600, '3600×']], 1, v => { this.speed = +v; });
    const sc = U.$('#sm-sc', el);
    SCEN.forEach(s => {
      const box = U.el(`<div style="margin-bottom:8px"><button class="btn ${s.cls}" style="width:100%;text-align:left">${s.name}</button></div>`);
      if (s.sl) { this.vals[s.id] = s.sl.value; U.slider(box, Object.assign({}, s.sl, { on: v => { this.vals[s.id] = v; } })); }
      box.querySelector('button').addEventListener('click', () => this.fire(s));
      sc.appendChild(box);
    });
    const av = U.$('#sm-av', el), p = this.sim.par;
    [['sds1Avail', 'Shutdown System 1 available'], ['sds2Avail', 'Shutdown System 2 available'], ['eccAvail', 'Emergency core cooling available'], ['stepback', 'Regulating-system stepback enabled'], ['rrsAuto', 'Regulating system in automatic']].forEach(a => { const d = U.el('<div></div>'); U.check(d, a[1], p[a[0]], v => { this.sim.par[a[0]] = v; }); av.appendChild(d); });
    const d2 = U.el('<div></div>'); U.check(d2, 'Two most effective shutoff rods unavailable', true, v => { this.sim.par.sorMissing = v ? 2 : 0; }); av.appendChild(d2);
    this.tsp = U.slider(U.$('#sm-tsp', el), { label: 'ROP trip set-point (both systems)', min: 105, max: 130, step: 0.5, value: M.S.tsp * 100, unit: '% FP', dec: 1, on: v => { M.S.tsp = v / 100; this.sim.par.tsp1 = this.sim.par.tsp2 = v / 100; } });
    this.ch = [['#sm-c1', 'Reactor power (% of full power)'], ['#sm-c2', 'Reactivity (mk)'], ['#sm-c3', 'Temperatures (°C)'], ['#sm-c4', 'Heat transport system'], ['#sm-c5', 'Reactivity devices (% inserted / % full)'], ['#sm-c6', 'Xenon, moderator and containment']].map(c => U.chartBox(U.$(c[0], el), c[1]));
    new ResizeObserver(() => this.mimic()).observe(U.$('#sm-mim', el));
    this.draw(true);
  },
  show(arg) {
    this.tsp.set(M.S.tsp * 100); this.sim.par.tsp1 = this.sim.par.tsp2 = M.S.tsp;
    if (arg && arg.scenario) {
      this.reset();
      let id = arg.scenario[0], v = arg.scenario[1] || {};
      if (id === 'locaNoEcc') { this.sim.par.eccAvail = false; U.$$('#sm-av input', this.el)[2].checked = false; id = 'loca'; }
      const s = SCEN.find(x => x.id === id);
      if (s) { this.pending = { s, v: v.size != null ? v.size * 100 : v.rate != null ? v.rate : v.mk != null ? v.mk : this.vals[id], at: 2 }; U.$('#sm-tip', this.el).innerHTML = `<h4>${s.name}</h4>${s.tip} <i>The event starts 2 s after you press Run.</i>`; this.speed = s.speed; this.spd.set(s.speed); if (!this.run) this.toggle(); }
    }
    this.last = performance.now(); if (this.run) this.loop();
  },
  hide() { cancelAnimationFrame(this.raf); },
  fire(s) {
    if (!this.run) this.toggle();
    s.run(this.sim, this.vals[s.id]);
    if (s.speed !== this.speed && s.speed < this.speed) { this.speed = s.speed; this.spd.set(s.speed); }
    U.$('#sm-tip', this.el).innerHTML = `<h4>${s.name}</h4>${s.tip}`;
  },
  toggle() { this.run = !this.run; U.$('#sm-run', this.el).textContent = this.run ? '❚❚ Pause' : '▶ Run'; this.last = performance.now(); if (this.run) this.loop(); },
  reset() { const par = this.sim.par; this.sim = new P.Sim(); Object.assign(this.sim.par, par); this.sim.reset(+U.$('#sm-p0', this.el).value); this.pending = null; this.nlog = -1; this.draw(true); },
  loop() {
    cancelAnimationFrame(this.raf);
    const step = now => {
      if (!this.run || C.app.cur !== 'sim') return;
      const dt = Math.min(0.06, (now - this.last) / 1000); this.last = now;
      if (this.pending && this.sim.t >= this.pending.at) { const p = this.pending; this.pending = null; p.s.run(this.sim, p.v); }
      this.sim.advance(dt, this.speed);
      this.draw(false);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  draw(force) {
    const now = performance.now(); if (!force && now - (this.lastDraw || 0) < 110) return; this.lastDraw = now;
    const s = this.sim, el = this.el, p = s.par, tu = TU(s.t);
    U.$('#sm-t', el).textContent = 't = ' + (s.t > 7200 ? U.f(s.t / 3600, 2) + ' h' : s.t > 300 ? U.f(s.t / 60, 1) + ' min' : U.f(s.t, 1) + ' s');
    const tripped = s.sds1.fired || s.sds2.fired, st = U.$('#sm-state', el);
    st.textContent = tripped ? 'TRIPPED' : s.dry ? 'DRYOUT' : Math.abs(s.rho) < 0.05 ? 'critical' : s.rho > 0 ? 'supercritical' : 'subcritical';
    st.style.color = tripped || s.dry ? 'var(--bad)' : 'var(--ok)'; st.style.borderColor = st.style.color;
    const pd = s.dh.reduce((a, b) => a + b, 0), rest = p.adjWorth * s.adjIn + p.lzcWorth * (s.lzc - 0) + p.mcaWorth * s.mca - (p.xeEq * (s.x - 1) < 0 ? -p.xeEq * (s.x - 1) : 0);
    U.kpis(U.$('#sm-k', el), [['Neutron power', s.n > 0.001 ? U.f(s.n * 100, 1) : (s.n * 100).toExponential(1), '% FP', s.n > 1.1 ? 'bad' : 'acc'], ['Thermal power', U.f(s.pth * 100, 1), '% FP'], ['Decay heat', U.f(pd * 100, 2), '% FP'], ['Reactivity', (s.rho >= 0 ? '+' : '') + U.f(Math.max(-999, s.rho), 2), 'mk', s.rho > 1 ? 'bad' : ''],
      ['Fuel (average)', U.f(s.Tf, 0), '°C', s.Tf > 1200 ? 'bad' : ''], ['Sheath (limiting)', U.f(s.Tsh, 0), '°C', s.Tsh > 600 ? 'bad' : s.Tsh > 400 ? 'warn' : ''], ['Inlet / outlet', U.f(s.Tin, 0) + ' / ' + U.f(s.Tout, 0), '°C'], ['HT pressure', U.f(s.P, 2), 'MPa', s.P > 10.4 || s.P < 8.7 ? 'warn' : ''],
      ['Core flow', U.f(s.flow * 100, 0), '%', s.flow < 0.8 ? 'warn' : ''], ['Critical power ratio', U.f(Math.min(s.cpr, 9.99), 2), '', s.cpr < 1 ? 'bad' : s.cpr < 1.15 ? 'warn' : 'ok'], ['Xenon load', U.f(p.xeEq * s.x, 1), 'mk'], ['Restart margin', U.f(rest, 1), 'mk', tripped && rest < 0 ? 'bad' : '', 'Positive reactivity still available from zones, adjusters and absorbers minus xenon above equilibrium. Negative = poisoned out.']]);
    const det = s.n * p.cppf * 100, lit = (cond, cause) => cond || ((s.sds1.fired && s.sds1.cause.indexOf(cause) >= 0) || (s.sds2.fired && s.sds2.cause.indexOf(cause) >= 0));
    const T = (name, val, on, amber) => `<div class="tile ${on ? 'on' : amber ? 'amber' : ''}">${name}<b>${val}</b></div>`;
    U.$('#sm-tiles', el).innerHTML = [
      T('ROP detectors · trip ' + U.f(p.tsp1 * 100, 0) + ' %', U.f(det, 1) + ' %', lit(det > p.tsp1 * 100, 'neutron power'), det > p.tsp1 * 100 - 5),
      T('Log rate · trip 10 %/s', U.f(s.logRate * 100, 1) + ' %/s', lit(s.logRate > p.logRate1, 'log'), s.logRate > 0.04),
      T('HT pressure high · 10.45', U.f(s.P, 2) + ' MPa', lit(s.P > p.hiP1, 'high heat-transport'), s.P > 10.25),
      T('HT pressure low · 8.7', U.f(s.P, 2) + ' MPa', lit(false, 'low heat-transport pressure'), s.P < 9.2),
      T('HT flow low · 80 %', U.f(s.flow * 100, 0) + ' %', lit(false, 'flow') || lit(false, 'differential'), s.flow < 0.9),
      T('SG level low · 55 %', U.f(s.sgInv * 100, 0) + ' %', lit(false, 'steam-generator'), s.sgInv < 0.7),
      T('Building pressure · 3.45 kPa', U.f(s.rb, 1) + ' kPa(g)', lit(s.rb > p.rbP, 'building'), s.rb > 1),
      T('Moderator temp. · 87 °C', U.f(s.modT, 1) + ' °C', lit(false, 'moderator'), s.modT > 78),
      T('SDS1', s.sds1.fired ? 'TRIPPED ' + U.f(s.sds1.t, 2) + ' s' : (p.sds1Avail ? 'poised' : 'UNAVAILABLE'), s.sds1.fired, !p.sds1Avail),
      T('SDS2', s.sds2.fired ? 'TRIPPED ' + U.f(s.sds2.t, 2) + ' s' : (p.sds2Avail ? 'poised' : 'UNAVAILABLE'), s.sds2.fired, !p.sds2Avail),
      T('Stepback', s.stepbackT >= 0 ? 'at ' + U.f(s.stepbackT, 1) + ' s' : 'armed', false, s.stepbackT >= 0),
      T('ECC', s.ecc > 0 ? 'INJECTING' : s.eccSig ? (p.eccAvail ? 'initiated' : 'FAILED') : 'standby', s.eccSig && !p.eccAvail, s.eccSig),
      T('Fuel dryout', s.dry ? 'YES · ' + U.f(s.tDry, 0) + ' s' : 'no', s.dry, false),
      T('PT / CT contact', s.ptContact ? 'moderator heat sink' : 'no', false, s.ptContact)
    ].join('');
    if (s.log.length !== this.nlog) { this.nlog = s.log.length; const lg = U.$('#sm-ev', el); lg.innerHTML = s.log.length ? s.log.map(l => `<div class="${l.cls}">${l.t > 600 ? U.f(l.t / 60, 1) + ' min' : U.f(l.t, 2) + ' s'} &nbsp; ${l.msg}</div>`).join('') : '<div>No events yet.</div>'; lg.scrollTop = lg.scrollHeight; }
    const h = s.hist, x = h.t.map(t => t / tu[0]), xl = 'Time (' + tu[1] + ')', c = this.ch;
    c[0].draw({ x, xLabel: xl, logY: this.logY, yMin: this.logY ? 1e-4 : 0, series: [{ name: 'Neutron', y: h.n, color: '#4cc2ff' }, { name: 'Thermal', y: h.pth, color: '#ff6b5e' }], hlines: this.logY ? [] : [{ y: p.tsp1 / p.cppf * 100, color: '#ffb454', label: 'ROP trip', fit: false }] });
    c[1].draw({ x, xLabel: xl, minSpan: 2, yMin: tripped ? -32 : null, series: [{ name: 'Total', y: h.rho.map(v => Math.max(v, -32)), color: '#ffffff', width: 2.2 }, { name: 'Zones+rods', y: h.rdev, color: '#7ee0c3' }, { name: 'Temperature+void', y: h.rfb, color: '#ff6b5e' }, { name: 'Xenon change', y: h.rxe.map(v => Math.max(v, -32)), color: '#b99cff' }, { name: 'Shutdown systems', y: h.rsd, color: '#ffb454', dash: [4, 3] }], hlines: [{ y: 0, color: '#586273' }] });
    c[2].draw({ x, xLabel: xl, series: [{ name: 'Fuel average', y: h.Tf, color: '#ff6b5e' }, { name: 'Sheath (limiting)', y: h.Tsh, color: '#ffb454' }, { name: 'Outlet header', y: h.Tout, color: '#f472b6' }, { name: 'Inlet header', y: h.Tin, color: '#4cc2ff' }] });
    c[3].draw({ x, xLabel: xl, yLabel: 'MPa', y2Label: '%', y2Min: 0, y2Max: 110, yMin: 0, yMax: 12, series: [{ name: 'Pressure', y: h.P, color: '#ffffff' }, { name: 'Flow', y: h.flow, axis: 'r', color: '#4cc2ff' }, { name: 'SG inventory', y: h.sg, axis: 'r', color: '#7ee0c3' }, { name: 'Core void', y: h.void, axis: 'r', color: '#b99cff', dash: [4, 3] }] });
    c[4].draw({ x, xLabel: xl, yMin: 0, yMax: 105, series: [{ name: 'Zone level', y: h.lzc, color: '#7dcfff' }, { name: 'Adjusters in', y: h.adj, color: '#9ece6a' }, { name: 'Control absorbers', y: h.mca, color: '#ffb454' }, { name: 'Shutoff rods', y: h.sor, color: '#ff6b5e' }] });
    c[5].draw({ x, xLabel: xl, yLabel: 'mk', y2Label: '°C · kPa', series: [{ name: 'Xenon load', y: h.xe, color: '#b99cff' }, { name: 'Moderator temp.', y: h.modT, axis: 'r', color: '#7dcfff' }, { name: 'Building pressure', y: h.rb, axis: 'r', color: '#ffb454' }] });
    this.mimic();
  },
  mimic() {
    const s = this.sim, g = U.fit(U.$('#sm-mim', this.el)); if (!g) return;
    const { ctx, w, h } = g, cm = U.cmap('heat');
    const x0 = Math.max(96, w * 0.2), x1 = w - Math.max(170, w * 0.3), y0 = 46, y1 = h - 26, cw = x1 - x0, chh = y1 - y0;
    ctx.fillStyle = `rgba(125,207,255,0.10)`; ctx.fillRect(x0, y0, cw, chh);
    if (s.liss > 0) { ctx.fillStyle = `rgba(185,156,255,${0.55 * s.liss})`; ctx.fillRect(x0, y0, cw, chh); }
    ctx.strokeStyle = '#aab4c3'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, cw, chh);
    for (let i = 0; i < 6; i++) { const y = y0 + (i + 0.5) * chh / 6; ctx.strokeStyle = cm(0.35 + (s.Tf - 250) / 1400); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 - 14, y); ctx.lineTo(x1 + 14, y); ctx.stroke(); if (s.alpha > 0.03) { ctx.fillStyle = '#ffffffbb'; const nb = Math.round(s.alpha * 30); for (let k = 0; k < nb; k++) { ctx.beginPath(); ctx.arc(x0 + ((k * 37 + i * 53) % 100) / 100 * cw, y, 1.5, 0, 7); ctx.fill(); } } }
    const rod = (x, frac, col, wd) => { ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y0 - 30); ctx.lineTo(x, y1); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y0 - 30 + frac * 30); ctx.lineTo(x, y0 + frac * chh); ctx.stroke(); };
    for (let i = 0; i < 14; i++) rod(x0 + (i + 0.5) * cw / 14, s.sor, '#ff6b5e', 3);
    for (let i = 0; i < 7; i++) rod(x0 + (i + 0.25) * cw / 7, s.adjIn * (i / 7 < (1 - s.adjIn) ? 0 : 1), '#9ece6a', 2);
    for (let i = 0; i < 4; i++) rod(x0 + (i + 0.75) * cw / 4 - cw / 16, s.mca, '#ffb454', 3);
    ctx.font = '11px "Segoe UI", sans-serif'; ctx.fillStyle = '#93a1b5'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('shutoff · adjusters · absorbers', x0, 8);
    // zone level, SG, pressurizer gauges
    const gauge = (x, frac, col, lbl, val) => { ctx.strokeStyle = '#3a475a'; ctx.lineWidth = 1; ctx.strokeRect(x, y0, 16, chh); ctx.fillStyle = col; const f = Math.max(0, Math.min(1, frac)); ctx.fillRect(x + 1, y0 + chh * (1 - f), 14, chh * f); ctx.fillStyle = '#93a1b5'; ctx.textAlign = 'center'; ctx.fillText(lbl, x + 8, y1 + 12); ctx.fillStyle = '#dfe6f0'; ctx.fillText(val, x + 8, y0 - 10); };
    gauge(8, s.lzc, '#7dcfff', 'zones', U.f(s.lzc * 100, 0) + '%');
    gauge(48, Math.min(1.2, s.n) / 1.2, '#4cc2ff', 'power', U.f(s.n * 100, 0) + '%');
    const gx = x1 + 30;
    gauge(gx, s.flow, '#4cc2ff', 'flow', U.f(s.flow * 100, 0) + '%');
    gauge(gx + 38, s.sgInv, '#7ee0c3', 'SG', U.f(s.sgInv * 100, 0) + '%');
    gauge(gx + 76, s.P / 12, '#ff9e64', 'MPa', U.f(s.P, 1));
    if (w - gx > 140) gauge(gx + 114, s.ecc, '#b99cff', 'ECC', s.ecc > 0 ? 'on' : '–');
    if (s.loca) { ctx.fillStyle = '#ff5d6c'; ctx.textAlign = 'left'; ctx.fillText('⚠ break', x1 + 2, y0 + 8); }
  }
};
})();
