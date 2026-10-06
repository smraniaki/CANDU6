/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
/* UI helpers: DOM, controls, canvas line chart and the 380-channel core-face map. */
(function () {
'use strict';
const C = window.CANDU, U = C.ui = {}, P = C.phys;

U.$ = (s, r) => (r || document).querySelector(s);
U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
U.el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
U.f = (v, d) => (v == null || !isFinite(v)) ? '–' : v.toFixed(d == null ? 1 : d);
U.esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
U.later = fn => setTimeout(fn, 20);
U.css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const tipEl = () => document.getElementById('tip');
U.tip = {
  show(html, x, y) { const t = tipEl(); t.innerHTML = html; t.style.display = 'block'; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px'; t.style.top = Math.max(6, Math.min(window.innerHeight - h - 8, y + 14)) + 'px'; },
  hide() { tipEl().style.display = 'none'; }
};

/* ---- controls */
U.slider = function (host, o) {
  const dec = o.dec == null ? (o.step && o.step < 1 ? (o.step < 0.1 ? 2 : 1) : 0) : o.dec;
  const el = U.el(`<label class="ctl"><span class="l">${o.label}</span><output></output><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}"></label>`);
  const inp = el.querySelector('input'), out = el.querySelector('output');
  const show = () => { out.textContent = (o.fmt ? o.fmt(+inp.value) : (+inp.value).toFixed(dec)) + (o.unit ? ' ' + o.unit : ''); };
  inp.addEventListener('input', () => { show(); if (o.on) o.on(+inp.value); });
  if (o.title) el.title = o.title;
  show(); host.appendChild(el);
  return { el, get value() { return +inp.value; }, set(v) { inp.value = v; show(); } };
};
U.seg = function (host, opts, value, on) {
  const el = U.el('<div class="seg" role="group"></div>');
  const api = { el, value, set(v) { api.value = v; U.$$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); } };
  opts.forEach(o => { const b = U.el(`<button type="button" data-v="${o[0]}">${o[1]}</button>`); b.addEventListener('click', () => { api.set(o[0]); on(o[0]); }); el.appendChild(b); });
  api.set(value); host.appendChild(el);
  return api;
};
U.check = function (host, label, value, on) {
  const el = U.el(`<label class="chk"><input type="checkbox" ${value ? 'checked' : ''}> ${label}</label>`);
  const inp = el.querySelector('input'); inp.addEventListener('change', () => on(inp.checked)); host.appendChild(el);
  return { el, get value() { return inp.checked; }, set(v) { inp.checked = v; } };
};
U.kpis = function (host, list) {
  host.innerHTML = list.map(k => `<div class="kpi ${k[3] || ''}" ${k[4] ? `title="${U.esc(k[4])}"` : ''}><span>${k[0]}</span><b>${k[1]}<small>${k[2] || ''}</small></b></div>`).join('');
};
U.spec = rows => `<table class="tbl spec">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;

/* ---- colour maps */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const MAPS = {
  heat: ['#1b2a63', '#2b6fd6', '#23b6c9', '#4fd08a', '#d7e04a', '#ffad3b', '#f2543d', '#b3162f'].map(hex),
  div: ['#2f6fe4', '#5f95e8', '#586273', '#e8805f', '#e43f3f'].map(hex),
  cool: ['#0d2038', '#16508a', '#2b8fd0', '#6fd3f0', '#e6fbff'].map(hex),
  margin: ['#b3162f', '#f2543d', '#ffad3b', '#d7e04a', '#4fd08a', '#23b6c9', '#2b6fd6'].map(hex)
};
U.cmap = function (name) {
  const st = MAPS[name] || MAPS.heat, n = st.length - 1;
  return t => { t = t < 0 ? 0 : t > 1 ? 1 : (isFinite(t) ? t : 0); const i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i, a = st[i], b = st[i + 1];
    return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`; };
};
U.COL = ['#4cc2ff', '#ff6b5e', '#7ee0c3', '#ffb454', '#b99cff', '#f472b6', '#a3e635', '#e2e8f0'];

function fit(canvas) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
U.fit = fit;
function nice(lo, hi, n) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
  const st = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, t = [];
  for (let v = a; v <= b + st * 0.5; v += st) t.push(Math.abs(v) < st * 1e-9 ? 0 : v);
  return { lo: a, hi: b, ticks: t, step: st };
}
const tickFmt = (v, st) => { const d = st >= 1 ? 0 : st >= 0.1 ? 1 : st >= 0.01 ? 2 : 3; return Math.abs(v) >= 1e5 ? v.toExponential(0) : v.toFixed(d); };

/* ---- line chart */
class Chart {
  constructor(canvas) {
    this.c = canvas; this.cfg = null;
    new ResizeObserver(() => this.render()).observe(canvas);
    canvas.addEventListener('mousemove', e => this.hover(e));
    canvas.addEventListener('mouseleave', () => { this.hx = null; U.tip.hide(); this.render(); });
  }
  draw(cfg) { this.cfg = cfg; this.render(); }
  render() {
    const cfg = this.cfg; if (!cfg) return;
    const g = fit(this.c); if (!g) return;
    const { ctx, w, h } = g;
    const has2 = cfg.series.some(s => s.axis === 'r');
    const m = { l: 48, r: has2 ? 46 : 12, t: 24, b: cfg.xLabel ? 32 : 20 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const xs = s => s.x || cfg.x;
    let x0 = cfg.xMin, x1 = cfg.xMax;
    if (x0 == null || x1 == null) { let a = Infinity, b = -Infinity; cfg.series.forEach(s => { const X = xs(s); if (X.length) { a = Math.min(a, X[0]); b = Math.max(b, X[X.length - 1]); } }); if (x0 == null) x0 = a; if (x1 == null) x1 = b; }
    if (!(x1 > x0)) x1 = x0 + 1;
    const range = (ax, lo, hi) => {
      let a = Infinity, b = -Infinity;
      cfg.series.forEach(s => { if ((s.axis || 'l') !== ax) return; for (let i = 0; i < s.y.length; i++) { let v = s.y[i]; if (!isFinite(v)) continue; if (cfg.logY && ax === 'l') { if (v <= 0) continue; v = Math.log10(v); } if (v < a) a = v; if (v > b) b = v; } });
      (cfg.hlines || []).forEach(l => { if ((l.axis || 'l') === ax && l.fit !== false) { a = Math.min(a, l.y); b = Math.max(b, l.y); } });
      if (!isFinite(a)) { a = 0; b = 1; }
      if (b - a < 1e-9) { a -= 0.5; b += 0.5; }
      const ms = ax === 'l' ? cfg.minSpan : cfg.minSpan2;
      if (ms && b - a < ms) { const mid = (a + b) / 2; a = mid - ms / 2; b = mid + ms / 2; }
      const pad = (b - a) * 0.06; a -= pad; b += pad;
      if (lo != null) a = cfg.logY && ax === 'l' ? Math.log10(lo) : lo; if (hi != null) b = cfg.logY && ax === 'l' ? Math.log10(hi) : hi;
      return nice(a, b, Math.max(3, Math.round(ph / 42)));
    };
    const yl = range('l', cfg.yMin, cfg.yMax), yr = has2 ? range('r', cfg.y2Min, cfg.y2Max) : null;
    const xt = nice(x0, x1, Math.max(3, Math.round(pw / 80)));
    const X = v => m.l + (v - x0) / (x1 - x0) * pw;
    const Y = (v, ax) => { const r = ax === 'r' ? yr : yl; if (cfg.logY && ax !== 'r') v = v > 0 ? Math.log10(v) : r.lo; return m.t + ph - (v - r.lo) / (r.hi - r.lo) * ph; };
    this.geo = { m, pw, ph, x0, x1, X };
    ctx.font = '11px "Segoe UI", sans-serif'; ctx.lineWidth = 1;
    // grid + axes
    ctx.strokeStyle = '#2c3746'; ctx.fillStyle = '#93a1b5'; ctx.textBaseline = 'middle';
    yl.ticks.forEach(t => { const y = Y(cfg.logY ? Math.pow(10, t) : t, 'l'); if (y < m.t - 1 || y > m.t + ph + 1) return; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(cfg.logY ? '1e' + t.toFixed(0) : tickFmt(t, yl.step), m.l - 6, y); });
    if (yr) yr.ticks.forEach(t => { const y = Y(t, 'r'); if (y < m.t - 1 || y > m.t + ph + 1) return; ctx.textAlign = 'left'; ctx.fillText(tickFmt(t, yr.step), m.l + pw + 6, y); });
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    xt.ticks.forEach(t => { if (t < x0 - 1e-9 || t > x1 + 1e-9) return; const x = X(t); ctx.beginPath(); ctx.moveTo(x, m.t + ph); ctx.lineTo(x, m.t + ph + 4); ctx.stroke(); ctx.fillText(tickFmt(t, xt.step), x, m.t + ph + 6); });
    ctx.strokeStyle = '#3a475a'; ctx.strokeRect(m.l, m.t, pw, ph);
    if (cfg.xLabel) ctx.fillText(cfg.xLabel, m.l + pw / 2, h - 13);
    ctx.save(); ctx.translate(11, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; if (cfg.yLabel) ctx.fillText(cfg.yLabel, 0, 0); ctx.restore();
    if (yr && cfg.y2Label) { ctx.save(); ctx.translate(w - 9, m.t + ph / 2); ctx.rotate(Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(cfg.y2Label, 0, 0); ctx.restore(); }
    // bands, reference lines
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    (cfg.bands || []).forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(X(b.x0), m.t, X(b.x1) - X(b.x0), ph); });
    (cfg.hlines || []).forEach(l => { const y = Y(l.y, l.axis || 'l'); ctx.strokeStyle = l.color || '#ffb454'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || '#ffb454'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(l.label, m.l + pw - 4, y - 2); } });
    (cfg.vlines || []).forEach(l => { const x = X(l.x); ctx.strokeStyle = l.color || '#ffb454'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || '#ffb454'; ctx.textAlign = x > m.l + pw - 70 ? 'right' : 'left'; ctx.textBaseline = 'top'; ctx.fillText(l.label, x + (x > m.l + pw - 70 ? -4 : 4), m.t + 3); } });
    // series
    cfg.series.forEach((s, k) => {
      const xa = xs(s), col = s.color || U.COL[k % U.COL.length];
      ctx.strokeStyle = col; ctx.lineWidth = s.width || 1.8; ctx.setLineDash(s.dash || []); ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.y.length; i++) {
        const v = s.y[i]; if (!isFinite(v) || (cfg.logY && s.axis !== 'r' && v <= 0)) { pen = false; continue; }
        const x = X(xa[i]), y = Y(v, s.axis);
        if (!pen) { ctx.moveTo(x, y); pen = true; } else if (s.step) { ctx.lineTo(x, ctx._py); ctx.lineTo(x, y); } else ctx.lineTo(x, y);
        ctx._py = y;
      }
      ctx.stroke(); ctx.setLineDash([]);
      if (s.dots) { ctx.fillStyle = col; for (let i = 0; i < s.y.length; i++) { if (!isFinite(s.y[i])) continue; ctx.beginPath(); ctx.arc(X(xa[i]), Y(s.y[i], s.axis), 2.6, 0, 7); ctx.fill(); } }
    });
    if (this.hx != null) { ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(this.hx), m.t); ctx.lineTo(X(this.hx), m.t + ph); ctx.stroke(); }
    ctx.restore();
    // legend
    let lx = m.l + 2; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = '11px "Segoe UI", sans-serif';
    cfg.series.forEach((s, k) => {
      if (!s.name) return;
      const col = s.color || U.COL[k % U.COL.length], tw = ctx.measureText(s.name).width;
      if (lx + tw + 26 > w) return;
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, 11); ctx.lineTo(lx + 14, 11); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#c5d0df'; ctx.fillText(s.name, lx + 18, 11); lx += tw + 32;
    });
  }
  hover(e) {
    const cfg = this.cfg, g = this.geo; if (!cfg || !g) return;
    const r = this.c.getBoundingClientRect(), px = e.clientX - r.left;
    if (px < g.m.l || px > g.m.l + g.pw) { this.hx = null; U.tip.hide(); this.render(); return; }
    const xv = g.x0 + (px - g.m.l) / g.pw * (g.x1 - g.x0);
    let html = '', hx = xv;
    cfg.series.forEach((s, k) => {
      const xa = s.x || cfg.x; if (!xa.length) return;
      let lo = 0, hi = xa.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xa[mid] < xv) lo = mid; else hi = mid; }
      const i = Math.abs(xa[lo] - xv) < Math.abs(xa[hi] - xv) ? lo : hi; if (k === 0) hx = xa[i];
      if (s.name && isFinite(s.y[i])) html += `<div><span style="color:${s.color || U.COL[k % U.COL.length]}">●</span> ${s.name}: <span class="mono">${Math.abs(s.y[i]) >= 1000 ? s.y[i].toFixed(0) : Math.abs(s.y[i]) < 0.01 && s.y[i] !== 0 ? s.y[i].toExponential(2) : s.y[i].toPrecision(4)}</span></div>`;
    });
    this.hx = hx; this.render();
    U.tip.show(`<b>${cfg.xLabel ? cfg.xLabel.split('(')[0].trim() : 'x'} = ${hx.toPrecision(4)}</b>` + html, e.clientX, e.clientY);
  }
}
U.Chart = Chart;
U.chartBox = function (host, title, cls) {
  const el = U.el(`<div class="chartbox"><h4>${title}</h4><canvas class="chart ${cls || ''}"></canvas></div>`);
  host.appendChild(el);
  return new Chart(el.querySelector('canvas'));
};

/* ---- core-face map: 380 channels viewed from the reactor face */
class CoreMap {
  constructor(canvas, opt) {
    this.c = canvas; this.opt = opt || {}; this.d = null; this.sel = -1;
    new ResizeObserver(() => this.render()).observe(canvas);
    canvas.addEventListener('mousemove', e => { const ch = this.pick(e); canvas.style.cursor = ch >= 0 ? 'pointer' : 'default'; if (ch < 0 || !this.d) return U.tip.hide(); const d = this.d, v = d.values[ch]; U.tip.show(`<b>${P.core.ch[ch].id}</b> · <span class="mono">${d.cats ? d.cats[v].label : (d.fmt ? d.fmt(v) : U.f(v, 2)) + ' ' + (d.unit || '')}</span>${d.info ? '<br>' + d.info(ch) : ''}`, e.clientX, e.clientY); });
    canvas.addEventListener('mouseleave', () => U.tip.hide());
    canvas.addEventListener('click', e => { const ch = this.pick(e); if (ch >= 0) { this.sel = ch; this.render(); if (this.opt.onClick) this.opt.onClick(ch); } });
  }
  geom() { const w = this.c.clientWidth, h = this.c.clientHeight, x0 = 20, y0 = 16, s = Math.max(40, Math.min(w - x0 - 64, h - y0 - 6)); return { x0, y0, s, cell: s / 22, w, h }; }
  pick(e) {
    const r = this.c.getBoundingClientRect(), g = this.geom();
    const col = Math.floor((e.clientX - r.left - g.x0) / g.cell), row = Math.floor((e.clientY - r.top - g.y0) / g.cell);
    if (col < 0 || col > 21 || row < 0 || row > 21) return -1;
    return P.core.chanAt[(row + P.core.OFF) * P.core.NXY + col + P.core.OFF];
  }
  draw(d) { this.d = d; this.render(); }
  render() {
    const d = this.d; if (!d) return;
    const f = fit(this.c); if (!f) return;
    const { ctx } = f, g = this.geom(), ch = P.core.ch, cm = U.cmap(d.cmap || 'heat');
    let lo = d.min, hi = d.max;
    if (!d.cats && (lo == null || hi == null)) { let a = Infinity, b = -Infinity; for (let i = 0; i < ch.length; i++) { const v = d.values[i]; if (isFinite(v)) { if (v < a) a = v; if (v > b) b = v; } } if (lo == null) lo = a; if (hi == null) hi = b; if (d.sym) { const mx = Math.max(Math.abs(lo), Math.abs(hi), d.symMin || 0); lo = -mx; hi = mx; } }
    if (!(hi > lo)) hi = lo + 1e-6;
    ctx.font = '10px "Segoe UI", sans-serif'; ctx.fillStyle = '#6b7a90'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < 22; r++) ctx.fillText(P.core.rowNames[r], g.x0 - 10, g.y0 + (r + 0.5) * g.cell);
    for (let k = 0; k < 22; k++) if (g.cell > 15 || k % 2 === 0) ctx.fillText(k + 1, g.x0 + (k + 0.5) * g.cell, g.y0 - 8);
    const R = g.cell * 0.44;
    for (let i = 0; i < ch.length; i++) {
      const cx = g.x0 + (ch[i].col + 0.5) * g.cell, cy = g.y0 + (ch[i].row + 0.5) * g.cell, v = d.values[i];
      ctx.fillStyle = d.cats ? d.cats[v].color : cm((v - lo) / (hi - lo));
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
      if (d.arrows) { ctx.fillStyle = '#0b0f14aa'; ctx.font = `${Math.round(g.cell * 0.55)}px sans-serif`; ctx.fillText(ch[i].dir > 0 ? '•' : '×', cx, cy + 1); ctx.font = '10px "Segoe UI", sans-serif'; }
    }
    if (d.zones) { ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(g.x0 + x1 * g.cell, g.y0 + y1 * g.cell); ctx.lineTo(g.x0 + x2 * g.cell, g.y0 + y2 * g.cell); ctx.stroke(); };
      L(7.33, 0, 7.33, 22); L(14.67, 0, 14.67, 22); L(0, 11, 7.33, 11); L(14.67, 11, 22, 11); L(7.33, 7.33, 14.67, 7.33); L(7.33, 14.67, 14.67, 14.67); ctx.setLineDash([]); }
    if (d.loops) { ctx.strokeStyle = '#ffffff88'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(g.x0 + 11 * g.cell, g.y0); ctx.lineTo(g.x0 + 11 * g.cell, g.y0 + g.s); ctx.stroke(); ctx.setLineDash([]); }
    (d.devs || []).forEach(v => { ctx.strokeStyle = v.color; ctx.lineWidth = v.w || 2; ctx.globalAlpha = v.alpha == null ? 0.9 : v.alpha; ctx.beginPath(); ctx.moveTo(g.x0 + v.x * g.cell, g.y0 + v.y1 * g.cell); ctx.lineTo(g.x0 + (v.x2 == null ? v.x : v.x2) * g.cell, g.y0 + v.y2 * g.cell); ctx.stroke(); ctx.globalAlpha = 1; });
    (d.dets || []).forEach(v => { const x = g.x0 + v.x * g.cell, y = g.y0 + v.y * g.cell, s = v.size || 4; ctx.fillStyle = v.color; ctx.strokeStyle = '#0b0f14'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    (d.marks || []).forEach(mk => { const c = ch[mk.ch]; if (!c) return; ctx.strokeStyle = mk.color || '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(g.x0 + (c.col + 0.5) * g.cell, g.y0 + (c.row + 0.5) * g.cell, R + 2, 0, 6.2832); ctx.stroke(); });
    if (this.sel >= 0 && d.select !== false) { const c = ch[this.sel]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x0 + (c.col + 0.5) * g.cell, g.y0 + (c.row + 0.5) * g.cell, R + 1.5, 0, 6.2832); ctx.stroke(); }
    // colour bar / legend
    const bx = g.x0 + g.s + 14; ctx.textAlign = 'left'; ctx.fillStyle = '#93a1b5'; ctx.font = '11px "Segoe UI", sans-serif';
    if (d.cats) { d.cats.forEach((c, i) => { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(bx + 5, g.y0 + 10 + i * 18, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#93a1b5'; ctx.fillText(c.short || c.label, bx + 14, g.y0 + 11 + i * 18); }); }
    else {
      const bh = Math.min(g.s - 30, 260), by = g.y0 + 14;
      for (let i = 0; i < bh; i++) { ctx.fillStyle = cm(1 - i / bh); ctx.fillRect(bx, by + i, 12, 1.5); }
      const ff = d.fmt || (v => U.f(v, Math.abs(hi - lo) < 5 ? 2 : 1));
      ctx.fillStyle = '#93a1b5';
      ctx.fillText(ff(hi), bx + 16, by + 4); ctx.fillText(ff((hi + lo) / 2), bx + 16, by + bh / 2); ctx.fillText(ff(lo), bx + 16, by + bh - 4);
      ctx.fillText(d.unit || '', bx, by - 10);
    }
  }
}
U.CoreMap = CoreMap;

/* simple horizontal bar list */
U.bars = function (host, rows, opt) {
  opt = opt || {}; const mx = opt.max || Math.max(...rows.map(r => Math.abs(r[1]))) || 1;
  host.innerHTML = rows.map(r => `<div style="display:grid;grid-template-columns:${opt.lw || 130}px 1fr 64px;gap:8px;align-items:center;font-size:12px;margin:3px 0"><span class="mut">${r[0]}</span><div style="background:var(--bg2);border-radius:4px;height:11px;overflow:hidden"><div style="width:${Math.min(100, Math.abs(r[1]) / mx * 100)}%;height:100%;background:${r[2] || 'var(--acc)'}"></div></div><span class="mono" style="text-align:right">${r[3] != null ? r[3] : U.f(r[1], 1)}</span></div>`).join('');
};
})();
