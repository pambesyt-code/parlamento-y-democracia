'use strict';
// Pantallas de quien está en la oposición de un país compartido (multijugador): su partido,
// sus acciones del mes y el parlamento desde el otro lado.

const miOpositor = () => (estado ? opositorPorToken(estado, miToken()) : null);
const esOposicion = () => enRed() && !!miOpositor();
// La votación que toca mostrar: la tuya si estás en la oposición, la del gobierno si no.
const claveVoto = v => (v ? `${v.ley}|${v.derogar}|${v.si}|${v.no}|${v.abs}` : '');
const votoEnPantalla = () => {
  const v = esOposicion() ? miOpositor().resultadoVoto : estado && estado.resultadoVoto;
  return v && ui.votoOculto === claveVoto(v) ? null : v;
};

const TABS_OPOSICION = { oposicion: ['Tu partido', 'bandera'], parlamento: ['Parlamento', 'parlamento'] };

function tabOposicion() {
  const s = estado, o = miOpositor(), P = partidoInfo(s, o.partido), G = partidoInfo(s, ID_JUGADOR);
  const enc = estimarVotos(s, false), reparto = repartoPorGrupo(s, false), faltan = s.proximaEleccion - s.mes;
  const accion = (id, datos, extra = '') => {
    const A = ACCIONES_OPOSICION[id];
    return boton(`${A.nombre}${extra} <span class="coste">${ico('estrella')}${A.cp}</span>`, datos, puedeAccionOposicion(s, o, id), 'mini');
  };
  return `<div class="titulo-pais">${logoPartido(P, 'grande')}<div><h2>${esc(P.nombre)}</h2>
      <p class="nota">Lideras la oposición en ${esc(PAIS_JUGADOR.nombre)}. Gobierna ${esc(G.nombre)}, de ${esc(G.lider)}.</p></div></div>
    <div class="tarjeta resaltada">
      <div class="tarjeta-cab"><b>Elecciones</b><span class="cuenta">en ${plural(faltan, 'mes', 'meses')}</span></div>
      <p>Si tu partido saca más escaños que el del gobierno, pasas a gobernar tú. Así va la encuesta:</p>
      ${duelo([[esc(P.nombre), enc[o.partido], P.color], [esc(G.nombre), enc[ID_JUGADOR], G.color]], 50)}
    </div>
    <h3>Qué haces este mes <span class="cuenta">${o.cp} de ${CP_MAXIMO} de capital político</span></h3>
    <div class="edif"><span class="edif-ico">${ico('megafono')}</span><div class="edif-txt"><b>${ACCIONES_OPOSICION.mitin.nombre}</b>
      <p>${ACCIONES_OPOSICION.mitin.desc}</p>
      <div class="botones">${Object.keys(GRUPOS).map(g => boton(`${GRUPOS[g].nombre}`, { a: 'oposMitin', v: g }, puedeAccionOposicion(s, o, 'mitin'), 'mini')).join('')}</div></div></div>
    <div class="edif"><span class="edif-ico">${ico('periodico')}</span><div class="edif-txt"><b>${ACCIONES_OPOSICION.campana.nombre}</b><p>${ACCIONES_OPOSICION.campana.desc}</p></div>
      <div class="edif-acc">${accion('campana', { a: 'oposCampana' }, '')}</div></div>
    <div class="edif"><span class="edif-ico">${ico('espadas')}</span><div class="edif-txt"><b>${ACCIONES_OPOSICION.denunciar.nombre}</b><p>${ACCIONES_OPOSICION.denunciar.desc}</p></div>
      <div class="edif-acc">${accion('denunciar', { a: 'oposDenunciar' }, '')}</div></div>
    <h3>Cómo vota tu grupo las leyes del gobierno</h3>
    <div class="niveles tres">${Object.keys(POSTURAS).map(k => `<button class="nivel ${o.postura === k ? 'activa' : ''}" data-a="oposPostura" data-v="${k}" ${o.postura === k ? 'disabled' : ''} aria-pressed="${o.postura === k}">
      <b>${POSTURAS[k].nombre}</b><small>${POSTURAS[k].desc}</small></button>`).join('')}</div>
    <h3>Tu imagen entre los votantes</h3>
    ${Object.keys(GRUPOS).map(g => `<div class="tarjeta">
      <div class="tarjeta-cab"><b>${ico(GRUPOS[g].icono)} ${GRUPOS[g].nombre}</b><span class="cuenta">te votaría el ${Math.round(reparto[g][o.partido] * 100)}%</span></div>
      <div class="barra-rel"><span style="left:${(o.imagen[g] + 15) / 30 * 100}%"></span></div>
      <p class="nota">Imagen ${signo(o.imagen[g]) || '0'} (de −15 a +15).</p></div>`).join('')}`;
}

function tabParlamentoOposicion() {
  const s = estado, o = miOpositor();
  const leyenda = ORDEN_HEMICICLO.map(pid => {
    const P = partidoInfo(s, pid), etiqueta = pid === ID_JUGADOR ? chip('gobierna') : pid === o.partido ? chip('tú', 'pos') : P.humano ? chip('jugador') : '';
    return `<div>${logoPartido(P, 'mini')}<b>${esc(P.nombre)}</b><small class="lider">${esc(P.lider)}</small><span>${s.escanos[pid]} escaños</span>${etiqueta}</div>`;
  }).join('');
  const tarjeta = ley => {
    const derogar = !!s.leyes[ley.id], prop = propuestaOposicion(s, o, ley.id, derogar), r = intencionVoto(s, prop);
    return `<div class="tarjeta ${derogar ? 'vigente' : ''}">
      <div class="tarjeta-cab"><b>${derogar ? 'Derogar: ' : ''}${ley.nombre}</b><span class="tags">${ley.tags.map(t => ETIQUETAS[t]).join(', ') || 'Neutral'}</span></div>
      <p>${ley.desc}</p><div class="chips">${chipsLey(ley)}${chip(r.aprueba ? `Saldría: ${r.si} a ${r.no}` : `Caería: ${r.si} a ${r.no}`, r.aprueba ? 'pos' : 'neg')}</div>
      ${boton(`${derogar ? 'Proponer derogarla' : 'Presentarla'} <span class="coste">${ico('estrella')}${COSTE_LEY_OPOSICION}</span>`,
        { a: 'oposProponer', ley: ley.id, derogar: derogar ? 1 : 0 }, puedeLeyOposicion(s, o, ley.id, derogar), 'mini')}</div>`;
  };
  return `<h2>Parlamento</h2>${hemicicloSVG(s.escanos)}<div class="leyenda">${leyenda}</div>
    <p class="nota">Puedes presentar una ley al mes. Tu grupo la vota a favor; el del gobierno, según sus ideas; los demás, según las suyas.
      Si sale adelante, mejora tu imagen entre quienes se benefician.</p>
    <div class="filtros">${['todas', 'vigor', ...Object.keys(CATEGORIAS_LEY)].map(f => `<button class="${ui.filtroLey === f ? 'activa' : ''}" data-a="filtroLey" data-v="${f}">${f === 'todas' ? 'Todas' : f === 'vigor' ? 'En vigor' : CATEGORIAS_LEY[f]}</button>`).join('')}</div>
    ${LEYES.filter(l => ui.filtroLey === 'todas' || (ui.filtroLey === 'vigor' ? s.leyes[l.id] : l.cat === ui.filtroLey)).map(tarjeta).join('')}`;
}

function htmlIntroOposicion() {
  const s = estado, o = miOpositor(), G = partidoInfo(s, ID_JUGADOR);
  return `<h2>La oposición en ${esc(PAIS_JUGADOR.nombre)}</h2>
    <p>${esc(o.perfil.lider)}, tu partido ${esc(partidoInfo(s, o.partido).nombre)} comparte país con ${esc(G.lider)}, que gobierna con ${esc(G.nombre)}.</p>
    <ul class="ayuda">
      <li>${ico('megafono')}<div><b>Haz campaña</b><span>Mítines, carteles y denuncias te ganan votantes y se los quitan al gobierno.</span></div></li>
      <li>${ico('parlamento')}<div><b>Presenta leyes</b><span>Una al mes. Si salen adelante, los grupos a los que benefician te lo agradecen.</span></div></li>
      <li>${ico('balanza')}<div><b>Decide tu voto</b><span>Apoya, bloquea o vota según tus ideas lo que presente el gobierno.</span></div></li>
      <li>${ico('urna')}<div><b>Gana las elecciones</b><span>Si sacas más escaños que el gobierno, pasas a gobernar tú y quien gobernaba pasa a la oposición.</span></div></li>
    </ul>
    <button class="btn principal" data-a="cerrar">Empezar</button>`;
}
