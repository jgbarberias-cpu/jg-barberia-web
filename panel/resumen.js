(function () {
  const { db, collection, onSnapshot, query, orderBy, escapeHtml } = window.Panel.Storage;

  const RECORDATORIO_DIAS = 10;
  const PERDIDO_DIAS = 30;     // más de esto sin venir = cliente perdido
  const PICO_DIAS = 60;        // ventana para días y horarios pico

  const WA_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Fecha local (no UTC) en formato YYYY-MM-DD
  function isoLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function todayISO() {
    return isoLocal(new Date());
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }

  // Lunes de la semana actual
  function inicioSemanaISO() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoLocal(d);
  }

  function fmt(n) {
    return '$' + Number(n || 0).toLocaleString('es-AR');
  }

  function diasDesde(fecha) {
    if (!fecha) return null;
    const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
    return Math.floor((new Date() - new Date(y, m - 1, d)) / 86400000);
  }

  function fmtHora(h) {
    return h ? h.slice(0, 5) : '';
  }

  let cacheTurnos = [], cacheFinanzas = [], cacheClientes = [], cacheBarberos = [];

  function renderTurnos() {
    const hoy = todayISO();
    const hoyTurnos = cacheTurnos
      .filter(t => t.fecha === hoy)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    const el = document.getElementById('resumenTurnosList');
    if (!el) return;

    if (hoyTurnos.length === 0) {
      const proximos = cacheTurnos
        .filter(t => t.fecha > hoy && t.estado !== 'cancelado')
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''))
        .slice(0, 3);

      if (proximos.length === 0) {
        el.innerHTML = '<p class="resumen-empty">No hay turnos programados próximamente.</p>';
        return;
      }

      el.innerHTML = '<p class="resumen-empty" style="margin-bottom:10px">No hay turnos hoy. Próximos:</p>' +
        proximos.map(t => `
          <div class="resumen-turno">
            <span class="resumen-turno__hora">${escapeHtml(fmtHora(t.hora))}</span>
            <div class="resumen-turno__info">
              <span class="resumen-turno__cliente">${escapeHtml(t.cliente)}</span>
              <span class="resumen-turno__servicio">${escapeHtml(t.servicioNombre)} · ${escapeHtml(t.fecha)}</span>
            </div>
            <span class="badge badge--${escapeHtml(t.estado)}">${escapeHtml(t.estado)}</span>
          </div>
        `).join('');
      return;
    }

    el.innerHTML = hoyTurnos.map(t => `
      <div class="resumen-turno">
        <span class="resumen-turno__hora">${escapeHtml(fmtHora(t.hora))}</span>
        <div class="resumen-turno__info">
          <span class="resumen-turno__cliente">${escapeHtml(t.cliente)}</span>
          <span class="resumen-turno__servicio">${escapeHtml(t.servicioNombre)}</span>
        </div>
        <span class="badge badge--${escapeHtml(t.estado)}">${escapeHtml(t.estado)}</span>
      </div>
    `).join('');
  }

  function renderFinanzas() {
    const mes = currentMonth();
    const rows = cacheFinanzas.filter(f => f.fecha && f.fecha.startsWith(mes));
    let ingresos = 0, egresos = 0;
    rows.forEach(f => {
      if (f.tipo === 'ingreso') ingresos += Number(f.monto);
      else egresos += Number(f.monto);
    });
    const ing = document.getElementById('resumenIngresos');
    const egr = document.getElementById('resumenEgresos');
    const bal = document.getElementById('resumenBalance');
    if (ing) ing.textContent = fmt(ingresos);
    if (egr) egr.textContent = fmt(egresos);
    if (bal) bal.textContent = fmt(ingresos - egresos);
  }

  function normTelR(t) { return (t || '').replace(/\D/g, ''); }

  // Texto del recordatorio de corte (el mismo está en empleado.js para el panel del empleado)
  function msgRecordatorio(nombre) {
    const pNombre = (nombre || '').trim().split(' ')[0];
    return `Hola ${pNombre}! Ya tenés el pelo largooo amigooo 💈 Avisame si querés que reservemos un turnito ✂️`;
  }

  function renderBeneficios() {
    const el = document.getElementById('resumenBeneficios');
    if (!el) return;

    const conBeneficio = cacheClientes.filter(c => {
      const n = c.cantidadCortes || 0;
      const mod = n % 10;
      return n > 0 && (mod === 3 || mod === 6 || mod === 0);
    });

    if (conBeneficio.length === 0) {
      el.innerHTML = '<p class="resumen-empty">Ningún cliente tiene beneficio disponible ahora.</p>';
      return;
    }

    el.innerHTML = conBeneficio.map(c => {
      const n   = c.cantidadCortes || 0;
      const mod = n % 10;
      const tel = normTelR(c.telefono);
      const pNombre = (c.nombre || '').split(' ')[0];
      const label = mod === 0 ? '🎁 Corte gratis' : mod === 6 ? '✂️ 50% de descuento' : '🥤 Bebida gratis';
      const msg = mod === 0
        ? `Hola ${pNombre}! 🎁 Llegaste a tu corte N°${n} en JG Barbería. ¡Tu próximo corte es GRATIS! Escribinos para reservar 💈`
        : mod === 6
        ? `Hola ${pNombre}! ✂️ Llegaste a tu corte N°${n} en JG Barbería. ¡Tu próximo corte tiene 50% de descuento! Escribinos para reservar 💈`
        : `Hola ${pNombre}! 🥤 Llegaste a tu corte N°${n} en JG Barbería. ¡Tenés una bebida gratis esperándote! Pasá cuando quieras 💈`;
      const waUrl = tel ? `https://wa.me/549${tel}?text=${encodeURIComponent(msg)}` : null;
      return `
        <div class="notif-beneficio">
          <div class="notif-beneficio__info">
            <span class="notif-beneficio__nombre">${escapeHtml(c.nombre)}</span>
            <span class="notif-beneficio__label">${escapeHtml(label)} — corte N°${n}</span>
          </div>
          ${waUrl
            ? `<a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON} Avisar</a>`
            : '<span class="notif-sin-tel">Sin WA</span>'}
        </div>`;
    }).join('');
  }

  function calcGananciaDueno(turnos) {
    // Total bruto de todos los cortes
    const bruto = turnos.reduce((s, t) => s + Number(t.precio || 0), 0);
    // Comisiones a pagar a empleados (barberos con comision !== null)
    const empleados = cacheBarberos.filter(b => b.comision !== null && b.comision > 0);
    let comisiones = 0;
    empleados.forEach(emp => {
      const qty = turnos.filter(t => t.barbero === emp.nombre).length;
      comisiones += qty * Number(emp.comision);
    });
    return { neto: bruto - comisiones, bruto, comisiones };
  }

  function renderFinanzasDueno() {
    const elHoy = document.getElementById('resumenDuenoHoy');
    const elMes = document.getElementById('resumenDuenoMes');
    if (!elHoy || !elMes) return;

    const hoy = todayISO();
    const mes = currentMonth();

    const turnosHoy = cacheTurnos.filter(t => t.fecha === hoy && t.estado === 'completado');
    const turnosMes = cacheTurnos.filter(t => t.fecha && t.fecha.startsWith(mes) && t.estado === 'completado');

    const resHoy = calcGananciaDueno(turnosHoy);
    const resMes = calcGananciaDueno(turnosMes);

    elHoy.textContent = fmt(resHoy.neto);
    elMes.textContent = fmt(resMes.neto);

    // Subtítulo con desglose
    const subHoy = document.getElementById('resumenDuenoSubHoy');
    const subMes = document.getElementById('resumenDuenoSubMes');
    if (subHoy) subHoy.textContent = `${fmt(resHoy.bruto)} bruto − ${fmt(resHoy.comisiones)} comisiones`;
    if (subMes) subMes.textContent = `${fmt(resMes.bruto)} bruto − ${fmt(resMes.comisiones)} comisiones`;
  }

  function renderRecordatoriosHoy() {
    const el = document.getElementById('resumenRecordatoriosHoy');
    if (!el) return;

    const paraHoy = cacheClientes.filter(c => diasDesde(c.ultimaVisita) === RECORDATORIO_DIAS && c.telefono);

    const badge = document.getElementById('resumenRecordatoriosHoyBadge');
    if (badge) {
      badge.textContent = paraHoy.length || '';
      badge.style.display = paraHoy.length ? 'inline-flex' : 'none';
    }

    if (paraHoy.length === 0) {
      el.innerHTML = '<p class="resumen-empty">No hay recordatorios para enviar hoy.</p>';
      return;
    }

    el.innerHTML = paraHoy.map(c => {
      const tel = normTelR(c.telefono);
      const msg = msgRecordatorio(c.nombre);
      const waUrl = `https://wa.me/549${tel}?text=${encodeURIComponent(msg)}`;
      return `
        <div class="notif-beneficio">
          <div class="notif-beneficio__info">
            <span class="notif-beneficio__nombre">${escapeHtml(c.nombre)}</span>
            <span class="notif-beneficio__label">10 días sin corte — último: ${escapeHtml(c.ultimaVisita) || '—'}</span>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON} Avisar</a>
        </div>`;
    }).join('');
  }

  // ── Comisiones a pagar a cada empleado: semana (desde el lunes) y mes ──
  function renderComisiones() {
    const el = document.getElementById('resumenComisiones');
    if (!el) return;

    const hoy = todayISO();
    const semana = inicioSemanaISO();
    const mes = currentMonth();
    const sub = document.getElementById('resumenComisionesSub');
    if (sub) {
      const [, m, d] = semana.split('-');
      sub.textContent = `Semana desde el lunes ${d}/${m} · cortes completados × comisión`;
    }

    const filas = cacheBarberos
      .filter(b => b.comision !== null && Number(b.comision) > 0)
      .map(b => {
        const cortes = cacheTurnos.filter(t =>
          t.barbero === b.nombre && t.estado === 'completado' && t.fecha && t.fecha <= hoy);
        return {
          b,
          sem: cortes.filter(t => t.fecha >= semana).length,
          mes: cortes.filter(t => t.fecha.startsWith(mes)).length
        };
      })
      // Los inactivos solo si tienen algo para cobrar
      .filter(f => f.b.activo !== false || f.sem || f.mes);

    if (filas.length === 0) {
      el.innerHTML = '<p class="resumen-empty">No hay empleados con comisión cargada.</p>';
      return;
    }

    let totSem = 0, totMes = 0;
    const celda = (n, c) => `<span class="resumen-tabla__monto">${fmt(n * c)}</span><span class="resumen-tabla__cortes">${n} corte${n !== 1 ? 's' : ''}</span>`;
    const rows = filas.map(({ b, sem, mes: m }) => {
      const c = Number(b.comision);
      totSem += sem * c;
      totMes += m * c;
      return `<tr><td>${escapeHtml(b.apodo || b.nombre)}</td><td>${celda(sem, c)}</td><td>${celda(m, c)}</td></tr>`;
    }).join('');

    el.innerHTML = `
      <table class="resumen-tabla">
        <thead><tr><th>Barbero</th><th>Esta semana</th><th>Este mes</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td>${fmt(totSem)}</td><td>${fmt(totMes)}</td></tr></tfoot>
      </table>`;
  }

  // ── Este mes contra el anterior, hasta el mismo día ──
  function variacion(actual, anterior) {
    if (!anterior) return actual ? '<span class="var var--up">nuevo</span>' : '<span class="var">—</span>';
    const pct = Math.round((actual - anterior) / anterior * 100);
    if (pct === 0) return '<span class="var">= igual</span>';
    return `<span class="var ${pct > 0 ? 'var--up' : 'var--down'}">${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%</span>`;
  }

  function renderComparacion() {
    const el = document.getElementById('resumenComparacion');
    if (!el) return;

    const ahora = new Date();
    const dia = ahora.getDate();
    const mesAct = currentMonth();
    const hastaAct = todayISO();
    const prev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesPrev = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
    const diasMesPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    const diaPrev = Math.min(dia, diasMesPrev);
    const hastaPrev = `${mesPrev}-${pad2(diaPrev)}`;
    const nombreMesPrev = prev.toLocaleString('es-AR', { month: 'long' });

    const enRango = (f, mes, hasta) => !!f && f.startsWith(mes) && f <= hasta;
    const contarCortes = (mes, hasta) =>
      cacheTurnos.filter(t => t.estado === 'completado' && enRango(t.fecha, mes, hasta)).length;
    const sumarIngresos = (mes, hasta) => cacheFinanzas
      .filter(f => f.tipo === 'ingreso' && enRango(f.fecha, mes, hasta))
      .reduce((s, f) => s + Number(f.monto || 0), 0);

    const cAct = contarCortes(mesAct, hastaAct), cPrev = contarCortes(mesPrev, hastaPrev);
    const iAct = sumarIngresos(mesAct, hastaAct), iPrev = sumarIngresos(mesPrev, hastaPrev);

    el.innerHTML = `
      <div class="resumen-stats-row">
        <div class="resumen-stat">
          <span class="resumen-stat__num">${cAct}</span>
          <span class="resumen-stat__label">Cortes ${variacion(cAct, cPrev)}</span>
          <span class="resumen-stat__sub">${cPrev} al ${diaPrev} de ${escapeHtml(nombreMesPrev)}</span>
        </div>
        <div class="resumen-stat resumen-stat--ingreso">
          <span class="resumen-stat__num">${fmt(iAct)}</span>
          <span class="resumen-stat__label">Ingresos ${variacion(iAct, iPrev)}</span>
          <span class="resumen-stat__sub">${fmt(iPrev)} al ${diaPrev} de ${escapeHtml(nombreMesPrev)}</span>
        </div>
      </div>`;
  }

  // ── Clientes perdidos: más de 30 días sin venir ──
  function renderPerdidos() {
    const el = document.getElementById('resumenPerdidos');
    if (!el) return;

    // Primero los que se fueron hace menos: son los más fáciles de recuperar
    const perdidos = cacheClientes
      .map(c => ({ ...c, dias: diasDesde(c.ultimaVisita) }))
      .filter(c => c.dias !== null && c.dias > PERDIDO_DIAS && normTelR(c.telefono))
      .sort((a, b) => a.dias - b.dias);

    const badge = document.getElementById('resumenPerdidosBadge');
    if (badge) {
      badge.textContent = perdidos.length || '';
      badge.style.display = perdidos.length ? 'inline-flex' : 'none';
    }

    if (perdidos.length === 0) {
      el.innerHTML = '<p class="resumen-empty">No hay clientes con más de 30 días sin venir.</p>';
      return;
    }

    el.innerHTML = perdidos.map(c => {
      const waUrl = `https://wa.me/549${normTelR(c.telefono)}?text=${encodeURIComponent(msgRecordatorio(c.nombre))}`;
      return `
        <div class="notif-beneficio">
          <div class="notif-beneficio__info">
            <span class="notif-beneficio__nombre">${escapeHtml(c.nombre)}</span>
            <span class="notif-beneficio__label">${Number(c.dias)} días sin venir</span>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON} Avisar</a>
        </div>`;
    }).join('');
  }

  // ── Días y horarios pico (cortes completados de los últimos 60 días) ──
  function barrasPico(items) {
    const max = Math.max(1, ...items.map(i => i.n));
    return `<div class="pico__barras">${items.map(i => `
      <div class="pico__col${i.n === max && i.n > 0 ? ' pico__col--max' : ''}" title="${i.n} corte${i.n !== 1 ? 's' : ''}">
        <span class="pico__num">${i.n || ''}</span>
        <div class="pico__barra" style="height:${Math.round(i.n / max * 100)}%"></div>
        <span class="pico__label">${i.label}</span>
      </div>`).join('')}</div>`;
  }

  function renderPico() {
    const el = document.getElementById('resumenPico');
    if (!el) return;

    const desde = new Date();
    desde.setDate(desde.getDate() - PICO_DIAS);
    const desdeISO = isoLocal(desde);
    const hoy = todayISO();
    const cortes = cacheTurnos.filter(t =>
      t.estado === 'completado' && t.fecha && t.fecha >= desdeISO && t.fecha <= hoy);

    if (cortes.length === 0) {
      el.innerHTML = '<p class="resumen-empty">Todavía no hay cortes en los últimos 60 días.</p>';
      return;
    }

    // Lunes primero
    const nombresDia = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    const porHora = {};
    cortes.forEach(t => {
      const [y, m, d] = t.fecha.split('-').map(Number);
      porDia[(new Date(y, m - 1, d).getDay() + 6) % 7]++;
      const h = parseInt(String(t.hora || '').slice(0, 2), 10);
      if (!isNaN(h)) porHora[h] = (porHora[h] || 0) + 1;
    });

    const horas = Object.keys(porHora).map(Number);
    const hMin = Math.min(...horas), hMax = Math.max(...horas);
    const itemsHora = [];
    for (let h = hMin; h <= hMax; h++) itemsHora.push({ label: `${h}h`, n: porHora[h] || 0 });

    el.innerHTML = `
      <div class="pico">
        <div class="pico__bloque">
          <div class="pico__titulo">Por día de la semana</div>
          ${barrasPico(porDia.map((n, i) => ({ label: nombresDia[i], n })))}
        </div>
        ${horas.length ? `
        <div class="pico__bloque">
          <div class="pico__titulo">Por hora</div>
          ${barrasPico(itemsHora)}
        </div>` : ''}
      </div>
      <p class="resumen-card__sub">${cortes.length} cortes completados en los últimos ${PICO_DIAS} días</p>`;
  }

  function render() {
    renderTurnos();
    renderFinanzas();
    renderFinanzasDueno();
    renderComisiones();
    renderComparacion();
    renderRecordatoriosHoy();
    renderBeneficios();
    renderPerdidos();
    renderPico();
  }

  function initResumen() {
    onSnapshot(query(collection(db, 'turnos'), orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });

    onSnapshot(query(collection(db, 'finanzas'), orderBy('fecha', 'desc')), snap => {
      cacheFinanzas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFinanzas();
      renderComparacion();
    });

    onSnapshot(query(collection(db, 'clientes'), orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderRecordatoriosHoy();
      renderBeneficios();
      renderPerdidos();
    });

    onSnapshot(query(collection(db, 'barberos'), orderBy('nombre')), snap => {
      cacheBarberos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFinanzasDueno();
      renderComisiones();
    });
  }

  window.Panel.Resumen = { initResumen };
})();
