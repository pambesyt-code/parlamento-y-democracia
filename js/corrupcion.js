'use strict';
// Caer del poder sin perder la partida, las directivas que te pone el partido y la corrupción.
// Perder el gobierno o el liderazgo te devuelve a la oposición, como al principio; a cambio, el
// partido te marca una directiva, y si no la cumples te expulsa (fin de la partida).
// La corrupción da ventajas rápidas, pero cada trampa sube la sospecha y, si te pillan, se acabó.

// ---------- Directivas del partido ----------

// tipo 'escanos': sacar al menos min escaños en las próximas elecciones.
// tipo 'interno': llegar a min de apoyo en el partido antes del mes plazo.
function ponerDirectiva(s, tipo) {
  const c = s.carrera;
  if (tipo === 'escanos') {
    const min = Math.max(8, Math.round((s.escanos[ID_JUGADOR] || 15) * 0.9));
    s.directiva = { tipo, min, plazo: s.proximaEleccion };
  } else {
    s.directiva = { tipo, min: Math.min(75, Math.max(50, c.interno + 15)), plazo: s.mes + 12 };
  }
  noticia(s, `${s.config.partido} te marca una directiva: ${textoDirectiva(s.directiva).toLowerCase()}.`, 'mal');
}

const textoDirectiva = d => (d.tipo === 'escanos'
  ? `Saca al menos ${d.min} escaños en las próximas elecciones`
  : `Llega a ${d.min} de apoyo en el partido antes de ${fecha(d.plazo)}`);

// Cómo va la directiva: { ok, texto } para la pantalla.
function estadoDirectiva(s) {
  const d = s.directiva;
  if (!d) return null;
  if (d.tipo === 'escanos') {
    const enc = estimarVotos(s, false)[ID_JUGADOR];
    return { ok: enc >= d.min, texto: `Las encuestas te dan ${enc} escaños; necesitas ${d.min}.`, meses: d.plazo - s.mes };
  }
  return { ok: s.carrera.interno >= d.min, texto: `Tienes ${s.carrera.interno} de apoyo; necesitas ${d.min}.`, meses: d.plazo - s.mes };
}

function cumplirDirectiva(s) {
  s.directiva = null;
  if (s.carrera) s.carrera.interno = limitar(s.carrera.interno + 5);
  noticia(s, `Cumples la directiva de ${s.config.partido}: el partido vuelve a confiar en ti.`, 'bien');
}

// Cada mes en la oposición: la directiva de apoyo interno se cumple o vence.
function revisarDirectiva(s) {
  const d = s.directiva;
  if (!d || d.tipo !== 'interno' || s.fin) return;
  if (s.carrera.interno >= d.min) cumplirDirectiva(s);
  else if (s.mes >= d.plazo) {
    s.fin = 'directiva';
    noticia(s, `${s.config.lider} no cumple la directiva y ${s.config.partido} le expulsa.`, 'mal');
  }
}

// En las elecciones: true si la directiva de escaños te ha costado la partida.
function juzgarDirectivaElecciones(s, escanos) {
  const d = s.directiva;
  if (!d || d.tipo !== 'escanos') return false;
  if (escanos[ID_JUGADOR] >= d.min) { cumplirDirectiva(s); return false; }
  s.fin = 'directiva';
  noticia(s, `${s.config.partido} saca ${escanos[ID_JUGADOR]} escaños, menos de los ${d.min} exigidos, y expulsa a ${s.config.lider}.`, 'mal');
  return true;
}

// ---------- Caer del poder ----------

const MOTIVOS_CAIDA = {
  elecciones: ['Pierdes el gobierno', 'Otro partido ha ganado las elecciones.'],
  revuelta: ['El gobierno cae', 'La inestabilidad desborda las calles y tienes que dimitir.'],
  bancarrota: ['Bancarrota', 'La deuda es impagable y tu gobierno dimite.'],
  destituido: ['Te quitan el liderazgo', 'El partido elige a otra persona para dirigirlo.'],
  congreso: ['Pierdes otra vez el congreso', 'Sigues como diputado, pero el partido quiere verte trabajar.'],
};

// Dejas de gobernar: pasas a liderar tu partido en la oposición, como en la carrera.
function caerDelGobierno(s, motivo) {
  // En un país compartido gobierna el jugador de la oposición con más escaños.
  if (s.oposicion && s.oposicion.length) {
    const o = s.oposicion.reduce((a, b) => (s.escanos[b.partido] > s.escanos[a.partido] ? b : a));
    const nuevo = o.perfil.lider, sale = cambiarGobierno(s, o);
    noticia(s, `${MOTIVOS_CAIDA[motivo][1]} ${nuevo} sustituye a ${sale} al frente del gobierno.`, 'mal');
    return;
  }
  const dif = dificultad(s);
  // El nuevo gobierno firma la paz con quien estabas en guerra.
  for (const pid of Object.keys(s.guerras)) {
    if (esHumano(pid)) continue;
    firmarPaz(s, pid, 'blanca');
    if (s.guerras[pid]) firmarPaz(s, pid, 'ceder');
  }
  const rivales = Object.keys(s.escanos).filter(pid => pid !== ID_JUGADOR);
  s.modo = 'carrera';
  s.gobiernoIA = rivales.reduce((a, b) => (s.escanos[b] > s.escanos[a] ? b : a));
  s.carrera = {
    cargo: 'lider', prestigio: 30, interno: 50, fondos: 80, apoyoLider: dif.apoyoLider,
    imagen: {}, promesas: [], hechas: {}, propias: {}, congresoMes: null, intentos: 0, mesLider: -1,
    fuerzaGobierno: dif.fuerzaGobierno,
  };
  for (const g in GRUPOS) { s.carrera.imagen[g] = 0; s.grupos[g] = Math.min(s.grupos[g], dif.apoyoOposicion + 5); }
  for (const id in CARTERAS) s.ministros[id] = null;
  Object.assign(s, { propuesta: null, votacion: null, promesas: [], obras: [] });
  if (motivo !== 'elecciones') {
    // Tras una dimisión hay elecciones en un año.
    s.proximaEleccion = s.mes + Math.min(12, MESES_LEGISLATURA);
  }
  s.inicioLegislatura = s.mes;
  s.caida = { motivo };
  // Los objetivos de la oposición que ya cumples de entrada se dan por hechos, sin premio.
  for (const o of OBJETIVOS_CARRERA) if (!s.objetivos[o.id] && o.hecho(s)) s.objetivos[o.id] = true;
  noticia(s, `${s.config.lider} deja el gobierno y pasa a liderar la oposición. Gobierna ${PARTIDOS[s.gobiernoIA].nombre}.`, 'mal');
  ponerDirectiva(s, 'escanos');
}

// El partido te quita el liderazgo: vuelves a ser diputado, con otro congreso dentro de un año.
function perderLiderazgo(s, motivo = 'destituido') {
  const c = s.carrera, usados = new Set(Object.values(s.lideres || {}));
  const nuevo = NOMBRES_LIDERES.find(n => !usados.has(n) && n !== s.config.lider) || 'Ana Ferrer';
  s.lideres[ID_JUGADOR] = nuevo;
  LIDER_INICIAL = nuevo;
  Object.assign(c, { cargo: 'diputado', congresoMes: s.mes + 12, intentos: 0, apoyoLider: Math.max(c.apoyoLider, 55), interno: Math.max(c.interno, 25), promesas: [] });
  s.caida = { motivo };
  noticia(s, `${nuevo} pasa a dirigir ${s.config.partido}. ${s.config.lider} vuelve a su escaño.`, 'mal');
  ponerDirectiva(s, 'interno');
}

// ---------- Corrupción ----------

// modo: cuándo se puede hacer. sospecha: lo que sube (o baja) el riesgo de que te pillen.
const CORRUPCION = {
  comisiones: { modo: 'gobierno', nombre: 'Cobrar comisiones', icono: 'moneda', desc: 'Las constructoras pagan bajo cuerda por las obras públicas.', efectos: { dinero: 150 }, sospecha: 18 },
  enchufes: { modo: 'gobierno', nombre: 'Colocar a los tuyos', icono: 'maletin', desc: 'Cargos públicos para gente del partido, que te lo devuelve en apoyos.', efectos: { cp: 3 }, sospecha: 12 },
  sobornos: { modo: 'gobierno', nombre: 'Sobornar a diputados', icono: 'parlamento', desc: 'Los demás partidos te miran con mejores ojos.', efectos: { relPartidos: 15 }, sospecha: 22 },
  cajaB: { modo: 'carrera', nombre: 'Financiación ilegal', icono: 'moneda', desc: 'Donaciones que no pasan por las cuentas del partido.', efectos: { fondos: 70 }, sospecha: 15 },
  delegados: { modo: 'carrera', nombre: 'Comprar delegados', icono: 'gente', desc: 'Apoyos asegurados dentro del partido.', efectos: { interno: 10 }, sospecha: 20 },
  tapar: { modo: 'todos', nombre: 'Borrar el rastro', icono: 'periodico', desc: 'Destruyes papeles y pagas silencios.', coste: 80, sospecha: -20 },
};
const SOSPECHA_MAX = 100;

// Probabilidad de que te pillen este mes, de 0 a 1.
const riesgoCorrupcion = s => Math.min(0.6, Math.max(0, ((s.sospecha || 0) - 10) / 200));
const corrupcionDisponible = s => Object.keys(CORRUPCION).filter(id => {
  const m = CORRUPCION[id].modo;
  return m === 'todos' || m === s.modo;
});

function puedeCorrupcion(s, id) {
  const a = CORRUPCION[id];
  if (!a || !corrupcionDisponible(s).includes(id)) return { ok: false };
  if ((s.corrupcion || {})[id] === s.mes) return { ok: false, motivo: 'Ya lo has hecho este mes' };
  if (a.sospecha < 0 && !(s.sospecha > 0)) return { ok: false, motivo: 'No hay nada que borrar' };
  if (a.coste) {
    const caja = s.modo === 'carrera' ? s.carrera.fondos : s.dinero;
    if (caja < a.coste) return { ok: false, motivo: s.modo === 'carrera' ? 'Faltan fondos' : 'Falta dinero' };
  }
  return { ok: true };
}

function hacerCorrupcion(s, id) {
  if (!puedeCorrupcion(s, id).ok) return;
  const a = CORRUPCION[id];
  s.corrupcion = s.corrupcion || {};
  s.corrupcion[id] = s.mes;
  if (a.coste) { if (s.modo === 'carrera') s.carrera.fondos -= a.coste; else s.dinero -= a.coste; }
  if (a.efectos) aplicarEfectos(s, a.efectos);
  s.sospecha = limitar((s.sospecha || 0) + a.sospecha, 0, SOSPECHA_MAX);
}

// Cada mes la sospecha se enfría un poco, pero antes la prensa puede tirar del hilo.
function revisarCorrupcion(s) {
  if (s.fin || !(s.sospecha > 0)) return;
  if (Math.random() < riesgoCorrupcion(s)) {
    s.sospecha = 0;
    if (s.modo === 'gobierno' && s.oposicion && s.oposicion.length) {
      // En un país compartido el escándalo te saca del gobierno y lo hereda la oposición.
      for (const g in GRUPOS) s.grupos[g] = limitar(s.grupos[g] - 10);
      noticia(s, `Escándalo: la prensa destapa la corrupción de ${s.config.lider}.`, 'mal');
      caerDelGobierno(s, 'revuelta');
      return;
    }
    s.fin = 'corrupcion';
    noticia(s, `Escándalo: la prensa destapa la corrupción de ${s.config.lider}. Su carrera política se acaba.`, 'mal');
    return;
  }
  s.sospecha = Math.max(0, s.sospecha - 3);
}
