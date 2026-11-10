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
      ${fila('Tiempo por mes', plural(c.minutos, 'minuto', 'minutos'))}`;
  }
  const segmento = (k, valores, actual) => `<div class="segmento oscuro">${valores.map(([v, t]) =>
    `<button class="${String(actual) === String(v) ? 'activa' : ''}" data-a="salaCfg" data-k="${k}" data-v="${v}" aria-pressed="${String(actual) === String(v)}">${t}</button>`).join('')}</div>`;
  return `<div class="campo"><span>Cómo empieza cada jugador</span>${botonesSala('modo', MODOS_JUEGO, c.modo, 'dos')}</div>
    <div class="campo"><span>Dificultad</span>${botonesSala('dificultad', DIFICULTADES, c.dificultad)}</div>
    <div class="campo"><span>Tamaño del mundo</span>${botonesSala('tamano', TAMANOS, c.tamano)}</div>
    <div class="campo"><span>Mapa número ${c.semilla}</span><button class="btn claro" data-a="otroMapaSala">${ico('mapa')} Generar otro</button></div>
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

function htmlSalaPerfil() {
  const c = ui.cfg;
  return `<div class="perfil-sala">
    <h2 class="menu-h2">Tu personaje</h2>
    <label class="campo"><span>Tu nombre</span><input id="cfg-lider" maxlength="24" value="${esc(c.lider)}" autocomplete="off"></label>
    ${pasoPartido(c)}
    <label class="campo"><span>Nombre de tu país</span><input id="cfg-pais" maxlength="18" value="${esc(c.pais)}" autocomplete="off"></label>
    <div class="campo"><span>Color de tu país en el mapa</span><div class="opciones-fila">
      ${COLORES_PAIS.map(col => `<button class="muestra ${col === c.colorPais ? 'activa' : ''}" data-a="cfg" data-k="colorPais" data-v="${col}" style="background:${col}" aria-label="Color ${col}" aria-pressed="${col === c.colorPais}"></button>`).join('')}
    </div></div>
    <p class="campo-nota">Los cambios llegan a los demás al momento. Si dos elegís el mismo color de país, al empezar se le cambia a uno.</p>
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
  b.disabled = !!estado.fin || (!listo && hayAlgoPendiente(estado));
  actualizarReloj();
  lista.hidden = false;
  ponerHTML(lista, `<h3>${ico('gente')} Jugadores <span class="cuenta">${t.listos} de ${t.total} listos</span></h3>
    <ul class="jugadores-partida">${RED.sala.jugadores.map(j => {
      const P = j.nacion === estado.nacion ? { nombre: PAIS_JUGADOR.nombre, color: PAIS_JUGADOR.colores[0] } : (PAISES[j.nacion] || {});
      const situacion = j.fin ? chip(j.fin === 'victoria' ? 'ha ganado' : 'eliminado', j.fin === 'victoria' ? 'pos' : 'neg')
        : !j.conectado ? chip('desconectado', 'neg') : j.listo ? chip('listo', 'pos') : chip('pensando');
      return `<li><i class="punto-color" style="background:${P.color || '#999'}"></i><b>${esc(j.perfil.lider)}</b>
        <span>${esc(P.nombre || j.perfil.pais)}</span>${situacion}</li>`;
    }).join('')}</ul>`);
}

function actualizarReloj() {
  const t = enRed() ? infoTurno() : null, caja = $('#turno');
  if (!t || !caja) return;
  ponerHTML(caja, `${ico('reloj')}<span>${reloj(t.restante)}</span>`);
  caja.classList.toggle('urgente', t.restante < 30000);
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
