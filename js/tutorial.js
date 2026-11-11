'use strict';
// Tutoriales guiados: una tarjeta dice qué hacer en cada paso y resalta dónde pulsar. Los pasos con
// «hecho» avanzan solos cuando el jugador hace lo que se pide; los demás, con «Siguiente».
// - Simple: una partida de práctica ya en el gobierno, con lo básico.
// - Completo: desde crear la partida, la carrera de diputado a líder (acelerada: congreso y
//   elecciones llegan en pocos meses) y después el gobierno a fondo.
// Mientras dura un tutorial, la partida no se guarda.

const TUTORIAL_VISTO = 'pyd-tutorial-v1';
const tutorialVisto = () => { try { return !!localStorage.getItem(TUTORIAL_VISTO); } catch (e) { return true; } };
const marcarTutorialVisto = () => { try { localStorage.setItem(TUTORIAL_VISTO, '1'); } catch (e) { /* sin almacenamiento */ } };
const creandoPartida = () => ui.pantalla === 'menu' && ui.menu === 'nueva';
const enTutorial = () => !!ui.tutorial && ((ui.pantalla === 'juego' && !!estado) || (ui.tutorial.tipo === 'completo' && creandoPartida()));
const tutorialCompleto = () => !!ui.tutorial && ui.tutorial.tipo === 'completo';

const TAB = t => `.tab[data-v="${t}"]`;
const enTab = (t, sel) => () => (ui.tab !== t ? TAB(t) : sel);
const meses = n => `${n} ${n === 1 ? 'mes' : 'meses'}`;

// ---------- Pasos del gobierno (los comparten los dos tutoriales) ----------
// foco: selector de lo que se resalta (o función que lo da según lo que haya en pantalla).

const G = {
  cifras: {
    titulo: () => 'Tus cifras',
    texto: () => 'Arriba está lo que más importa: el <b>dinero</b> del tesoro, tu <b>popularidad</b>, la <b>estabilidad</b> del país y el <b>capital político</b>, que gastas en casi todo y recuperas cada mes. Puedes pulsar cada cifra para ver su detalle.',
    foco: '#stats',
  },
  provincia: {
    titulo: () => 'Elige una provincia',
    texto: () => 'Tu país se divide en provincias. Pulsa una de las tuyas, en el mapa o en la lista de la derecha.',
    foco: enTab('provincia', '.lista-prov'),
    hecho: () => ui.tab === 'provincia' && !!ui.prov,
  },
  construir: {
    titulo: () => 'Construye algo',
    texto: () => 'Cada edificio dice lo que te dará al mes antes de pagarlo. Las granjas quieren tierra fértil y las minas, minerales. Pulsa <b>Construir</b> en el que prefieras.',
    foco: () => (ui.tab !== 'provincia' ? TAB('provincia') : !ui.prov ? '.lista-prov' : '.edif [data-a="construir"]:not(:disabled)'),
    hecho: s => s.cuenta.obras > 0,
  },
  economiaTab: {
    titulo: () => 'Las cuentas',
    texto: () => 'La obra ya está en marcha. Mira de dónde sale y a dónde va el dinero: abre <b>Economía</b>.',
    foco: TAB('economia'),
    hecho: () => ui.tab === 'economia',
  },
  economia: {
    titulo: () => 'Que salgan los números',
    texto: () => 'Las granjas dan alimentos, las minas materias primas y las fábricas las convierten en bienes que se venden. <b>Mejores inversiones</b> te dice qué obra se paga antes. Más abajo puedes subir o bajar los <b>impuestos</b> y pedir <b>préstamos</b>. Si la deuda pasa de −400, tu gobierno cae.',
    foco: '#contenido',
  },
  parlamentoTab: {
    titulo: () => 'El Parlamento',
    texto: () => 'Ahora, las leyes: abre la pestaña <b>Parlamento</b>.',
    foco: TAB('parlamento'),
    hecho: () => ui.tab === 'parlamento',
  },
  proponer: {
    titulo: () => 'Propón una ley',
    texto: () => 'El hemiciclo muestra los 100 escaños. Más abajo están las leyes: cada una dice a quién gusta y qué cuesta. Pulsa <b>Proponer</b> en la que quieras.',
    foco: enTab('parlamento', '.tarjeta [data-a="proponer"]:not(:disabled)'),
    alEntrar: (s, t) => { t.propBase = s.cuenta.propuestas; },
    hecho: (s, t) => !!s.propuesta || s.cuenta.propuestas > t.propBase,
  },
  votar: {
    titulo: () => 'Negocia y vota',
    texto: () => 'Arriba ves qué votaría cada partido. Necesitas más votos a favor que en contra: si no te salen las cuentas, <b>negocia</b> con algún partido. Cuando quieras, pulsa <b>Llevar a votación</b> y mira el recuento.',
    foco: () => (ui.tab !== 'parlamento' ? TAB('parlamento') : $('[data-a="votar"]') ? '[data-a="votar"]' : '.tarjeta [data-a="proponer"]:not(:disabled)'),
    alEntrar: (s, t) => { if (t.propBase === undefined) t.propBase = s.cuenta.propuestas; },
    hecho: (s, t) => s.cuenta.propuestas > t.propBase && !s.resultadoVoto,
  },
  ministro: {
    titulo: () => 'Forma gobierno',
    texto: () => 'Salga o no la ley, así se legisla. Ahora ve a <b>Gobierno</b>, elige una cartera y nombra a un ministro: cada uno te da una ventaja todos los meses. Si es de otro partido, ese partido te apoyará más.',
    foco: () => (ui.tab !== 'gobierno' ? TAB('gobierno') : $('[data-a="nombrar"]:not(:disabled)') ? '[data-a="nombrar"]:not(:disabled)' : '[data-a="abrirCartera"]'),
    hecho: s => numMinistros(s) > 0,
  },
  sociedadTab: {
    titulo: () => 'Tus votantes',
    texto: () => 'Abre la pestaña <b>Sociedad</b> para ver qué piensa la gente de ti.',
    foco: TAB('sociedad'),
    hecho: () => ui.tab === 'sociedad',
  },
  sociedad: {
    titulo: () => 'Cuatro grupos, cien escaños',
    texto: () => 'Obreros, empresarios, campesinos y jóvenes: su apoyo decide cuántos escaños sacas en las elecciones. Aquí ves qué le gusta y qué le molesta a cada uno, y puedes dar un mitin para ganártelos.',
    foco: '#contenido',
  },
  diplomaciaTab: {
    titulo: () => 'El resto del mundo',
    texto: () => 'Abre <b>Diplomacia</b> para ver a tus vecinos.',
    foco: TAB('diplomacia'),
    hecho: () => ui.tab === 'diplomacia',
  },
  diplomacia: {
    titulo: () => 'Amigos y enemigos',
    texto: () => 'Con buena relación puedes firmar tratados (dan dinero) y alianzas. Si se tuercen las cosas, en <b>Defensa</b> reclutas regimientos y declaras guerras. Los vecinos también pelean entre sí.',
    foco: '#contenido',
  },
  defensaTab: {
    titulo: () => 'Ejército',
    texto: () => 'Abre <b>Defensa</b>.',
    foco: TAB('defensa'),
    hecho: () => ui.tab === 'defensa',
  },
  defensa: {
    titulo: () => 'Guerra y paz',
    texto: () => 'Cada regimiento cuesta dinero al mes. Con ellos te defiendes y, si declaras una guerra, atacas provincias enemigas: lo que ocupes puedes quedártelo al firmar la paz. Si conquistas todos los países, ganas la partida; si ocupan todo el tuyo, la pierdes.',
    foco: '#contenido',
  },
  mes: {
    titulo: () => 'Pasa de mes',
    texto: () => 'Cuando acabes lo que quieras hacer, pulsa <b>Siguiente mes</b> (o la barra espaciadora): cobras impuestos, avanzan las obras y pasan cosas.',
    foco: '#btn-mes',
    alEntrar: (s, t) => { t.mesBase = s.mes; },
    hecho: (s, t) => s.mes > t.mesBase,
  },
  objetivos: {
    titulo: () => 'Objetivos y prensa',
    texto: () => 'Bajo el mapa tienes <b>objetivos</b> que dan premios, los consejos de tu asesora y el periódico con lo que pasa en el país y en el mundo.',
    foco: '#objetivos',
  },
  cloacas: {
    titulo: () => 'Un atajo peligroso',
    texto: () => 'Al final de Economía están <b>las cloacas</b>: comisiones, sobornos y enchufes que dan ventaja al momento. Cada trampa sube la sospecha y, si la prensa te pilla, se acaba la partida. Tú verás.',
  },
};

const PASOS_SIMPLE = [
  {
    titulo: s => `Bienvenido a ${s.config.pais}`,
    texto: () => 'Acabas de ganar las elecciones y diriges el país. Cada turno es un mes. En unos minutos te enseño lo básico: construir, aprobar leyes, formar gobierno y pasar de mes.',
    boton: 'Empezar',
  },
  G.cifras, G.provincia, G.construir, G.parlamentoTab, G.proponer, G.votar, G.ministro, G.sociedadTab, G.sociedad,
  G.diplomaciaTab, G.diplomacia, G.mes, G.objetivos,
  {
    titulo: () => 'Ya sabes gobernar',
    texto: s => `Habrá elecciones cada ${s.config.legislatura} meses. Si las pierdes no se acaba la partida: pasas a la oposición y tu partido te marca una directiva. Para aprender también la carrera de diputado, prueba el <b>tutorial completo</b>. Suerte.`,
    fin: true,
  },
];

// ---------- Tutorial completo: crear la partida, la carrera y el gobierno ----------

const SIG_PASO = '.botones-paso .btn.laton';
const PASOS_COMPLETO = [
  // Crear la partida
  {
    titulo: () => 'Tutorial completo',
    texto: () => 'Vamos a recorrerlo todo: crear tu personaje y tu partido, empezar como diputado, hacerte con el partido, ganar unas elecciones y gobernar. Para que no se alargue, aquí el congreso y las elecciones llegan en pocos meses.',
    boton: 'Empezar',
  },
  {
    titulo: () => 'Dos formas de empezar',
    texto: () => 'En <b>Carrera política</b> empiezas de diputado raso y tienes que ganarte el partido y las elecciones. En <b>Gobierno directo</b> empiezas ya mandando. En este tutorial haremos la carrera entera.',
    foco: '.dificultades.dos',
    alEntrar: () => { ui.cfg.modo = 'carrera'; },
  },
  {
    titulo: () => 'Tu nombre',
    texto: () => 'Escribe cómo te llamas: saldrá en las noticias y en las papeletas. La <b>dificultad</b> cambia el dinero, la paciencia de los votantes y lo fuerte que es tu rival; aquí jugaremos en fácil.',
    foco: '#cfg-lider',
  },
  {
    titulo: () => 'Las elecciones',
    texto: () => 'Aquí eliges cada cuántos meses se vota. Legislaturas cortas dan partidas más rápidas y tensas. Cuando lo tengas, pulsa el botón dorado para pasar a <b>tu partido</b>.',
    foco: () => (ui.paso === 1 ? SIG_PASO : ''),
    hecho: () => ui.paso >= 2,
  },
  {
    titulo: () => 'Crear un partido o unirte a uno',
    texto: () => 'Si <b>creas el tuyo</b> eliges nombre, color, emblema e ideas. Si <b>te unes</b> a uno que ya existe, heredas sus votantes y sus ideas tal cual. Elige lo que prefieras.',
    foco: '.dificultades.dos',
  },
  {
    titulo: () => 'Nombre, color y emblema',
    texto: () => (ui.cfg.propio
      ? 'Ponle nombre a tu partido y elige su <b>color</b> (el último círculo abre la paleta completa) y su <b>emblema</b>. Así se verá en el hemiciclo y en el mapa electoral.'
      : 'Has elegido unirte a un partido: llevarás su nombre, su color y su emblema. Cada uno indica qué leyes le gustan.'),
    foco: () => (ui.cfg.propio ? '.vista-partido' : '.lista-partidos'),
  },
  {
    titulo: () => 'La ideología',
    texto: () => (ui.cfg.propio
      ? 'Elige hasta dos <b>principios</b>. Deciden entre qué grupos tienes más tirón (lo dicen las etiquetas de debajo) y qué leyes le gustan a tu partido: las que van contra sus ideas te costarán más.'
      : 'La ideología de tu partido ya viene dada: las leyes que encajan con sus ideas te salen más fáciles, y las que las contradicen cuestan más.'),
    foco: () => (ui.cfg.propio ? '.principios' : '.lista-partidos'),
  },
  {
    titulo: () => 'A por el país',
    texto: () => 'Pulsa el botón dorado para pasar a <b>tu país</b>.',
    foco: () => (ui.paso === 2 ? SIG_PASO : ''),
    hecho: () => ui.paso >= 3,
  },
  {
    titulo: () => 'Tu país y el mundo',
    texto: () => 'Ponle nombre y color a tu país. El <b>tamaño del mundo</b> marca cuántos países hay, y cada <b>número de mapa</b> genera uno distinto (a la derecha lo ves). Con más <b>partidos</b> en el parlamento, el voto se reparte más.',
    foco: '#cfg-pais',
  },
  {
    titulo: () => 'Todo listo',
    texto: () => 'Pulsa <b>Empezar la carrera</b>.',
    foco: '[data-a="empezar"]',
    hecho: () => ui.pantalla === 'juego' && !!estado,
  },

  // La carrera: de diputado a líder
  {
    titulo: s => `Diputado por ${s.config.partido}`,
    texto: s => `Acabas de recoger tu escaño. Gobierna ${PARTIDOS[s.gobiernoIA].nombre} y tu partido lo dirige ${LIDER_INICIAL}. Tu camino: hacerte un nombre, ganar el <b>congreso del partido</b> para dirigirlo y después ganar las <b>elecciones</b>.`,
    foco: '.pasos',
  },
  {
    titulo: () => 'Las cifras de un diputado',
    texto: () => 'El <b>prestigio</b> es tu fama. El <b>apoyo en el partido</b> es lo que te quieren los tuyos. Los <b>fondos</b> pagan cenas, mítines y campañas. Y el <b>capital político</b> se gasta en casi todo y vuelve cada mes.',
    foco: '#stats',
  },
  {
    titulo: () => 'Haz algo este mes',
    texto: () => 'Cada acción se puede hacer una vez al mes. <b>Intervenir en el pleno</b> y la <b>televisión</b> dan prestigio; <b>reunirte con militantes</b> y <b>cenar con los barones</b>, apoyo en el partido; <b>recaudar</b> da fondos. Haz la que quieras.',
    foco: enTab('carrera', '[data-a="accionCarrera"]:not(:disabled)'),
    hecho: s => Object.keys(s.carrera.hechas).length > 0,
  },
  {
    titulo: () => 'El partido',
    texto: () => 'Abre la pestaña <b>Partido</b>.',
    foco: TAB('partido'),
    hecho: () => ui.tab === 'partido',
  },
  {
    titulo: () => 'El congreso',
    texto: s => `Dentro de ${meses(Math.max(0, s.carrera.congresoMes - s.mes))} los delegados eligen líder. Gana quien llegue con más apoyo: el tuyo es tu <b>apoyo en el partido</b> más una quinta parte de tu <b>prestigio</b>. Las barras comparan lo tuyo con lo de ${LIDER_INICIAL}.`,
    foco: '#contenido',
  },
  {
    titulo: () => 'Leyes desde la oposición',
    texto: () => 'También puedes legislar sin gobernar. Ve a <b>Parlamento</b> y pulsa <b>Proponer</b> en una ley: si encaja con las ideas de tu partido, mejor.',
    foco: enTab('parlamento', '.tarjeta [data-a="proponer"]:not(:disabled)'),
    alEntrar: (s, t) => { t.propBase = s.cuenta.propuestas; },
    hecho: (s, t) => !!s.propuesta || s.cuenta.propuestas > t.propBase,
  },
  {
    ...G.votar,
    titulo: () => 'Llévala al pleno',
    texto: s => `Mira qué votaría cada partido y <b>negocia</b> si te falta alguno. Ojo: con menos de ${APOYO_PARA_RESPALDO} de apoyo en el partido, tu propio grupo se abstiene. Si la ley sale, ganas prestigio, apoyo en el partido e imagen entre quienes se benefician. Pulsa <b>Llevar a votación</b>.`,
  },
  {
    titulo: () => 'Los votantes',
    texto: () => 'Abre la pestaña <b>Votantes</b>.',
    foco: TAB('sociedad'),
    hecho: () => ui.tab === 'sociedad',
  },
  {
    titulo: () => 'Quién te vota',
    texto: () => 'Aquí ves cuánto apoya cada grupo a tu partido y por qué. La marca vertical es hacia donde se mueve ese apoyo. Un <b>mitin</b> lo sube al momento, y en la pestaña <b>Mapa</b> ves quién ganaría en cada provincia.',
    foco: '#contenido',
  },
  {
    titulo: () => 'Pasa de mes',
    texto: () => 'Pulsa <b>Siguiente mes</b>. Cada pocos meses el gobierno llevará una ley al pleno y tendrás que decidir qué dices: callar, criticarla o defenderla. También habrá imprevistos con varias salidas.',
    foco: '#btn-mes',
    alEntrar: (s, t) => { t.mesBase = s.mes; },
    hecho: (s, t) => s.mes > t.mesBase,
  },
  {
    titulo: () => 'Hasta el congreso',
    texto: s => (esLider(s) ? 'Ya diriges el partido.'
      : `Sigue así: cada mes haz acciones que suban tu apoyo y tu prestigio y pasa de mes. El congreso es en ${meses(Math.max(0, s.carrera.congresoMes - s.mes))}: ahora tienes ${apoyoCongreso(s)} y ${LIDER_INICIAL}, ${s.carrera.apoyoLider}. Si lo pierdes, habrá otro más adelante.`),
    foco: () => (apoyoCongreso(estado) > estado.carrera.apoyoLider ? '#btn-mes' : enTab('carrera', '[data-a="accionCarrera"]:not(:disabled)')()),
    hecho: s => esLider(s) && !s.congreso,
  },

  // Líder del partido: programa, campaña y elecciones
  {
    titulo: () => 'Ya diriges el partido',
    texto: s => `Ahora eres la cara de ${s.config.partido} y su candidato. Las elecciones son en ${meses(Math.max(0, s.proximaEleccion - s.mes))}: gobierna el partido que saque más escaños. Como líder decides el voto de todo tu grupo y tienes acciones nuevas, como la <b>campaña en medios</b>.`,
    foco: '.pasos',
    alEntrar: s => {
      // En el tutorial las elecciones llegan pronto y con viento a favor.
      s.proximaEleccion = s.mes + 4;
      s.carrera.fuerzaGobierno = 1.1;
      for (const g in GRUPOS) cambiarImagen(s, g, 8);
      s.cp = CP_MAXIMO;
    },
  },
  {
    titulo: () => 'Tu programa electoral',
    texto: () => 'Ve a <b>Partido</b> y promete una ley. Cada promesa atrae ya a los grupos a los que beneficia; si ganas, tendrás 12 meses para cumplirla o esos grupos se enfadarán.',
    foco: enTab('partido', '[data-a="prometer"]:not(:disabled)'),
    hecho: s => s.carrera.promesas.length > 0,
  },
  {
    titulo: () => 'Campaña',
    texto: s => `Quedan ${meses(Math.max(0, s.proximaEleccion - s.mes))}. En <b>Carrera</b> verás las encuestas: da mítines, haz campaña y cuida la unidad del partido (si baja de 25, te quitan el liderazgo). Pasa los meses hasta la noche electoral y, si ganas, pulsa <b>Formar gobierno</b>.`,
    foco: () => (ui.tab === 'carrera' ? '#btn-mes' : TAB('carrera')),
    hecho: s => s.modo === 'gobierno' && !s.elecciones,
  },

  // El gobierno, a fondo
  {
    titulo: s => `Presidente de ${s.config.pais}`,
    texto: () => 'Has ganado: ahora gobiernas. Heredas las leyes que ya estaban en vigor y tus promesas. Cambian las pestañas: provincias, economía, gobierno, diplomacia y defensa. Vamos una por una.',
    boton: 'Vamos',
  },
  G.cifras, G.provincia, G.construir, G.economiaTab, G.economia, G.parlamentoTab,
  {
    ...G.proponer,
    texto: () => 'Legislar gobernando es igual que antes, pero ahora las leyes tienen efecto en tu economía y en tus votantes. Si prometiste alguna en campaña, verás el plazo arriba. Pulsa <b>Proponer</b> en una.',
  },
  G.votar, G.ministro, G.sociedadTab, G.sociedad, G.diplomaciaTab, G.diplomacia, G.defensaTab, G.defensa, G.mes, G.objetivos, G.cloacas,
  {
    titulo: () => 'Tutorial completado',
    texto: s => `Ya lo has visto todo. Habrá elecciones cada ${s.config.legislatura} meses: si las pierdes, o si cae tu gobierno, vuelves a la oposición con una directiva de tu partido, y si no la cumples te expulsa. En multijugador es lo mismo, con amigos en otros países o en la oposición del tuyo. Suerte.`,
    fin: true,
  },
];

const pasosTutorial = () => (tutorialCompleto() ? PASOS_COMPLETO : PASOS_SIMPLE);

// ---------- Arranque ----------

function iniciarTutorial() {
  const c = ui.cfg;
  estado = nuevaPartida({
    ...c, principios: [...c.principios], lider: c.lider.trim() || CONFIG_BASE.lider, partido: c.partido.trim() || CONFIG_BASE.partido,
    pais: c.pais.trim() || CONFIG_BASE.pais, modo: 'gobierno', dificultad: 'facil', tamano: 'pequeno', nPartidos: 4, legislatura: 24, semilla: 7,
  });
  entrarJuego();
  ui.tutorial = { tipo: 'simple', paso: 0, nuevo: true, foco: '' };
}

// El completo empieza en la pantalla de crear partida.
function iniciarTutorialCompleto() {
  estado = null;
  Object.assign(ui, { pantalla: 'menu', menu: 'nueva', paso: 1, menuAnim: true, ventana: null });
  ui.cfg.modo = 'carrera';
  ui.tutorial = { tipo: 'completo', paso: 0, nuevo: true, foco: '' };
  scrollTo(0, 0);
}

// La partida del tutorial completo: carrera en fácil, con el congreso a la vuelta de la esquina.
function configTutorialCompleto(c) { return { ...c, modo: 'carrera', dificultad: 'facil' }; }
function prepararPartidaTutorial(s) {
  const c = s.carrera;
  Object.assign(c, { congresoMes: 4, interno: 40, apoyoLider: 46, fondos: 90 });
  s.cp = CP_MAXIMO;
}

function irAPasoTutorial(n) {
  const t = ui.tutorial, pasos = pasosTutorial();
  t.paso = Math.min(n, pasos.length - 1);
  t.nuevo = true;
  const p = pasos[t.paso];
  if (p.alEntrar) p.alEntrar(estado, t);
  if (p.fin) marcarTutorialVisto();
}

// ¿Se ve entero el elemento, sin que lo tapen la cabecera fija ni la tarjeta del tutorial?
function visibleEnPantalla(el) {
  const r = el.getBoundingClientRect(), cab = ui.pantalla === 'juego' ? $('.cabecera').getBoundingClientRect().bottom : 0;
  // Dentro del panel con barra propia también puede quedar fuera de la vista.
  const caja = el.closest('#contenido'), c = caja && caja !== el ? caja.getBoundingClientRect() : null;
  if (c && (r.top < c.top || r.bottom > c.bottom)) return false;
  return r.top >= Math.max(0, cab) && r.bottom <= innerHeight - 8;
}

function htmlElegirTutorial() {
  return `<h2>${ico('birrete')} Tutorial</h2>
    <p>Elige cuánto quieres aprender. Ninguno toca tu partida guardada.</p>
    <button class="opcion" data-a="tutSimple"><b>Simple · unos 5 minutos</b>
      <span class="nota">Empiezas ya en el gobierno y aprendes lo básico: construir, aprobar una ley, nombrar un ministro y pasar de mes.</span></button>
    <button class="opcion" data-a="tutCompleto"><b>Completo · unos 20 minutos</b>
      <span class="nota">Desde cero: creas tu personaje y tu partido, empiezas de diputado, te ganas el partido, haces campaña, ganas las elecciones y gobiernas, con todo explicado a fondo.</span></button>
    <button class="btn" data-a="cerrar">Ahora no</button>`;
}

function renderTutorial() {
  const caja = $('#tutorial');
  // Quien vuelve al menú principal a mitad del tutorial lo deja.
  if (ui.tutorial && ui.pantalla === 'menu' && !(tutorialCompleto() && creandoPartida())) ui.tutorial = null;
  const activo = enTutorial();
  document.body.classList.toggle('con-tutorial', activo);
  caja.hidden = !activo;
  if (!activo) { $$('.tut-foco').forEach(e => e.classList.remove('tut-foco')); return; }
  caja.classList.toggle('en-menu', ui.pantalla === 'menu');
  const t = ui.tutorial, s = estado, pasos = pasosTutorial();
  // Lo que ya está hecho se da por visto: quien se adelanta no tiene que repetirlo.
  let avanzo = false;
  for (let guardia = 0; guardia < pasos.length; guardia++) {
    const paso = pasos[t.paso];
    if (!paso.hecho || !paso.hecho(s, t)) break;
    irAPasoTutorial(t.paso + 1);
    avanzo = true;
  }
  if (avanzo) Sonido.tocar('logro');
  const p = pasos[t.paso], n = pasos.length;
  const pie = p.fin
    ? `<button class="btn laton mini" data-a="tutSeguir">Seguir con esta partida</button><button class="btn claro mini" data-a="tutSalir">Volver al menú</button>`
    : p.hecho ? `<span class="tut-espera">${ico('flecha')} Hazlo para continuar</span><button class="enlace" data-a="tutSaltar">Saltar este paso</button>`
      : `<button class="btn laton mini" data-a="tutSiguiente">${p.boton || 'Siguiente'} ${ico('flecha')}</button>`;
  const cambio = ponerHTML(caja, `<div class="tut-cab"><span>${ico('birrete')} Tutorial${tutorialCompleto() ? ' completo' : ''} · paso ${t.paso + 1} de ${n}</span>
      ${p.fin ? '' : '<button class="enlace" data-a="tutSalir">Salir</button>'}</div>
    <div class="tut-barra"><i style="width:${Math.round((t.paso + 1) / n * 100)}%"></i></div>
    <div class="tut-cuerpo"><h3>${esc(p.titulo(s))}</h3><p>${p.texto(s)}</p></div>
    <div class="tut-pie">${pie}</div>`);
  if (cambio && t.nuevo) $('.tut-cuerpo', caja).classList.add('entra');
  document.documentElement.style.setProperty('--alto-tut', caja.offsetHeight + 'px');

  // Resalta dónde hay que pulsar y, si no se ve, lleva la pantalla hasta allí.
  const sel = typeof p.foco === 'function' ? p.foco(s) : p.foco || '', el = sel ? $(sel) : null;
  $$('.tut-foco').forEach(e => { if (e !== el) e.classList.remove('tut-foco'); });
  if (el) {
    el.classList.add('tut-foco');
    if ((t.nuevo || t.foco !== sel) && $('#modal').hidden && !visibleEnPantalla(el)) {
      el.scrollIntoView({ behavior: animar() ? 'smooth' : 'auto', block: 'center' });
    }
  }
  t.foco = sel;
  t.nuevo = false;
}

const accionesTutorial = {
  tutorial: () => { ui.ventana = 'tutorial'; },
  tutSimple: () => iniciarTutorial(),
  tutCompleto: () => iniciarTutorialCompleto(),
  tutSiguiente: () => irAPasoTutorial(ui.tutorial.paso + 1),
  tutSaltar: () => irAPasoTutorial(ui.tutorial.paso + 1),
  tutSalir: () => { marcarTutorialVisto(); salirAlMenu(); },
  // La partida de práctica pasa a ser una partida normal y se guarda a partir de ahora.
  tutSeguir: () => { ui.tutorial = null; },
};
