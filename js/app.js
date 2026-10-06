/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
/* Shared plant state (flux → thermalhydraulics), navigation and status bar. */
(function () {
'use strict';
const C = window.CANDU, P = C.phys, U = C.ui, CORE = P.core, PL = P.plant, AG = P.aging;
C.views = {};
const M = C.model = { L: {} };
M.on = (ev, fn) => { (M.L[ev] = M.L[ev] || []).push(fn); };
M.emit = ev => (M.L[ev] || []).forEach(fn => fn());
M.init = function () {
  P.init();
  M.S = { pos: CORE.refPos(), ripple: false, flux: CORE.nominal, op: { power: 1, steamP: P.K.steamP, fwT: P.K.fwT }, age: AG.fromEFPY(0), sel: CORE.nominal.maxChIdx, tsp: 1.22 };
  M.solveTH();
};
// thermalhydraulics for the current flux shape, power and ageing state
M.solveTH = function () {
  const S = M.S;
  S.creep = AG.creep(S.age, CORE.nominal);
  S.th = PL.solve({ flux: S.flux, power: S.op.power, age: S.age, creep: S.creep, steamP: S.op.steamP, fwT: S.op.fwT });
  S.ccp = PL.ccp(S.th);
  S.der = AG.derived(S.age, S.creep);
  let m = 1e9, mi = 0;
  for (let i = 0; i < S.ccp.length; i++) { const v = S.ccp[i] / S.th.chMW[i]; if (v < m) { m = v; mi = i; } }
  S.minCPR = m; S.minCPRch = mi;
  M.emit('th');
};
M.solveFlux = function () { const S = M.S; S.flux = CORE.solve(S.pos, { ripple: S.ripple }); M.emit('flux'); M.solveTH(); };
M.setFlux = function (pos, flux) { M.S.pos = pos; M.S.flux = flux; M.emit('flux'); M.solveTH(); };

const NAV = [
  ['overview', 'Plant overview', 'How the whole station works'],
  ['coremap', 'Core map', 'All 380 channels at a glance'],
  ['channel', 'Fuel channel lab', 'Thermalhydraulics of one channel'],
  ['pht', 'Heat transport system', 'Pumps, feeders, headers, boilers'],
  ['moderator', 'Moderator', 'Heat load, sub-cooling, poisons'],
  ['flux', 'Flux & reactivity devices', 'Zones, rods, targets, refuelling'],
  ['sim', 'Transient simulator', 'Trips, LOCA, xenon, shutdown systems'],
  ['aging', 'Ageing & ROP', 'Creep, fouling and trip set-points'],
  ['safety', 'Safety systems', 'SDS1, SDS2, ECC, containment'],
  ['library', 'Component library', 'Specifications, glossary, quiz']
];
const A = C.app = { cur: null, made: {} };
A.go = function (id, arg) {
  if (!C.views[id]) id = 'overview';
  const host = document.getElementById('views');
  if (A.cur && C.views[A.cur].hide) C.views[A.cur].hide();
  U.$$('.view', host).forEach(v => v.classList.remove('on'));
  let el = A.made[id];
  const fresh = !el;
  if (fresh) { el = A.made[id] = U.el(`<section class="view" id="v-${id}"></section>`); host.appendChild(el); }
  el.classList.add('on'); A.cur = id;
  if (fresh) C.views[id].init(el);
  U.$$('#navlist button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  U.$('#status .ttl').textContent = NAV.find(n => n[0] === id)[1];
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  host.scrollTop = 0;
  if (C.views[id].show) C.views[id].show(arg);
};
A.status = function () {
  const S = M.S, th = S.th, f = S.flux;
  const cprCls = S.minCPR < 1 ? 'bad' : S.minCPR < 1.2 ? 'warn' : 'ok';
  U.$('#status .chips').innerHTML = [
    ['Power', U.f(S.op.power * 100, 0) + ' % FP', ''], ['RIH', U.f(th.rihT, 1) + ' °C', th.rihT > 268 ? 'warn' : ''], ['ROH quality', U.f(Math.max(0, th.xROH) * 100, 1) + ' %', ''],
    ['Core flow', U.f(th.wTot, 0) + ' kg/s', ''], ['Min CPR', U.f(S.minCPR, 2) + ' (' + CORE.ch[S.minCPRch].id + ')', cprCls], ['Reactivity', (f.rho >= 0 ? '+' : '') + U.f(f.rho, 2) + ' mk', Math.abs(f.rho) > 0.3 ? 'warn' : ''], ['Age', U.f(S.age.efpy, 0) + ' EFPY', '']
  ].map(c => `<span class="chip ${c[2]}">${c[0]} <b>${c[1]}</b></span>`).join('');
};
A.start = function () {
  setTimeout(() => {
    M.init();
    U.$('#status').innerHTML = '<span class="ttl"></span><span class="chips row"></span>';
    const nl = U.$('#navlist');
    NAV.forEach((n, i) => { const b = U.el(`<button type="button" data-id="${n[0]}" title="${n[1]}"><i>${String(i + 1).padStart(2, '0')}</i><span>${n[1]}<small>${n[2]}</small></span></button>`); b.addEventListener('click', () => A.go(n[0])); nl.appendChild(b); });
    M.on('th', A.status); A.status();
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== A.cur) A.go(id); });
    document.getElementById('boot').remove();
    A.go(location.hash.slice(1) || 'overview');
  }, 30);
};
// re-render a view only while it is on screen
A.live = (id, ev, fn) => M.on(ev, () => { if (A.cur === id) fn(); else A.stale[id] = true; });
A.stale = {};
A.NAV = NAV;
})();
