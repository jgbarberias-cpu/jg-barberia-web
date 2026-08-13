(function () {
  const { db, collection, onSnapshot, query, orderBy, escapeHtml } = window.Panel.Storage;

  const RECORDATORIO_DIAS = 10;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmt(n) {
    return '$' + Number(n || 0).toLocaleString('es-AR');
  }

  function diasDesde(fecha) {
    if (!fecha) return null;
    const [y, m, d] = fecha.split('-').map(Number);
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
            <span class="resumen-turno__hora">${fmtHora(t.hora)}</span>
            <div class="resumen-turno__info">
              <span class="resumen-turno__cliente">${t.cliente}</span>
              <span class="resumen-turno__servicio">${t.servicioNombre} · ${t.fecha}</span>
            </div>
            <span class="badge badge--${t.estado}">${t.estado}</span>
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

  function renderBeneficios() {
    const el = document.getElementById('resumenBeneficios');
    if (!el) return;

    const WA_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

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
            <span class="notif-beneficio__nombre">${c.nombre}</span>
            <span class="notif-beneficio__label">${label} — corte N°${n}</span>
          </div>
          ${waUrl
            ? `<a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON} Avisar</a>`
            : '<span class="notif-sin-tel">Sin WA</span>'}
        </div>`;
    }).join('');
  }

  function renderFinanzasDueno() {
    const elHoy = document.getElementById('resumenDuenoHoy');
    const elMes = document.getElementById('resumenDuenoMes');
    if (!elHoy || !elMes) return;

    const dueno = cacheBarberos.find(b => b.comision === null);
    if (!dueno) { elHoy.textContent = '$0'; elMes.textContent = '$0'; return; }

    const hoy = todayISO();
    const mes = currentMonth();

    const ganHoy = cacheTurnos
      .filter(t => t.fecha === hoy && t.barbero === dueno.nombre && t.estado === 'completado')
      .reduce((s, t) => s + Number(t.precio || 0), 0);

    const ganMes = cacheTurnos
      .filter(t => t.fecha && t.fecha.startsWith(mes) && t.barbero === dueno.nombre && t.estado === 'completado')
      .reduce((s, t) => s + Number(t.precio || 0), 0);

    elHoy.textContent = fmt(ganHoy);
    elMes.textContent = fmt(ganMes);
  }

  function renderRecordatoriosHoy() {
    const el = document.getElementById('resumenRecordatoriosHoy');
    if (!el) return;

    const WA_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

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
      const pNombre = (c.nombre || '').split(' ')[0];
      const tel = normTelR(c.telefono);
      const msg = `Hola ${pNombre}! 👋 Ya pasaron 10 días desde tu último corte en JG Barbería. ¿Se viene una vuelta por la barbe? ✂️ Escribinos para sacar turno 💈`;
      const waUrl = `https://wa.me/549${tel}?text=${encodeURIComponent(msg)}`;
      return `
        <div class="notif-beneficio">
          <div class="notif-beneficio__info">
            <span class="notif-beneficio__nombre">${escapeHtml(c.nombre)}</span>
            <span class="notif-beneficio__label">10 días sin corte — último: ${c.ultimaVisita || '—'}</span>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON} Avisar</a>
        </div>`;
    }).join('');
  }

  function renderRecordatorios() {
    const el = document.getElementById('resumenRecordatorios');
    if (!el) return;

    const stats = new Map();
    cacheTurnos.forEach(t => {
      const key = (t.telefono || '').replace(/\D/g, '') || t.cliente;
      const prev = stats.get(key) || { nombre: t.cliente, ultima: '' };
      if (!prev.ultima || t.fecha > prev.ultima) prev.ultima = t.fecha;
      stats.set(key, prev);
    });

    const pendientes = cacheClientes
      .map(c => {
        const key = (c.telefono || '').replace(/\D/g, '') || c.nombre;
        const s = stats.get(key);
        const dias = s ? diasDesde(s.ultima) : null;
        return { nombre: c.nombre, dias };
      })
      .filter(c => c.dias !== null && c.dias >= RECORDATORIO_DIAS)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 5);

    if (pendientes.length === 0) {
      el.innerHTML = '<p class="resumen-empty">No hay recordatorios pendientes.</p>';
      return;
    }

    el.innerHTML = pendientes.map(c => `
      <div class="resumen-recordatorio">
        <span class="resumen-recordatorio__nombre">${c.nombre}</span>
        <span class="resumen-recordatorio__dias">${c.dias} días sin corte</span>
      </div>
    `).join('');
  }

  function render() {
    renderTurnos();
    renderFinanzas();
    renderFinanzasDueno();
    renderRecordatoriosHoy();
    renderRecordatorios();
    renderBeneficios();
  }

  function initResumen() {
    onSnapshot(query(collection(db, 'turnos'), orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });

    onSnapshot(query(collection(db, 'finanzas'), orderBy('fecha', 'desc')), snap => {
      cacheFinanzas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFinanzas();
    });

    onSnapshot(query(collection(db, 'clientes'), orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderRecordatoriosHoy();
      renderRecordatorios();
      renderBeneficios();
    });

    onSnapshot(query(collection(db, 'barberos'), orderBy('nombre')), snap => {
      cacheBarberos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFinanzasDueno();
    });
  }

  window.Panel.Resumen = { initResumen };
})();
