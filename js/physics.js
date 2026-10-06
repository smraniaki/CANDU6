/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
/* CANDU 6 teaching models: D2O properties, fuel-channel thermalhydraulics, 3-D one-group
   core diffusion with reactivity devices, plant heat balance, ageing, ROP and point kinetics.
   These are simplified educational models calibrated to public CANDU 6 design values --
   they are NOT licensing-grade tools. */
(function (root) {
'use strict';
const C = root.CANDU = root.CANDU || {};
const P = C.phys = {};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
P.clamp = clamp;

/* ------------------------------------------------------------------ constants */
const K = P.K = {
  nCh: 380, nBun: 12, pitch: 0.28575, bunLen: 0.4953, coreLen: 5.944,
  qCool: 2064, qFiss: 2180, wTotal: 7700, mwe: 728,
  rihP: 11.24, rihT: 266, rohP: 9.99, steamP: 4.69, fwT: 187,
  ptID: 0.1034, ptWall: 0.00419, ctID: 0.129, ctWall: 0.00137,
  elOD: 0.01308, nEl: 37, pelletOD: 0.01215, sheath: 0.00042
};
K.flowArea = Math.PI / 4 * K.ptID * K.ptID - K.nEl * Math.PI / 4 * K.elOD * K.elOD;
K.heatPerim = K.nEl * Math.PI * K.elOD;
K.wetPerim = K.heatPerim + Math.PI * K.ptID;
K.dh = 4 * K.flowArea / K.wetPerim;
K.dhDesign = K.qCool * 1e3 / K.wTotal;          // kJ/kg core enthalpy rise
K.chAvgMW = K.qCool / K.nCh;
K.bunAvgKW = K.qCool * 1e3 / (K.nCh * K.nBun);

/* ------------------------------------------------------------------ properties */
const TS_P = [0.1, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16];
const TS_T = [99.6, 151.8, 179.9, 212.4, 233.9, 250.4, 263.9, 275.6, 285.8, 295.0, 303.3, 311.0, 318.1, 324.7, 330.9, 336.7, 347.4];
const LNP = TS_P.map(Math.log);
function tsatH2O(p) {
  const lp = Math.log(clamp(p, 0.1, 16));
  let i = 1;
  while (i < LNP.length - 1 && LNP[i] < lp) i++;
  const f = (lp - LNP[i - 1]) / (LNP[i] - LNP[i - 1]);
  return TS_T[i - 1] + f * (TS_T[i] - TS_T[i - 1]);
}
// D2O boils ~1.4 C hotter than H2O at 1 atm and ~0.9 C cooler near 10 MPa
function tsat(p) { return tsatH2O(p) + (p < 5 ? 1.8 - 2.7 * (p - 0.1) / 4.9 : -0.9); }
function psat(T) {
  let lo = 0.1, hi = 16;
  for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (tsat(m) < T) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
function cpL(T) {
  if (T >= 250) { const d = T - 250; return 4.40 + 0.0065 * d + 0.000195 * d * d; }
  return 4.19 + 0.00105 * (T - 50);
}
const H250 = 4.19 * 250 + 0.000525 * (200 * 200 - 2500);
function hL(T) {
  if (T >= 250) { const d = T - 250; return H250 + 4.40 * d + 0.00325 * d * d + 0.000065 * d * d * d; }
  return 4.19 * T + 0.000525 * ((T - 50) * (T - 50) - 2500);
}
function TfromH(h) {
  let T = h > H250 ? 250 + (h - H250) / 4.9 : h / 4.25;
  for (let i = 0; i < 6; i++) T -= (hL(T) - h) / cpL(T);
  return T;
}
function hfg(p) { return clamp(1185 - 56 * (p - 10), 900, 1950); }
function hfgH2O(p) { return clamp(1317 - 62 * (p - 10), 1000, 2260); }
function rhoL(T) {
  if (T > 250) { const d = T - 250; return 1.108 * Math.max(420, 798.75 - 1.45 * d - 0.0058 * d * d); }
  return 1.108 * (1000 - 0.08 * T - 0.0029 * T * T);
}
function rhoG(p) { const d = p - 10; return 1.11 * Math.max(3, 55.5 + 6.85 * d + 0.2 * d * d); }
function mu(T) { return 1.0e-4 * Math.exp(-0.0045 * (T - 280)); }
const KL = 0.50;                                   // W/m.K liquid conductivity near 290 C
function kUO2(Tc) {                                // Fink (2000), 95 % TD, W/m.K
  const t = (Tc + 273.15) / 1000;
  return 100 / (7.5408 + 17.692 * t + 3.6142 * t * t) + 6400 / Math.pow(t, 2.5) * Math.exp(-16.35 / t);
}
P.props = { tsat, tsatH2O, psat, cpL, hL, TfromH, hfg, hfgH2O, rhoL, rhoG, mu, kUO2 };

/* ------------------------------------------------------------------ fuel channel */
const CH = P.channel = {
  q0: 2041, xCoef: 2.5, creepPen: 0.03, creepExp: 0.9, bypassExp: 1.5, ringPeak: 1.12, Kj: 0.75, fMult: 1.15,
  hGap: 9.0   // kW/m2K pellet-sheath gap conductance (collapsible CANLUB sheath)
};
CH.defaultAxial = function (n) {
  const a = []; let s = 0;
  for (let i = 0; i < n; i++) { const z = (i + 0.5) / n; const v = Math.pow(Math.sin(Math.PI * (z * 0.92 + 0.04)), 0.85); a.push(v); s += v; }
  return a.map(v => v / s);
};
CH.refine = function (ax, f) {                      // split each node into f equal sub-nodes (linear interp.)
  const n = ax.length, out = [];
  for (let i = 0; i < n * f; i++) {
    const zc = (i + 0.5) / f - 0.5; const i0 = clamp(Math.floor(zc), 0, n - 2); const t = clamp(zc - i0, -0.5, 1.5);
    out.push(Math.max(0, ax[i0] + t * (ax[i0 + 1] - ax[i0])));
  }
  const s = out.reduce((a, b) => a + b, 0);
  return out.map(v => v / s);
};
CH.refineVals = function (v, f) {
  const n = v.length, out = [];
  for (let i = 0; i < n * f; i++) {
    const zc = (i + 0.5) / f - 0.5; const i0 = clamp(Math.floor(zc), 0, n - 2); const t = clamp(zc - i0, 0, 1);
    out.push(v[i0] + t * (v[i0 + 1] - v[i0]));
  }
  return out;
};

const M = { res: 0, minR: 0, minI: 0, xE: 0, xR: 0, pExit: 0, rlE: 0, phiO: 0, dpIn: 0, dpOut: 0, dpCore: 0, hOut: 0, TE: 0 };
function march(o, W, power, det) {
  const ax = o.axial, n = ax.length, dz = K.coreLen / n, A = K.flowArea, dh = K.dh;
  const G = W / A, Tin = o.rihT, rough = o.rough || 1, cr = o.creep;
  let h = hL(Tin);
  const dpIn = o.kin * W * W / rhoL(Tin);
  const p0 = o.rihP * 1e6 - dpIn;
  let p = p0, vPrev = 1 / rhoL(Tin), minR = 1e9, minI = 0;
  const sqG = Math.sqrt(G / 7000);
  for (let i = 0; i < n; i++) {
    const q = power * 1e3 * ax[i];
    const hm = h + 0.5 * q / W;
    const pM = (p > 1e6 ? p : 1e6) * 1e-6;
    const ts = tsat(pM), hg = hfg(pM);
    const xeq = (hm - hL(ts)) / hg, x = xeq > 0 ? (xeq < 1 ? xeq : 1) : 0;
    const T = xeq < 0 ? TfromH(hm) : ts;
    const rl = rhoL(T), rg = rhoG(pM);
    const phi2 = 1 + x * (rl / rg - 1);
    const e = cr ? cr[i] : 0;
    let ar = 1;
    if (e > 0) { const D2 = K.ptID * (1 + e / 100); ar = A / (A + Math.PI / 4 * (D2 * D2 - K.ptID * K.ptID)); }
    const Re = G * dh / mu(T);
    const f = 0.184 * Math.pow(Re, -0.2) * CH.fMult * rough;
    const kk = (f * dz / dh + CH.Kj * dz / K.bunLen) * (e > 0 ? Math.pow(ar, CH.creepExp) : 1);
    const dp = kk * G * G / (2 * rl) * phi2;
    const vm = x / rg + (1 - x) / rl;
    const dpa = G * G * (vm - vPrev); vPrev = vm;
    const qf = q / (K.heatPerim * dz) * CH.ringPeak;
    // crept tube: part of the flow bypasses the bundle over its top, starving the sub-channels
    const fc = e > 0 ? Math.max(0.3, 1 - CH.creepPen * e) * Math.pow(ar, 0.5 * CH.bypassExp) : 1;
    const qc = CH.q0 * sqG * Math.exp(-CH.xCoef * clamp(xeq, -0.3, 1)) * (1 - 0.04 * (pM - 10)) * fc;
    const r = qc / (qf > 1e-6 ? qf : 1e-6);
    if (r < minR) { minR = r; minI = i; }
    if (det) {
      det.z[i] = (i + 0.5) * dz; det.T[i] = T; det.x[i] = xeq; det.p[i] = pM; det.qf[i] = qf; det.qc[i] = qc; det.chfr[i] = r;
      det.alpha[i] = x > 0 ? 1 / (1 + (1 - x) / x * rg / rl * 1.4) : 0;
      det.vel[i] = G * vm * ar;
      // sheath temperature
      const Pr = cpL(T) * 1e3 * mu(T) / KL;
      const hc = 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.4) * KL / dh / 1e3;   // kW/m2K
      let Tw = T + qf / hc;
      const Tjl = ts + 25 * Math.pow(qf / 1e3, 0.25) * Math.exp(-pM / 6.2);
      if (Tw > Tjl) Tw = Tjl;
      if (r < 1) Tw = Tjl + qf / 4.5 * Math.min(1, (1 - r) * 4);                    // post-dryout excursion
      det.Tsh[i] = Tw;
      // outer-element centreline temperature
      const qlin = qf * Math.PI * K.elOD;                                          // kW/m
      const qPel = qlin / (Math.PI * K.pelletOD);
      const Tsurf = Tw + qf * K.sheath / 0.017 + qPel / CH.hGap;
      let Tcl = Tsurf, ki = qlin * 1e3 / (4 * Math.PI);                              // conductivity integral, W/m
      while (ki > 0 && Tcl < 2840) { ki -= kUO2(Tcl + 10) * 20; Tcl += 20; }
      det.Tfs[i] = Tsurf; det.Tcl[i] = Math.min(Tcl, 2840);
    }
    p -= dp + dpa;
    h += q / W;
  }
  const pE = (p > 1e6 ? p : 1e6) * 1e-6;
  const tsE = tsat(pE), xE = (h - hL(tsE)) / hfg(pE);
  const xR = (h - hL(tsat(o.rohP))) / hfg(o.rohP);
  const xa = Math.max(0, Math.min(1, 0.5 * (xE + xR)));
  const TE = xE < 0 ? TfromH(h) : tsE;
  const rlE = rhoL(TE);
  const phiO = 1 + xa * (rlE / rhoG(0.5 * (pE + o.rohP)) - 1);
  const dpOut = o.kout * W * W / rlE * phiO;
  M.res = p - dpOut - o.rohP * 1e6; M.minR = minR; M.minI = minI; M.xE = xE; M.xR = xR; M.pExit = p;
  M.rlE = rlE; M.phiO = phiO; M.dpIn = dpIn; M.dpOut = dpOut; M.dpCore = p0 - p; M.hOut = h; M.TE = TE;
  return M.res;
}
function solveFlow(o, power, guess, band) {
  let lo, hi, flo, fhi;
  if (guess) {
    const b = band || 0.07;
    lo = guess * (1 - b); hi = guess * (1 + b); flo = march(o, lo, power); fhi = march(o, hi, power);
    if (!(flo > 0 && fhi < 0)) guess = 0;
  }
  if (!guess) {
    hi = 48; fhi = march(o, hi, power); lo = hi; flo = fhi;
    for (let i = 0; i < 26 && flo <= 0; i++) { hi = lo; fhi = flo; lo = hi * 0.85; flo = march(o, lo, power); }
    if (flo <= 0) { march(o, lo, power); return lo; }
  }
  let W = lo, side = 0;
  for (let it = 0; it < 40; it++) {
    W = (lo * fhi - hi * flo) / (fhi - flo);
    const f = march(o, W, power);
    if (Math.abs(f) < 150 || (hi - lo) < 1e-4 * W) return W;
    if (f > 0) { lo = W; flo = f; if (side === 1) fhi *= 0.5; side = 1; }
    else { hi = W; fhi = f; if (side === -1) flo *= 0.5; side = -1; }
  }
  march(o, W, power);
  return W;
}
CH.flow = function (o, power, guess) { const W = solveFlow(o, power, guess); return { W, minR: M.minR, minI: M.minI, xE: M.xE, xR: M.xR, hOut: M.hOut, dpIn: M.dpIn, dpCore: M.dpCore, dpOut: M.dpOut }; };
CH.ccp = function (o, pRef, wGuess) {
  let wg = wGuess || 0;
  const f = pw => { wg = solveFlow(o, pw, wg, 0.15); return M.minR - 1; };
  let lo = pRef * 0.7, hi = pRef * 2.0, flo = f(lo), fhi;
  if (flo < 0) { hi = lo; fhi = flo; lo = pRef * 0.15; wg = 0; flo = f(lo); if (flo < 0) return lo; }
  else { fhi = f(hi); if (fhi > 0) { lo = hi; flo = fhi; hi = pRef * 3.5; fhi = f(hi); if (fhi > 0) return hi; } }
  let pw = lo, side = 0;
  for (let it = 0; it < 24; it++) {
    pw = (lo * fhi - hi * flo) / (fhi - flo);
    const v = f(pw);
    if (Math.abs(v) < 0.002 || (hi - lo) < 0.002 * pRef) break;
    if (v > 0) { lo = pw; flo = v; if (side === 1) fhi *= 0.5; side = 1; }
    else { hi = pw; fhi = v; if (side === -1) flo *= 0.5; side = -1; }
  }
  return pw;
};
CH.detail = function (o, power) {
  const n = o.axial.length, mk = () => new Float64Array(n);
  const det = { z: mk(), T: mk(), x: mk(), p: mk(), qf: mk(), qc: mk(), chfr: mk(), alpha: mk(), vel: mk(), Tsh: mk(), Tfs: mk(), Tcl: mk() };
  const W = solveFlow(o, power, 0);
  march(o, W, power, det);
  det.W = W; det.minR = M.minR; det.minI = M.minI; det.xE = M.xE; det.xR = M.xR; det.hOut = M.hOut; det.TE = M.TE;
  det.dpIn = M.dpIn; det.dpCore = M.dpCore; det.dpOut = M.dpOut; det.pExit = M.pExit * 1e-6;
  det.G = W / K.flowArea; det.power = power;
  return det;
};
// size inlet/outlet feeder + end-fitting resistance so the channel passes its design flow
CH.design = function (pRef, axial, hdr) {
  const W = clamp(pRef * 1e3 / K.dhDesign, 5, 27.5);
  const o = { axial, rihP: hdr.rihP, rihT: hdr.rihT, rohP: hdr.rohP, kin: 0, kout: 0 };
  let dpIn = 0.2e6;
  for (let it = 0; it < 5; it++) {
    o.kin = dpIn * rhoL(hdr.rihT) / (W * W);
    march(o, W, pRef);
    const budget = dpIn + M.res + M.dpOut;
    dpIn = 0.45 * budget;
    o.kout = 0.55 * budget * M.rlE / (W * W * M.phiO);
  }
  o.kin = dpIn * rhoL(hdr.rihT) / (W * W);
  return { kin: o.kin, kout: o.kout, wd: W };
};

/* ------------------------------------------------------------------ core: layout */
const CORE = P.core = {};
const NXY = 28, OFF = 3, NZ = 12;
CORE.NXY = NXY; CORE.OFF = OFF; CORE.NZ = NZ;
CORE.rowCounts = [6, 12, 14, 16, 18, 18, 20, 20, 22, 22, 22, 22, 22, 22, 20, 20, 18, 18, 16, 14, 12, 6];
CORE.rowNames = 'ABCDEFGHJKLMNOPQRSTUVW';
CORE.par = { Dc: 1.0, M2: 380, Dr: 1.15, sar: 1.5e-4, kIn: 1.035, kOut: 1.085, rIn: 2.3, rW: 2.2, axExt: 15, rippleAmp: 0.014 };
CORE.S = { lzc: 9.218e-4, adj: 3.882e-4, mca: 1.353e-3, sor: 3.042e-3, liss: 0.36 };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
P.rng = rng;
function zoneOf(cx, cy) {
  if (cx < 7.33) return cy < 11 ? 0 : 1;
  if (cx > 14.67) return cy < 11 ? 5 : 6;
  return cy < 7.33 ? 2 : cy < 14.67 ? 3 : 4;
}
CORE.zoneOf = zoneOf;

CORE.build = function () {
  const ch = [], chanAt = new Int16Array(NXY * NXY).fill(-1);
  for (let r = 0; r < 22; r++) {
    const c = CORE.rowCounts[r], c0 = (22 - c) / 2;
    for (let k = 0; k < c; k++) {
      const col = c0 + k, x = (col - 10.5) * K.pitch, y = (10.5 - r) * K.pitch;
      chanAt[(r + OFF) * NXY + col + OFF] = ch.length;
      ch.push({ i: ch.length, id: CORE.rowNames[r] + (col + 1), row: r, col, x, y, rad: Math.hypot(x, y),
        loop: col < 11 ? 1 : 2, dir: (r + col) % 2 === 0 ? 1 : -1, zone: zoneOf(col + 0.5, r + 0.5) });
    }
  }
  CORE.ch = ch; CORE.chanAt = chanAt;
  // node types: 2 core, 1 reflector, 0 outside calandria
  const type = new Uint8Array(NXY * NXY);
  for (let iy = 0; iy < NXY; iy++) for (let ix = 0; ix < NXY; ix++) {
    const rx = ix - OFF + 0.5 - 11, ry = iy - OFF + 0.5 - 11;
    type[iy * NXY + ix] = chanAt[iy * NXY + ix] >= 0 ? 2 : (Math.hypot(rx, ry) < 13.3 ? 1 : 0);
  }
  CORE.type2d = type;
  const nodeIdx = new Int32Array(NXY * NXY * NZ).fill(-1); let nA = 0;
  for (let iz = 0; iz < NZ; iz++) for (let i = 0; i < NXY * NXY; i++) if (type[i]) nodeIdx[iz * NXY * NXY + i] = nA++;
  CORE.nA = nA; CORE.nodeIdx = nodeIdx;
  const nb = new Int32Array(nA * 6).fill(-1), cf = new Float64Array(nA * 6), diag0 = new Float64Array(nA);
  const chOf = new Int16Array(nA).fill(-1), bunOf = new Int8Array(nA), sa0 = new Float64Array(nA);
  const hx = K.pitch * 100, hz = K.bunLen * 100, par = CORE.par;
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let iz = 0; iz < NZ; iz++) for (let iy = 0; iy < NXY; iy++) for (let ix = 0; ix < NXY; ix++) {
    const a = nodeIdx[(iz * NXY + iy) * NXY + ix]; if (a < 0) continue;
    const t = type[iy * NXY + ix], D1 = t === 2 ? par.Dc : par.Dr;
    chOf[a] = chanAt[iy * NXY + ix]; bunOf[a] = iz;
    sa0[a] = t === 2 ? par.Dc / par.M2 : par.sar;
    let dsum = 0;
    for (let d = 0; d < 6; d++) {
      const jx = ix + dirs[d][0], jy = iy + dirs[d][1], jz = iz + dirs[d][2], h = d < 4 ? hx : hz;
      let b = -1;
      if (jx >= 0 && jx < NXY && jy >= 0 && jy < NXY && jz >= 0 && jz < NZ) b = nodeIdx[(jz * NXY + jy) * NXY + jx];
      if (b >= 0) {
        const D2 = type[jy * NXY + jx] === 2 ? par.Dc : par.Dr;
        const c = 2 * D1 * D2 / (D1 + D2) / (h * h);
        nb[a * 6 + d] = b; cf[a * 6 + d] = c; dsum += c;
      } else dsum += D1 / (h * (h / 2 + (d < 4 ? 2.13 * D1 : par.axExt)));
    }
    diag0[a] = dsum;
  }
  Object.assign(CORE, { nb, cf, diag0, chOf, bunOf, sa0 });
  // refuelling state (0 = just fuelled, 1 = due)
  const rnd = rng(380);
  CORE.burn = new Float64Array(ch.length).map(() => rnd());
  CORE.buildDevices();
  CORE.buildDetectors();
};

CORE.buildDevices = function () {
  const dv = [];
  const chord = x => { const hc = Math.sqrt(Math.max(0, 121 - (x - 11) * (x - 11))); return [11 - hc + 0.6, 11 + hc - 0.6]; };
  // 14 liquid zone compartments in 6 vertical zone control units
  [3, 9].forEach((z, h) => {
    dv.push({ type: 'lzc', x: 4.5, z, y1: 2, y2: 11, zone: 0 + 7 * h }, { type: 'lzc', x: 4.5, z, y1: 11, y2: 20, zone: 1 + 7 * h },
      { type: 'lzc', x: 11, z, y1: 1, y2: 7.33, zone: 2 + 7 * h }, { type: 'lzc', x: 11, z, y1: 7.33, y2: 14.67, zone: 3 + 7 * h }, { type: 'lzc', x: 11, z, y1: 14.67, y2: 21, zone: 4 + 7 * h },
      { type: 'lzc', x: 17.5, z, y1: 2, y2: 11, zone: 5 + 7 * h }, { type: 'lzc', x: 17.5, z, y1: 11, y2: 20, zone: 6 + 7 * h });
  });
  // 21 adjusters: 7 columns x 3 axial rows, 7 banks
  const bankOf = (c, p) => { if (c === 3) return p === 1 ? 0 : 1; if (c === 2 || c === 4) return p === 1 ? 2 : 3; if (c === 1 || c === 5) return p === 1 ? 2 : 4; return p === 1 ? 6 : 5; };
  const axs = [2, 5, 8, 11, 14, 17, 20], spans = [[6, 16], [4.5, 17.5], [3.5, 18.5], [3.5, 18.5], [3.5, 18.5], [4.5, 17.5], [6, 16]];
  let n = 0;
  [4, 6, 8].forEach((z, p) => axs.forEach((x, c) => dv.push({ type: 'adj', x, z, y1: spans[c][0], y2: spans[c][1], bank: bankOf(c, p), n: n++ })));
  n = 0;
  [5, 7].forEach((z, p) => [9.5, 12.5].forEach(x => dv.push({ type: 'mca', x, z, y1: 2, y2: 20, bank: p, n: n++ })));
  n = 0;
  [2, 10].forEach(z => [3.5, 6.5, 9.5, 12.5, 15.5, 18.5].forEach(x => { const c = chord(x); dv.push({ type: 'sor', x, z, y1: c[0], y2: c[1], n: n++ }); }));
  [5, 7].forEach(z => [1.5, 3.5, 6.5, 8.0, 14.0, 15.5, 18.5, 20.5].forEach(x => { const c = chord(x); dv.push({ type: 'sor', x, z, y1: c[0], y2: c[1], n: n++ }); }));
  dv.forEach((d, i) => { d.i = i; });
  CORE.devices = dv;
  CORE.lissNozzles = [];
  [1, 11].forEach(z => [5, 11, 17].forEach(y => CORE.lissNozzles.push({ y, z })));
  CORE.adjBanks = 7;
};
CORE.refPos = function () {
  return { lzc: new Array(14).fill(0.5), adj: new Array(21).fill(1), mca: new Array(4).fill(0), sor: new Array(28).fill(0), liss: 0, boron: 0, gd: 0, targets: [] };
};
CORE.clonePos = function (p) {
  return { lzc: p.lzc.slice(), adj: p.adj.slice(), mca: p.mca.slice(), sor: p.sor.slice(), liss: p.liss, boron: p.boron, gd: p.gd, targets: p.targets.map(t => Object.assign({}, t)) };
};
CORE.buildDetectors = function () {
  const hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const mk = (count, seed, names) => {
    const out = []; let i = seed;
    while (out.length < count) {
      i++;
      const x = 1.5 + 19 * hal(i, 2), y = 1.5 + 19 * hal(i, 3), z = 1 + 10 * hal(i, 5);
      if (Math.hypot(x - 11, y - 11) > 9.3) continue;
      const col = Math.floor(x), row = Math.floor(y);
      const c = CORE.chanAt[(row + OFF) * NXY + col + OFF]; if (c < 0) continue;
      out.push({ x, y, z, ch: c, bun: Math.floor(z), logic: names[out.length % 3], n: out.length + 1 });
    }
    return out;
  };
  CORE.det1 = mk(34, 7, 'DEF');     // SDS1: vertical in-core assemblies
  CORE.det2 = mk(24, 211, 'GHJ');   // SDS2: horizontal in-core assemblies
};

/* ------------------------------------------------------------------ core: diffusion solve */
function addLine(sa, x, z, ya, yb, s) {
  if (yb <= ya || s === 0) return;
  const xc = x - 0.5, zc = z - 0.5;
  const i0 = Math.floor(xc), wx = xc - i0, k0 = Math.floor(zc), wz = zc - k0;
  for (let r = Math.max(0, Math.floor(ya)); r < Math.min(22, Math.ceil(yb)); r++) {
    const cov = Math.min(yb, r + 1) - Math.max(ya, r); if (cov <= 0) continue;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const col = i0 + a, bz = k0 + b, w = (a ? wx : 1 - wx) * (b ? wz : 1 - wz);
      if (w <= 0 || col < 0 || col > 21 || bz < 0 || bz >= NZ) continue;
      const nd = CORE.nodeIdx[(bz * NXY + r + OFF) * NXY + col + OFF];
      if (nd >= 0) sa[nd] += s * w * cov;
    }
  }
}
CORE.assemble = function (pos) {
  const sa = new Float64Array(CORE.sa0), S = CORE.S, dv = CORE.devices;
  for (let i = 0; i < dv.length; i++) {
    const d = dv[i], L = d.y2 - d.y1;
    if (d.type === 'lzc') { const f = pos.lzc[d.zone]; addLine(sa, d.x, d.z, d.y1, d.y2, S.lzc * f); }
    else if (d.type === 'adj') addLine(sa, d.x, d.z, d.y1, d.y1 + pos.adj[d.n] * L, S.adj);
    else if (d.type === 'mca') addLine(sa, d.x, d.z, d.y1, d.y1 + pos.mca[d.n] * L, S.mca);
    else if (d.type === 'sor') addLine(sa, d.x, d.z, d.y1, d.y1 + pos.sor[d.n] * L, S.sor);
  }
  for (const t of pos.targets) addLine(sa, t.x, t.z, t.y - t.len / 2, t.y + t.len / 2, t.s);
  // moderator poison: uniform absorber (8 mk/ppm B, 28 mk/ppm Gd) + SDS2 injection
  const uni = (0.008 * pos.boron + 0.028 * pos.gd + CORE.S.liss * pos.liss) * CORE.par.Dc / CORE.par.M2;
  if (uni > 0) for (let a = 0; a < CORE.nA; a++) sa[a] += uni;
  return sa;
};
CORE.nuSigF = function (ripple) {
  const nA = CORE.nA, par = CORE.par, out = new Float64Array(nA), base = par.Dc / par.M2;
  for (let a = 0; a < nA; a++) {
    const c = CORE.chOf[a]; if (c < 0) continue;
    const u = clamp((CORE.ch[c].rad - par.rIn) / par.rW + 0.5, 0, 1);
    let kinf = par.kIn + (par.kOut - par.kIn) * u * u * (3 - 2 * u);
    if (ripple) kinf += par.rippleAmp * (1 - 2 * CORE.burn[c]);
    out[a] = kinf * base;
  }
  return out;
};
CORE.solve = function (pos, opt) {
  opt = opt || {};
  const nA = CORE.nA, nb = CORE.nb, cf = CORE.cf, diag0 = CORE.diag0;
  const sa = CORE.assemble(pos), nsf = CORE.nuSigF(!!opt.ripple);
  const dg = new Float64Array(nA);
  for (let a = 0; a < nA; a++) dg[a] = 1 / (diag0[a] + sa[a]);
  let phi = (!opt.cold && CORE._phi) ? new Float64Array(CORE._phi) : new Float64Array(nA).fill(1);
  let k = (!opt.cold && CORE._k) || 1;
  const src = new Float64Array(nA), snap = new Float64Array(nA);
  let f0 = 0; for (let a = 0; a < nA; a++) f0 += nsf[a] * phi[a];
  for (let a = 0; a < nA; a++) phi[a] /= f0;
  const w = 1.45, tol = opt.tol || 2e-5, maxIt = opt.maxIt || 3000;
  let it = 0, kPrev = k;
  snap.set(phi);
  for (; it < maxIt; it++) {
    for (let a = 0; a < nA; a++) src[a] = nsf[a] * phi[a] / k;
    for (let sw = 0; sw < 2; sw++) {
      for (let q = 0; q < nA; q++) {
        const a = sw ? nA - 1 - q : q, b = a * 6; let s = src[a], j;
        if ((j = nb[b]) >= 0) s += cf[b] * phi[j];
        if ((j = nb[b + 1]) >= 0) s += cf[b + 1] * phi[j];
        if ((j = nb[b + 2]) >= 0) s += cf[b + 2] * phi[j];
        if ((j = nb[b + 3]) >= 0) s += cf[b + 3] * phi[j];
        if ((j = nb[b + 4]) >= 0) s += cf[b + 4] * phi[j];
        if ((j = nb[b + 5]) >= 0) s += cf[b + 5] * phi[j];
        phi[a] += w * (s * dg[a] - phi[a]);
      }
    }
    let f1 = 0; for (let a = 0; a < nA; a++) f1 += nsf[a] * phi[a];
    k *= f1; const inv = 1 / f1;
    for (let a = 0; a < nA; a++) phi[a] *= inv;
    if ((it + 1) % 10 === 0) {
      let err = 0, mx = 0;
      for (let a = 0; a < nA; a++) { const d = Math.abs(phi[a] - snap[a]); if (d > err) err = d; if (phi[a] > mx) mx = phi[a]; }
      snap.set(phi);
      if (err / mx < tol && Math.abs(k - kPrev) < 1e-7) { it++; break; }
      kPrev = k;
    }
  }
  if (!opt.noStore) { CORE._phi = phi; CORE._k = k; }
  return CORE.tally(phi, nsf, k, it);
};
CORE.tally = function (phi, nsf, k, iters) {
  const nC = CORE.ch.length, nA = CORE.nA;
  const chRel = new Float64Array(nC), bunRel = new Float64Array(nC * NZ), zoneFrac = new Float64Array(14);
  let tot = 0;
  for (let a = 0; a < nA; a++) { const c = CORE.chOf[a]; if (c < 0) continue; const pw = nsf[a] * phi[a]; bunRel[c * NZ + CORE.bunOf[a]] = pw; tot += pw; }
  const sc = nC * NZ / tot;
  for (let c = 0; c < nC; c++) {
    let s = 0;
    for (let b = 0; b < NZ; b++) { const v = bunRel[c * NZ + b] * sc; bunRel[c * NZ + b] = v; s += v; zoneFrac[CORE.ch[c].zone + (b >= 6 ? 7 : 0)] += v / (nC * NZ); }
    chRel[c] = s / NZ;
  }
  const rd = d => bunRel[d.ch * NZ + d.bun];
  const res = { k, iters, chRel, bunRel, zoneFrac, det1: CORE.det1.map(rd), det2: CORE.det2.map(rd) };
  res.rho = CORE.kRef ? 1000 * (1 / CORE.kRef - 1 / k) : 0;
  let mc = 0, mb = 0, ic = 0;
  for (let c = 0; c < nC; c++) if (chRel[c] > mc) { mc = chRel[c]; ic = c; }
  for (let i = 0; i < bunRel.length; i++) if (bunRel[i] > mb) mb = bunRel[i];
  res.maxCh = mc * K.chAvgMW; res.maxChIdx = ic; res.maxBun = mb * K.bunAvgKW; res.radFF = 1 / mc; res.overallFF = 1 / mb;
  return res;
};
// flow-oriented axial power fractions (sum 1) for one channel
CORE.axial = function (flux, c) {
  const out = new Array(NZ), dir = CORE.ch[c].dir; let s = 0;
  for (let i = 0; i < NZ; i++) { const v = flux.bunRel[c * NZ + (dir > 0 ? i : NZ - 1 - i)]; out[i] = v; s += v; }
  for (let i = 0; i < NZ; i++) out[i] /= s;
  return out;
};
// regulating-system surrogates: bulk (criticality) and spatial (zone power) control with the liquid zones
CORE.rrsBulk = function (pos, opt) {
  const shift = d => { const q = CORE.clonePos(pos); q.lzc = q.lzc.map(v => clamp(v + d, 0, 1)); return q; };
  let d0 = 0, r0 = CORE.solve(pos, opt), d1 = clamp(r0.rho / 7, -0.4, 0.4), res = r0;
  if (Math.abs(r0.rho) < 0.01) return { pos, flux: r0, sat: false };
  for (let i = 0; i < 5; i++) {
    res = CORE.solve(shift(d1), opt);
    if (Math.abs(res.rho) < 0.01) break;
    const slope = (res.rho - r0.rho) / (d1 - d0);
    if (!isFinite(slope) || Math.abs(slope) < 1e-6) break;
    d0 = d1; r0 = res; d1 = clamp(d1 - res.rho / slope, -1, 1);
  }
  const q = shift(d1); res = CORE.solve(q, opt);
  return { pos: q, flux: res, sat: Math.abs(res.rho) > 0.05 };
};
CORE.rrsSpatial = function (pos, opt, iters) {
  let q = CORE.clonePos(pos), res = null;
  const ref = CORE.nominal.zoneFrac;
  for (let it = 0; it < (iters || 6); it++) {
    res = CORE.solve(q, opt);
    for (let z = 0; z < 14; z++) q.lzc[z] = clamp(q.lzc[z] + 3.0 * (res.zoneFrac[z] / ref[z] - 1) + res.rho / 7, 0.02, 0.98);
  }
  const b = CORE.rrsBulk(q, opt);
  return b;
};
CORE.refuel = function (c) { CORE.burn[c] = 0; };
CORE.advanceDays = function (days, flux) {
  const done = [];
  for (let c = 0; c < CORE.ch.length; c++) {
    const dwell = 190 / Math.max(0.4, flux ? flux.chRel[c] : 1);
    CORE.burn[c] += days / dwell;
    if (CORE.burn[c] >= 1) { CORE.burn[c] = 0; done.push(c); }
  }
  return done;
};

/* ------------------------------------------------------------------ ageing */
const AG = P.aging = {};
AG.fromEFPY = function (y) {
  return { efpy: y, creepRate: 1, kin: 1 + 0.004 * y, kout: 1 + 0.003 * y, sgUA: 1 - 0.0035 * y, pump: 1 - 0.0005 * y, rough: 1 + 0.002 * y };
};
// peak diametral creep ~0.15 %/EFPY at the highest-flux, hotter (downstream) part of the channel
AG.creep = function (age, flux) {
  const nC = CORE.ch.length, out = new Float32Array(nC * NZ);
  if (!age || age.efpy <= 0) return out;
  for (let c = 0; c < nC; c++) {
    const dir = CORE.ch[c].dir;
    for (let i = 0; i < NZ; i++) {
      const b = dir > 0 ? i : NZ - 1 - i;
      const pw = flux.bunRel[c * NZ + b] * K.bunAvgKW / 800;
      out[c * NZ + i] = 0.15 * age.creepRate * age.efpy * pw * (0.70 + 0.6 * (i + 0.5) / NZ);
    }
  }
  return out;
};
AG.derived = function (age, creep) {
  let mx = 0; for (let i = 0; i < creep.length; i++) if (creep[i] > mx) mx = creep[i];
  const y = age.efpy;
  return {
    creepMax: mx, elong: 5.2 * y, sag: 2.4 * y, wall: K.ptWall * 1000 * (1 - 0.0085 * mx) - 0.004 * y,
    heq: 5 + 1.0 * y, feederWall: Math.max(2.5, 7.0 - 0.085 * y), gapLiss: Math.max(0, 45 - 1.3 * y)
  };
};

/* ------------------------------------------------------------------ plant heat balance */
const PL = P.plant = { UA: 15184, pumpDP: 1.81, otherDP: 0.56 };
function sgOut(W, hRoh, pR, Ts, Tfw, UA) {
  const tsP = tsat(pR), hg = hfg(pR), TsEff = Ts - 0.12 * (Ts - Tfw);
  let x = (hRoh - hL(tsP)) / hg, a1 = 0, Tin;
  if (x > 0) { a1 = Math.min(0.9, W * x * hg / (UA * Math.max(2, tsP - Ts))); Tin = tsP; } else { Tin = TfromH(hRoh); x = 0; }
  const ntu = UA * (1 - a1) / (W * cpL(0.5 * (Tin + Ts)));
  return { Tout: TsEff + (Tin - TsEff) * Math.exp(-ntu), a1, x, ntu, Tin };
}
PL.design = function (flux) {
  const hdr = { rihP: K.rihP, rihT: K.rihT, rohP: K.rohP };
  PL.des = CORE.ch.map((c, i) => CH.design(flux.chRel[i] * K.chAvgMW, CORE.axial(flux, i), hdr));
  PL.wGuess = PL.des.map(d => d.wd);
};
PL.chanInput = function (c, flux, st, age, creep) {
  const d = PL.des[c];
  return { axial: CORE.axial(flux, c), rihP: st.rihP, rihT: st.rihT, rohP: st.rohP,
    kin: d.kin * (age ? age.kin : 1), kout: d.kout * (age ? age.kout : 1), rough: age ? age.rough : 1,
    creep: creep ? creep.subarray(c * NZ, c * NZ + NZ) : null };
};
PL.solve = function (inp) {
  const flux = inp.flux, power = inp.power, age = inp.age || AG.fromEFPY(0), creep = inp.creep || null;
  const nC = CORE.ch.length, steamP = inp.steamP || K.steamP, fwT = inp.fwT || K.fwT;
  const Ts = tsatH2O(steamP), rohP = inp.rohP || K.rohP;
  const st = { rihT: PL._rihT || K.rihT, rohP, rihP: rohP + (PL._dp || 1.25) };
  const W = new Float64Array(nC), xE = new Float64Array(nC), xR = new Float64Array(nC), cpr = new Float64Array(nC), minI = new Int8Array(nC), chMW = new Float64Array(nC);
  const ins = CORE.ch.map((c, i) => PL.chanInput(i, flux, st, age, creep));
  let dp = st.rihP - rohP, wTot = 0, hMix = 0, sg = null, xROH = 0;
  const hf = hL(tsat(rohP)), hg = hfg(rohP);
  for (let it = 0; it < 14; it++) {
    wTot = 0; hMix = 0;
    for (let c = 0; c < nC; c++) {
      const o = ins[c]; o.rihT = st.rihT; o.rihP = rohP + dp;
      chMW[c] = flux.chRel[c] * K.chAvgMW * power;
      const w = solveFlow(o, chMW[c], PL.wGuess[c]);
      PL.wGuess[c] = w; W[c] = w; xE[c] = M.xE; xR[c] = M.xR; cpr[c] = M.minR; minI[c] = M.minI;
      wTot += w; hMix += w * M.hOut;
    }
    hMix /= wTot; xROH = (hMix - hf) / hg;
    const wr = wTot / K.wTotal;
    const dpNew = PL.pumpDP * age.pump * (1.30 - 0.30 * wr * wr) - PL.otherDP * wr * wr * (1 + 3 * Math.max(0, xROH)) / 1.126 * (1 + 0.5 * Math.max(0, 1 - age.sgUA));
    sg = sgOut(wTot / 4, hMix, rohP, Ts, fwT, PL.UA * age.sgUA);
    const tNew = TfromH(hL(sg.Tout) + 2.2);
    const eD = dpNew - dp, eT = tNew - st.rihT;
    dp += 0.5 * eD; st.rihT += 0.85 * eT;
    if (Math.abs(eD) < 5e-4 && Math.abs(eT) < 0.01) break;
  }
  PL._rihT = st.rihT; PL._dp = dp;
  let mc = 1e9, mi = 0; for (let c = 0; c < nC; c++) if (cpr[c] < mc) { mc = cpr[c]; mi = c; }
  const qCore = K.qCool * power;
  return {
    power, W, xE, xR, chfr: cpr, minI, chMW, wTot, hMix, xROH, tROH: xROH > 0 ? tsat(rohP) : TfromH(hMix),
    rihT: st.rihT, rihP: rohP + dp, rohP, dpHH: dp, sg, Ts, steamP, fwT, minCHFR: mc, minCh: mi, ins, age, creep,
    qCore, steamFlow: qCore * 1e3 / (hfgH2O(steamP) + 4.6 * (Ts - fwT)),
    mwe: qCore * 0.3527 * (1 + 0.11 * Math.log(steamP / 4.69)) * (1 + 0.0004 * (fwT - 187)),
    pumpDP: PL.pumpDP * age.pump * (1.30 - 0.30 * (wTot / K.wTotal) ** 2)
  };
};
// critical channel power for every channel at the header conditions of a solved plant state
PL.ccp = function (th, flux, list) {
  const nC = CORE.ch.length, out = new Float64Array(nC);
  const f = flux || null;
  const run = c => {
    const o = th.ins[c];
    const oo = f ? Object.assign({}, o, { axial: CORE.axial(f, c) }) : o;
    out[c] = CH.ccp(oo, Math.max(1.5, PL.des[c].wd * K.dhDesign / 1e3), 0);
  };
  if (list) list.forEach(run); else for (let c = 0; c < nC; c++) run(c);
  return out;
};
PL.calibrate = function (flux, target) {
  // CHF constant so that the limiting channel critical power ratio at design conditions = target
  let lo = 800, hi = 4000;
  for (let i = 0; i < 22; i++) {
    CH.q0 = 0.5 * (lo + hi);
    const th = PL.solve({ flux, power: 1 }); const ccp = PL.ccp(th);
    let m = 1e9; for (let c = 0; c < ccp.length; c++) m = Math.min(m, ccp[c] / th.chMW[c]);
    if (m < target) lo = CH.q0; else hi = CH.q0;
  }
  let a = 8000, b = 30000;
  for (let i = 0; i < 30; i++) { PL.UA = 0.5 * (a + b); PL._rihT = 0; const th = PL.solve({ flux, power: 1 }); if (th.rihT > K.rihT) a = PL.UA; else b = PL.UA; }
  return { q0: CH.q0, UA: PL.UA };
};

/* ------------------------------------------------------------------ ROP */
const ROP = P.rop = {};
ROP.shapes = function (cur) {
  const ref = CORE.refPos, L = [];
  const add = (id, name, group, fn) => { const p = ref(); fn(p); L.push({ id, name, group, pos: p }); };
  const bank = (p, list) => CORE.devices.forEach(d => { if (d.type === 'adj' && list.includes(d.bank)) p.adj[d.n] = 0; });
  const zl = (p, f) => { for (let z = 0; z < 14; z++) p.lzc[z] = clamp(f(z % 7, z >= 7 ? 1 : 0), 0, 1); };
  add('nom', 'Nominal (time-average, adjusters in, zones 50 %)', 'Normal', p => { });
  add('lz0', 'All zones drained to 10 % (bulk loss of regulation)', 'Zone control', p => zl(p, () => 0.1));
  add('lz1', 'All zones filled to 90 %', 'Zone control', p => zl(p, () => 0.9));
  add('tss', 'Side-to-side tilt (left zones 15 %, right 85 %)', 'Zone control', p => zl(p, f => f < 2 ? 0.15 : f > 4 ? 0.85 : 0.5));
  add('ttb', 'Top-to-bottom tilt (upper zones 15 %, lower 85 %)', 'Zone control', p => zl(p, f => (f === 0 || f === 2 || f === 5) ? 0.15 : (f === 1 || f === 4 || f === 6) ? 0.85 : 0.5));
  add('tfb', 'End-to-end axial tilt (front zones 15 %, back 85 %)', 'Zone control', p => zl(p, (f, h) => h ? 0.85 : 0.15));
  add('zc', 'Centre zones drained (zones 4 and 11 empty)', 'Zone control', p => zl(p, f => f === 3 ? 0 : 0.5));
  add('zo', 'One outer zone drained (zone 1 empty)', 'Zone control', p => zl(p, (f, h) => (f === 0 && !h) ? 0 : 0.5));
  add('a1', 'Adjuster bank 1 withdrawn', 'Adjusters', p => bank(p, [0]));
  add('a3', 'Adjuster banks 1-3 withdrawn', 'Adjusters', p => bank(p, [0, 1, 2]));
  add('a7', 'All adjusters withdrawn (xenon override)', 'Adjusters', p => bank(p, [0, 1, 2, 3, 4, 5, 6]));
  add('ar', 'One outer adjuster rod stuck out', 'Adjusters', p => { p.adj[0] = 0; });
  add('m1', 'MCA bank 1 half inserted', 'Absorbers', p => { p.mca[0] = 0.5; p.mca[1] = 0.5; });
  add('m2', 'All MCAs fully inserted', 'Absorbers', p => { p.mca.fill(1); });
  if (cur) L.push({ id: 'cur', name: 'Current device / target configuration (Flux lab)', group: 'User', pos: CORE.clonePos(cur) });
  return L;
};
// required trip setpoint: for every flux shape the reactor must trip (2-out-of-3 logic channels)
// before the first channel reaches its critical channel power.
ROP.evaluate = function (shapeFlux, nomFlux, th, ccpNom, opt) {
  const nC = CORE.ch.length, eps = opt.unc, rows = [];
  const dets = opt.sds === 2 ? CORE.det2 : CORE.det1, key = opt.sds === 2 ? 'det2' : 'det1';
  const names = opt.sds === 2 ? 'GHJ' : 'DEF';
  shapeFlux.forEach(sf => {
    const f = sf.flux;
    // limiting channel with nominal-shape CCP, then refine the candidates with the perturbed axial shape
    const cand = [];
    for (let c = 0; c < nC; c++) cand.push([c, ccpNom[c] / (f.chRel[c] * K.chAvgMW)]);
    cand.sort((a, b) => a[1] - b[1]);
    const top = cand.slice(0, 10).map(v => v[0]);
    const ccpK = PL.ccp(th, f, top);
    let r = 1e9, lim = 0;
    top.forEach(c => { const v = ccpK[c] / (f.chRel[c] * K.chAvgMW); if (v < r) { r = v; lim = c; } });
    const mx = { [names[0]]: 0, [names[1]]: 0, [names[2]]: 0 }, who = {};
    dets.forEach((d, i) => { const ratio = f[key][i] / nomFlux[key][i]; if (ratio > mx[d.logic]) { mx[d.logic] = ratio; who[d.logic] = d.n; } });
    const sorted = Object.keys(mx).sort((a, b) => mx[b] - mx[a]);
    const m = mx[sorted[1]];
    rows.push({ id: sf.id, name: sf.name, group: sf.group, r, lim, m, tsp: r * m / (1 + eps), logic: sorted[1], det: who[sorted[1]], rho: f.rho, maxCh: f.maxCh });
  });
  let tsp = 1e9, limRow = null;
  rows.forEach(rw => { if (rw.tsp < tsp) { tsp = rw.tsp; limRow = rw; } });
  return { rows, tsp, lim: limRow };
};

/* ------------------------------------------------------------------ point-kinetics plant simulator */
const BETA = [0.000295, 0.001165, 0.001033, 0.002351, 0.000782, 0.000197];
const LAM = [0.0124, 0.0305, 0.111, 0.301, 1.14, 3.01];
const BTOT = BETA.reduce((a, b) => a + b, 0);
const DH_A = [0.017, 0.016, 0.012, 0.008, 0.007, 0.004], DH_T = [5, 50, 600, 8000, 1.5e5, 4e6];
const DHTOT = DH_A.reduce((a, b) => a + b, 0);
P.kin = { BETA, LAM, BTOT, LAMBDA: 9e-4, DH_A, DH_T };

class Sim {
  constructor() {
    this.par = {
      lambda: 9e-4, Tf0: 690, Tc0: 288, tauF: 7, aFuel: -0.004, aCool: 0.035, voidFull: 12, aMod: 0.08,
      xeEq: -28, sigPhi: 2.3e-4, lamI: 2.92e-5, lamX: 2.10e-5, gI: 0.933,
      lzcWorth: 7, adjWorth: 15, mcaWorth: 10, sorWorth: 80, lissWorth: 320,
      tsp1: 1.22, tsp2: 1.22, cppf: 1.08, logRate1: 0.10, logRate2: 0.15, hiP1: 10.45, hiP2: 11.6, loP1: 8.7, loP2: 8.4,
      loFlow1: 0.80, loFlow2: 0.74, sgLvl1: 0.55, sgLvl2: 0.50, rbP: 3.45, modT1: 87,
      pumpTau: 14, swell: 0.08, sgTau: 150, loopTau: 8,
      sds1Avail: true, sds2Avail: true, eccAvail: true, stepback: true, rrsAuto: true, sorMissing: 2
    };
    this.reset();
  }
  reset(power) {
    const s = this, p = s.par, n0 = power == null ? 1 : power;
    s.t = 0; s.n = n0; s.C = BETA.map((b, i) => b * n0 / (LAM[i] * p.lambda)); s.dh = DH_A.map(a => a * n0);
    s.Tin = 266; s.P = 9.99; s.flow = 1; s.pumpsOn = true; s.tPump = 0;
    s.Tf = 288 + (p.Tf0 - p.Tc0) * n0; s.hOut = hL(266) + K.dhDesign * n0; s.Tout = 310; s.Tc = 288; s.TcPrev = 288;
    s.x = 1; s.io = 1; if (n0 < 1) { s.io = n0; s.x = this.xeEqAt(n0); }
    s.lzc = 0.5; s.adjIn = 1; s.mca = 0; s.sor = 0; s.liss = 0; s.rhoExt = 0; s.rhoExtTarget = 0; s.rhoExtRate = 0;
    s.boron = 0; s.modT = 69; s.modCool = 1; s.setpoint = n0; s.spEff = n0; s.spTarget = n0; s.spRate = 0.005;
    s.rrsOK = true; s.lzcDrain = 0; s.steamP = 4.69; s.steamPTarget = 4.69; s.feed = 1; s.sgInv = 1; s.auxFW = true;
    s.loca = null; s.rb = 0; s.ecc = 0; s.eccT = -1; s.eccSig = false; s.feedLostT = 0; s.pth = n0; s.alpha = 0; s.alpha0 = null; s.cpr = 1.33; s.dry = false; s.tDry = 0;
    s.sds1 = { fired: false, t: 0, cause: '' }; s.sds2 = { fired: false, t: 0, cause: '' }; s.stepbackT = -1; s.sbActive = false;
    s.logRate = 0; s.qs = true; s.rho = 0; s.rc = { dev: 0, fb: 0, xe: 0, sd: 0, ext: 0 }; s.Tsh = 325; s.qmod = 0; s.ptContact = false;
    s.log = []; s.hist = { t: [], n: [], pth: [], rho: [], rdev: [], rfb: [], rxe: [], rsd: [], Tf: [], Tsh: [], Tin: [], Tout: [], P: [], flow: [], lzc: [], adj: [], mca: [], sor: [], xe: [], sg: [], rb: [], void: [], cpr: [], modT: [] };
    s.hNext = 0; s.hDt = 0.05; s.bias = 0;
    s.computeFeedback(); s.alpha = s.alphaBoil; s.alpha0 = s.alpha;
    // bias so the initial state is exactly critical
    s.bias = -s.reactivity();
    s.record();
  }
  xeEqAt(n) { const p = this.par; return (p.lamX + p.sigPhi) * n / (p.lamX + p.sigPhi * n); }
  event(msg, cls) { this.log.push({ t: this.t, msg, cls: cls || '' }); }
  computeFeedback() {
    const s = this, p = s.par;
    const ts = tsat(clamp(s.P, 0.2, 14)), xo = (s.hOut - hL(ts)) / hfg(s.P);
    s.Tout = xo < 0 ? TfromH(s.hOut) : ts; s.xOut = xo;
    s.Tc = 0.5 * (s.Tin + s.Tout);
    let a = 0;
    if (xo > 0) {
      const dh = Math.max(20, s.hOut - hL(s.Tin)), lb = clamp(xo * hfg(s.P) / dh, 0, 1), xm = Math.min(0.99, xo / 2);
      a = lb / (1 + (1 - xm) / xm * rhoG(s.P) / rhoL(ts) * 1.5);
    }
    s.alphaBoil = a;
  }
  reactivity() {
    const s = this, p = s.par;
    const sorFrac = s.sor <= 0 ? 0 : Math.pow(Math.sin(0.5 * Math.PI * clamp(s.sor, 0, 1)), 2);
    const sorW = p.sorWorth * (28 - p.sorMissing * (p.sorMissing > 0 ? 1.7 : 0)) / 28;
    const dev = -p.lzcWorth * (s.lzc - 0.5) + p.adjWorth * (1 - s.adjIn) - p.mcaWorth * s.mca;
    const sd = -sorW * sorFrac - p.lissWorth * s.liss;
    const fb = p.aFuel * (s.Tf - p.Tf0) + p.aCool * (s.Tc - p.Tc0) + p.voidFull * (s.alpha - (s.alpha0 || 0)) + p.aMod * (s.modT - 69);
    const xe = p.xeEq * (s.x - 1);
    const ext = s.rhoExt - 8 * s.boron;
    s.rc = { dev, fb, xe, sd, ext };
    return dev + sd + fb + xe + ext + s.bias;
  }
  trip(which, cause) {
    const s = this, sd = which === 1 ? s.sds1 : s.sds2;
    if (sd.fired) return;
    if (which === 1 && !s.par.sds1Avail) return;
    if (which === 2 && !s.par.sds2Avail) return;
    sd.fired = true; sd.t = s.t; sd.cause = cause;
    s.event('SDS' + which + ' TRIP — ' + cause, 'trip');
  }
  step(dt) {
    const s = this, p = s.par;
    s.t += dt;
    const tripped = s.sds1.fired || s.sds2.fired;
    // ---- pumps / flow
    if (!s.pumpsOn) { s.tPump += dt; s.flow = Math.max(0.035, 1 / (1 + s.tPump / p.pumpTau)); }
    else s.flow += (1 - s.flow) * Math.min(1, dt / 3);
    // ---- LOCA forcing
    let aLoca = 0, cool = Math.pow(Math.max(s.flow, 0.03), 0.8);
    if (s.loca) {
      const b = s.loca.size, tl = s.t - s.loca.t0;
      aLoca = 0.5 * Math.min(1, 2.2 * Math.pow(b, 0.7)) * (1 - Math.exp(-tl * Math.max(b, 0.02) / 0.6));
      const ps = psat(Math.min(s.Tc, 330));
      s.P += dt * (-(s.P > ps ? 3.0 * b : 0.3 * b) * Math.max(s.P - 0.12, 0) / 10 * (b < 0.02 ? 0.3 : 1));
      s.rb += dt * (b * 30 * s.P / 10 - s.rb / (s.rb > 14 ? 25 : 90)); s.rb = Math.min(s.rb, 118);
      if (!s.eccSig && s.P < 5.25 && s.rb > 3.45) { s.eccSig = true; s.event('LOCA signal: low PHT pressure + high reactor-building pressure → ECC initiated, loops isolated, SG crash cool-down', 'ecc'); }
      if (s.eccSig && p.eccAvail && s.P < 4.14) { if (s.eccT < 0) { s.eccT = s.t; s.event('High-pressure ECC injection begins (gas-driven water tanks, PHT < 4.14 MPa)', 'ecc'); } s.ecc = Math.min(1, s.ecc + dt / 8); }
      cool *= clamp(1 - 0.985 * Math.min(1, 1.6 * b) * (1 - Math.exp(-tl / 2)) + 0.55 * s.ecc, 0.01, 1);
    } else {
      s.rb = Math.max(0, s.rb - dt * s.rb / 60);
    }
    // ---- shutdown system actuation
    if (s.sds1.fired) { const te = s.t - s.sds1.t - 0.15; if (te > 0) s.sor = Math.min(1, te / 1.8); }
    if (s.sds2.fired) { const te = s.t - s.sds2.t - 0.3; if (te > 0) s.liss = Math.max(s.liss, 1 - Math.exp(-te / 1.0)); }
    // ---- external reactivity ramp (targets, refuelling, user)
    if (s.rhoExt !== s.rhoExtTarget) { const d = s.rhoExtTarget - s.rhoExt, m = s.rhoExtRate * dt; s.rhoExt += Math.abs(d) <= m ? d : Math.sign(d) * m; }
    if (s.steamP !== s.steamPTarget) s.steamP += (s.steamPTarget - s.steamP) * Math.min(1, dt / 4);
    // ---- moderator temperature (loss of moderator cooling raises it)
    const modQ = 0.05 * s.pth0() + s.qmod;
    s.modT += dt * (modQ / 0.05 - s.modCool * (s.modT - 45) / 24) * 24 / 300;
    s.modT = Math.min(s.modT, 108);
    // ---- regulating system
    if (!tripped) {
      if (s.setpoint !== s.spTarget) { const d = s.spTarget - s.setpoint, m = s.spRate * dt; s.setpoint += Math.abs(d) <= m ? d : Math.sign(d) * m; }
      // demanded power cannot run away from actual power: recovery is rate-limited to 0.4 %FP/s
      if (s.n < s.spEff - 0.03 && s.lzc < 0.02) s.spEff = s.n + 0.03;
      s.spEff = s.spEff > s.setpoint ? s.setpoint : Math.min(s.setpoint, s.spEff + 0.004 * dt);
      if (s.lzcDrain) s.lzc = clamp(s.lzc - s.lzcDrain * dt / p.lzcWorth, 0, 1);
      else if (p.rrsAuto && s.rrsOK) {
        if (dt >= 0.1) {
          // quasi-static controller for fast-forward: zones take whatever level balances reactivity
          const need = 0.5 + (s.reactivity() + p.lzcWorth * (s.lzc - 0.5)) / p.lzcWorth;
          s.lzc = clamp(need, 0, 1); s.qs = need > 0.001 && need < 0.999;
        } else {
          const e = (s.n - s.spEff) / Math.max(0.05, s.spEff);
          s.lzc = clamp(s.lzc + clamp(1.5 * e + 0.6 * s.logRate, -0.02, 0.02) * dt, 0, 1);
        }
        const rate = dt / 60 / 7 * (dt >= 0.1 ? 3 : 1);
        if (s.lzc < 0.2 && s.adjIn > 0) s.adjIn = Math.max(0, s.adjIn - rate);
        else if (s.lzc > 0.7 && s.adjIn < 1 && s.mca <= 0) s.adjIn = Math.min(1, s.adjIn + rate);
        if (!s.sbActive) {
          if (s.lzc > 0.85 && s.adjIn >= 1) s.mca = Math.min(1, s.mca + dt / 150);
          else if (s.lzc < 0.45 && s.mca > 0) s.mca = Math.max(0, s.mca - dt / 150);
        }
      }
      if (p.stepback && p.rrsAuto && s.rrsOK && !s.sbActive && (s.stepbackT < 0 || s.t - s.stepbackT > 60) && s.n > 0.62) {
        let why = '';
        if (!s.pumpsOn) why = 'heat-transport pump trip';
        else if (s.n > 1.13 && s.logRate > 0.02) why = 'high neutron power';
        else if (s.logRate > 0.07) why = 'high log rate';
        if (why) { s.stepbackT = s.t; s.sbActive = true; s.spTarget = Math.min(s.spTarget, 0.6); s.setpoint = Math.min(s.setpoint, 0.6); s.spEff = Math.min(s.spEff, 0.6); s.event('RRS STEPBACK — ' + why + ' (MCAs dropped)', 'warn'); }
      }
      if (s.sbActive) { s.mca = Math.min(1, s.mca + dt / 3); if (s.n <= 0.61 || s.mca >= 1) s.sbActive = false; }
    }
    // ---- reactivity + kinetics (implicit Euler, stable for large dt)
    s.alpha = Math.max(s.alphaBoil, aLoca);
    const rho = s.reactivity() * 1e-3; s.rho = rho * 1e3;
    let num = s.n, den = 1 - dt * (rho - BTOT) / p.lambda;
    for (let i = 0; i < 6; i++) { const g = 1 / (1 + dt * LAM[i]); num += dt * LAM[i] * s.C[i] * g; den -= dt * LAM[i] * dt * BETA[i] / p.lambda * g; }
    const src = 1e-9;
    let nNew = den > 1e-6 ? (num + dt * src) / den : s.n * Math.exp(dt * (rho - BTOT) / p.lambda);
    if (!(nNew > 1e-12)) nNew = 1e-12;
    // fast-forward with a healthy regulating system: power simply tracks the setpoint
    const quasi = dt >= 0.1 && !tripped && p.rrsAuto && s.rrsOK && !s.lzcDrain && s.qs;
    if (quasi) nNew = s.n + (s.spEff - s.n) * Math.min(1, dt / 4);
    for (let i = 0; i < 6; i++) s.C[i] = quasi ? BETA[i] * nNew / (LAM[i] * p.lambda) : (s.C[i] + dt * BETA[i] / p.lambda * nNew) / (1 + dt * LAM[i]);
    const lr = Math.log(nNew / s.n) / dt;
    s.logRate += (lr - s.logRate) * Math.min(1, dt / 0.15);
    s.n = nNew;
    // ---- decay heat and fuel
    let pd = 0;
    for (let i = 0; i < 6; i++) { s.dh[i] += dt * (DH_A[i] * s.n - s.dh[i]) / (DH_T[i] + dt); pd += s.dh[i]; }
    s.pth = s.n * (1 - DHTOT) + pd;
    const dT0 = p.Tf0 - p.Tc0;
    if (s.dry) cool *= 0.35;
    let qc = cool * (s.Tf - s.Tc) / dT0;
    // pressure-tube ballooning into the calandria tube: moderator becomes the heat sink
    s.qmod = 0;
    if (s.Tf > 950 && cool < 0.3) { s.ptContact = true; }
    if (s.ptContact && s.Tf > 600) s.qmod = 0.02 * (s.Tf - s.modT) / 900;
    s.Tf += dt * (s.pth - qc - s.qmod) * dT0 / p.tauF;
    s.Tf = clamp(s.Tf, 40, 2840);
    // ---- coolant + steam generators
    const fl = Math.max(s.flow, 0.03);
    const hIn = hL(s.Tin), hT = hIn + K.dhDesign * qc / fl;
    s.hOut += (hT - s.hOut) * Math.min(1, dt * fl / 0.8);
    s.TcPrev = s.Tc;
    s.computeFeedback();
    const Ts = tsatH2O(clamp(s.steamP, 0.11, 8));
    const lvl = clamp(s.sgInv / 0.25, 0, 1);
    const ntu = Math.min(9, 2.12 * lvl * Math.pow(fl, -0.5));
    const hRet = s.loca && s.loca.size > 0.05 ? hIn : s.hOut;
    const TinT = Ts + (s.Tout - Ts) * Math.exp(-ntu);
    s.Tin += (TinT - s.Tin) * Math.min(1, dt * fl / p.loopTau);
    s.qsg = Math.max(0, fl * (hRet - hL(TinT)) / K.dhDesign);
    let feed = s.feed > 0 ? s.qsg + 0.2 * (1 - s.sgInv) : (s.auxFW && s.t - s.feedLostT > 180 ? 0.04 : 0);
    s.sgInv = clamp(s.sgInv + dt * (feed - s.qsg) / p.sgTau, 0, 1.1);
    // ---- PHT pressure
    if (!s.loca || s.loca.size < 0.005) {
      s.P += p.swell * (s.Tc - s.TcPrev) - (s.P - 9.99) * Math.min(1, dt / 12);
      if (s.P > 10.6) s.P -= (s.P - 10.6) * Math.min(1, dt / 0.6);
    }
    s.P = clamp(s.P, 0.11, 14);
    // ---- dryout indicator (critical power ratio of the limiting channel)
    s.cpr = 1.33 * Math.pow(fl, 0.75) * (1 - 0.012 * (s.Tin - 266)) * (1 - 0.9 * Math.max(0, aLoca)) * clamp(1 - 0.04 * (s.P - 9.99), 0.6, 1.3) / Math.max(1e-4, (s.Tf - s.Tc) / dT0);
    const dryNow = s.cpr < 1 && s.pth > 0.02;
    if (dryNow && !s.dry) { s.event('Fuel DRYOUT in limiting channel (critical power ratio < 1)', 'bad'); }
    s.dry = dryNow; if (dryNow) s.tDry += dt;
    const tsNow = tsat(s.P);
    s.Tsh = s.dry || cool < 0.3 ? Math.min(s.Tf, Math.max(tsNow + 20, s.Tc + (s.Tf - s.Tc) * (1 - 0.5 * cool))) : Math.max(s.Tc, tsNow) + 14 * qc;
    // ---- xenon / iodine
    s.io += dt * p.lamI * (s.n - s.io);
    s.x += dt * ((p.lamX + p.sigPhi) * ((1 - p.gI) * s.n + p.gI * s.io) - p.lamX * s.x - p.sigPhi * s.n * s.x);
    // ---- trip parameters
    const det = s.n * p.cppf, hiPow = s.n > 0.05;
    if (det > p.tsp1) s.trip(1, 'high neutron power (ROP) ' + (det * 100).toFixed(0) + ' %');
    if (det > p.tsp2) s.trip(2, 'high neutron power (ROP) ' + (det * 100).toFixed(0) + ' %');
    if (dt < 0.1 && s.n > 1e-4) { if (s.logRate > p.logRate1) s.trip(1, 'high rate of log neutron power'); if (s.logRate > p.logRate2) s.trip(2, 'high rate of log neutron power'); }
    if (s.P > p.hiP1) s.trip(1, 'high heat-transport pressure'); if (s.P > p.hiP2) s.trip(2, 'high heat-transport pressure');
    if (hiPow && s.P < p.loP1) s.trip(1, 'low heat-transport pressure'); if (hiPow && s.P < p.loP2) s.trip(2, 'low heat-transport pressure');
    if (hiPow && s.flow < p.loFlow1) s.trip(1, 'low heat-transport flow'); if (hiPow && s.flow < p.loFlow2) s.trip(2, 'low core differential pressure');
    if (hiPow && s.sgInv < p.sgLvl1) s.trip(1, 'low steam-generator level'); if (hiPow && s.sgInv < p.sgLvl2) s.trip(2, 'low steam-generator level');
    if (s.rb > p.rbP) { s.trip(1, 'high reactor-building pressure'); s.trip(2, 'high reactor-building pressure'); }
    if (s.modT > p.modT1) s.trip(1, 'high moderator temperature');
    if (s.t >= s.hNext) { s.record(); s.hNext = s.t + s.hDt; }
  }
  pth0() { return this.pth == null ? this.n : this.pth; }
  record() {
    const s = this, h = s.hist;
    h.t.push(s.t); h.n.push(s.n * 100); h.pth.push((s.pth == null ? s.n : s.pth) * 100); h.rho.push(s.rho);
    h.rdev.push(s.rc.dev); h.rfb.push(s.rc.fb); h.rxe.push(s.rc.xe); h.rsd.push(Math.max(-30, s.rc.sd)); h.Tf.push(s.Tf); h.Tsh.push(s.Tsh);
    h.Tin.push(s.Tin); h.Tout.push(s.Tout); h.P.push(s.P); h.flow.push(s.flow * 100); h.lzc.push(s.lzc * 100); h.adj.push(s.adjIn * 100);
    h.mca.push(s.mca * 100); h.sor.push(s.sor * 100); h.xe.push(s.par.xeEq * s.x); h.sg.push(s.sgInv * 100); h.rb.push(s.rb); h.void.push(s.alpha * 100); h.cpr.push(Math.min(3, s.cpr)); h.modT.push(s.modT);
    if (h.t.length > 2400) { for (const k in h) { const a = h[k], o = []; for (let i = 0; i < a.length; i += 2) o.push(a[i]); h[k] = o; } s.hDt *= 2; }
  }
  // advance by a wall-clock interval at a given speed-up
  advance(dtReal, speed) {
    const span = dtReal * speed;
    const dt = speed <= 2 ? 0.002 : speed <= 20 ? 0.01 : speed <= 200 ? 0.1 : speed <= 2000 ? 1 : 5;
    const n = Math.max(1, Math.min(4000, Math.round(span / dt)));
    for (let i = 0; i < n; i++) this.step(dt);
  }
  // ---- operator / scenario actions
  act(name, v) {
    const s = this;
    switch (name) {
      case 'sds1': s.trip(1, 'manual'); break;
      case 'sds2': s.trip(2, 'manual'); break;
      case 'setpoint': s.spTarget = v.power; s.spRate = v.rate || 0.005; s.event('Power setpoint → ' + (v.power * 100).toFixed(0) + ' % FP at ' + ((v.rate || 0.005) * 100).toFixed(1) + ' %/s'); break;
      case 'lor': s.rrsOK = false; s.lzcDrain = v.rate; s.event('LOSS OF REGULATION: zone controllers draining, +' + v.rate.toFixed(2) + ' mk/s', 'warn'); break;
      case 'loca': s.loca = { size: v.size, t0: s.t }; s.event('LOCA: inlet-header break, ' + (v.size * 100).toFixed(0) + ' % of 2×header area', 'bad'); break;
      case 'pumps': s.pumpsOn = false; s.tPump = 0; s.feed = 0; s.feedLostT = s.t; s.event('Loss of Class IV power: all 4 HT pumps and main feedwater pumps trip', 'warn'); break;
      case 'feed': s.feed = 0; s.feedLostT = s.t; s.event('Loss of main feedwater to all steam generators', 'warn'); break;
      case 'ext': s.rhoExtTarget = s.rhoExt + v.mk; s.rhoExtRate = Math.abs(v.mk) / Math.max(0.1, v.time || 5); s.event((v.label || 'External reactivity') + ': ' + (v.mk > 0 ? '+' : '') + v.mk.toFixed(2) + ' mk over ' + (v.time || 5) + ' s'); break;
      case 'adjOut': s.adjIn = Math.max(0, s.adjIn - v.banks / 7); s.event(v.banks + ' adjuster bank(s) withdrawn'); break;
      case 'msb': s.steamPTarget = 0.6; s.event('Main steam line break: secondary side depressurises', 'bad'); break;
      case 'modcool': s.modCool = 0; s.event('Loss of moderator cooling (both heat exchangers lost)', 'warn'); break;
      case 'boron': s.boron += v.ppm; s.event('Moderator poison addition: ' + v.ppm.toFixed(2) + ' ppm boron'); break;
    }
  }
}
P.Sim = Sim;

/* ------------------------------------------------------------------ initialisation */
P.init = function () {
  CORE.build();
  CORE.kRef = 0;
  const nom = CORE.solve(CORE.refPos(), { cold: true, tol: 1e-5 });
  CORE.kRef = nom.k; nom.rho = 0; CORE.nominal = nom;
  PL.design(nom);
  return nom;
};
})(typeof window !== 'undefined' ? window : globalThis);
