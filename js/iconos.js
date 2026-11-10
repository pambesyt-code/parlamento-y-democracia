'use strict';
// Iconos de trazo (24×24), banderas y emblemas. Todo SVG en línea: no hay imágenes externas.

function rutaEngranaje(cx, cy, dientes, rExt, rInt) {
  const n = dientes * 4;
  let d = '';
  for (let i = 0; i < n; i++) {
    const r = i % 4 < 2 ? rExt : rInt, a = (Math.PI * 2 * (i - 0.5)) / n;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}

function rutaEstrella(cx, cy, rExt, rInt) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? rInt : rExt, a = (Math.PI * i) / 5 - Math.PI / 2;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}

const ICONOS = {
  // Cifras de la cabecera
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
  moneda: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.6 9.4h-3.7a1.6 1.6 0 0 0 0 3.2h2.2a1.6 1.6 0 0 1 0 3.2H9.3"/>',
  gente: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.700 6 6"/><circle cx="17" cy="9" r="2.200"/><path d="M16.500 14.200c2.600.400 4.500 2.700 4.500 5.800"/>',
  escudo: '<path d="M12 3l7 3v5c0 4.500-3 8.300-7 10-4-1.700-7-5.500-7-10V6z"/>',
  estrella: `<path d="${rutaEstrella(12, 12, 9, 3.900)}"/>`,
  globo: '<circle cx="12" cy="12" r="8.500"/><path d="M3.500 12h17M12 3.500c2.500 2.500 3.800 5.300 3.800 8.500s-1.300 6-3.800 8.500c-2.500-2.500-3.800-5.300-3.800-8.500s1.300-6 3.800-8.500z"/>',
  urna: '<rect x="4" y="11" width="16" height="9" rx="1.500"/><path d="M9 11V5h6v6M9.500 15.500h5"/>',

  // Edificios y recursos
  trigo: '<path d="M12 21V4M12 12c-2.500 0-4-1.500-4-4 2.500 0 4 1.500 4 4zM12 12c2.500 0 4-1.500 4-4-2.500 0-4 1.500-4 4zM12 17.500c-2.500 0-4-1.500-4-4 2.500 0 4 1.500 4 4zM12 17.500c2.500 0 4-1.500 4-4-2.500 0-4 1.500-4 4z"/>',
  pico: '<path d="M4.500 19.500L15 9M8 4.500c5.500 0 11 5 11.500 11.500"/>',
  fabrica: '<path d="M3.500 20V10.500l5.500 3.500v-3.500l5.500 3.500V5h3.500v15z"/><path d="M7.500 17h2M12.500 17h2"/>',
  ancla: '<circle cx="12" cy="5.500" r="2"/><path d="M12 7.500V20M8.500 11h7M5 14c0 3.500 3 6 7 6s7-2.500 7-6"/>',
  birrete: '<path d="M2.500 9.500L12 5l9.500 4.500L12 14zM6.500 11.500V16c1.500 1.500 3.500 2.200 5.500 2.200s4-.700 5.500-2.200v-4.500M21.500 9.500V15"/>',
  torre: '<path d="M5.500 20.500V8H8V5.500h2.500V8h3V5.500H16V8h2.500v12.500zM10.500 20.500V16h3v4.500"/>',
  martillo: '<path d="M6 20l8.500-8.500M11.500 4.500l8 8-2.500 2.500-8-8z"/>',
  cono: '<path d="M9.500 4h5l4.500 15H5zM7.700 10.500h8.600M6.400 15h11.200"/>',
  tienda: '<path d="M4.500 10.500V20h15v-9.500M3 10.500l2.500-6h13l2.500 6zM10 20v-5h4v5"/>',
  cama: '<path d="M3 19V6M3 14h18v5M21 14v-2.500A2.500 2.500 0 0 0 18.500 9H11v5"/><circle cx="6.800" cy="11" r="1.800"/>',
  lupaMas: '<circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L20 20M10.500 7.500v6M7.500 10.500h6"/>',
  lupaMenos: '<circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500L20 20M7.500 10.500h6"/>',
  encuadre: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  corona: '<path d="M4 18h16M4 18L3 7l5 4 4-6 4 6 5-4-1 11"/>',
  espadas: '<path d="M5 4l10.500 10.500M5 4v2.500M5 4h2.500M13 17l4-4M17 17l3 3M19 4L8.500 14.500M19 4v2.500M19 4h-2.500M11 17l-4-4M7 17l-3 3"/>',
  reloj: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7v5l3.500 2"/>',

  // Grupos sociales
  llave: '<path d="M14.500 6.500a4 4 0 0 0-5.200 5.200L4 17l3 3 5.300-5.300a4 4 0 0 0 5.200-5.200L15 12l-2.500-.500L12 9z"/>',
  maletin: '<rect x="3.500" y="7.500" width="17" height="12" rx="2"/><path d="M9 7.500v-2A1.500 1.500 0 0 1 10.500 4h3A1.500 1.500 0 0 1 15 5.500v2M3.500 12.500h17"/>',

  // Pestañas y secciones
  mapa: '<path d="M3.500 6.500l5.500-2 6 2 5.500-2v13l-5.500 2-6-2-5.500 2zM9 4.500v13M15 6.500v13"/>',
  grafica: '<path d="M4 4v16h16M7.500 15l3.500-4 3 2.500 5-6.500"/>',
  parlamento: '<path d="M3 9.500L12 4l9 5.500zM4 20h16M6.500 10v7M10.200 10v7M13.800 10v7M17.500 10v7M5 17h14"/>',
  bandera: '<path d="M5 21V4M5 5h12l-2.500 4 2.500 4H5"/>',
  periodico: '<path d="M4 5h13v14H5.500A1.500 1.500 0 0 1 4 17.500zM17 9h3v8.500a1.500 1.500 0 0 1-3 0M7 9h7M7 12.500h7M7 16h4"/>',
  diana: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1"/>',
  bombilla: '<path d="M9.500 17.500h5M10.500 20.500h3M12 3.500a6 6 0 0 0-3.500 10.900c.6.5 1 1.200 1 2v1.100h5v-1.100c0-.800.400-1.500 1-2A6 6 0 0 0 12 3.500z"/>',
  megafono: '<path d="M4 10v4h3l7 4V6l-7 4zM17.500 9.500a3.500 3.500 0 0 1 0 5M7 14v4.500h2.500V15.500"/>',
  charla: '<path d="M4 5.500h11v8H9l-3.500 3v-3H4zM15 9.500h5v7.500h-1.500v2.500l-3-2.500H11"/>',

  // Menús y controles
  engranaje: `<path d="${rutaEngranaje(12, 12, 8, 9.600, 7.300)}"/><circle cx="12" cy="12" r="3"/>`,
  sonido: '<path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4zM15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  usuario: '<circle cx="12" cy="8" r="3.500"/><path d="M5 20.500c0-3.900 3.100-7 7-7s7 3.100 7 7"/>',
  candado: '<rect x="5.500" y="10.500" width="13" height="10" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  ayuda: '<circle cx="12" cy="12" r="8.500"/><path d="M9.700 9.500a2.400 2.400 0 1 1 3.500 2.100c-.800.500-1.200 1-1.200 1.900M12 16.700v.3"/>',
  casa: '<path d="M4 11l8-7 8 7M6 9.500V20h12V9.500M10 20v-5.500h4V20"/>',
  papelera: '<path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  atras: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M7 4.500v15l12-7.500z"/>',
  luna: '<path d="M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z"/>',

  // Emblemas de partido
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  hoja: '<path d="M5 19C5 10.500 10 5.500 19.500 4.500 19.500 14 14.500 19 5 19zM5 19l7.500-7.500"/>',
  antorcha: '<path d="M10.300 12h3.400l-.900 9h-1.600zM12 3c2.200 2 3.200 3.600 3.200 5.200a3.200 3.200 0 0 1-6.400 0c0-1 .500-2 1.400-3 .300 1.100.800 1.600 1.500 1.600.500-1.200.600-2.400.300-3.800z"/>',
  balanza: '<path d="M12 4v16M8 20h8M5.500 7h13M5.500 7L3 13.500a2.600 2.600 0 0 0 5 0zM18.500 7L16 13.500a2.600 2.600 0 0 0 5 0z"/>',
  faro: '<path d="M9.500 21l1.200-11h2.600l1.200 11M8 21h8M10 10V7.500h4V10M12 7.500V5M5.500 6l3 1.200M18.500 6l-3 1.200"/>',
};

function ico(nombre, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
}

// Las banderas de los demás países se crean con el mundo (mapa.js).
// La de tu país se pinta con el color que elegiste para él.
const banderaJugador = color => `<rect width="21" height="14" fill="${color}"/><rect width="7" height="14" fill="#1e3d32"/><circle cx="3.500" cy="7" r="1.700" fill="#fbf5e3"/>`;

function dibujoBandera(id) {
  if (id !== PAIS_JUGADOR.id) return (PAISES[id] && PAISES[id].bandera) || '';
  return banderaJugador(PAIS_JUGADOR.colores[0]);
}

function bandera(id, cls = '') {
  return `<svg class="bandera ${cls}" viewBox="0 0 21 14" aria-hidden="true">${dibujoBandera(id)}</svg>`;
}

// Insignia redonda de un partido: su color de fondo y su emblema en claro.
function logoPartido(info, cls = '') {
  return `<span class="logo ${cls}" style="background:${info.color}">${ico(info.emblema)}</span>`;
}

// Emblema del juego: un hemiciclo de escaños bajo una estrella.
function logoJuego(cls = '') {
  let puntos = '';
  [[9, 5], [14.500, 8], [20, 11]].forEach(([radio, n]) => {
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (Math.PI * k) / (n - 1);
      puntos += `<circle cx="${(32 + radio * Math.cos(a)).toFixed(1)}" cy="${(44 - radio * Math.sin(a)).toFixed(1)}" r="1.900"/>`;
    }
  });
  return `<svg class="logo-juego ${cls}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="32" cy="32" r="31" fill="#1e3d32"/><circle cx="32" cy="32" r="27.500" fill="none" stroke="#c9a24b" stroke-width="1.500"/>
    <g fill="#f2ecd9">${puntos}<rect x="28" y="42" width="8" height="3.500" rx="1"/></g>
    <path d="${rutaEstrella(32, 14.500, 6, 2.600)}" fill="#c9a24b"/></svg>`;
}
