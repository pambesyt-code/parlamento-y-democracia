'use strict';
// Países compartidos en multijugador: varios jugadores en el mismo país, cada uno con su partido.
// Gobierna uno (s.tokenGobierno); los demás son la oposición (s.oposicion). Tras cada elección,
// gobierna el jugador cuyo partido saque más escaños. La oposición no toca la economía ni la
// guerra: hace campaña, presenta leyes y decide cómo vota su grupo las leyes del gobierno.

const opositorDe = (s, pid) => (s && s.oposicion ? s.oposicion.find(o => o.partido === pid) : null) || null;
const opositorPorToken = (s, token) => (s && s.oposicion ? s.oposicion.find(o => o.token === token) : null) || null;
// El hueco del partido en el parlamento (ver huecoDe en game.js).
const huecoPartido = perfil => huecoDe(perfil);

const POSTURAS = {
  ideas: { nombre: 'Según nuestras ideas', desc: 'Tu grupo vota cada ley según encaje con vuestros principios.' },
  apoyar: { nombre: 'Apoyar al gobierno', desc: 'Votáis a favor de todo lo que presente el gobierno.' },
  bloquear: { nombre: 'Bloquear al gobierno', desc: 'Votáis en contra de todo lo que presente el gobierno.' },
};

const ACCIONES_OPOSICION = {
  mitin: { nombre: 'Mitin ante un grupo', cp: 1, desc: 'Ese grupo te ve con mejores ojos: +4 de imagen.' },
  campana: { nombre: 'Campaña en medios', cp: 2, desc: 'Todos los grupos: +1 de imagen.' },
  denunciar: { nombre: 'Denunciar al gobierno', cp: 2, desc: 'El apoyo al gobierno baja 1 punto en todos los grupos.' },
};
const COSTE_LEY_OPOSICION = 2;

function crearOpositor(token, perfil) {
  return {
    token, perfil: { ...perfil, principios: [...(perfil.principios || [])] }, partido: huecoPartido(perfil),
    cp: 5, imagen: Object.fromEntries(Object.keys(GRUPOS).map(g => [g, 0])), postura: 'ideas', hechas: {}, resultadoVoto: null,
  };
}

function puedeAccionOposicion(s, o, id) {
  if (o.hechas[id] === s.mes) return { ok: false, motivo: 'Ya lo has hecho este mes' };
  if (o.cp < ACCIONES_OPOSICION[id].cp) return { ok: false, motivo: 'Sin capital político' };
  return { ok: true };
}

function puedeLeyOposicion(s, o, leyId, derogar) {
  const ley = LEY_POR_ID[leyId];
  if (o.cp < COSTE_LEY_OPOSICION) return { ok: false, motivo: 'Sin capital político' };
  if (o.hechas.ley === s.mes) return { ok: false, motivo: 'Una ley al mes' };
  if (!derogar && ley.incompatible && s.leyes[ley.incompatible]) return { ok: false, motivo: `Incompatible con «${LEY_POR_ID[ley.incompatible].nombre}»` };
  return { ok: true };
}

// La propuesta tal como se vota: el grupo del gobierno vota según sus ideas.
function propuestaOposicion(s, o, leyId, derogar) {
  const opinion = opinionPartido(s, leyId, derogar);
  return { ley: leyId, derogar, autor: o.partido, negociado: {}, votoJugador: opinion >= 1 ? 'si' : opinion <= -1 ? 'no' : 'abs' };
}

const REGLAS_OPOSICION = {
  oposMitin: (s, o, d) => {
    if (!GRUPOS[d.v] || !puedeAccionOposicion(s, o, 'mitin').ok) return;
    o.cp -= 1;
    o.hechas.mitin = s.mes;
    o.imagen[d.v] = limitar(o.imagen[d.v] + 4, -15, 15);
    noticia(s, `${o.perfil.lider} da un mitin ante los ${GRUPOS[d.v].nombre.toLowerCase()}.`);
  },
  oposCampana: (s, o) => {
    if (!puedeAccionOposicion(s, o, 'campana').ok) return;
    o.cp -= 2;
    o.hechas.campana = s.mes;
    for (const g in GRUPOS) o.imagen[g] = limitar(o.imagen[g] + 1, -15, 15);
    noticia(s, `${partidoInfo(s, o.partido).nombre} llena el país de carteles.`);
  },
  oposDenunciar: (s, o) => {
    if (!puedeAccionOposicion(s, o, 'denunciar').ok) return;
    o.cp -= 2;
    o.hechas.denunciar = s.mes;
    for (const g in GRUPOS) s.grupos[g] = limitar(s.grupos[g] - 1);
    noticia(s, `${o.perfil.lider} denuncia la gestión del gobierno en el pleno.`, 'mal');
  },
  oposPostura: (s, o, d) => { if (POSTURAS[d.v]) o.postura = d.v; },
  oposProponer: (s, o, d) => {
    const derogar = d.derogar === '1';
    if (!LEY_POR_ID[d.ley] || !puedeLeyOposicion(s, o, d.ley, derogar).ok) return;
    o.cp -= COSTE_LEY_OPOSICION;
    o.hechas.ley = s.mes;
    // El recuento lo ve quien presentó la ley; al gobierno le llega como noticia.
    const previo = s.resultadoVoto;
    resolverVotacion(s, propuestaOposicion(s, o, d.ley, derogar));
    o.resultadoVoto = s.resultadoVoto;
    s.resultadoVoto = previo;
    // Sacar adelante leyes a las que se oponía el gobierno mejora la imagen ante quienes se benefician.
    if (o.resultadoVoto.aprueba) {
      const ley = LEY_POR_ID[d.ley], signo = derogar ? -1 : 1;
      for (const g in ley.grupos || {}) o.imagen[g] = limitar(o.imagen[g] + Math.round(ley.grupos[g] * signo / 3), -15, 15);
    }
  },
  oposCerrarVoto: (s, o) => { o.resultadoVoto = null; },
};

function mesOposicion(s) {
  for (const o of s.oposicion || []) o.cp = Math.min(CP_MAXIMO, o.cp + 2);
}

const perfilDeConfig = c => ({
  lider: c.lider, propio: c.propio, partidoId: c.partidoId, partido: c.partido, color: c.color, emblema: c.emblema,
  principios: [...(c.principios || [])], pais: c.pais, colorPais: c.colorPais, nacion: c.nacion, hueco: huecoDe(c),
});

// Tras unas elecciones que gana un partido de la oposición: su jugador pasa a gobernar y quien
// gobernaba pasa a la oposición. El país conserva su nombre, su color y sus leyes.
function cambiarGobierno(s, o) {
  const antes = { token: s.tokenGobierno, perfil: perfilDeConfig(s.config), cp: s.cp };
  const c = s.config, fijos = { modo: 'gobierno', dificultad: c.dificultad, legislatura: c.legislatura, tamano: c.tamano, semilla: c.semilla, pais: c.pais, colorPais: c.colorPais };
  s.config = completarConfig({ ...o.perfil, ...fijos, hueco: o.partido, nPartidos: c.nPartidos });
  s.tokenGobierno = o.token;
  s.cp = o.cp;
  s.oposicion = s.oposicion.filter(x => x !== o);
  if (antes.token) {
    const viejo = crearOpositor(antes.token, antes.perfil);
    viejo.cp = antes.cp;
    s.oposicion.push(viejo);
  }
  usarNacion(s);
  registrarHumano(s.nacion, s.config);
  for (const g in GRUPOS) s.grupos[g] = dificultad(s).apoyoBase;
  for (const id in CARTERAS) s.ministros[id] = null;
  Object.assign(s, { promesas: [], propuesta: null, votacion: null });
  relacionesIniciales(s);
  noticia(s, `${s.config.lider} forma gobierno con ${s.config.partido}. ${antes.perfil.lider} pasa a la oposición.`, 'bien');
  return antes.perfil.lider;
}
