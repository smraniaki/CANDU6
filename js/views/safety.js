/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, P = C.phys, D = C.data;
const comp = id => D.components.find(c => c.id === id);
const pipe = (d, cls, on) => `<path class="pipe ${cls}" d="${d}" style="${on ? '' : 'opacity:.25'}"/>${on ? `<path class="flow" d="${d}"/>` : ''}`;

function runTrip(which, missing) {
  const s = new P.Sim(); s.par.sorMissing = missing; s.par.stepback = false;
  const t = [], n = [], rho = [], pth = [];
  for (let i = 0; i < 4500; i++) { if (i === 500) s.act(which); s.step(0.002); if (i % 10 === 0) { t.push(s.t - 1); n.push(s.n * 100); pth.push(s.pth * 100); rho.push(Math.max(-120, s.rho)); } }
  return { t, n, rho, pth };
}
function logicWidget(host, names) {
  const st = [0, 0, 0], lab = ['normal', 'TRIPPED', 'in test (tripped)', 'failed – cannot trip'];
  const el = U.el(`<div><div class="row" style="gap:10px"></div><div class="note" style="margin-top:10px"></div></div>`), row = el.firstElementChild, out = el.lastElementChild;
  const draw = () => {
    row.innerHTML = ''; names.forEach((nm, i) => { const b = U.el(`<button class="btn ${st[i] === 1 || st[i] === 2 ? 'danger' : st[i] === 3 ? 'warn' : ''}" style="min-width:150px;text-align:left">Channel ${nm}<br><span class="small">${lab[st[i]]}</span></button>`); b.addEventListener('click', () => { st[i] = (st[i] + 1) % 4; draw(); }); row.appendChild(b); });
    const votes = st.filter(v => v === 1 || v === 2).length, healthy = st.filter(v => v === 0).length, trip = votes >= 2;
    out.className = 'note ' + (trip ? 'bad' : healthy + votes < 2 ? 'warn' : 'ok');
    out.innerHTML = trip ? '<h4>System trips</h4>Two of three channels have voted: the shutdown system actuates.' : `<h4>No trip</h4>${votes} channel voting. ${votes === 1 ? 'Any one further channel trip actuates the system (now effectively 1-out-of-2).' : 'Two channels must see the trip condition.'} ${healthy + votes < 2 ? '<b>Not enough healthy channels left – the system would be declared unavailable.</b>' : ''}`;
  };
  draw(); host.appendChild(el);
}

const TABS = {
  over: ['Principles', function (el) {
    el.innerHTML = `<div class="grid g3">
      <div class="note"><h4>Control</h4>Hold the chain reaction where it is wanted, and stop it when needed. Normal control by the regulating system; shutdown by two independent special safety systems, each fully capable by itself.</div>
      <div class="note"><h4>Cool</h4>Remove fission and decay heat: steam generators (forced flow, then thermosyphoning), shutdown cooling, emergency core cooling, and finally the moderator and vault water.</div>
      <div class="note"><h4>Contain</h4>Five barriers: UO₂ matrix, fuel sheath, heat-transport pressure boundary, containment, and the exclusion zone.</div></div>
      <h3 style="margin-top:16px">The four special safety systems</h3>
      <div class="grid g4">${[['sor', 'SDS1 – shutoff rods'], ['liss', 'SDS2 – poison injection'], ['ecc', 'Emergency core cooling'], ['containment', 'Containment']].map(s => `<div class="card"><h3>${s[1]}</h3><p class="small">${comp(s[0]).sum}</p></div>`).join('')}</div>
      <h3 style="margin-top:16px">Design rules that apply to all four</h3>
      <div class="grid g2"><div class="card">${U.spec([['Independence', 'Separate from the process systems and from each other: own sensors, logic, power and actuators'], ['Diversity', 'SDS1 solid rods, vertical, gravity; SDS2 liquid poison, horizontal, gas pressure; different instrument types and suppliers'], ['Redundancy', 'Triplicated instrument channels with two-out-of-three voting; a channel can be tested at power'], ['Fail-safe', 'Loss of power or signal produces a channel trip'], ['Unavailability', 'Demonstrated by testing to be below 10⁻³ years per year for each system'], ['Separation', 'Group 1 (normal control, main control room) and Group 2 (seismically qualified, secondary control area) systems are physically separated']])}</div>
      <div class="card"><h4>Single and dual failures</h4><p>Canadian practice analyses every process-system failure (a <b>single failure</b>) and also the same failure combined with the complete unavailability of one special safety system (a <b>dual failure</b>) – for example a large LOCA with no emergency core cooling, or with impaired containment. For shutdown, each of the two systems is assumed to be the only one that works.</p>
      <p class="mut small">That is why the simulator lets you switch SDS1, SDS2 or ECC off before starting an accident.</p></div></div>`;
  }],
  sds1: ['SDS1', function (el) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Shutdown System 1 – 28 shutoff rods</h3><p>${comp('sor').sum}</p>${U.spec(comp('sor').specs)}</div>
      <div class="stack"><div class="card"><div class="row"><h4 style="margin:0">What a trip does</h4><span class="sp"></span><span id="s1-opt"></span></div><div id="s1-c"></div><p class="small mut">Trip at t = 0 from full power. Neutron power collapses to the delayed-neutron level within the 2 s rod drop, then decays with the precursors; thermal power lags because of stored heat and decay heat.</p></div>
      <div class="card"><h4>Two-out-of-three logic: click the channels</h4><div id="s1-l"></div></div></div></div>`;
    const ch = U.chartBox(U.$('#s1-c', el), ''), draw = miss => { const r = runTrip('sds1', miss); ch.draw({ x: r.t, xLabel: 'Time after trip (s)', yLabel: '% FP', y2Label: 'mk', xMin: -1, xMax: 8, yMin: 0, series: [{ name: 'Neutron power', y: r.n, color: '#4cc2ff' }, { name: 'Thermal power', y: r.pth, color: '#ff6b5e' }, { name: 'Reactivity', y: r.rho, axis: 'r', color: '#ffb454', dash: [4, 3] }] }); };
    U.check(U.$('#s1-opt', el), 'two best rods unavailable', true, v => draw(v ? 2 : 0)); draw(2);
    logicWidget(U.$('#s1-l', el), ['D', 'E', 'F']);
  }],
  sds2: ['SDS2', function (el) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Shutdown System 2 – liquid poison injection</h3><p>${comp('liss').sum}</p>${U.spec(comp('liss').specs)}</div>
      <div class="stack"><div class="card"><h4>SDS1 against SDS2: speed and depth</h4><div id="s2-c"></div><p class="small mut">SDS2 starts a fraction of a second later (valve opening and jet transit) but goes several times deeper. The price is a moderator full of gadolinium that takes ≈ 1–2 days of ion exchange to remove.</p></div>
      <div class="card"><h4>Two-out-of-three logic: channels G, H, J</h4><div id="s2-l"></div></div></div></div>`;
    const a = runTrip('sds1', 2), b = runTrip('sds2', 0);
    U.chartBox(U.$('#s2-c', el), '').draw({ x: a.t, xLabel: 'Time after trip (s)', yLabel: '% FP (log)', y2Label: 'mk', logY: true, xMin: -1, xMax: 8, yMin: 0.1, yMax: 200, y2Min: -125, y2Max: 5, series: [{ name: 'Power, SDS1', y: a.n, color: '#4cc2ff' }, { name: 'Power, SDS2', y: b.n, color: '#b99cff' }, { name: 'Reactivity, SDS1', y: a.rho, axis: 'r', color: '#4cc2ff', dash: [4, 3] }, { name: 'Reactivity, SDS2 (clipped)', y: b.rho, axis: 'r', color: '#b99cff', dash: [4, 3] }] });
    logicWidget(U.$('#s2-l', el), ['G', 'H', 'J']);
  }],
  ecc: ['Emergency core cooling', function (el) {
    const stages = [['Blow-down', 'The break discharges coolant; the reactor has tripped. Fuel in stagnated channels heats up on stored energy. Loop isolation valves close so the intact loop is preserved.', 0],
      ['High-pressure injection', 'When pressure falls below ≈ 4.1 MPa the gas tank drives water from the two accumulator tanks into all eight headers. Main steam safety valves are opened to crash-cool the steam generators.', 1],
      ['Medium-pressure injection', 'Before the accumulators empty, the ECC pumps take suction from the reserved inventory of the dousing tank.', 2],
      ['Low-pressure recirculation', 'Water that has collected in the reactor-building sump is pumped through the ECC heat exchangers and back to the headers – indefinitely.', 3]];
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Emergency core cooling</h3><p>${comp('ecc').sum}</p>${U.spec(comp('ecc').specs)}</div>
      <div class="card"><div id="ec-seg"></div><div id="ec-svg" style="margin-top:10px"></div><div class="note" id="ec-n" style="margin-top:10px"></div></div></div>`;
    const draw = k => {
      U.$('#ec-svg', el).innerHTML = `<svg class="sch" viewBox="0 0 520 280">
        <path d="M20,270 L20,70 Q200,-30 380,70 L380,270 Z" fill="#131922" stroke="#4a5a70" stroke-width="4"/>
        <rect class="eq" x="110" y="52" width="180" height="26" rx="6"/><rect x="112" y="60" width="176" height="16" fill="#2b6fd655"/><text class="lbl" x="150" y="48">Dousing tank</text>
        <rect class="eq" x="130" y="150" width="140" height="70" rx="8"/><text class="lbl" x="160" y="190">Reactor core</text>
        <rect class="eq" x="100" y="122" width="200" height="12" rx="6"/><text x="306" y="132">8 headers</text>
        <path d="M100,128 L70,128 L62,150" stroke="#ff5d6c" stroke-width="4" fill="none"/><text x="34" y="166" style="fill:#ff5d6c">break</text>
        <rect x="24" y="252" width="352" height="14" fill="${k >= 1 ? '#2b6fd688' : '#2b6fd622'}"/><text x="30" y="246">sump</text>
        <rect class="eq" x="420" y="110" width="26" height="80" rx="12"/><rect class="eq" x="452" y="110" width="26" height="80" rx="12"/><rect class="eq" x="486" y="124" width="22" height="66" rx="10"/><text class="lbl" x="414" y="104">HP water + gas tanks</text>
        ${pipe('M433,190 L433,208 L340,208 L340,128 L300,128', 'eccp', k === 1)}
        <circle class="eq" cx="330" cy="236" r="11"/><text x="325" y="240">P</text><rect class="eq" x="268" y="226" width="36" height="20" rx="3"/><text x="274" y="240">HX</text>
        ${pipe('M290,78 L290,100 L352,100 L352,225', 'eccp', k === 2)}${pipe('M330,225 L330,214 L318,214 L318,134', 'eccp', k >= 2)}
        ${pipe('M200,252 L200,236 L268,236', 'eccp', k === 3)}${pipe('M304,236 L319,236', 'eccp', k === 3)}
      </svg>`;
      U.$('#ec-n', el).innerHTML = `<h4>${stages[k][0]}</h4>${stages[k][1]}`;
    };
    U.seg(U.$('#ec-seg', el), stages.map((s, i) => [i, (i + 1) + ' · ' + s[0]]), 0, v => draw(+v)); draw(0);
  }],
  cont: ['Containment', function (el) {
    el.innerHTML = `<div class="grid g2"><div class="stack"><div class="card"><h3>Containment</h3><p>${comp('containment').sum}</p>${U.spec(comp('containment').specs)}</div><div class="card"><h4>Dousing and air coolers</h4>${U.spec(comp('dousing').specs)}</div></div>
      <div class="stack"><div class="card"><h4>Reactor-building pressure after a break (simulator model)</h4><div id="ct-c"></div><p class="small mut">The larger the break, the faster energy is released. Dousing starts at ≈ 14 kPa(g); the curve turns over when blow-down ends and the spray has condensed the steam.</p></div>
      <div class="card"><h4>Isolation</h4>${U.spec(comp('isolation').specs)}</div></div></div>`;
    const series = [], cols = ['#ff6b5e', '#ffb454', '#7ee0c3', '#4cc2ff']; let x = null;
    [1, 0.3, 0.1, 0.03].forEach((b, k) => { const s = new P.Sim(), t = [], y = []; s.act('loca', { size: b }); for (let i = 0; i < 6000; i++) { s.step(0.05); if (i % 10 === 0) { t.push(s.t); y.push(s.rb); } } x = t; series.push({ name: (b * 100).toFixed(0) + ' % break', y, color: cols[k] }); });
    U.chartBox(U.$('#ct-c', el), '', 'tall').draw({ x, xLabel: 'Time (s)', yLabel: 'kPa(g)', yMin: 0, yMax: 135, series, hlines: [{ y: 124, color: '#ff5d6c', label: 'design pressure' }, { y: 14, color: '#93a1b5', label: 'dousing on' }, { y: 3.45, color: '#586273', label: 'isolation / trip' }] });
  }],
  trips: ['Trip parameters', function (el) {
    const cv = D.coverage;
    el.innerHTML = `<div class="card"><h3>Trip parameters of the two shutdown systems</h3><div class="scroll"><table class="tbl"><tr><th>Parameter</th><th>SDS1 (channels D, E, F)</th><th>SDS2 (channels G, H, J)</th><th>What it protects against</th></tr>${D.trips.map(t => `<tr><td><b>${t.p}</b></td><td>${t.s1}</td><td>${t.s2}</td><td class="mut">${t.covers}</td></tr>`).join('')}</table></div>
      <p class="small mut" style="margin-top:8px">Set-points are typical published values for a CANDU 6 and vary by station and with reactor power (several are power-conditioned).</p></div>
      <div class="card" style="margin-top:14px"><h3>Trip coverage: which parameter catches which accident</h3><div class="scroll"><table class="tbl"><tr><th>Initiating event</th>${cv.cols.map(c => `<th>${c}</th>`).join('')}</tr>${cv.rows.map(r => `<tr><td>${r[0]}</td>${r[1].map(v => `<td style="text-align:center">${v === 1 ? '<b style="color:var(--ok)">● primary</b>' : v === 2 ? '<span style="color:var(--warm)">○ back-up</span>' : ''}</td>`).join('')}</tr>`).join('')}</table></div>
      <p class="small mut" style="margin-top:8px">Design rule: every event must be covered by at least two diverse trip parameters on each shutdown system wherever practicable.</p></div>`;
  }],
  acc: ['Accident library', function (el) {
    el.innerHTML = `<div class="grid gside"><div class="card" id="ac-list"></div><div class="card" id="ac-det"></div></div>`;
    const show = id => {
      const a = D.accidents.find(x => x.id === id);
      U.$$('#ac-list button', el).forEach(b => b.classList.toggle('on', b.dataset.id === id));
      U.$('#ac-det', el).innerHTML = `<span class="tag">${a.cat}</span><h2 style="margin-top:8px">${a.name}</h2><div class="note"><h4>Thermalhydraulics</h4>${a.th}</div><h4 style="margin-top:14px">Sequence of events</h4><dl class="steps">${a.seq.map(s => `<dt>${s[0]}</dt><dd>${s[1]}</dd>`).join('')}</dl><div class="note ok" style="margin-top:14px"><h4>What to take away</h4>${a.lesson}</div>${a.sim ? '<div class="row" style="margin-top:14px"><button class="btn pri" id="ac-run">Run this in the simulator →</button></div>' : ''}`;
      if (a.sim) U.$('#ac-run', el).addEventListener('click', () => C.app.go('sim', { scenario: a.sim }));
    };
    U.$('#ac-list', el).innerHTML = '<h4>Design-basis events</h4>' + D.accidents.map(a => `<button class="btn" data-id="${a.id}" style="display:block;width:100%;text-align:left;margin-bottom:6px">${a.name}<br><span class="small mut">${a.cat}</span></button>`).join('');
    U.$$('#ac-list button', el).forEach(b => b.addEventListener('click', () => show(b.dataset.id)));
    show('lloca');
  }]
};

C.views.safety = {
  init(el) {
    el.innerHTML = `<p class="lead">CANDU safety rests on four special safety systems that are independent of the systems used to run the plant: two shutdown systems, emergency core cooling and containment. This module explains each one, the trip parameters that actuate them and how the plant responds to the classic accident sequences.</p><div id="sf-seg" style="margin-bottom:14px"></div><div id="sf-body"></div>`;
    this.el = el; this.made = {};
    this.seg = U.seg(U.$('#sf-seg', el), Object.keys(TABS).map(k => [k, TABS[k][0]]), 'over', v => this.tab(v));
    this.tab('over');
  },
  tab(k) {
    const body = U.$('#sf-body', this.el);
    Array.from(body.children).forEach(c => { c.style.display = 'none'; });
    if (!this.made[k]) { const d = this.made[k] = document.createElement('div'); body.appendChild(d); TABS[k][1](d); }
    this.made[k].style.display = 'block';
  },
  show(arg) { if (arg && TABS[arg]) { this.seg.set(arg); this.tab(arg); } }
};
})();
