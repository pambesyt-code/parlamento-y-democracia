'use strict';
// Pantallas de defensa y guerra: tu ejército, los frentes abiertos, la paz y el parte de cada batalla.

const porcentaje = p => `${Math.round(p * 100)}%`;

function tarjetaGuerra(pid) {
  const s = estado, P = PAISES[pid], E = s.paises[pid], g = s.guerras[pid];
  const paz = opcionesPaz(s, pid), objetivos = provinciasAtacables(s, pid);
  const estados = [paz.tuyas.length && chip(`Ocupas ${paz.tuyas.length} de sus ${provinciasDe(pid).length} provincias`, 'pos'),
    paz.suyas.length && chip(`Te ocupa ${paz.suyas.length}`, 'neg'), g.agresor ? chip('La empezaste tú') : chip('Te atacaron')].filter(Boolean).join('');

  const filasAtaque = objetivos.map(o => {
    const p = PROV_POR_ID[o.id], info = infoAtaque(s, o.id, o.naval);
    const notas = [o.liberar && 'es tuya: liberarla', o.naval && 'desembarco por mar', p.capital && p.pais === pid && 'su capital'].filter(Boolean).join(', ');
    return `<div class="objetivo ${ui.objetivo === o.id ? 'marcado' : ''}">
      <div><b>${p.nombre}</b>${notas ? `<small>${notas}</small>` : ''}</div>
      <span class="prob ${info.prob >= 0.6 ? 'pos' : info.prob < 0.4 ? 'neg' : ''}" title="Probabilidad de ganar">${porcentaje(info.prob)}</span>
      ${boton(`Atacar ${ico('estrella')}1`, { a: 'atacar', v: o.id }, puedeAtacar(s, o.id), 'mini')}</div>`;
  }).join('');

  return `<div class="tarjeta tramite">
    <div class="tarjeta-cab"><b>${bandera(pid)} Guerra con ${P.nombre}</b><span class="cuenta">${g.meses ? `dura ${plural(g.meses, 'mes', 'meses')}` : 'acaba de empezar'}</span></div>
    ${duelo([[esc(PAIS_JUGADOR.nombre), fuerzaPropia(s), PAIS_JUGADOR.colores[1]], [P.nombre, E.ejercito, P.color]], Math.max(10, fuerzaPropia(s), E.ejercito))}
    <div class="chips">${estados}</div>
    <h4>Atacar una provincia</h4>
    ${filasAtaque || `<p class="nota">No llegas a ninguna de sus provincias. ${P.isla ? 'Solo se alcanzan por mar: te hace falta un puerto.' : 'Necesitas una frontera con ellas o un puerto.'}</p>`}
    <p class="nota">Quien defiende tiene ventaja. Por mar atacas con un 25% menos de fuerza. Lo ocupado no es tuyo hasta firmar la paz, salvo que ocupes el país entero.</p>
    <h4>Negociar la paz</h4>
    ${paz.opciones.map(o => `<div class="paz"><div><b>${o.texto}</b><small>${o.desc}</small></div>
      ${boton('Proponer', { a: 'paz', pais: pid, v: o.id }, o.acepta ? { ok: true } : { ok: false, motivo: o.motivo }, 'mini')}</div>`).join('')}
  </div>`;
}

function tabDefensa() {
  const s = estado, cap = capacidadTropas(s), amigos = aliados(s), vivos = paisesVivos(s);
  const guerras = Object.keys(s.guerras).map(tarjetaGuerra).join('');
  const maximo = Math.max(10, fuerzaDefensa(s), ...vivos.map(pid => s.paises[pid].ejercito));
  return `<h2>Defensa</h2>
    <p class="nota">Cada regimiento cuesta ${MANT_TROPA} al mes y el doble en guerra. Su moral sube con la estabilidad del país.</p>
    <div class="tarjeta">
      <div class="tarjeta-cab"><b>${ico('espadas')} Tu ejército</b><span class="cuenta">fuerza ${fuerzaPropia(s)}</span></div>
      <div class="regimientos" aria-label="${s.tropas} regimientos de ${cap}">${'<i class="reg"></i>'.repeat(s.tropas)}${'<i class="reg vacio"></i>'.repeat(Math.max(0, cap - s.tropas))}</div>
      <div class="fila"><span>Regimientos</span><b>${s.tropas} de ${cap}</b></div>
      <div class="fila"><span>Moral</span><b>${porcentaje(moral(s))}</b></div>
      ${amigos.length ? `<div class="fila"><span>Aliados que te defenderían</span><b>${amigos.map(pid => PAISES[pid].nombre).join(', ')}</b></div>` : ''}
      <p class="nota">Caben 2 regimientos, 3 más por cada cuartel y 2 más con el servicio militar.</p>
      <div class="botones">${boton(`Reclutar un regimiento ${ico('moneda')}${costeReclutar(s)}`, { a: 'reclutar' }, puedeReclutar(s), 'mini')}
        <button class="btn mini" data-a="licenciar" ${s.tropas ? '' : 'disabled'}>Licenciar uno</button></div>
    </div>
    ${guerras || '<p class="nota">Estás en paz. Para declarar una guerra, ve a Diplomacia y elige el país.</p>'}
    <h3>Equilibrio de fuerzas</h3>
    ${duelo([[`${bandera(PAIS_JUGADOR.id)} ${esc(PAIS_JUGADOR.nombre)}`, fuerzaDefensa(s), PAIS_JUGADOR.colores[1]],
      ...[...vivos].sort((a, b) => s.paises[b].ejercito - s.paises[a].ejercito).map(pid => [`${bandera(pid)} ${PAISES[pid].nombre}`, s.paises[pid].ejercito, PAISES[pid].color])], maximo)}
    <p class="nota">Tu cifra es la fuerza con la que defiendes, aliados incluidos. Un vecino más fuerte que te deteste acabará reclamando tierras.</p>`;
}

// ---------- Ventanas ----------

function htmlDeclarar(pid) {
  const s = estado, P = PAISES[pid], E = s.paises[pid], objetivos = provinciasAtacables(s, pid);
  const porMar = objetivos.length && objetivos.every(o => o.naval);
  const rival = P.rival && s.paises[P.rival] && !s.paises[P.rival].eliminado ? PAISES[P.rival].nombre : null;
  return `<div class="ev-cab"><span class="ev-ico">${ico('espadas')}</span><h2>¿Declarar la guerra a ${P.nombre}?</h2></div>
    ${duelo([[esc(PAIS_JUGADOR.nombre), fuerzaPropia(s), PAIS_JUGADOR.colores[1]], [P.nombre, E.ejercito, P.color]], Math.max(10, fuerzaPropia(s), E.ejercito))}
    <ul class="ayuda">
      <li>${ico('globo')}<div><b>El mundo toma nota</b><span>Tu relación con los demás países baja 10${rival ? `, salvo con ${rival}, su rival, que sube 10` : ''}.</span></div></li>
      <li>${ico('moneda')}<div><b>La guerra cuesta</b><span>El ejército cuesta el doble, la estabilidad baja y la gente se cansa cada mes que dura.</span></div></li>
      <li>${ico('mapa')}<div><b>Llegas a ${plural(objetivos.length, 'provincia', 'provincias')}</b><span>${porMar ? 'Todas por mar: atacarás con un 25% menos de fuerza.' : 'Cada provincia que ocupes te acerca a las siguientes.'}</span></div></li>
    </ul>
    <div class="botones">${boton(`Declarar la guerra ${ico('estrella')}${CP_DECLARAR_GUERRA}`, { a: 'declarar', v: pid }, puedeDeclararGuerra(s, pid), 'principal')}
      <button class="btn" data-a="cerrar">Mejor no</button></div>`;
}

function htmlBatalla() {
  const s = estado, b = s.batallas[0], p = PROV_POR_ID[b.prov], X = PAISES[b.enemigo].nombre;
  const titulo = b.ataque ? (b.liberar ? `Asalto para liberar ${p.nombre}` : `Ataque sobre ${p.nombre}`) : `${X} ataca ${p.nombre}`;
  const desenlace = b.ataque
    ? (b.exito ? (b.liberar ? 'La provincia vuelve a estar en tus manos.' : 'Tus tropas ocupan la provincia.') : 'El asalto fracasa y tus tropas se repliegan.')
    : (b.exito ? 'Tus tropas aguantan la posición.' : (p.pais === PAIS_JUGADOR.id ? `${X} ocupa la provincia.` : `${X} la recupera.`));
  const bajas = [b.bajasPropias ? chip(`Pierdes ${plural(b.bajasPropias, 'regimiento', 'regimientos')}`, 'neg') : chip('Sin bajas propias', 'pos'),
    b.bajasEnemigas ? chip(`${X} pierde fuerza`, 'pos') : chip(`${X} no pierde fuerza`)].join('');
  return `<div class="ev-cab"><span class="ev-ico">${ico('espadas')}</span><h2>${titulo}</h2></div>
    <div class="batalla">
      <div class="batalla-barra"><i style="width:${b.prob * 100}%"></i></div>
      <div class="batalla-pie"><span>Tenías un ${porcentaje(b.prob)} de ganar${b.naval ? ', con desembarco por mar' : ''}</span></div>
      <div class="sello visto ${b.exito ? 'si' : 'no'}">${b.exito ? 'Victoria' : 'Derrota'}</div>
    </div>
    <p>${desenlace}</p><div class="chips">${bajas}</div>
    <button class="btn principal" data-a="cerrarBatalla">${s.batallas.length > 1 ? 'Ver la siguiente batalla' : 'Continuar'}</button>`;
}
