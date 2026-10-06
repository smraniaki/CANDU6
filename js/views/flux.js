/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, CORE = P.core, K = P.K, D = C.data;
const COL = { lzc: '#7dcfff', adj: '#9ece6a', mca: '#ffb454', sor: '#e0af68', tgt: '#f472b6' };

C.views.flux = {
  init(el) {
    this.el = el; this.mode = 'manual'; this.view = 'power'; this.plane = 6; this.showDev = true; this.showDet = false; this.tg = { mat: 'co59', z: 6, len: 4, mass: 1 };
    el.innerHTML = `
      <p class="lead">A three-dimensional neutron-diffusion model of the core (380 channels × 12 bundles plus reflector) is solved every time you move a device. Watch how local absorbers reshape channel powers, how the liquid zones restore the balance, and how the readings of the overpower detectors follow the flux rather than the reactor power.</p>
      <div class="grid gside">
        <div class="stack">
          <div class="card"><h4>Regulating system response</h4><div id="fx-mode"></div><p class="small mut" style="margin:8px 0 0">Manual: nothing compensates, reactivity shows what the device is worth. Bulk: all zones move together to keep the reactor critical. Spatial: each zone also trims its own power.</p></div>
          <div class="card"><h4>Liquid zone controllers <span class="mut small" id="fx-zavg"></span></h4><div id="fx-zall"></div>
            <div class="small mut">Front half (zones 1–7)</div><div class="zgrid" id="fx-z0"></div><div class="small mut" style="margin-top:6px">Back half (zones 8–14)</div><div class="zgrid" id="fx-z1"></div>
            <div class="row" style="margin-top:8px"><button class="btn sm" data-tilt="ss">Side tilt</button><button class="btn sm" data-tilt="tb">Top/bottom tilt</button><button class="btn sm" data-tilt="fb">Axial tilt</button><button class="btn sm" data-tilt="0">Level all</button></div></div>
          <div class="card"><h4>Rods and poison</h4>
            <div class="small mut" style="margin-bottom:4px">Adjuster banks withdrawn</div><div id="fx-adj"></div>
            <div id="fx-rods" style="margin-top:10px"></div></div>
          <div class="card"><h4>Isotope-production target</h4>
            <select id="fx-mat" style="width:100%;margin-bottom:8px" aria-label="Target material">${D.targets.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
            <div id="fx-tg"></div><p class="small mut" id="fx-tn"></p>
            <div class="row"><button class="btn pri sm" id="fx-tin">Insert at selected channel</button><button class="btn sm" id="fx-tout">Withdraw all</button></div></div>
          <div class="card"><h4>On-power refuelling</h4><div id="fx-rip"></div>
            <div class="row" style="margin-top:8px"><button class="btn sm" id="fx-ref">Refuel selected channel</button><button class="btn sm" id="fx-adv">Run 10 full-power days</button></div><p class="small mut" id="fx-rn" style="margin:6px 0 0"></p></div>
          <div class="card"><button class="btn" id="fx-reset">Reset all devices to nominal</button></div>
        </div>
        <div class="stack">
          <div class="card"><div class="row"><div class="kpis sp" id="fx-k" style="flex:1"></div></div></div>
          <div class="grid g64">
            <div class="card"><div class="row" style="margin-bottom:8px"><div id="fx-view"></div><span class="sp"></span><span id="fx-busy" class="small mut"></span></div>
              <div id="fx-pl" style="display:none"></div>
              <canvas class="coremap" id="fx-map"></canvas>
              <div class="row" style="margin-top:6px" id="fx-opts"></div></div>
            <div class="stack">
              <div class="card"><h4>View from above: devices between the channels</h4><canvas id="fx-plan" style="aspect-ratio:1.5;cursor:pointer"></canvas>
                <div class="legend" style="margin-top:6px"><span><i style="background:${COL.lzc};border-radius:2px"></i>zone compartments</span><span><i style="background:${COL.adj}"></i>adjusters (click)</span><span><i style="background:${COL.mca}"></i>control absorbers (click)</span><span><i style="background:${COL.sor}"></i>shutoff rods (click)</span><span><i style="background:${COL.tgt}"></i>target</span></div>
                <p class="small mut" style="margin:6px 0 0">Colour: power summed over each vertical column of the core. Horizontal axis = across the face, vertical axis = along the channels.</p></div>
              <div class="card"><h4>Zone powers and levels</h4><div id="fx-zp"></div></div>
              <div class="card"><h4>Overpower detectors (SDS1 logic channels)</h4><div id="fx-det"></div><p class="small mut" id="fx-dn" style="margin:6px 0 0"></p></div>
            </div>
          </div>
          <div class="grid g3">
            <div class="note"><h4>Adjusters shape, zones control</h4>Withdraw the adjuster banks one by one in Manual mode: each adds reactivity, and the flux peaks in the centre. Then switch to Bulk control and see the zones fill to absorb it.</div>
            <div class="note"><h4>A target is a new flux shape</h4>Insert a strong target near the edge of the plateau. Local channels lose power, the rest of the core gains it, and detectors near the target under-read. That is why every in-core device needs its own ROP analysis.</div>
            <div class="note warn"><h4>Model notes</h4>One-group diffusion with smeared device absorption, calibrated to total device worths (zones 7 mk, adjusters 15 mk, absorbers 10 mk, shutoff rods 80 mk). Xenon redistribution and detailed device positions are not modelled.</div>
          </div>
        </div>
      </div>`;
    const S = M.S, go = () => this.queue();
    U.seg(U.$('#fx-mode', el), [['manual', 'Manual'], ['bulk', 'Bulk control'], ['spatial', 'Bulk + spatial']], this.mode, v => { this.mode = v; go(); });
    this.zall = U.slider(U.$('#fx-zall', el), { label: 'Set all zones to', min: 0, max: 100, step: 1, value: 50, unit: '%', on: v => { S.pos.lzc.fill(v / 100); this.syncZ(); go(); } });
    this.zin = [];
    for (let z = 0; z < 14; z++) { const l = U.el(`<label>${z + 1}<input type="range" min="0" max="100" value="50" aria-label="Zone ${z + 1} level"></label>`); const inp = l.querySelector('input'); inp.addEventListener('input', () => { S.pos.lzc[z] = inp.value / 100; go(); }); U.$(z < 7 ? '#fx-z0' : '#fx-z1', el).appendChild(l); this.zin.push(inp); }
    U.$$('[data-tilt]', el).forEach(b => b.addEventListener('click', () => { const t = b.dataset.tilt; for (let z = 0; z < 14; z++) { const f = z % 7, h = z >= 7; S.pos.lzc[z] = t === 'ss' ? (f < 2 ? 0.2 : f > 4 ? 0.8 : 0.5) : t === 'tb' ? ((f === 0 || f === 2 || f === 5) ? 0.2 : (f === 1 || f === 4 || f === 6) ? 0.8 : 0.5) : t === 'fb' ? (h ? 0.8 : 0.2) : 0.5; } this.syncZ(); go(); }));
    this.adj = U.seg(U.$('#fx-adj', el), [0, 1, 2, 3, 4, 5, 6, 7].map(n => [n, String(n)]), 0, v => { CORE.devices.forEach(d => { if (d.type === 'adj') S.pos.adj[d.n] = d.bank < v ? 0 : 1; }); go(); });
    const rods = U.$('#fx-rods', el); this.sl = {};
    this.sl.mca = U.slider(rods, { label: 'Mechanical control absorbers inserted', min: 0, max: 100, step: 5, value: 0, unit: '%', on: v => { S.pos.mca.fill(v / 100); go(); } });
    this.sl.sor = U.slider(rods, { label: 'Shutoff rods inserted (SDS1)', min: 0, max: 100, step: 5, value: 0, unit: '%', on: v => { S.pos.sor.fill(v / 100); go(); } });
    this.sl.liss = U.slider(rods, { label: 'Gadolinium injected (SDS2)', min: 0, max: 100, step: 5, value: 0, unit: '%', on: v => { S.pos.liss = v / 100; go(); } });
    this.sl.boron = U.slider(rods, { label: 'Moderator boron', min: 0, max: 3, step: 0.05, value: 0, unit: 'ppm', dec: 2, on: v => { S.pos.boron = v; go(); } });
    const tg = U.$('#fx-tg', el);
    U.slider(tg, { label: 'Axial position along the channel', min: 1, max: 11, step: 0.5, value: 6, unit: 'bundles', dec: 1, on: v => { this.tg.z = v; } });
    U.slider(tg, { label: 'Target length (vertical)', min: 1, max: 10, step: 1, value: 4, unit: 'lattice pitches', on: v => { this.tg.len = v; } });
    U.slider(tg, { label: 'Loading', min: 0.25, max: 4, step: 0.25, value: 1, unit: '× reference', dec: 2, on: v => { this.tg.mass = v; this.tnote(); } });
    U.$('#fx-mat', el).addEventListener('change', e => { this.tg.mat = e.target.value; this.tnote(); });
    U.$('#fx-tin', el).addEventListener('click', () => { const c = CORE.ch[S.sel], t = D.targets.find(x => x.id === this.tg.mat); S.pos.targets.push({ x: c.col + 0.5, y: c.row + 0.5, z: this.tg.z, len: this.tg.len, s: this.cal() * t.mk * this.tg.mass, name: t.name, ch: S.sel }); go(); });
    U.$('#fx-tout', el).addEventListener('click', () => { S.pos.targets = []; go(); });
    U.check(U.$('#fx-rip', el), 'Instantaneous snapshot (include refuelling ripple)', S.ripple, v => { S.ripple = v; go(); });
    U.$('#fx-ref', el).addEventListener('click', () => { CORE.refuel(S.sel); S.ripple = true; U.$('#fx-rip input', el).checked = true; U.$('#fx-rn', el).textContent = `Channel ${CORE.ch[S.sel].id} refuelled with 8 fresh bundles.`; go(); });
    U.$('#fx-adv', el).addEventListener('click', () => { const done = CORE.advanceDays(10, S.flux); S.ripple = true; U.$('#fx-rip input', el).checked = true; U.$('#fx-rn', el).textContent = `10 days: ${done.length} channels reached their dwell time and were refuelled (${done.slice(0, 8).map(c => CORE.ch[c].id).join(', ')}${done.length > 8 ? ' …' : ''}).`; go(); });
    U.$('#fx-reset', el).addEventListener('click', () => { S.pos = CORE.refPos(); S.ripple = false; U.$('#fx-rip input', el).checked = false; this.syncAll(); go(); });
    U.seg(U.$('#fx-view', el), [['power', 'Channel power'], ['delta', 'Change vs nominal'], ['plane', 'One axial plane']], this.view, v => { this.view = v; U.$('#fx-pl', el).style.display = v === 'plane' ? 'block' : 'none'; this.draw(); });
    U.slider(U.$('#fx-pl', el), { label: 'Bundle plane (1 = front face)', min: 1, max: 12, step: 1, value: 6, on: v => { this.plane = v; this.draw(); } });
    U.check(U.$('#fx-opts', el), 'Show devices', true, v => { this.showDev = v; this.draw(); });
    U.check(U.$('#fx-opts', el), 'Show ROP detectors', false, v => { this.showDet = v; this.draw(); });
    this.map = new U.CoreMap(U.$('#fx-map', el), { onClick: ch => { S.sel = ch; } });
    const plan = U.$('#fx-plan', el);
    new ResizeObserver(() => this.planDraw()).observe(plan);
    plan.addEventListener('click', e => { const d = this.planPick(e); if (!d) return; const k = d.type; if (k === 'adj' || k === 'mca' || k === 'sor') { S.pos[k][d.n] = S.pos[k][d.n] > 0.5 ? 0 : 1; go(); } });
    plan.addEventListener('mousemove', e => { const d = this.planPick(e); if (!d) return U.tip.hide(); const nm = { lzc: 'Zone compartment ' + ((d.zone || 0) + 1), adj: 'Adjuster ' + (d.n + 1) + ' (bank ' + (d.bank + 1) + ')', mca: 'Control absorber ' + (d.n + 1), sor: 'Shutoff rod ' + (d.n + 1) }[d.type]; const v = d.type === 'lzc' ? S.pos.lzc[d.zone] : S.pos[d.type][d.n]; U.tip.show(`<b>${nm}</b><br>${d.type === 'lzc' ? 'level' : 'inserted'} ${U.f(v * 100, 0)} %`, e.clientX, e.clientY); });
    plan.addEventListener('mouseleave', () => U.tip.hide());
    this.tnote();
    C.app.live('flux', 'th', () => this.draw());
  },
  show() { this.syncAll(); this.draw(); },
  cal() {
    if (this._cal) return this._cal;
    const p = CORE.refPos(); p.targets.push({ x: 11.5, y: 11.5, z: 6, len: 4, s: 1e-3 });
    const r = CORE.solve(p, { noStore: true });
    return (this._cal = 1e-3 / Math.max(0.01, -r.rho));       // absorber strength per mk at the core centre
  },
  tnote() { const t = D.targets.find(x => x.id === this.tg.mat); U.$('#fx-tn', this.el).innerHTML = `${t.note} Capture cross-section ≈ ${t.sigma} b. Reference loading worth ≈ <b>${U.f(t.mk * this.tg.mass, 2)} mk</b> at the core centre (less toward the edge).`; },
  syncZ() { const p = M.S.pos; this.zin.forEach((inp, z) => { inp.value = Math.round(p.lzc[z] * 100); }); U.$('#fx-zavg', this.el).textContent = '· average ' + U.f(p.lzc.reduce((a, b) => a + b, 0) / 14 * 100, 0) + ' %'; },
  syncAll() { const p = M.S.pos; this.syncZ(); this.sl.mca.set(p.mca[0] * 100); this.sl.sor.set(p.sor[0] * 100); this.sl.liss.set(p.liss * 100); this.sl.boron.set(p.boron); let out = 0; for (let b = 0; b < 7; b++) if (CORE.devices.filter(d => d.type === 'adj' && d.bank === b).every(d => p.adj[d.n] < 0.5)) out = b + 1; else break; this.adj.set(out); },
  queue() {
    U.$('#fx-busy', this.el).innerHTML = '<span class="spin"></span> solving…';
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      const S = M.S, opt = { ripple: S.ripple };
      if (this.mode === 'manual') M.solveFlux();
      else { const r = this.mode === 'bulk' ? CORE.rrsBulk(S.pos, opt) : CORE.rrsSpatial(S.pos, opt, 6); M.setFlux(r.pos, r.flux); this.sat = r.sat; }
      this.syncZ(); U.$('#fx-busy', this.el).textContent = S.flux.iters + ' iterations'; this.draw();
    }, 90);
  },
  draw() {
    const S = M.S, f = S.flux, nom = CORE.nominal, el = this.el, pw = S.op.power;
    let d;
    if (this.view === 'delta') d = { values: Array.from(f.chRel, (v, i) => (v / nom.chRel[i] - 1) * 100), unit: '% change', cmap: 'div', sym: true, symMin: 2, fmt: v => (v > 0 ? '+' : '') + U.f(v, 1) };
    else if (this.view === 'plane') d = { values: CORE.ch.map((c, i) => f.bunRel[i * 12 + this.plane - 1] * K.bunAvgKW * pw), unit: 'kW / bundle', cmap: 'heat', min: 0, max: 950, fmt: v => U.f(v, 0) };
    else d = { values: Array.from(f.chRel, v => v * K.chAvgMW * pw), unit: 'MW', cmap: 'heat', min: 2, max: 8 };
    d.info = ch => `${U.f(f.chRel[ch] * K.chAvgMW * pw, 2)} MW (${f.chRel[ch] >= nom.chRel[ch] ? '+' : ''}${U.f((f.chRel[ch] / nom.chRel[ch] - 1) * 100, 1)} % vs nominal)`;
    d.zones = true; d.devs = []; d.dets = [];
    if (this.showDev) CORE.devices.forEach(v => { const L = v.y2 - v.y1; if (v.type === 'lzc') d.devs.push({ x: v.x, y1: v.y1, y2: v.y2, color: COL.lzc, w: 4, alpha: 0.25 + 0.6 * S.pos.lzc[v.zone] }); else { const ins = S.pos[v.type][v.n]; if (ins > 0.02) d.devs.push({ x: v.x + (v.type === 'adj' ? (v.z - 6) * 0.08 : 0), y1: v.y1, y2: v.y1 + ins * L, color: COL[v.type], w: v.type === 'adj' ? 1.6 : 2.4, alpha: 0.85 }); } });
    S.pos.targets.forEach(t => d.devs.push({ x: t.x, y1: t.y - t.len / 2, y2: t.y + t.len / 2, color: COL.tgt, w: 4 }));
    if (this.showDet) CORE.det1.forEach((t, i) => d.dets.push({ x: t.x, y: t.y, color: { D: '#ffffff', E: '#ffd166', F: '#ff6b5e' }[t.logic] }));
    this.map.sel = S.sel; this.map.draw(d);
    let cppf = 0, mi = 0; for (let i = 0; i < 380; i++) if (nom.chRel[i] * K.chAvgMW > 5) { const r = f.chRel[i] / nom.chRel[i]; if (r > cppf) { cppf = r; mi = i; } }
    const z = f.zoneFrac, zr = nom.zoneFrac, sum = idx => idx.reduce((a, k) => a + z[k], 0) / idx.reduce((a, k) => a + zr[k], 0);
    const tl = (a, b) => (sum(a) - sum(b)) / 2 * 100;
    U.kpis(U.$('#fx-k', el), [['k-effective', f.k.toFixed(5), ''], ['Reactivity vs critical', (f.rho >= 0 ? '+' : '') + U.f(f.rho, 2), 'mk', Math.abs(f.rho) > 0.3 ? 'warn' : 'ok', 'With the regulating system in Manual this is the net worth of what you changed'], ['Max channel power', U.f(f.maxCh * pw, 2), 'MW', f.maxCh * pw > 7.3 ? 'bad' : ''], ['Max bundle power', U.f(f.maxBun * pw, 0), 'kW', f.maxBun * pw > 935 ? 'bad' : ''],
      ['Channel power peaking factor', U.f(cppf, 3), CORE.ch[mi].id, cppf > 1.1 ? 'warn' : ''], ['Side-to-side tilt', U.f(tl([0, 1, 7, 8], [5, 6, 12, 13]), 1), '%'], ['Top-to-bottom tilt', U.f(tl([0, 2, 5, 7, 9, 12], [1, 4, 6, 8, 11, 13]), 1), '%'], ['End-to-end tilt', U.f(tl([0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13]), 1), '%'], ['Min critical power ratio', U.f(S.minCPR, 2), CORE.ch[S.minCPRch].id, S.minCPR < 1.15 ? 'warn' : 'ok']]);
    U.$('#fx-zp', el).innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${Array.from({ length: 14 }, (v, k) => { const dv = (z[k] / zr[k] - 1) * 100, lv = S.pos.lzc[k]; return `<div style="background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:4px;text-align:center;font-size:11px"><div class="mut">Z${k + 1}</div><div style="height:34px;background:#0b0f14;border-radius:3px;position:relative;overflow:hidden;margin:3px 0"><div style="position:absolute;left:0;right:0;bottom:0;height:${lv * 100}%;background:${COL.lzc}99"></div></div><div class="mono" style="color:${Math.abs(dv) > 3 ? 'var(--warm)' : 'var(--txt)'}">${dv >= 0 ? '+' : ''}${U.f(dv, 1)}%</div></div>`; }).join('')}</div><p class="small mut" style="margin:6px 0 0">Bar = water level, number = zone power relative to its reference share. ${this.sat && this.mode !== 'manual' ? '<b style="color:var(--warm)">Zones saturated – they cannot fully compensate.</b>' : ''}</p>`;
    const mx = { D: 0, E: 0, F: 0 }; CORE.det1.forEach((t, i) => { const r = f.det1[i] / nom.det1[i]; if (r > mx[t.logic]) mx[t.logic] = r; });
    const tsp = S.tsp * 100, rows = ['D', 'E', 'F'].map(k => { const v = mx[k] * pw * 108; return [`Channel ${k} (highest detector)`, v, v >= tsp ? 'var(--bad)' : 'var(--acc)', U.f(v, 1) + ' %']; });
    U.bars(U.$('#fx-det', el), rows, { max: 140, lw: 170 });
    const nt = rows.filter(r => r[1] >= tsp).length;
    U.$('#fx-dn', el).innerHTML = `Detectors are calibrated to read power × 1.08 (the channel power peaking factor). Trip set-point ${U.f(tsp, 0)} % · <b style="color:${nt >= 2 ? 'var(--bad)' : 'var(--ok)'}">${nt >= 2 ? 'SDS1 would trip (2 of 3 channels)' : nt + ' of 3 channels above set-point – no trip'}</b>. Margin to trip of the middle channel: ${U.f(tsp - rows.map(r => r[1]).sort((a, b) => b - a)[1], 1)} %.`;
    this.planDraw();
  },
  planGeom() { const c = U.$('#fx-plan', this.el), w = c.clientWidth, h = c.clientHeight, x0 = 22, y0 = 6; return { x0, y0, cw: (w - x0 - 6) / 22, chh: (h - y0 - 18) / 12, w, h }; },
  planPick(e) { const c = U.$('#fx-plan', this.el), r = c.getBoundingClientRect(), g = this.planGeom(), px = e.clientX - r.left, py = e.clientY - r.top; let best = null, bd = 13; CORE.devices.forEach(d => { const dx = g.x0 + d.x * g.cw - px, dy = g.y0 + d.z * g.chh - py, dist = Math.hypot(dx, dy) + (d.type === 'lzc' ? 4 : 0); if (dist < bd) { bd = dist; best = d; } }); return best; },
  planDraw() {
    const f = M.S.flux, S = M.S; const g0 = U.fit(U.$('#fx-plan', this.el)); if (!g0) return;
    const { ctx } = g0, g = this.planGeom(), cm = U.cmap('heat');
    const col = new Float64Array(22 * 12); let mx = 0;
    CORE.ch.forEach((c, i) => { for (let b = 0; b < 12; b++) { col[b * 22 + c.col] += f.bunRel[i * 12 + b]; } });
    for (const v of col) mx = Math.max(mx, v);
    for (let b = 0; b < 12; b++) for (let k = 0; k < 22; k++) { ctx.fillStyle = cm(col[b * 22 + k] / mx * 0.95); ctx.fillRect(g.x0 + k * g.cw, g.y0 + b * g.chh, g.cw + 0.6, g.chh + 0.6); }
    ctx.font = '10px "Segoe UI", sans-serif'; ctx.fillStyle = '#6b7a90'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let b = 0; b < 12; b++) ctx.fillText(b + 1, 10, g.y0 + (b + 0.5) * g.chh);
    for (let k = 0; k < 22; k += 3) ctx.fillText(k + 1, g.x0 + (k + 0.5) * g.cw, g.h - 8);
    ctx.strokeStyle = '#e0af68aa'; ctx.setLineDash([5, 4]); CORE.lissNozzles.forEach(n => { ctx.beginPath(); ctx.moveTo(g.x0, g.y0 + n.z * g.chh); ctx.lineTo(g.x0 + 22 * g.cw, g.y0 + n.z * g.chh); ctx.stroke(); }); ctx.setLineDash([]);
    const seen = {};
    CORE.devices.forEach(d => {
      const x = g.x0 + d.x * g.cw, y = g.y0 + d.z * g.chh; ctx.lineWidth = 1.6; ctx.strokeStyle = '#0b0f14';
      if (d.type === 'lzc') { const key = d.x + '_' + d.z, n = seen[key] = (seen[key] || 0) + 1, tot = d.x === 11 ? 3 : 2, s = 9, yy = y + (n - (tot + 1) / 2) * (s + 2); ctx.fillStyle = '#0b0f14'; ctx.fillRect(x - s / 2, yy - s / 2, s, s); ctx.fillStyle = COL.lzc; const lv = S.pos.lzc[d.zone]; ctx.fillRect(x - s / 2, yy + s / 2 - s * lv, s, s * lv); ctx.strokeStyle = COL.lzc; ctx.strokeRect(x - s / 2, yy - s / 2, s, s); return; }
      const ins = S.pos[d.type][d.n], r = d.type === 'adj' ? 5 : 4.5;
      ctx.beginPath();
      if (d.type === 'adj') ctx.arc(x, y, r, 0, 7); else if (d.type === 'mca') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); } else { ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 5.5, y); ctx.lineTo(x, y + 5.5); ctx.lineTo(x - 5.5, y); ctx.closePath(); }
      ctx.fillStyle = ins > 0.5 ? COL[d.type] : '#0b0f14cc'; ctx.fill(); ctx.strokeStyle = COL[d.type]; ctx.stroke();
    });
    S.pos.targets.forEach(t => { const x = g.x0 + t.x * g.cw, y = g.y0 + t.z * g.chh; ctx.fillStyle = COL.tgt; ctx.strokeStyle = '#fff'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 4 : 9; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); ctx.fill(); ctx.stroke(); });
  }
};
})();
