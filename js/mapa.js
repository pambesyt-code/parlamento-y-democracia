'use strict';
// El mundo de cada partida. A partir de una semilla coloca un continente y unas islas, lo divide
// en provincias sobre una rejilla de hexágonos y lo reparte entre tu país y los demás, a los que
// da nombre, bandera y carácter. Con la misma semilla sale siempre el mismo mundo, así que en la
// partida guardada basta con la semilla.

let GEO = null;

// Mezcla dos colores #rrggbb; t va de 0 (el primero) a 1 (el segundo).
function mezclar(a, b, t) {
  const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = n(a), B = n(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function distanciaColor(a, b) {
  const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = n(a), B = n(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
// Los tres tonos con los que se pintan tus provincias.
const tonosPais = c => [c, mezclar(c, '#000000', 0.09), mezclar(c, '#ffffff', 0.24)];

// Generador de números al azar reproducible (mulberry32).
function crearAzar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function barajar(rng, lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}
const entre = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- 1. Tierra ----------
// Las distancias van en «anchos de hexágono». Cada punto será la capital de una provincia.

const SEPARACION = 3.3;        // distancia mínima entre capitales de provincia
const MAR_ISLAS = 7.4;         // distancia mínima entre una isla y cualquier otra tierra
const radioDe = n => Math.sqrt(n * 11.5 / Math.PI);

function colocarSemillas(rng, nContinente, islas) {
  const pts = [];
  // Dentro de una misma tierra basta la separación normal; entre tierras distintas tiene que haber mar.
  const libre = (x, y, grupo) => pts.every(q => Math.hypot(q.x - x, q.y - y) >= (q.grupo === grupo ? SEPARACION : MAR_ISLAS));

  function crecer(n, cx, cy, grupo, estirar) {
    const mios = [];
    const nuevo = (x, y) => { const q = { x, y, grupo }; mios.push(q); pts.push(q); };
    for (let k = 0; k < 80 && !mios.length; k++) {
      const x = cx + (rng() - 0.5) * k * 0.7, y = cy + (rng() - 0.5) * k * 0.7;
      if (libre(x, y, grupo)) nuevo(x, y);
    }
    const tope = radioDe(n) + 1.4;
    for (let k = 0; k < n * 150 && mios.length && mios.length < n; k++) {
      const b = mios[Math.floor(rng() * mios.length)], a = rng() * Math.PI * 2, d = 3.45 + rng() * 0.75;
      const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
      if (Math.hypot((x - cx) / estirar, (y - cy) * estirar) > tope || !libre(x, y, grupo)) continue;
      nuevo(x, y);
    }
  }

  const estirar = 1 + rng() * 0.25;   // el continente, algo más ancho que alto
  crecer(nContinente, 0, 0, 0, estirar);
  const rc = radioDe(nContinente) * estirar, giro = rng() * Math.PI * 2;
  islas.forEach((n, i) => {
    const ang = giro + (i + rng() * 0.5) * Math.PI * 2 / islas.length;
    const dist = rc + radioDe(n) + 5.5 + rng() * 2.5;
    crecer(n, Math.cos(ang) * dist, Math.sin(ang) * dist * 0.85, i + 1, 1);
  });
  return pts.map((q, i) => ({ id: 'p' + i, x: q.x, y: q.y, grupo: q.grupo, radio: q.grupo ? 0.8 : 1 }));
}

// ---------- 2. Formas ----------
// Cada celda de tierra pertenece a la provincia cuya capital está más cerca.

function calcularGeometria(provs) {
  const r = 13, ancho = Math.sqrt(3) * r, MARGEN = 5.5;
  const minX = Math.min(...provs.map(p => p.x)) - MARGEN, minY = Math.min(...provs.map(p => p.y)) - MARGEN;
  for (const p of provs) { p.x -= minX; p.y -= minY; }
  const cols = Math.ceil(Math.max(...provs.map(p => p.x)) + MARGEN);
  const filas = Math.ceil((Math.max(...provs.map(p => p.y)) + MARGEN) / 0.866);
  const centro = (c, f) => [ancho * (c + 0.5 * (f & 1)) + ancho / 2, 1.5 * r * f + r];
  const esquina = (x, y, k) => {
    const a = Math.PI / 180 * (60 * k - 30);
    return (x + r * Math.cos(a)).toFixed(1) + ',' + (y + r * Math.sin(a)).toFixed(1);
  };
  // Vecinos en el orden E, SE, SO, O, NO, NE; el lado k une las esquinas k y k+1.
  const vecinosDe = f => (f & 1)
    ? [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]
    : [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
  const dentro = (c, f) => f >= 0 && f < filas && c >= 0 && c < cols;
  const semillas = provs.map(p => [p.x * ancho, p.y * ancho]);

  const cerca = [], tierra = [];
  for (let f = 0; f < filas; f++) {
    cerca.push([]); tierra.push([]);
    for (let c = 0; c < cols; c++) {
      const [x, y] = centro(c, f);
      let mejor = 0, dmin = Infinity;
      semillas.forEach(([sx, sy], i) => {
        const d = Math.hypot(x - sx, y - sy) / ancho;
        if (d < dmin) { dmin = d; mejor = i; }
      });
      // El radio ondulado recorta la costa para que no sea un círculo perfecto.
      const radio = (3.2 + 0.8 * Math.sin(c * 1.3 + f * 0.7) * Math.cos(f * 1.1 - c * 0.4)) * provs[mejor].radio;
      cerca[f].push(mejor);
      tierra[f].push(dmin < radio);
    }
  }

  // El mar es el agua conectada con el borde; el agua encerrada (lagos) se rellena de tierra.
  const mar = tierra.map(fila => fila.map(() => false)), cola = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    if ((f === 0 || c === 0 || f === filas - 1 || c === cols - 1) && !tierra[f][c]) { mar[f][c] = true; cola.push([c, f]); }
  }
  while (cola.length) {
    const [c, f] = cola.pop();
    for (const [dc, df] of vecinosDe(f)) {
      const nc = c + dc, nf = f + df;
      if (dentro(nc, nf) && !tierra[nf][nc] && !mar[nf][nc]) { mar[nf][nc] = true; cola.push([nc, nf]); }
    }
  }
  const prov = (c, f) => (dentro(c, f) && !mar[f][c] ? cerca[f][c] : -1);

  const datos = provs.map(() => ({ d: '', contorno: '', sx: 0, sy: 0, n: 0, costera: false, vecinos: new Set() }));
  let caja = [Infinity, Infinity, -Infinity, -Infinity];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const i = prov(c, f);
    if (i < 0) continue;
    const [x, y] = centro(c, f), g = datos[i];
    g.d += 'M' + [0, 1, 2, 3, 4, 5].map(k => esquina(x, y, k)).join('L') + 'Z';
    g.sx += x; g.sy += y; g.n++;
    caja = [Math.min(caja[0], x), Math.min(caja[1], y), Math.max(caja[2], x), Math.max(caja[3], y)];
    vecinosDe(f).forEach(([dc, df], k) => {
      const j = prov(c + dc, f + df);
      if (j === i) return;
      g.contorno += `M${esquina(x, y, k)}L${esquina(x, y, (k + 1) % 6)}`;
      if (j < 0) g.costera = true; else g.vecinos.add(provs[j].id);
    });
  }

  const geo = { provs: {}, vecinos: {}, paises: {}, costa: '', fronteraPais: '', fronteraProv: '' };
  provs.forEach((p, i) => {
    const g = datos[i];
    geo.provs[p.id] = { d: g.d, contorno: g.contorno, costera: g.costera, celdas: g.n, cx: +(g.sx / (g.n || 1)).toFixed(1), cy: +(g.sy / (g.n || 1)).toFixed(1) };
    geo.vecinos[p.id] = [...g.vecinos];
  });
  const m = r * 2.5;
  geo.viewBox = [caja[0] - m, caja[1] - m, caja[2] - caja[0] + 2 * m, caja[3] - caja[1] + 2 * m].map(Math.round);
  // Lo necesario para volver a trazar las fronteras cuando una provincia cambia de dueño.
  geo.rejilla = { cols, filas, prov, centro, esquina, vecinosDe };
  return geo;
}

// Fronteras, costa y contorno de cada país según quién posee hoy cada provincia.
function recalcularFronteras() {
  const { cols, filas, prov, centro, esquina, vecinosDe } = GEO.rejilla, paises = {};
  let costa = '', fronteraPais = '', fronteraProv = '';
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const i = prov(c, f);
    if (i < 0) continue;
    const [x, y] = centro(c, f), pais = PROVINCIAS[i].pais;
    const P = paises[pais] || (paises[pais] = { contorno: '', sx: 0, sy: 0, n: 0 });
    P.sx += x; P.sy += y; P.n++;
    vecinosDe(f).forEach(([dc, df], k) => {
      const j = prov(c + dc, f + df);
      if (j === i) return;
      const lado = `M${esquina(x, y, k)}L${esquina(x, y, (k + 1) % 6)}`;
      if (j < 0) { costa += lado; P.contorno += lado; return; }
      const otroPais = PROVINCIAS[j].pais !== pais;
      if (otroPais) P.contorno += lado;
      if (k < 3) { if (otroPais) fronteraPais += lado; else fronteraProv += lado; }
    });
  }
  for (const id in paises) {
    const P = paises[id];
    paises[id] = { contorno: P.contorno, cx: +(P.sx / P.n).toFixed(1), cy: +(P.sy / P.n).toFixed(1) };
  }
  Object.assign(GEO, { paises, costa, fronteraPais, fronteraProv });
}

// ---------- 3. Reparto en países ----------
// Tu país es una mancha compacta con costa, ni en el centro del continente ni en su borde.
// Cada grupo de islas es un país. El resto del continente se reparte entre capitales elegidas
// lo más lejos posible unas de otras, que crecen por turnos hasta llenarlo.

function repartirPaises(rng, provs, geo, propias, nPaises, exigirCosta, humanos) {
  const porId = Object.fromEntries(provs.map(p => [p.id, p]));
  const libres = new Set(provs.map(p => p.id));
  const tomar = (id, P) => { libres.delete(id); P.provs.push(id); };
  const cont = provs.filter(p => !p.grupo);
  const c = { x: cont.reduce((a, p) => a + p.x, 0) / cont.length, y: cont.reduce((a, p) => a + p.y, 0) / cont.length };
  const rmax = Math.max(...cont.map(p => distancia(p, c)));

  // Una mancha por jugador. Con varios, cada una sale lo más lejos posible de las anteriores.
  const banda = cont.filter(p => distancia(p, c) > rmax * 0.2 && distancia(p, c) < rmax * 0.75);
  const jugadores = [];
  for (let h = 0; h < humanos; h++) {
    const otras = jugadores.map(J => porId[J.capital]);
    const lejania = p => (otras.length ? Math.min(...otras.map(q => distancia(p, q))) : 0);
    const salidas = barajar(rng, banda.filter(p => libres.has(p.id)));
    if (otras.length) salidas.sort((a, b) => lejania(b) - lejania(a));
    let mio = null;
    for (const ini of salidas.slice(0, 15)) {
      const region = [ini.id], usados = new Set(region);
      while (region.length < propias) {
        const f = [...new Set(region.flatMap(id => geo.vecinos[id]))].filter(v => !usados.has(v) && !porId[v].grupo && libres.has(v));
        if (!f.length) break;
        f.sort((a, b) => distancia(porId[a], ini) - distancia(porId[b], ini));
        const elegido = f[Math.floor(rng() * Math.min(2, f.length))];
        region.push(elegido);
        usados.add(elegido);
      }
      // Sin exigencias (último recurso) vale cualquier mancha de al menos 3 provincias.
      if (exigirCosta ? region.length === propias && region.some(id => geo.provs[id].costera) : region.length >= 3) { mio = region; break; }
    }
    if (!mio) return null;
    const J = { provs: [], capital: mio[0], jugador: true, id: idHumano(h) };
    mio.forEach(id => tomar(id, J));
    jugadores.push(J);
  }

  const islas = [];
  for (const g of [...new Set(provs.filter(p => p.grupo).map(p => p.grupo))]) {
    const P = { provs: [], capital: null };
    provs.filter(p => p.grupo === g).forEach(p => tomar(p.id, P));
    P.capital = P.provs[0];
    islas.push(P);
  }

  const nCont = Math.max(1, nPaises - islas.length);
  const restantes = cont.filter(p => libres.has(p.id));
  const tope = Math.ceil(restantes.length / nCont) + 1;
  const anclas = jugadores.flatMap(J => J.provs.map(id => porId[id])), capitales = [];
  for (let k = 0; k < nCont; k++) {
    let mejor = null, md = -1;
    for (const p of restantes) {
      if (capitales.includes(p)) continue;
      const d = Math.min(...[...anclas, ...capitales].map(q => distancia(p, q))) + rng() * 1.5;
      if (d > md) { md = d; mejor = p; }
    }
    if (!mejor) break;
    capitales.push(mejor);
  }
  const continentales = capitales.map(cap => {
    const P = { provs: [], capital: cap.id };
    tomar(cap.id, P);
    return P;
  });
  for (let hubo = true; hubo;) {
    hubo = false;
    for (const P of barajar(rng, continentales)) {
      if (P.provs.length >= tope) continue;
      const f = [...new Set(P.provs.flatMap(id => geo.vecinos[id]))].filter(v => libres.has(v));
      if (!f.length) continue;
      const cap = porId[P.capital];
      f.sort((a, b) => distancia(porId[a], cap) - distancia(porId[b], cap));
      tomar(f[0], P);
      hubo = true;
    }
  }

  // Lo que quede sin dueño se lo queda el país vecino más pequeño; si solo toca a jugadores, el más pequeño de ellos.
  const todos = [...jugadores, ...continentales, ...islas];
  const duenoDe = id => todos.find(P => P.provs.includes(id));
  const menor = lista => lista.sort((a, b) => a.provs.length - b.provs.length)[0];
  while (libres.size) {
    let avance = false;
    for (const id of [...libres]) {
      const vecinos = geo.vecinos[id].map(duenoDe).filter(Boolean);
      const otros = vecinos.filter(P => !P.jugador);
      if (otros.length) { tomar(id, menor(otros)); avance = true; } else if (vecinos.length) { tomar(id, menor(vecinos)); avance = true; }
    }
    if (!avance) {
      const id = [...libres][0], p = porId[id];
      const cerca = [...continentales, ...islas].sort((a, b) => distancia(porId[a.capital], p) - distancia(porId[b.capital], p))[0] || jugadores[0];
      tomar(id, cerca);
    }
  }
  return { jugadores, paises: [...continentales, ...islas] };
}

// ---------- 4. Países: nombre, bandera, carácter ----------

function crearBandera(rng, base) {
  const [a, b] = barajar(rng, COLORES_BANDERA), c = mezclar(base, '#000000', 0.22);
  return [
    `<rect width="21" height="14" fill="${c}"/><rect y="4.670" width="21" height="4.660" fill="${a}"/>`,
    `<rect width="21" height="14" fill="${a}"/><rect width="7" height="14" fill="${c}"/><rect x="14" width="7" height="14" fill="${b}"/>`,
    `<rect width="21" height="14" fill="${c}"/><rect x="6" width="3" height="14" fill="${a}"/><rect y="5.500" width="21" height="3" fill="${a}"/>`,
    `<rect width="21" height="14" fill="${c}"/><circle cx="10.500" cy="7" r="3.200" fill="${a}"/>`,
    `<rect width="21" height="14" fill="${c}"/><path d="M0 14L21 0v14z" fill="${a}"/>`,
    `<rect width="21" height="14" fill="${a}"/><rect y="7" width="21" height="7" fill="${c}"/><path d="M0 0l9 7-9 7z" fill="${b}"/>`,
    `<rect width="21" height="14" fill="${c}"/><rect y="4.500" width="21" height="5" fill="${a}"/><path d="M10.500 4.800l2.200 2.200-2.200 2.200-2.200-2.200z" fill="${b}"/>`,
  ][Math.floor(rng() * 7)];
}

function nombreConEstilo(rng, estilo, usados) {
  const E = ESTILOS[estilo];
  for (let k = 0; k < 60; k++) {
    const n = E.pre[Math.floor(rng() * E.pre.length)] + E.suf[Math.floor(rng() * E.suf.length)];
    if (!usados.has(n)) { usados.add(n); return n; }
  }
  const n = `${E.pre[0]}${E.suf[0]} ${usados.size}`;
  usados.add(n);
  return n;
}

// Rellena NACIONES: los países de la IA con su carácter, y los de los jugadores con datos provisionales
// (registrarHumano les pone luego el nombre y el color que elija cada uno).
function crearPaises(rng, provs, geo, reparto) {
  const porId = Object.fromEntries(provs.map(p => [p.id, p]));
  for (const k in NACIONES) delete NACIONES[k];
  const plantillas = barajar(rng, PLANTILLAS_PAIS);
  const islenas = plantillas.filter(p => p.estilo === 'isleno'), resto = plantillas.filter(p => p.estilo !== 'isleno');
  let colores = barajar(rng, COLORES_MAPA).filter(col => COLORES_PAIS.every(cp => distanciaColor(col, cp) > 60));
  if (!colores.length) colores = COLORES_MAPA;

  reparto.jugadores.forEach((J, i) => {
    J.provs.forEach(id => { porId[id].pais = J.id; });
    porId[J.capital].capital = true;
    NACIONES[J.id] = {
      humano: true, nombre: `Jugador ${i + 1}`, estilo: 'latino', color: COLORES_PAIS[i % COLORES_PAIS.length], bandera: '',
      gobierno: 'República', desc: '', relacion: 0, comercio: 30, ejercito: TROPAS_INICIALES, provincias: J.provs.length, rival: null, capitalProv: J.capital,
    };
  });

  // Las islas, sin contacto por tierra con ningún jugador, usan nombres de navegantes.
  const conJugador = new Set(reparto.jugadores.map(J => J.capital)), cola = [...conJugador];
  while (cola.length) for (const v of geo.vecinos[cola.pop()]) if (!conJugador.has(v)) { conJugador.add(v); cola.push(v); }

  reparto.paises.forEach((R, i) => {
    const isla = !conJugador.has(R.capital);
    const pl = (isla && islenas.shift()) || resto.shift() || islenas.shift() || { nombre: `País ${i + 1}`, estilo: 'latino' };
    const car = CARACTERES[Math.floor(rng() * CARACTERES.length)], n = R.provs.length, pid = 'c' + i;
    const color = colores[i % colores.length];
    NACIONES[pid] = {
      nombre: pl.nombre, estilo: pl.estilo, color, bandera: crearBandera(rng, color), gobierno: car.gobierno, desc: car.desc,
      relacion: car.relacion + entre(rng, -8, 8), comercio: Math.round(car.comercio * (0.6 + 0.15 * n)),
      ejercito: Math.max(2, Math.round(n * car.fuerza + rng() * 1.5)), provincias: n, rival: null, capitalProv: R.capital,
    };
    R.provs.forEach(id => { porId[id].pais = pid; });
    porId[R.capital].capital = true;
  });

  // Los que tocan a un jugador lo miran con algo más de recelo. Algunos vecinos son rivales entre sí.
  const tocan = (a, b) => provs.some(p => p.pais === a && geo.vecinos[p.id].some(v => porId[v].pais === b));
  const ia = Object.keys(NACIONES).filter(pid => !NACIONES[pid].humano);
  for (const pid of barajar(rng, ia)) {
    if (reparto.jugadores.some(J => tocan(pid, J.id))) NACIONES[pid].relacion -= 6;
    if (NACIONES[pid].rival || rng() > 0.4) continue;
    const opciones = ia.filter(o => o !== pid && !NACIONES[o].rival && tocan(pid, o));
    if (!opciones.length) continue;
    const otro = opciones[Math.floor(rng() * opciones.length)];
    NACIONES[pid].rival = otro;
    NACIONES[otro].rival = pid;
  }
}

// Los demás países tal como los ve una nación: todos menos ella, y marcados como isla los que
// no se alcanzan por tierra desde su capital.
function verDesde(pid) {
  for (const k in PAISES) delete PAISES[k];
  const mia = GEO.masa[NACIONES[pid].capitalProv];
  for (const id in NACIONES) {
    if (id === pid) continue;
    const isla = GEO.masa[NACIONES[id].capitalProv] !== mia;
    PAISES[id] = { ...NACIONES[id], isla, requierePuerto: isla };
  }
}

// ---------- 5. Provincias: nombre, población y recursos ----------

function darAtributos(rng, provs, geo) {
  const azarEntre = (a, b) => Math.round((a + rng() * (b - a)) / 10) * 10;
  const propios = { costa: barajar(rng, NOMBRES_PROPIOS.costa), interior: barajar(rng, NOMBRES_PROPIOS.interior) };
  const usados = new Set();
  const MIX = {   // [obreros, empresarios, campesinos, jóvenes]
    capital: [0.35, 0.3, 0.05, 0.3], mineral: [0.5, 0.1, 0.18, 0.22], fertil: [0.2, 0.1, 0.5, 0.2],
    ambos: [0.32, 0.1, 0.38, 0.2], ninguno: [0.38, 0.2, 0.12, 0.3],
  };

  for (const p of provs) {
    const propia = NACIONES[p.pais].humano, t = rng();
    p.origen = p.pais;
    if (!p.capital) {
      p.fertil = t < 0.45 || (t >= 0.75 && t < 0.87);
      p.mineral = (t >= 0.45 && t < 0.75) || (t >= 0.75 && t < 0.87);
    }
    p.pob = p.capital ? azarEntre(1200, 1500) : azarEntre(350, 850);
    if (propia) {
      const costera = geo.provs[p.id].costera && !p.capital;
      const lista = costera && propios.costa.length ? propios.costa : propios.interior.length ? propios.interior : propios.costa;
      p.nombre = lista.shift() || nombreConEstilo(rng, 'latino', usados);
      usados.add(p.nombre);
    } else p.nombre = nombreConEstilo(rng, NACIONES[p.pais].estilo, usados);
  }

  // Cada jugador tiene al menos dos provincias fértiles y dos con minerales para poder arrancar.
  const humanos = Object.keys(NACIONES).filter(pid => NACIONES[pid].humano);
  for (const pid of humanos) {
    const propias = provs.filter(p => p.pais === pid && !p.capital);
    for (const rasgo of ['fertil', 'mineral']) {
      for (const p of propias) {
        if (propias.filter(q => q[rasgo]).length >= 2) break;
        if (!p[rasgo]) p[rasgo] = true;
      }
    }
  }
  for (const p of provs) {
    const tipo = p.capital ? 'capital' : p.fertil && p.mineral ? 'ambos' : p.fertil ? 'fertil' : p.mineral ? 'mineral' : 'ninguno';
    const m = MIX[tipo].map(v => Math.max(0.03, v + (rng() - 0.5) * 0.08)), suma = m.reduce((a, v) => a + v, 0);
    p.mix = m.map(v => v / suma);
  }
  // Con qué empieza cada jugador: una fábrica en la capital, una mina y dos granjas.
  for (const pid of humanos) {
    const propias = provs.filter(p => p.pais === pid && !p.capital);
    const capital = provs.find(p => p.pais === pid && p.capital);
    if (capital) capital.ini = { fabrica: 1 };
    const mina = propias.find(p => p.mineral);
    if (mina) mina.ini = { mina: 1 };
    propias.filter(p => p.fertil && p !== mina).slice(0, 2).forEach(p => { p.ini = { granja: 1 }; });
  }
}

// ---------- Todo junto ----------

// Crea el mundo de una partida y lo deja en PROVINCIAS, PROV_POR_ID, NACIONES, PAISES y GEO.
// humanos: cuántas naciones llevan jugadores. Con varios, cada uno tiene 2 provincias menos y hay
// menos países de la IA, para que todo quepa. Si una semilla da un mapa cojo, prueba la siguiente.
function generarMundo(semilla, tamano, humanos = 1) {
  const T = TAMANOS[tamano] || TAMANOS.mediano;
  const propias = humanos > 1 ? T.propias - 2 : T.propias;
  let mundo = null;
  for (let intento = 0; intento < 24 && !mundo; intento++) {
    const estricto = intento < 20;
    const rng = crearAzar((semilla >>> 0) + intento * 7919);
    const nPaises = Math.max(3, entre(rng, T.paises[0], T.paises[1]) - (humanos - 1));
    const islas = Array.from({ length: Math.min(T.islas, nPaises - 1) }, () => entre(rng, 2, 3));
    let nContinente = propias * humanos;
    for (let i = 0; i < nPaises - islas.length; i++) nContinente += entre(rng, T.provPais[0], T.provPais[1]);
    const provs = colocarSemillas(rng, nContinente, islas);
    const geo = calcularGeometria(provs);
    if (estricto && !provs.every(p => geo.provs[p.id].celdas > 6)) continue;
    const reparto = repartirPaises(rng, provs, geo, propias, nPaises, estricto, humanos);
    if (!reparto) continue;
    // Al menos dos tercios de los países pedidos; si no, el mapa ha quedado demasiado apretado.
    if (estricto && reparto.paises.length < Math.ceil(nPaises * 2 / 3)) continue;
    mundo = { rng, provs, geo, reparto };
  }
  crearPaises(mundo.rng, mundo.provs, mundo.geo, mundo.reparto);
  darAtributos(mundo.rng, mundo.provs, mundo.geo);
  PROVINCIAS = mundo.provs;
  PROV_POR_ID = Object.fromEntries(PROVINCIAS.map(p => [p.id, p]));
  GEO = mundo.geo;
  // A qué tierra (continente o isla) pertenece cada provincia: sirve para saber qué se alcanza por tierra.
  GEO.masa = {};
  let masas = 0;
  for (const p of PROVINCIAS) {
    if (GEO.masa[p.id] !== undefined) continue;
    const cola = [p.id];
    GEO.masa[p.id] = masas;
    while (cola.length) for (const v of GEO.vecinos[cola.pop()]) if (GEO.masa[v] === undefined) { GEO.masa[v] = masas; cola.push(v); }
    masas++;
  }
  recalcularFronteras();
  // Hasta que se active una nación, el mundo se ve desde la del primer jugador.
  PAIS_JUGADOR.id = idHumano(0);
  verDesde(idHumano(0));
}
