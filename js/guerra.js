'use strict';
// Ejército, guerras y lo que pasa en el mundo entre los demás países.
//
// Una guerra se libra provincia a provincia. Tú atacas las provincias enemigas a las que llegas
// (por tierra desde lo que controlas, o por mar si tienes un puerto) y el enemigo contraataca cada mes.
// Lo ocupado no cambia de dueño hasta que se firma la paz, salvo que ocupes un país entero.

// ---------- Ejército ----------

const enGuerra = s => Object.keys(s.guerras).length > 0;
const capacidadTropas = s => 2 + 3 * contarEdificios(s).cuartel + (s.leyes.servicio_militar ? 2 : 0);
const costeReclutar = s => Math.round(COSTE_TROPA * (s.leyes.servicio_militar ? 0.7 : 1));
// La moral depende de la estabilidad del país: de 0,7 a 1,2.
const moral = s => 0.7 + s.estabilidad / 200;
const fuerzaPropia = s => Math.round(s.tropas * moral(s) * 10) / 10;
const aliados = s => paisesVivos(s).filter(pid => s.paises[pid].alianza && !s.guerras[pid]);
// Al defender, cada aliado aporta el equivalente a dos regimientos.
const fuerzaDefensa = s => fuerzaPropia(s) + 2 * aliados(s).length;

function puedeReclutar(s) {
  if (s.tropas >= capacidadTropas(s)) return { ok: false, motivo: 'No caben más: construye cuarteles' };
  if (s.dinero < costeReclutar(s)) return { ok: false, motivo: 'No hay dinero' };
  return { ok: true };
}
function reclutar(s) {
  if (!puedeReclutar(s).ok) return;
  s.dinero -= costeReclutar(s);
  s.tropas++;
}
function licenciar(s) { if (s.tropas > 0) s.tropas--; }

const cansancioGuerra = s => Math.min(8, Math.floor(Math.max(0, ...Object.values(s.guerras).map(g => g.meses)) / 2));
const anexionesRecientes = s => s.anexiones.filter(a => s.mes - a.mes < 12);

// ---------- Territorio ----------

const YO = () => PAIS_JUGADOR.id;
// Quién manda de verdad en una provincia: su ocupante si la hay, o su dueño.
const controlador = (s, id) => s.ocupadas[id] || PROV_POR_ID[id].pais;
const tienePuerto = s => provinciasLibres(s).some(p => s.edificios[p.id] && s.edificios[p.id].puerto);

// Cambia una provincia de dueño para siempre y vuelve a trazar las fronteras.
function cambiarDueno(s, id, nuevo) {
  PROV_POR_ID[id].pais = nuevo;
  s.duenos[id] = nuevo;
  delete s.ocupadas[id];
  s.obras = s.obras.filter(o => o.prov !== id);
  if (nuevo === YO()) {
    s.edificios[id] = edificiosVacios();
    s.anexiones.push({ prov: id, mes: s.mes });
    s.cuenta.conquistas++;
  } else delete s.edificios[id];
  s.mapaVersion++;
  recalcularFronteras();
}

function eliminarPais(s, pid) {
  Object.assign(s.paises[pid], { eliminado: true, tratado: false, alianza: false, embargo: false, ejercito: 0 });
  delete s.guerras[pid];
  s.mundo.guerras = s.mundo.guerras.filter(g => g.a !== pid && g.b !== pid);
  for (const id in s.ocupadas) if (s.ocupadas[id] === pid) delete s.ocupadas[id];
  s.tributos = s.tributos.filter(t => t.pais !== pid);
}

// Provincias que puedes atacar en una guerra: las del enemigo a tu alcance y las tuyas que tenga ocupadas.
function provinciasAtacables(s, pid) {
  const puerto = tienePuerto(s), res = [];
  for (const p of provinciasJugador()) if (s.ocupadas[p.id] === pid) res.push({ id: p.id, liberar: true });
  for (const p of provinciasDe(pid)) {
    if (s.ocupadas[p.id] === YO()) continue;
    if (GEO.vecinos[p.id].some(v => controlador(s, v) === YO())) res.push({ id: p.id });
    else if (puerto && GEO.provs[p.id].costera) res.push({ id: p.id, naval: true });
  }
  return res;
}

// ---------- Declarar la guerra ----------

function puedeDeclararGuerra(s, pid) {
  const p = s.paises[pid];
  if (s.guerras[pid]) return { ok: false, motivo: 'Ya estáis en guerra' };
  if (p.alianza) return { ok: false, motivo: 'Es tu aliado' };
  if (p.tregua > s.mes) return { ok: false, motivo: `Hay tregua hasta ${fecha(p.tregua)}` };
  if (!s.tropas) return { ok: false, motivo: 'No tienes ejército' };
  if (s.cp < CP_DECLARAR_GUERRA) return { ok: false, motivo: 'Sin capital político' };
  if (!provinciasAtacables(s, pid).length) return { ok: false, motivo: 'Solo se llega por mar: necesitas un puerto' };
  return { ok: true };
}

// agresor: true si la empiezas tú. A los demás países no les gusta quien ataca primero.
function declararGuerra(s, pid, agresor) {
  if (s.guerras[pid] || !s.paises[pid] || s.paises[pid].eliminado) return;
  const p = s.paises[pid], X = PAISES[pid].nombre, mio = PAIS_JUGADOR.nombre;
  s.guerras[pid] = { meses: 0, agresor, atacadas: {} };
  Object.assign(p, { tratado: false, alianza: false, relacion: -100 });
  s.mundo.guerras = s.mundo.guerras.filter(g => g.a !== pid && g.b !== pid);
  s.tributos = s.tributos.filter(t => t.pais !== pid);   // quien te pagaba deja de hacerlo
  if (agresor) {
    s.cp -= CP_DECLARAR_GUERRA;
    s.estabilidad = limitar(s.estabilidad - 3);
    for (const otro of paisesVivos(s)) if (otro !== pid) cambiarRelacion(s, otro, otro === PAISES[pid].rival ? 10 : -10);
    noticia(s, `${mio} declara la guerra a ${X}.`, 'mal');
  } else noticia(s, `${X} y ${mio} entran en guerra.`, 'mal');
  // Si el atacado es otro jugador, la guerra también empieza para él.
  const t = nacionDe(pid);
  if (t && !t.guerras[YO()]) {
    t.guerras[YO()] = { meses: 0, agresor: false, atacadas: {} };
    Object.assign(t.paises[YO()], { tratado: false, alianza: false, relacion: -100 });
    t.tributos = t.tributos.filter(tr => tr.pais !== YO());
    noticia(t, `${mio} os declara la guerra.`, 'mal');
  }
  revisarAcuerdos(s);
}

// ---------- Batallas ----------

// Probabilidad de que gane quien ataca con fuerza A contra una defensa D.
const probVictoria = (A, D) => (A <= 0 ? 0 : D <= 0 ? 1 : (A * A) / (A * A + D * D));

function infoAtaque(s, provId, naval) {
  const p = PROV_POR_ID[provId], pid = p.pais === YO() ? s.ocupadas[provId] : p.pais;
  const ataque = fuerzaPropia(s) * (naval ? 0.75 : 1);
  // Quien defiende tiene ventaja, y más aún en su capital.
  const defensa = Math.max(0.6, s.paises[pid].ejercito) * 1.2 * (p.capital && p.pais === pid ? 1.4 : 1);
  return { pid, ataque, defensa, prob: probVictoria(ataque, defensa) };
}

function puedeAtacar(s, provId) {
  const pid = PROV_POR_ID[provId].pais === YO() ? s.ocupadas[provId] : PROV_POR_ID[provId].pais;
  const g = s.guerras[pid];
  if (!g) return { ok: false, motivo: 'No estáis en guerra' };
  if (g.atacadas[provId] === s.mes) return { ok: false, motivo: 'Ya la has atacado este mes' };
  if (!s.tropas) return { ok: false, motivo: 'No te quedan tropas' };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}

function atacar(s, provId) {
  if (!puedeAtacar(s, provId).ok) return;
  const p = PROV_POR_ID[provId];
  const objetivo = provinciasAtacables(s, p.pais === YO() ? s.ocupadas[provId] : p.pais).find(o => o.id === provId);
  if (!objetivo) return;
  const { pid, prob } = infoAtaque(s, provId, objetivo.naval), E = s.paises[pid], X = PAISES[pid].nombre;
  s.cp -= 1;
  s.guerras[pid].atacadas[provId] = s.mes;
  const exito = Math.random() < prob;
  let bajasPropias = 0, bajasEnemigas = 0;
  if (exito) {
    if (objetivo.liberar) delete s.ocupadas[provId]; else s.ocupadas[provId] = YO();
    bajasEnemigas = E.ejercito > 0 ? 1 : 0;
    if (Math.random() < 0.3) bajasPropias = 1;
    noticia(s, objetivo.liberar ? `Nuestras tropas liberan ${p.nombre}.` : `Nuestras tropas ocupan ${p.nombre}, de ${X}.`, 'bien');
  } else {
    bajasPropias = 1;
    if (Math.random() < 0.4 && E.ejercito > 0) bajasEnemigas = 1;
    noticia(s, `El ataque sobre ${p.nombre} fracasa.`, 'mal');
  }
  s.tropas = Math.max(0, s.tropas - bajasPropias);
  E.ejercito = Math.max(0, E.ejercito - bajasEnemigas);
  s.batallas.push({ prov: provId, enemigo: pid, ataque: true, exito, prob, bajasPropias, bajasEnemigas, liberar: !!objetivo.liberar, naval: !!objetivo.naval });
  // Si defendía otro jugador, recibe su propio parte de la batalla.
  const t = nacionDe(pid);
  if (t) {
    t.batallas.push({ prov: provId, enemigo: YO(), ataque: false, exito: !exito, prob: 1 - prob, bajasPropias: bajasEnemigas, bajasEnemigas: bajasPropias, liberar: false, naval: !!objetivo.naval });
    noticia(t, exito ? `${PAIS_JUGADOR.nombre} ${objetivo.liberar ? 'recupera' : 'ocupa'} ${p.nombre}.` : `Rechazado el ataque de ${PAIS_JUGADOR.nombre} sobre ${p.nombre}.`, exito ? 'mal' : 'bien');
  }
  // Con todo el país ocupado ya no queda nadie con quien firmar: se anexiona entero.
  if (provinciasDe(pid).every(q => s.ocupadas[q.id] === YO())) anexionarPais(s, pid);
}

function anexionarPais(s, pid) {
  const X = PAISES[pid].nombre;
  for (const p of provinciasDe(pid)) cambiarDueno(s, p.id, YO());
  eliminarPais(s, pid);
  s.paises[pid].porTi = true;
  for (const otro of paisesVivos(s)) cambiarRelacion(s, otro, -12);
  aplicarEfectos(s, { todos: 4, estabilidad: 5 });
  noticia(s, `${X} deja de existir: todo su territorio pasa a ${PAIS_JUGADOR.nombre}.`, 'bien');
  comprobarFin(s);   // si era el último país en pie, has ganado
}

// Cada mes, en cada guerra, el enemigo se rehace y puede contraatacar.
function turnoGuerra(s) {
  for (const pid of Object.keys(s.guerras)) {
    const g = s.guerras[pid], E = s.paises[pid], X = PAISES[pid].nombre;
    g.meses++;
    if (esHumano(pid)) continue;   // otro jugador ataca cuando él quiere, no por turno
    if (g.meses % 3 === 0 && E.ejercito < PAISES[pid].ejercito) E.ejercito++;
    if (E.ejercito < 1 || Math.random() > 0.5) continue;
    // Primero intenta recuperar lo suyo; si no ha perdido nada, avanza sobre lo tuyo.
    const recuperar = provinciasDe(pid).filter(p => s.ocupadas[p.id] === YO());
    const avanzar = provinciasLibres(s).filter(p => GEO.vecinos[p.id].some(v => controlador(s, v) === pid)
      || (PAISES[pid].isla && GEO.provs[p.id].costera));
    const p = recuperar.length ? alAzar(recuperar) : avanzar.length ? alAzar(avanzar) : null;
    if (!p) continue;
    const naval = !recuperar.length && !GEO.vecinos[p.id].some(v => controlador(s, v) === pid);
    const defensa = Math.max(0.6, fuerzaDefensa(s)) * 1.2 * (p.capital && p.pais === YO() ? 1.4 : 1);
    const probEnemigo = probVictoria(E.ejercito * (naval ? 0.75 : 1), defensa);
    const ganaEnemigo = Math.random() < probEnemigo;
    let bajasPropias = 0, bajasEnemigas = 0;
    if (ganaEnemigo) {
      if (recuperar.length) delete s.ocupadas[p.id]; else s.ocupadas[p.id] = pid;
      if (s.tropas > 0 && Math.random() < 0.4) bajasPropias = 1;
      noticia(s, recuperar.length ? `${X} recupera ${p.nombre}.` : `${X} ocupa ${p.nombre}.`, 'mal');
    } else {
      bajasEnemigas = 1;
      if (s.tropas > 0 && Math.random() < 0.25) bajasPropias = 1;
      noticia(s, `Rechazado el ataque de ${X} sobre ${p.nombre}.`, 'bien');
    }
    s.tropas = Math.max(0, s.tropas - bajasPropias);
    E.ejercito = Math.max(0, E.ejercito - bajasEnemigas);
    s.batallas.push({ prov: p.id, enemigo: pid, ataque: false, exito: !ganaEnemigo, prob: 1 - probEnemigo, bajasPropias, bajasEnemigas, liberar: false, naval });
  }
  // Tras meses sin que nadie tenga nada del otro, el enemigo puede ofrecer tablas.
  for (const pid of Object.keys(s.guerras)) {
    const g = s.guerras[pid];
    const hayOcupacion = PROVINCIAS.some(p => s.ocupadas[p.id] && (p.pais === pid || s.ocupadas[p.id] === pid));
    if (!esHumano(pid) && !s.evento && g.meses >= 8 && g.meses % 4 === 0 && !hayOcupacion) s.evento = { id: 'oferta_paz', pais: pid };
  }
}

// ---------- Paz ----------

const tributoPor = provincias => 20 * provincias;

// Condiciones de paz posibles con un país y si las aceptaría.
function opcionesPaz(s, pid) {
  if (esHumano(pid)) return opcionesPazHumano(s, pid);
  const E = s.paises[pid], g = s.guerras[pid];
  const tuyas = provinciasDe(pid).filter(p => s.ocupadas[p.id] === YO());
  const suyas = provinciasJugador().filter(p => s.ocupadas[p.id] === pid);
  const total = provinciasDe(pid).length;
  const op = [];
  if (tuyas.length) {
    op.push({
      id: 'anexionar', texto: `Quedarte con lo ocupado (${tuyas.length})`,
      desc: 'Las provincias que ocupas pasan a ser tuyas. Lo que el enemigo te ocupe, lo devuelve.',
      acepta: E.ejercito <= 2 || tuyas.length * 2 >= total,
      motivo: 'Aún se ve con fuerzas: debilita su ejército u ocupa la mitad del país',
    });
    op.push({
      id: 'tributo', texto: `Devolverlo a cambio de ${tributoPor(tuyas.length)} al mes`,
      desc: `Te retiras y te paga cada mes durante ${MESES_TRIBUTO} meses: ${tributoPor(tuyas.length) * MESES_TRIBUTO} en total.`,
      acepta: !suyas.length && (E.ejercito <= 2 || tuyas.length * 2 >= total),
      motivo: suyas.length ? 'No pagará mientras ocupe provincias tuyas' : 'Aún se ve con fuerzas: debilita su ejército u ocupa la mitad del país',
    });
    op.push({
      id: 'reparaciones', texto: `Devolverlo a cambio de ${120 * tuyas.length}`,
      desc: 'Te retiras de lo ocupado y cobras una indemnización.', acepta: !suyas.length, motivo: 'No pagará mientras ocupe provincias tuyas',
    });
  }
  op.push({
    id: 'blanca', texto: 'Paz sin cambios', desc: 'Cada uno vuelve a sus fronteras de antes.',
    acepta: !suyas.length || E.ejercito <= 1 || tuyas.length >= suyas.length, motivo: 'Va ganando y no quiere soltar lo que ocupa',
  });
  if (suyas.length) {
    op.push({
      id: 'pagar', texto: `Pagar ${150 * suyas.length} para recuperar lo tuyo`, desc: 'Compras la retirada del enemigo.',
      acepta: s.dinero >= 150 * suyas.length && !tuyas.length, motivo: tuyas.length ? 'Antes debes soltar lo que ocupas' : 'No tienes ese dinero',
    });
    op.push({ id: 'ceder', texto: `Ceder lo que ocupa (${suyas.length})`, desc: 'Pierdes esas provincias para siempre.', acepta: true });
  }
  return { opciones: op, tuyas, suyas, meses: g.meses };
}

// Con otro jugador la paz no se impone: se le propone, y él la acepta o no.
function opcionesPazHumano(s, pid) {
  const g = s.guerras[pid], mio = PAIS_JUGADOR.nombre;
  const tuyas = provinciasDe(pid).filter(p => s.ocupadas[p.id] === YO());
  const suyas = provinciasJugador().filter(p => s.ocupadas[p.id] === pid);
  const nombres = l => l.map(p => p.nombre).join(', ');
  const op = [];
  if (tuyas.length) {
    op.push({
      id: 'anexionar', texto: `Quedarte con lo ocupado (${tuyas.length})`, acepta: true,
      desc: 'Se lo propones: si acepta, esas provincias pasan a ser tuyas y te devuelve lo que te ocupe.',
      paraEl: `${mio} se queda con ${nombres(tuyas)}${suyas.length ? ` y recupera ${nombres(suyas)}` : ''}.`,
    });
  }
  op.push({ id: 'blanca', texto: 'Paz sin cambios', acepta: true, desc: 'Se lo propones: cada uno vuelve a sus fronteras.', paraEl: 'Cada uno vuelve a sus fronteras de antes.' });
  if (suyas.length) {
    op.push({ id: 'ceder', texto: `Ceder lo que ocupa (${suyas.length})`, acepta: true, desc: 'Se lo propones: pierdes esas provincias para siempre.', paraEl: `${mio} te cede ${nombres(suyas)}.` });
  }
  return { opciones: op, tuyas, suyas, meses: g.meses };
}

// confirmada: la paz con otro jugador ya ha sido aceptada por él.
function firmarPaz(s, pid, id, confirmada) {
  if (!s.guerras[pid]) return;
  const { opciones, tuyas, suyas } = opcionesPaz(s, pid), o = opciones.find(x => x.id === id);
  if (!o || !o.acepta) return;
  if (esHumano(pid) && !confirmada) { proponerA(s, pid, { tipo: 'paz', opcion: id, texto: o.paraEl }); return; }
  const X = PAISES[pid].nombre, mio = PAIS_JUGADOR.nombre;
  for (const p of [...tuyas, ...suyas]) delete s.ocupadas[p.id];
  if (id === 'anexionar') {
    for (const p of tuyas) cambiarDueno(s, p.id, YO());
    for (const otro of paisesVivos(s)) if (otro !== pid) cambiarRelacion(s, otro, -5 * tuyas.length);
    aplicarEfectos(s, { todos: 3, estabilidad: 4 });
    noticia(s, `${X} firma la paz y cede ${tuyas.map(p => p.nombre).join(', ')} a ${mio}.`, 'bien');
  } else if (id === 'tributo') {
    s.tributos.push({ pais: pid, cantidad: tributoPor(tuyas.length), meses: MESES_TRIBUTO });
    noticia(s, `${X} acepta pagar ${tributoPor(tuyas.length)} al mes durante ${MESES_TRIBUTO} meses a cambio de la retirada.`, 'bien');
  } else if (id === 'reparaciones') {
    s.dinero += 120 * tuyas.length;
    noticia(s, `${X} paga ${120 * tuyas.length} a cambio de la retirada de nuestras tropas.`, 'bien');
  } else if (id === 'pagar') {
    s.dinero -= 150 * suyas.length;
    aplicarEfectos(s, { todos: -3 });
    noticia(s, `${mio} paga ${150 * suyas.length} a ${X} para recuperar sus provincias.`, 'mal');
  } else if (id === 'ceder') {
    for (const p of suyas) cambiarDueno(s, p.id, pid);
    aplicarEfectos(s, { todos: -8, estabilidad: -8 });
    noticia(s, `${mio} cede ${suyas.map(p => p.nombre).join(', ')} a ${X} para acabar la guerra.`, 'mal');
  } else noticia(s, `${mio} y ${X} firman la paz: cada uno vuelve a sus fronteras.`);
  delete s.guerras[pid];
  Object.assign(s.paises[pid], { relacion: id === 'anexionar' ? -50 : -30, tregua: s.mes + MESES_TREGUA });
  const t = nacionDe(pid);
  if (t) {
    delete t.guerras[YO()];
    Object.assign(t.paises[YO()], { relacion: -30, tregua: s.mes + MESES_TREGUA });
    noticia(t, `Se firma la paz con ${mio}. ${o.paraEl || ''}`, 'bien');
  }
  s.mapaVersion++;
  comprobarFin(s);
}

// ---------- El mundo entre los demás países ----------

const claveRel = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const fronterizos = (a, b) => provinciasDe(a).some(p => GEO.vecinos[p.id].some(v => PROV_POR_ID[v].pais === b));
const paisesIA = m => Object.keys(NACIONES).filter(pid => !NACIONES[pid].humano && !m.eliminados[pid]);

// Relaciones entre los países de la IA y sus ejércitos al empezar.
function iniciarMundo(m) {
  const ids = Object.keys(NACIONES).filter(pid => !NACIONES[pid].humano);
  for (let i = 0; i < ids.length; i++) {
    m.ejercitos[ids[i]] = NACIONES[ids[i]].ejercito;
    for (let j = i + 1; j < ids.length; j++) {
      m.rel[claveRel(ids[i], ids[j])] = NACIONES[ids[i]].rival === ids[j] ? -55 : Math.round(-25 + Math.random() * 45);
    }
  }
}

// Cada mes: las guerras entre países de la IA avanzan, surgen roces o pactos, cambian gobiernos
// y, si alguno odia a un jugador y se ve más fuerte, le llega un ultimátum.
// naciones: las naciones con jugador de la partida (en solitario, solo la tuya).
function simularMundo(naciones) {
  const s0 = naciones[0], m = s0.mundo, nombre = pid => NACIONES[pid].nombre;
  const varias = naciones.length > 1;
  const aTodos = texto => naciones.forEach(s => noticia(s, texto, 'mundo'));
  const contraJugador = pid => naciones.some(s => s.guerras[pid]);

  if (s0.mes % 3 === 0) {
    for (const pid of paisesIA(m)) if (!contraJugador(pid) && m.ejercitos[pid] < NACIONES[pid].ejercito) m.ejercitos[pid]++;
  }

  for (const g of [...m.guerras]) {
    if (!m.guerras.includes(g)) continue;
    g.meses++;
    const A = m.ejercitos[g.a] || 0, B = m.ejercitos[g.b] || 0;
    const ganaA = Math.random() < (A * A + 0.5) / (A * A + B * B + 1);
    const w = ganaA ? g.a : g.b, l = ganaA ? g.b : g.a;
    m.ejercitos[l] = Math.max(0, (m.ejercitos[l] || 0) - 1);
    if (Math.random() < 0.4) m.ejercitos[w] = Math.max(0, (m.ejercitos[w] || 0) - 1);
    if (Math.random() < 0.45) {
      // La capital es lo último que cae, y no siempre: los países rara vez desaparecen del todo.
      const quedan = provinciasDe(l).length;
      const botin = provinciasDe(l).filter(p => !s0.ocupadas[p.id] && GEO.vecinos[p.id].some(v => PROV_POR_ID[v].pais === w)
        && (quedan > 1 ? !(p.capital && p.origen === l) : Math.random() < 0.25));
      if (botin.length) {
        const p = alAzar(botin);
        cambiarDueno(s0, p.id, w);
        g.tomadas++;
        aTodos(`${nombre(w)} arrebata ${p.nombre} a ${nombre(l)}.`);
        if (!provinciasDe(l).length) {
          m.eliminados[l] = true;
          m.ejercitos[l] = 0;
          m.guerras = m.guerras.filter(x => x.a !== l && x.b !== l);
          for (const s of naciones) Object.assign(s.paises[l], { tratado: false, alianza: false, embargo: false });
          aTodos(`${nombre(l)} desaparece del mapa, conquistada por ${nombre(w)}.`);
          continue;
        }
      }
    }
    if (g.meses >= 6 || g.tomadas >= 2 || !m.ejercitos[g.a] || !m.ejercitos[g.b]) {
      m.guerras = m.guerras.filter(x => x !== g);
      m.rel[claveRel(g.a, g.b)] = 0;   // agotados, tardarán en volver a enfrentarse
      aTodos(`${nombre(g.a)} y ${nombre(g.b)} firman la paz.`);
    }
  }

  // Los países en guerra con un jugador ya tienen bastante: no abren otros frentes.
  // Con muchos países pasan más cosas: una tirada por cada cinco.
  const tiradas = Math.max(1, Math.round(paisesIA(m).length / 5));
  for (let t = 0; t < tiradas; t++) {
    const libres = paisesIA(m).filter(pid => !contraJugador(pid) && !m.guerras.some(g => g.a === pid || g.b === pid));
    if (libres.length < 2 || Math.random() >= 0.3) continue;
    // Los roces surgen sobre todo entre países que comparten frontera.
    const pares = [];
    for (const x of libres) for (const y of libres) if (x < y && fronterizos(x, y)) pares.push([x, y]);
    const [a, b] = pares.length && Math.random() < 0.8 ? alAzar(pares) : (() => { const x = alAzar(libres); return [x, alAzar(libres.filter(y => y !== x))]; })();
    const k = claveRel(a, b);
    if (m.rel[k] <= -30 && fronterizos(a, b) && Math.random() < 0.6) {
      m.guerras.push({ a, b, meses: 0, tomadas: 0 });
      aTodos(`${nombre(a)} declara la guerra a ${nombre(b)}.`);
      // Si uno de los dos es aliado de un jugador, le pedirá que entre.
      for (const s of naciones) {
        const aliado = s.paises[a].alianza !== s.paises[b].alianza ? (s.paises[a].alianza ? a : b) : null;
        if (aliado && s.modo === 'gobierno' && !s.evento) s.evento = { id: 'aliado_guerra', pais: aliado, pais2: aliado === a ? b : a };
      }
    } else if (Math.random() < 0.62) {
      m.rel[k] = limitar(m.rel[k] - 22, -100, 100);
      aTodos(`Choque diplomático entre ${nombre(a)} y ${nombre(b)}.`);
    } else {
      m.rel[k] = limitar(m.rel[k] + 10, -100, 100);
      aTodos(`${nombre(a)} y ${nombre(b)} firman un acuerdo comercial.`);
    }
  }

  const tranquilos = paisesIA(m).filter(pid => !contraJugador(pid));
  if (tranquilos.length && Math.random() < 0.035) {
    const pid = alAzar(tranquilos), d = Math.random() < 0.5 ? 15 : -15;
    for (const s of naciones) {
      s.paises[pid].base = limitar(s.paises[pid].base + d, -40, 40);
      noticia(s, `Cambio de gobierno en ${nombre(pid)}: el nuevo gabinete mira a ${s.config.pais} con ${d > 0 ? 'simpatía' : 'recelo'}.`, 'mundo');
    }
  }

  // Un vecino más fuerte que un jugador y que no lo aprecia acaba reclamando tierras; si la cosa
  // empeora, llega el ultimátum.
  for (const s of naciones) {
    if (s.modo !== 'gobierno' || s.fin) continue;
    if (varias) usarNacion(s);
    for (const pid of paisesIA(m).filter(x => !s.guerras[x])) {
      const p = s.paises[pid];
      const frontera = provinciasLibres(s).filter(q => GEO.vecinos[q.id].some(v => PROV_POR_ID[v].pais === pid)
        || (PAISES[pid].isla && GEO.provs[q.id].costera));
      if (!frontera.length || p.tregua > s.mes || p.alianza || p.ejercito <= fuerzaDefensa(s)) continue;
      if (p.relacion <= -45 && !s.evento && Math.random() < 0.25) {
        s.evento = { id: 'ultimatum', pais: pid };
        break;
      }
      if (p.relacion < 10 && Math.random() < 0.022) {
        p.relacion = limitar(p.relacion - 20, -100, 100);
        p.base = limitar(p.base - 5, -40, 40);
        noticia(s, `${nombre(pid)} reclama como suya la provincia de ${alAzar(frontera).nombre}.`, 'mal');
      }
    }
  }
}
