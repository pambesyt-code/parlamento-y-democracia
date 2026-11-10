'use strict';
// Todo lo que un jugador puede hacer en la partida, como mensajes con nombre y datos.
// En solitario se aplican al momento; en multijugador los aplica el anfitrión a la nación de quien los envía.
// d trae los datos del botón pulsado (sus atributos data-*), siempre como texto.

const REGLAS = {
  // Provincias y economía
  construir: (s, d) => construir(s, d.prov, d.tipo),
  demoler: (s, d) => demoler(s, d.prov, d.tipo),
  prestamo: s => pedirPrestamo(s),
  impuestos: (s, d) => cambiarImpuestos(s, d.v),

  // Parlamento y gobierno
  proponer: (s, d) => proponerLey(s, d.ley, d.derogar === '1'),
  retirar: s => { s.propuesta = null; },
  negociar: (s, d) => negociar(s, d.partido),
  votar: s => votar(s),
  cerrarVoto: s => { s.resultadoVoto = null; },
  nombrar: (s, d) => nombrar(s, d.v, d.cand),
  destituir: (s, d) => destituir(s, d.v),
  mitin: (s, d) => darMitin(s, d.v),
  evento: (s, d) => resolverEvento(s, +d.i),
  cerrarElecciones: s => { s.elecciones = null; },

  // Diplomacia y guerra
  diplo: (s, d) => accionDiplomatica(s, d.pais, d.accion),
  responder: (s, d) => responderPropuesta(s, +d.i, d.v === 'si'),
  reclutar: s => reclutar(s),
  licenciar: s => licenciar(s),
  declarar: (s, d) => { if (puedeDeclararGuerra(s, d.v).ok) declararGuerra(s, d.v, true); },
  atacar: (s, d) => atacar(s, d.v),
  paz: (s, d) => firmarPaz(s, d.pais, d.v),
  cerrarBatalla: s => { s.batallas.shift(); },

  // Carrera política
  accionCarrera: (s, d) => hacerAccionCarrera(s, d.v),
  prometer: (s, d) => prometer(s, d.v),
  postura: (s, d) => resolverPostura(s, d.v),
  cerrarCongreso: s => { s.congreso = null; },
  formarGobierno: s => formarGobierno(s),

  // Solo en solitario: en multijugador el mes lo pasa el anfitrión cuando todos están listos.
  mes: s => siguienteMes(s),
};
