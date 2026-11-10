'use strict';
// Menú principal, creación de partida y ventanas comunes (opciones, ayuda, multijugador).

// Hemiciclo grande del menú: los escaños se van ocupando de izquierda a derecha al cargar.
function heroHemiciclo(colorCentro) {
  const filas = [17, 21, 25, 29, 33], asientos = [];
  filas.forEach((n, i) => {
    const radio = 92 + i * 27;
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (Math.PI * k) / (n - 1);
      asientos.push({ a, x: 240 + radio * Math.cos(a), y: 232 - radio * Math.sin(a) });
    }
  });
  asientos.sort((p, q) => q.a - p.a);
  const bloques = [[PARTIDOS.fo.color, 0.28], [PARTIDOS.va.color, 0.1], [colorCentro, 0.34], [PARTIDOS.ac.color, 0.28]];
  let hasta = 0, i = 0, html = '';
  for (const [color, parte] of bloques) {
    hasta += parte * asientos.length;
    for (; i < Math.round(hasta); i++) {
      const p = asientos[i];
      html += `<circle class="hero-esc" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8" style="--c:${color};animation-delay:${200 + i * 9}ms"/>`;
    }
  }
  return `<svg class="hero" viewBox="0 0 480 252" aria-hidden="true">${html}
    <path class="hero-tribuna" d="M214 232v-22h52v22z"/><path class="hero-suelo" d="M20 246h440"/></svg>`;
}

// Vista previa del mundo que saldrá con la semilla y el tamaño elegidos.
function vistaMundo() {
  const c = ui.cfg, clave = `${c.semilla}|${c.tamano}|${c.colorPais}`;
  if (ui.vistaClave !== clave) {
    PAIS_JUGADOR.colores = tonosPais(c.colorPais);
    generarMundo(c.semilla, c.tamano);
    ui.vistaClave = clave;
  }
  const [x, y, w, h] = GEO.viewBox;
  let formas = '', rotulos = '';
  PROVINCIAS.forEach((p, i) => {
    const col = p.pais === PAIS_JUGADOR.id ? PAIS_JUGADOR.colores[i % 3] : PAISES[p.pais].color;
    formas += `<path d="${GEO.provs[p.id].d}" fill="${col}" stroke="${col}" stroke-width=".9"/>`;
  });
  for (const pid in GEO.paises) {
    const g = GEO.paises[pid], nombre = pid === PAIS_JUGADOR.id ? (c.pais.trim() || 'Tu país') : PAISES[pid].nombre;
    rotulos += `<text class="lbl-pais ${pid === PAIS_JUGADOR.id ? 'propio' : ''}" x="${g.cx}" y="${g.cy + 5}">${esc(nombre.toUpperCase())}</text>`;
  }
  const ids = Object.keys(PAISES), islas = ids.filter(pid => PAISES[pid].isla).length;
  const tocan = ids.filter(pid => provinciasJugador().some(p => GEO.vecinos[p.id].some(v => PROV_POR_ID[v].pais === pid))).length;
  return `<svg class="vista-mundo" viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="Vista previa del mapa">
      <rect class="vm-mar" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>${formas}
      <path class="f-prov" d="${GEO.fronteraProv}"/><path class="f-costa" d="${GEO.costa}"/><path class="f-pais" d="${GEO.fronteraPais}"/>${rotulos}</svg>
    <p class="vista-pie">${provinciasJugador().length} provincias tuyas, ${provinciasJugador().filter(p => GEO.provs[p.id].costera).length} con costa.
      ${ids.length} países más: ${tocan} hacen frontera contigo y ${islas} ${islas === 1 ? 'vive' : 'viven'} en islas.</p>`;
}

function botonMenu(datos, icono, titulo, sub, cls = '') {
  const attrs = Object.entries(datos).map(([k, v]) => `data-${k}="${v}"`).join(' ');
  return `<button class="menu-btn ${cls}" ${attrs}>${ico(icono)}<span class="menu-btn-txt"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
}

function htmlMenuPrincipal() {
  const g = cargar();
  const continuar = g && !g.fin
    ? botonMenu({ a: 'continuar' }, 'play', 'Continuar partida', `${esc(g.config.partido)} en ${esc(g.config.pais)}, ${fecha(g.mes)}`, 'destacado') : '';
  return `<div class="menu-titulo">
      <h1>Parlamento y&nbsp;Diplomacia</h1>
      <p class="menu-lema">Gobierna tu país, negocia cada ley, defiende tus fronteras y sobrevive a las urnas.</p>
    </div>
    <nav class="menu-lista" aria-label="Menú principal">
      ${continuar}
      ${botonMenu({ a: 'menuNueva' }, 'usuario', 'Un jugador', 'Partida nueva contra la IA', continuar ? '' : 'destacado')}
      ${botonMenu({ a: 'menuMulti' }, 'gente', 'Multijugador', 'En directo con amigos, con un código de sala')}
      ${botonMenu({ a: 'abrir', v: 'ayuda' }, 'ayuda', 'Cómo se juega')}
      ${botonMenu({ a: 'abrir', v: 'opciones' }, 'engranaje', 'Opciones')}
    </nav>
    <p class="menu-pie">Versión ${VERSION}, prototipo</p>`;
}

// ---------- Partida nueva, en tres pasos ----------

const PASOS_NUEVA = ['Tú', 'Tu partido', 'Tu país'];

// Tarjetas para elegir una opción entre varias. valor actual → tarjeta marcada.
function tarjetasOpcion(k, opciones, actual, cls = '') {
  return `<div class="dificultades ${cls}">${Object.keys(opciones).map(v => `<button class="dificultad ${String(actual) === v ? 'activa' : ''}"
    data-a="cfg" data-k="${k}" data-v="${v}" aria-pressed="${String(actual) === v}"><b>${opciones[v].nombre}</b><small>${opciones[v].desc}</small></button>`).join('')}</div>`;
}

function pasoTu(c) {
  return `<div class="campo"><span>Cómo empiezas</span>${tarjetasOpcion('modo', MODOS_JUEGO, c.modo, 'dos')}</div>
    <label class="campo"><span>Tu nombre</span><input id="cfg-lider" maxlength="24" value="${esc(c.lider)}" autocomplete="off"></label>
    <div class="campo"><span>Dificultad</span>${tarjetasOpcion('dificultad', DIFICULTADES, c.dificultad)}</div>
    <div class="campo"><span>Cada cuánto hay elecciones</span><div class="segmento oscuro">
      ${Object.keys(LEGISLATURAS).map(n => `<button class="${c.legislatura === +n ? 'activa' : ''}" data-a="cfg" data-k="legislatura" data-v="${n}" aria-pressed="${c.legislatura === +n}">${LEGISLATURAS[n]}</button>`).join('')}
    </div></div>`;
}

function pasoPartido(c) {
  const eleccion = `<div class="campo"><span>Tu partido</span><div class="dificultades dos">
      <button class="dificultad ${c.propio ? 'activa' : ''}" data-a="cfg" data-k="propio" data-v="1" aria-pressed="${c.propio}"><b>Crear el tuyo</b><small>Eliges nombre, símbolos e ideología.</small></button>
      <button class="dificultad ${c.propio ? '' : 'activa'}" data-a="cfg" data-k="propio" data-v="0" aria-pressed="${!c.propio}"><b>Unirte a uno que ya existe</b><small>Heredas sus votantes y sus ideas.</small></button>
    </div></div>`;
  if (!c.propio) {
    return `${eleccion}<div class="campo"><span>A cuál te unes</span><div class="lista-partidos">
      ${Object.keys(PARTIDOS).map(pid => {
        const P = PARTIDOS[pid], ideas = Object.keys(P.afinidad).filter(t => P.afinidad[t] > 0).map(t => ETIQUETAS[t]).join(', ') || 'Centro';
        return `<button class="partido-op ${c.partidoId === pid ? 'activa' : ''}" data-a="cfg" data-k="partidoId" data-v="${pid}" aria-pressed="${c.partidoId === pid}">
          ${logoPartido(P)}<span><b>${P.nombre}</b><small>${P.lema}</small><small>Le gustan las leyes de: ${ideas}</small></span></button>`;
      }).join('')}</div></div>`;
  }
  const favorece = g => c.principios.reduce((a, t) => a + (PRINCIPIOS[t].grupos[g] || 0), 0);
  const tiron = Object.keys(GRUPOS).map(g => {
    const v = favorece(g);
    return v ? chip(`${GRUPOS[g].nombre}: ${v > 0 ? 'más' : 'menos'} tirón`, v > 0 ? 'pos' : 'neg') : '';
  }).join('');
  return `${eleccion}
    <div class="vista-partido">${logoPartido({ color: c.color, emblema: c.emblema }, 'grande')}
      <div><b id="vp-partido">${esc(c.partido)}</b><span id="vp-lider">Lo lidera ${esc(c.lider)}</span></div></div>
    <label class="campo"><span>Nombre del partido</span><input id="cfg-partido" maxlength="28" value="${esc(c.partido)}" autocomplete="off"></label>
    <div class="campo"><span>Color</span><div class="opciones-fila">
      ${COLORES_PARTIDO.map(col => `<button class="muestra ${col === c.color ? 'activa' : ''}" data-a="cfg" data-k="color" data-v="${col}" style="background:${col}" aria-label="Color ${col}" aria-pressed="${col === c.color}"></button>`).join('')}
    </div></div>
    <div class="campo"><span>Emblema</span><div class="opciones-fila">
      ${EMBLEMAS.map(e => `<button class="muestra emblema ${e === c.emblema ? 'activa' : ''}" data-a="cfg" data-k="emblema" data-v="${e}" aria-label="Emblema ${e}" aria-pressed="${e === c.emblema}">${ico(e)}</button>`).join('')}
    </div></div>
    <div class="campo"><span>Ideología: hasta ${MAX_PRINCIPIOS} principios, o ninguno si es de centro</span><div class="principios">
      ${Object.keys(PRINCIPIOS).map(t => {
        const activo = c.principios.includes(t), opuesto = PRINCIPIOS[t].opuesto;
        const bloqueado = !activo && (c.principios.length >= MAX_PRINCIPIOS || c.principios.includes(opuesto));
        return `<button class="principio ${activo ? 'activa' : ''}" data-a="cfgPrincipio" data-v="${t}" aria-pressed="${activo}" ${bloqueado ? 'disabled' : ''}>
          <b>${ETIQUETAS[t]}</b><small>${PRINCIPIOS[t].desc}</small></button>`;
      }).join('')}</div>
      <div class="chips">${tiron || chip('Sin principios: igual de tirón en todos los grupos')}</div>
      <p class="campo-nota">Las leyes de tus principios te salen más fáciles en el partido. Las que los contradicen cuestan 1 de capital político más.</p></div>`;
}

function pasoPais(c) {
  return `<label class="campo"><span>Nombre de tu país</span><input id="cfg-pais" maxlength="18" value="${esc(c.pais)}" autocomplete="off"></label>
    <div class="campo"><span>Su color en el mapa</span><div class="opciones-fila">
      ${COLORES_PAIS.map(col => `<button class="muestra ${col === c.colorPais ? 'activa' : ''}" data-a="cfg" data-k="colorPais" data-v="${col}" style="background:${col}" aria-label="Color ${col}" aria-pressed="${col === c.colorPais}"></button>`).join('')}
    </div></div>
    <div class="campo"><span>Tamaño del mundo</span>${tarjetasOpcion('tamano', TAMANOS, c.tamano)}</div>
    <div class="campo"><span>Mapa: cada número da un mundo distinto</span><div class="semilla">
      <input id="cfg-semilla" inputmode="numeric" maxlength="7" value="${c.semilla}" aria-label="Número del mapa">
      <button class="btn claro" data-a="otroMapa">${ico('mapa')} Generar otro</button></div></div>`;
}

function htmlNuevaPartida() {
  const c = ui.cfg, paso = ui.paso;
  const pasos = PASOS_NUEVA.map((nombre, i) => `<li class="${i + 1 < paso ? 'hecho' : ''} ${i + 1 === paso ? 'actual' : ''}">
    <button data-a="paso" data-v="${i + 1}" aria-current="${i + 1 === paso ? 'step' : 'false'}"><i>${i + 1 < paso ? ico('check') : ''}</i><span>${nombre}</span></button></li>`).join('');
  const cuerpo = paso === 1 ? pasoTu(c) : paso === 2 ? pasoPartido(c) : pasoPais(c);
  const final = paso === PASOS_NUEVA.length;
  return `<button class="enlace" data-a="menuPrincipal">${ico('atras')} Volver al menú</button>
    <h2 class="menu-h2">Partida nueva</h2>
    <ol class="pasos sobre-sala">${pasos}</ol>
    ${cuerpo}
    <div class="botones-paso">
      ${paso > 1 ? `<button class="btn claro" data-a="paso" data-v="${paso - 1}">${ico('atras')} Atrás</button>` : ''}
      ${final ? `<button class="btn laton grande" data-a="empezar">${c.modo === 'carrera' ? 'Empezar la carrera' : 'Empezar a gobernar'}</button>`
        : `<button class="btn laton grande" data-a="paso" data-v="${paso + 1}">Siguiente: ${PASOS_NUEVA[paso].toLowerCase()}</button>`}
    </div>`;
}

function renderMenu() {
  const nueva = ui.menu === 'nueva', c = ui.cfg;
  const caja = $('#menu-caja');
  ponerHTML(caja, ui.menu === 'multi' ? htmlMenuMulti() : nueva ? htmlNuevaPartida() : htmlMenuPrincipal());
  caja.classList.toggle('formulario', ui.menu === 'multi' || nueva);
  if (ui.menuAnim) {
    caja.classList.remove('entra');
    void caja.offsetWidth;
    caja.classList.add('entra');
    ui.menuAnim = false;
  }
  // A la derecha: el mapa en el paso del país y el hemiciclo en todo lo demás.
  const colorCentro = nueva && c.propio ? c.color : PARTIDOS.uc.color;
  ponerHTML($('#menu-hero'), nueva && ui.paso === 3 ? vistaMundo() : heroHemiciclo(colorCentro));
}

// ---------- Ventanas comunes ----------

function interruptor(k, etiqueta) {
  return `<div class="op-fila"><span>${etiqueta}</span>
    <button class="interruptor" role="switch" aria-checked="${opciones[k]}" aria-label="${etiqueta}" data-a="alternar" data-k="${k}"><i></i></button></div>`;
}

function segmento(k, etiqueta, valores) {
  return `<div class="op-fila"><span>${etiqueta}</span><div class="segmento">
    ${Object.keys(valores).map(v => `<button class="${opciones[k] === v ? 'activa' : ''}" data-a="opcion" data-k="${k}" data-v="${v}" aria-pressed="${opciones[k] === v}">${valores[v]}</button>`).join('')}
  </div></div>`;
}

function htmlOpciones() {
  const enJuego = ui.pantalla === 'juego';
  return `<h2>${ico('engranaje')} Opciones</h2>
    ${segmento('tema', 'Aspecto', { claro: `${ico('sol')} Sala`, oscuro: `${ico('luna')} Noche` })}
    ${segmento('texto', 'Tamaño del texto', { normal: 'Normal', grande: 'Grande' })}
    ${interruptor('animaciones', 'Animaciones')}
    ${interruptor('sonido', 'Sonido')}
    <div class="op-fila ${opciones.sonido ? '' : 'apagada'}"><span>Volumen</span>
      <input type="range" id="op-volumen" min="0" max="100" step="5" value="${Math.round(opciones.volumen * 100)}" aria-label="Volumen" ${opciones.sonido ? '' : 'disabled'}></div>
    ${interruptor('asesora', 'Consejos de la asesora')}
    <div class="op-partida">
      ${enJuego && enRed() ? `<button class="btn" data-a="salirMenu">${ico('casa')} ${soyAnfitrion() ? 'Cerrar la sala y salir (se guarda para reanudarla)' : 'Salir de la partida'}</button>`
      : enJuego ? `<button class="btn" data-a="salirMenu">${ico('casa')} Guardar y salir al menú</button>
        <button class="btn" data-a="abrir" data-v="confirmar">${ico('usuario')} Empezar otra partida</button>`
      : cargar() ? `<button class="btn" data-a="borrarPartida">${ico('papelera')} Borrar la partida guardada</button>` : ''}
    </div>
    <button class="btn principal" data-a="cerrar">Cerrar</button>`;
}

function htmlAyuda(esIntro) {
  const punto = (icono, titulo, texto) => `<li>${ico(icono)}<div><b>${titulo}</b><span>${texto}</span></div></li>`;
  if (esIntro && estado.modo === 'carrera') {
    return `<h2>Tu primer día en el Parlamento</h2>
      <p>${esc(estado.config.lider)}, acabas de salir elegido diputado por ${esc(estado.config.partido)}. Gobierna ${PARTIDOS[estado.gobiernoIA].nombre}
        y tu partido lo dirige ${LIDER_INICIAL}. Cada turno es un mes.</p>
      <ul class="ayuda">
        ${punto('megafono', 'Hazte un nombre', 'Interviene en el pleno y sal en televisión para ganar prestigio.')}
        ${punto('gente', 'Gánate al partido', `Dentro de ${MES_CONGRESO} meses hay congreso. Para dirigirlo necesitas más apoyo que ${LIDER_INICIAL}.`)}
        ${punto('parlamento', 'Toma postura', 'Presenta tus propias leyes y decide qué dices de las del gobierno.')}
        ${punto('urna', 'Gana las elecciones', 'Ya como líder, haz promesas y campaña. Si tu partido es el más votado, gobiernas.')}
        ${punto('estrella', 'Capital político', 'Se gasta en casi todo lo que haces. Recuperas 2 cada mes.')}
      </ul>
      <p class="nota">La carrera se acaba si el partido prefiere dos veces a ${LIDER_INICIAL} o si, ya como líder, su apoyo baja de 25.</p>
      <button class="btn principal" data-a="cerrar">Empezar la carrera</button>`;
  }
  const promesas = esIntro && estado.promesas.length ? ` Tienes 12 meses para cumplir tus ${estado.promesas.length} promesas: las verás en Parlamento.` : '';
  return `<h2>${esIntro ? `Bienvenido al gobierno, ${esc(estado.config.lider)}` : 'Cómo se juega'}</h2>
    <p>${esIntro ? `${esc(estado.config.partido)} ha ganado las elecciones en ${esc(estado.config.pais)}.${promesas}`
      : 'En la carrera política empiezas como diputado: gana prestigio, hazte con el partido y vence en las elecciones. Después, o si eliges gobierno directo, diriges el país así:'}
      Cada turno es un mes y las elecciones llegan cada ${esIntro ? MESES_LEGISLATURA + ' meses' : 'legislatura'}.</p>
    <ul class="ayuda">
      ${punto('martillo', 'Construye', 'Pulsa una provincia y levanta granjas, minas, fábricas, puertos y más.')}
      ${punto('parlamento', 'Aprueba leyes', 'Necesitas más votos a favor que en contra. Negocia con los otros partidos.')}
      ${punto('maletin', 'Forma gobierno', 'Cada ministro da una ventaja. Uno de otro partido te acerca a ese partido.')}
      ${punto('gente', 'Cuida a la gente', 'El apoyo de obreros, empresarios, campesinos y jóvenes decide tus escaños.')}
      ${punto('bandera', 'Haz diplomacia', 'Tratados y alianzas con los vecinos dan dinero, estabilidad e influencia.')}
      ${punto('espadas', 'Defiéndete o conquista', 'Recluta regimientos, declara guerras y ocupa provincias. Los vecinos también pelean entre sí.')}
    </ul>
    <p class="nota">Pierdes si otro partido saca más escaños, si la deuda pasa de −400, si la estabilidad baja de 25 o si ocupan todo tu país.
      Atajos: espacio pasa de mes y los números cambian de pestaña.</p>
    <button class="btn principal" data-a="cerrar">${esIntro ? 'Empezar a gobernar' : 'Entendido'}</button>`;
}

function htmlMulti() {
  return `<h2>${ico('gente')} Multijugador</h2>
    <p>Este modo todavía no está disponible. La idea es que varias personas compartan el mismo mundo:</p>
    <ul class="ayuda">
      <li>${ico('globo')}<div><b>Un país por jugador</b><span>Tratados, alianzas, embargos y guerras negociados entre personas.</span></div></li>
      <li>${ico('parlamento')}<div><b>Un parlamento compartido</b><span>Cada jugador lidera un partido y pacta las leyes con los demás.</span></div></li>
      <li>${ico('reloj')}<div><b>Turnos sin prisa</b><span>Cada uno juega su mes cuando puede.</span></div></li>
    </ul>
    <button class="btn principal" data-a="cerrar">Entendido</button>`;
}

function htmlConfirmar() {
  return `<h2>¿Empezar otra partida?</h2>
    <p>La partida actual se sustituirá por la nueva en cuanto empieces a jugar.</p>
    <div class="botones"><button class="btn principal" data-a="irNueva">Crear partida nueva</button>
    <button class="btn" data-a="cerrar">Seguir con esta</button></div>`;
}
