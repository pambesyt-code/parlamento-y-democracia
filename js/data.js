'use strict';
// Datos del juego: todo lo que se puede equilibrar o ampliar sin tocar las reglas.

const VERSION = '0.5';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ANIO_INICIAL = 2030;
const CP_MAXIMO = 10;

// Contexto de la partida activa. Lo fija prepararMundo() al empezar o cargar una partida:
// qué partido llevas, cuánto dura la legislatura, cómo se llama tu país y qué provincias hay.
let ID_JUGADOR = 'uc';
let MESES_LEGISLATURA = 24;
const PAIS_JUGADOR = { id: 'aldora', nombre: 'Aldora', colores: ['#dba94a', '#c99a41', '#e6c078'] };
let PROVINCIAS = [];
let PROV_POR_ID = {};

// admin: gasto fijo mensual. apoyoBase: apoyo de partida de cada grupo.
// desgaste: cada cuántos meses de legislatura pierdes 1 punto de apoyo.
// Para la carrera: apoyoOposicion es el apoyo de partida a tu partido, fuerzaGobierno la ventaja
// del partido que gobierna, apoyoLider lo que debes superar en el congreso e interno tu apoyo inicial.
const DIFICULTADES = {
  facil: { nombre: 'Fácil', desc: 'Arcas llenas y votantes pacientes. Para aprender.', dinero: 400, admin: 40, apoyoBase: 53, desgaste: 6, eventoProb: 0.35, apoyoOposicion: 42, fuerzaGobierno: 1.5, apoyoLider: 52, interno: 25 },
  normal: { nombre: 'Normal', desc: 'Gobernar desgasta: hay que ganarse cada voto.', dinero: 250, admin: 64, apoyoBase: 48, desgaste: 4, eventoProb: 0.45, apoyoOposicion: 38, fuerzaGobierno: 1.6, apoyoLider: 62, interno: 18 },
  dificil: { nombre: 'Difícil', desc: 'Poco dinero, muchas crisis y un electorado exigente.', dinero: 160, admin: 79, apoyoBase: 45, desgaste: 3, eventoProb: 0.55, apoyoOposicion: 34, fuerzaGobierno: 1.7, apoyoLider: 72, interno: 12 },
};

const MODOS_JUEGO = {
  carrera: { nombre: 'Carrera política', desc: 'Empiezas como diputado. Gana el partido, luego las elecciones y después gobierna.' },
  gobierno: { nombre: 'Gobierno directo', desc: 'Empiezas ya como jefe de gobierno, con las elecciones ganadas.' },
};

const LEGISLATURAS = { 18: 'Corta: 18 meses', 24: 'Normal: 24 meses', 36: 'Larga: 36 meses' };

// Tamaños de mapa. propias: tus provincias. paises: cuántos países más hay (mínimo y máximo).
// islas: cuántos de ellos viven en islas. provPais: provincias de cada país del continente.
const TAMANOS = {
  pequeno: { nombre: 'Pequeño', desc: '7 provincias tuyas y 5 países', propias: 7, paises: [5, 5], islas: 1, provPais: [3, 4] },
  mediano: { nombre: 'Mediano', desc: '9 provincias tuyas y 10 países', propias: 9, paises: [10, 10], islas: 2, provPais: [2, 4] },
  grande: { nombre: 'Grande', desc: '11 provincias tuyas y de 15 a 20 países', propias: 11, paises: [15, 20], islas: 3, provPais: [2, 3] },
};
const COLORES_PAIS = ['#dba94a', '#bfcf63', '#e79fb6', '#63c7b8', '#eda35a'];

// Los demás países se crean en cada partida con estas piezas: un nombre y su estilo (que da
// nombre a sus provincias), un carácter (gobierno, ejército, comercio) y un color.
const PLANTILLAS_PAIS = [
  { nombre: 'Norvia', estilo: 'nordico' }, { nombre: 'Skarnia', estilo: 'nordico' }, { nombre: 'Isfold', estilo: 'nordico' }, { nombre: 'Hvalmark', estilo: 'nordico' },
  { nombre: 'Kessel', estilo: 'germanico' }, { nombre: 'Brandmark', estilo: 'germanico' }, { nombre: 'Ostmark', estilo: 'germanico' }, { nombre: 'Hochland', estilo: 'germanico' },
  { nombre: 'Meridia', estilo: 'latino' }, { nombre: 'Solaria', estilo: 'latino' }, { nombre: 'Valtierra', estilo: 'latino' }, { nombre: 'Portana', estilo: 'latino' },
  { nombre: 'Lusitra', estilo: 'latino' }, { nombre: 'Montaria', estilo: 'latino' },
  { nombre: 'Dravia', estilo: 'eslavo' }, { nombre: 'Velinia', estilo: 'eslavo' }, { nombre: 'Krasnia', estilo: 'eslavo' }, { nombre: 'Bohrava', estilo: 'eslavo' },
  { nombre: 'Qadira', estilo: 'desierto' }, { nombre: 'Zafiria', estilo: 'desierto' }, { nombre: 'Sahrán', estilo: 'desierto' },
  { nombre: 'Tiveria', estilo: 'isleno' }, { nombre: 'Corallia', estilo: 'isleno' }, { nombre: 'Marinsula', estilo: 'isleno' }, { nombre: 'Islas Brumosas', estilo: 'isleno' },
];
const ESTILOS = {
  nordico: { pre: ['Nord', 'Kal', 'Fjel', 'Is', 'Skar', 'Hval', 'Grim', 'Vik', 'Tor', 'Ulf', 'Rav', 'Bjor', 'Frost', 'Sol'], suf: ['heim', 'vik', 'holm', 'dal', 'fjord', 'by', 'stad', 'vang', 'mark', 'sund'] },
  germanico: { pre: ['Eisen', 'Dorn', 'Rhein', 'Hoch', 'Stein', 'Wald', 'Brann', 'Oster', 'Linden', 'Adler', 'Schwarz', 'Gold'], suf: ['burg', 'wall', 'ach', 'au', 'feld', 'berg', 'hausen', 'dorf', 'stadt', 'heim'] },
  latino: { pre: ['Sol', 'Ver', 'Mar', 'Oliv', 'Cal', 'Alb', 'Lev', 'Pal', 'Font', 'Ser', 'Cast', 'Mont'], suf: ['ana', 'era', 'isma', 'ares', 'ante', 'ada', 'encia', 'illa', 'oria', 'ena'] },
  eslavo: { pre: ['Drav', 'Vel', 'Star', 'Brod', 'Kras', 'Bel', 'Zor', 'Vol', 'Mir', 'Slav', 'Tver', 'Gor'], suf: ['ograd', 'ika', 'ina', 'ovo', 'ava', 'ec', 'ica', 'nja', 'ov', 'ets'] },
  desierto: { pre: ['Qas', 'Zaf', 'Al', 'Sah', 'Dar', 'Ham', 'Kha', 'Tal', 'Jab', 'Nar'], suf: ['ira', 'ar', 'adir', 'ab', 'ún', 'ara', 'em', 'ila', 'ush', 'or'] },
  isleno: { pre: ['Puerto ', 'Isla ', 'Cala ', 'Cabo ', 'Playa ', 'Bahía '], suf: ['Brava', 'Serena', 'Dorada', 'Azul', 'Coral', 'Verde', 'Blanca', 'Honda', 'Larga', 'Mayor'] },
};
// fuerza: regimientos por provincia. comercio: lo que da un tratado, antes de ajustarlo a su tamaño.
const CARACTERES = [
  { gobierno: 'Monarquía', desc: 'Reino de nobles y comerciantes.', fuerza: 1.5, comercio: 30, relacion: 5 },
  { gobierno: 'República militar', desc: 'Sus generales mandan más que sus diputados.', fuerza: 2.3, comercio: 28, relacion: -15 },
  { gobierno: 'Federación', desc: 'Agrícola y pacífica.', fuerza: 1, comercio: 22, relacion: 15 },
  { gobierno: 'República mercantil', desc: 'Vive del comercio y de sus puertos.', fuerza: 1.2, comercio: 42, relacion: 5 },
  { gobierno: 'Principado', desc: 'Orgulloso y celoso de sus fronteras.', fuerza: 1.8, comercio: 24, relacion: -5 },
  { gobierno: 'Teocracia', desc: 'La gobierna su clero, que desconfía de los extranjeros.', fuerza: 1.6, comercio: 18, relacion: -10 },
  { gobierno: 'República', desc: 'Democracia joven y abierta al mundo.', fuerza: 1.2, comercio: 32, relacion: 12 },
  { gobierno: 'Imperio', desc: 'Sueña con recuperar su antigua grandeza.', fuerza: 2.1, comercio: 28, relacion: -20 },
];
const COLORES_MAPA = ['#7f9fc4', '#a88bbb', '#8cba97', '#b3a08c', '#dd9376', '#7fb3b0', '#c98fa8', '#9aa86b', '#b08463', '#8e9ec9', '#a3c08a',
  '#9c8fc4', '#c77d6b', '#6fa6a0', '#bf9c6f', '#a8a8a0', '#86a6d1', '#cf8f8f', '#94b8a0', '#b7a3c9', '#d4a088', '#8fa38a'];
const COLORES_BANDERA = ['#f1ece0', '#2a2622', '#b3261e', '#2f5d9a', '#e2b458', '#2c6e49', '#5b3a78', '#d9744f'];
// Se rellenan al generar cada mundo. NACIONES: todos los países, también los de los jugadores
// (humano: true). PAISES: los mismos vistos desde la nación activa, sin ella (ver verDesde).
const NACIONES = {};
const PAISES = {};
// Id del país de cada jugador: el primero es «aldora» y los siguientes «h1», «h2»...
const idHumano = h => (h === 0 ? 'aldora' : 'h' + h);

const GRUPOS = {
  obreros: { nombre: 'Obreros', peso: 0.35, icono: 'llave' },
  empresarios: { nombre: 'Empresarios', peso: 0.15, icono: 'maletin' },
  campesinos: { nombre: 'Campesinos', peso: 0.25, icono: 'trigo' },
  jovenes: { nombre: 'Jóvenes', peso: 0.25, icono: 'birrete' },
};

const ETIQUETAS = { izquierda: 'Izquierda', derecha: 'Derecha', social: 'Social', orden: 'Orden', verde: 'Verde', agrario: 'Agrario' };

// Principios que puede tener un partido creado por el jugador. Cada uno marca qué leyes le gustan
// (afinidad +2) y entre qué grupos tiene más o menos tirón (grupos: cambio relativo de su base).
const PRINCIPIOS = {
  izquierda: { desc: 'Reparto de la riqueza y servicios públicos.', grupos: { obreros: 0.25, empresarios: -0.35, jovenes: 0.05 }, opuesto: 'derecha' },
  derecha: { desc: 'Libre mercado e impuestos bajos.', grupos: { empresarios: 0.6, obreros: -0.2, campesinos: 0.05 }, opuesto: 'izquierda' },
  social: { desc: 'Educación, vivienda y derechos.', grupos: { jovenes: 0.15, obreros: 0.1, empresarios: -0.1 } },
  orden: { desc: 'Seguridad, ejército y mano dura.', grupos: { campesinos: 0.15, empresarios: 0.15, jovenes: -0.25 } },
  verde: { desc: 'Medio ambiente y energía limpia.', grupos: { jovenes: 0.3, campesinos: 0.1, empresarios: -0.2 } },
  agrario: { desc: 'El campo y los pueblos primero.', grupos: { campesinos: 0.4, jovenes: -0.1 } },
};
const MAX_PRINCIPIOS = 2;

// afinidad: cuánto le gusta a cada partido cada tipo de ley (-2 a +2). base: fuerza electoral por grupo.
// «uc» es el partido de centro: lo sustituye el tuyo si creas uno propio.
const PARTIDOS = {
  uc: {
    nombre: 'Unión Cívica', siglas: 'UC', color: '#c9902b', emblema: 'sol', lema: 'Centro moderado y pactista.',
    afinidad: {}, base: { obreros: 30, empresarios: 30, campesinos: 30, jovenes: 30 },
  },
  fo: {
    nombre: 'Frente Obrero', siglas: 'FO', color: '#b5443b', emblema: 'engranaje', lema: 'Izquierda sindical, fuerte entre los obreros.',
    afinidad: { izquierda: 2, social: 1, derecha: -2, orden: -1 },
    base: { obreros: 45, empresarios: 4, campesinos: 18, jovenes: 28 },
  },
  ac: {
    nombre: 'Alianza Conservadora', siglas: 'AC', color: '#35568c', emblema: 'torre', lema: 'Derecha de orden, la preferida de los empresarios.',
    afinidad: { derecha: 2, orden: 2, izquierda: -2, social: -1, verde: -1, agrario: 1 },
    base: { obreros: 14, empresarios: 55, campesinos: 28, jovenes: 10 },
  },
  va: {
    nombre: 'Verdes Agrarios', siglas: 'VA', color: '#4f8a4b', emblema: 'hoja', lema: 'Ecologistas del campo, pequeños pero decisivos.',
    afinidad: { verde: 2, agrario: 2, social: 1, derecha: -1 },
    base: { obreros: 5, empresarios: 5, campesinos: 20, jovenes: 22 },
  },
};
const ORDEN_HEMICICLO = ['fo', 'va', 'uc', 'ac'];
const COLORES_PARTIDO = ['#c9902b', '#2a9d8f', '#7b4fa6', '#de6b35', '#c9478b'];
const EMBLEMAS = ['sol', 'estrella', 'antorcha', 'balanza', 'faro'];

// mant: mantenimiento mensual. meses: tiempo de obra. unico: solo uno por provincia.
const EDIFICIOS = {
  granja: { nombre: 'Granja', art: 'una', icono: 'trigo', coste: 80, meses: 1, mant: 3, requiere: 'fertil', desc: 'Produce 4 alimentos al mes.' },
  mina: { nombre: 'Mina', art: 'una', icono: 'pico', coste: 120, meses: 2, mant: 4, requiere: 'mineral', desc: 'Produce 4 materias primas al mes.' },
  fabrica: { nombre: 'Fábrica', art: 'una', icono: 'fabrica', coste: 200, meses: 2, mant: 5, desc: 'Convierte 3 materias primas en 3 bienes para vender.' },
  puerto: { nombre: 'Puerto', art: 'un', icono: 'ancla', coste: 180, meses: 3, mant: 6, requiere: 'costera', unico: true, desc: 'Exportaciones +10%. Permite comerciar y desembarcar por mar.' },
  mercado: { nombre: 'Mercado', art: 'un', icono: 'tienda', coste: 140, meses: 1, mant: 4, unico: true, desc: 'Cobra a los comerciantes: más cuanta más gente vive en la provincia.' },
  hotel: { nombre: 'Hotel de costa', art: 'un', icono: 'cama', coste: 170, meses: 2, mant: 5, requiere: 'costera', unico: true, desc: 'Atrae turistas. Rinde más con el país estable y casi nada en guerra.' },
  universidad: { nombre: 'Universidad', art: 'una', icono: 'birrete', coste: 220, meses: 3, mant: 8, unico: true, desc: 'Jóvenes +4 de apoyo. Ingresos de fábricas +5%.' },
  cuartel: { nombre: 'Cuartel', art: 'un', icono: 'torre', coste: 150, meses: 2, mant: 10, unico: true, desc: 'Estabilidad +3. Aloja 3 regimientos más.' },
  banco: { nombre: 'Banco nacional', art: 'un', icono: 'parlamento', coste: 260, meses: 3, mant: 6, requiere: 'capital', unico: true, desc: 'El tesoro da intereses y los préstamos salen más baratos.' },
};

// Nivel de impuestos: mult multiplica lo recaudado; todos y grupos cambian el apoyo.
const NIVELES_IMPUESTOS = {
  bajos: { nombre: 'Bajos', mult: 0.7, todos: 4 },
  normales: { nombre: 'Normales', mult: 1, todos: 0 },
  altos: { nombre: 'Altos', mult: 1.35, todos: -4, grupos: { empresarios: -3 } },
  muy_altos: { nombre: 'Muy altos', mult: 1.7, todos: -9, grupos: { empresarios: -6 }, estabilidad: -4 },
};
const MESES_TRIBUTO = 24;

const CATEGORIAS_LEY = { economia: 'Economía', trabajo: 'Trabajo', social: 'Social', orden: 'Orden', ambiente: 'Campo y ambiente' };

// coste: gasto mensual (negativo = ingreso). grupos: cambio de apoyo mientras la ley esté en vigor.
// mods: fabricas/minas/export/construccion/impuestos multiplican; granjaExtra suma alimentos por granja.
const LEYES = [
  { id: 'impuestos', cat: 'economia', nombre: 'Subida de impuestos', desc: 'Más recaudación a costa de quien más tiene.', tags: ['izquierda'], mods: { impuestos: 1.5 }, grupos: { empresarios: -10, jovenes: -3 }, incompatible: 'rebaja' },
  { id: 'rebaja', cat: 'economia', nombre: 'Rebaja fiscal', desc: 'Menos impuestos para animar la inversión.', tags: ['derecha'], mods: { impuestos: 0.7, fabricas: 1.15 }, grupos: { empresarios: 10, obreros: 2 }, incompatible: 'impuestos' },
  { id: 'comercio', cat: 'economia', nombre: 'Libre comercio', desc: 'Se eliminan aranceles: lo que exportas se paga mejor.', tags: ['derecha'], mods: { export: 1.2 }, grupos: { empresarios: 8, campesinos: -6 }, incompatible: 'aranceles' },
  { id: 'aranceles', cat: 'economia', nombre: 'Aranceles proteccionistas', desc: 'Se protege el producto nacional frente al extranjero.', tags: ['izquierda', 'agrario'], mods: { export: 0.9 }, grupos: { campesinos: 8, obreros: 4, empresarios: -6 }, incompatible: 'comercio' },
  { id: 'privatizacion', cat: 'economia', nombre: 'Privatización de servicios', desc: 'El Estado vende empresas públicas y cobra por ello.', tags: ['derecha'], coste: -35, grupos: { obreros: -7, empresarios: 6 } },
  { id: 'loteria', cat: 'economia', nombre: 'Lotería nacional', desc: 'Un sorteo cada semana que llena las arcas.', tags: [], coste: -25, grupos: { obreros: -2 } },
  { id: 'infraestructuras', cat: 'economia', nombre: 'Plan de infraestructuras', desc: 'Carreteras y trenes: construir sale más barato.', tags: [], coste: 30, mods: { construccion: 0.7 }, grupos: { obreros: 2, empresarios: 2, campesinos: 2, jovenes: 2 } },

  { id: 'salario', cat: 'trabajo', nombre: 'Salario mínimo', desc: 'Sueldo mínimo garantizado por ley.', tags: ['izquierda'], mods: { fabricas: 0.85 }, grupos: { obreros: 10, empresarios: -8 } },
  { id: 'laboral', cat: 'trabajo', nombre: 'Reforma laboral flexible', desc: 'Contratar y despedir es más fácil y barato.', tags: ['derecha'], mods: { fabricas: 1.25 }, grupos: { obreros: -10, empresarios: 8 } },
  { id: 'pensiones', cat: 'trabajo', nombre: 'Pensiones dignas', desc: 'Sube la pensión mínima de jubilación.', tags: ['izquierda', 'social'], coste: 40, grupos: { obreros: 6, campesinos: 6 } },

  { id: 'sanidad', cat: 'social', nombre: 'Sanidad pública', desc: 'Hospitales gratuitos para toda la población.', tags: ['izquierda', 'social'], coste: 45, grupos: { obreros: 8, campesinos: 6 }, estabilidad: 3 },
  { id: 'educacion', cat: 'social', nombre: 'Educación gratuita', desc: 'Escuelas y universidades sin matrícula.', tags: ['social'], coste: 35, grupos: { jovenes: 12, obreros: 3 } },
  { id: 'vivienda', cat: 'social', nombre: 'Plan de vivienda joven', desc: 'Alquileres asequibles para quien empieza.', tags: ['social'], coste: 30, grupos: { jovenes: 8, obreros: 3 } },
  { id: 'transparencia', cat: 'social', nombre: 'Ley de transparencia', desc: 'Las cuentas públicas, a la vista de todos.', tags: [], coste: 10, estabilidad: 4, grupos: { obreros: 2, empresarios: 2, campesinos: 2, jovenes: 2 } },

  { id: 'seguridad', cat: 'orden', nombre: 'Ley de seguridad ciudadana', desc: 'Más policía y penas más duras.', tags: ['orden'], coste: 25, estabilidad: 10, grupos: { jovenes: -8 } },
  { id: 'servicio_militar', cat: 'orden', nombre: 'Servicio militar obligatorio', desc: 'Un año de instrucción para cada joven. Reclutar cuesta un 30% menos y caben 2 regimientos más.', tags: ['orden'], coste: 15, estabilidad: 6, grupos: { jovenes: -12 } },

  { id: 'agrario', cat: 'ambiente', nombre: 'Subsidios agrarios', desc: 'Ayudas directas al campo.', tags: ['agrario'], coste: 30, mods: { granjaExtra: 1 }, grupos: { campesinos: 12 } },
  { id: 'ambiental', cat: 'ambiente', nombre: 'Protección ambiental', desc: 'Límites a la minería y a la contaminación.', tags: ['verde'], mods: { minas: 0.75 }, grupos: { jovenes: 9, campesinos: 4, empresarios: -5 } },
  { id: 'renovables', cat: 'ambiente', nombre: 'Energías renovables', desc: 'Energía limpia y barata para la industria.', tags: ['verde'], coste: 35, mods: { fabricas: 1.1 }, grupos: { jovenes: 6 } },
];

const NOMBRES_PROPIOS = {
  costa: ['Puerto Sal', 'Costa Negra', 'Bahía Clara', 'Torremar', 'Cabo Viejo', 'Playa Larga', 'Punta Serena', 'Marazul'],
  interior: ['Valdoria', 'Monteferro', 'Carbonera', 'Altamira', 'Llanos de Oro', 'Ribera', 'Peñalba', 'Vallehondo', 'Sierra Alta', 'Campo Real', 'Dos Ríos', 'Fuentefría'],
};

const ACCIONES_DIPLO = {
  delegacion: { nombre: 'Enviar delegación', icono: 'bandera', cp: 1, dinero: 25, desc: 'Relación +12.' },
  tratado: { nombre: 'Tratado comercial', icono: 'moneda', cp: 1, desc: 'Ingresos cada mes. Requiere relación 25.' },
  alianza: { nombre: 'Alianza', icono: 'escudo', cp: 2, desc: 'Estabilidad +4, influencia y ayuda si te atacan. Requiere tratado y relación 55.' },
  denuncia: { nombre: 'Denuncia pública', icono: 'megafono', cp: 1, desc: 'Relación −15. A su rival le gusta (+8).' },
};

// Ejército y guerra.
const COSTE_TROPA = 60;        // reclutar un regimiento
const MANT_TROPA = 3;          // mantenerlo cada mes (el doble en guerra)
const TROPAS_INICIALES = 2;
const CP_DECLARAR_GUERRA = 3;
const MESES_TREGUA = 24;

// Gabinete. El efecto depende del nivel (1 a 5) de quien ocupe la cartera.
const CARTERAS = {
  hacienda: { nombre: 'Hacienda', icono: 'moneda', efecto: n => `Impuestos +${3 * n}%` },
  interior: { nombre: 'Interior', icono: 'escudo', efecto: n => `Estabilidad +${Math.round(1.5 * n)}` },
  exteriores: { nombre: 'Exteriores', icono: 'globo', efecto: n => `Delegaciones +${2 * n} de relación, influencia +${2 * n}` },
  industria: { nombre: 'Industria y obras', icono: 'martillo', efecto: n => `Construir cuesta ${4 * n}% menos` },
};

// cartera: su especialidad. Fuera de ella rinde dos niveles menos. partido null = independiente.
const CANDIDATOS = [
  { id: 'marques', nombre: 'Elena Marqués', partido: 'uc', cartera: 'hacienda', nivel: 3 },
  { id: 'rivas', nombre: 'Tomás Rivas', partido: 'uc', cartera: 'interior', nivel: 2 },
  { id: 'ferrer', nombre: 'Lucía Ferrer', partido: 'uc', cartera: 'exteriores', nivel: 4 },
  { id: 'coll', nombre: 'Andrés Coll', partido: 'uc', cartera: 'industria', nivel: 3 },
  { id: 'vidal', nombre: 'Rosa Vidal', partido: 'fo', cartera: 'industria', nivel: 4 },
  { id: 'herrero', nombre: 'Iván Herrero', partido: 'fo', cartera: 'interior', nivel: 3 },
  { id: 'luna', nombre: 'Gonzalo de Luna', partido: 'ac', cartera: 'hacienda', nivel: 5 },
  { id: 'sandoval', nombre: 'Beatriz Sandoval', partido: 'ac', cartera: 'exteriores', nivel: 3 },
  { id: 'prats', nombre: 'Nora Prats', partido: 'va', cartera: 'industria', nivel: 3 },
  { id: 'ortega', nombre: 'Samuel Ortega', partido: null, cartera: 'hacienda', nivel: 4 },
  { id: 'ibanez', nombre: 'Clara Ibáñez', partido: null, cartera: 'interior', nivel: 4 },
  { id: 'bermejo', nombre: 'Hugo Bermejo', partido: null, cartera: 'exteriores', nivel: 5 },
];

// Efectos de una opción: dinero, cp, estabilidad, todos (todos los grupos), grupos {id: n},
// relacion (país del evento), relacion2 (segundo país), relPartido (partido del evento), relPartidos (todos),
// destituir, guerra ('pais' o 'pais2': empieza una guerra con él), romperAlianza y paz.
// requiere: edificio que debe existir. pais / dosPaises / partido / ministro / provincia: se eligen al azar.
// paisFijo: solo si ese país sigue existiendo. directo: no sale al azar, lo lanzan las reglas.
// En los textos, {mipais} es el nombre de tu país.
const EVENTOS = [
  {
    id: 'huelga', icono: 'fabrica', titulo: 'Huelga en las fábricas', requiere: 'fabrica',
    texto: 'Los trabajadores paran la producción y piden mejores sueldos.',
    opciones: [
      { texto: 'Pagar una subida de sueldos', efectos: { dinero: -60, grupos: { obreros: 8, empresarios: -4 } } },
      { texto: 'Mantenerse firme', efectos: { estabilidad: -4, grupos: { obreros: -8, empresarios: 4 } } },
    ],
  },
  {
    id: 'sequia', icono: 'trigo', titulo: 'Sequía en el campo',
    texto: 'Lleva meses sin llover y las cosechas peligran.',
    opciones: [
      { texto: 'Aprobar ayudas de emergencia', efectos: { dinero: -50, grupos: { campesinos: 6 } } },
      { texto: 'No intervenir', efectos: { grupos: { campesinos: -8 } } },
    ],
  },
  {
    id: 'corrupcion', icono: 'periodico', titulo: 'Escándalo en el gabinete', ministro: true,
    texto: 'La prensa publica que {ministro} aceptó sobornos de una constructora.',
    opciones: [
      { texto: 'Destituir a {ministro}', efectos: { destituir: true, estabilidad: 2 } },
      { texto: 'Defenderle en público', efectos: { todos: -4, estabilidad: -3 } },
    ],
  },
  {
    id: 'estudiantes', icono: 'birrete', titulo: 'Protestas estudiantiles',
    texto: 'Miles de jóvenes ocupan las plazas de la capital.',
    opciones: [
      { texto: 'Reunirte con sus portavoces', efectos: { cp: -1, grupos: { jovenes: 6 } } },
      { texto: 'Desalojar con la policía', efectos: { estabilidad: 3, grupos: { jovenes: -10 } } },
    ],
  },
  {
    id: 'inversor', icono: 'maletin', titulo: 'Oferta de un inversor extranjero',
    texto: 'Una gran empresa quiere instalarse, pero exige condiciones laborales a su medida.',
    opciones: [
      { texto: 'Aceptar la inversión', efectos: { dinero: 120, grupos: { empresarios: 4, obreros: -4 } } },
      { texto: 'Rechazarla', efectos: { grupos: { obreros: 3, empresarios: -5 } } },
    ],
  },
  {
    id: 'frontera', icono: 'bandera', titulo: 'Incidente fronterizo con {pais}', pais: true,
    texto: 'Una patrulla de {pais} ha cruzado la frontera sin permiso.',
    opciones: [
      { texto: 'Presentar una protesta formal', efectos: { relacion: -12, estabilidad: 3 } },
      { texto: 'Quitarle importancia', efectos: { relacion: 5, todos: -3 } },
    ],
  },
  {
    id: 'cumbre', icono: 'globo', titulo: '{pais} te invita a una cumbre', pais: true,
    texto: 'El gobierno de {pais} propone una reunión de alto nivel.',
    opciones: [
      { texto: 'Asistir con una gran delegación', efectos: { dinero: -30, relacion: 15 } },
      { texto: 'Declinar la invitación', efectos: { relacion: -8 } },
    ],
  },
  {
    id: 'cosecha', icono: 'trigo', titulo: 'Cosecha excepcional', requiere: 'granja',
    texto: 'Este año las granjas han producido mucho más de lo esperado.',
    opciones: [
      { texto: 'Exportar el excedente', efectos: { dinero: 60 } },
      { texto: 'Abaratar la comida en casa', efectos: { todos: 3 } },
    ],
  },
  {
    id: 'accidente', icono: 'pico', titulo: 'Accidente en una mina', requiere: 'mina',
    texto: 'Un derrumbe deja varios mineros heridos.',
    opciones: [
      { texto: 'Indemnizar e invertir en seguridad', efectos: { dinero: -50, grupos: { obreros: 5 } } },
      { texto: 'Culpar a la empresa', efectos: { grupos: { obreros: 2, empresarios: -6 } } },
    ],
  },
  {
    id: 'crisis_vecinos', icono: 'escudo', titulo: 'Crisis entre {pais} y {pais2}', dosPaises: true,
    texto: 'Los dos países movilizan tropas y ambos esperan tu apoyo.',
    opciones: [
      { texto: 'Respaldar a {pais}', efectos: { relacion: 15, relacion2: -20 } },
      { texto: 'Respaldar a {pais2}', efectos: { relacion: -20, relacion2: 15 } },
      { texto: 'Ofrecerte como mediador', efectos: { cp: -2, relacion: 5, relacion2: 5, estabilidad: 2 } },
    ],
  },
  {
    id: 'epidemia', icono: 'gente', titulo: 'Brote de gripe',
    texto: 'Los hospitales se llenan y la gente pide una respuesta.',
    opciones: [
      { texto: 'Campaña de vacunación', efectos: { dinero: -70, todos: 3 } },
      { texto: 'Esperar a que pase', efectos: { todos: -4, estabilidad: -2 } },
    ],
  },
  {
    id: 'debate', icono: 'megafono', titulo: 'Debate televisado',
    texto: 'Te enfrentas en directo a los líderes de la oposición.',
    opciones: [
      { texto: 'Atacar sin contemplaciones', efectos: { grupos: { obreros: 3, jovenes: 2 }, relPartidos: -6 } },
      { texto: 'Tender la mano', efectos: { relPartidos: 6 } },
    ],
  },
  {
    id: 'yacimiento', icono: 'pico', titulo: 'Hallazgo de un yacimiento', provincia: true,
    texto: 'Unos geólogos encuentran petróleo en {provincia}, bajo un bosque protegido.',
    opciones: [
      { texto: 'Explotarlo', efectos: { dinero: 150, grupos: { jovenes: -5, campesinos: -3 } } },
      { texto: 'Proteger el bosque', efectos: { grupos: { jovenes: 6, empresarios: -3 } } },
    ],
  },
  {
    id: 'banco', icono: 'parlamento', titulo: 'Un banco en apuros',
    texto: 'El mayor banco del país no puede devolver los ahorros de sus clientes.',
    opciones: [
      { texto: 'Rescatarlo con dinero público', efectos: { dinero: -100, grupos: { empresarios: 6, obreros: -4 } } },
      { texto: 'Dejarlo caer', efectos: { estabilidad: -3, grupos: { empresarios: -8 } } },
    ],
  },
  {
    id: 'prestamo_pais', icono: 'moneda', titulo: '{pais} pide un préstamo', pais: true,
    texto: 'El gobierno de {pais} pasa apuros y recurre a {mipais}.',
    opciones: [
      { texto: 'Concederlo', efectos: { dinero: -60, relacion: 18 } },
      { texto: 'Negarse con educación', efectos: { relacion: -6 } },
    ],
  },
  {
    id: 'espia', icono: 'candado', titulo: 'Detenido un espía de {pais}', pais: true,
    texto: 'La policía sorprende a un agente de {pais} fotografiando documentos.',
    opciones: [
      { texto: 'Expulsarlo ante las cámaras', efectos: { relacion: -15, estabilidad: 3, todos: 1 } },
      { texto: 'Devolverlo con discreción', efectos: { relacion: 6, cp: -1 } },
    ],
  },
  {
    id: 'fiesta', icono: 'estrella', titulo: 'Fiesta nacional',
    texto: 'Se acerca el día de {mipais} y hay que decidir cómo celebrarlo.',
    opciones: [
      { texto: 'Un gran desfile', efectos: { dinero: -40, estabilidad: 3, todos: 2 } },
      { texto: 'Un acto austero', efectos: { grupos: { empresarios: 2 } } },
    ],
  },
  {
    id: 'pacto', icono: 'charla', titulo: '{partido} propone un pacto', partido: true,
    texto: 'Sus diputados ofrecen colaborar si escuchas sus prioridades.',
    opciones: [
      { texto: 'Aceptar y cederles protagonismo', efectos: { cp: -1, relPartido: 15 } },
      { texto: 'Rechazarlo', efectos: { relPartido: -6 } },
    ],
  },
  {
    id: 'inundacion', icono: 'ancla', titulo: 'Inundaciones en {provincia}', provincia: true,
    texto: 'El río se desborda y deja barrios enteros bajo el agua.',
    opciones: [
      { texto: 'Enviar ayuda de inmediato', efectos: { dinero: -60, todos: 2 } },
      { texto: 'Esperar al informe de daños', efectos: { estabilidad: -2, grupos: { campesinos: -5 } } },
    ],
  },
  {
    id: 'mercaderes', icono: 'ancla', titulo: 'Mercaderes de {pais}', requiere: 'puerto', maritimo: true,
    texto: 'Una flota de {pais} pide licencias para vender en tus puertos.',
    opciones: [
      { texto: 'Venderles las licencias', efectos: { dinero: 80, relacion: 6 } },
      { texto: 'Proteger el comercio local', efectos: { grupos: { obreros: 3 }, relacion: -8 } },
    ],
  },
  {
    id: 'desfile', icono: 'espadas', titulo: 'Los generales piden más medios',
    texto: 'El estado mayor avisa de que el ejército se queda anticuado.',
    opciones: [
      { texto: 'Comprar armamento nuevo', efectos: { dinero: -90, tropas: 1 } },
      { texto: 'Decirles que se apañen', efectos: { estabilidad: -2 } },
    ],
  },

  // Lanzados por las reglas de guerra y del mundo.
  {
    id: 'ultimatum', icono: 'espadas', directo: true, titulo: 'Ultimátum de {pais}',
    texto: '{pais} concentra tropas junto a {mipais} y exige un tributo para no atacar.',
    opciones: [
      { texto: 'Pagar el tributo', efectos: { dinero: -150, relacion: 25, todos: -2 } },
      { texto: 'Rechazarlo y prepararse', efectos: { guerra: 'pais', todos: 2 } },
    ],
  },
  {
    id: 'aliado_guerra', icono: 'escudo', directo: true, titulo: '{pais} pide tu ayuda',
    texto: 'Tu aliado {pais} está en guerra con {pais2} y reclama que cumplas la alianza.',
    opciones: [
      { texto: 'Entrar en la guerra', efectos: { guerra: 'pais2', relacion: 20 } },
      { texto: 'Mantenerte al margen', efectos: { romperAlianza: true, relacion: -30 } },
    ],
  },
  {
    id: 'oferta_paz', icono: 'bandera', directo: true, titulo: '{pais} ofrece la paz',
    texto: 'Tras meses de guerra, {pais} propone que cada uno vuelva a sus fronteras.',
    opciones: [
      { texto: 'Aceptar la paz', efectos: { paz: true } },
      { texto: 'Seguir luchando', efectos: {} },
    ],
  },
];

// Metas que orientan la partida. hecho se evalúa después de cada acción.
const OBJETIVOS = [
  { id: 'construir', texto: 'Encarga tu primer edificio', premio: { cp: 1 }, hecho: s => s.cuenta.obras >= 1 },
  { id: 'ley', texto: 'Aprueba una ley', premio: { dinero: 50 }, hecho: s => s.cuenta.leyes >= 1 },
  { id: 'ministros', texto: 'Nombra dos ministros', premio: { cp: 1 }, hecho: s => Object.values(s.ministros).filter(Boolean).length >= 2 },
  { id: 'tratado', texto: 'Firma un tratado comercial', premio: { dinero: 60 }, hecho: s => Object.values(s.paises).some(p => p.tratado) },
  { id: 'balance', texto: 'Llega a un balance de +100 al mes', premio: { dinero: 100 }, hecho: s => calcularEconomia(s).balance >= 100 },
  { id: 'ejercito', texto: 'Ten 4 regimientos', premio: { cp: 1 }, hecho: s => s.tropas >= 4 },
  { id: 'puerto', texto: 'Construye un puerto', premio: { dinero: 80 }, hecho: s => contarEdificios(s).puerto >= 1 },
  { id: 'universidad', texto: 'Construye una universidad', premio: { cp: 2 }, hecho: s => contarEdificios(s).universidad >= 1 },
  { id: 'popular', texto: 'Alcanza el 60% de popularidad', premio: { cp: 2 }, hecho: s => popularidad(s) >= 60 },
  { id: 'elecciones', texto: 'Gana unas elecciones', premio: { dinero: 150 }, hecho: s => s.cuenta.elecciones >= 1 },
  { id: 'alianza', texto: 'Sella una alianza', premio: { dinero: 100 }, hecho: s => Object.values(s.paises).some(p => p.alianza) },
  { id: 'conquista', texto: 'Anexiona una provincia', premio: { dinero: 120 }, hecho: s => s.cuenta.conquistas >= 1 },
  { id: 'mercado', texto: 'Abre un mercado', premio: { dinero: 60 }, hecho: s => contarEdificios(s).mercado >= 1 },
  { id: 'pais', texto: 'Anexiona un país entero', premio: { dinero: 250 }, hecho: s => Object.values(s.paises).some(p => p.porTi) },
  { id: 'fabricas', texto: 'Ten 5 fábricas', premio: { dinero: 150 }, hecho: s => contarEdificios(s).fabrica >= 5 },
  { id: 'absoluta', texto: 'Consigue mayoría absoluta: 51 escaños', premio: { dinero: 200 }, hecho: s => s.escanos[ID_JUGADOR] >= 51 },
];

// ---------- Carrera política ----------

const LIDER_INICIAL = 'Marta Solís';
const MES_CONGRESO = 10;
const MAX_PROMESAS = 3;

// Lo que puedes hacer cada mes mientras no gobiernas. Cada cosa, una vez al mes.
// fase: 'lider' = solo cuando ya diriges el partido.
const ACCIONES_CARRERA = [
  { id: 'pleno', nombre: 'Intervenir en el pleno', icono: 'megafono', cp: 1, efectos: { prestigio: 3 }, desc: 'Un buen discurso te da a conocer.' },
  { id: 'militantes', nombre: 'Reunirte con militantes', icono: 'gente', cp: 1, efectos: { interno: 3 }, desc: 'Las bases del partido quieren que se las escuche.' },
  { id: 'fondos', nombre: 'Recaudar fondos', icono: 'moneda', cp: 1, efectos: { fondos: 30 }, desc: 'Cenas, rifas y llamadas a simpatizantes.' },
  { id: 'tele', nombre: 'Entrevista en televisión', icono: 'periodico', cp: 2, efectos: { prestigio: 7 }, desc: 'Media hora en el programa más visto.' },
  { id: 'barones', nombre: 'Cena con los barones', icono: 'maletin', cp: 2, fondos: 30, efectos: { interno: 8 }, desc: 'Los dirigentes regionales mueven muchos delegados.' },
  { id: 'campana', nombre: 'Campaña en medios', icono: 'megafono', cp: 1, fondos: 90, fase: 'lider', efectos: { imagenTodos: 1 }, desc: 'Carteles y anuncios por todo el país. Su efecto no se pierde.' },
];

// Efectos propios de la carrera: prestigio, interno (apoyo en el partido), fondos, imagen {grupo: n},
// imagenTodos, apoyoLider (apoyo de la líder actual) y fuerzaGobierno (ventaja del partido que gobierna).
// fase: 'diputado' o 'lider' si solo ocurre en esa etapa.
const EVENTOS_CARRERA = [
  {
    id: 'c_lealtad', icono: 'megafono', fase: 'diputado', titulo: 'La dirección te pide lealtad',
    texto: `${LIDER_INICIAL} quiere que defiendas en televisión una postura del partido que no gusta a nadie.`,
    opciones: [
      { texto: 'Dar la cara por el partido', efectos: { interno: 6, prestigio: -3 } },
      { texto: 'Negarte con buenas palabras', efectos: { interno: -5, prestigio: 4 } },
    ],
  },
  {
    id: 'c_filtracion', icono: 'periodico', titulo: 'Llega un sobre anónimo',
    texto: 'Dentro hay pruebas de que un ministro adjudicó contratos a un amigo.',
    opciones: [
      { texto: 'Denunciarlo tú en el pleno', efectos: { prestigio: 8, fuerzaGobierno: -0.06, relPartidos: -4 } },
      { texto: 'Entregárselo a la dirección', efectos: { interno: 7, fuerzaGobierno: -0.03 } },
    ],
  },
  {
    id: 'c_foto', icono: 'periodico', titulo: 'Una vieja foto incómoda',
    texto: 'Un periódico publica una imagen tuya de hace años en una fiesta poco edificante.',
    opciones: [
      { texto: 'Reírte de ti mismo en una entrevista', efectos: { prestigio: 2, interno: -2 } },
      { texto: 'Pagar a un gabinete para taparlo', efectos: { fondos: -50 } },
      { texto: 'No decir nada', efectos: { prestigio: -4 } },
    ],
  },
  {
    id: 'c_donante', icono: 'moneda', titulo: 'Un donante generoso',
    texto: 'Un gran empresario ofrece financiar tu campaña. La prensa acabará sabiéndolo.',
    opciones: [
      { texto: 'Aceptar el dinero', efectos: { fondos: 110, imagen: { obreros: -3, empresarios: 2 } } },
      { texto: 'Rechazarlo en público', efectos: { prestigio: 3, imagen: { obreros: 2 } } },
    ],
  },
  {
    id: 'c_huelga', icono: 'fabrica', titulo: 'Huelga en la mayor fábrica del país',
    texto: 'Los trabajadores llevan diez días parados y te invitan a visitarlos.',
    opciones: [
      { texto: 'Ir con el megáfono', efectos: { imagen: { obreros: 4, empresarios: -3 } } },
      { texto: 'Proponer una mediación', efectos: { prestigio: 3, imagen: { empresarios: 1 } } },
    ],
  },
  {
    id: 'c_baron', icono: 'maletin', fase: 'diputado', titulo: 'Un barón te ofrece su apoyo', provincia: true,
    texto: 'El dirigente de {provincia} pondrá a sus delegados de tu parte si le prometes un cargo.',
    opciones: [
      { texto: 'Cerrar el trato', efectos: { interno: 10, prestigio: -2 } },
      { texto: 'No comprar apoyos', efectos: { interno: -3, prestigio: 3 } },
    ],
  },
  {
    id: 'c_rumbo', icono: 'balanza', titulo: 'Debate sobre el rumbo del partido',
    texto: 'El partido discute si abrirse a nuevos votantes o volver a sus esencias.',
    opciones: [
      { texto: 'Defender la apertura', efectos: { interno: -4, imagenTodos: 1 } },
      { texto: 'Defender las esencias', efectos: { interno: 5 } },
    ],
  },
  {
    id: 'c_tanteo', icono: 'charla', titulo: '{partido} te tantea', partido: true,
    texto: 'Uno de sus dirigentes te invita a comer para hablar de futuros acuerdos.',
    opciones: [
      { texto: 'Aceptar la comida', efectos: { relPartido: 12, interno: -3 } },
      { texto: 'Declinar la invitación', efectos: { relPartido: -4, interno: 2 } },
    ],
  },
  {
    id: 'c_campo', icono: 'trigo', titulo: 'Tractores ante el Parlamento',
    texto: 'Miles de agricultores protestan por los precios y buscan diputados que los escuchen.',
    opciones: [
      { texto: 'Bajar a hablar con ellos', efectos: { imagen: { campesinos: 4 }, prestigio: 1 } },
      { texto: 'Seguir con la agenda', efectos: { imagen: { campesinos: -2 } } },
    ],
  },
  {
    id: 'c_tropiezo', icono: 'megafono', fase: 'diputado', titulo: `${LIDER_INICIAL} tropieza`,
    texto: 'La líder confunde dos cifras en un debate y todo el país se ríe.',
    opciones: [
      { texto: 'Salir en su defensa', efectos: { interno: 4, apoyoLider: -2 } },
      { texto: 'Dejar caer que hace falta relevo', efectos: { apoyoLider: -6, interno: -3, prestigio: 2 } },
    ],
  },
  {
    id: 'c_criticos', icono: 'gente', fase: 'lider', titulo: 'El sector crítico se mueve',
    texto: 'Varios dirigentes piden más peso en la dirección y amenazan con hacer ruido.',
    opciones: [
      { texto: 'Darles puestos en la ejecutiva', efectos: { interno: 8, prestigio: -2 } },
      { texto: 'Plantarles cara', efectos: { interno: -6, prestigio: 4 } },
    ],
  },
  {
    id: 'c_debate', icono: 'megafono', fase: 'lider', titulo: 'Debate entre candidatos',
    texto: 'Las cadenas organizan un cara a cara con el jefe de gobierno.',
    opciones: [
      { texto: 'Atacar su gestión', efectos: { imagenTodos: 2, fuerzaGobierno: -0.04, relPartidos: -3 } },
      { texto: 'Presentar tu programa', efectos: { prestigio: 5, imagenTodos: 1 } },
    ],
  },
];

const OBJETIVOS_CARRERA = [
  { id: 'c_pleno', texto: 'Interviene en el pleno', premio: { cp: 1 }, hecho: s => s.cuenta.plenos >= 1 },
  { id: 'c_prestigio', texto: 'Alcanza 30 de prestigio', premio: { fondos: 40 }, hecho: s => s.carrera.prestigio >= 30 },
  { id: 'c_ley', texto: 'Lleva una ley a votación', premio: { interno: 3 }, hecho: s => s.cuenta.propuestas >= 1 },
  { id: 'c_supera', texto: `Supera en apoyo a ${LIDER_INICIAL}`, premio: { prestigio: 3 }, hecho: s => esLider(s) || apoyoCongreso(s) > s.carrera.apoyoLider },
  { id: 'c_lider', texto: 'Gana el congreso del partido', premio: { cp: 3 }, hecho: s => esLider(s) },
  { id: 'c_promesas', texto: 'Haz tres promesas electorales', premio: { prestigio: 4 }, hecho: s => s.carrera.promesas.length >= MAX_PROMESAS },
  { id: 'c_primero', texto: 'Ponte primero en las encuestas', premio: { fondos: 80 }, hecho: s => ganaJugador(estimarVotos(s, false)) },
];

const LEY_POR_ID = Object.fromEntries(LEYES.map(l => [l.id, l]));
const EVENTO_POR_ID = Object.fromEntries([...EVENTOS, ...EVENTOS_CARRERA].map(e => [e.id, e]));
const CAND_POR_ID = Object.fromEntries(CANDIDATOS.map(c => [c.id, c]));
