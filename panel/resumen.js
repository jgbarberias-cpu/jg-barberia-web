(function () {
  const { db, collection, onSnapshot, query, orderBy } = window.Panel.Storage;

  const RECORDATORIO_DIAS = 14;

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

  let cacheTurnos = [], cacheFinanzas = [], cacheClientes = [];

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
        <span class="resumen-turno__hora">${fmtHora(t.hora)}</span>
        <div class="resumen-turno__info">
          <span class="resumen-turno__cliente">${t.cliente}</span>
          <span class="resumen-turno__servicio">${t.servicioNombre}</span>
        </div>
        <span class="badge badge--${t.estado}">${t.estado}</span>
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
    renderRecordatorios();
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
      renderRecordatorios();
    });
  }

  window.Panel.Resumen = { initResumen };
})();
