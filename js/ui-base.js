'use strict';
// Utilidades de pantalla: ayudas de HTML, opciones del jugador, sonido y animaciones.

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signo = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n * 10) / 10);
const clase = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const chip = (texto, tipo = '') => `<span class="chip ${tipo}">${texto}</span>`;
const pct = m => signo(Math.round((m - 1) * 100)) + '%';

// Solo reescribe el elemento si el HTML ha cambiado: así no se cortan animaciones en curso.
function ponerHTML(el, html) {
  if (el._html === html) return false;
  el.innerHTML = html;
  el._html = html;
  return true;
}

function boton(contenido, datos, poder, cls = '') {
  const attrs = Object.entries(datos).map(([k, v]) => `data-${k}="${v}"`).join(' ');
  const motivo = !poder.ok && poder.motivo ? `<span class="motivo">${poder.motivo}</span>` : '';
  return `<span class="accion"><button class="btn ${cls}" ${attrs} ${poder.ok ? '' : 'disabled'}>${contenido}</button>${motivo}</span>`;
}

// ---------- Opciones ----------

const OPCIONES_GUARDADO = 'pyd-opciones-v1';
const opciones = {
  tema: 'claro', sonido: true, volumen: 0.5, texto: 'normal', asesora: true,
  animaciones: !matchMedia('(prefers-reduced-motion: reduce)').matches,
};
try { Object.assign(opciones, JSON.parse(localStorage.getItem(OPCIONES_GUARDADO)) || {}); } catch (e) { /* sin almacenamiento */ }

function aplicarOpciones() {
  const d = document.documentElement.dataset;
  d.tema = opciones.tema;
  d.anim = opciones.animaciones ? 'si' : 'no';
  d.texto = opciones.texto;
  try { localStorage.setItem(OPCIONES_GUARDADO, JSON.stringify(opciones)); } catch (e) { /* sin almacenamiento */ }
}
const animar = () => opciones.animaciones;

// ---------- Sonido ----------
// Efectos sintetizados con Web Audio: [frecuencia, inicio, duración, onda, volumen].

const Sonido = (() => {
  let ctx = null;
  const EFECTOS = {
    clic: [[660, 0, 0.05, 'triangle', 0.16]],
    pestana: [[520, 0, 0.04, 'triangle', 0.12]],
    construir: [[150, 0, 0.09, 'square', 0.12], [110, 0.09, 0.14, 'square', 0.12]],
    moneda: [[1047, 0, 0.07, 'sine', 0.2], [1397, 0.07, 0.14, 'sine', 0.2]],
    mes: [[392, 0, 0.08, 'triangle', 0.18], [523, 0.08, 0.12, 'triangle', 0.18]],
    voto: [[440, 0, 0.06, 'sine', 0.12], [554, 0.05, 0.08, 'sine', 0.1]],
    aprobado: [[523, 0, 0.12, 'triangle', 0.22], [659, 0.11, 0.12, 'triangle', 0.22], [784, 0.22, 0.28, 'triangle', 0.22]],
    rechazado: [[330, 0, 0.16, 'sawtooth', 0.1], [247, 0.15, 0.32, 'sawtooth', 0.1]],
    evento: [[587, 0, 0.1, 'sine', 0.2], [440, 0.12, 0.2, 'sine', 0.2]],
    logro: [[659, 0, 0.09, 'triangle', 0.2], [784, 0.09, 0.09, 'triangle', 0.2], [1047, 0.18, 0.24, 'triangle', 0.2]],
    victoria: [[523, 0, 0.14, 'triangle', 0.22], [659, 0.13, 0.14, 'triangle', 0.22], [784, 0.26, 0.14, 'triangle', 0.22], [1047, 0.39, 0.4, 'triangle', 0.22]],
    derrota: [[392, 0, 0.2, 'sine', 0.2], [330, 0.2, 0.2, 'sine', 0.2], [262, 0.4, 0.45, 'sine', 0.2]],
  };
  function nota(frec, inicio, dur, tipo, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + inicio;
    o.type = tipo;
    o.frequency.value = frec;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * opciones.volumen), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  return {
    tocar(nombre) {
      if (!opciones.sonido || !opciones.volumen || !EFECTOS[nombre]) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        EFECTOS[nombre].forEach(n => nota(...n));
      } catch (e) { /* sin audio */ }
    },
  };
})();

// ---------- Animaciones ----------

// Hace correr un número de un valor a otro. fijarNumero corta cualquier carrera en curso.
function animarNumero(el, de, a, fmt = n => n, ms = 550) {
  if (!el) return;
  if (!animar() || de === a) return fijarNumero(el, a, fmt);
  const ficha = (el._anim = {}), t0 = performance.now();
  const paso = t => {
    if (el._anim !== ficha) return;
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(de + (a - de) * e));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  // Si la pestaña está en segundo plano no hay fotogramas: se asegura el valor final.
  setTimeout(() => { if (el._anim === ficha) fijarNumero(el, a, fmt); }, ms + 150);
}

function fijarNumero(el, valor, fmt = n => n) {
  if (!el) return;
  el._anim = null;
  el.textContent = fmt(valor);
}

// Cifra que sube y se desvanece junto a un elemento para mostrar cuánto ha cambiado.
function flotar(el, texto, tipo) {
  if (!animar() || !el) return;
  const f = document.createElement('span');
  f.className = `flota ${tipo}`;
  f.textContent = texto;
  el.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

// Aviso breve en la esquina: objetivos cumplidos y noticias importantes.
function aviso(texto, tipo = '', icono = 'periodico') {
  const caja = $('#avisos');
  while (caja.children.length >= 4) caja.firstChild.remove();
  const a = document.createElement('div');
  a.className = `aviso ${tipo}`;
  a.setAttribute('role', 'status');
  a.innerHTML = `${ico(icono)}<span>${texto}</span>`;
  caja.appendChild(a);
  setTimeout(() => a.classList.add('fuera'), 4200);
  setTimeout(() => a.remove(), 4700);
}

// ---------- Textos de efectos ----------

function chipsLey(ley) {
  const c = [];
  // Gobernando se calcula lo que la ley haría con tu economía de hoy; en la oposición, solo su coste fijo.
  if (estado && estado.modo === 'gobierno') {
    const d = efectoDineroLey(estado, ley.id);
    if (d) c.push(chip(`Dinero ${signo(d)} al mes`, clase(d)));
  } else {
    if (ley.coste > 0) c.push(chip(`−${ley.coste} al mes`, 'neg'));
    if (ley.coste < 0) c.push(chip(`+${-ley.coste} al mes`, 'pos'));
  }
  const m = ley.mods || {};
  if (m.impuestos) c.push(chip(`Impuestos ${pct(m.impuestos)}`, m.impuestos > 1 ? 'pos' : 'neg'));
  if (m.fabricas) c.push(chip(`Ingresos de fábricas ${pct(m.fabricas)}`, m.fabricas > 1 ? 'pos' : 'neg'));
  if (m.minas) c.push(chip(`Minas ${pct(m.minas)}`, m.minas > 1 ? 'pos' : 'neg'));
  if (m.export) c.push(chip(`Exportaciones ${pct(m.export)}`, m.export > 1 ? 'pos' : 'neg'));
  if (m.construccion) c.push(chip(`Construir ${pct(m.construccion)}`, 'pos'));
  if (m.granjaExtra) c.push(chip(`Granjas +${m.granjaExtra} alimento`, 'pos'));
  if (ley.estabilidad) c.push(chip(`Estabilidad ${signo(ley.estabilidad)}`, clase(ley.estabilidad)));
  for (const g in ley.grupos || {}) c.push(chip(`${GRUPOS[g].nombre} ${signo(ley.grupos[g])}`, clase(ley.grupos[g])));
  return c.join('');
}

function chipsEfectos(ef, ev = {}) {
  const c = [], rel = (nombre, n) => c.push(chip(`Relación con ${nombre} ${signo(n)}`, clase(n)));
  if (ef.dinero) c.push(chip(`Dinero ${signo(ef.dinero)}`, clase(ef.dinero)));
  if (ef.cp) c.push(chip(`Capital político ${signo(ef.cp)}`, clase(ef.cp)));
  if (ef.estabilidad) c.push(chip(`Estabilidad ${signo(ef.estabilidad)}`, clase(ef.estabilidad)));
  if (ef.todos) c.push(chip(`Todos los grupos ${signo(ef.todos)}`, clase(ef.todos)));
  for (const g in ef.grupos || {}) c.push(chip(`${GRUPOS[g].nombre} ${signo(ef.grupos[g])}`, clase(ef.grupos[g])));
  if (ef.tropas) c.push(chip(`Regimientos ${signo(ef.tropas)}`, clase(ef.tropas)));
  if (ef.relacion && ev.pais) rel(PAISES[ev.pais].nombre, ef.relacion);
  if (ef.relacion2 && ev.pais2) rel(PAISES[ev.pais2].nombre, ef.relacion2);
  if (ef.guerra && ev[ef.guerra]) c.push(chip(`Guerra con ${PAISES[ev[ef.guerra]].nombre}`, 'neg'));
  if (ef.romperAlianza) c.push(chip('Se rompe la alianza', 'neg'));
  if (ef.paz) c.push(chip('Termina la guerra', 'pos'));
  if (ef.relPartido && ev.partido) rel(esc(partidoInfo(estado, ev.partido).nombre), ef.relPartido);
  for (const pid in ef.relPartidoDe || {}) rel(esc(partidoInfo(estado, pid).nombre), ef.relPartidoDe[pid]);
  if (ef.relPartidos) rel(estado.modo === 'carrera' ? 'los demás partidos' : 'la oposición', ef.relPartidos);
  if (ef.destituir) c.push(chip('Pierdes al ministro', 'neg'));
  // Efectos propios de la carrera política.
  if (ef.prestigio) c.push(chip(`Prestigio ${signo(ef.prestigio)}`, clase(ef.prestigio)));
  if (ef.interno) c.push(chip(`Apoyo en el partido ${signo(ef.interno)}`, clase(ef.interno)));
  if (ef.fondos) c.push(chip(`Fondos ${signo(ef.fondos)}`, clase(ef.fondos)));
  if (ef.imagenTodos) c.push(chip(`Todos los grupos ${signo(ef.imagenTodos)}`, clase(ef.imagenTodos)));
  for (const g in ef.imagen || {}) c.push(chip(`${GRUPOS[g].nombre} ${signo(ef.imagen[g])}`, clase(ef.imagen[g])));
  // Que la líder o el gobierno pierdan fuerza es bueno para ti: el color va al revés.
  if (ef.apoyoLider) c.push(chip(`Apoyo de ${LIDER_INICIAL} ${signo(ef.apoyoLider)}`, clase(-ef.apoyoLider)));
  if (ef.fuerzaGobierno) c.push(chip(ef.fuerzaGobierno < 0 ? 'El gobierno se debilita' : 'El gobierno se refuerza', clase(-ef.fuerzaGobierno)));
  return c.join('') || chip('Sin efectos');
}
