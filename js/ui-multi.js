'use strict';
// Pantallas del multijugador: menú para crear o unirse, sala de espera, propuestas entre jugadores
// y el contador de «listos» con el tiempo que queda de mes.

const MINUTOS_TURNO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function mensajesRed() {
  return `${RED.estado ? `<p class="aviso-red">${ico('reloj')} ${esc(RED.estado)}</p>` : ''}${RED.error ? `<p class="error-red">${esc(RED.error)}</p>` : ''}`;
}

function htmlMenuMulti() {
  const g = salaGuardada();
  return `<button class="enlace" data-a="menuPrincipal">${ico('atras')} Volver al menú</button>
    <h2 class="menu-h2">Multijugador</h2>
    <p class="menu-lema">Todos conectados a la vez. Quien crea la sala la configura y comparte un código; los demás entran con él.</p>
    ${mensajesRed()}
    <nav class="menu-lista" aria-label="Multijugador">
      ${botonMenu({ a: 'crearSala' }, 'usuario', 'Crear una sala', 'Serás el anfitrión: la partida vive en tu navegador', 'destacado')}
      ${g && g.sala ? botonMenu({ a: 'reanudarSala' }, 'play', 'Reanudar tu sala', `Código ${esc(g.sala.codigo)}, ${plural(g.sala.jugadores.length, 'jugador', 'jugadores')}, mes ${g.sala.mes || 0}`) : ''}
    </nav>
    <div class="campo unirse"><span>Unirse con un código</span><div class="semilla">
      <input id="codigo-sala" maxlength="5" placeholder="Código de 5 letras" autocomplete="off" autocapitalize="characters" value="${esc(ui.codigoSala || '')}">
      <button class="btn laton" data-a="unirse">Entrar</button></div></div>
    <p class="menu-pie">Si se cae la conexión, vuelve a entrar con el mismo código y el mismo nombre: recuperas tu país.</p>`;
}

// ---------- Sala de espera ----------

function botonesSala(k, valores, actual, cls = '') {
  return `<div class="dificultades ${cls}">${Object.keys(valores).map(v => `<button class="dificultad ${String(actual) === v ? 'activa' : ''}"
    data-a="salaCfg" data-k="${k}" data-v="${v}" aria-pressed="${String(actual) === v}"><b>${valores[v].nombre}</b><small>${valores[v].desc}</small></button>`).join('')}</div>`;
}

function configSala(c, anfitrion) {
  if (!anfitrion) {
    const fila = (k, v) => `<div class="fila-sala"><span>${k}</span><b>${v}</b></div>`;
    return `${fila('Cómo se empieza', MODOS_JUEGO[c.modo].nombre)}${fila('Dificultad', DIFICULTADES[c.dificultad].nombre)}
      ${fila('Mapa', `${TAMANOS[c.tamano].nombre}, número ${c.semilla}`)}${fila('Elecciones', `cada ${c.legislatura} meses`)}
      ${fila('Partidos por país', c.nPartidos || 5)}${fila('Tiempo por mes', plural(c.minutos, 'minuto', 'minutos'))}`;
  }
  const segmento = (k, valores, actual) => `<div class="segmento oscuro">${valores.map(([v, t]) =>
    `<button class="${String(actual) === String(v) ? 'activa' : ''}" data-a="salaCfg" data-k="${k}" data-v="${v}" aria-pressed="${String(actual) === String(v)}">${t}</button>`).join('')}</div>`;
  return `<div class="campo"><span>Cómo empieza cada jugador</span>${botonesSala('modo', MODOS_JUEGO, c.modo, 'dos')}</div>
    <div class="campo"><span>Dificultad</span>${botonesSala('dificultad', DIFICULTADES, c.dificultad)}</div>
    <div class="campo"><span>Tamaño del mundo</span>${botonesSala('tamano', TAMANOS, c.tamano)}</div>
    <div class="campo"><span>Mapa número ${c.semilla}</span><button class="btn claro" data-a="otroMapaSala">${ico('mapa')} Generar otro</button></div>
    <div class="campo"><span>Partidos en cada parlamento (más los propios de los jugadores)</span>${segmento('nPartidos', Object.keys(NUM_PARTIDOS).map(n => [n, `${n}`]), c.nPartidos || 5)}</div>
    <div class="campo"><span>Elecciones cada</span>${segmento('legislatura', Object.keys(LEGISLATURAS).map(n => [n, `${n} meses`]), c.legislatura)}</div>
    <div class="campo"><span>Tiempo máximo por mes: si se acaba, el mes pasa aunque falte alguien</span>
      ${segmento('minutos', MINUTOS_TURNO.map(n => [n, `${n} min`]), c.minutos)}</div>`;
}

function filaJugador(j, sala) {
  const p = j.perfil, info = completarConfig(p), etiquetas = [];
  if (j.token === sala.owner) etiquetas.push(chip('anfitrión'));
  if (j.token === miToken()) etiquetas.push(chip('tú', 'pos'));
  if (!j.conectado) etiquetas.push(chip('desconectado', 'neg'));
  return `<li>${logoPartido({ color: info.color, emblema: info.emblema })}
    <div><b>${esc(p.lider)}</b><small>${esc(info.partido)}, en ${esc(p.pais)} <i class="punto-color" style="background:${p.colorPais}"></i></small></div>
    <span class="chips">${etiquetas.join('')}</span></li>`;
}

function htmlSalaIzquierda() {
  const sala = RED.sala;
  if (!sala) return `<h2 class="menu-h2">Sala</h2>${mensajesRed()}`;
  const anfitrion = soyAnfitrion(), max = MAX_JUGADORES[sala.config.tamano];
  const empezar = anfitrion
    ? boton(`${ico('play')} Empezar la partida`, { a: 'empezarSala' }, puedeEmpezar(), 'laton grande')
    : `<p class="aviso-red">${ico('reloj')} ${sala.empezada ? 'La partida está empezando…' : 'Esperando a que el anfitrión empiece la partida.'}</p>`;
  return `<button class="enlace" data-a="salirSala">${ico('atras')} Salir de la sala</button>
    <h2 class="menu-h2">Sala de juego</h2>
    <div class="codigo-sala"><span>Código</span><b>${esc(sala.codigo)}</b>
      <button class="btn claro mini" data-a="copiarCodigo">Copiar</button></div>
    <p class="campo-nota">Pásaselo a tus amigos: entran desde Multijugador, «Unirse con un código».</p>
    ${mensajesRed()}
    <h3 class="sobre-sala">Jugadores <span class="cuenta">${sala.jugadores.length} de ${max}</span></h3>
    <ul class="lista-jugadores">${sala.jugadores.map(j => filaJugador(j, sala)).join('')}</ul>
    <h3 class="sobre-sala">Partida ${anfitrion ? '' : '<span class="cuenta">la configura el anfitrión</span>'}</h3>
    ${configSala(sala.config, anfitrion)}
    <div class="botones-paso">${empezar}</div>`;
}

// El mundo de la sala, generado con la configuración del anfitrión, para elegir país en él.
function mundoSala() {
  const c = RED.sala.config, clave = `${c.semilla}|${c.tamano}`;
  if (ui.salaMundo !== clave) {
    generarMundo(c.semilla, c.tamano, 0);
    ui.salaMundo = clave;
    ui.vistaClave = null;
  }
}

// Mapa de la sala: cada país con el color de quien lo gobierna (si alguien lo ha elegido) y sus jugadores.
function htmlMapaSala() {
  mundoSala();
  const grupos = jugadoresPorPais(RED.sala.jugadores), mio = ui.cfg.nacion, [x, y, w, h] = GEO.viewBox;
  let formas = '', rotulos = '';
  for (const p of PROVINCIAS) {
    const g = grupos[p.pais], col = g ? g[0].perfil.colorPais : NACIONES[p.pais].color;
    formas += `<path class="prov-sala ${g ? 'elegido' : ''}" d="${GEO.provs[p.id].d}" fill="${col}" stroke="${col}" data-a="elegirPais" data-v="${p.pais}"><title>${esc(NACIONES[p.pais].nombre)}: pulsa para elegirlo</title></path>`;
  }
  for (const pid in GEO.paises) {
    const g = GEO.paises[pid], grupo = grupos[pid];
    const nombre = grupo ? grupo[0].perfil.pais : NACIONES[pid].nombre;
    rotulos += `<text class="lbl-pais ${grupo ? 'propio' : ''}" x="${g.cx}" y="${g.cy}">${esc(nombre.toUpperCase())}</text>`;
    if (grupo) rotulos += `<text class="lbl-jugadores" x="${g.cx}" y="${g.cy + 16}">${esc(grupo.map(j => j.perfil.lider).join(', '))}</text>`;
  }
  const sel = mio && GEO.paises[mio] ? `<path class="f-sel" d="${GEO.paises[mio].contorno}"/>` : '';
  const P = mio && NACIONES[mio];
  return `<svg class="vista-mundo mapa-sala" viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="Mapa para elegir país">
      <rect class="vm-mar" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>${formas}
      <path class="f-prov" d="${GEO.fronteraProv}"/><path class="f-costa" d="${GEO.costa}"/><path class="f-pais" d="${GEO.fronteraPais}"/>${sel}${rotulos}</svg>
    <p class="vista-pie">${P ? `Has elegido ${esc(P.nombre)}: ${plural(provinciasDe(mio).length, 'provincia', 'provincias')}, ${P.gobierno.toLowerCase()}.`
      : `Pulsa un país del mapa para elegirlo. Hay ${Object.keys(NACIONES).length} y varios jugadores pueden compartir uno.`}</p>`;
}

// Qué te va a tocar en el país que has elegido: gobernarlo o hacer oposición.
function situacionEnPais() {
  const mio = ui.cfg.nacion;
  if (!mio) return '';
  const otros = jugadoresPorPais(RED.sala.jugadores.filter(j => j.token !== miToken()))[mio] || [];
  const yo = RED.sala.jugadores.findIndex(j => j.token === miToken());
  const antes = otros.filter(j => RED.sala.jugadores.indexOf(j) < yo);
  const choque = !ui.cfg.propio && otros.find(j => !j.perfil.propio && j.perfil.partidoId === ui.cfg.partidoId);
  if (choque) return `<p class="error-red">${esc(choque.perfil.lider)} ya está en este país con ${esc(CATALOGO_PARTIDOS[ui.cfg.partidoId].nombre)}. Únete a otro o crea el tuyo para poder empezar.</p>`;
  if (!antes.length) return `<p class="aviso-red">${ico('corona')} Gobernarás tú este país${otros.length ? `. ${esc(otros.map(j => j.perfil.lider).join(' y '))} hará${otros.length > 1 ? 'n' : ''} oposición` : ''}.</p>`;
  return `<p class="aviso-red">${ico('parlamento')} Gobierna ${esc(antes[0].perfil.lider)}: tú serás la oposición, con tu propio partido. Si ganas unas elecciones, pasas a gobernar.</p>`;
}

function htmlSalaPerfil() {
  const c = ui.cfg, mio = c.nacion, otros = mio ? jugadoresPorPais(RED.sala.jugadores.filter(j => j.token !== miToken()))[mio] : null;
  const yo = RED.sala.jugadores.findIndex(j => j.token === miToken());
  const gobernare = mio && !(otros || []).some(j => RED.sala.jugadores.indexOf(j) < yo);
  return `<div class="perfil-sala">
    <h2 class="menu-h2">Elige país</h2>
    ${htmlMapaSala()}
    ${situacionEnPais()}
    <h2 class="menu-h2">Tu personaje</h2>
    <label class="campo"><span>Tu nombre</span><input id="cfg-lider" maxlength="24" value="${esc(c.lider)}" autocomplete="off"></label>
    ${pasoPartido(c)}
    ${gobernare ? `<label class="campo"><span>Nombre de tu país</span><input id="cfg-pais" maxlength="18" value="${esc(c.pais)}" autocomplete="off"></label>
    <div class="campo"><span>Color de tu país en el mapa</span><div class="opciones-fila">
      ${COLORES_PAIS.map(col => `<button class="muestra ${col === c.colorPais ? 'activa' : ''}" data-a="cfg" data-k="colorPais" data-v="${col}" style="background:${col}" aria-label="Color ${col}" aria-pressed="${col === c.colorPais}"></button>`).join('')}
    </div></div>` : mio ? '<p class="campo-nota">El nombre y el color del país los elige quien lo gobierna.</p>' : ''}
    <p class="campo-nota">Los cambios llegan a los demás al momento.</p>
  </div>`;
}

function renderSala() {
  const caja = $('#menu-caja'), hero = $('#menu-hero');
  ponerHTML(caja, htmlSalaIzquierda());
  caja.classList.add('formulario');
  // Mientras escribes en un campo del perfil no se redibuja, para no quitarte el cursor.
  const escribiendo = document.activeElement && document.activeElement.tagName === 'INPUT' && hero.contains(document.activeElement);
  if (!escribiendo) ponerHTML(hero, htmlSalaPerfil());
}

// ---------- Dentro de la partida ----------

function htmlPropuesta() {
  const pr = estado.propuestas[0], P = PAISES[pr.de] || {};
  const detalle = {
    tratado: `Comerciaríais entre vosotros: ganarías ${P.comercio || 30} al mes, y ${esc(pr.nombre)} también.`,
    alianza: 'Os defenderíais el uno al otro si alguien os ataca, y tu país ganaría estabilidad.',
    paz: esc(pr.texto || 'Acabaría la guerra entre vosotros.'),
  }[pr.tipo];
  const icono = { tratado: 'moneda', alianza: 'escudo', paz: 'bandera' }[pr.tipo];
  return `<div class="ev-cab"><span class="ev-ico">${ico(icono)}</span><h2>${esc(pr.nombre)} te propone ${TEXTO_PROPUESTA[pr.tipo]}</h2></div>
    <p>${detalle}</p>
    ${P.lider ? `<p class="nota">${bandera(pr.de)} Lo dirige ${esc(P.lider)}.${estado.propuestas.length > 1 ? ` Tienes ${estado.propuestas.length - 1} propuesta(s) más esperando.` : ''}</p>` : ''}
    <div class="botones"><button class="btn principal" data-a="responder" data-i="0" data-v="si">Aceptar</button>
      <button class="btn" data-a="responder" data-i="0" data-v="no">Rechazar</button></div>`;
}

const reloj = ms => { const seg = Math.ceil(ms / 1000); return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`; };

// Botón de pasar de mes: en solitario lo pasa; en multijugador marca que estás listo.
function renderTurno() {
  const b = $('#btn-mes'), caja = $('#turno'), lista = $('#jugadores'), t = enRed() ? infoTurno() : null;
  if (!t) {
    caja.hidden = true;
    lista.hidden = true;
    b.classList.remove('esperando');
    ponerHTML(b, `Siguiente mes ${ico('play')}`);
    return;
  }
  const yo = yoEnSala(), listo = !!(yo && yo.listo);
  caja.hidden = false;
  b.classList.toggle('esperando', listo);
  ponerHTML(b, listo ? `Esperando ${t.listos}/${t.total} ${ico('reloj')}` : `Listo ${t.listos}/${t.total} ${ico('check')}`);
  b.title = listo ? 'Pulsa para dejar de estar listo' : 'Cuando todos estén listos, pasa el mes';
  b.disabled = !!estado.fin || (!listo && !esOposicion() && hayAlgoPendiente(estado));
  actualizarReloj();
  lista.hidden = false;
  const controles = soyAnfitrion() ? `<div class="botones">
      <button class="btn mini claro" data-a="pausa">${ico(t.pausada ? 'play' : 'reloj')} ${t.pausada ? 'Reanudar el reloj' : 'Pausar el reloj'}</button>
      <button class="btn mini claro" data-a="pasarYa">${ico('flecha')} Pasar el mes ya</button></div>` : '';
  ponerHTML(lista, `<h3>${ico('gente')} Jugadores <span class="cuenta">${t.listos} de ${t.total} listos</span></h3>
    <ul class="jugadores-partida">${RED.sala.jugadores.map(j => {
      const mismo = j.nacion === estado.nacion;
      const P = mismo ? { nombre: PAIS_JUGADOR.nombre, color: PAIS_JUGADOR.colores[0] } : (PAISES[j.nacion] || {});
      const situacion = j.fin ? chip(j.fin === 'victoria' ? 'ha ganado' : 'eliminado', j.fin === 'victoria' ? 'pos' : 'neg')
        : !j.conectado ? chip('desconectado', 'neg') : j.listo ? chip('listo', 'pos') : chip('pensando');
      // De los demás países se ve su tamaño y su ejército; de tu país, si gobierna o hace oposición.
      const detalle = mismo ? (estado.tokenGobierno === j.token ? 'gobierna' : 'oposición')
        : j.nacion ? `${provinciasDe(j.nacion).length} prov., ejército ${estado.paises[j.nacion] ? estado.paises[j.nacion].ejercito : '?'}` : '';
      return `<li><i class="punto-color" style="background:${P.color || '#999'}"></i><b>${esc(j.perfil.lider)}</b>
        <span>${esc(P.nombre || j.perfil.pais)}${detalle ? ` · ${detalle}` : ''}</span>${situacion}</li>`;
    }).join('')}</ul>${controles}`);
}

// Chat de la sala: un botón fijo abajo a la derecha que abre los mensajes.
function renderChat() {
  const caja = $('#chat'), sala = RED.sala, visible = enRed() && !!sala;
  caja.hidden = !visible;
  if (!visible) return;
  const mensajes = sala.chat || [];
  if (ui.chatAbierto) ui.chatVistos = mensajes.length;
  const nuevos = mensajes.length - (ui.chatVistos || 0);
  ponerHTML($('#chat-boton'), `${ico('charla')} Chat${nuevos > 0 ? ` <b class="chat-nuevos">${nuevos}</b>` : ''}`);
  $('#chat-panel').hidden = !ui.chatAbierto;
  const listaChat = $('#chat-lista');
  const cambio = ponerHTML(listaChat, mensajes.length ? mensajes.map(m => `<p><b style="color:${m.color}">${esc(m.de)}</b> ${esc(m.texto)}</p>`).join('')
    : '<p class="nota">Aún no hay mensajes. Saluda, pacta o amenaza.</p>');
  if (cambio) listaChat.scrollTop = listaChat.scrollHeight;
  if (nuevos > 0 && !ui.chatAbierto && ui.chatAvisados !== mensajes.length) {
    ui.chatAvisados = mensajes.length;
    Sonido.tocar('pestana');
  }
}

function actualizarReloj() {
  const t = enRed() ? infoTurno() : null, caja = $('#turno');
  if (!t || !caja) return;
  ponerHTML(caja, `${ico('reloj')}<span>${t.pausada ? 'En pausa' : reloj(t.restante)}</span>`);
  caja.classList.toggle('urgente', !t.pausada && t.restante < 30000);
  caja.title = `Mes ${fecha(estado ? estado.mes : 0)}: quedan ${reloj(t.restante)} para que pase solo`;
}
setInterval(() => { if (enRed() && ui.pantalla === 'juego') actualizarReloj(); }, 1000);

// Al recibir cambios en multijugador: avisos de lo nuevo (noticias, objetivos, decisiones pendientes).
function avisosDeRed() {
  const s = estado, u = ui.ultimo;
  const pendiente = !!(s.evento || s.votacion || s.propuestas.length);
  const hechos = new Set(Object.keys(s.objetivos));
  if (u && u.nacion === s.nacion) {
    const nuevas = s.nNoticias - u.nNoticias;
    if (nuevas > 0) {
      s.noticias.slice(0, Math.min(nuevas, s.noticias.length)).filter(n => n.tipo).slice(0, 3).reverse()
        .forEach(n => aviso(esc(n.texto), n.tipo, n.tipo === 'bien' ? 'check' : n.tipo === 'mundo' ? 'globo' : 'periodico'));
    }
    for (const o of objetivosActuales(s)) if (hechos.has(o.id) && !u.hechos.has(o.id)) { aviso(`Objetivo cumplido: ${o.texto}`, 'logro', 'diana'); Sonido.tocar('logro'); }
    if (!u.pendiente && pendiente) setTimeout(() => Sonido.tocar('evento'), 220);
  }
  ui.ultimo = { nacion: s.nacion, nNoticias: s.nNoticias, hechos, pendiente };
}

// Entra a la partida (multijugador) con la nación de este jugador. La bienvenida, solo al empezar.
function entrarComoJugador(s) {
  usarNacion(s);
  estado = s;
  entrarJuego();
  ui.ventana = s.mes === 0 ? 'intro' : null;
  ui.ultimo = null;
  render();
}

// menu: 'multi' cuando se sale por un problema de conexión, para que se vea el aviso.
function salirAlMenu(menu = 'principal') {
  estado = null;
  irAlMenu(menu);
  render();
}
