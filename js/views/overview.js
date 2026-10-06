/* CANDU 6 Interactive Reactor Lab · Developed by Reza Attarzadeh */
(function () {
'use strict';
const C = window.CANDU, U = C.ui, M = C.model, D = C.data;
const pipe = (d, cls, slow) => `<path class="pipe ${cls}" d="${d}"/><path class="flow ${slow ? 'slow' : ''}" d="${d}"/>`;
const hs = (id, inner) => `<g class="hs" data-c="${id}" tabindex="0" role="button">${inner}</g>`;

function schematic() {
  const chY = [400, 422, 445, 468, 490];
  return `<svg class="sch" viewBox="0 0 1000 610" role="img" aria-label="CANDU 6 plant schematic">
  <path d="M30,592 L30,120 Q345,-55 660,120 L660,592 Z" fill="#131922" stroke="#4a5a70" stroke-width="5"/>
  <text x="46" y="582">Reactor building (containment)</text><text x="770" y="582">Turbine building</text>
  ${hs('containment', `<path class="eq" d="M30,592 L30,120 Q345,-55 660,120" fill="none" style="fill:none" stroke-width="5"/><text class="lbl" x="40" y="140">Containment</text>`)}
  ${hs('dousing', `<path class="eq" d="M150,100 L150,66 Q345,10 540,66 L540,100 Z"/><path d="M152,98 L152,78 L538,78 L538,98 Z" fill="#2b6fd655"/><text class="lbl" x="300" y="93">Dousing tank</text><path d="M200,100 v12 M260,100 v12 M430,100 v12 M490,100 v12" stroke="#5aa9ff" stroke-dasharray="2 3"/>`)}
  ${hs('vault', `<rect class="eq" x="232" y="350" width="226" height="190" rx="4"/><rect x="234" y="352" width="222" height="186" fill="#2b6fd61c"/><text x="237" y="366">Vault (H₂O)</text>`)}
  ${hs('modsys', `${pipe('M345,510 L345,562 L318,562', 'modp', 1)}${pipe('M290,562 L276,562', 'modp', 1)}${pipe('M250,562 L222,562 L222,446 L262,446', 'modp', 1)}<circle class="eq" cx="304" cy="562" r="13"/><text x="299" y="566">P</text><rect class="eq" x="250" y="551" width="26" height="22" rx="3"/><text x="254" y="566">HX</text><text class="lbl" x="362" y="560">Moderator system</text><text class="val" x="362" y="574" data-v="mod">45 → 69 °C</text>`)}
  ${hs('calandria', `<rect class="eq" x="262" y="380" width="166" height="130" rx="10"/><rect x="264" y="382" width="162" height="126" rx="9" fill="#7dcfff18"/><text class="lbl" x="276" y="526">Calandria (D₂O moderator)</text>`)}
  ${hs('endshield', `<rect class="eq" x="247" y="386" width="15" height="118"/><rect class="eq" x="428" y="386" width="15" height="118"/>`)}
  ${hs('pt', chY.map(y => `<line x1="226" y1="${y}" x2="464" y2="${y}" stroke="#f7768e" stroke-width="5" class="eq" style="stroke:#f7768e"/>`).join('') + `<text class="lbl" x="300" y="437">380 fuel channels</text><text x="300" y="458">12 bundles each</text>`)}
  ${hs('fm', `<path d="M166,445 L226,445 M464,445 L524,445" stroke="#c0caf5" stroke-width="2" stroke-dasharray="3 3"/><rect class="eq" x="118" y="432" width="48" height="26" rx="4"/><rect class="eq" x="524" y="432" width="48" height="26" rx="4"/><text x="104" y="472">Fuelling machine</text><text x="512" y="472">Fuelling machine</text>`)}
  ${hs('rmd', `<rect class="eq" x="262" y="330" width="166" height="13"/><title>Reactivity mechanisms deck</title>`)}
  ${hs('sor', [290, 312, 334, 356, 378, 400].map(x => `<line x1="${x}" y1="318" x2="${x}" y2="376" stroke="#e0af68" stroke-width="3"/>`).join('') + `<rect class="eq" x="284" y="310" width="122" height="10" rx="2"/><text class="lbl" x="284" y="305">SDS1: 28 shutoff rods</text>`)}
  ${hs('lzc', `<line x1="345" y1="343" x2="345" y2="505" stroke="#bb9af7" stroke-width="2.5" stroke-dasharray="14 5"/><line x1="322" y1="343" x2="322" y2="470" stroke="#9ece6a" stroke-width="2"/><line x1="368" y1="343" x2="368" y2="470" stroke="#9ece6a" stroke-width="2"/><rect class="eq" x="412" y="349" width="42" height="14" rx="3"/><text x="415" y="360">LZC·ADJ</text>`)}
  ${hs('liss', `<rect class="eq" x="176" y="488" width="14" height="42" rx="6"/><rect class="eq" x="194" y="488" width="14" height="42" rx="6"/><path d="M201,488 L201,480 L262,480 L424,480" stroke="#e0af68" stroke-width="2.5" fill="none" stroke-dasharray="6 3"/><text class="lbl" x="52" y="548">SDS2: Gd poison injection</text>`)}
  ${hs('feeders', `${pipe('M184,296 L212,296 L212,411 L226,411', 'coldp')}${pipe('M226,479 L198,479 L198,268 L184,268', 'hotp')}${pipe('M506,296 L478,296 L478,479 L464,479', 'coldp')}${pipe('M464,411 L492,411 L492,268 L506,268', 'hotp')}<text class="lbl" x="150" y="372">Feeders</text><text class="lbl" x="500" y="372">Feeders</text>`)}
  ${hs('headers', `<rect class="eq" x="150" y="261" width="36" height="14" rx="7" style="stroke:var(--hot)"/><rect class="eq" x="150" y="289" width="36" height="14" rx="7" style="stroke:var(--cold)"/><rect class="eq" x="504" y="261" width="36" height="14" rx="7" style="stroke:var(--hot)"/><rect class="eq" x="504" y="289" width="36" height="14" rx="7" style="stroke:var(--cold)"/>
     <text class="val" x="566" y="318" data-v="roh">310 °C</text><text class="val" x="566" y="333" data-v="rih">266 °C</text><text x="62" y="318">outlet header</text><text x="62" y="333">inlet header</text>`)}
  ${pipe('M150,268 L108,268 L108,250', 'hotp')}${pipe('M137,250 L137,296 L150,296', 'coldp')}
  ${pipe('M540,268 L582,268 L582,250', 'hotp')}${pipe('M553,250 L553,296 L540,296', 'coldp')}
  ${hs('htpump', `<circle class="eq" cx="137" cy="283" r="11"/><circle class="eq" cx="553" cy="283" r="11"/><text x="64" y="298">HT pump</text>`)}
  ${hs('sg', `<path class="eq" d="M100,250 L100,190 Q92,180 92,170 L92,160 Q92,146 122,146 Q152,146 152,160 L152,170 Q152,180 144,190 L144,250 Z"/><path class="eq" d="M545,250 L545,190 Q537,180 537,170 L537,160 Q537,146 567,146 Q597,146 597,160 L597,170 Q597,180 589,190 L589,250 Z"/>
     <path d="M110,248 L110,200 Q122,186 134,200 L134,248" fill="none" stroke="#ff9e64" stroke-width="2"/><path d="M555,248 L555,200 Q567,186 579,200 L579,248" fill="none" stroke="#ff9e64" stroke-width="2"/>
     <text class="lbl" x="157" y="200">Steam generator</text><text x="157" y="214">(4 in total)</text>`)}
  ${hs('pressurizer', `<rect class="eq" x="46" y="186" width="26" height="74" rx="12"/><rect x="48" y="226" width="22" height="32" rx="9" fill="#ff6b5e44"/><path d="M59,260 L59,268 L108,268" stroke="#ff6b5e" stroke-width="2" fill="none"/><text x="38" y="180">Pressurizer</text>`)}
  ${pipe('M122,146 L122,132 L567,132 L760,132', 'stm')}${pipe('M567,146 L567,132', 'stm')}
  ${hs('steam', `<text class="lbl" x="668" y="122">Main steam</text><text class="val" x="668" y="106" data-v="steam">4.69 MPa</text>`)}
  ${hs('turbine', `<path class="eq" d="M760,122 L790,112 L790,152 L760,142 Z"/><path class="eq" d="M800,112 L840,96 L840,168 L800,152 Z"/><path class="eq" d="M848,96 L888,112 L888,152 L848,168 Z"/><rect class="eq" x="898" y="112" width="74" height="40" rx="6"/><line x1="790" y1="132" x2="898" y2="132" stroke="#93a1b5" stroke-width="3"/><text class="lbl" x="806" y="88">Turbine</text><text class="lbl" x="908" y="128">Generator</text><text class="val" x="908" y="144" data-v="mwe">728 MWe</text>`)}
  ${pipe('M844,168 L844,196', 'stm', 1)}
  ${hs('condenser', `<rect class="eq" x="792" y="196" width="104" height="48" rx="6"/><path d="M800,212 h88 M800,222 h88 M800,232 h88" stroke="#5aa9ff" stroke-width="1.5"/><text class="lbl" x="812" y="262">Condenser</text>`)}
  ${pipe('M792,220 L748,220', 'fw', 1)}${pipe('M694,220 L597,220', 'fw', 1)}
  ${hs('feedwater', `<rect class="eq" x="694" y="206" width="54" height="28" rx="4"/><circle class="eq" cx="770" cy="220" r="10"/><text class="lbl" x="676" y="252">Feedwater heaters</text><text class="val" x="676" y="267" data-v="fw">187 °C</text>`)}
  ${hs('ecc', `<rect class="eq" x="700" y="420" width="26" height="76" rx="12"/><rect class="eq" x="734" y="420" width="26" height="76" rx="12"/><rect class="eq" x="768" y="434" width="22" height="62" rx="10"/><path class="pipe eccp" d="M713,420 L713,345 L522,345 L522,303" style="stroke-dasharray:7 4;stroke-width:3"/><text class="lbl" x="700" y="514">Emergency core cooling</text><text x="700" y="528">gas-driven water tanks → headers</text>`)}
  ${hs('elec', `<path d="M972,132 L990,132 M990,112 L990,152" stroke="#e0af68" stroke-width="3"/><text x="930" y="172">to grid</text>`)}
  </svg>`;
}

C.views.overview = {
  init(el) {
    el.innerHTML = `
      <h1>How a CANDU 6 works</h1>
      <p class="lead">A CANDU 6 splits natural uranium in <b>380 horizontal fuel channels</b>. Pressurised heavy water flows through each channel, carries the heat to four steam generators, and returns. A separate, cool, low-pressure tank of heavy water – the moderator – surrounds the channels and keeps the chain reaction going. Click any component of the plant below, then follow the modules on the left from the single channel up to trip set-points and accident behaviour.</p>
      <div class="kpis" id="ov-k"></div>
      <div class="grid gsideR" style="margin-top:14px">
        <div class="card"><div id="ov-svg"></div>
          <div class="legend" style="margin-top:6px"><span><i style="background:var(--hot)"></i>Hot D₂O coolant (310 °C)</span><span><i style="background:var(--cold)"></i>Cold D₂O coolant (266 °C)</span><span><i style="background:#7dcfff"></i>Moderator D₂O</span><span><i style="background:#d8dee9"></i>Steam</span><span><i style="background:#58c7a3"></i>Feedwater</span><span><i style="background:var(--vio)"></i>ECC</span></div></div>
        <div class="card" id="ov-det"></div>
      </div>
      <h2 style="margin-top:22px">The energy path, with live numbers</h2>
      <div class="grid g3" id="ov-path"></div>
      <h2 style="margin-top:22px">Three ideas that explain most CANDU behaviour</h2>
      <div class="grid g3">
        <div class="note"><h4>1 · Every channel is its own little reactor loop</h4>All channels hang between the same inlet and outlet headers, so they all see the same pressure difference. Each channel's flow is whatever its feeders and fuel string allow under that ΔP – and it falls when boiling increases. Dryout margin is therefore a per-channel quantity: the <b>critical channel power</b>.</div>
        <div class="note warn"><h4>2 · Voiding adds reactivity</h4>Coolant and moderator are separate. Losing coolant removes a little absorption and hardens the spectrum, adding up to ≈ +12 mk. The design answer is two independent, fast shutdown systems, a two-loop heat-transport system and trips set to act before fuel dries out.</div>
        <div class="note ok"><h4>3 · The reactor ages thermal-hydraulically</h4>Pressure tubes creep outward, steam generators foul, feeders roughen. Flow by-passes the fuel, inlet temperature creeps up, margins shrink – and the <b>ROP trip set-point</b> has to follow them down.</div>
      </div>
      <h2 style="margin-top:22px">Suggested learning path</h2>
      <div class="grid g3" id="ov-nav"></div>
      <p class="mut small" style="margin-top:26px;text-align:center">CANDU 6 Interactive Reactor Lab · Developed by <b>Reza Attarzadeh</b></p>`;
    U.$('#ov-svg', el).innerHTML = schematic();
    U.kpis(U.$('#ov-k', el), [['Heat to coolant', '2064', 'MWt', 'acc'], ['Gross electric', '728', 'MWe', 'acc'], ['Fuel channels', '380', ''], ['Fuel bundles', '4560', ''], ['Coolant flow', '7700', 'kg/s'], ['Steam generators', '4', ''], ['HT pumps', '4', ''], ['Shutoff rods', '28', ''], ['Zone controllers', '14', ''], ['Adjusters', '21', '']]);
    const det = U.$('#ov-det', el);
    const showC = id => {
      const c = D.components.find(x => x.id === id); if (!c) return;
      U.$$('g.hs', el).forEach(g => g.classList.toggle('sel', g.dataset.c === id));
      const sys = D.systems.find(s => s.id === c.sys);
      det.innerHTML = `<span class="tag" style="border-color:${sys.color};color:${sys.color}">${sys.name}</span><h2 style="margin-top:8px">${c.name}</h2><p>${c.sum}</p>
        <div class="scroll" style="max-height:230px">${U.spec(c.specs.slice(0, 8))}</div>
        <div class="note" style="margin-top:10px"><h4>Thermalhydraulic role</h4>${c.th}</div>
        <div class="row" style="margin-top:10px"><button class="btn" data-go="library">All specifications →</button></div>`;
      U.$('[data-go]', det).addEventListener('click', () => C.app.go('library', id));
    };
    U.$$('g.hs', el).forEach(g => { g.addEventListener('click', () => showC(g.dataset.c)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showC(g.dataset.c); } }); });
    showC('pt');
    const nav = [['channel', 'Start with one channel', 'See coolant heat up, boil and approach dryout along 12 bundles. Change power, inlet temperature, feeder resistance and creep.'],
      ['pht', 'Then the whole loop', 'How pumps, headers and steam generators set the boundary conditions every channel shares.'],
      ['coremap', 'Look at all 380 channels', 'Power, flow, quality and margin across the reactor face.'],
      ['flux', 'Shape the neutron flux', 'Move zone controllers, adjusters and absorbers; insert an isotope target; refuel a channel.'],
      ['aging', 'Age the plant', 'Thirty years of creep and fouling, and what they do to the ROP trip set-point.'],
      ['sim', 'Break things safely', 'Run a LOCA, pump trip or loss of regulation and watch SDS1 and SDS2 respond.']];
    U.$('#ov-nav', el).innerHTML = nav.map((n, i) => `<div class="card"><h3>${i + 1}. ${n[1]}</h3><p class="mut">${n[2]}</p><button class="btn pri" data-id="${n[0]}">Open</button></div>`).join('');
    U.$$('#ov-nav button', el).forEach(b => b.addEventListener('click', () => C.app.go(b.dataset.id)));
    this.el = el;
    C.app.live('overview', 'th', () => this.update());
  },
  update() {
    const el = this.el, S = M.S, th = S.th;
    const set = (k, t) => { const n = U.$(`[data-v="${k}"]`, el); if (n) n.textContent = t; };
    set('rih', `in ${U.f(th.rihT, 1)} °C`); set('roh', `out ${U.f(th.tROH, 1)} °C`);
    set('steam', `${U.f(th.steamP, 2)} MPa · ${U.f(th.steamFlow, 0)} kg/s`); set('mwe', `${U.f(th.mwe, 0)} MWe`); set('fw', `${U.f(th.fwT, 0)} °C`);
    const q = th.qCore;
    U.$('#ov-path', el).innerHTML = [
      ['Fission in the fuel', `${U.f(q / 0.947, 0)} MW of fission heat in 4560 bundles. Hottest bundle ${U.f(S.flux.maxBun * S.op.power, 0)} kW, hottest channel ${U.f(S.flux.maxCh * S.op.power, 2)} MW.`],
      ['Coolant picks it up', `${U.f(th.wTot, 0)} kg/s of D₂O enters at ${U.f(th.rihT, 1)} °C and leaves at ${U.f(th.tROH, 1)} °C with ${U.f(Math.max(0, th.xROH) * 100, 1)} % steam quality. Header-to-header ΔP ${U.f(th.dpHH, 2)} MPa.`],
      ['Steam generators', `Four boilers transfer ${U.f(q, 0)} MW to light water at ${U.f(th.Ts, 0)} °C, making ${U.f(th.steamFlow, 0)} kg/s of steam.`],
      ['Turbine-generator', `${U.f(th.mwe, 0)} MWe gross – about 35 % of the heat, limited by the 260 °C steam temperature.`],
      ['Moderator', `≈ ${U.f(100 * S.op.power, 0)} MW is deposited in the cool moderator and removed by its own heat exchangers.`],
      ['Margin', `The channel closest to dryout is ${P_id(S.minCPRch)}: it could take ${U.f(S.minCPR, 2)} × its present power before its fuel dries out.`]
    ].map((c, i) => `<div class="card"><h4>${i + 1} · ${c[0]}</h4><p style="margin:0">${c[1]}</p></div>`).join('');
  },
  show() { this.update(); }
};
function P_id(i) { return C.phys.core.ch[i].id; }
})();
