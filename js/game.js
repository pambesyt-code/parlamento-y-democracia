'use strict';
// Reglas del juego. Ninguna función de aquí toca la pantalla.
//
// Cada jugador lleva una nación: un objeto «estado» (s) con su economía, su política y sus
// relaciones. El mundo (quién posee cada provincia, quién ocupa qué, los ejércitos de la IA y sus
// guerras) es común: todas las naciones de una partida comparten los mismos objetos s.mundo,
// s.duenos y s.ocupadas. Las reglas trabajan siempre «desde» una nación: usarNacion() la activa.

const GUARDADO = 'pyd-partida-v6';
const VERSION_GUARDADO = 6;
const limitar = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const alAzar = lista => lista[Math.floor(Math.random() * lista.length)];
const provinciasDe = pid => PROVINCIAS.filter(p => p.pais === pid);
const provinciasJugador = () => provinciasDe(PAIS_JUGADOR.id);
// Las provincias tuyas que no están ocupadas por un enemigo: solo esas producen y pagan impuestos.
const provinciasLibres = s => provinciasJugador().filter(p => !s.ocupadas[p.id]);
const poblacionTotal = s => provinciasLibres(s).reduce((a, p) => a + p.pob, 0);
const paisesVivos = s => Object.keys(s.paises).filter(pid => !s.mundo.eliminados[pid]);
const solaresDe = p => (p.capital ? 5 : 4);
const dificultad = s => DIFICULTADES[s.config.dificultad];

// Naciones con jugador de esta partida, por país. En solitario solo está la tuya;
// en multijugador, el anfitrión tiene todas y cada invitado solo la suya.
const ESTADOS = {};
const nacionDe = pid => ESTADOS[pid] || null;
const esHumano = pid => !!(NACIONES[pid] && NACIONES[pid].humano);

const CONFIG_BASE = {
  modo: 'gobierno', lider: 'Alex Montero', dificultad: 'normal', legislatura: 24,
  propio: true, partidoId: 'uc', partido: 'Unión Cívica', color: COLORES_PARTIDO[0], emblema: EMBLEMAS[0], principios: [],
  pais: 'Aldora', colorPais: COLORES_PAIS[0], tamano: 'mediano', semilla: 1, nPartidos: 5,
};

// Completa una configuración. Si te unes a un partido que ya existe, llevas su nombre, color y emblema.
function completarConfig(config) {
  const cfg = { ...CONFIG_BASE, ...config, principios: [...((config && config.principios) || [])] };
  if (!/^#[0-9a-f]{6}$/i.test(cfg.color)) cfg.color = COLORES_PARTIDO[0];
  if (cfg.propio) cfg.partidoId = 'uc';
  else {
    if (!CATALOGO_PARTIDOS[cfg.partidoId]) cfg.partidoId = 'fo';
    const P = CATALOGO_PARTIDOS[cfg.partidoId];
    Object.assign(cfg, { partido: P.nombre, color: P.color, emblema: P.emblema, principios: [] });
  }
  return cfg;
}

// El escaño del partido de un jugador: el del partido al que se une o, si crea uno, el que se le
// haya dado (el de centro si nadie más lo usa; si no, uno nuevo: j1, j2...).
const huecoDe = cfg => cfg.hueco || (cfg.propio ? 'uc' : cfg.partidoId);

// Hacia dónde se sienta un partido creado por un jugador, según sus principios.
const EJE_PRINCIPIO = { izquierda: -2, derecha: 2, social: -0.6, orden: 1.2, verde: -0.8, agrario: 0.4 };
const ejeDePrincipios = p => (p.length ? p.reduce((a, t) => a + (EJE_PRINCIPIO[t] || 0), 0) / p.length : 0);
const PLANTILLA_JUGADOR = {
  nombre: 'Partido', siglas: 'P', color: '#888888', emblema: 'estrella', lema: '', eje: 0,
  afinidad: {}, base: { obreros: 20, empresarios: 20, campesinos: 20, jovenes: 20 },
};

// Elige los partidos de un país: los cuatro fijos, los que hayan escogido sus jugadores y, hasta
// llegar a n, otros al azar. Los partidos propios de la oposición se añaden aparte con huecos j1, j2...
function elegirPartidos(n, pedidos = []) {
  const ids = [...PARTIDOS_FIJOS];
  for (const id of pedidos) if (CATALOGO_PARTIDOS[id] && !ids.includes(id)) ids.push(id);
  const resto = PARTIDOS_EXTRA.filter(id => !ids.includes(id)).sort(() => Math.random() - 0.5);
  while (ids.length < Math.min(8, n || 4) && resto.length) ids.push(resto.pop());
  return ids;
}

// Llena PARTIDOS y ORDEN_HEMICICLO con los partidos de un país (los cuatro de siempre si no hay país).
function activarPartidos(s) {
  const ids = (s && s.partidos) || PARTIDOS_FIJOS;
  for (const k in PARTIDOS) delete PARTIDOS[k];
  for (const id of ids) {
    PARTIDOS[id] = { ...(CATALOGO_PARTIDOS[id] || PLANTILLA_JUGADOR) };
    const o = s && s.oposicion && s.oposicion.find(x => x.partido === id);
    // Los partidos propios de los jugadores se sientan según sus ideas.
    if (s && id === huecoDe(s.config) && s.config.propio) PARTIDOS[id].eje = ejeDePrincipios(s.config.principios);
    else if (o && o.perfil.propio) PARTIDOS[id].eje = ejeDePrincipios(o.perfil.principios || []);
  }
  ORDEN_HEMICICLO.length = 0;
  ORDEN_HEMICICLO.push(...ids.slice().sort((a, b) => PARTIDOS[a].eje - PARTIDOS[b].eje));
}
activarPartidos(null);

// Activa una nación: a partir de aquí «tu país», «tu partido» y «los demás países» son los suyos.
function usarNacion(s) {
  PAIS_JUGADOR.id = s.nacion;
  PAIS_JUGADOR.nombre = s.config.pais;
  PAIS_JUGADOR.colores = tonosPais(s.config.colorPais);
  activarPartidos(s);
  ID_JUGADOR = huecoDe(s.config);
  MESES_LEGISLATURA = s.config.legislatura;
  LIDER_INICIAL = (s.lideres && s.lideres[ID_JUGADOR]) || 'Marta Solís';
  verDesde(s.nacion);
}

// Nombre, color y bandera con los que los demás ven el país de un jugador.
function registrarHumano(pid, cfg) {
  Object.assign(NACIONES[pid], {
    humano: true, nombre: cfg.pais, color: cfg.colorPais, bandera: banderaJugador(cfg.colorPais), lider: cfg.lider,
    gobierno: `Gobierno de ${cfg.lider}`, desc: `Lo dirige ${cfg.lider}, de ${cfg.partido}.`,
  });
}

// Genera el mundo de una partida con sus naciones de jugador. duenos: provincias que han cambiado de manos.
function prepararMundo(cfg, humanos = 1, duenos = {}) {
  generarMundo(cfg.semilla, cfg.tamano, humanos);
  for (const id in duenos) if (PROV_POR_ID[id]) PROV_POR_ID[id].pais = duenos[id];
  recalcularFronteras();
}

// Lo que comparten todas las naciones de una partida.
function crearComun() {
  const comun = { duenos: {}, ocupadas: {}, mundo: { rel: {}, guerras: [], ejercitos: {}, eliminados: {} } };
  iniciarMundo(comun.mundo);
  return comun;
}

// Ejército y desaparición de cada país se leen y escriben en el mundo común, de modo que todas
// las naciones vean lo mismo. Si el país es de un jugador, su ejército son sus regimientos.
function enlazarNacion(s) {
  for (const pid in s.paises) {
    const p = s.paises[pid];
    Object.defineProperty(p, 'ejercito', {
      configurable: true, enumerable: false,
      get: () => s.mundo.ejercitos[pid] || 0,
      set: v => {
        s.mundo.ejercitos[pid] = Math.max(0, v);
        const t = nacionDe(pid);
        if (t) t.tropas = Math.max(0, v);
      },
    });
    Object.defineProperty(p, 'eliminado', {
      configurable: true, enumerable: false,
      get: () => !!s.mundo.eliminados[pid],
      set: v => { if (v) s.mundo.eliminados[pid] = true; else delete s.mundo.eliminados[pid]; },
    });
  }
}

const edificiosVacios = p => Object.fromEntries(Object.keys(EDIFICIOS).map(k => [k, (p && p.ini && p.ini[k]) || 0]));

// Crea la nación de un jugador sobre un mundo ya generado. comun: lo compartido por toda la partida.
function crearNacion(cfg, pid, comun, partidos) {
  // modo: 'carrera' mientras no gobiernas, 'gobierno' después. gobiernoIA: partido rival que gobierna, si lo hay.
  const s = {
    v: VERSION_GUARDADO, nacion: pid, config: cfg, modo: 'gobierno', gobiernoIA: null, carrera: null, mesGobierno: 0,
    mes: 0, dinero: DIFICULTADES[cfg.dificultad].dinero, cp: 5, estabilidad: 55,
    grupos: {}, edificios: {}, obras: [], leyes: {}, escanos: {}, relPartidos: {}, paises: {}, ministros: {},
    prestamos: [], promesas: [], objetivos: {}, historial: [],
    tropas: TROPAS_INICIALES, guerras: {}, batallas: [], anexiones: [], mapaVersion: 0,
    impuestos: 'normales', tributos: [], propuestas: [], oposicion: [], tokenGobierno: null, lideres: lideresAlAzar(cfg.lider),
    partidos: partidos || elegirPartidos(cfg.nPartidos, [huecoDe(cfg)]), sospecha: 0, corrupcion: {}, directiva: null, caida: null,
    duenos: comun.duenos, ocupadas: comun.ocupadas, mundo: comun.mundo,
    cuenta: { obras: 0, leyes: 0, elecciones: 0, plenos: 0, propuestas: 0, conquistas: 0 },
    propuesta: null, votacion: null, resultadoVoto: null, evento: null, congreso: null, elecciones: null, fin: null, ultimaLey: null,
    noticias: [], nNoticias: 0, recientes: [], ultimoMitin: -1,
    proximaEleccion: cfg.legislatura, inicioLegislatura: 0, legislatura: 1,
  };
  ESTADOS[pid] = s;
  usarNacion(s);
  comun.mundo.ejercitos[pid] = s.tropas;
  for (const g in GRUPOS) s.grupos[g] = 50;
  for (const p of provinciasJugador()) s.edificios[p.id] = edificiosVacios(p);
  for (const otro in PAISES) {
    const r = PAISES[otro].humano ? 0 : PAISES[otro].relacion;
    s.paises[otro] = { relacion: r, base: r, tratado: false, alianza: false, embargo: false, tregua: 0 };
  }
  enlazarNacion(s);
  relacionesIniciales(s);
  for (const id in CARTERAS) s.ministros[id] = null;
  s.escanos = estimarVotos(s, false);
  if (cfg.modo === 'carrera') iniciarCarrera(s);
  else {
    s.historial.push(puntoHistorial(s));
    noticia(s, `${cfg.lider} toma posesión como jefe de gobierno de ${cfg.pais}.`);
  }
  return s;
}

// Un nombre distinto para quien dirige cada partido (y ninguno igual al tuyo).
function lideresAlAzar(tuNombre) {
  const libres = NOMBRES_LIDERES.filter(n => n !== tuNombre).sort(() => Math.random() - 0.5);
  return Object.fromEntries(Object.keys(CATALOGO_PARTIDOS).map((pid, i) => [pid, libres[i % libres.length]]));
}

// Los partidos parecidos al del gobierno parten con mejor relación con él.
function relacionesIniciales(s) {
  const mia = afinidadDe(s, ID_JUGADOR);
  s.relPartidos = {};
  for (const partido in PARTIDOS) {
    if (partido === ID_JUGADOR) continue;
    const suya = afinidadDe(s, partido);
    s.relPartidos[partido] = limitar(Object.keys(mia).reduce((a, t) => a + mia[t] * (suya[t] || 0), 0) * 3, -30, 30);
  }
}

// Partida de un jugador.
function nuevaPartida(config) {
  const cfg = completarConfig(config);
  for (const k in ESTADOS) delete ESTADOS[k];
  prepararMundo(cfg, 1);
  registrarHumano(idHumano(0), cfg);
  return crearNacion(cfg, idHumano(0), crearComun());
}

// Vuelve a montar una partida de un jugador guardada.
function activarPartida(s) {
  for (const k in ESTADOS) delete ESTADOS[k];
  prepararMundo(s.config, 1, s.duenos);
  registrarHumano(s.nacion, s.config);
  ESTADOS[s.nacion] = s;
  enlazarNacion(s);
  usarNacion(s);
}

// Una muestra mensual para las gráficas: d dinero o fondos, p apoyo medio, e estabilidad o prestigio, v escaños en las encuestas.
function puntoHistorial(s) {
  const c = s.carrera && s.modo === 'carrera' ? s.carrera : null;
  return { d: c ? c.fondos : s.dinero, p: popularidad(s), e: c ? c.prestigio : s.estabilidad, v: estimarVotos(s, false)[ID_JUGADOR] };
}

function guardar(s) { try { localStorage.setItem(GUARDADO, JSON.stringify(s)); } catch (e) { /* sin almacenamiento */ } }
function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(GUARDADO));
    return s && s.v === VERSION_GUARDADO ? s : null;
  } catch (e) { return null; }
}
function borrarGuardado() { try { localStorage.removeItem(GUARDADO); } catch (e) { /* sin almacenamiento */ } }

function fecha(mes) { return `${MESES[mes % 12]} de ${ANIO_INICIAL + Math.floor(mes / 12)}`; }
// tipo: 'bien', 'mal', 'mundo' (algo que pasa entre otros países) o vacío.
function noticia(s, texto, tipo = '') {
  s.noticias.unshift({ mes: s.mes, texto, tipo });
  s.noticias.length = Math.min(s.noticias.length, 100);
  s.nNoticias++;
}

// ---------- Partidos e ideología ----------

function siglasDe(nombre) {
  // Solo cuentan letras y números: un nombre con símbolos no debe dar siglas raras.
  const limpio = nombre.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const sig = limpio.split(/\s+/).filter(p => p.length > 2).map(p => p[0]).join('').slice(0, 3).toUpperCase();
  return sig.length >= 2 ? sig : (limpio.slice(0, 2).toUpperCase() || 'TP');
}

// Los principios de un partido creado por un jugador (el del gobierno o uno de la oposición); null si no lo es.
function principiosDe(s, pid) {
  if (!s) return null;
  if (pid === ID_JUGADOR) return s.config.propio ? s.config.principios : null;
  const o = opositorDe(s, pid);
  return o && o.perfil.propio ? o.perfil.principios : null;
}

// Qué tipos de ley le gustan a un partido. Los creados por jugadores, según sus principios.
function afinidadDe(s, pid) {
  const principios = principiosDe(s, pid);
  if (!principios) return PARTIDOS[pid].afinidad;
  const a = {};
  for (const t of principios) {
    a[t] = 2;
    if (PRINCIPIOS[t].opuesto) a[PRINCIPIOS[t].opuesto] = -2;
  }
  return a;
}
const ideologiaLey = (afinidad, ley, derogar) => ley.tags.reduce((a, t) => a + (afinidad[t] || 0), 0) * (derogar ? -1 : 1);
// Lo que tu partido piensa de una ley: positivo si encaja con sus ideas, negativo si las contradice.
const opinionPartido = (s, leyId, derogar) => ideologiaLey(afinidadDe(s, ID_JUGADOR), LEY_POR_ID[leyId], derogar);

// Quién dirige cada partido: tú, otro jugador o un nombre de la partida.
function liderDe(s, pid) {
  if (!s) return '';
  if (pid === ID_JUGADOR) return s.modo === 'carrera' && s.carrera && s.carrera.cargo !== 'lider' ? LIDER_INICIAL : s.config.lider;
  const o = opositorDe(s, pid);
  if (o) return o.perfil.lider;
  return (s.lideres && s.lideres[pid]) || '';
}

// Datos de un partido listos para mostrar. Los de los jugadores llevan su nombre, color y emblema.
function partidoInfo(s, pid) {
  const P = PARTIDOS[pid], jugador = pid === ID_JUGADOR, lider = liderDe(s, pid);
  const o = opositorDe(s, pid);
  if (o) {
    const c = o.perfil;
    return c.propio ? { ...P, humano: true, lider, nombre: c.partido, siglas: siglasDe(c.partido), color: c.color, emblema: c.emblema, afinidad: afinidadDe(s, pid) }
      : { ...P, humano: true, lider };
  }
  if (!s || !jugador || !s.config.propio) return { ...P, jugador, lider };
  return { ...P, jugador, lider, nombre: s.config.partido, siglas: siglasDe(s.config.partido), color: s.config.color, emblema: s.config.emblema, afinidad: afinidadDe(s, pid) };
}

const mediaBase = base => Object.keys(GRUPOS).reduce((a, g) => a + GRUPOS[g].peso * base[g], 0);

// Tirón de un partido en cada grupo cuando su apoyo es 50. Los creados por jugadores, según sus
// principios; el del gobierno, ajustado para que la media sea siempre 33.
function baseDe(s, pid) {
  const principios = principiosDe(s, pid), m = {};
  for (const g in GRUPOS) {
    m[g] = principios ? Math.max(0.2, 1 + principios.reduce((a, t) => a + (PRINCIPIOS[t].grupos[g] || 0), 0)) : PARTIDOS[pid].base[g];
  }
  if (principios || pid === ID_JUGADOR) {
    const k = 33 / mediaBase(m);
    for (const g in GRUPOS) m[g] *= k;
  }
  return m;
}
const basePropia = s => baseDe(s, ID_JUGADOR);

// ---------- Gabinete ----------

const nivelCandidato = (c, cartera) => (c.cartera === cartera ? c.nivel : Math.max(1, c.nivel - 2));
function nivelMinistro(s, cartera) {
  const id = s.ministros[cartera];
  return id ? nivelCandidato(CAND_POR_ID[id], cartera) : 0;
}
const numMinistros = s => Object.values(s.ministros).filter(Boolean).length;

function puedeNombrar(s, cartera, candId) {
  if (Object.values(s.ministros).includes(candId)) return { ok: false, motivo: 'Ya está en el gabinete' };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}

function nombrar(s, cartera, candId) {
  if (s.ministros[cartera] || !puedeNombrar(s, cartera, candId).ok) return;
  s.cp -= 1;
  s.ministros[cartera] = candId;
  noticia(s, `${CAND_POR_ID[candId].nombre} jura el cargo al frente de ${CARTERAS[cartera].nombre}.`);
}

function destituir(s, cartera) {
  const id = s.ministros[cartera];
  if (!id) return;
  const c = CAND_POR_ID[id];
  s.ministros[cartera] = null;
  if (c.partido in s.relPartidos) s.relPartidos[c.partido] = limitar(s.relPartidos[c.partido] - 8, -100, 100);
  noticia(s, `${c.nombre} deja ${CARTERAS[cartera].nombre}.`);
}

// Relación con un partido: lo acumulado más 12 por cada ministro suyo en tu gabinete.
function relacionPartido(s, pid) {
  let n = s.relPartidos[pid];
  for (const id of Object.values(s.ministros)) if (id && CAND_POR_ID[id].partido === pid) n += 12;
  return limitar(n, -100, 100);
}

// ---------- Economía ----------

// Edificios en funcionamiento: los de las provincias ocupadas por un enemigo no cuentan.
function contarEdificios(s) {
  const t = {};
  for (const k in EDIFICIOS) t[k] = 0;
  for (const p of provinciasLibres(s)) for (const k in t) t[k] += (s.edificios[p.id] && s.edificios[p.id][k]) || 0;
  return t;
}

function influencia(s) {
  const vivos = paisesVivos(s);
  let n = 0, rel = 0;
  for (const pid of vivos) {
    const p = s.paises[pid];
    n += (p.tratado ? 10 : 0) + (p.alianza ? 20 : 0);
    rel += p.relacion;
  }
  return Math.round(n + Math.max(0, rel / (vivos.length || 1)) / 4 + nivelMinistro(s, 'exteriores') * 2);
}

// Todo lo que multiplica la economía: leyes, edificios especiales, ministros e influencia.
function modsGlobales(s) {
  const m = { fabricas: 1, minas: 1, export: 1, construccion: 1, impuestos: 1, granjaExtra: 0 };
  for (const ley of LEYES) {
    if (!s.leyes[ley.id] || !ley.mods) continue;
    for (const k in ley.mods) m[k] = k === 'granjaExtra' ? m[k] + ley.mods[k] : m[k] * ley.mods[k];
  }
  const t = contarEdificios(s);
  m.export *= (1 + Math.min(3, t.puerto) * 0.1) * (1 + influencia(s) * 0.003);
  m.fabricas *= 1 + Math.min(3, t.universidad) * 0.05;
  m.impuestos *= (1 + nivelMinistro(s, 'hacienda') * 0.03) * NIVELES_IMPUESTOS[s.impuestos].mult;
  m.construccion *= 1 - nivelMinistro(s, 'industria') * 0.04;
  return m;
}

const hayEmbargo = (s, pid) => s.paises[pid].relacion <= -40;

function calcularEconomia(s) {
  const t = contarEdificios(s), m = modsGlobales(s), pob = poblacionTotal(s);
  const alimProd = t.granja * (4 + m.granjaExtra);
  const alimCons = Math.ceil(pob / 1000);
  const matProd = Math.round(t.mina * 4 * m.minas);
  const capacidad = t.fabrica * 3;
  const usadas = Math.min(matProd, capacidad);
  const lineas = [];
  const add = (texto, v) => { v = Math.round(v); if (v) lineas.push({ texto, v }); };

  add('Impuestos', pob / 100 * m.impuestos);
  add(`Venta de bienes (${usadas})`, usadas * 12 * m.fabricas * m.export);
  add(`Venta de materias primas sobrantes (${matProd - usadas})`, (matProd - usadas) * 4 * m.export);
  const dif = alimProd - alimCons;
  if (dif >= 0) add(`Venta de alimentos sobrantes (${dif})`, dif * 3 * m.export);
  else add(`Importación de alimentos (faltan ${-dif})`, dif * 6);
  // Mercados, turismo, intereses y tributos.
  let mercados = 0;
  for (const p of provinciasLibres(s)) if (s.edificios[p.id].mercado) mercados += 6 + p.pob / 60;
  add(`Mercados (${t.mercado})`, mercados);
  add(`Turismo (${t.hotel} ${t.hotel === 1 ? 'hotel' : 'hoteles'})`, t.hotel * ingresoHotel(s));
  if (t.banco) add('Intereses del banco', Math.min(40, Math.max(0, s.dinero) * 0.015));
  for (const tr of s.tributos) add(`Tributo de ${PAISES[tr.pais].nombre} (${tr.meses} meses más)`, tr.cantidad);
  for (const pid of paisesVivos(s)) {
    if (s.paises[pid].tratado) add(`Tratado comercial con ${PAISES[pid].nombre}`, PAISES[pid].comercio);
    if (hayEmbargo(s, pid)) add(`${s.guerras[pid] ? 'Bloqueo' : 'Embargo'} de ${PAISES[pid].nombre}`, -20);
  }
  add('Administración del Estado', -dificultad(s).admin);
  let mant = 0;
  for (const k in EDIFICIOS) mant += t[k] * EDIFICIOS[k].mant;
  add('Mantenimiento de edificios', -mant);
  add(enGuerra(s) ? `Ejército en campaña (${s.tropas})` : `Ejército (${s.tropas})`, -s.tropas * MANT_TROPA * (enGuerra(s) ? 2 : 1));
  add('Sueldos del gabinete', -4 * numMinistros(s));
  add('Cuotas de préstamos', -cuotaPrestamo(s) * s.prestamos.length);
  for (const ley of LEYES) if (s.leyes[ley.id] && ley.coste) add(ley.nombre, -ley.coste);

  return {
    lineas, balance: lineas.reduce((a, l) => a + l.v, 0), mods: m,
    alimProd, alimCons, matProd, capacidad, usadas, faltaComida: dif < 0,
  };
}

// Un hotel rinde según la estabilidad del país, y en guerra apenas llegan turistas.
const ingresoHotel = s => 28 * limitar(s.estabilidad / 60, 0.3, 1.4) * (enGuerra(s) ? 0.4 : 1);
const cuotaPrestamo = s => (contarEdificios(s).banco ? 9 : 12);

function puedeCambiarImpuestos(s, nivel) {
  if (s.impuestos === nivel) return { ok: false };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}
function cambiarImpuestos(s, nivel) {
  if (!puedeCambiarImpuestos(s, nivel).ok) return;
  s.cp -= 1;
  s.impuestos = nivel;
  noticia(s, `El gobierno pone los impuestos en nivel «${NIVELES_IMPUESTOS[nivel].nombre.toLowerCase()}».`);
}

// ---------- Previsiones ----------
// Para saber qué cambiaría algo antes de hacerlo: se aplica, se mide y se deshace.

function medirEstado(s) {
  const eco = calcularEconomia(s), grupos = {};
  for (const g in GRUPOS) grupos[g] = objetivoGrupo(s, g).valor;
  return { eco, grupos, estabilidad: objetivoEstabilidad(s).valor };
}

function medirCambio(s, aplicar, deshacer) {
  const a = medirEstado(s);
  aplicar();
  let d;
  try { d = medirEstado(s); } finally { deshacer(); }
  const grupos = {};
  for (const g in GRUPOS) if (d.grupos[g] !== a.grupos[g]) grupos[g] = d.grupos[g] - a.grupos[g];
  // Cambio de la popularidad: la media de los grupos, pesada por lo que es cada uno.
  const popularidad = Math.round(Object.keys(grupos).reduce((acc, g) => acc + grupos[g] * GRUPOS[g].peso, 0));
  return { dinero: d.eco.balance - a.eco.balance, grupos, popularidad, estabilidad: d.estabilidad - a.estabilidad, antes: a.eco, despues: d.eco };
}

// Lo que cambiaría un edificio cuando esté terminado: dinero al mes, apoyos y una explicación.
function previsionEdificio(s, provId, tipo) {
  const ed = s.edificios[provId];
  const r = medirCambio(s, () => { ed[tipo]++; }, () => { ed[tipo]--; });
  const A = r.antes, D = r.despues, notas = [];
  const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (tipo === 'fabrica') {
    notas.push(D.usadas > A.usadas ? `Fabricará ${cuantos(D.usadas - A.usadas, 'bien', 'bienes')} al mes con materias primas que ahora se venden baratas.`
      : 'No hay materias primas libres: no fabricará nada hasta que tengas otra mina.');
  }
  if (tipo === 'mina') {
    notas.push(`Sacará ${D.matProd - A.matProd} materias primas al mes${D.usadas > A.usadas
      ? ', que tus fábricas convertirán en bienes.' : '. Tus fábricas ya están llenas, así que se venderán sin transformar, más baratas.'}`);
  }
  if (tipo === 'granja') {
    notas.push(A.faltaComida ? `Dará ${D.alimProd - A.alimProd} alimentos al mes y reducirá la comida que importas, que sale cara.`
      : `Dará ${D.alimProd - A.alimProd} alimentos al mes. Ya comes de lo tuyo, así que se venderán.`);
  }
  if (tipo === 'mercado') notas.push(`Esta provincia tiene ${PROV_POR_ID[provId].pob.toLocaleString('es')} mil habitantes: cuanta más gente, más rinde.`);
  if (tipo === 'hotel') notas.push(`Con la estabilidad actual (${s.estabilidad}) cada hotel rinde ${Math.round(ingresoHotel(s))} al mes antes de mantenimiento.`);
  if (tipo === 'banco') notas.push(`Rinde un 1,5% de lo que haya en el tesoro (hasta 40 al mes) y baja la cuota de los préstamos de 12 a 9.`);
  if (tipo === 'puerto' && Object.values(PAISES).some(P => P.isla)) notas.push('Además permite comerciar con las islas y desembarcar en ellas.');
  if (tipo === 'cuartel') notas.push('Caben 3 regimientos más en tu ejército.');
  r.recupera = r.dinero > 0 ? Math.ceil(costeEdificio(s, tipo) / r.dinero) : null;
  r.notas = notas;
  return r;
}

// Dinero al mes que aporta (o cuesta) una ley mientras está en vigor, con la economía de hoy.
function efectoDineroLey(s, leyId) {
  const ley = LEY_POR_ID[leyId], inc = ley.incompatible, antes = s.leyes[leyId], antesInc = inc ? s.leyes[inc] : undefined;
  if (inc) s.leyes[inc] = false;
  s.leyes[leyId] = true;
  const con = calcularEconomia(s).balance;
  s.leyes[leyId] = false;
  const sin = calcularEconomia(s).balance;
  s.leyes[leyId] = antes;
  if (inc) s.leyes[inc] = antesInc;
  return con - sin;
}

function puedePrestamo(s) { return s.prestamos.length < 3 ? { ok: true } : { ok: false, motivo: 'Ningún banco te presta más' }; }
function pedirPrestamo(s) {
  if (!puedePrestamo(s).ok) return;
  s.dinero += 200;
  s.prestamos.push(24);
  noticia(s, 'El Estado pide un préstamo de 200.');
}

// ---------- Construcción ----------

function costeEdificio(s, tipo) { return Math.round(EDIFICIOS[tipo].coste * modsGlobales(s).construccion); }
const obrasEn = (s, provId) => s.obras.filter(o => o.prov === provId);
function solaresOcupados(s, provId) {
  let n = obrasEn(s, provId).length;
  for (const k in EDIFICIOS) n += s.edificios[provId][k];
  return n;
}

// Si la provincia no sirve para ese edificio, el motivo; si sirve, null.
function requisitoTerreno(provId, tipo) {
  const p = PROV_POR_ID[provId], e = EDIFICIOS[tipo];
  if (e.requiere === 'fertil' && !p.fertil) return 'Esta tierra no es fértil';
  if (e.requiere === 'mineral' && !p.mineral) return 'Aquí no hay minerales';
  if (e.requiere === 'costera' && !GEO.provs[provId].costera) return 'No tiene salida al mar';
  if (e.requiere === 'capital' && !(p.capital && p.origen === PAIS_JUGADOR.id)) return 'Solo en tu capital';
  return null;
}

function puedeConstruir(s, provId, tipo) {
  const p = PROV_POR_ID[provId], e = EDIFICIOS[tipo], terreno = requisitoTerreno(provId, tipo);
  if (s.ocupadas[provId]) return { ok: false, motivo: 'Provincia ocupada por el enemigo' };
  if (terreno) return { ok: false, motivo: terreno };
  if (e.unico && (s.edificios[provId][tipo] || obrasEn(s, provId).some(o => o.tipo === tipo))) return { ok: false, motivo: 'Solo cabe uno por provincia' };
  if (solaresOcupados(s, provId) >= solaresDe(p)) return { ok: false, motivo: 'No quedan solares libres' };
  if (s.dinero < costeEdificio(s, tipo)) return { ok: false, motivo: 'No hay dinero suficiente' };
  return { ok: true };
}

function construir(s, provId, tipo) {
  if (!puedeConstruir(s, provId, tipo).ok) return;
  s.dinero -= costeEdificio(s, tipo);
  s.obras.push({ prov: provId, tipo, meses: EDIFICIOS[tipo].meses });
  s.cuenta.obras++;
}

function demoler(s, provId, tipo) {
  if (!s.edificios[provId][tipo]) return;
  s.edificios[provId][tipo]--;
  noticia(s, `Se derriba ${EDIFICIOS[tipo].art} ${EDIFICIOS[tipo].nombre.toLowerCase()} en ${PROV_POR_ID[provId].nombre}.`);
}

function avanzarObras(s) {
  for (const o of s.obras) {
    if (s.ocupadas[o.prov] || --o.meses > 0) continue;   // las obras se paran durante una ocupación
    s.edificios[o.prov][o.tipo]++;
    const e = EDIFICIOS[o.tipo];
    noticia(s, `Se inaugura ${e.art} ${e.nombre.toLowerCase()} en ${PROV_POR_ID[o.prov].nombre}.`, 'bien');
  }
  s.obras = s.obras.filter(o => o.meses > 0);
}

// ---------- Sociedad ----------

// Apoyo hacia el que tiende un grupo, con las razones para poder explicarlo en pantalla.
function objetivoGrupo(s, g) {
  if (s.modo === 'carrera') return objetivoGrupoCarrera(s, g);
  const t = contarEdificios(s), dif = dificultad(s), razones = [];
  const add = (texto, v) => { v = Math.round(v); if (v) razones.push({ texto, v }); };
  for (const ley of LEYES) if (s.leyes[ley.id] && ley.grupos && ley.grupos[g]) add(ley.nombre, ley.grupos[g]);
  if (g === 'obreros') add('Empleo en minas y fábricas', Math.min(12, 1.5 * (t.mina + t.fabrica)));
  if (g === 'empresarios') add('Negocio de las fábricas', Math.min(12, 2 * t.fabrica));
  if (g === 'campesinos') add('Trabajo en las granjas', Math.min(10, 2 * t.granja));
  if (g === 'jovenes') {
    add('Oportunidades de empleo', Math.min(6, t.fabrica));
    add('Universidades', Math.min(12, 4 * t.universidad));
  }
  add('Mercados', g === 'empresarios' ? Math.min(6, 2 * t.mercado) : 0);
  add('Turismo', g === 'jovenes' ? Math.min(4, t.hotel) : 0);
  const imp = NIVELES_IMPUESTOS[s.impuestos];
  add(`Impuestos ${imp.nombre.toLowerCase()}`, imp.todos + ((imp.grupos || {})[g] || 0));
  add('Desgaste de gobernar', -Math.min(10, Math.floor((s.mes - s.inicioLegislatura) / dif.desgaste)));
  add('Cansancio de guerra', -cansancioGuerra(s));
  add('Provincias ocupadas por el enemigo', -3 * provinciasJugador().filter(p => s.ocupadas[p.id]).length);
  if (calcularEconomia(s).faltaComida) add('Escasez de alimentos', -6);
  if (s.dinero < 0) add('Deuda pública', -8);
  if (s.estabilidad < 35) add('Inestabilidad', -5);
  return { valor: limitar(dif.apoyoBase + razones.reduce((a, r) => a + r.v, 0)), razones };
}

function popularidad(s) {
  let p = 0;
  for (const g in GRUPOS) p += s.grupos[g] * GRUPOS[g].peso;
  return Math.round(p);
}

function objetivoEstabilidad(s) {
  const razones = [];
  const add = (texto, v) => { v = Math.round(v); if (v) razones.push({ texto, v }); };
  add('Popularidad del gobierno', (popularidad(s) - 50) * 0.8);
  for (const ley of LEYES) if (s.leyes[ley.id] && ley.estabilidad) add(ley.nombre, ley.estabilidad);
  for (const pid of paisesVivos(s)) if (s.paises[pid].alianza) add(`Alianza con ${PAISES[pid].nombre}`, 4);
  add('Cuarteles', 3 * contarEdificios(s).cuartel);
  add('Ministro del Interior', 1.5 * nivelMinistro(s, 'interior'));
  add('País en guerra', -4 * Object.keys(s.guerras).length);
  add(`Impuestos ${NIVELES_IMPUESTOS[s.impuestos].nombre.toLowerCase()}`, NIVELES_IMPUESTOS[s.impuestos].estabilidad || 0);
  add('Resistencia en las provincias anexionadas', -2 * anexionesRecientes(s).length);
  if (s.dinero < 0) add('Deuda pública', -10);
  return { valor: limitar(50 + razones.reduce((a, r) => a + r.v, 0)), razones };
}

// El dinero disponible: el tesoro del Estado si gobiernas, tus fondos de campaña si no.
const tesoro = s => (s.modo === 'carrera' ? s.carrera.fondos : s.dinero);
function gastar(s, n) { if (s.modo === 'carrera') s.carrera.fondos -= n; else s.dinero -= n; }

function puedeMitin(s) {
  if (s.ultimoMitin === s.mes) return { ok: false, motivo: 'Ya has dado un mitin este mes' };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  if (tesoro(s) < 40) return { ok: false, motivo: s.modo === 'carrera' ? 'Faltan fondos' : 'No hay dinero' };
  return { ok: true };
}

function darMitin(s, g) {
  if (!puedeMitin(s).ok) return;
  s.cp -= 1;
  gastar(s, 40);
  s.ultimoMitin = s.mes;
  s.grupos[g] = limitar(s.grupos[g] + 5);
  if (s.modo === 'carrera') s.carrera.prestigio = limitar(s.carrera.prestigio + 1);
  noticia(s, `${s.config.lider} da un mitin ante los ${GRUPOS[g].nombre.toLowerCase()}.`);
}

// ---------- Parlamento ----------

function puedeProponer(s, leyId, derogar) {
  const ley = LEY_POR_ID[leyId];
  if (s.propuesta) return { ok: false, motivo: 'Ya hay una ley en trámite' };
  if (!derogar && ley.incompatible && s.leyes[ley.incompatible]) {
    return { ok: false, motivo: `Incompatible con «${LEY_POR_ID[ley.incompatible].nombre}»` };
  }
  return { ok: true };
}

function proponerLey(s, leyId, derogar) {
  if (!puedeProponer(s, leyId, derogar).ok) return;
  s.propuesta = { ley: leyId, derogar: !!derogar, negociado: {} };
}

// Qué vota tu propio partido. Si la ley es tuya te apoya, salvo que seas un diputado sin
// respaldo de la dirección. Si la ley es del gobierno, vota lo que se haya decidido (por defecto, se abstiene).
const APOYO_PARA_RESPALDO = 40;
function votoPartidoJugador(s, prop) {
  if (prop.autor && prop.autor !== ID_JUGADOR) return prop.votoJugador || 'abs';
  if (s.modo === 'carrera' && s.carrera.cargo === 'diputado' && s.carrera.interno < APOYO_PARA_RESPALDO) return 'abs';
  return 'si';
}

// Cada partido vota en bloque. Quien propone la ley la apoya; los demás deciden por ideología y,
// si la ley es tuya, también por su relación contigo y por lo que hayas negociado.
function intencionVoto(s, prop) {
  const ley = LEY_POR_ID[prop.ley], autor = prop.autor || ID_JUGADOR, tuya = autor === ID_JUGADOR;
  const r = { partidos: {}, si: 0, no: 0, abs: 0 };
  for (const pid in PARTIDOS) {
    let d;
    if (pid === ID_JUGADOR) d = { voto: votoPartidoJugador(s, prop), ideologia: 0, relacion: 0, negociado: 0, total: 0 };
    else if (pid === autor) d = { voto: 'si', ideologia: 0, relacion: 0, negociado: 0, total: 0, autor: true };
    else if (opositorDe(s, pid) && opositorDe(s, pid).postura !== 'ideas' && !opositorDe(s, autor)) {
      // Un jugador de la oposición puede apoyar o bloquear todo lo que presente el gobierno.
      d = { ideologia: 0, relacion: 0, negociado: 0, total: 0, voto: opositorDe(s, pid).postura === 'apoyar' ? 'si' : 'no', postura: true };
    } else {
      const ideologia = ideologiaLey(afinidadDe(s, pid), ley, prop.derogar);
      const relacion = tuya ? Math.round(relacionPartido(s, pid) / 40 * 10) / 10 : 0;
      const negociado = (tuya && prop.negociado[pid]) || 0;
      const total = ideologia + relacion + negociado;
      d = { ideologia, relacion, negociado, total, voto: total >= 1 ? 'si' : total <= -1 ? 'no' : 'abs' };
    }
    r.partidos[pid] = d;
    r[d.voto] += s.escanos[pid];
  }
  r.aprueba = r.si > r.no;
  return r;
}

function puedeNegociar(s, pid) {
  if (!s.propuesta) return { ok: false };
  if ((s.propuesta.negociado[pid] || 0) >= 3) return { ok: false, motivo: 'No cede más' };
  if (s.cp < 1) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}

function negociar(s, pid) {
  if (!puedeNegociar(s, pid).ok) return;
  s.cp -= 1;
  s.propuesta.negociado[pid] = (s.propuesta.negociado[pid] || 0) + 1;
}

// Llevar una ley al pleno cuesta 2 de capital político: 1 más si eres un diputado raso
// y 1 más si la ley va contra las ideas de tu propio partido.
const leyContraria = (s, prop) => !!prop && opinionPartido(s, prop.ley, prop.derogar) <= -2;
function costeVotar(s, prop = s.propuesta) {
  return 2 + (s.modo === 'carrera' && s.carrera.cargo === 'diputado' ? 1 : 0) + (leyContraria(s, prop) ? 1 : 0);
}

function votar(s) {
  const prop = s.propuesta;
  if (!prop || s.cp < costeVotar(s)) return;
  s.cp -= costeVotar(s);
  s.cuenta.propuestas++;
  resolverVotacion(s, prop);
  s.propuesta = null;
}

// Celebra la votación de una ley, sea tuya o del partido que gobierna, y deja el resultado para mostrarlo.
function resolverVotacion(s, prop) {
  const ley = LEY_POR_ID[prop.ley], r = intencionVoto(s, prop), votos = {};
  const autor = prop.autor || ID_JUGADOR, tuya = autor === ID_JUGADOR;
  for (const pid in PARTIDOS) votos[pid] = r.partidos[pid].voto;
  const que = `${prop.derogar ? 'derogar' : 'aprobar'} «${ley.nombre}»`;
  const opo = opositorDe(s, autor);
  if (opo) {
    const quien = partidoInfo(s, autor).nombre;
    if (r.aprueba) {
      s.leyes[ley.id] = !prop.derogar;
      s.ultimaLey = { mes: s.mes, id: ley.id, derogar: prop.derogar, si: r.si, no: r.no };
    }
    noticia(s, r.aprueba ? `La oposición (${quien}) consigue ${que} por ${r.si} votos a ${r.no}.` : `${quien} no consigue ${que}.`, r.aprueba ? 'mal' : '');
    s.resultadoVoto = { ley: ley.id, derogar: prop.derogar, autor, si: r.si, no: r.no, abs: r.abs, aprueba: r.aprueba, votos, escanos: { ...s.escanos } };
    return;
  }
  if (r.aprueba) {
    s.leyes[ley.id] = !prop.derogar;
    s.ultimaLey = { mes: s.mes, id: ley.id, derogar: prop.derogar, si: r.si, no: r.no };
    if (tuya) {
      s.cuenta.leyes++;
      // A los partidos les gusta más (o menos) quien legisla a su favor (o en contra).
      for (const pid in s.relPartidos) s.relPartidos[pid] = limitar(s.relPartidos[pid] + r.partidos[pid].ideologia * 5, -100, 100);
    }
    noticia(s, tuya ? `El parlamento ${prop.derogar ? 'deroga' : 'aprueba'} «${ley.nombre}» por ${r.si} votos a ${r.no}.`
      : `El gobierno consigue ${que} por ${r.si} votos a ${r.no}.`, tuya ? 'bien' : '');
  } else {
    noticia(s, tuya ? `El parlamento rechaza ${que}: ${r.si} a favor y ${r.no} en contra.`
      : `El gobierno fracasa al intentar ${que}.`, tuya ? 'mal' : '');
  }
  if (tuya && s.modo === 'carrera') premioLeyCarrera(s, ley, prop.derogar, r.aprueba);
  if (s.modo === 'gobierno') revisarPromesas(s);
  s.resultadoVoto = { ley: ley.id, derogar: prop.derogar, autor, si: r.si, no: r.no, abs: r.abs, aprueba: r.aprueba, votos, escanos: { ...s.escanos } };
}

// Qué parte de cada grupo social vota a cada partido (de 0 a 1).
// Con azar para las elecciones reales, sin él para las encuestas.
function repartoPorGrupo(s, conAzar) {
  const reparto = {}, mia = basePropia(s);
  // Si te has unido a un partido que no es el de centro, el centro hereda una base plana equivalente.
  const centro = mediaBase(PARTIDOS[ID_JUGADOR].base);
  // Los partidos de jugadores de la oposición: su base, multiplicada por la imagen que se han ganado.
  const opos = {};
  for (const o of s.oposicion || []) opos[o.partido] = { o, base: o.perfil.propio ? baseDe(s, o.partido) : PARTIDOS[o.partido].base };
  for (const g in GRUPOS) {
    const pesos = {};
    let suma = 0;
    for (const pid in PARTIDOS) {
      // Tu partido crece con el apoyo del grupo; los demás tienen su base fija,
      // y el rival que gobierna suma la ventaja de estar en el poder.
      if (pid === ID_JUGADOR) pesos[pid] = mia[g] * Math.pow(s.grupos[g] / 50, 1.5);
      else if (opos[pid]) pesos[pid] = opos[pid].base[g] * Math.max(0.3, 1 + (opos[pid].o.imagen[g] || 0) / 40) * (conAzar ? 0.9 + Math.random() * 0.2 : 1);
      else {
        const base = pid === 'uc' ? centro : PARTIDOS[pid].base[g];
        pesos[pid] = base * (conAzar ? 0.9 + Math.random() * 0.2 : 1) * (pid === s.gobiernoIA ? s.carrera.fuerzaGobierno : 1);
      }
      suma += pesos[pid];
    }
    reparto[g] = {};
    for (const pid in PARTIDOS) reparto[g][pid] = pesos[pid] / suma;
  }
  return reparto;
}

// Voto por partido en una provincia según los grupos que viven en ella.
function votoProvincia(s, provId) {
  const reparto = repartoPorGrupo(s, false), mix = PROV_POR_ID[provId].mix, v = {};
  for (const pid in PARTIDOS) v[pid] = Object.keys(GRUPOS).reduce((a, g, i) => a + mix[i] * reparto[g][pid], 0);
  return v;
}
const masVotado = votos => Object.keys(votos).reduce((a, b) => (votos[b] > votos[a] ? b : a), ID_JUGADOR);

function estimarVotos(s, conAzar) {
  const votos = {}, reparto = repartoPorGrupo(s, conAzar);
  for (const pid in PARTIDOS) votos[pid] = 0;
  for (const g in GRUPOS) for (const pid in PARTIDOS) votos[pid] += GRUPOS[g].peso * reparto[g][pid] * 100;
  // Reparto proporcional de 100 escaños por resto mayor.
  const escanos = {}, restos = [];
  let asignados = 0;
  for (const pid in votos) {
    escanos[pid] = Math.floor(votos[pid]);
    asignados += escanos[pid];
    restos.push([pid, votos[pid] - escanos[pid]]);
  }
  restos.sort((a, b) => b[1] - a[1]);
  for (let i = 0; asignados < 100; i++, asignados++) escanos[restos[i % restos.length][0]]++;
  return escanos;
}

const ganaJugador = escanos => Object.keys(escanos).every(pid => escanos[ID_JUGADOR] >= escanos[pid]);

function celebrarElecciones(s) {
  if (s.modo === 'carrera') return eleccionesCarrera(s);
  const escanos = estimarVotos(s, true);
  // En un país compartido gobierna el partido de jugador con más escaños; nadie queda fuera.
  const compartido = s.oposicion && s.oposicion.length;
  const ganador = compartido ? [ID_JUGADOR, ...s.oposicion.map(o => o.partido)].reduce((a, b) => (escanos[b] > escanos[a] ? b : a)) : null;
  const gana = compartido ? true : ganaJugador(escanos);
  s.elecciones = { antes: { ...s.escanos }, escanos, gana };
  s.escanos = escanos;
  s.propuesta = null;
  if (compartido && ganador !== ID_JUGADOR) {
    const nuevo = opositorDe(s, ganador).perfil.lider;
    const sale = cambiarGobierno(s, opositorDe(s, ganador));
    s.elecciones.relevo = { sale, entra: nuevo };
    s.legislatura++;
    s.inicioLegislatura = s.mes;
    s.proximaEleccion += MESES_LEGISLATURA;
    return;
  }
  if (gana) {
    s.legislatura++;
    s.cuenta.elecciones++;
    s.inicioLegislatura = s.mes;
    s.proximaEleccion += MESES_LEGISLATURA;
    s.cp = limitar(s.cp + 3, 0, CP_MAXIMO);
    for (const pid in s.relPartidos) s.relPartidos[pid] = Math.round(s.relPartidos[pid] / 2);
    noticia(s, `${partidoInfo(s, ID_JUGADOR).nombre} gana las elecciones con ${escanos[ID_JUGADOR]} escaños.`, 'bien');
  } else {
    // Perder no acaba la partida: pasas a la oposición con una directiva del partido.
    noticia(s, `${partidoInfo(s, ID_JUGADOR).nombre} pierde las elecciones.`, 'mal');
    s.legislatura++;
    s.proximaEleccion = s.mes + MESES_LEGISLATURA;
    caerDelGobierno(s, 'elecciones');
    s.elecciones.caida = true;
  }
}

// ---------- Diplomacia ----------

// Con otro jugador no cuenta la relación: los tratados y alianzas se le proponen y él decide.
function puedeDiplo(s, pid, accion) {
  const a = ACCIONES_DIPLO[accion], p = s.paises[pid], humano = esHumano(pid);
  if (s.guerras[pid]) return { ok: false, motivo: 'Estáis en guerra' };
  if (accion === 'tratado') {
    if (p.tratado) return { ok: false, motivo: 'Ya firmado' };
    if (PAISES[pid].requierePuerto && !contarEdificios(s).puerto) return { ok: false, motivo: 'Necesitas un puerto' };
    if (!humano && p.relacion < 25) return { ok: false, motivo: 'Falta relación (25)' };
  }
  if (accion === 'alianza') {
    if (p.alianza) return { ok: false, motivo: 'Ya sois aliados' };
    if (!p.tratado) return { ok: false, motivo: 'Primero un tratado' };
    if (!humano && p.relacion < 55) return { ok: false, motivo: 'Falta relación (55)' };
  }
  if (s.cp < a.cp) return { ok: false, motivo: 'Sin capital político' };
  if (a.dinero && s.dinero < a.dinero) return { ok: false, motivo: 'No hay dinero' };
  return { ok: true };
}

function cambiarRelacion(s, pid, n) {
  if (s.paises[pid] && !s.paises[pid].eliminado) s.paises[pid].relacion = limitar(s.paises[pid].relacion + n, -100, 100);
}
const mejoraDelegacion = s => 12 + 2 * nivelMinistro(s, 'exteriores');

function accionDiplomatica(s, pid, accion) {
  if (!puedeDiplo(s, pid, accion).ok) return;
  const a = ACCIONES_DIPLO[accion], P = PAISES[pid], rival = P.rival, mio = PAIS_JUGADOR.nombre;
  s.cp -= a.cp;
  s.dinero -= a.dinero || 0;
  if ((accion === 'tratado' || accion === 'alianza') && esHumano(pid)) {
    proponerA(s, pid, { tipo: accion });
    return;
  }
  if (accion === 'delegacion') {
    cambiarRelacion(s, pid, mejoraDelegacion(s));
    if (rival) cambiarRelacion(s, rival, -4);
    noticia(s, `Una delegación de ${mio} visita ${P.nombre}.`);
  } else if (accion === 'tratado') {
    s.paises[pid].tratado = true;
    cambiarRelacion(s, pid, 5);
    if (rival) cambiarRelacion(s, rival, -10);
    noticia(s, `${mio} y ${P.nombre} firman un tratado comercial.`, 'bien');
  } else if (accion === 'alianza') {
    s.paises[pid].alianza = true;
    if (rival) cambiarRelacion(s, rival, -20);
    noticia(s, `${mio} y ${P.nombre} sellan una alianza.`, 'bien');
  } else if (accion === 'denuncia') {
    cambiarRelacion(s, pid, -15);
    if (rival) cambiarRelacion(s, rival, 8);
    noticia(s, `${mio} denuncia en público al gobierno de ${P.nombre}.`);
  }
  revisarAcuerdos(s);
}

// ---------- Propuestas entre jugadores ----------
// Tratados, alianzas y paces con otro jugador: le llega una propuesta y la acepta o la rechaza.

const TEXTO_PROPUESTA = { tratado: 'un tratado comercial', alianza: 'una alianza', paz: 'la paz' };

function proponerA(s, pid, propuesta) {
  const t = nacionDe(pid), yo = s.nacion;
  noticia(s, `Propones ${TEXTO_PROPUESTA[propuesta.tipo]} a ${PAISES[pid].nombre}. Esperando su respuesta.`);
  if (!t || t.propuestas.some(p => p.de === yo && p.tipo === propuesta.tipo)) return;
  t.propuestas.push({ ...propuesta, de: yo, nombre: PAIS_JUGADOR.nombre });
}

function responderPropuesta(s, i, acepta) {
  const pr = s.propuestas.splice(i, 1)[0];
  if (!pr) return;
  const otro = nacionDe(pr.de), yo = PAIS_JUGADOR.nombre, que = TEXTO_PROPUESTA[pr.tipo];
  if (!acepta) {
    noticia(s, `Rechazas ${que} que proponía ${pr.nombre}.`);
    if (otro) noticia(otro, `${yo} rechaza ${que}.`, 'mal');
    return;
  }
  if (pr.tipo === 'paz') {
    if (!otro || !otro.guerras[s.nacion]) return;
    usarNacion(otro);
    firmarPaz(otro, s.nacion, pr.opcion, true);
    usarNacion(s);
    return;
  }
  s.paises[pr.de][pr.tipo] = true;
  if (otro) otro.paises[s.nacion][pr.tipo] = true;
  const hecho = pr.tipo === 'tratado' ? 'firman un tratado comercial' : 'sellan una alianza';
  noticia(s, `${yo} y ${pr.nombre} ${hecho}.`, 'bien');
  if (otro) noticia(otro, `${pr.nombre} y ${yo} ${hecho}.`, 'bien');
}

// Los acuerdos se rompen si la relación se hunde. Con otros jugadores, solo si ellos quieren (la guerra).
function revisarAcuerdos(s) {
  for (const pid of paisesVivos(s)) {
    if (esHumano(pid)) continue;
    const p = s.paises[pid], nombre = PAISES[pid].nombre;
    if (p.alianza && p.relacion < 20) { p.alianza = false; noticia(s, `${nombre} rompe su alianza con ${PAIS_JUGADOR.nombre}.`, 'mal'); }
    if (p.tratado && p.relacion < -10) { p.tratado = false; noticia(s, `${nombre} cancela el tratado comercial.`, 'mal'); }
    const embargo = hayEmbargo(s, pid);
    if (!s.guerras[pid]) {
      if (embargo && !p.embargo) noticia(s, `${nombre} impone un embargo a ${PAIS_JUGADOR.nombre}.`, 'mal');
      if (!embargo && p.embargo) noticia(s, `${nombre} levanta el embargo.`, 'bien');
    }
    p.embargo = embargo;
  }
}

// ---------- Eventos ----------

function aplicarEfectos(s, ef, ev = {}) {
  if (ef.dinero) s.dinero += ef.dinero;
  if (ef.cp) s.cp = limitar(s.cp + ef.cp, 0, CP_MAXIMO);
  if (ef.estabilidad) s.estabilidad = limitar(s.estabilidad + ef.estabilidad);
  if (ef.tropas) s.tropas = Math.max(0, s.tropas + ef.tropas);
  if (ef.todos) for (const g in GRUPOS) s.grupos[g] = limitar(s.grupos[g] + ef.todos);
  if (ef.grupos) for (const g in ef.grupos) s.grupos[g] = limitar(s.grupos[g] + ef.grupos[g]);
  if (ef.relacion && ev.pais) cambiarRelacion(s, ev.pais, ef.relacion);
  if (ef.relacion2 && ev.pais2) cambiarRelacion(s, ev.pais2, ef.relacion2);
  if (ef.relPartido && ev.partido) s.relPartidos[ev.partido] = limitar(s.relPartidos[ev.partido] + ef.relPartido, -100, 100);
  if (ef.relPartidos) for (const pid in s.relPartidos) s.relPartidos[pid] = limitar(s.relPartidos[pid] + ef.relPartidos, -100, 100);
  if (ef.relPartidoDe) for (const pid in ef.relPartidoDe) s.relPartidos[pid] = limitar(s.relPartidos[pid] + ef.relPartidoDe[pid], -100, 100);
  if (ef.destituir && ev.ministro) destituir(s, ev.ministro);
  if (ef.romperAlianza && ev.pais) s.paises[ev.pais].alianza = false;
  if (ef.guerra && ev[ef.guerra]) declararGuerra(s, ev[ef.guerra], false);
  if (ef.paz && ev.pais) firmarPaz(s, ev.pais, 'blanca');
  if (s.carrera) aplicarEfectosCarrera(s, ef);
}

function elegirEvento(s) {
  if (s.mes < 2 || Math.random() > dificultad(s).eventoProb) return null;
  const t = contarEdificios(s);
  const carteras = Object.keys(s.ministros).filter(c => s.ministros[c]);
  const enPaz = paisesVivos(s).filter(pid => !s.guerras[pid] && !esHumano(pid));
  const lista = s.modo === 'carrera' ? EVENTOS_CARRERA.filter(e => !e.fase || e.fase === s.carrera.cargo) : EVENTOS;
  const candidatos = lista.filter(e => !e.directo && !s.recientes.includes(e.id)
    && (!e.requiere || t[e.requiere] > 0) && (!e.ministro || carteras.length)
    && (!e.pais || enPaz.length) && (!e.dosPaises || enPaz.length >= 2) && (!e.maritimo || enPaz.some(pid => PAISES[pid].isla)));
  if (!candidatos.length) return null;
  const e = alAzar(candidatos), ev = { id: e.id };
  s.recientes = [e.id, ...s.recientes].slice(0, 6);
  if (e.pais) ev.pais = alAzar(enPaz);
  if (e.maritimo) ev.pais = alAzar(enPaz.filter(pid => PAISES[pid].isla));
  if (e.dosPaises) {
    ev.pais = alAzar(enPaz);
    ev.pais2 = alAzar(enPaz.filter(pid => pid !== ev.pais));
  }
  if (e.partido) ev.partido = alAzar(Object.keys(s.relPartidos));
  if (e.ministro) ev.ministro = alAzar(carteras);
  if (e.provincia) ev.provincia = alAzar(provinciasJugador()).id;
  return ev;
}

// Sustituye {pais}, {pais2}, {partido}, {ministro}, {provincia} y {mipais} por los nombres del evento en curso.
function textoEvento(s, ev, texto) {
  const ministro = ev.ministro && s.ministros[ev.ministro] ? CAND_POR_ID[s.ministros[ev.ministro]].nombre : 'el ministro';
  const datos = {
    pais: ev.pais ? PAISES[ev.pais].nombre : '',
    pais2: ev.pais2 ? PAISES[ev.pais2].nombre : '',
    partido: ev.partido ? partidoInfo(s, ev.partido).nombre : '',
    provincia: ev.provincia && PROV_POR_ID[ev.provincia] ? PROV_POR_ID[ev.provincia].nombre : '',
    mipais: PAIS_JUGADOR.nombre,
    ministro,
    lider: LIDER_INICIAL,
  };
  return texto.replace(/\{(\w+)\}/g, (_, k) => datos[k] || '');
}

function resolverEvento(s, i) {
  if (!s.evento) return;
  const ev = s.evento, e = EVENTO_POR_ID[ev.id], op = e.opciones[i];
  const titulo = textoEvento(s, ev, e.titulo), decision = textoEvento(s, ev, op.texto);
  s.evento = null;
  noticia(s, `${titulo}: decides ${decision.charAt(0).toLowerCase()}${decision.slice(1)}.`);
  aplicarEfectos(s, op.efectos, ev);
  revisarAcuerdos(s);
  comprobarFin(s);
}

// ---------- Objetivos, prensa y consejos ----------

const objetivosActuales = s => (s.modo === 'carrera' ? OBJETIVOS_CARRERA : OBJETIVOS);

function revisarObjetivos(s) {
  const nuevos = [];
  for (const o of objetivosActuales(s)) {
    if (s.objetivos[o.id] || !o.hecho(s)) continue;
    s.objetivos[o.id] = true;
    aplicarEfectos(s, o.premio);
    nuevos.push(o);
  }
  return nuevos;
}

// Portada del periódico: resume en un titular lo más llamativo del momento.
function titular(s) {
  if (s.modo === 'carrera') return titularCarrera(s);
  const pop = popularidad(s), eco = calcularEconomia(s), faltan = s.proximaEleccion - s.mes;
  const grupos = Object.keys(GRUPOS).sort((a, b) => s.grupos[a] - s.grupos[b]);
  const peor = grupos[0], mejor = grupos[grupos.length - 1];
  const nombre = g => GRUPOS[g].nombre.toLowerCase();
  const mio = PAIS_JUGADOR.nombre, partido = partidoInfo(s, ID_JUGADOR).nombre, enemigos = Object.keys(s.guerras);
  if (s.mes === s.mesGobierno) return [`${s.config.lider} toma las riendas de ${mio}`, `El nuevo gobierno de ${partido} promete estabilidad y trabajo.`];
  if (s.legislatura > 1 && s.inicioLegislatura === s.mes) return [`${partido} revalida su victoria`, `Las urnas dan otra legislatura de gobierno a ${s.config.lider}.`];
  if (s.ultimaLey && s.ultimaLey.mes === s.mes) {
    const l = s.ultimaLey;
    return [`El Parlamento ${l.derogar ? 'tumba' : 'aprueba'} «${LEY_POR_ID[l.id].nombre}»`, `La votación se salda con ${l.si} votos a favor y ${l.no} en contra.`];
  }
  if (enemigos.length) {
    const pid = enemigos[0], g = s.guerras[pid];
    const tomadas = provinciasDe(pid).filter(p => s.ocupadas[p.id] === PAIS_JUGADOR.id).length;
    const perdidas = provinciasJugador().filter(p => s.ocupadas[p.id]).length;
    if (g.meses === 0) return [`${mio}, en guerra con ${PAISES[pid].nombre}`, 'Las tropas marchan hacia la frontera entre vítores y temores.'];
    if (perdidas) return [`El enemigo pisa suelo de ${mio}`, `${PAISES[pid].nombre} ocupa ${perdidas} de nuestras provincias.`];
    if (tomadas) return [`Nuestras tropas avanzan en ${PAISES[pid].nombre}`, `Ya ocupan ${tomadas} de sus provincias tras ${g.meses} meses de guerra.`];
    return [`La guerra con ${PAISES[pid].nombre} se alarga`, `Van ${g.meses} meses de combates y el frente apenas se mueve.`];
  }
  if (s.dinero < 0) return ['Las arcas públicas, en números rojos', `La deuda del Estado ya alcanza los ${-s.dinero}.`];
  if (s.estabilidad < 35) return ['Crece la tensión en las calles', 'Los analistas dudan de que el gobierno aguante.'];
  if (s.grupos[peor] < 36) return [`Los ${nombre(peor)}, en pie de guerra`, `Solo ${s.grupos[peor]} de cada 100 respaldan al gobierno.`];
  if (faltan <= 3) return ['Recta final hacia las urnas', `Quedan ${faltan} ${faltan === 1 ? 'mes' : 'meses'} y las encuestas dan ${estimarVotos(s, false)[ID_JUGADOR]} escaños a ${partido}.`];
  if (eco.balance >= 80) return [`La economía de ${mio}, viento en popa`, `El Estado ingresa ${eco.balance} más de lo que gasta cada mes.`];
  if (s.grupos[mejor] > 64) return [`Los ${nombre(mejor)} respaldan al gobierno`, `Su apoyo sube hasta ${s.grupos[mejor]} de cada 100.`];
  if (pop >= 55) return ['El gobierno, fuerte en las encuestas', `La popularidad se sitúa en el ${pop}%.`];
  return [
    ['Calma política en la capital', 'El gobierno prepara sus próximos movimientos.'],
    ['El Parlamento espera nuevas leyes', 'La oposición pide al gobierno que mueva ficha.'],
    [`${mio} mira hacia sus vecinos`, 'Las cancillerías siguen de cerca la política exterior.'],
  ][s.mes % 3];
}

// La asesora señala el problema más urgente y la pestaña donde se arregla.
function consejo(s) {
  if (s.modo === 'carrera') return consejoCarrera(s);
  const eco = calcularEconomia(s), faltan = s.proximaEleccion - s.mes;
  const peor = Object.keys(GRUPOS).sort((a, b) => s.grupos[a] - s.grupos[b])[0];
  const amenaza = paisesVivos(s).find(pid => !s.guerras[pid] && s.paises[pid].relacion <= -55 && s.paises[pid].ejercito > fuerzaDefensa(s));
  if (enGuerra(s) && !s.tropas) return { texto: 'Estás en guerra y sin un solo regimiento. Recluta o pide la paz.', tab: 'defensa' };
  if (provinciasJugador().some(p => s.ocupadas[p.id])) return { texto: 'El enemigo ocupa provincias tuyas. Libéralas o negocia la paz.', tab: 'defensa' };
  if (eco.balance < 0) return { texto: 'Gastas más de lo que ingresas. Revisa las cuentas antes de que llegue la deuda.', tab: 'economia' };
  if (eco.faltaComida) return { texto: 'Importas comida y sale cara. Una granja más lo arregla.', tab: 'provincia' };
  if (amenaza) return { texto: `${PAISES[amenaza].nombre} te detesta y su ejército supera al tuyo. Refuerza la defensa o mejora la relación.`, tab: 'defensa' };
  if (eco.capacidad > eco.matProd && !s.obras.some(o => o.tipo === 'mina')) return { texto: 'Tus fábricas no tienen materias primas suficientes. Hace falta otra mina.', tab: 'provincia' };
  if (faltan <= 5 && !ganaJugador(estimarVotos(s, false))) return { texto: 'Las encuestas no te dan ganador. Da mítines y aprueba algo popular.', tab: 'sociedad' };
  if (s.grupos[peor] < 40) return { texto: `Los ${GRUPOS[peor].nombre.toLowerCase()} están descontentos. Mira qué les molesta.`, tab: 'sociedad' };
  if (!numMinistros(s)) return { texto: 'Tu gabinete está vacío. Los ministros dan ventajas cada mes.', tab: 'gobierno' };
  if (s.cp >= 8) return { texto: 'Te sobra capital político. Propón una ley o envía una delegación.', tab: 'parlamento' };
  if (s.dinero >= 350 && !s.obras.length) return { texto: 'Hay dinero parado en el tesoro. Invertirlo en edificios da más ingresos.', tab: 'provincia' };
  return null;
}

// ---------- Paso de turno ----------

function comprobarFin(s) {
  if (s.fin) return;
  if (s.modo === 'carrera') {
    if (s.carrera.cargo === 'lider' && s.carrera.interno < 25) perderLiderazgo(s);
  } else if (!provinciasLibres(s).length) s.fin = 'conquistado';
  else if (!paisesVivos(s).length) s.fin = 'victoria';
  else if (s.dinero < -400) caerDelGobierno(s, 'bancarrota');
  else if (s.estabilidad < 25) caerDelGobierno(s, 'revuelta');
}

// Hay algo en pantalla que el jugador debe resolver antes de pasar de mes.
const hayAlgoPendiente = s => !!(s.fin || s.evento || s.votacion || s.congreso || s.elecciones || s.caida || s.resultadoVoto
  || s.batallas.length || s.propuestas.length);

// En multijugador el mes avanza aunque alguien no haya contestado: se decide por él lo más prudente.
function resolverPendientes(s) {
  for (let guardia = 0; hayAlgoPendiente(s) && !s.fin && guardia < 30; guardia++) {
    if (s.batallas.length) s.batallas = [];
    else if (s.resultadoVoto) s.resultadoVoto = null;
    else if (s.propuestas.length) responderPropuesta(s, 0, false);
    else if (s.elecciones) { if (s.elecciones.carrera && s.elecciones.gana) formarGobierno(s); else s.elecciones = null; }
    else if (s.congreso) s.congreso = null;
    else if (s.caida) s.caida = null;
    else if (s.votacion) resolverPostura(s, posturasGobierno(s)[0].id);
    else if (s.evento) resolverEvento(s, 0);
  }
}

// Un mes en solitario. En multijugador el anfitrión hace estas mismas fases para todas las naciones.
function siguienteMes(s) {
  if (hayAlgoPendiente(s)) return;
  if (s.modo === 'carrera') {
    mesCarreraAntes(s);
    simularMundo([s]);
    mesCarreraDespues(s);
    return;
  }
  mesNacionAntes(s);
  turnoGuerra(s);
  simularMundo([s]);
  mesNacionDespues(s);
}

// Avanza un mes para todas las naciones de una partida con varios jugadores.
function avanzarMesTodas(estados) {
  const vivas = Object.values(estados).filter(s => !s.fin);
  for (const s of vivas) { usarNacion(s); resolverPendientes(s); }
  const activas = vivas.filter(s => !s.fin);
  for (const s of activas) {
    usarNacion(s);
    if (s.modo === 'carrera') mesCarreraAntes(s);
    else { mesNacionAntes(s); turnoGuerra(s); }
    mesOposicion(s);
  }
  if (activas.length) simularMundo(activas);
  for (const s of activas) {
    usarNacion(s);
    if (s.modo === 'carrera') mesCarreraDespues(s); else mesNacionDespues(s);
  }
  sincronizarNaciones(estados);
}

// Tras cualquier cambio en una partida con varias naciones: cada una con los edificios de lo que
// posee, el mismo mapa, su ejército a la vista de los demás y su final si lo hay.
function sincronizarNaciones(estados) {
  const lista = Object.values(estados), version = Math.max(...lista.map(s => s.mapaVersion));
  for (const s of lista) {
    usarNacion(s);
    s.mapaVersion = version;
    for (const p of provinciasJugador()) if (!s.edificios[p.id]) s.edificios[p.id] = edificiosVacios();
    for (const id in s.edificios) if (PROV_POR_ID[id].pais !== s.nacion) delete s.edificios[id];
    s.obras = s.obras.filter(o => PROV_POR_ID[o.prov].pais === s.nacion);
    s.mundo.ejercitos[s.nacion] = s.tropas;
    for (const pid in s.guerras) if (s.mundo.eliminados[pid]) delete s.guerras[pid];
    if (!provinciasJugador().length) s.mundo.eliminados[s.nacion] = true;
    revisarObjetivos(s);
    comprobarFin(s);
  }
}

function mesNacionAntes(s) {
  const eco = calcularEconomia(s);
  s.dinero += eco.balance;
  for (const tr of s.tributos) if (--tr.meses === 0) noticia(s, `${PAISES[tr.pais].nombre} termina de pagar su tributo.`);
  s.tributos = s.tributos.filter(tr => tr.meses > 0 && !s.paises[tr.pais].eliminado);
  avanzarObras(s);
  s.prestamos = s.prestamos.map(m => m - 1).filter(m => m > 0);
  for (const g in GRUPOS) s.grupos[g] = Math.round(s.grupos[g] + (objetivoGrupo(s, g).valor - s.grupos[g]) * 0.25);
  s.estabilidad = Math.round(s.estabilidad + (objetivoEstabilidad(s).valor - s.estabilidad) * 0.25);
  s.cp = Math.min(CP_MAXIMO, s.cp + 2);
  for (const pid of paisesVivos(s)) {
    const p = s.paises[pid];
    if (!s.guerras[pid] && p.relacion !== p.base) p.relacion += p.relacion < p.base ? 1 : -1;
  }
  s.mes++;
}

function mesNacionDespues(s) {
  s.historial.push(puntoHistorial(s));
  if (s.historial.length > 240) s.historial.shift();
  if (s.dinero < 0) noticia(s, 'El Estado está en deuda. Si pasa de −400, habrá bancarrota.', 'mal');
  if (s.estabilidad < 35) noticia(s, 'El país está inestable. Si baja de 25, el gobierno caerá.', 'mal');
  revisarAcuerdos(s);
  revisarPromesas(s);
  revisarCorrupcion(s);
  comprobarFin(s);
  if (s.fin) return;
  const faltan = s.proximaEleccion - s.mes;
  if (faltan === 0) celebrarElecciones(s);
  else {
    if (faltan === 3) noticia(s, 'Quedan 3 meses para las elecciones.');
    if (!s.evento) s.evento = elegirEvento(s);
  }
}
