/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, D = C.data;

C.views.library = {
  init(el) {
    this.el = el; this.sys = 'all'; this.q = '';
    el.innerHTML = `
      <p class="lead">Design data for every major system and component of a CANDU 6, with a note on how each one affects thermalhydraulics and safety. Values are representative figures from public design descriptions; individual stations differ.</p>
      <div id="lb-seg" style="margin-bottom:14px"></div>
      <div id="lb-comp">
        <div class="row" style="margin-bottom:10px"><input type="search" id="lb-q" placeholder="Search components and specifications…" style="flex:1;min-width:220px" aria-label="Search"><span class="small mut" id="lb-n"></span></div>
        <div class="row" id="lb-sys" style="margin-bottom:12px"></div>
        <div id="lb-list"></div>
      </div>
      <div id="lb-plant" style="display:none"><div class="grid g2"><div class="card"><h3>Station summary</h3>${U.spec(D.plant)}</div><div class="card"><h3>Reactor physics data</h3>${U.spec(D.physics)}<p class="small mut" style="margin-top:8px">Equilibrium-core values unless noted. 1 mk = 0.001 Δk/k.</p></div></div>
        <div class="card" style="margin-top:14px"><h3>Fuel-channel geometry used by the thermalhydraulic model</h3>${U.spec([['Flow area (new tube, 37-element bundle)', (C.phys.K.flowArea * 1e4).toFixed(2) + ' cm²'], ['Hydraulic diameter', (C.phys.K.dh * 1e3).toFixed(2) + ' mm'], ['Heated perimeter', (C.phys.K.heatPerim * 1e3).toFixed(0) + ' mm'], ['Heated length', C.phys.K.coreLen + ' m (12 × 495.3 mm)'], ['Design enthalpy rise', C.phys.K.dhDesign.toFixed(0) + ' kJ/kg'], ['Average channel power / flow', C.phys.K.chAvgMW.toFixed(2) + ' MW / ' + (C.phys.K.wTotal / 380).toFixed(1) + ' kg/s']])}</div></div>
      <div id="lb-glos" style="display:none"><div class="card"><table class="tbl spec">${D.glossary.map(g => `<tr><td><b>${g[0]}</b></td><td>${g[1]}</td></tr>`).join('')}</table></div></div>
      <div id="lb-quiz" style="display:none"><div class="card quiz" id="lb-qz"></div></div>`;
    const panes = { comp: '#lb-comp', plant: '#lb-plant', glos: '#lb-glos', quiz: '#lb-quiz' };
    this.seg = U.seg(U.$('#lb-seg', el), [['comp', `Components (${D.components.length})`], ['plant', 'Plant & physics data'], ['glos', 'Glossary'], ['quiz', 'Check your understanding']], 'comp', v => { for (const k in panes) U.$(panes[k], el).style.display = k === v ? 'block' : 'none'; });
    const sys = U.$('#lb-sys', el);
    [{ id: 'all', name: 'All systems', color: '#93a1b5' }].concat(D.systems).forEach(s => { const b = U.el(`<button class="btn sm" data-s="${s.id}" style="border-color:${s.color}">${s.name}</button>`); b.addEventListener('click', () => { this.sys = s.id; this.list(); }); sys.appendChild(b); });
    U.$('#lb-q', el).addEventListener('input', e => { this.q = e.target.value.toLowerCase(); this.list(); });
    this.list(); this.quiz(0, 0);
  },
  list(open) {
    const el = this.el, q = this.q;
    U.$$('#lb-sys button', el).forEach(b => b.classList.toggle('on', b.dataset.s === this.sys));
    const items = D.components.filter(c => (this.sys === 'all' || c.sys === this.sys) && (!q || (c.name + ' ' + c.sum + ' ' + c.th + ' ' + c.safety + ' ' + c.specs.map(s => s.join(' ')).join(' ')).toLowerCase().indexOf(q) >= 0));
    U.$('#lb-n', el).textContent = items.length + ' of ' + D.components.length + ' components · ' + items.reduce((a, c) => a + c.specs.length, 0) + ' specification entries';
    U.$('#lb-list', el).innerHTML = items.map(c => { const s = D.systems.find(x => x.id === c.sys); return `<details class="cmp" id="lb-${c.id}" ${open === c.id || (q && items.length <= 3) ? 'open' : ''}><summary><span style="color:${s.color}">●</span>${c.name}<small>${s.name}</small></summary><div class="body"><p>${c.sum}</p><div class="grid g2"><div>${U.spec(c.specs)}</div><div class="stack"><div class="note"><h4>Effect on thermalhydraulics</h4>${c.th}</div><div class="note warn"><h4>Safety and ageing</h4>${c.safety}</div></div></div></div></details>`; }).join('') || '<p class="mut">Nothing matches.</p>';
  },
  show(arg) {
    if (typeof arg === 'string') { this.sys = 'all'; this.q = ''; U.$('#lb-q', this.el).value = ''; this.seg.set('comp'); ['#lb-plant', '#lb-glos', '#lb-quiz'].forEach(s => { U.$(s, this.el).style.display = 'none'; }); U.$('#lb-comp', this.el).style.display = 'block'; this.list(arg); const d = U.$('#lb-' + arg, this.el); if (d) setTimeout(() => d.scrollIntoView({ block: 'start' }), 30); }
  },
  quiz(i, score) {
    const host = U.$('#lb-qz', this.el), Q = D.quiz;
    if (i >= Q.length) { host.innerHTML = `<h2>${score} of ${Q.length} correct</h2><p class="mut">${score >= 10 ? 'Excellent – you have the thermalhydraulic picture.' : score >= 7 ? 'Good. Revisit the modules behind the questions you missed.' : 'Work through the Fuel channel lab and the Ageing & ROP module, then try again.'}</p><button class="btn pri">Start again</button>`; host.querySelector('button').addEventListener('click', () => this.quiz(0, 0)); return; }
    const q = Q[i];
    host.innerHTML = `<div class="row"><h4 style="margin:0">Question ${i + 1} of ${Q.length}</h4><span class="sp"></span><span class="small mut">score ${score}</span></div><h3 style="margin:10px 0">${q.q}</h3><div>${q.a.map((a, k) => `<button class="btn opt" data-k="${k}">${a}</button>`).join('')}</div><div id="lb-why"></div>`;
    U.$$('.opt', host).forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.k, ok = k === q.c;
      U.$$('.opt', host).forEach(x => { x.disabled = true; if (+x.dataset.k === q.c) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      U.$('#lb-why', host).innerHTML = `<div class="note ${ok ? 'ok' : 'warn'}" style="margin-top:10px"><h4>${ok ? 'Correct' : 'Not quite'}</h4>${q.why}</div><div class="row" style="margin-top:10px"><button class="btn pri">Next →</button></div>`;
      U.$('#lb-why button', host).addEventListener('click', () => this.quiz(i + 1, score + (ok ? 1 : 0)));
    }));
  }
};
})();
