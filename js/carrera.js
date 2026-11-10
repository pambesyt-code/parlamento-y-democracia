'use strict';
// Reglas de la carrera política: de diputado a líder del partido y de ahí al gobierno.
// Mientras dura, s.modo es 'carrera', otro partido gobierna (s.gobiernoIA) y s.grupos mide
// el apoyo de cada grupo social a tu partido. Al ganar las elecciones se pasa al modo 'gobierno'.

const ACCION_CARRERA_POR_ID = Object.fromEntries(ACCIONES_CARRERA.map(a => [a.id, a]));
const esLider = s => !!s.carrera && s.carrera.cargo === 'lider';
// Lo que pesas en un congreso del partido: tu apoyo interno más una parte de tu fama.
const apoyoCongreso = s => Math.round(s.carrera.interno + s.carrera.prestigio / 5);
// La fama se olvida: cada mes pierdes una parte de tu prestigio, más cuanto más tienes.
const olvidoPrestigio = s => Math.ceil(s.carrera.prestigio * 0.08);
const accionesCarrera = s => ACCIONES_CARRERA.filter(a => !a.fase || a.fase === s.carrera.cargo);

function iniciarCarrera(s) {
  const dif = dificultad(s);
  s.modo = 'carrera';
  s.gobiernoIA = ID_JUGADOR === 'ac' ? 'fo' : 'ac';
  s.carrera = {
    cargo: 'diputado', prestigio: 5, interno: dif.interno, fondos: 60, apoyoLider: dif.apoyoLider,
    imagen: {}, promesas: [], hechas: {}, propias: {}, congresoMes: MES_CONGRESO, intentos: 0, mesLider: -1,
    fuerzaGobierno: dif.fuerzaGobierno,
  };
  for (const g in GRUPOS) { s.carrera.imagen[g] = 0; s.grupos[g] = dif.apoyoOposicion; }
  s.escanos = estimarVotos(s, false);
  s.historial = [puntoHistorial(s)];
  noticia(s, `${s.config.lider} recoge su acta de diputado por ${s.config.partido}.`);
}

// La imagen es lo que cada grupo piensa de tu partido por tus posturas. Sube el apoyo al
// momento y también el nivel hacia el que tiende.
function cambiarImagen(s, g, n) {
  s.carrera.imagen[g] = limitar(s.carrera.imagen[g] + n, -12, 12);
  s.grupos[g] = limitar(s.grupos[g] + n);
}

function aplicarEfectosCarrera(s, ef) {
  const c = s.carrera;
  if (ef.prestigio) c.prestigio = limitar(c.prestigio + ef.prestigio);
  if (ef.interno) c.interno = limitar(c.interno + ef.interno);
  if (ef.fondos) c.fondos = Math.max(0, c.fondos + ef.fondos);
  if (ef.apoyoLider) c.apoyoLider = limitar(c.apoyoLider + ef.apoyoLider);
  if (ef.fuerzaGobierno) c.fuerzaGobierno = Math.max(1.1, +(c.fuerzaGobierno + ef.fuerzaGobierno).toFixed(3));
  if (ef.imagenTodos) for (const g in GRUPOS) cambiarImagen(s, g, ef.imagenTodos);
  if (ef.imagen) for (const g in ef.imagen) cambiarImagen(s, g, ef.imagen[g]);
}

// ---------- Acciones del mes ----------

function puedeAccionCarrera(s, id) {
  const a = ACCION_CARRERA_POR_ID[id], c = s.carrera;
  if (c.hechas[id] === s.mes) return { ok: false, motivo: 'Ya lo has hecho este mes' };
  if (s.cp < a.cp) return { ok: false, motivo: 'Sin capital político' };
  if (a.fondos && c.fondos < a.fondos) return { ok: false, motivo: 'Faltan fondos' };
  return { ok: true };
}

function hacerAccionCarrera(s, id) {
  if (!puedeAccionCarrera(s, id).ok) return;
  const a = ACCION_CARRERA_POR_ID[id];
  s.cp -= a.cp;
  s.carrera.fondos -= a.fondos || 0;
  s.carrera.hechas[id] = s.mes;
  if (id === 'pleno') s.cuenta.plenos++;
  aplicarEfectos(s, a.efectos);
  comprobarFin(s);
}

// ---------- Votantes ----------

function objetivoGrupoCarrera(s, g) {
  const c = s.carrera, razones = [];
  const add = (texto, v) => { v = Math.round(v); if (v) razones.push({ texto, v }); };
  add('Tu prestigio', c.prestigio * (esLider(s) ? 0.1 : 0.05));
  add('Imagen de tu partido', c.imagen[g]);
  for (const id of c.promesas) {
    const ley = LEY_POR_ID[id];
    if (ley.grupos && ley.grupos[g]) add(`Promesa: ${ley.nombre}`, ley.grupos[g] * 0.4);
  }
  add('Desgaste del gobierno', Math.min(4, Math.floor((s.mes - s.inicioLegislatura) / 5)));
  return { valor: limitar(dificultad(s).apoyoOposicion + razones.reduce((a, r) => a + r.v, 0)), razones };
}

// ---------- Programa electoral ----------

function puedePrometer(s, leyId) {
  const c = s.carrera, ley = LEY_POR_ID[leyId];
  if (c.promesas.includes(leyId)) return { ok: false, motivo: 'Ya está en tu programa' };
  if (c.promesas.length >= MAX_PROMESAS) return { ok: false, motivo: 'El programa está completo' };
  if (ley.incompatible && c.promesas.includes(ley.incompatible)) return { ok: false, motivo: 'Choca con otra promesa' };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}

function prometer(s, leyId) {
  if (!esLider(s) || s.leyes[leyId] || !puedePrometer(s, leyId).ok) return;
  s.cp -= 1;
  s.carrera.promesas.push(leyId);
  noticia(s, `${s.config.lider} promete «${LEY_POR_ID[leyId].nombre}» si llega al gobierno.`);
}

// Ya en el gobierno: cada promesa cuenta como cumplida al aprobar su ley y como rota si vence el plazo.
function revisarPromesas(s) {
  for (const p of s.promesas) {
    if (p.estado !== 'pendiente') continue;
    const ley = LEY_POR_ID[p.ley];
    if (s.leyes[p.ley]) {
      p.estado = 'cumplida';
      aplicarEfectos(s, { todos: 2, cp: 1 });
      noticia(s, `Promesa cumplida: «${ley.nombre}» ya es ley.`, 'bien');
    } else if (s.mes >= p.limite) {
      p.estado = 'rota';
      const grupos = {};
      for (const g in ley.grupos || {}) if (ley.grupos[g] > 0) grupos[g] = -8;
      aplicarEfectos(s, { grupos, estabilidad: -2 });
      noticia(s, `Promesa rota: el gobierno no ha aprobado «${ley.nombre}».`, 'mal');
    }
  }
}

// ---------- Leyes: las tuyas y las del gobierno ----------

// Sacar adelante una ley desde la oposición te da fama, apoyo interno y mejor imagen
// entre los grupos a los que favorece. Si fracasa, al menos se ha hablado de ti.
function premioLeyCarrera(s, ley, derogar, aprobada) {
  if (!aprobada) return aplicarEfectos(s, { prestigio: 2 });
  // Deshacer una ley que tú mismo sacaste adelante no da ningún mérito.
  const propias = s.carrera.propias;
  if (derogar && propias[ley.id]) { delete propias[ley.id]; return; }
  if (!derogar) propias[ley.id] = true;
  const imagen = {}, signo = derogar ? -1 : 1;
  for (const g in ley.grupos || {}) imagen[g] = Math.round(ley.grupos[g] * signo / 3);
  aplicarEfectos(s, { prestigio: esLider(s) ? 5 : 8, interno: internoPorLey(s, ley.id, derogar), imagen });
}

// Lo que gana o pierde tu apoyo interno al sacar una ley: más si encaja con las ideas del partido,
// y negativo si las contradice.
function internoPorLey(s, leyId, derogar) {
  const opinion = opinionPartido(s, leyId, derogar);
  return opinion >= 2 ? 6 : opinion <= -2 ? -4 : 4;
}

// Qué vota tu partido ante una ley del gobierno cuando no lo diriges tú: lo que dicten sus ideas.
function lineaPartido(s) {
  const opinion = opinionPartido(s, s.votacion.ley, s.votacion.derogar);
  return opinion >= 1 ? 'si' : opinion <= -1 ? 'no' : 'abs';
}

// El partido que gobierna elige una ley de su gusto, o deroga una que le disguste.
function elegirLeyGobierno(s) {
  const P = PARTIDOS[s.gobiernoIA];
  const afinidad = l => l.tags.reduce((a, t) => a + (P.afinidad[t] || 0), 0);
  const opciones = [];
  for (const l of LEYES) {
    if (!s.leyes[l.id] && afinidad(l) >= 2 && !(l.incompatible && s.leyes[l.incompatible])) opciones.push({ ley: l.id, derogar: false });
    if (s.leyes[l.id] && afinidad(l) <= -2) opciones.push({ ley: l.id, derogar: true });
  }
  return opciones.length ? alAzar(opciones) : null;
}

// Posturas posibles ante una ley del gobierno. Como diputado solo te juegas tu imagen;
// como líder decides el voto de todo tu grupo.
function posturasGobierno(s) {
  const v = s.votacion, ley = LEY_POR_ID[v.ley], signo = v.derogar ? -1 : 1, gob = s.gobiernoIA;
  const imagen = (aFavorecidos, aPerjudicados) => {
    const o = {};
    for (const g in ley.grupos || {}) {
      const n = ley.grupos[g] * signo > 0 ? aFavorecidos : aPerjudicados;
      if (n) o[g] = n;
    }
    return o;
  };
  const linea = lineaPartido(s);
  if (esLider(s)) {
    // Votar contra lo que piensa tu propio partido tiene un precio dentro de él.
    return [
      { id: 'no', voto: 'no', texto: 'Votar en contra', efectos: { imagen: imagen(-1, 2), relPartidoDe: { [gob]: -4 }, interno: linea === 'si' ? -4 : 0 } },
      { id: 'si', voto: 'si', texto: 'Votar a favor', efectos: { imagen: imagen(2, -3), relPartidoDe: { [gob]: 8 }, interno: linea === 'no' ? -6 : linea === 'si' ? 1 : -3 } },
      { id: 'abs', voto: 'abs', texto: 'Abstenerse', efectos: {} },
    ];
  }
  // Como diputado, el voto del grupo lo decide la dirección: tú solo eliges qué decir.
  const critica = { prestigio: 3, imagen: imagen(0, 2), interno: linea === 'si' ? -4 : linea === 'no' ? 2 : -1 };
  const defensa = { prestigio: 2, imagen: imagen(2, 0), interno: linea === 'no' ? -5 : linea === 'si' ? 2 : -3 };
  return [
    { id: 'linea', voto: linea, texto: 'Callar y seguir la línea del partido', efectos: { interno: 2 } },
    { id: 'criticar', voto: linea, cp: 1, texto: 'Criticar la ley en el pleno', efectos: critica },
    { id: 'defender', voto: linea, texto: 'Defender la ley en público', efectos: defensa },
  ];
}

const propuestaGobierno = (s, voto) => ({ ley: s.votacion.ley, derogar: s.votacion.derogar, autor: s.gobiernoIA, votoJugador: voto, negociado: {} });

function resolverPostura(s, id) {
  if (!s.votacion) return;
  const p = posturasGobierno(s).find(x => x.id === id);
  if (!p || (p.cp && s.cp < p.cp)) return;
  s.cp -= p.cp || 0;
  if (id === 'criticar') s.cuenta.plenos++;
  aplicarEfectos(s, p.efectos);
  const prop = propuestaGobierno(s, p.voto);
  s.votacion = null;
  resolverVotacion(s, prop);
  comprobarFin(s);
}

// ---------- Congreso del partido ----------

function celebrarCongreso(s) {
  const c = s.carrera, tuyo = apoyoCongreso(s), gana = tuyo > c.apoyoLider;
  c.intentos++;
  s.congreso = { tuyo, lider: c.apoyoLider, gana, ultimo: c.intentos >= 2 };
  if (gana) {
    c.cargo = 'lider';
    c.mesLider = s.mes;
    c.congresoMes = null;
    c.interno = Math.max(c.interno, 55);
    s.cp = limitar(s.cp + 3, 0, CP_MAXIMO);
    noticia(s, `${s.config.lider} gana el congreso y pasa a dirigir ${s.config.partido}.`, 'bien');
  } else if (c.intentos >= 2) {
    s.fin = 'congreso';
    noticia(s, `${LIDER_INICIAL} vuelve a ganar el congreso.`, 'mal');
  } else {
    c.congresoMes = s.mes + 6;
    noticia(s, `${LIDER_INICIAL} retiene el liderazgo. Habrá otro congreso dentro de 6 meses.`, 'mal');
  }
}

// ---------- Elecciones desde la oposición ----------

function eleccionesCarrera(s) {
  const c = s.carrera, antes = { ...s.escanos }, escanos = estimarVotos(s, true), gana = ganaJugador(escanos);
  s.escanos = escanos;
  s.propuesta = null;
  s.elecciones = { antes, escanos, gana, carrera: true };
  if (gana) {
    noticia(s, `${s.config.partido} gana las elecciones con ${escanos[ID_JUGADOR]} escaños.`, 'bien');
    return;
  }
  // El partido perdona mejor una derrota en la que se ganan escaños.
  c.interno = limitar(c.interno - (escanos[ID_JUGADOR] > antes[ID_JUGADOR] ? 8 : 20));
  noticia(s, `${s.config.partido} pierde las elecciones con ${escanos[ID_JUGADOR]} escaños.`, 'mal');
  if (c.interno < 35) { s.fin = 'destituido'; return; }
  const rivales = Object.keys(escanos).filter(pid => pid !== ID_JUGADOR);
  s.gobiernoIA = rivales.reduce((a, b) => (escanos[b] > escanos[a] ? b : a));
  c.fuerzaGobierno = dificultad(s).fuerzaGobierno - 0.1;
  c.promesas = [];
  s.legislatura++;
  s.inicioLegislatura = s.mes;
  s.proximaEleccion += MESES_LEGISLATURA;
}

// Has ganado: se acaba la carrera y empieza el gobierno. Heredas las leyes en vigor y tus promesas.
function formarGobierno(s) {
  const c = s.carrera;
  s.modo = 'gobierno';
  s.gobiernoIA = null;
  s.elecciones = null;
  s.mesGobierno = s.inicioLegislatura = s.mes;
  s.proximaEleccion = s.mes + MESES_LEGISLATURA;
  s.legislatura = 1;
  s.dinero = dificultad(s).dinero;
  s.estabilidad = 55;
  s.cp = limitar(s.cp + 3, 0, CP_MAXIMO);
  s.cuenta.elecciones++;
  s.ultimoMitin = -1;
  s.recientes = [];
  s.promesas = c.promesas.map(ley => ({ ley, limite: s.mes + 12, estado: s.leyes[ley] ? 'cumplida' : 'pendiente' }));
  s.historial = [puntoHistorial(s)];
  noticia(s, `${s.config.lider} forma gobierno tras ganar las elecciones.`, 'bien');
}

// ---------- Prensa y consejos ----------

function titularCarrera(s) {
  const c = s.carrera, L = s.config.lider, P = s.config.partido, gob = PARTIDOS[s.gobiernoIA].nombre;
  const faltan = s.proximaEleccion - s.mes, enc = estimarVotos(s, false);
  if (s.mes === 0) return [`${L} estrena escaño`, `El nuevo diputado de ${P} llega al Parlamento con ganas de hacerse oír.`];
  if (c.mesLider === s.mes) return [`${L}, al frente de ${P}`, `El congreso del partido aparta a ${LIDER_INICIAL} y apuesta por el relevo.`];
  if (s.ultimaLey && s.ultimaLey.mes === s.mes) {
    const l = s.ultimaLey;
    return [`El Parlamento ${l.derogar ? 'tumba' : 'aprueba'} «${LEY_POR_ID[l.id].nombre}»`, `La votación se salda con ${l.si} votos a favor y ${l.no} en contra.`];
  }
  if (esLider(s) && faltan <= 3) return ['Recta final hacia las urnas', `Quedan ${faltan} ${faltan === 1 ? 'mes' : 'meses'} y las encuestas dan ${enc[ID_JUGADOR]} escaños a ${P}.`];
  if (ganaJugador(enc)) return [`${P} encabeza las encuestas`, `Los sondeos le dan ${enc[ID_JUGADOR]} escaños, más que a ningún otro partido.`];
  if (esLider(s) && c.interno < 35) return [`Ruido de sables en ${P}`, `Parte del partido cuestiona el liderazgo de ${L}.`];
  if (c.prestigio >= 50) return [`${L}, la voz de moda en el Parlamento`, 'Sus intervenciones llenan la tribuna de prensa.'];
  if (!esLider(s) && c.congresoMes && c.congresoMes - s.mes <= 2) return [`${P} prepara su congreso`, `${LIDER_INICIAL} parte con ${c.apoyoLider} puntos de apoyo y ${L} con ${apoyoCongreso(s)}.`];
  return [
    [`El gobierno de ${gob} marca el paso`, 'La oposición busca la manera de hacerse notar.'],
    [`${P} quiere dejar de ser el tercero en discordia`, 'El partido debate cómo ganar terreno antes de las elecciones.'],
    ['Semanas tranquilas en el Parlamento', 'Los diputados aprovechan para trabajar sus provincias.'],
  ][s.mes % 3];
}

function consejoCarrera(s) {
  const c = s.carrera, faltan = s.proximaEleccion - s.mes;
  if (!esLider(s)) {
    const quedan = c.congresoMes - s.mes;
    if (quedan <= 4 && apoyoCongreso(s) <= c.apoyoLider) return { texto: `El congreso es en ${quedan} ${quedan === 1 ? 'mes' : 'meses'} y ${LIDER_INICIAL} aún te supera. Reúnete con militantes y barones.`, tab: 'carrera' };
    if (c.interno < APOYO_PARA_RESPALDO) return { texto: `Con menos de ${APOYO_PARA_RESPALDO} de apoyo, tu partido no respaldará las leyes que presentes.`, tab: 'partido' };
  } else {
    if (c.interno < 35) return { texto: 'El partido está inquieto. Si su apoyo baja de 25, te quitarán el liderazgo.', tab: 'partido' };
    if (c.promesas.length < MAX_PROMESAS) return { texto: 'Tu programa electoral tiene huecos. Cada promesa atrae a los grupos a los que beneficia.', tab: 'partido' };
    if (faltan <= 6 && !ganaJugador(estimarVotos(s, false))) return { texto: 'Aún no vas primero en las encuestas. Da mítines y haz campaña.', tab: 'sociedad' };
  }
  if (c.fondos < 40) return { texto: 'Sin fondos no hay mítines ni cenas. Dedica un rato a recaudar.', tab: 'carrera' };
  if (s.cp >= 8) return { texto: 'Te sobra capital político. Úsalo antes de que se pierda.', tab: 'carrera' };
  return null;
}

// ---------- Paso de turno ----------

// El mes de la carrera va en dos fases, con el mundo de por medio (lo mueve quien llama).
function mesCarreraAntes(s) {
  const c = s.carrera;
  s.cp = Math.min(CP_MAXIMO, s.cp + 2);
  c.fondos += 5;
  c.prestigio -= olvidoPrestigio(s);
  for (const g in GRUPOS) s.grupos[g] = Math.round(s.grupos[g] + (objetivoGrupoCarrera(s, g).valor - s.grupos[g]) * 0.25);
  c.fuerzaGobierno = Math.max(1.1, +(c.fuerzaGobierno - 0.012).toFixed(3));
  if (esLider(s)) {
    // El partido juzga a su líder por las encuestas.
    const enc = estimarVotos(s, false)[ID_JUGADOR];
    if (enc < s.escanos[ID_JUGADOR]) c.interno = limitar(c.interno - 1);
    else if (enc > s.escanos[ID_JUGADOR] + 3) c.interno = limitar(c.interno + 1);
  }
  s.mes++;
}

function mesCarreraDespues(s) {
  const c = s.carrera;
  s.historial.push(puntoHistorial(s));
  if (s.historial.length > 240) s.historial.shift();
  comprobarFin(s);
  if (s.fin) { noticia(s, `${s.config.partido} retira su confianza a ${s.config.lider}.`, 'mal'); return; }
  const faltan = s.proximaEleccion - s.mes;
  if (faltan === 0) return celebrarElecciones(s);
  if (c.congresoMes === s.mes) return celebrarCongreso(s);
  if (faltan === 3) noticia(s, 'Quedan 3 meses para las elecciones.');
  if (c.congresoMes && c.congresoMes - s.mes === 2) noticia(s, 'El congreso del partido se celebra dentro de 2 meses.');
  if (s.mes % 3 === 2 && faltan > 1) {
    s.votacion = elegirLeyGobierno(s);
    if (s.votacion) return;
  }
  s.evento = elegirEvento(s);
}
