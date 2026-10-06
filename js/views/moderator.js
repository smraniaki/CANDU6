/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, pr = P.props, CORE = P.core;
const pipe = (d, cls) => `<path class="pipe ${cls}" d="${d}"/><path class="flow slow" d="${d}"/>`;
function svg() {
  return `<svg class="sch" viewBox="0 0 560 300" role="img" aria-label="Moderator system">
    <g class="hs" data-c="calandria"><circle class="eq" cx="170" cy="150" r="112"/><circle cx="170" cy="150" r="109" fill="#7dcfff1c"/><text class="lbl" x="118" y="154">Calandria · 216 Mg D₂O</text></g>
    <g class="hs" data-c="covergas"><path d="M92,68 Q170,10 248,68 Z" fill="#b99cff33" stroke="#b99cff"/><text x="140" y="56">He cover gas</text><rect class="eq" x="300" y="18" width="76" height="24" rx="5"/><text x="306" y="34">Recombiner</text><path d="M210,44 L300,30" stroke="#b99cff" stroke-width="2" fill="none"/></g>
    <g class="hs" data-c="oprd"><path d="M120,48 L112,10 M220,48 L228,10" stroke="#e0af68" stroke-width="5"/><text x="64" y="12">relief ducts + rupture discs</text></g>
    ${pipe('M170,262 L170,284 L330,284', 'modp')}${pipe('M362,284 L420,284', 'modp')}${pipe('M470,284 L500,284 L500,150 L282,150', 'modp')}
    <g class="hs" data-c="modsys"><circle class="eq" cx="346" cy="284" r="14"/><text x="341" y="288">P</text><rect class="eq" x="420" y="270" width="50" height="28" rx="4"/><text x="430" y="288">HX ×2</text><text class="lbl" x="310" y="262">2 × 100 % pumps</text><text class="val" x="386" y="142" data-v="tin"></text><text class="val" x="186" y="278" data-v="tout"></text>
      <path d="M282,150 l-10,-6 M282,150 l-10,6 M58,150 l10,-6 M58,150 l10,6" stroke="#7dcfff" stroke-width="2"/><text x="20" y="176">8 inlet nozzles</text></g>
    <g class="hs" data-c="modpurif"><rect class="eq" x="420" y="196" width="64" height="24" rx="5"/><text x="426" y="212">Ion exch.</text><rect class="eq" x="420" y="226" width="64" height="24" rx="5"/><text x="424" y="242">B / Gd add</text><path d="M500,208 L484,208 M500,238 L484,238" stroke="#7dcfff" stroke-width="2"/></g>
    <g class="hs" data-c="liss"><path d="M60,110 L280,110 M60,190 L280,190" stroke="#e0af68" stroke-width="2.5" stroke-dasharray="6 3"/><text x="286" y="114">SDS2 nozzles</text></g>
    <g class="hs" data-c="services"><text x="424" y="264">cooled by service water</text></g></svg>`;
}

C.views.moderator = {
  init(el) {
    this.el = el; this.st = { flow: 100, tin: 45, pg: 20, pur: 99.85, b: 0, gd: 0 };
    el.innerHTML = `
      <p class="lead">The moderator is 265 tonnes of cool, low-pressure heavy water. It slows the neutrons, absorbs about 5 % of the reactor's heat, holds the reactivity poisons – and, because it surrounds every channel, it is the heat sink of last resort. Its temperature therefore matters twice: for reactivity and for sub-cooling.</p>
      <div class="grid gside">
        <div class="stack">
          <div class="card"><h4>Cooling</h4><div id="mo-s1"></div></div>
          <div class="card"><h4>Chemistry and reactivity</h4><div id="mo-s2"></div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="kpis" id="mo-k"></div></div>
          <div class="grid g2">
            <div class="card"><h4>Illustrative temperature field in the calandria</h4><canvas id="mo-cv" style="aspect-ratio:1.25"></canvas><p class="small mut" style="margin:6px 0 0">Inlet jets sweep up the shell while buoyancy lifts the internally heated water; where they meet sets the hot spot. Lower flow lets buoyancy win and moves the hot spot upward.</p></div>
            <div class="stack">
              <div class="card"><h4>Where the moderator heat comes from</h4><div id="mo-heat"></div></div>
              <div class="card"><h4>Reactivity held in the moderator</h4><div id="mo-rho"></div><p class="small mut" style="margin:6px 0 0" id="mo-rn"></p></div>
            </div>
          </div>
          <div class="grid g2">
            <div class="card"><h4>Moderator system (click a component)</h4><div id="mo-svg"></div></div>
            <div class="card" id="mo-c1"></div>
          </div>
          <div class="card" id="mo-sink"></div>
        </div>
      </div>`;
    U.$('#mo-svg', el).innerHTML = svg();
    U.$$('g.hs', el).forEach(g => g.addEventListener('click', () => C.app.go('library', g.dataset.c)));
    const st = this.st, up = () => this.update(), s1 = U.$('#mo-s1', el), s2 = U.$('#mo-s2', el);
    this.sp = U.slider(s1, { label: 'Reactor power', min: 0, max: 110, step: 1, value: M.S.op.power * 100, unit: '% FP', on: v => { M.S.op.power = Math.max(0.2, v / 100); this.pw = v / 100; up(); this.lazy(); } });
    U.slider(s1, { label: 'Moderator circulation flow', min: 10, max: 120, step: 1, value: 100, unit: '%', on: v => { st.flow = v; up(); } });
    U.slider(s1, { label: 'Heat-exchanger outlet (calandria inlet) temperature', min: 30, max: 75, step: 1, value: 45, unit: '°C', on: v => { st.tin = v; up(); } });
    U.slider(s1, { label: 'Cover-gas pressure', min: 0, max: 60, step: 1, value: 20, unit: 'kPa(g)', on: v => { st.pg = v; up(); } });
    U.slider(s2, { label: 'Isotopic purity', min: 99.5, max: 99.95, step: 0.01, value: 99.85, unit: 'wt% D₂O', dec: 2, on: v => { st.pur = v; up(); } });
    U.slider(s2, { label: 'Boron', min: 0, max: 6, step: 0.05, value: 0, unit: 'ppm', dec: 2, on: v => { st.b = v; up(); } });
    U.slider(s2, { label: 'Gadolinium', min: 0, max: 20, step: 0.1, value: 0, unit: 'ppm', dec: 1, on: v => { st.gd = v; up(); } });
    this.c1 = U.chartBox(U.$('#mo-c1', el), 'Outlet temperature and sub-cooling against circulation flow');
    this.lazy = U.debounce(() => M.solveTH(), 200);
    new ResizeObserver(() => this.field()).observe(U.$('#mo-cv', el));
    this.pw = M.S.op.power;
  },
  show() { this.pw = M.S.op.power; this.sp.set(this.pw * 100); this.update(); },
  calc(flowPct) {
    const st = this.st, p = this.pw, W = 1020 * flowPct / 100;
    const q = { direct: 91.6 * p + (p < 0.02 ? 2.5 : 0), struct: 6 * p, loss: 3, pump: 1.2 * flowPct / 100 };
    q.tot = q.direct + q.struct + q.loss + q.pump;
    const dT = q.tot * 1e3 / (W * 4.2), tout = st.tin + dT;
    const peak = tout + 11 * Math.pow(Math.max(p, 0.03), 0.8) * Math.pow(100 / flowPct, 0.6);
    const pTop = 0.1013 + st.pg / 1e3 + 0.011, tsTop = pr.tsat(pTop), tsMid = pr.tsat(pTop + 0.04);
    return { q, W, dT, tout, peak, tsTop, tsMid, sub: tsTop - peak, tavg: st.tin + 0.6 * dT };
  },
  update() {
    const st = this.st, el = this.el, r = this.r = this.calc(st.flow), set = (k, t) => { const n = U.$(`[data-v="${k}"]`, el); if (n) n.textContent = t; };
    set('tin', `in ${U.f(st.tin, 0)} °C`); set('tout', `out ${U.f(r.tout, 1)} °C`);
    const boil = r.sub <= 0, tb = 265e3 * 4.2 * Math.max(0, r.tsTop - r.tavg) / (r.q.tot * 1e3) / 60;
    U.kpis(U.$('#mo-k', el), [['Moderator heat load', U.f(r.q.tot, 0), 'MW', 'acc'], ['Circulation flow', U.f(r.W, 0), 'kg/s'], ['Temperature rise', U.f(r.dT, 1), '°C'], ['Outlet temperature', U.f(r.tout, 1), '°C', r.tout > 80 ? 'warn' : ''],
      ['Peak local temperature', U.f(r.peak, 1), '°C', boil ? 'bad' : r.peak > 90 ? 'warn' : ''], ['Saturation (top of core)', U.f(r.tsTop, 1), '°C'], ['Minimum sub-cooling', U.f(r.sub, 1), '°C', r.sub < 20 ? 'bad' : r.sub < 28 ? 'warn' : 'ok', 'Margin that keeps a calandria tube wetted if a hot pressure tube contacts it'], ['Time to boiling if cooling is lost', U.f(tb, 0), 'min']]);
    U.bars(U.$('#mo-heat', el), [['Neutron slowing-down + gammas', r.q.direct, '#7dcfff', U.f(r.q.direct, 0) + ' MW'], ['Reflector, devices, shell', r.q.struct, '#b99cff', U.f(r.q.struct, 1) + ' MW'], ['Heat leak from 380 channels', r.q.loss, '#ff9e64', U.f(r.q.loss, 1) + ' MW'], ['Pump work', r.q.pump, '#93a1b5', U.f(r.q.pump, 1) + ' MW']], { max: 110, lw: 190 });
    const rp = (st.pur - 99.85) * 35, rb = -8 * st.b, rg = -28 * st.gd, rt = 0.08 * (r.tavg - 59.5), tot = rp + rb + rg + rt;
    U.bars(U.$('#mo-rho', el), [['Isotopic purity', rp, rp < 0 ? 'var(--bad)' : 'var(--ok)', (rp >= 0 ? '+' : '') + U.f(rp, 2) + ' mk'], ['Boron', rb, 'var(--bad)', U.f(rb, 1) + ' mk'], ['Gadolinium', rg, 'var(--bad)', U.f(rg, 1) + ' mk'], ['Temperature (equilibrium fuel)', rt, rt < 0 ? 'var(--bad)' : 'var(--ok)', (rt >= 0 ? '+' : '') + U.f(rt, 2) + ' mk']], { max: 30, lw: 190 });
    U.$('#mo-rn', el).innerHTML = `Net effect <b>${tot >= 0 ? '+' : ''}${U.f(tot, 1)} mk</b>. For scale: the zone controllers span ≈ 7 mk, equilibrium xenon is 28 mk (≈ 1 ppm Gd or 3.5 ppm B), and both shutdown systems together are worth several hundred mk. ${st.gd >= 15 ? '<b>Guaranteed shutdown state</b> reached (≥ 15 ppm Gd).' : ''} ${rp < -1 ? 'A downgrade this large would have to be paid for in fuel burnup – about 1 mk costs ≈ 3 % in fuelling rate.' : ''}`;
    const xs = [], to = [], sb = [];
    for (let f = 30; f <= 120; f += 5) { const c = this.calc(f); xs.push(f); to.push(c.tout); sb.push(c.sub); }
    this.c1.draw({ x: xs, xLabel: 'Circulation flow (%)', yLabel: '°C', series: [{ name: 'Outlet temperature', y: to, color: '#ff9e64' }, { name: 'Minimum sub-cooling', y: sb, color: '#7ee0c3' }], hlines: [{ y: 28, color: '#ffb454', label: 'typical sub-cooling requirement' }], vlines: [{ x: st.flow, color: '#ffffff66', label: 'now' }] });
    const decay = 2064 * 0.015, cap = r.W * 4.2 * Math.max(0, 85 - st.tin) / 1e3;
    U.$('#mo-sink', el).innerHTML = `<h4>The moderator as an emergency heat sink</h4>
      <p>If a loss-of-coolant accident is combined with failure of emergency core cooling, pressure tubes heat to ≈ 650–800 °C and balloon or sag into contact with their calandria tubes. Decay heat then flows radially into the moderator.</p>
      ${U.spec([['Decay heat ≈ 15 min after trip', U.f(decay, 0) + ' MW (≈ 1.5 % FP)'], ['Heat-removal capacity at this flow and inlet temperature (outlet ≤ 85 °C)', U.f(cap, 0) + ' MW'], ['Sub-cooling available now', U.f(r.sub, 1) + ' °C'], ['Verdict', cap > decay && r.sub >= 28 ? '<span style="color:var(--ok)">Calandria tubes stay wetted – channel integrity maintained</span>' : r.sub < 28 ? '<span style="color:var(--warm)">Sub-cooling below the typical requirement: calandria-tube dryout cannot be excluded at contact</span>' : '<span style="color:var(--bad)">Cooling capacity below decay heat – moderator would heat up and boil off</span>']])}
      <p class="small mut" style="margin:8px 0 0">Run the “LOCA with ECC unavailable” scenario in the simulator to see fuel temperature level off when contact occurs.</p>`;
    this.field();
  },
  field() {
    const r = this.r; if (!r) return;
    const g = U.fit(U.$('#mo-cv', this.el)); if (!g) return;
    const { ctx, w, h } = g, R = Math.min(w - 90, h - 16) / 2, cx = 16 + R, cy = h / 2, cm = U.cmap('heat'), st = this.st;
    const lo = st.tin - 2, hi = Math.max(r.peak + 2, lo + 10), yc = -0.25 - 0.3 * Math.min(1.5, 100 / st.flow - 1);
    const N = 56, cs = 2 * R / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1; if (x * x + y * y > 1) continue;
      const gg = Math.exp(-(x * x / 0.42 + (y - yc) * (y - yc) / 0.3));
      const base = 0.25 + 0.45 * (0.5 - y / 2) + 0.2 * (1 - Math.abs(x));
      const T = st.tin + r.dT * base + (r.peak - st.tin - r.dT * 0.9) * gg;
      ctx.fillStyle = cm((T - lo) / (hi - lo)); ctx.fillRect(cx - R + i * cs, cy - R + j * cs, cs + 0.7, cs + 0.7);
    }
    ctx.strokeStyle = '#aab4c3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.fillStyle = '#0b0f1466';
    const sc = R / 13.3;
    CORE.ch.forEach(c => { ctx.beginPath(); ctx.arc(cx + (c.col - 10.5) * sc, cy + (c.row - 10.5) * sc, sc * 0.22, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    [[-1, 1], [1, 1]].forEach(s => { const x = cx + s[0] * R * 0.95, y = cy + 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s[0] * 4, y - R * 0.3, x - s[0] * R * 0.16, y - R * 0.48); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s[0] * R * 0.16, y - R * 0.48); ctx.lineTo(x - s[0] * R * 0.16 + s[0] * 9, y - R * 0.48 + 3); ctx.moveTo(x - s[0] * R * 0.16, y - R * 0.48); ctx.lineTo(x - s[0] * R * 0.16 + s[0] * 1, y - R * 0.48 + 11); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(cx, cy + R - 14); ctx.lineTo(cx, cy + R + 6); ctx.stroke();
    const bx = cx + R + 18, bh = Math.min(2 * R - 30, 200), by = cy - bh / 2;
    for (let i = 0; i < bh; i++) { ctx.fillStyle = cm(1 - i / bh); ctx.fillRect(bx, by + i, 12, 1.5); }
    ctx.fillStyle = '#93a1b5'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(U.f(hi, 0) + ' °C', bx + 16, by + 4); ctx.fillText(U.f(lo, 0) + ' °C', bx + 16, by + bh - 4);
    ctx.fillText('boils at', bx - 2, by + bh + 16); ctx.fillText(U.f(r.tsTop, 0) + ' °C', bx - 2, by + bh + 30);
  }
};
})();
