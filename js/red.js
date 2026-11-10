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
const MAX_JUGADORES = { pequeno: 3, mediano: 4, grande: 6 };
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
  principios: [...c.principios], pais: c.pais, colorPais: c.colorPais,
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
      if (j) j.token = m.token;
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
}

function cambiarConfigSala(k, v) {
  const c = RED.sala.config;
  c[k] = k === 'legislatura' || k === 'minutos' || k === 'semilla' ? +v : v;
  difundir();
}

function puedeEmpezar() {
  const s = RED.sala;
  if (s.jugadores.length > MAX_JUGADORES[s.config.tamano]) return { ok: false, motivo: `En un mapa ${TAMANOS[s.config.tamano].nombre.toLowerCase()} caben ${MAX_JUGADORES[s.config.tamano]} jugadores` };
  return { ok: true };
}

// Crea el mundo y una nación para cada jugador. Si dos han elegido el mismo color, el segundo recibe otro.
function empezarPartida() {
  const sala = RED.sala;
  if (!puedeEmpezar().ok) return;
  const usados = new Set();
  for (const j of sala.jugadores) {
    if (usados.has(j.perfil.colorPais)) j.perfil.colorPais = COLORES_PAIS.find(c => !usados.has(c)) || j.perfil.colorPais;
    usados.add(j.perfil.colorPais);
  }
  for (const k in ESTADOS) delete ESTADOS[k];
  prepararMundo(sala.config, sala.jugadores.length);
  const cfgs = sala.jugadores.map((j, i) => {
    j.nacion = idHumano(i);
    const cfg = completarConfig({ ...sala.config, ...j.perfil });
    registrarHumano(j.nacion, cfg);
    return cfg;
  });
  const comun = crearComun();
  sala.jugadores.forEach((j, i) => crearNacion(cfgs[i], j.nacion, comun));
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

// Aplica una acción de un jugador a su nación y lo cuenta a todos.
function aplicarAccion(j, a, d) {
  const s = nacionDelJugador(j);
  if (!s || s.fin || !REGLAS[a] || a === 'mes') return;
  try {
    usarNacion(s);
    REGLAS[a](s, d);
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
  for (const j of RED.sala.jugadores) if (j.nacion) h[j.nacion] = completarConfig({ ...RED.sala.config, ...j.perfil });
  return h;
}

function salaPublica() {
  const s = RED.sala;
  return {
    codigo: s.codigo, owner: s.owner, empezada: s.empezada, config: s.config, mes: s.mes || 0,
    jugadores: s.jugadores.map(j => ({ token: j.token, perfil: j.perfil, conectado: j.conectado, nacion: j.nacion, listo: j.listo,
      fin: nacionDelJugador(j) ? nacionDelJugador(j).fin : null })),
  };
}

// Envía a cada invitado la sala y, si la partida ha empezado, su nación. Luego repinta la pantalla propia.
function difundir() {
  if (!soyAnfitrion()) return;
  const sala = salaPublica(), restante = Math.max(0, (RED.sala.limite || 0) - Date.now()), humanos = sala.empezada ? datosHumanos() : null;
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
  for (const j of RED.sala.jugadores) j.conectado = j.token === miToken();
  RED.sala.owner = miToken();
  const lista = Object.values(g.estados), comun = lista[0];
  prepararMundo(RED.sala.config, RED.sala.jugadores.length, comun.duenos);
  for (const k in ESTADOS) delete ESTADOS[k];
  for (const j of RED.sala.jugadores) registrarHumano(j.nacion, completarConfig({ ...RED.sala.config, ...j.perfil }));
  for (const s of lista) {
    Object.assign(s, { mundo: comun.mundo, duenos: comun.duenos, ocupadas: comun.ocupadas });
    ESTADOS[s.nacion] = s;
  }
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
    prepararMundo(RED.sala.config, Object.keys(humanos).length, s.duenos);
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
  return { listos: activos.filter(j => j.listo).length, total: activos.length, restante: Math.max(0, RED.finTurno - Date.now()) };
}

function cerrarRed() {
  clearTimeout(RED.temporizador);
  if (soyAnfitrion()) guardarSala();
  try { if (RED.peer) RED.peer.destroy(); } catch (e) { /* ya cerrado */ }
  Object.assign(RED, { rol: null, peer: null, conexion: null, conexiones: {}, codigo: '', sala: null, temporizador: null, estado: '' });
}

addEventListener('beforeunload', () => { if (soyAnfitrion()) guardarSala(); });
