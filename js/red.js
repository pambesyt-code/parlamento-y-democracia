'use strict';
// Multijugador en directo con PeerJS.
//
// El navegador de quien crea la sala (el anfitrión) hace de servidor: guarda la partida, aplica las
// acciones de todos con las mismas reglas que el juego en solitario y envía a cada jugador su nación.
// Los demás (invitados) solo envían lo que hacen y pintan lo que reciben. PeerJS conecta los
// navegadores entre sí usando su servidor público gratuito, así que no hace falta montar nada.
//
// Mensajes del invitado al anfitrión:  entrar {token, perfil} · perfil {perfil} · accion {a, d} · listo {v}
// Mensajes del anfitrión al invitado:  sala {sala, restante, yo} · estado {nacion, humanos} · error {texto}

const PREFIJO_SALA = 'parlamento-diplomacia-';
const LETRAS_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_JUGADORES = { pequeno: 4, mediano: 6, grande: 8 };
const MAX_POR_PAIS = 4;   // uno por partido del parlamento
const MAX_CHAT = 60;
const GUARDADO_MULTI = 'pyd-multi-v1';

const RED = {
  rol: null,            // 'anfitrion', 'invitado' o null (solitario)
  peer: null,
  conexion: null,       // invitado: su conexión con el anfitrión
  conexiones: {},       // anfitrión: token → conexión
  codigo: '',
  sala: null,           // anfitrión: la sala de verdad; invitado: la copia que recibe
  finTurno: 0,          // momento (reloj de este ordenador) en que se acaba el mes
  temporizador: null,
  error: '',
  estado: '',           // texto de lo que está pasando mientras se conecta
};
const enRed = () => !!RED.rol;
const soyAnfitrion = () => RED.rol === 'anfitrion';

// Identificador de este jugador. Va en sessionStorage para que dos pestañas sean dos jugadores
// y para que, al recargar, el anfitrión lo reconozca y le devuelva su país.
function miToken() {
  try {
    let t = sessionStorage.getItem('pyd-token');
    if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('pyd-token', t); }
    return t;
  } catch (e) { return RED.tokenTemporal || (RED.tokenTemporal = Math.random().toString(36).slice(2)); }
}

const codigoAlAzar = () => Array.from({ length: 5 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join('');
const perfilDe = c => ({
  lider: c.lider, propio: c.propio, partidoId: c.partidoId, partido: c.partido, color: c.color, emblema: c.emblema,
  principios: [...c.principios], pais: c.pais, colorPais: c.colorPais, nacion: c.nacion || null,
});

function errorRed(texto) {
  RED.error = texto;
  RED.estado = '';
  render();
}

function crearPeer(id) {
  if (typeof Peer === 'undefined') {
    errorRed('No se ha podido cargar PeerJS. Comprueba la conexión a internet y recarga la página.');
    return null;
  }
  return id ? new Peer(id) : new Peer();
}

// ---------- Anfitrión ----------

function crearSala(guardada) {
  cerrarRed();
  RED.error = '';
  RED.estado = 'Creando la sala…';
  const codigo = guardada ? guardada.sala.codigo : codigoAlAzar();
  const peer = crearPeer(PREFIJO_SALA + codigo);
  if (!peer) return;
  RED.peer = peer;
  peer.on('open', () => {
    RED.rol = 'anfitrion';
    RED.codigo = codigo;
    RED.estado = '';
    if (guardada) reanudarSala(guardada);
    else {
      RED.sala = {
        codigo, owner: miToken(), empezada: false, limite: 0,
        config: { modo: 'gobierno', dificultad: 'normal', legislatura: 24, tamano: 'mediano', semilla: semillaAlAzar(), minutos: 3 },
        jugadores: [{ token: miToken(), perfil: perfilDe(ui.cfg), conectado: true, nacion: null, listo: false }],
      };
      ui.pantalla = 'sala';
    }
    difundir();
  });
  peer.on('connection', conn => {
    conn.on('data', m => alRecibirAnfitrion(conn, m));
    conn.on('close', () => {
      const j = RED.sala && RED.sala.jugadores.find(x => RED.conexiones[x.token] === conn);
      if (!j) return;
      j.conectado = false;
      delete RED.conexiones[j.token];
      comprobarTurno();
    });
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') {
      // El código está ocupado (por ejemplo, la sala anterior aún no se ha cerrado del todo).
      if (guardada) errorRed('Ese código de sala sigue ocupado. Espera un minuto y vuelve a intentarlo.');
      else crearSala();
    } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
      errorRed('No se puede conectar con el servidor de PeerJS. Comprueba tu conexión a internet.');
    } else if (e.type !== 'peer-unavailable') errorRed(`Error de conexión: ${e.type}`);
  });
}

function alRecibirAnfitrion(conn, m) {
  const sala = RED.sala;
  if (!sala || !m || typeof m !== 'object') return;
  let j = sala.jugadores.find(x => x.token === m.token) || sala.jugadores.find(x => RED.conexiones[x.token] === conn);
  if (m.t === 'entrar') {
    // Quien vuelve desde otra pestaña o tras cerrar el navegador se reconoce por su nombre.
    if (!j && sala.empezada && m.perfil) {
      const nombre = String(m.perfil.lider || '').trim().toLowerCase();
      j = sala.jugadores.find(x => !x.conectado && x.token !== sala.owner && x.perfil.lider.trim().toLowerCase() === nombre);
      if (j) cambiarToken(j, m.token);
    }
    if (!j) {
      if (sala.empezada) return conn.send({ t: 'error', texto: 'La partida ya ha empezado y no tienes país en ella.' });
      if (sala.jugadores.length >= MAX_JUGADORES[sala.config.tamano]) return conn.send({ t: 'error', texto: 'La sala está llena.' });
      j = { token: m.token, perfil: m.perfil, conectado: true, nacion: null, listo: false };
      sala.jugadores.push(j);
    }
    j.conectado = true;
    RED.conexiones[j.token] = conn;
    difundir();
    return;
  }
  if (!j) return;
  if (m.t === 'perfil' && !sala.empezada) { j.perfil = m.perfil; difundir(); }
  if (m.t === 'accion' && sala.empezada) aplicarAccion(j, m.a, m.d || {});
  if (m.t === 'listo' && sala.empezada) { j.listo = !!m.v; comprobarTurno(); }
  if (m.t === 'chat') anotarChat(j, m.texto);
}

// Un jugador que vuelve con otro identificador conserva su sitio: en la sala y en su país.
function cambiarToken(j, nuevo) {
  const viejo = j.token;
  j.token = nuevo;
  for (const s of Object.values(ESTADOS)) {
    if (s.tokenGobierno === viejo) s.tokenGobierno = nuevo;
    for (const o of s.oposicion || []) if (o.token === viejo) o.token = nuevo;
  }
  if (RED.sala.owner === viejo) RED.sala.owner = nuevo;
}

function anotarChat(j, texto) {
  texto = String(texto || '').trim().slice(0, 240);
  if (!texto) return;
  const sala = RED.sala;
  sala.chat = [...(sala.chat || []), { de: j.perfil.lider, color: j.perfil.colorPais, texto, hora: Date.now() }].slice(-MAX_CHAT);
  difundir();
}

// El anfitrión puede parar el reloj (por ejemplo, para hablar algo) y reanudarlo después.
function alternarPausa() {
  const sala = RED.sala;
  if (!soyAnfitrion() || !sala.empezada) return;
  if (sala.pausada) {
    sala.pausada = false;
    sala.limite = Date.now() + sala.restantePausa;
    clearTimeout(RED.temporizador);
    RED.temporizador = setTimeout(avanzarMes, sala.restantePausa);
  } else {
    sala.pausada = true;
    sala.restantePausa = Math.max(1000, sala.limite - Date.now());
    clearTimeout(RED.temporizador);
  }
  difundir();
}

function cambiarConfigSala(k, v) {
  const c = RED.sala.config;
  c[k] = k === 'legislatura' || k === 'minutos' || k === 'semilla' ? +v : v;
  // Con otro mapa los países son otros: cada jugador vuelve a elegir.
  if (k === 'tamano' || k === 'semilla') {
    for (const j of RED.sala.jugadores) j.perfil.nacion = null;
    ui.cfg.nacion = null;
  }
  difundir();
}

// Jugadores agrupados por el país que han elegido, en orden de llegada (el primero gobierna).
function jugadoresPorPais(jugadores) {
  const grupos = {};
  for (const j of jugadores) if (j.perfil.nacion) (grupos[j.perfil.nacion] = grupos[j.perfil.nacion] || []).push(j);
  return grupos;
}

// Lo que impide empezar, contado para que el anfitrión sepa qué falta.
function puedeEmpezar(sala = RED.sala) {
  const max = MAX_JUGADORES[sala.config.tamano];
  if (sala.jugadores.length > max) return { ok: false, motivo: `En un mundo ${TAMANOS[sala.config.tamano].nombre.toLowerCase()} caben ${max} jugadores` };
  const sinPais = sala.jugadores.find(j => !j.perfil.nacion);
  if (sinPais) return { ok: false, motivo: `${sinPais.perfil.lider} aún no ha elegido país en el mapa` };
  const grupos = jugadoresPorPais(sala.jugadores);
  for (const pid in grupos) {
    const huecos = grupos[pid].map(j => huecoPartido(j.perfil));
    if (grupos[pid].length > MAX_POR_PAIS) return { ok: false, motivo: `En un mismo país caben ${MAX_POR_PAIS} jugadores` };
    if (new Set(huecos).size !== huecos.length) {
      return { ok: false, motivo: `${grupos[pid].map(j => j.perfil.lider).join(' y ')} están en el mismo país con el mismo partido (o los dos con uno propio): uno debe cambiarlo` };
    }
  }
  return { ok: true };
}

// Crea el mundo y una nación por cada país elegido. En cada país gobierna quien lo eligió primero
// y el resto forma la oposición. Si dos gobiernos han elegido el mismo color, el segundo recibe otro.
function empezarPartida() {
  const sala = RED.sala;
  if (!puedeEmpezar().ok) return;
  const grupos = jugadoresPorPais(sala.jugadores), usados = new Set();
  for (const pid in grupos) {
    const p = grupos[pid][0].perfil;
    if (usados.has(p.colorPais)) p.colorPais = COLORES_PAIS.find(c => !usados.has(c)) || p.colorPais;
    usados.add(p.colorPais);
  }
  for (const k in ESTADOS) delete ESTADOS[k];
  prepararMundo(sala.config, 0);
  const cfgs = {};
  for (const pid in grupos) {
    const gob = grupos[pid][0];
    // Un país compartido empieza siempre gobernado: la carrera es para quien juega solo en su país.
    cfgs[pid] = completarConfig({ ...sala.config, ...gob.perfil, nacion: pid, modo: grupos[pid].length > 1 ? 'gobierno' : sala.config.modo });
    registrarHumano(pid, cfgs[pid]);
    for (const j of grupos[pid]) j.nacion = pid;
  }
  const comun = crearComun();
  for (const pid in grupos) {
    const s = crearNacion(cfgs[pid], pid, comun);
    s.tokenGobierno = grupos[pid][0].token;
    s.oposicion = grupos[pid].slice(1).map(j => crearOpositor(j.token, j.perfil));
    usarNacion(s);
    relacionesIniciales(s);
    s.escanos = estimarVotos(s, false);
  }
  sincronizarNaciones(ESTADOS);
  sala.empezada = true;
  sala.mes = 0;
  nuevoTurno();
  difundir();
  entrarComoJugador(ESTADOS[miNacion()]);
}

const miNacion = () => {
  const j = RED.sala && RED.sala.jugadores.find(x => x.token === miToken());
  return j ? j.nacion : null;
};
const nacionDelJugador = j => (j && j.nacion ? ESTADOS[j.nacion] : null);

// Aplica una acción de un jugador a su nación y lo cuenta a todos. Quien gobierna usa las reglas
// normales; quien está en la oposición de un país compartido, solo las suyas.
function aplicarAccion(j, a, d) {
  const s = nacionDelJugador(j);
  if (!s || s.fin || a === 'mes') return;
  const gobierna = !s.tokenGobierno || s.tokenGobierno === j.token, o = opositorPorToken(s, j.token);
  if (gobierna ? !REGLAS[a] : !(o && REGLAS_OPOSICION[a])) return;
  try {
    usarNacion(s);
    if (gobierna) REGLAS[a](s, d); else REGLAS_OPOSICION[a](s, o, d);
    sincronizarNaciones(ESTADOS);
  } catch (e) {
    console.error('Error al aplicar', a, e);
  } finally {
    // Pase lo que pase, el anfitrión vuelve a ver desde su país y todos reciben el estado.
    volverAMiNacion();
    guardarSala();
    difundir();
  }
}

function volverAMiNacion() {
  const mia = ESTADOS[miNacion()];
  if (mia) usarNacion(mia);
}

// Jugadores que cuentan para pasar de mes: conectados y con su país aún en pie.
function jugadoresActivos() {
  return RED.sala.jugadores.filter(j => j.conectado && nacionDelJugador(j) && !nacionDelJugador(j).fin);
}

function nuevoTurno() {
  const sala = RED.sala, ms = sala.config.minutos * 60000;
  for (const j of sala.jugadores) j.listo = false;
  sala.pausada = false;
  sala.limite = Date.now() + ms;
  clearTimeout(RED.temporizador);
  RED.temporizador = setTimeout(avanzarMes, ms);
}

function comprobarTurno() {
  if (!RED.sala || !RED.sala.empezada) return difundir();
  const activos = jugadoresActivos();
  if (activos.length && activos.every(j => j.listo)) avanzarMes();
  else difundir();
}

function avanzarMes() {
  if (!RED.sala || !RED.sala.empezada) return;
  try { avanzarMesTodas(ESTADOS); } catch (e) { console.error('Error al pasar el mes', e); }
  RED.sala.mes++;
  volverAMiNacion();
  nuevoTurno();
  guardarSala();
  Sonido.tocar('mes');
  difundir();
}

// Lo que los invitados necesitan de los demás jugadores para pintarlos: nombre, color y bandera de su país.
function datosHumanos() {
  const h = {};
  for (const pid in ESTADOS) h[pid] = ESTADOS[pid].config;
  return h;
}

function salaPublica() {
  const s = RED.sala;
  return {
    codigo: s.codigo, owner: s.owner, empezada: s.empezada, config: s.config, mes: s.mes || 0, pausada: !!s.pausada, chat: s.chat || [],
    jugadores: s.jugadores.map(j => ({ token: j.token, perfil: j.perfil, conectado: j.conectado, nacion: j.nacion, listo: j.listo,
      fin: nacionDelJugador(j) ? nacionDelJugador(j).fin : null })),
  };
}

// Envía a cada invitado la sala y, si la partida ha empezado, su nación. Luego repinta la pantalla propia.
function difundir() {
  if (!soyAnfitrion()) return;
  const sala = salaPublica(), humanos = sala.empezada ? datosHumanos() : null;
  const restante = RED.sala.pausada ? RED.sala.restantePausa : Math.max(0, (RED.sala.limite || 0) - Date.now());
  RED.recibido = Date.now();
  RED.finTurno = Date.now() + restante;
  for (const j of RED.sala.jugadores) {
    const conn = RED.conexiones[j.token];
    if (!conn || !conn.open) continue;
    conn.send({ t: 'sala', sala, restante, yo: j.token });
    if (sala.empezada && nacionDelJugador(j)) conn.send({ t: 'estado', nacion: JSON.parse(JSON.stringify(nacionDelJugador(j))), humanos });
  }
  render();
}

// ---------- Guardar y reanudar (solo el anfitrión) ----------

function guardarSala() {
  if (!soyAnfitrion() || !RED.sala.empezada) return;
  try { localStorage.setItem(GUARDADO_MULTI, JSON.stringify({ sala: RED.sala, estados: ESTADOS })); } catch (e) { /* sin almacenamiento */ }
}
function salaGuardada() {
  try { return JSON.parse(localStorage.getItem(GUARDADO_MULTI)); } catch (e) { return null; }
}
function borrarSalaGuardada() { try { localStorage.removeItem(GUARDADO_MULTI); } catch (e) { /* sin almacenamiento */ } }

// Al guardar, lo compartido se copió una vez por nación: aquí vuelven a ser los mismos objetos.
function reanudarSala(g) {
  RED.sala = g.sala;
  const lista = Object.values(g.estados), comun = lista[0];
  prepararMundo(RED.sala.config, 0, comun.duenos);
  for (const k in ESTADOS) delete ESTADOS[k];
  for (const s of lista) {
    Object.assign(s, { mundo: comun.mundo, duenos: comun.duenos, ocupadas: comun.ocupadas });
    ESTADOS[s.nacion] = s;
    registrarHumano(s.nacion, s.config);
  }
  // Quien reanuda es el dueño de la sala aunque su navegador le haya dado otro identificador.
  const dueno = RED.sala.jugadores.find(j => j.token === RED.sala.owner);
  if (dueno && dueno.token !== miToken()) cambiarToken(dueno, miToken());
  for (const j of RED.sala.jugadores) j.conectado = j.token === miToken();
  for (const s of lista) enlazarNacion(s);
  sincronizarNaciones(ESTADOS);
  nuevoTurno();
  entrarComoJugador(ESTADOS[miNacion()]);
  difundir();
}

// ---------- Invitado ----------

function unirseASala(codigo) {
  cerrarRed();
  codigo = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(codigo)) return errorRed('El código tiene 5 letras o números.');
  RED.error = '';
  RED.estado = 'Conectando con la sala…';
  render();
  const peer = crearPeer();
  if (!peer) return;
  RED.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(PREFIJO_SALA + codigo, { reliable: true });
    RED.conexion = conn;
    conn.on('open', () => {
      RED.rol = 'invitado';
      RED.codigo = codigo;
      conn.send({ t: 'entrar', token: miToken(), perfil: perfilDe(ui.cfg) });
    });
    conn.on('data', alRecibirInvitado);
    conn.on('close', () => {
      if (RED.rol !== 'invitado') return;
      cerrarRed();
      salirAlMenu('multi');
      errorRed('Se ha perdido la conexión con el anfitrión. Si vuelve a abrir la sala, entra de nuevo con el mismo código.');
    });
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') errorRed('No hay ninguna sala abierta con ese código.');
    else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') errorRed('No se puede conectar con el servidor de PeerJS. Comprueba tu conexión a internet.');
    else errorRed(`Error de conexión: ${e.type}`);
  });
}

function alRecibirInvitado(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'error') { cerrarRed(); salirAlMenu('multi'); return errorRed(m.texto); }
  if (m.t === 'sala') {
    RED.sala = m.sala;
    RED.recibido = Date.now();
    // Si el anfitrión cambia de mapa, la elección de país se borra para todos.
    const clave = `${m.sala.config.semilla}|${m.sala.config.tamano}`;
    if (RED.claveMapa && RED.claveMapa !== clave) ui.cfg.nacion = null;
    RED.claveMapa = clave;
    RED.finTurno = Date.now() + (m.restante || 0);
    RED.estado = '';
    if (!m.sala.empezada && ui.pantalla !== 'sala') ui.pantalla = 'sala';
    render();
  }
  if (m.t === 'estado') recibirNacion(m.nacion, m.humanos);
}

// Monta (la primera vez) o actualiza el mundo y la nación propia con lo que manda el anfitrión.
function recibirNacion(s, humanos) {
  const primera = !estado || ui.pantalla !== 'juego' || estado.nacion !== s.nacion;
  if (primera) {
    for (const k in ESTADOS) delete ESTADOS[k];
    prepararMundo(RED.sala.config, 0, s.duenos);
    for (const pid in humanos) registrarHumano(pid, humanos[pid]);
  } else {
    for (const pid in humanos) registrarHumano(pid, humanos[pid]);
    let cambio = false;
    for (const id in s.duenos) if (PROV_POR_ID[id] && PROV_POR_ID[id].pais !== s.duenos[id]) { PROV_POR_ID[id].pais = s.duenos[id]; cambio = true; }
    if (cambio) recalcularFronteras();
  }
  ESTADOS[s.nacion] = s;
  enlazarNacion(s);
  usarNacion(s);
  if (primera) entrarComoJugador(s);
  else { estado = s; render(); }
}

// ---------- Lo que hace este jugador ----------

// Una acción de la partida: el anfitrión la aplica él mismo; el invitado se la manda.
function enviarAccion(a, d) {
  if (soyAnfitrion()) {
    const j = RED.sala.jugadores.find(x => x.token === miToken());
    aplicarAccion(j, a, d);
  } else if (RED.conexion && RED.conexion.open) RED.conexion.send({ t: 'accion', token: miToken(), a, d });
}

function enviarChat(texto) {
  texto = String(texto || '').trim();
  if (!texto) return;
  if (soyAnfitrion()) anotarChat(yoEnSala(), texto);
  else if (RED.conexion && RED.conexion.open) RED.conexion.send({ t: 'chat', token: miToken(), texto });
}

function enviarPerfil() {
  const perfil = perfilDe(ui.cfg);
  if (soyAnfitrion()) {
    const j = RED.sala.jugadores.find(x => x.token === miToken());
    if (j && !RED.sala.empezada) { j.perfil = perfil; difundir(); }
  } else if (RED.conexion && RED.conexion.open) RED.conexion.send({ t: 'perfil', token: miToken(), perfil });
}

const yoEnSala = () => RED.sala && RED.sala.jugadores.find(x => x.token === miToken());

function alternarListo() {
  const yo = yoEnSala();
  if (!yo) return;
  if (soyAnfitrion()) { yo.listo = !yo.listo; comprobarTurno(); } else if (RED.conexion) RED.conexion.send({ t: 'listo', token: miToken(), v: !yo.listo });
}

// Cuántos están listos de cuántos cuentan, y cuánto falta para que el mes pase solo.
function infoTurno() {
  const sala = RED.sala;
  if (!sala || !sala.empezada) return null;
  const activos = sala.jugadores.filter(j => j.conectado && j.nacion && !j.fin);
  return { listos: activos.filter(j => j.listo).length, total: activos.length, pausada: !!sala.pausada,
    restante: sala.pausada ? Math.max(0, RED.finTurno - RED.recibido) : Math.max(0, RED.finTurno - Date.now()) };
}

function cerrarRed() {
  clearTimeout(RED.temporizador);
  if (soyAnfitrion()) guardarSala();
  try { if (RED.peer) RED.peer.destroy(); } catch (e) { /* ya cerrado */ }
  Object.assign(RED, { rol: null, peer: null, conexion: null, conexiones: {}, codigo: '', sala: null, temporizador: null, estado: '' });
}

addEventListener('beforeunload', () => { if (soyAnfitrion()) guardarSala(); });
