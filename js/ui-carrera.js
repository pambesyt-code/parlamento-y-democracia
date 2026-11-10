'use strict';
// Pantallas de la carrera política: tu trayectoria, el partido, el mapa electoral
// y las ventanas del congreso y de las leyes del gobierno.

// Barras enfrentadas: [nombre, valor, color]. max es el valor que llena la barra.
function duelo(filas, max = 100) {
  return `<div class="duelo">${filas.map(([nombre, valor, color]) => `<div class="duelo-fila"><span>${nombre}</span>
    <div class="duelo-barra"><i style="width:${Math.min(100, valor / max * 100)}%;background:${color}"></i></div><b>${valor}</b></div>`).join('')}</div>`;
}

const COLOR_RIVAL = '#8b948c';
const colorJugador = () => partidoInfo(estado, ID_JUGADOR).color;

function pasosCarrera() {
  const lider = esLider(estado);
  const pasos = [['Diputado', true, !lider], ['Líder del partido', lider, lider], ['Jefe de gobierno', false, false]];
  return `<ol class="pasos">${pasos.map(([nombre, hecho, actual]) =>
    `<li class="${hecho ? 'hecho' : ''} ${actual ? 'actual' : ''}"><i>${hecho && !actual ? ico('check') : ''}</i><span>${nombre}</span></li>`).join('')}</ol>`;
}

// La próxima cita que decide la carrera: el congreso si eres diputado, las elecciones si ya lideras.
function tarjetaCita() {
  const s = estado, c = s.carrera;
  if (!esLider(s)) {
    return `<div class="tarjeta resaltada">
      <div class="tarjeta-cab"><b>Congreso del partido</b><span class="cuenta">en ${plural(c.congresoMes - s.mes, 'mes', 'meses')}</span></div>
      <p>Gana quien llegue con más apoyo. El tuyo es tu apoyo en el partido (${c.interno}) más una quinta parte de tu prestigio (${Math.round(c.prestigio / 5)}).</p>
      ${duelo([[esc(s.config.lider), apoyoCongreso(s), colorJugador()], [LIDER_INICIAL, c.apoyoLider, COLOR_RIVAL]])}
      <p class="nota">${c.intentos ? 'Es tu última oportunidad: si pierdes, se acaba la carrera.' : 'Si pierdes, habrá un segundo y último congreso 6 meses después.'}</p></div>`;
  }
  const enc = estimarVotos(s, false), rival = Object.keys(enc).filter(p => p !== ID_JUGADOR).reduce((a, b) => (enc[b] > enc[a] ? b : a));
  return `<div class="tarjeta resaltada">
    <div class="tarjeta-cab"><b>Elecciones generales</b><span class="cuenta">en ${plural(faltanElecciones(s), 'mes', 'meses')}</span></div>
    <p>Gobierna el partido que saque más escaños. Esto dicen hoy las encuestas:</p>
    ${duelo([[nombrePartido(ID_JUGADOR), enc[ID_JUGADOR], colorJugador()], [nombrePartido(rival), enc[rival], partidoInfo(s, rival).color]], 50)}
    <p class="nota">${ganaJugador(enc) ? 'Vas en cabeza. Aguanta hasta el día de la votación.' : 'Promesas, mítines y campaña te acercan a los votantes.'}</p></div>`;
}

function tabCarrera() {
  const s = estado, lider = esLider(s);
  return `<h2>${esc(s.config.lider)}</h2>
    <p class="nota">${lider ? `Líder de ${nombrePartido(ID_JUGADOR)} y jefe de la oposición` : `Diputado de ${nombrePartido(ID_JUGADOR)}, en la oposición`}.
      Gobierna ${nombrePartido(s.gobiernoIA)}.</p>
    ${pasosCarrera()}${tarjetaCita()}
    <h3>Qué haces este mes</h3>
    <p class="nota">Cada cosa, una vez al mes. También puedes presentar leyes en Parlamento y dar mítines en Votantes.</p>
    ${accionesCarrera(s).map(a => `<div class="edif">
      <span class="edif-ico">${ico(a.icono)}</span>
      <div class="edif-txt"><b>${a.nombre}</b><p>${a.desc}</p><div class="chips">${chipsEfectos(a.efectos)}</div></div>
      <div class="edif-acc">${boton(`Hacerlo <span class="coste">${ico('estrella')}${a.cp}${a.fondos ? ` ${ico('moneda')}${a.fondos}` : ''}</span>`,
        { a: 'accionCarrera', v: a.id }, puedeAccionCarrera(s, a.id), 'mini')}</div>
    </div>`).join('')}
    <h3>Tu partido en las encuestas</h3>${grafica(s.historial.map(h => h.v), ' escaños', [10, 50])}`;
}

function tabPartido() {
  const s = estado, c = s.carrera, P = partidoInfo(s, ID_JUGADOR);
  const ideas = Object.keys(P.afinidad).filter(t => P.afinidad[t] > 0).map(t => chip(ETIQUETAS[t], 'pos'))
    .concat(Object.keys(P.afinidad).filter(t => P.afinidad[t] < 0).map(t => chip(`Contra: ${ETIQUETAS[t].toLowerCase()}`, 'neg'))).join('');
  const cab = `<div class="titulo-pais">${logoPartido(P, 'grande')}<div><h2>${esc(P.nombre)}</h2>
    <p class="nota">${s.escanos[ID_JUGADOR]} escaños. ${esLider(s) ? 'Lo diriges tú.' : `Lo dirige ${LIDER_INICIAL}.`}</p></div></div>
    <div class="chips">${ideas || chip('Partido de centro, sin ideas fijas')}</div>
    <p class="nota">Sacar leyes de sus ideas gusta al partido. Las que las contradicen le sientan mal y cuestan más.</p>`;

  if (!esLider(s)) {
    return `${cab}${tarjetaCita()}
      <h3>Cómo ganarte al partido</h3>
      <div class="fila"><span>Reunirte con militantes</span><b class="pos">+3 al mes</b></div>
      <div class="fila"><span>Cenar con los barones</span><b class="pos">+8 al mes</b></div>
      <div class="fila"><span>Sacar adelante una ley tuya</span><b class="pos">+4, o +6 si es de sus ideas</b></div>
      <div class="fila"><span>Cada 5 puntos de prestigio</span><b class="pos">+1 en el congreso</b></div>
      <p class="nota">Con ${APOYO_PARA_RESPALDO} de apoyo, la dirección respalda las leyes que presentes: sin ese respaldo, tu grupo se abstiene.
        Ahora tienes ${c.interno}.</p>
      <button class="btn mini" data-a="tab" data-v="carrera">Ver qué puedes hacer este mes</button>`;
  }

  const prometidas = c.promesas.map(id => LEY_POR_ID[id]);
  const candidatas = LEYES.filter(l => !s.leyes[l.id] && !c.promesas.includes(l.id));
  return `${cab}
    <div class="tarjeta"><div class="tarjeta-cab"><b>Unidad del partido</b><span class="cuenta ${c.interno < 35 ? 'neg' : ''}">${c.interno}</span></div>
      ${barraApoyo(c.interno, 25)}
      <p class="nota">Sube cuando las encuestas te dan más de 3 escaños sobre los que tienes y baja cuando te dan menos.
        Si cae por debajo de la marca, el partido te destituye.</p></div>
    <h3>Programa electoral <span class="cuenta">${prometidas.length} de ${MAX_PROMESAS} promesas</span></h3>
    <p class="nota">Cada promesa atrae ya a los grupos a los que beneficia y aleja a los que perjudica. Si ganas, tendrás 12 meses para aprobarla.</p>
    ${prometidas.map(l => `<div class="tarjeta vigente"><div class="tarjeta-cab"><b>${l.nombre}</b><span class="cuenta">prometida</span></div>
      <div class="chips">${chipsLey(l)}</div></div>`).join('')}
    ${prometidas.length < MAX_PROMESAS ? candidatas.map(l => `<div class="tarjeta">
      <div class="tarjeta-cab"><b>${l.nombre}</b><span class="tags">${l.tags.map(t => ETIQUETAS[t]).join(', ') || 'Neutral'}</span></div>
      <div class="chips">${chipsLey(l)}</div>
      ${boton(`Prometerla ${ico('estrella')}1`, { a: 'prometer', v: l.id }, puedePrometer(s, l.id), 'mini')}</div>`).join('') : ''}`;
}

function tabMapaElectoral() {
  const s = estado;
  const fila = (izq, valor, color) => `<div class="duelo-fila"><span>${izq}</span>
    <div class="duelo-barra"><i style="width:${Math.round(valor * 100)}%;background:${color}"></i></div><b>${Math.round(valor * 100)}%</b></div>`;
  if (ui.prov) {
    const p = PROV_POR_ID[ui.prov], votos = votoProvincia(s, p.id);
    const orden = Object.keys(votos).sort((a, b) => votos[b] - votos[a]);
    return `<button class="enlace" data-a="provTodas">${ico('atras')} Todas las provincias</button>
      <h2>${p.nombre}${p.capital ? ' <small>capital</small>' : ''}</h2>
      <p class="nota">${p.pob.toLocaleString('es')} mil habitantes. Hoy ganaría ${nombrePartido(orden[0])}.</p>
      <h3>Voto estimado</h3>
      <div class="duelo">${orden.map(pid => fila(nombrePartido(pid), votos[pid], partidoInfo(s, pid).color)).join('')}</div>
      <h3>Quién vive aquí</h3>
      <div class="duelo">${Object.keys(GRUPOS).map((g, i) => fila(GRUPOS[g].nombre, p.mix[i], 'var(--laton)')).join('')}</div>
      <p class="nota">Para ganar una provincia, convence a los grupos que más pesan en ella.</p>`;
  }
  const provs = provinciasJugador().map(p => ({ p, votos: votoProvincia(s, p.id) }));
  const ganadas = provs.filter(x => masVotado(x.votos) === ID_JUGADOR).length;
  return `<h2>Mapa electoral</h2>
    <p class="nota">Quién ganaría hoy en cada provincia, según los grupos que viven en ella. Tu partido iría primero en ${ganadas} de ${provs.length}.</p>
    <div class="lista-prov">${provs.map(({ p, votos }) => `<button class="fila-prov" data-a="prov" data-prov="${p.id}">
      ${logoPartido(partidoInfo(s, masVotado(votos)), 'mini')}<b>${p.capital ? '★ ' : ''}${p.nombre}</b>
      <span class="cuenta" style="margin-left:auto">tu partido: ${Math.round(votos[ID_JUGADOR] * 100)}%</span></button>`).join('')}</div>`;
}

// ---------- Ventanas ----------

function htmlCongreso() {
  const s = estado, c = s.congreso;
  const veredicto = c.gana ? 'Ganas el congreso. Desde hoy diriges el partido y serás su candidato a las elecciones.'
    : c.ultimo ? `${LIDER_INICIAL} vuelve a ganar. El partido no te dará otra oportunidad.`
      : `${LIDER_INICIAL} conserva el liderazgo. Tendrás una última oportunidad dentro de 6 meses.`;
  const salida = c.gana ? '<button class="btn principal" data-a="cerrarCongreso">Tomar las riendas</button>'
    : s.fin ? botonesFin() : '<button class="btn principal" data-a="cerrarCongreso">Seguir como diputado</button>';
  return `<h2>Congreso de ${nombrePartido(ID_JUGADOR)}</h2>
    <p class="nota">Los delegados eligen a quien dirigirá el partido.</p>
    ${duelo([[esc(s.config.lider), c.tuyo, colorJugador()], [LIDER_INICIAL, c.lider, COLOR_RIVAL]])}
    <p class="veredicto visto ${c.gana ? 'pos' : 'neg'}">${veredicto}</p>${salida}`;
}

function htmlVotacionGobierno() {
  const s = estado, v = s.votacion, ley = LEY_POR_ID[v.ley], lider = esLider(s);
  const saldria = voto => intencionVoto(s, propuestaGobierno(s, voto)).aprueba;
  const linea = lineaPartido(s), queVota = { si: 'votará a favor', no: 'votará en contra', abs: 'se abstendrá' }[linea];
  const contexto = lider ? `Tú decides qué vota tu grupo, y sus escaños pueden inclinar el resultado. Por sus ideas, tu partido ${queVota.replace('votará', 'votaría').replace('abstendrá', 'abstendría')}.`
    : `Por sus ideas, tu partido ${queVota}, así que la ley ${saldria(linea) ? 'saldrá adelante' : 'será rechazada'}. Lo que eliges es cómo te posicionas tú.`;
  return `<div class="ev-cab"><span class="ev-ico">${ico('parlamento')}</span><h2>El gobierno quiere ${v.derogar ? 'derogar' : 'aprobar'} «${ley.nombre}»</h2></div>
    <p>${ley.desc}${v.derogar ? ' Si se deroga, dejan de aplicarse estos efectos:' : ''}</p>
    <div class="chips">${chipsLey(ley)}</div>
    <p class="nota">${contexto}</p>
    ${posturasGobierno(s).map(p => `<button class="opcion" data-a="postura" data-v="${p.id}" ${p.cp && s.cp < p.cp ? 'disabled' : ''}>
      <b>${p.texto}${p.cp ? ` <span class="coste">${ico('estrella')}${p.cp}</span>` : ''}</b>
      <span class="chips">${lider ? chip(saldria(p.voto) ? 'La ley saldría adelante' : 'La ley caería') : ''}${chipsEfectos(p.efectos)}</span></button>`).join('')}`;
}
