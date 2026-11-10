'use strict';
// Pantalla de juego: dibuja el estado y traduce los clics en acciones.

const semillaAlAzar = () => 1 + Math.floor(Math.random() * 999999);

let estado = null;
let ui = {
  pantalla: 'menu', menu: 'principal', paso: 1, menuAnim: true, ventana: null, modalTipo: '',
  tab: 'provincia', animTab: true, prov: null, pais: null, objetivo: null, modoMapa: 'politico', filtroLey: 'todas', cartera: null,
  cfg: { ...CONFIG_BASE, principios: [], modo: 'carrera', semilla: semillaAlAzar() },
  previo: {}, pips: null, mapaVersion: -1, animVoto: '', animElec: '', timers: [],
};

const nombrePartido = pid => esc(partidoInfo(estado, pid).nombre);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const paisesEnMapa = () => Object.keys(GEO.paises).filter(pid => pid !== PAIS_JUGADOR.id);

// ---------- Mapa ----------

const GRIS_MAPA = '#d9d3c3';
const MODOS_MAPA = {
  politico: { nombre: 'Político', leyenda: () => [[PAIS_JUGADOR.colores[1], esc(PAIS_JUGADOR.nombre)], ...paisesEnMapa().map(p => [PAISES[p].color, PAISES[p].nombre])] },
  electoral: { nombre: 'Electoral', leyenda: () => ORDEN_HEMICICLO.map(pid => [partidoInfo(estado, pid).color, nombrePartido(pid)]) },
  recursos: { nombre: 'Recursos', soloGobierno: true, leyenda: () => [['#9cc27a', 'Tierra fértil'], ['#b79c86', 'Minerales'], ['#c9b65e', 'Las dos cosas'], ['#eadfc6', 'Ninguna']] },
  poblacion: { nombre: 'Población', leyenda: () => [['#f3e2b3', 'Poca gente'], ['#a8641f', 'Mucha gente']] },
  relaciones: { nombre: 'Relaciones', soloGobierno: true, leyenda: () => [['#c8574b', 'Hostil'], ['#e6dcc4', 'Neutral'], ['#5d9f6c', 'Amistosa']] },
};
const modosMapa = () => Object.keys(MODOS_MAPA).filter(m => estado.modo === 'gobierno' || !MODOS_MAPA[m].soloGobierno);

function colorProvincia(p, i) {
  const propia = p.pais === PAIS_JUGADOR.id;
  if (ui.modoMapa === 'electoral') return propia ? partidoInfo(estado, masVotado(votoProvincia(estado, p.id))).color : GRIS_MAPA;
  if (ui.modoMapa === 'recursos') {
    if (!propia) return GRIS_MAPA;
    return p.fertil && p.mineral ? '#c9b65e' : p.fertil ? '#9cc27a' : p.mineral ? '#b79c86' : '#eadfc6';
  }
  if (ui.modoMapa === 'poblacion') return propia ? mezclar('#f3e2b3', '#a8641f', limitar((p.pob - 400) / 1000, 0, 1)) : GRIS_MAPA;
  if (ui.modoMapa === 'relaciones') {
    if (propia) return PAIS_JUGADOR.colores[1];
    const r = estado.paises[p.pais].relacion;
    return mezclar('#e6dcc4', r >= 0 ? '#5d9f6c' : '#c8574b', Math.min(1, Math.abs(r) / 60));
  }
  return propia ? PAIS_JUGADOR.colores[i % 3] : PAISES[p.pais].color;
}

// Dibuja el mapa del mundo de esta partida. Se repite cada vez que una provincia cambia de dueño.
function construirMapa() {
  const [x, y, w, h] = GEO.viewBox;
  let tierra = '', provs = '', rotulos = '';
  for (const p of PROVINCIAS) {
    const g = GEO.provs[p.id];
    tierra += g.d;
    provs += `<path class="prov" id="prov-${p.id}" data-a="prov" data-prov="${p.id}" d="${g.d}"/>`;
    if (p.pais === PAIS_JUGADOR.id) rotulos += `<text class="lbl" x="${g.cx}" y="${g.cy - 3}">${p.capital && p.origen === PAIS_JUGADOR.id ? '★ ' : ''}${p.nombre}</text>`;
  }
  for (const pid of paisesEnMapa()) {
    const g = GEO.paises[pid];
    rotulos += `<svg class="lbl-bandera" x="${g.cx - 10}" y="${g.cy - 27}" width="20" height="13.300" viewBox="0 0 21 14">${dibujoBandera(pid)}</svg>
      <text class="lbl-pais" id="lblp-${pid}" x="${g.cx}" y="${g.cy}"></text>`;
  }
  const mapa = $('#mapa');
  aplicarVista();
  mapa.innerHTML = `<defs>
      <pattern id="olas" width="48" height="20" patternUnits="userSpaceOnUse"><path class="ola" d="M0 10q6-5 12 0t12 0 12 0 12 0"/></pattern>
      <pattern id="rayas" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.200" height="7" fill="rgba(27,34,30,.5)"/></pattern>
    </defs>
    <rect class="mar-olas" x="${x - 48}" y="${y}" width="${w + 96}" height="${h}" fill="url(#olas)"/>
    <path class="tierra-sombra" d="${tierra}" transform="translate(0 5)"/>${provs}
    <path class="f-prov" d="${GEO.fronteraProv}"/><path class="f-costa" d="${GEO.costa}"/><path class="f-pais" d="${GEO.fronteraPais}"/>
    <g id="mapa-guerra"></g><path id="mapa-sel" class="f-sel" d=""/>${rotulos}<g id="mapa-pips"></g>`;
  $('#mapa-pips')._html = $('#mapa-guerra')._html = null;
  ui.mapaVersion = estado.mapaVersion;
}

// ---------- Zoom y desplazamiento del mapa ----------
// ui.vista es la parte del mapa que se ve [x, y, ancho, alto]; null es el mapa entero.

const vistaMapa = () => ui.vista || GEO.viewBox;
function aplicarVista() { $('#mapa').setAttribute('viewBox', vistaMapa().map(n => +n.toFixed(1)).join(' ')); }

function ajustarVista([x, y, w, h]) {
  const [bx, by, bw, bh] = GEO.viewBox, k = limitar(w / bw, 0.18, 1);
  w = bw * k;
  h = bh * k;
  ui.vista = k > 0.999 ? null : [limitar(x, bx, bx + bw - w), limitar(y, by, by + bh - h), w, h];
  aplicarVista();
}

// factor < 1 acerca y > 1 aleja. px y py: punto del mapa que queda quieto (0 a 1).
function zoomMapa(factor, px = 0.5, py = 0.5) {
  const [x, y, w, h] = vistaMapa(), nw = w * factor, nh = h * factor;
  ajustarVista([x + (w - nw) * px, y + (h - nh) * py, nw, nh]);
}

// Rueda para acercar, arrastrar para moverse. Si se arrastra, el clic final no selecciona nada.
function prepararZoom() {
  const mapa = $('#mapa');
  let arrastre = null;
  mapa.addEventListener('wheel', ev => {
    if (!estado) return;
    ev.preventDefault();
    const r = mapa.getBoundingClientRect();
    zoomMapa(ev.deltaY > 0 ? 1.18 : 1 / 1.18, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
  }, { passive: false });
  mapa.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    arrastre = { x: ev.clientX, y: ev.clientY, vista: vistaMapa(), movido: false };
  });
  addEventListener('pointermove', ev => {
    if (!arrastre) return;
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
    if (!arrastre.movido && Math.hypot(dx, dy) < 6) return;
    if (!ui.vista && !arrastre.movido) return;   // con el mapa entero a la vista no hay a dónde moverse
    arrastre.movido = true;
    mapa.classList.add('arrastrando');
    const r = mapa.getBoundingClientRect(), [x, y, w, h] = arrastre.vista;
    ajustarVista([x - dx / r.width * w, y - dy / r.height * h, w, h]);
  });
  addEventListener('pointerup', () => {
    if (arrastre && arrastre.movido) ui.trasArrastre = true;
    arrastre = null;
    mapa.classList.remove('arrastrando');
  });
  mapa.addEventListener('click', ev => {
    if (ui.trasArrastre) { ev.stopPropagation(); ui.trasArrastre = false; }
  }, true);
}

// Etiqueta que sigue al ratón con los datos de la provincia. Se prepara una sola vez.
function prepararTooltip() {
  prepararZoom();
  const mapa = $('#mapa'), tip = $('#tooltip');
  mapa.addEventListener('mousemove', ev => {
    const el = ev.target.closest('.prov');
    if (!el || !estado || !PROV_POR_ID[el.dataset.prov]) { tip.hidden = true; return; }
    if (tip._id !== el.dataset.prov) { tip.innerHTML = htmlTooltip(PROV_POR_ID[el.dataset.prov]); tip._id = el.dataset.prov; }
    tip.hidden = false;
    const tx = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
    tip.style.transform = `translate(${tx}px, ${ev.clientY + 18}px)`;
  });
  mapa.addEventListener('mouseleave', () => { tip.hidden = true; });
}

function htmlTooltip(p) {
  const s = estado, ocupante = s.ocupadas[p.id];
  if (p.pais !== PAIS_JUGADOR.id) {
    const E = s.paises[p.pais], guerra = s.guerras[p.pais];
    const estadoGuerra = ocupante ? '<span>Ocupada por tus tropas</span>' : guerra ? '<span>En guerra: pulsa para ver el frente</span>' : '';
    return `<b>${p.nombre}</b><span>${bandera(p.pais)} ${PAISES[p.pais].nombre}, relación ${signo(E.relacion) || '0'}</span>
      <span>${ico('espadas')} Ejército ${E.ejercito}</span>${estadoGuerra}`;
  }
  const ocupada = ocupante ? `<span>Ocupada por ${PAISES[ocupante].nombre}</span>` : '';
  const votos = votoProvincia(s, p.id), primero = masVotado(votos);
  const electoral = `<span>Ganaría ${nombrePartido(primero)}. El tuyo: ${Math.round(votos[ID_JUGADOR] * 100)}%</span>`;
  if (s.modo === 'carrera') return `<b>${p.nombre}</b><span>${p.pob.toLocaleString('es')} mil habitantes</span>${electoral}`;
  const ed = s.edificios[p.id];
  const edificios = Object.keys(EDIFICIOS).filter(k => ed[k]).map(k => `${ico(EDIFICIOS[k].icono)}${ed[k]}`).join(' ');
  return `<b>${p.nombre}</b><span>${p.pob.toLocaleString('es')} mil habitantes</span>
    <span>${edificios || 'Sin edificios'}, ${solaresOcupados(s, p.id)} de ${solaresDe(p)} solares</span>${ocupada}${ui.modoMapa === 'electoral' ? electoral : ''}`;
}

function renderMapa() {
  const s = estado;
  if (ui.mapaVersion !== s.mapaVersion) construirMapa();
  PROVINCIAS.forEach((p, i) => {
    const el = $('#prov-' + p.id), col = colorProvincia(p, i);
    el.style.fill = el.style.stroke = col;
  });
  for (const pid of paisesEnMapa()) {
    const rel = s.paises[pid].relacion;
    $('#lblp-' + pid).textContent = PAISES[pid].nombre.toUpperCase() + (ui.modoMapa === 'relaciones' ? ` ${signo(rel) || '0'}` : '');
  }
  let sel = '';
  if (ui.tab === 'provincia' && ui.prov && GEO.provs[ui.prov]) sel = GEO.provs[ui.prov].contorno;
  else if (ui.tab === 'diplomacia' && GEO.paises[ui.pais]) sel = GEO.paises[ui.pais].contorno;
  else if (ui.tab === 'defensa' && ui.objetivo && GEO.provs[ui.objetivo]) sel = GEO.provs[ui.objetivo].contorno;
  $('#mapa-sel').setAttribute('d', sel);

  // Guerra: lo ocupado va rayado y lo que puedes atacar lleva unas espadas.
  let capa = '';
  for (const id in s.ocupadas) capa += `<path class="ocupada" d="${GEO.provs[id].d}"/>`;
  for (const pid in s.guerras) {
    for (const o of provinciasAtacables(s, pid)) {
      const g = GEO.provs[o.id];
      capa += `<g class="blanco" transform="translate(${g.cx} ${(g.cy - 15).toFixed(1)})"><circle r="7.500"/><svg x="-5" y="-5" width="10" height="10" viewBox="0 0 24 24">${ICONOS.espadas}</svg></g>`;
    }
  }
  ponerHTML($('#mapa-guerra'), capa);

  // Edificios y obras de cada provincia, como fichas bajo su nombre. En la carrera aún no se construye.
  let pips = '';
  const ahora = new Set();
  for (const p of s.modo === 'gobierno' ? provinciasJugador() : []) {
    const g = GEO.provs[p.id], ed = s.edificios[p.id], fichas = [];
    for (const k in EDIFICIOS) for (let i = 0; i < ed[k]; i++) fichas.push({ k, clave: `${p.id}:${k}:${i}` });
    obrasEn(s, p.id).forEach((o, i) => fichas.push({ k: o.tipo, obra: true, clave: `${p.id}:obra:${o.tipo}:${i}` }));
    const x0 = g.cx - (fichas.length - 1) * 6.5;
    fichas.forEach((f, i) => {
      ahora.add(f.clave);
      const nuevo = ui.pips && !ui.pips.has(f.clave);
      pips += `<g class="pip ${f.obra ? 'obra' : ''} ${nuevo ? 'nuevo' : ''}" transform="translate(${(x0 + i * 13).toFixed(1)} ${(g.cy + 10).toFixed(1)})">
        <g class="pip-in"><circle r="5.8"/><svg x="-4" y="-4" width="8" height="8" viewBox="0 0 24 24">${ICONOS[EDIFICIOS[f.k].icono]}</svg></g></g>`;
    });
  }
  ui.pips = ahora;
  ponerHTML($('#mapa-pips'), pips);

  ponerHTML($('#mapa-modos'), modosMapa().map(m =>
    `<button class="${ui.modoMapa === m ? 'activa' : ''}" data-a="modoMapa" data-v="${m}" aria-pressed="${ui.modoMapa === m}">${MODOS_MAPA[m].nombre}</button>`).join(''));
  ponerHTML($('#mapa-leyenda'), MODOS_MAPA[ui.modoMapa].leyenda().map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join(''));
  $('#tooltip')._id = null;
}

// ---------- Cabecera ----------

// Cifras de la cabecera en cada modo. valor: número que se anima al cambiar. texto: cadena fija.
// delta: [texto, clase] junto a la cifra. alerta: la pinta en rojo.
const faltanElecciones = s => s.proximaEleccion - s.mes;
const statFecha = { k: 'fecha', nombre: 'Fecha', icono: 'calendario', tip: 'Cada turno es un mes', texto: s => fecha(s.mes) };
const statCP = {
  k: 'cp', nombre: 'Capital político', icono: 'estrella', tip: 'Se gasta en casi todo lo que haces. Recuperas 2 cada mes.',
  valor: s => s.cp, fmt: n => `${n}/${CP_MAXIMO}`, delta: () => ['+2 al mes', ''],
};
const STATS = {
  gobierno: [
    statFecha,
    {
      k: 'dinero', nombre: 'Dinero', icono: 'moneda', tip: 'Tesoro del Estado y lo que cambia cada mes', valor: s => s.dinero,
      delta: s => { const b = calcularEconomia(s).balance; return [`${signo(b) || '0'} al mes`, clase(b)]; }, alerta: s => s.dinero < 0,
    },
    { k: 'popularidad', nombre: 'Popularidad', icono: 'gente', tip: 'Apoyo medio de los grupos sociales. Decide las elecciones.', valor: s => popularidad(s), fmt: n => n + '%' },
    { k: 'estabilidad', nombre: 'Estabilidad', icono: 'escudo', tip: 'Si baja de 25, el gobierno cae', valor: s => s.estabilidad, alerta: s => s.estabilidad < 35 },
    statCP,
    { k: 'influencia', nombre: 'Influencia', icono: 'globo', tip: 'Peso de tu país en el exterior. Cada punto mejora un 0,3% lo que exportas.', valor: s => influencia(s) },
    {
      k: 'elecciones', nombre: 'Elecciones', icono: 'urna', tip: 'Debes seguir siendo el partido con más escaños',
      texto: s => `en ${plural(faltanElecciones(s), 'mes', 'meses')}`, alerta: s => faltanElecciones(s) <= 3,
    },
  ],
  carrera: [
    statFecha,
    {
      k: 'prestigio', nombre: 'Prestigio', icono: 'megafono', tip: 'Lo conocido que eres. Atrae votantes y pesa en el congreso del partido. La fama se olvida: cada mes pierdes una parte.',
      valor: s => s.carrera.prestigio, delta: s => [`${signo(-olvidoPrestigio(s)) || '0'} al mes`, ''],
    },
    {
      k: 'interno', nombre: 'Apoyo en el partido', icono: 'gente', tip: 'Lo que te respaldan los tuyos. Decide el congreso y, ya como líder, que no te echen.',
      valor: s => s.carrera.interno, alerta: s => esLider(s) && s.carrera.interno < 35,
      delta: s => (esLider(s) ? ['mínimo 25', ''] : [`${LIDER_INICIAL}: ${s.carrera.apoyoLider}`, '']),
    },
    { k: 'fondos', nombre: 'Fondos', icono: 'moneda', tip: 'Dinero para mítines, cenas y campañas', valor: s => s.carrera.fondos, delta: () => ['+5 al mes', ''] },
    statCP,
    {
      k: 'encuesta', nombre: 'Encuesta', icono: 'grafica', tip: 'Escaños que sacaría hoy tu partido', valor: s => estimarVotos(s, false)[ID_JUGADOR],
      delta: s => [`ahora tiene ${s.escanos[ID_JUGADOR]}`, ''],
    },
    {
      k: 'cita', nombre: 'Próxima cita', icono: 'urna', tip: 'Lo siguiente que decide tu carrera',
      texto: s => (s.carrera.congresoMes ? `Congreso en ${plural(s.carrera.congresoMes - s.mes, 'mes', 'meses')}` : `Elecciones en ${plural(faltanElecciones(s), 'mes', 'meses')}`),
      alerta: s => (s.carrera.congresoMes ? s.carrera.congresoMes - s.mes : faltanElecciones(s)) <= 3,
    },
  ],
};

function construirCabecera(modo) {
  $('#stats').innerHTML = STATS[modo].map(s => `<div class="stat" id="st-${s.k}" title="${s.tip}">
    ${ico(s.icono)}<span class="k">${s.nombre}</span><span class="v"></span><span class="d"></span></div>`).join('');
  $('#btn-opciones').innerHTML = ico('engranaje');
  $('#btn-mes').innerHTML = `Siguiente mes ${ico('play')}`;
  ui.statsModo = modo;
  ui.previo = {};
}

function renderCabecera() {
  const s = estado, P = partidoInfo(s, ID_JUGADOR);
  if (ui.statsModo !== s.modo) construirCabecera(s.modo);
  const cargo = s.modo === 'gobierno' ? 'Gobierno de' : esLider(s) ? 'Lidera' : 'Diputado:';
  ponerHTML($('#marca'), `${logoPartido(P)}<div><b>${esc(P.nombre)}</b><span>${cargo} ${esc(s.config.lider)}</span></div>`);

  for (const st of STATS[s.modo]) {
    const caja = $('#st-' + st.k), el = $('.v', caja);
    if (st.texto) el.textContent = st.texto(s);
    else {
      const antes = ui.previo[st.k], ahora = st.valor(s);
      if (antes === undefined) fijarNumero(el, ahora, st.fmt);
      else if (antes !== ahora) {
        animarNumero(el, antes, ahora, st.fmt);
        flotar(caja, signo(ahora - antes), clase(ahora - antes));
      }
      ui.previo[st.k] = ahora;
    }
    if (st.delta) {
      const [texto, cls] = st.delta(s), d = $('.d', caja);
      d.textContent = texto;
      d.className = `d ${cls}`;
    }
    caja.classList.toggle('alerta', !!(st.alerta && st.alerta(s)));
  }
  const elFecha = $('#st-fecha .v');
  if (ui.previo.mes !== undefined && ui.previo.mes !== s.mes && animar()) {
    elFecha.classList.remove('giro');
    void elFecha.offsetWidth;
    elFecha.classList.add('giro');
  }
  ui.previo.mes = s.mes;
  $('#leg-barra').style.width = `${(s.mes - s.inicioLegislatura) / MESES_LEGISLATURA * 100}%`;
  $('#btn-mes').disabled = hayAlgoPendiente(s);
}

// ---------- Pestañas ----------

// Pestañas de cada modo: [nombre, icono]. En la carrera aún no hay economía, gabinete ni diplomacia.
const TABS_GOBIERNO = {
  provincia: ['Provincias', 'mapa'], economia: ['Economía', 'grafica'], parlamento: ['Parlamento', 'parlamento'],
  gobierno: ['Gobierno', 'maletin'], diplomacia: ['Diplomacia', 'bandera'], defensa: ['Defensa', 'espadas'], sociedad: ['Sociedad', 'gente'],
};
const TABS_CARRERA = {
  carrera: ['Carrera', 'usuario'], partido: ['Partido', 'bandera'], parlamento: ['Parlamento', 'parlamento'],
  sociedad: ['Votantes', 'gente'], provincia: ['Mapa', 'mapa'],
};
const tabsActuales = () => (estado && estado.modo === 'carrera' ? TABS_CARRERA : TABS_GOBIERNO);

function renderTabs() {
  const s = estado, tabs = tabsActuales();
  ponerHTML($('#tabs'), Object.keys(tabs).map(t => {
    const pendiente = (t === 'parlamento' && s.propuesta) || (t === 'gobierno' && !numMinistros(s)) || (t === 'defensa' && enGuerra(s))
      || (t === 'partido' && esLider(s) && s.carrera.promesas.length < MAX_PROMESAS);
    return `<button class="tab ${ui.tab === t ? 'activa' : ''}" data-a="tab" data-v="${t}" aria-pressed="${ui.tab === t}">
      ${ico(t === 'partido' ? s.config.emblema : tabs[t][1])}<span>${tabs[t][0]}</span>${pendiente ? '<i class="punto"></i>' : ''}</button>`;
  }).join(''));
}

function iconosEdificios(provId) {
  const ed = estado.edificios[provId];
  let h = '';
  for (const k in EDIFICIOS) for (let i = 0; i < ed[k]; i++) h += ico(EDIFICIOS[k].icono);
  for (const o of obrasEn(estado, provId)) h += ico(EDIFICIOS[o.tipo].icono, 'tenue');
  return h;
}

// Lo que dará un edificio cuando esté terminado, explicado antes de pagarlo.
function htmlPrevision(provId, tipo) {
  const s = estado, e = EDIFICIOS[tipo];
  if (s.ocupadas[provId] || requisitoTerreno(provId, tipo) || (e.unico && s.edificios[provId][tipo])) return '';
  const r = previsionEdificio(s, provId, tipo);
  const extras = [...Object.keys(r.grupos).map(g => chip(`${GRUPOS[g].nombre} ${signo(r.grupos[g])}`, clase(r.grupos[g]))),
    r.estabilidad ? chip(`Estabilidad ${signo(r.estabilidad)}`, clase(r.estabilidad)) : ''].join('');
  const pago = r.recupera ? ` Se paga sola en ${plural(r.recupera, 'mes', 'meses')}.` : r.dinero < 0 ? ' Cuesta más de lo que da: compénsalo con lo que aporta.' : '';
  return `<div class="prevision">
    <p><b class="cifra ${clase(r.dinero)}">${signo(r.dinero) || '±0'} al mes</b> al acabar la obra, ya descontado el mantenimiento.${pago}</p>
    ${r.notas.map(n => `<p>${n}</p>`).join('')}${extras ? `<div class="chips">${extras}</div>` : ''}</div>`;
}

function tabProvincia() {
  if (!ui.prov) {
    const obras = estado.obras.map(o => `<div class="fila"><span>${ico(EDIFICIOS[o.tipo].icono)} ${EDIFICIOS[o.tipo].nombre} en ${PROV_POR_ID[o.prov].nombre}</span><b>${plural(o.meses, 'mes', 'meses')}</b></div>`).join('');
    return `<div class="titulo-pais">${bandera(PAIS_JUGADOR.id, 'grande')}<div><h2>${esc(PAIS_JUGADOR.nombre)}</h2>
        <p class="nota">${(poblacionTotal(estado) / 1000).toFixed(1).replace('.', ',')} millones de habitantes en ${provinciasJugador().length} provincias</p></div></div>
      <p class="nota">Elige una provincia aquí o en el mapa para construir en ella.</p>
      <div class="lista-prov">${provinciasJugador().map(p => `<button class="fila-prov" data-a="prov" data-prov="${p.id}">
        <b>${p.capital && p.origen === PAIS_JUGADOR.id ? '★ ' : ''}${p.nombre}</b>${estado.ocupadas[p.id] ? chip('ocupada', 'neg') : ''}<span class="mini-icos">${iconosEdificios(p.id)}</span>
        <span class="cuenta">${solaresOcupados(estado, p.id)} de ${solaresDe(p)}</span></button>`).join('')}</div>
      ${obras ? `<h3>${ico('cono')} Obras en marcha</h3>${obras}` : ''}`;
  }
  const p = PROV_POR_ID[ui.prov], ed = estado.edificios[p.id];
  const solares = [];
  for (const k in EDIFICIOS) for (let i = 0; i < ed[k]; i++) solares.push(`<span class="solar lleno" title="${EDIFICIOS[k].nombre}">${ico(EDIFICIOS[k].icono)}</span>`);
  for (const o of obrasEn(estado, p.id)) solares.push(`<span class="solar obra" title="${EDIFICIOS[o.tipo].nombre} en obras">${ico(EDIFICIOS[o.tipo].icono)}<i>${o.meses}</i></span>`);
  while (solares.length < solaresDe(p)) solares.push('<span class="solar" title="Solar libre"></span>');
  const rasgos = [chip(`${p.pob.toLocaleString('es')} mil habitantes`)];
  if (p.fertil) rasgos.push(chip('Tierra fértil', 'pos'));
  if (p.mineral) rasgos.push(chip('Minerales', 'pos'));
  if (GEO.provs[p.id].costera) rasgos.push(chip('Salida al mar', 'pos'));
  if (estado.ocupadas[p.id]) rasgos.push(chip(`Ocupada por ${PAISES[estado.ocupadas[p.id]].nombre}: no produce nada`, 'neg'));
  if (anexionesRecientes(estado).some(a => a.prov === p.id)) rasgos.push(chip('Recién anexionada: hay resistencia', 'neg'));

  return `<button class="enlace" data-a="provTodas">${ico('atras')} Todas las provincias</button>
    <h2>${p.nombre}${p.capital && p.origen === PAIS_JUGADOR.id ? ' <small>capital</small>' : ''}</h2>
    <div class="chips">${rasgos.join('')}</div>
    <div class="solares">${solares.join('')}</div>
    <h3>Construir</h3>
    ${Object.keys(EDIFICIOS).map(k => {
      const e = EDIFICIOS[k];
      return `<div class="edif">
        <span class="edif-ico">${ico(e.icono)}</span>
        <div class="edif-txt"><b>${e.nombre}</b>${ed[k] ? `<span class="cuenta">${ed[k]} aquí</span>` : ''}
          <p>${e.desc}</p>${htmlPrevision(p.id, k)}
          <p class="edif-coste"><span>${ico('moneda')}${costeEdificio(estado, k)}</span><span>${ico('reloj')}${plural(e.meses, 'mes', 'meses')}</span><span>${e.mant} al mes de mantenimiento</span></p></div>
        <div class="edif-acc">${boton('Construir', { a: 'construir', prov: p.id, tipo: k }, puedeConstruir(estado, p.id, k), 'mini')}
          ${ed[k] ? `<button class="enlace peligro" data-a="demoler" data-prov="${p.id}" data-tipo="${k}">Derribar</button>` : ''}</div>
      </div>`;
    }).join('')}`;
}

function flujo(icono, nombre, valor, tope, texto, mal) {
  const max = Math.max(valor, tope, 1);
  return `<div class="flujo"><span class="edif-ico">${ico(icono)}</span><div>
    <div class="flujo-cab"><b>${nombre}</b><span class="${mal ? 'neg' : ''}">${texto}</span></div>
    <div class="flujo-barra ${mal ? 'mal' : ''}"><span style="width:${valor / max * 100}%"></span><i style="left:${tope / max * 100}%"></i></div></div></div>`;
}

// Gráfica de línea sencilla con los valores de los últimos meses.
function grafica(valores, sufijo = '', rango) {
  if (valores.length < 2) return '<p class="nota">La gráfica aparecerá cuando pasen unos meses.</p>';
  const W = 320, H = 72, lo = rango ? rango[0] : Math.min(...valores), hi = rango ? rango[1] : Math.max(...valores), tramo = (hi - lo) || 1;
  const x = i => i / (valores.length - 1) * (W - 10) + 5, y = v => H - 7 - (v - lo) / tramo * (H - 14);
  const pts = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), ult = valores.length - 1;
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución en el tiempo">
      <polygon class="g-area" points="5,${H - 2} ${pts} ${W - 5},${H - 2}"/><polyline class="g-linea" points="${pts}"/>
      <circle class="g-punto" cx="${x(ult).toFixed(1)}" cy="${y(valores[ult]).toFixed(1)}" r="3.500"/></svg>
    <div class="grafica-pie"><span>${fecha(estado.mes - ult)}: ${valores[0]}${sufijo}</span><span>Ahora: ${valores[ult]}${sufijo}</span></div>`;
}

function tabEconomia() {
  const e = calcularEconomia(estado), m = e.mods;
  const mods = [];
  if (Math.abs(m.impuestos - 1) > 0.004) mods.push(chip(`Impuestos ${pct(m.impuestos)}`, clase(m.impuestos - 1)));
  if (Math.abs(m.fabricas - 1) > 0.004) mods.push(chip(`Ingresos de fábricas ${pct(m.fabricas)}`, clase(m.fabricas - 1)));
  if (Math.abs(m.minas - 1) > 0.004) mods.push(chip(`Minas ${pct(m.minas)}`, clase(m.minas - 1)));
  if (Math.abs(m.export - 1) > 0.004) mods.push(chip(`Exportaciones ${pct(m.export)}`, clase(m.export - 1)));
  if (Math.abs(m.construccion - 1) > 0.004) mods.push(chip(`Construir ${pct(m.construccion)}`, clase(1 - m.construccion)));
  const lineas = filtro => e.lineas.filter(filtro).map(l => `<div class="fila"><span>${l.texto}</span><b class="${clase(l.v)}">${signo(l.v)}</b></div>`).join('');
  return `<h2>Economía</h2>
    <p class="nota">Las granjas dan alimentos, las minas materias primas y las fábricas las convierten en bienes. Lo que sobra se vende solo.</p>
    ${flujo('trigo', 'Alimentos', e.alimProd, e.alimCons, `${e.alimProd} producidos, ${e.alimCons} necesarios`, e.faltaComida)}
    ${flujo('pico', 'Materias primas', e.matProd, e.capacidad, `${e.matProd} producidas, las fábricas admiten ${e.capacidad}`, e.matProd < e.capacidad)}
    ${flujo('fabrica', 'Bienes', e.usadas, e.capacidad, `${e.usadas} fabricados de ${e.capacidad} posibles`, false)}
    ${mods.length ? `<div class="chips">${mods.join('')}</div>` : ''}
    <h3>Nivel de impuestos</h3>
    <p class="nota">Cambiarlo cuesta 1 de capital político. Cada opción dice lo que ganarías o perderías frente a hoy.</p>
    <div class="niveles">${Object.keys(NIVELES_IMPUESTOS).map(n => {
      const N = NIVELES_IMPUESTOS[n], actual = estado.impuestos === n;
      let viejo;
      const r = actual ? null : medirCambio(estado, () => { viejo = estado.impuestos; estado.impuestos = n; }, () => { estado.impuestos = viejo; });
      return `<button class="nivel ${actual ? 'activa' : ''}" data-a="impuestos" data-v="${n}" ${puedeCambiarImpuestos(estado, n).ok ? '' : 'disabled'} aria-pressed="${actual}">
        <b>${N.nombre}</b>${actual ? '<small>Los de ahora</small>'
          : `<span class="chips">${chip(`${signo(r.dinero) || '±0'} al mes`, clase(r.dinero))}${r.popularidad ? chip(`Popularidad ${signo(r.popularidad)}`, clase(r.popularidad)) : ''}</span>`}</button>`;
    }).join('')}</div>
    <h3>Ingresos del mes</h3>${lineas(l => l.v > 0)}
    <h3>Gastos del mes</h3>${lineas(l => l.v < 0)}
    <div class="fila total"><span>Balance mensual</span><b class="${clase(e.balance)}">${signo(e.balance) || '0'}</b></div>
    <h3>Evolución del tesoro</h3>${grafica(estado.historial.map(h => h.d))}
    <h3>Préstamos</h3>
    <p class="nota">Recibes 200 al momento y devuelves ${cuotaPrestamo(estado)} al mes durante 24 meses${contarEdificios(estado).banco ? ' (tu banco abarata la cuota)' : ''}. Tienes ${estado.prestamos.length} de 3.</p>
    ${boton(`${ico('moneda')} Pedir un préstamo`, { a: 'prestamo' }, puedePrestamo(estado))}`;
}

function hemicicloSVG(escanos) {
  const asientos = [];
  [19, 23, 27, 31].forEach((n, i) => {
    const radio = 62 + i * 17;
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (Math.PI * k) / (n - 1);
      asientos.push({ a, x: 150 + radio * Math.cos(a), y: 128 - radio * Math.sin(a) });
    }
  });
  asientos.sort((p, q) => q.a - p.a);
  let i = 0, html = '';
  for (const pid of ORDEN_HEMICICLO) {
    const color = partidoInfo(estado, pid).color;
    for (let k = 0; k < escanos[pid]; k++, i++) {
      html += `<circle class="esc" data-p="${pid}" cx="${asientos[i].x.toFixed(1)}" cy="${asientos[i].y.toFixed(1)}" r="5" fill="${color}" stroke="${color}"/>`;
    }
  }
  return `<svg class="hemiciclo" viewBox="0 0 300 136" role="img" aria-label="Reparto de escaños">${html}</svg>`;
}

function tabParlamento() {
  const s = estado, enc = estimarVotos(s, false), carrera = s.modo === 'carrera';
  const pronostico = carrera
    ? (ganaJugador(enc) ? 'Tu partido sería el más votado.' : `Hoy ganaría ${nombrePartido(masVotado(enc))}.`)
    : (ganaJugador(enc) ? 'Seguirías siendo el partido más votado.' : 'Con estos números perderías el gobierno.');
  let html = `<h2>Parlamento</h2>${hemicicloSVG(s.escanos)}
    <div class="leyenda">${ORDEN_HEMICICLO.map(pid => {
      const P = partidoInfo(s, pid), rel = P.jugador ? 0 : relacionPartido(s, pid);
      const gobierna = carrera ? pid === s.gobiernoIA : P.jugador;
      return `<div>${logoPartido(P, 'mini')}<b>${esc(P.nombre)}</b><span>${s.escanos[pid]} escaños</span>${gobierna ? chip('gobierna') : ''}
        ${P.jugador ? '<span class="cuenta">tu partido</span>' : `<span class="cuenta ${clase(rel)}">relación ${signo(rel) || '0'}</span>`}</div>`;
    }).join('')}</div>
    <div class="encuesta"><div class="tarjeta-cab"><b>Encuesta</b><span class="cuenta">si hoy hubiera elecciones</span></div>
      <div class="encuesta-barra">${ORDEN_HEMICICLO.map(pid => `<span style="width:${enc[pid]}%;background:${partidoInfo(s, pid).color}" title="${nombrePartido(pid)}: ${enc[pid]} escaños">${enc[pid]}</span>`).join('')}</div>
      <p class="nota">${pronostico}</p></div>`;
  if (carrera) {
    html += `<p class="nota">Desde la oposición también puedes llevar leyes al pleno. Si sale adelante ganas ${esLider(s) ? 5 : 8} de prestigio,
      4 de apoyo en el partido y mejor imagen entre quienes se benefician. Y seguirá en vigor cuando gobiernes, con su coste.</p>`;
  } else if (s.promesas.length) {
    const estados = { pendiente: '', cumplida: 'pos', rota: 'neg' };
    html += `<div class="tarjeta"><div class="tarjeta-cab"><b>Promesas electorales</b></div>
      ${s.promesas.map(p => `<div class="fila"><span>${LEY_POR_ID[p.ley].nombre}</span><b class="${estados[p.estado]}">${
        p.estado === 'pendiente' ? `te quedan ${plural(p.limite - s.mes, 'mes', 'meses')}` : p.estado}</b></div>`).join('')}
      <p class="nota">Cumplir una da +2 de apoyo en todos los grupos. Incumplirla quita 8 a quienes la esperaban.</p></div>`;
  }

  const prop = s.propuesta;
  if (prop) {
    const ley = LEY_POR_ID[prop.ley], r = intencionVoto(s, prop);
    const votoTxt = { si: 'A favor', no: 'En contra', abs: 'Se abstiene' };
    html += `<div class="tarjeta tramite">
      <div class="tarjeta-cab"><b>${prop.derogar ? 'Derogar: ' : ''}${ley.nombre}</b><span class="cuenta">en trámite</span></div>
      <div class="chips">${chipsLey(ley)}</div>
      ${leyContraria(s, prop) ? '<p class="motivo">Va contra las ideas de tu partido: llevarla al pleno cuesta 1 más.</p>' : ''}
      ${Object.keys(PARTIDOS).map(pid => {
        const P = partidoInfo(s, pid), d = r.partidos[pid];
        const porque = P.jugador
          ? (d.voto === 'si' ? 'Tu partido respalda la propuesta' : `La dirección no te respalda: te hacen falta ${APOYO_PARA_RESPALDO} de apoyo en el partido`)
          : `Ideología ${signo(d.ideologia) || '0'}, relación ${signo(d.relacion) || '0'}${d.negociado ? `, negociado +${d.negociado}` : ''}`;
        return `<div class="voto">${logoPartido(P, 'mini')}
          <div class="voto-txt"><b>${esc(P.siglas)}</b> ${s.escanos[pid]} escaños<small>${porque}</small></div>
          <div class="voto-der"><span class="intencion ${d.voto}">${votoTxt[d.voto]}</span>
          ${P.jugador ? '' : boton(`Negociar ${ico('estrella')}1`, { a: 'negociar', partido: pid }, puedeNegociar(s, pid), 'mini')}</div>
        </div>`;
      }).join('')}
      <p class="recuento">A favor <b>${r.si}</b>, en contra <b>${r.no}</b>, abstención <b>${r.abs}</b>.
        <b class="${r.aprueba ? 'pos' : 'neg'}">${r.aprueba ? 'Saldría aprobada.' : 'Sería rechazada.'}</b></p>
      <p class="nota">Un partido vota a favor con +1 o más y en contra con −1 o menos. Cada negociación suma +1.</p>
      <div class="botones">${boton(`Llevar a votación ${ico('estrella')}${costeVotar(s)}`, { a: 'votar' }, s.cp >= costeVotar(s) ? { ok: true } : { ok: false, motivo: 'Sin capital político' }, 'principal')}
      <button class="btn" data-a="retirar">Retirar</button></div>
    </div>`;
  }

  const tarjeta = (ley, activa) => `<div class="tarjeta ${activa ? 'vigente' : ''}">
      <div class="tarjeta-cab"><b>${ley.nombre}</b><span class="tags">${ley.tags.map(t => ETIQUETAS[t]).join(', ') || 'Neutral'}</span></div>
      <p>${ley.desc}</p><div class="chips">${chipsLey(ley)}</div>
      ${boton(activa ? 'Proponer derogarla' : 'Proponer', { a: 'proponer', ley: ley.id, derogar: activa ? 1 : 0 }, puedeProponer(s, ley.id, activa), 'mini')}
    </div>`;
  const filtros = { todas: 'Todas', vigor: `En vigor (${LEYES.filter(l => s.leyes[l.id]).length})`, ...CATEGORIAS_LEY };
  const visibles = LEYES.filter(l => ui.filtroLey === 'todas' || (ui.filtroLey === 'vigor' ? s.leyes[l.id] : l.cat === ui.filtroLey));
  visibles.sort((a, b) => (s.leyes[b.id] ? 1 : 0) - (s.leyes[a.id] ? 1 : 0));
  html += `<h3>Leyes</h3>
    <div class="filtros">${Object.keys(filtros).map(f => `<button class="${ui.filtroLey === f ? 'activa' : ''}" data-a="filtroLey" data-v="${f}" aria-pressed="${ui.filtroLey === f}">${filtros[f]}</button>`).join('')}</div>
    ${visibles.map(l => tarjeta(l, !!s.leyes[l.id])).join('') || '<p class="nota">Todavía no hay ninguna ley en vigor. Propón la primera.</p>'}`;
  return html;
}

function estrellas(n) { return `<span class="estrellas" aria-label="Nivel ${n} de 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`; }
function partidoDe(c) {
  if (!c.partido) return '<span class="tag-partido">Independiente</span>';
  const P = partidoInfo(estado, c.partido);
  return `<span class="tag-partido">${logoPartido(P, 'mini')}${esc(P.nombre)}</span>`;
}

function tabGobierno() {
  const s = estado;
  return `<h2>Gobierno</h2>
    <p class="nota">Cada ministro da una ventaja según su nivel y cobra 4 al mes. Si es de otro partido, tu relación con ese partido sube 12 mientras siga en el cargo.</p>
    ${Object.keys(CARTERAS).map(id => {
      const C = CARTERAS[id], actual = s.ministros[id] && CAND_POR_ID[s.ministros[id]];
      let cuerpo;
      if (actual) {
        const n = nivelCandidato(actual, id);
        cuerpo = `<div class="ministro"><div><b>${actual.nombre}</b>${estrellas(n)}<div>${partidoDe(actual)}</div></div>
          <button class="enlace peligro" data-a="destituir" data-v="${id}">Destituir</button></div>
          <div class="chips">${chip(C.efecto(n), 'pos')}</div>`;
      } else if (ui.cartera === id) {
        const libres = CANDIDATOS.filter(c => !Object.values(s.ministros).includes(c.id)).sort((a, b) => nivelCandidato(b, id) - nivelCandidato(a, id));
        cuerpo = `<div class="candidatos">${libres.map(c => {
          const n = nivelCandidato(c, id);
          return `<div class="candidato"><div><b>${c.nombre}</b>${estrellas(n)}<div>${partidoDe(c)}<small>${C.efecto(n)}</small></div></div>
            ${boton(`Nombrar ${ico('estrella')}1`, { a: 'nombrar', v: id, cand: c.id }, puedeNombrar(s, id, c.id), 'mini')}</div>`;
        }).join('')}</div><button class="enlace" data-a="abrirCartera" data-v="">Cerrar la lista</button>`;
      } else {
        cuerpo = `<div class="ministro"><span class="vacante">Cartera vacante</span>
          <button class="btn mini" data-a="abrirCartera" data-v="${id}">Elegir ministro</button></div>`;
      }
      return `<div class="tarjeta"><div class="tarjeta-cab"><b>${ico(C.icono)} ${C.nombre}</b></div>${cuerpo}</div>`;
    }).join('')}`;
}

// Países que importan ahora: los que te tocan, los de las islas y aquellos con los que tienes algo.
function paisCercano(s, pid) {
  const p = s.paises[pid];
  return s.guerras[pid] || p.alianza || p.tratado || PAISES[pid].isla || PAISES[pid].humano || fronterizos(PAIS_JUGADOR.id, pid);
}

function listaDiplomacia(s) {
  const peso = pid => (s.guerras[pid] ? 0 : s.paises[pid].alianza ? 1 : s.paises[pid].tratado ? 2 : fronterizos(PAIS_JUGADOR.id, pid) ? 3 : 4);
  const vivos = paisesVivos(s), muchos = vivos.length > 6;
  return vivos.filter(pid => !muchos || ui.filtroPais === 'todos' || paisCercano(s, pid))
    .sort((a, b) => peso(a) - peso(b) || s.paises[b].relacion - s.paises[a].relacion);
}

function tabDiplomacia() {
  const s = estado, caidos = Object.keys(s.paises).filter(pid => s.paises[pid].eliminado);
  const vivos = paisesVivos(s), cerca = vivos.filter(pid => paisCercano(s, pid)).length;
  const filtros = vivos.length > 6 ? `<div class="filtros">
    <button class="${ui.filtroPais !== 'todos' ? 'activa' : ''}" data-a="filtroPais" data-v="cerca">Vecinos y tratos (${cerca})</button>
    <button class="${ui.filtroPais === 'todos' ? 'activa' : ''}" data-a="filtroPais" data-v="todos">Todos (${vivos.length})</button></div>` : '';
  return `<h2>Diplomacia</h2>
    <p class="nota">Sube la relación para firmar tratados y alianzas. Con −40 o menos te imponen un embargo. Tu influencia es ${influencia(s)}.
      Quedan ${plural(vivos.length, 'país', 'países')} en el mundo: si los conquistas todos, ganas la partida.</p>
    ${filtros}
    ${listaDiplomacia(s).map(pid => {
      const P = PAISES[pid], p = s.paises[pid], guerra = s.guerras[pid];
      const rival = P.rival && s.paises[P.rival] && !s.paises[P.rival].eliminado ? PAISES[P.rival].nombre : null;
      // Guerras que este país libra con otros vecinos: se ven aquí y en las noticias.
      const enLiza = s.mundo.guerras.filter(g => g.a === pid || g.b === pid).map(g => PAISES[g.a === pid ? g.b : g.a].nombre);
      const estados = [P.humano && chip(`Jugador: ${esc(P.lider || '')}`, 'pos'), guerra && chip('En guerra contigo', 'neg'), p.tratado && chip(`Tratado: +${P.comercio} al mes`, 'pos'), p.alianza && chip('Aliado', 'pos'),
        !guerra && hayEmbargo(s, pid) && chip('Embargo: −20 al mes', 'neg'), P.requierePuerto && !p.tratado && !guerra && chip('Comerciar exige un puerto'),
        p.tregua > s.mes && chip(`Tregua hasta ${fecha(p.tregua)}`), enLiza.length && chip(`En guerra con ${enLiza.join(' y ')}`)].filter(Boolean).join('');
      const acciones = Object.keys(ACCIONES_DIPLO).map(a => {
        const A = ACCIONES_DIPLO[a], desc = a === 'delegacion' ? `Relación +${mejoraDelegacion(s)}.` : A.desc;
        const coste = `${ico('estrella')}${A.cp}${A.dinero ? ` ${ico('moneda')}${A.dinero}` : ''}`;
        const nombre = P.humano && (a === 'tratado' || a === 'alianza') ? `Proponer ${A.nombre.toLowerCase()}` : A.nombre;
        return `<div title="${P.humano && nombre !== A.nombre ? 'Le llega como propuesta y decide si la acepta.' : desc}">${boton(`${nombre} <span class="coste">${coste}</span>`, { a: 'diplo', pais: pid, accion: a }, puedeDiplo(s, pid, a), 'mini')}</div>`;
      }).join('');
      return `<div class="tarjeta ${ui.pais === pid ? 'resaltada' : ''}">
        <div class="tarjeta-cab"><b>${bandera(pid)} ${P.nombre}</b><span class="cuenta ${clase(p.relacion)}">relación ${signo(p.relacion) || '0'}</span></div>
        <div class="barra-rel"><span style="left:${(p.relacion + 100) / 2}%"></span></div>
        <p>${P.gobierno}. ${P.desc}${rival ? ` Rival de ${rival}: lo que le das a uno molesta al otro.` : ''}</p>
        <div class="fila"><span>${ico('espadas')} Ejército</span><b>${p.ejercito}, y tu fuerza es ${fuerzaPropia(s)}</b></div>
        <div class="fila"><span>${ico('mapa')} Provincias</span><b>${provinciasDe(pid).length}</b></div>
        ${estados ? `<div class="chips">${estados}</div>` : ''}
        ${guerra ? `<button class="btn mini principal" data-a="tab" data-v="defensa">${ico('espadas')} Ir al frente</button>`
          : `<div class="acciones">${acciones}</div>
            <div class="declarar">${boton(`${ico('espadas')} Declarar la guerra <span class="coste">${ico('estrella')}${CP_DECLARAR_GUERRA}</span>`, { a: 'abrir', v: 'guerra:' + pid }, puedeDeclararGuerra(s, pid), 'mini peligro')}</div>`}
      </div>`;
    }).join('')}
    ${caidos.length ? `<p class="nota">Ya no existen: ${caidos.map(pid => PAISES[pid].nombre).join(', ')}.</p>` : ''}`;
}

function razones(lista) {
  return lista.length ? lista.map(r => `<span class="razon ${clase(r.v)}">${r.texto} ${signo(r.v)}</span>`).join('') : '<span class="razon">Nada lo mueve ahora mismo</span>';
}
function barraApoyo(valor, objetivo) {
  return `<div class="barra-apoyo"><span style="width:${valor}%"></span><i style="left:${objetivo}%" title="Tiende hacia ${objetivo}"></i></div>`;
}

function tabSociedad() {
  const s = estado, mitin = puedeMitin(s), carrera = s.modo === 'carrera', base = basePropia(s);
  // Cuánto tira tu partido en cada grupo por lo que es, al margen de lo que hagas.
  const tiron = g => (base[g] >= 40 ? chip('Tu partido tiene mucho tirón aquí', 'pos') : base[g] <= 26 ? chip('Tu partido tiene poco tirón aquí', 'neg') : '');
  const est = carrera ? null : objetivoEstabilidad(s);
  return `<h2>${carrera ? 'Votantes' : 'Sociedad'}</h2>
    <p class="nota">${carrera ? 'Lo que cada grupo apoya a tu partido. Se' : 'Cada grupo se'} mueve poco a poco hacia la marca vertical.
      Un mitin cuesta 40 y da +5 de apoyo al momento: uno al mes.</p>
    <div class="tarjeta"><div class="tarjeta-cab"><b>${carrera ? 'Apoyo medio a tu partido' : 'Popularidad'}</b><span class="cuenta">${popularidad(s)}%</span></div>
      ${grafica(s.historial.map(h => h.p), '%', [20, 80])}</div>
    ${Object.keys(GRUPOS).map(g => {
      const G = GRUPOS[g], o = objetivoGrupo(s, g);
      return `<div class="tarjeta">
        <div class="tarjeta-cab"><b>${ico(G.icono)} ${G.nombre}</b><span class="cuenta">${Math.round(G.peso * 100)}% de la población, apoyo ${s.grupos[g]}</span></div>
        ${barraApoyo(s.grupos[g], o.valor)}<div class="razones">${razones(o.razones)}</div>${tiron(g) ? `<div class="chips">${tiron(g)}</div>` : ''}
        ${boton(`${ico('megafono')} Dar un mitin <span class="coste">${ico('estrella')}1 ${ico('moneda')}40</span>`, { a: 'mitin', v: g }, mitin, 'mini')}</div>`;
    }).join('')}
    ${est ? `<div class="tarjeta">
      <div class="tarjeta-cab"><b>${ico('escudo')} Estabilidad</b><span class="cuenta">${s.estabilidad}</span></div>
      ${barraApoyo(s.estabilidad, est.valor)}<div class="razones">${razones(est.razones)}</div></div>` : ''}`;
}

function renderContenido() {
  const carrera = estado.modo === 'carrera';
  const vistas = {
    provincia: carrera ? tabMapaElectoral : tabProvincia, economia: tabEconomia, parlamento: tabParlamento, gobierno: tabGobierno,
    diplomacia: tabDiplomacia, defensa: tabDefensa, sociedad: tabSociedad, carrera: tabCarrera, partido: tabPartido,
  };
  const cont = $('#contenido');
  ponerHTML(cont, vistas[ui.tab]());
  if (ui.animTab) {
    cont.classList.remove('entra');
    void cont.offsetWidth;
    cont.classList.add('entra');
    ui.animTab = false;
  }
}

// ---------- Bajo el mapa: asesora, objetivos y prensa ----------

function renderLateral() {
  const s = estado, c = opciones.asesora ? consejo(s) : null;
  ponerHTML($('#asesora'), c ? `${ico('bombilla')}<p><b>Tu asesora:</b> ${c.texto}</p>
    <button class="btn mini" data-a="tab" data-v="${c.tab}">Ir a ${tabsActuales()[c.tab][0]}</button>` : '');
  $('#asesora').hidden = !c;

  const lista = objetivosActuales(s), pendientes = lista.filter(o => !s.objetivos[o.id]), hechos = lista.length - pendientes.length;
  ponerHTML($('#objetivos'), `<h3>${ico('diana')} Objetivos <span class="cuenta">${hechos} de ${lista.length}</span></h3>
    <ul class="objetivos">${pendientes.slice(0, 5).map(o => `<li><span>${o.texto}</span><span class="chips">${chipsEfectos(o.premio)}</span></li>`).join('')
      || '<li>Has cumplido todos los objetivos.</li>'}</ul>`);

  const [tit, sub] = titular(s);
  let ultimo = -1;
  ponerHTML($('#prensa'), `<article class="diario"><header><b>El Diario de ${esc(PAIS_JUGADOR.nombre)}</b><span>${fecha(s.mes)}</span></header>
      <h4>${esc(tit)}</h4><p>${esc(sub)}</p></article>
    <div class="noticias">${s.noticias.slice(0, 12).map(n => {
      const cab = n.mes !== ultimo ? `<div class="noticia-mes">${fecha(n.mes)}</div>` : '';
      ultimo = n.mes;
      return `${cab}<div class="noticia ${n.tipo}">${esc(n.texto)}</div>`;
    }).join('')}</div>`);
}

// ---------- Ventanas ----------

function htmlVoto() {
  const v = estado.resultadoVoto, ley = LEY_POR_ID[v.ley];
  const txt = { si: 'A favor', no: 'En contra', abs: 'Abstención' };
  const autor = v.autor && v.autor !== ID_JUGADOR ? `<p class="nota">Ley del gobierno de ${nombrePartido(v.autor)}.</p>` : '';
  return `<h2>${v.derogar ? 'Derogar: ' : ''}${ley.nombre}</h2>${autor}
    <div class="voto-escena">${hemicicloSVG(v.escanos)}
      <div id="sello" class="sello ${v.aprueba ? 'si' : 'no'}">${v.aprueba ? (v.derogar ? 'Derogada' : 'Aprobada') : 'Rechazada'}</div></div>
    <div class="voto-cuentas">
      <div class="vc si"><b id="cuenta-si">0</b><span>A favor</span></div>
      <div class="vc no"><b id="cuenta-no">0</b><span>En contra</span></div>
      <div class="vc abs"><b id="cuenta-abs">0</b><span>Abstención</span></div></div>
    <div class="voto-partidos">${ORDEN_HEMICICLO.map(pid => {
      const P = partidoInfo(estado, pid);
      return `<div class="vp" data-p="${pid}">${logoPartido(P, 'mini')}<span>${esc(P.siglas)}, ${v.escanos[pid]}</span><b class="intencion ${v.votos[pid]}">${txt[v.votos[pid]]}</b></div>`;
    }).join('')}</div>
    <button class="btn principal" id="btn-voto" data-a="saltarVoto">Saltar el recuento</button>`;
}

function revelarPartido(pid, cuenta, conAnim) {
  const v = estado.resultadoVoto, voto = v.votos[pid];
  $$(`#modal .esc[data-p="${pid}"]`).forEach((c, i) => {
    c.style.transitionDelay = conAnim ? `${i * 14}ms` : '0ms';
    c.classList.add('v-' + voto);
  });
  const fila = $(`#modal .vp[data-p="${pid}"]`);
  if (fila) fila.classList.add('visto');
  const antes = cuenta[voto];
  cuenta[voto] += v.escanos[pid];
  if (conAnim) { animarNumero($('#cuenta-' + voto), antes, cuenta[voto]); Sonido.tocar('voto'); }
}

function finVotacion() {
  const v = estado && estado.resultadoVoto;
  if (!v || ui.animVoto === 'hecha') return;
  ui.timers.forEach(clearTimeout);
  ui.timers = [];
  const cuenta = { si: 0, no: 0, abs: 0 };
  ORDEN_HEMICICLO.forEach(pid => revelarPartido(pid, cuenta, false));
  for (const k in cuenta) fijarNumero($('#cuenta-' + k), v[k]);
  $('#sello').classList.add('visto');
  const b = $('#btn-voto');
  b.textContent = 'Continuar';
  b.dataset.a = 'cerrarVoto';
  Sonido.tocar(v.aprueba ? 'aprobado' : 'rechazado');
  ui.animVoto = 'hecha';
}

// El recuento: cada partido vota por turno y sus escaños cambian de color.
function animarVotacion() {
  ui.animVoto = 'curso';
  if (!animar()) return finVotacion();
  const cuenta = { si: 0, no: 0, abs: 0 };
  let t = 450;
  ORDEN_HEMICICLO.forEach(pid => {
    ui.timers.push(setTimeout(() => revelarPartido(pid, cuenta, true), t));
    t += 800;
  });
  ui.timers.push(setTimeout(finVotacion, t + 250));
}

function htmlElecciones() {
  const s = estado, e = s.elecciones;
  const orden = Object.keys(PARTIDOS).sort((a, b) => e.escanos[b] - e.escanos[a]);
  return `<h2>Noche electoral</h2>
    <p class="nota">Recuento de los 100 escaños del Parlamento.</p>
    <div class="resultados">${orden.map(pid => {
      const P = partidoInfo(s, pid), dif = e.escanos[pid] - e.antes[pid];
      return `<div class="res" data-p="${pid}">${logoPartido(P, 'mini')}<span class="res-n">${esc(P.nombre)}</span>
        <div class="res-b"><span style="width:${e.antes[pid]}%;background:${P.color}"></span></div>
        <b>${e.antes[pid]}</b><small class="${clase(dif)}">${signo(dif) || '='}</small></div>`;
    }).join('')}</div>
    ${e.carrera ? veredictoCarrera(e, orden[0]) : `<p id="veredicto" class="veredicto ${e.gana ? 'pos' : 'neg'}">${e.gana
      ? `${nombrePartido(ID_JUGADOR)} es la fuerza con más escaños. Sigues al frente del gobierno.`
      : `${nombrePartido(orden[0])} te ha superado. Pasas a la oposición y la partida termina.`}</p>
    ${e.gana ? '<button class="btn principal" data-a="cerrarElecciones">Empezar la legislatura</button>' : botonesFin()}`}`;
}

// Final de la noche electoral cuando aún no gobiernas: ganas, sigues en la oposición o te echan.
function veredictoCarrera(e, primero) {
  const s = estado;
  if (e.gana) {
    return `<p id="veredicto" class="veredicto pos">${nombrePartido(ID_JUGADOR)} gana las elecciones. Vas a ser jefe de gobierno de ${esc(PAIS_JUGADOR.nombre)}.</p>
      <button class="btn principal" data-a="formarGobierno">Formar gobierno</button>`;
  }
  if (s.fin) {
    return `<p id="veredicto" class="veredicto neg">Gana ${nombrePartido(primero)} y tu partido no te perdona la derrota: pierdes el liderazgo.</p>${botonesFin()}`;
  }
  return `<p id="veredicto" class="veredicto neg">Gana ${nombrePartido(primero)}. Sigues como líder de la oposición, con el partido algo más inquieto.
      Habrá elecciones de nuevo dentro de ${MESES_LEGISLATURA} meses.</p>
    <button class="btn principal" data-a="cerrarElecciones">Seguir en la oposición</button>`;
}

function animarElecciones() {
  ui.animElec = 'hecha';
  const e = estado.elecciones, conAnim = animar();
  const mostrar = () => {
    const v = $('#veredicto');
    if (!v || !estado.elecciones) return;
    v.classList.add('visto');
    Sonido.tocar(e.gana ? 'victoria' : 'derrota');
  };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('#modal .res').forEach(fila => {
      const pid = fila.dataset.p;
      $('.res-b span', fila).style.width = e.escanos[pid] + '%';
      animarNumero($('b', fila), e.antes[pid], e.escanos[pid], undefined, 1500);
    });
  }));
  ui.timers.push(setTimeout(mostrar, conAnim ? 1700 : 0));
}

function botonesFin() {
  return `<div class="botones"><button class="btn principal" data-a="irNueva">Crear partida nueva</button>
    <button class="btn" data-a="salirMenu">Salir al menú</button></div>`;
}

function htmlFin() {
  const s = estado;
  const fin = {
    bancarrota: ['Bancarrota', 'La deuda es impagable y el Estado quiebra. Tu gobierno dimite.'],
    revuelta: ['El gobierno cae', 'La inestabilidad desborda las calles y pierdes el control del país.'],
    elecciones: ['Derrota electoral', 'Has perdido las elecciones.'],
    congreso: ['Tu carrera se estanca', `El partido ha preferido dos veces a ${LIDER_INICIAL}. Sin dirigirlo no podrás ser candidato.`],
    destituido: ['El partido te retira su confianza', 'Los tuyos convocan un congreso de urgencia y eligen a otro líder.'],
    conquistado: ['El país ha caído', 'Las tropas enemigas ocupan todas tus provincias y tu gobierno se rinde.'],
    victoria: ['Has unificado el mundo', `No queda ningún país en pie: todo el mapa es ${esc(PAIS_JUGADOR.nombre)}, y ${esc(s.config.lider)} pasa a la historia.`],
  }[s.fin];
  const dato = (n, t) => `<div><b>${n}</b><span>${t}</span></div>`;
  const edificios = Object.values(contarEdificios(s)).reduce((a, n) => a + n, 0);
  const resumen = s.modo === 'carrera'
    ? `${dato(s.mes, 'meses de carrera')}${dato(s.carrera.prestigio, 'de prestigio')}${dato(s.cuenta.leyes, 'leyes aprobadas')}${dato(s.escanos[ID_JUGADOR], 'escaños')}`
    : `${dato(s.mes - s.mesGobierno, 'meses en el poder')}${dato(s.cuenta.elecciones, 'elecciones ganadas')}${dato(s.cuenta.conquistas, 'provincias conquistadas')}${dato(edificios, 'edificios')}`;
  const gana = s.fin === 'victoria';
  return `${gana ? `<div class="corona">${ico('corona')}</div>` : ''}<h2 class="${gana ? 'pos' : 'neg'}">${fin[0]}</h2><p>${fin[1]}</p>
    <div class="resumen-fin">${resumen}</div>${botonesFin()}`;
}

function htmlEvento() {
  const s = estado, ev = s.evento, e = EVENTO_POR_ID[ev.id], t = x => esc(textoEvento(s, ev, x));
  return `<div class="ev-cab"><span class="ev-ico">${ico(e.icono)}</span><h2>${t(e.titulo)}</h2></div>
    <p>${t(e.texto)}</p>
    ${e.opciones.map((o, i) => `<button class="opcion" data-a="evento" data-i="${i}"><b>${t(o.texto)}</b><span class="chips">${chipsEfectos(o.efectos, ev)}</span></button>`).join('')}`;
}

function renderModal() {
  const s = estado, enJuego = ui.pantalla === 'juego' && s;
  let tipo = '', html = '';
  if (ui.ventana === 'opciones') [tipo, html] = ['opciones', htmlOpciones()];
  else if (ui.ventana === 'ayuda') [tipo, html] = ['ayuda', htmlAyuda(false)];
  else if (ui.ventana === 'multi') [tipo, html] = ['multi', htmlMulti()];
  else if (ui.ventana === 'confirmar') [tipo, html] = ['confirmar', htmlConfirmar()];
  else if (enJuego && ui.ventana && ui.ventana.startsWith('guerra:')) [tipo, html] = ['declarar', htmlDeclarar(ui.ventana.slice(7))];
  else if (enJuego) {
    // Los partes de batalla y las votaciones van antes que nada: lo que venga después puede ser un final.
    if (s.batallas.length) [tipo, html] = ['batalla', htmlBatalla()];
    else if (s.resultadoVoto) [tipo, html] = ['voto', htmlVoto()];
    else if (s.elecciones) [tipo, html] = ['elecciones', htmlElecciones()];
    else if (s.congreso) [tipo, html] = ['congreso', htmlCongreso()];
    else if (s.fin) [tipo, html] = ['fin', htmlFin()];
    else if (s.propuestas && s.propuestas.length) [tipo, html] = ['propuesta', htmlPropuesta()];
    else if (s.votacion) [tipo, html] = ['votacion', htmlVotacionGobierno()];
    else if (s.evento) [tipo, html] = ['evento', htmlEvento()];
    else if (ui.ventana === 'intro') [tipo, html] = ['intro', htmlAyuda(true)];
  }
  const modal = $('#modal');
  modal.hidden = !html;
  if (!html) { modal.innerHTML = ''; modal._clave = ''; ui.modalTipo = ''; return; }
  if (modal._clave !== html) {
    modal._clave = html;
    if (tipo === 'batalla') Sonido.tocar(s.batallas[0].exito ? 'aprobado' : 'rechazado');
    if (tipo === 'fin' && tipo !== ui.modalTipo) Sonido.tocar(s.fin === 'victoria' ? 'victoria' : 'derrota');
    modal.innerHTML = `<div class="ventana v-${tipo} ${tipo !== ui.modalTipo ? 'pop' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    if (tipo !== ui.modalTipo) {
      const foco = $('#modal .btn.principal, #modal .opcion');
      if (foco) foco.focus({ preventScroll: true });
    }
  }
  ui.modalTipo = tipo;
  if (tipo === 'voto' && !ui.animVoto) animarVotacion();
  if (tipo === 'elecciones' && !ui.animElec) animarElecciones();
}

// ---------- Bucle de interfaz ----------

function render() {
  const enMenu = ui.pantalla === 'menu' || ui.pantalla === 'sala';
  $('#pantalla-menu').hidden = !enMenu;
  $('#pantalla-juego').hidden = ui.pantalla !== 'juego';
  if (ui.pantalla === 'menu') renderMenu();
  else if (ui.pantalla === 'sala') renderSala();
  else if (estado) {
    // Al pasar de la carrera al gobierno cambian las pestañas y las vistas del mapa.
    if (!(ui.tab in tabsActuales())) { ui.tab = Object.keys(tabsActuales())[0]; ui.animTab = true; }
    if (!modosMapa().includes(ui.modoMapa)) ui.modoMapa = 'politico';
    renderCabecera();
    renderTurno();
    renderMapa();
    renderTabs();
    renderContenido();
    renderLateral();
    if (enRed()) avisosDeRed();
    document.documentElement.style.setProperty('--alto-cab', $('.cabecera').offsetHeight + 'px');
  }
  renderModal();
}

function entrarJuego() {
  ui.timers.forEach(clearTimeout);
  const carrera = estado.modo === 'carrera';
  Object.assign(ui, {
    pantalla: 'juego', ventana: null, tab: carrera ? 'carrera' : 'provincia', animTab: true, prov: null, pais: null,
    modoMapa: carrera ? 'electoral' : 'politico', filtroLey: 'todas', cartera: null, previo: {}, pips: null,
    animVoto: '', animElec: '', timers: [], objetivo: null, mapaVersion: -1, vista: null, filtroPais: 'cerca', ultimo: null,
  });
  scrollTo(0, 0);
}

function irAlMenu(menu) {
  Object.assign(ui, { pantalla: 'menu', menu, menuAnim: true, ventana: null });
  scrollTo(0, 0);
}

// Una acción de la partida. En solitario se aplica aquí; en multijugador la aplica el anfitrión.
function jugar(nombre, d = {}) {
  if (enRed()) enviarAccion(nombre, { ...d });
  else REGLAS[nombre](estado, d);
}

const acciones = {
  // Menú y ventanas
  menuNueva: () => { Object.assign(ui, { menu: 'nueva', paso: 1, menuAnim: true }); },
  menuPrincipal: () => { ui.menu = 'principal'; ui.menuAnim = true; RED.error = ''; },
  paso: d => { ui.paso = +d.v; scrollTo(0, 0); },
  // Los valores llegan como texto desde el HTML: algunos campos son números o un sí/no.
  cfg: d => { ui.cfg[d.k] = d.k === 'legislatura' ? +d.v : d.k === 'propio' ? d.v === '1' : d.v; },
  cfgPrincipio: d => {
    const p = ui.cfg.principios, i = p.indexOf(d.v);
    if (i >= 0) p.splice(i, 1); else if (p.length < MAX_PRINCIPIOS) p.push(d.v);
  },
  otroMapa: () => { ui.cfg.semilla = semillaAlAzar(); },
  empezar: () => {
    const c = ui.cfg;
    c.lider = c.lider.trim() || CONFIG_BASE.lider;
    c.partido = c.partido.trim() || CONFIG_BASE.partido;
    c.pais = c.pais.trim() || CONFIG_BASE.pais;
    estado = nuevaPartida({ ...c, principios: [...c.principios] });
    entrarJuego();
    ui.ventana = 'intro';
    ui.cfg.semilla = semillaAlAzar();   // la próxima partida nueva empezará con otro mapa
  },
  continuar: () => {
    estado = cargar();
    if (!estado) return;
    activarPartida(estado);
    entrarJuego();
  },
  abrir: d => { ui.ventana = d.v; },
  cerrar: () => { ui.ventana = null; },
  opcion: d => { opciones[d.k] = d.v; aplicarOpciones(); },
  alternar: d => { opciones[d.k] = !opciones[d.k]; aplicarOpciones(); },
  borrarPartida: () => { borrarGuardado(); },
  salirMenu: () => { if (enRed()) cerrarRed(); salirAlMenu(); },
  irNueva: () => irAlMenu('nueva'),

  // Multijugador: menú y sala
  menuMulti: () => { Object.assign(ui, { menu: 'multi', menuAnim: true }); RED.error = ''; },
  crearSala: () => crearSala(),
  reanudarSala: () => { const g = salaGuardada(); if (g) crearSala(g); },
  unirse: () => { ui.codigoSala = ($('#codigo-sala') || {}).value || ui.codigoSala || ''; unirseASala(ui.codigoSala); },
  salaCfg: d => { if (soyAnfitrion()) cambiarConfigSala(d.k, d.v); },
  otroMapaSala: () => { if (soyAnfitrion()) cambiarConfigSala('semilla', semillaAlAzar()); },
  empezarSala: () => { if (soyAnfitrion()) empezarPartida(); },
  salirSala: () => { cerrarRed(); salirAlMenu(); },
  copiarCodigo: () => {
    try { navigator.clipboard.writeText(RED.codigo); aviso(`Código ${RED.codigo} copiado`, 'bien', 'check'); } catch (e) { /* sin portapapeles */ }
  },

  // Partida
  tab: d => { if (ui.tab !== d.v) ui.animTab = true; ui.tab = d.v; },
  prov: d => {
    const p = PROV_POR_ID[d.prov];
    if (p.pais === PAIS_JUGADOR.id) { ui.prov = p.id; ui.tab = 'provincia'; ui.animTab = true; }
    // La diplomacia solo existe cuando gobiernas.
    else if (estado.modo === 'gobierno') {
      ui.animTab = true;
      // En guerra, pulsar una provincia enemiga lleva al frente; en paz, a la diplomacia.
      if (estado.guerras[p.pais]) Object.assign(ui, { tab: 'defensa', objetivo: p.id });
      else Object.assign(ui, { tab: 'diplomacia', pais: p.pais, filtroPais: 'todos' });
    }
  },
  provTodas: () => { ui.prov = null; },
  modoMapa: d => { ui.modoMapa = d.v; },
  zoom: d => { if (d.v === 'mas') zoomMapa(1 / 1.4); else if (d.v === 'menos') zoomMapa(1.4); else ajustarVista(GEO.viewBox); },
  filtroPais: d => { ui.filtroPais = d.v; },
  filtroLey: d => { ui.filtroLey = d.v; },
  abrirCartera: d => { ui.cartera = d.v || null; },
  saltarVoto: () => finVotacion(),
  // En multijugador, «siguiente mes» es decir que estás listo.
  mes: () => { if (enRed()) alternarListo(); else jugar('mes'); },

  impuestos: d => jugar('impuestos', d),
  construir: d => jugar('construir', d),
  demoler: d => jugar('demoler', d),
  prestamo: () => jugar('prestamo'),
  proponer: d => jugar('proponer', d),
  retirar: () => jugar('retirar'),
  negociar: d => jugar('negociar', d),
  votar: () => jugar('votar'),
  cerrarVoto: () => { jugar('cerrarVoto'); ui.animVoto = ''; },
  nombrar: d => { jugar('nombrar', d); ui.cartera = null; },
  destituir: d => jugar('destituir', d),
  diplo: d => jugar('diplo', d),
  responder: d => jugar('responder', d),
  mitin: d => jugar('mitin', d),
  evento: d => jugar('evento', d),
  cerrarElecciones: () => { jugar('cerrarElecciones'); ui.animElec = ''; },

  // Ejército y guerra
  reclutar: () => jugar('reclutar'),
  licenciar: () => jugar('licenciar'),
  declarar: d => {
    if (!puedeDeclararGuerra(estado, d.v).ok) return;
    jugar('declarar', d);
    Object.assign(ui, { ventana: null, tab: 'defensa', animTab: true, objetivo: null });
  },
  atacar: d => { ui.objetivo = d.v; jugar('atacar', d); },
  paz: d => jugar('paz', d),
  cerrarBatalla: () => jugar('cerrarBatalla'),

  // Carrera política
  accionCarrera: d => jugar('accionCarrera', d),
  prometer: d => jugar('prometer', d),
  postura: d => jugar('postura', d),
  cerrarCongreso: () => jugar('cerrarCongreso'),
  formarGobierno: () => {
    jugar('formarGobierno');
    Object.assign(ui, { animElec: '', prov: null, tab: 'provincia', animTab: true, modoMapa: 'politico', ventana: 'intro' });
  },
};

const SONIDOS = {
  tab: 'pestana', construir: 'construir', demoler: 'construir', mes: 'mes', prestamo: 'moneda', nombrar: 'moneda', mitin: 'evento',
  accionCarrera: 'moneda', prometer: 'moneda', formarGobierno: 'victoria', saltarVoto: '', votar: '', postura: '',
  reclutar: 'construir', declarar: 'derrota', paz: 'moneda', atacar: '', impuestos: 'moneda', zoom: 'pestana', responder: 'moneda',
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled || !acciones[el.dataset.a]) return;
  const nombre = el.dataset.a;
  if (SONIDOS[nombre] !== '') Sonido.tocar(SONIDOS[nombre] || 'clic');

  // En multijugador lo que pasa en la partida llega del anfitrión: los avisos se sacan al recibirlo.
  if (enRed() || ui.pantalla === 'sala') {
    acciones[nombre](el.dataset);
    if (ui.pantalla === 'sala' && (nombre === 'cfg' || nombre === 'cfgPrincipio')) enviarPerfil();
    render();
    return;
  }

  const enJuego = ui.pantalla === 'juego' && estado;
  const nAntes = enJuego ? estado.nNoticias : 0, pendiente = enJuego && hayAlgoPendiente(estado);
  const congresoAntes = enJuego && estado.congreso;
  acciones[nombre](el.dataset);

  if (ui.pantalla === 'juego' && estado) {
    if (enJuego && (nombre === 'mes' || nombre === 'evento') && !estado.elecciones && !estado.congreso) {
      estado.noticias.slice(0, estado.nNoticias - nAntes).filter(n => n.tipo).slice(0, 3).reverse()
        .forEach(n => aviso(esc(n.texto), n.tipo, n.tipo === 'bien' ? 'check' : n.tipo === 'mundo' ? 'globo' : 'periodico'));
    }
    // Con el recuento de una votación en pantalla se espera a cerrarlo para no destripar el resultado.
    if (!estado.resultadoVoto) {
      for (const o of revisarObjetivos(estado)) { aviso(`Objetivo cumplido: ${o.texto}`, 'logro', 'diana'); Sonido.tocar('logro'); }
    }
    if (!pendiente && (estado.evento || estado.votacion)) setTimeout(() => Sonido.tocar('evento'), 220);
    if (!congresoAntes && estado.congreso) setTimeout(() => Sonido.tocar(estado.congreso && estado.congreso.gana ? 'victoria' : 'derrota'), 300);
    guardar(estado);
  }
  render();
});

document.addEventListener('input', ev => {
  const t = ev.target;
  // Mientras se escribe solo se retoca la vista previa: redibujar el formulario quitaría el foco.
  if (t.id === 'cfg-lider') ui.cfg.lider = t.value;
  else if (t.id === 'cfg-partido') { ui.cfg.partido = t.value; $('#vp-partido').textContent = t.value.trim() || '…'; }
  else if (t.id === 'cfg-pais') {
    ui.cfg.pais = t.value;
    const rotulo = $('.vista-mundo .propio');
    if (rotulo) rotulo.textContent = (t.value.trim() || 'Tu país').toUpperCase();
  } else if (t.id === 'cfg-semilla') {
    const n = parseInt(t.value.replace(/\D/g, ''), 10);
    if (n) { ui.cfg.semilla = n; ponerHTML($('#menu-hero'), vistaMundo()); }
  } else if (t.id === 'codigo-sala') ui.codigoSala = t.value.toUpperCase();
  else if (t.id === 'op-volumen') { opciones.volumen = t.value / 100; aplicarOpciones(); }
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'op-volumen') Sonido.tocar('moneda');
  // En la sala, el nombre del jugador, del partido y del país se mandan al terminar de escribirlos.
  if (ui.pantalla === 'sala' && /^cfg-(lider|partido|pais)$/.test(ev.target.id)) { enviarPerfil(); render(); }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'codigo-sala') { acciones.unirse(); return; }
  if (ev.key === 'Escape' && ui.ventana && ui.ventana !== 'intro') { ui.ventana = null; render(); return; }
  if (ui.pantalla !== 'juego' || !$('#modal').hidden || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
  if (ev.key === ' ' && ev.target.tagName !== 'BUTTON') { ev.preventDefault(); $('#btn-mes').click(); return; }
  const tab = ev.key.length === 1 ? Object.keys(tabsActuales())['1234567'.indexOf(ev.key)] : null;
  if (tab) { ui.tab = tab; ui.animTab = true; render(); }
});

aplicarOpciones();
prepararTooltip();
render();
