(function () {
  const { db, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } = window.Panel.Storage;

  const clientesCol  = collection(db, 'clientes');
  const turnosCol    = collection(db, 'turnos');
  const finanzasCol  = collection(db, 'finanzas');
  const serviciosCol = collection(db, 'servicios');

  let cacheClientes  = [];
  let cacheTurnos    = [];
  let cacheFinanzas  = [];
  let cacheServicios = [];
  let busqueda = '';

  const RECORDATORIO_DIAS = 14;

  function normTel(t) { return (t || '').replace(/\D/g, ''); }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function horaActual() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  function diasDesde(fecha) {
    if (!fecha) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    return Math.floor((new Date() - new Date(y, m - 1, d)) / 86400000);
  }

  function fmtFecha(f) {
    if (!f) return '-';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

  // ── Tabs empleado ──────────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.emp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab').forEach(t => t.classList.remove('is-active'));
        document.querySelectorAll('.emp-view').forEach(v => v.classList.remove('is-active'));
        tab.classList.add('is-active');
        document.getElementById(`empView${capitalize(tab.dataset.empView)}`).classList.add('is-active');
      });
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Vista Clientes ─────────────────────────────────────────────
  function statsCliente(cliente) {
    const key = normTel(cliente.telefono) || cliente.nombre.toLowerCase();
    let cantidad = 0, ultima = '', ultimoServicio = '';
    cacheTurnos.forEach(t => {
      const tKey = normTel(t.telefono) || (t.cliente || '').toLowerCase();
      if (tKey === key && t.estado === 'completado') {
        cantidad++;
        if (!ultima || t.fecha > ultima) { ultima = t.fecha; ultimoServicio = t.servicioNombre; }
      }
    });
    return { cantidad, ultima, ultimoServicio };
  }

  function renderLista() {
    const lista  = document.getElementById('empLista');
    const empty  = document.getElementById('empEmpty');
    const total  = document.getElementById('empTotal');
    if (!lista) return;

    const filtrado = cacheClientes
      .filter(c => {
        if (!busqueda) return true;
        const b = busqueda.toLowerCase();
        return c.nombre.toLowerCase().includes(b) || (c.telefono || '').includes(b);
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    total.textContent = `(${cacheClientes.length})`;
    empty.hidden = filtrado.length > 0;
    lista.innerHTML = '';

    filtrado.forEach(c => {
      const s = statsCliente(c);
      const dias = diasDesde(s.ultima);
      const recordatorio = dias !== null && dias >= RECORDATORIO_DIAS;
      const card = document.createElement('div');
      card.className = 'emp-card' + (recordatorio ? ' emp-card--alerta' : '');
      card.innerHTML = `
        <div class="emp-card__avatar">${c.nombre.charAt(0).toUpperCase()}</div>
        <div class="emp-card__info">
          <div class="emp-card__nombre">${c.nombre}</div>
          <div class="emp-card__tel">${c.telefono || 'Sin número'}</div>
          ${s.ultima
            ? `<div class="emp-card__ultima">Último corte: ${fmtFecha(s.ultima)} · ${s.ultimoServicio}</div>`
            : '<div class="emp-card__ultima">Sin visitas registradas</div>'}
        </div>
        <div class="emp-card__badges">
          ${s.cantidad > 0 ? `<span class="emp-badge emp-badge--visitas">${s.cantidad} corte${s.cantidad !== 1 ? 's' : ''}</span>` : ''}
          ${recordatorio ? `<span class="emp-badge emp-badge--recordar">Recordar (${dias}d)</span>` : ''}
        </div>
      `;
      lista.appendChild(card);
    });

    // Actualizar datalist para autocomplete en cortes
    const dl = document.getElementById('empClientesList');
    if (dl) {
      dl.innerHTML = cacheClientes
        .map(c => `<option value="${c.nombre}">`)
        .join('');
    }
  }

  function initFormClientes() {
    document.getElementById('empBuscar').addEventListener('input', e => {
      busqueda = e.target.value.trim();
      renderLista();
    });

    document.getElementById('empForm').addEventListener('submit', async e => {
      e.preventDefault();
      const nombre   = document.getElementById('empNombre').value.trim();
      const telRaw   = document.getElementById('empTelefono').value.trim();
      const telefono = normTel(telRaw);
      const msg      = document.getElementById('empMsg');

      const existe = cacheClientes.find(c => normTel(c.telefono) === telefono && telefono);
      if (existe) {
        msg.textContent = `${existe.nombre} ya está registrado.`;
        msg.style.color = 'var(--gold)';
        msg.hidden = false;
        setTimeout(() => { msg.hidden = true; }, 3000);
        return;
      }

      await addDoc(clientesCol, { nombre, telefono: telRaw, notas: '' });
      document.getElementById('empForm').reset();
      msg.textContent = `✓ ${nombre} registrado correctamente.`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Vista Finanzas del día ─────────────────────────────────────
  function populateServicios() {
    const sel = document.getElementById('empCorteServicio');
    if (!sel) return;
    const activos = cacheServicios.filter(s => s.activo !== false);
    sel.innerHTML = activos.map(s => `<option value="${s.id}" data-precio="${s.precio}" data-nombre="${s.nombre}">${s.nombre} (${fmt(s.precio)})</option>`).join('');
    if (activos.length > 0) {
      document.getElementById('empCortePrecio').value = activos[0].precio;
    }
  }

  function renderCortes() {
    const hoy   = todayISO();
    const lista  = document.getElementById('empCortesLista');
    const empty  = document.getElementById('empCortesEmpty');
    const totalEl = document.getElementById('empTotalDia');
    if (!lista) return;

    const cortesHoy = cacheFinanzas
      .filter(f => f.fecha === hoy && f.tipo === 'ingreso')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const total = cortesHoy.reduce((s, f) => s + Number(f.monto), 0);
    totalEl.textContent = fmt(total);
    empty.hidden = cortesHoy.length > 0;
    lista.innerHTML = '';

    cortesHoy.forEach(f => {
      const row = document.createElement('div');
      row.className = 'emp-corte-row';
      row.innerHTML = `
        <div class="emp-corte-info">
          <span class="emp-corte-desc">${f.descripcion}</span>
          <span class="emp-corte-cat">${f.categoria || ''}</span>
        </div>
        <div class="emp-corte-right">
          <span class="emp-corte-monto">${fmt(f.monto)}</span>
          <button class="emp-corte-del" data-id="${f.id}" title="Eliminar">✕</button>
        </div>
      `;
      lista.appendChild(row);
    });

    lista.querySelectorAll('.emp-corte-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar este corte?')) {
          await deleteDoc(doc(db, 'finanzas', btn.dataset.id));
        }
      });
    });
  }

  function initFormCortes() {
    const sel    = document.getElementById('empCorteServicio');
    const precio = document.getElementById('empCortePrecio');

    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      if (opt) precio.value = opt.dataset.precio;
    });

    document.getElementById('empCorteForm').addEventListener('submit', async e => {
      e.preventDefault();
      const cliente      = document.getElementById('empCorteCliente').value.trim();
      const opt          = sel.selectedOptions[0];
      const servicioNombre = opt ? opt.dataset.nombre : '';
      const servicioId   = opt ? opt.value : null;
      const monto        = Number(precio.value);
      const msg          = document.getElementById('empCorteMsg');

      if (!cliente || !monto) return;

      // Buscar telefono del cliente si existe en la base
      const clienteReg = cacheClientes.find(c => c.nombre.toLowerCase() === cliente.toLowerCase());
      const telefono   = clienteReg ? clienteReg.telefono : '';

      // Crear finanza (ingreso)
      const finanzaRef = await addDoc(finanzasCol, {
        tipo: 'ingreso',
        fecha: todayISO(),
        monto,
        descripcion: `${cliente} — ${servicioNombre}`,
        categoria: 'Servicios',
        origen: 'turno',
        turnoId: null,
        createdAt: serverTimestamp()
      });

      // Crear turno completado vinculado
      await addDoc(turnosCol, {
        cliente,
        telefono,
        fecha: todayISO(),
        hora: horaActual(),
        servicioId,
        servicioNombre,
        precio: monto,
        estado: 'completado',
        notas: '',
        facturado: true,
        finanzaId: finanzaRef.id,
        createdAt: serverTimestamp()
      });

      document.getElementById('empCorteForm').reset();
      populateServicios();
      msg.textContent = `✓ Corte de ${cliente} registrado — ${fmt(monto)}`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Init principal ────────────────────────────────────────────
  function initEmpleado(onLogout) {
    initTabs();
    initFormClientes();
    initFormCortes();

    onSnapshot(query(clientesCol, orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
    });

    onSnapshot(query(turnosCol, orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
      renderCortes();
    });

    onSnapshot(query(finanzasCol, orderBy('fecha', 'desc')), snap => {
      cacheFinanzas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCortes();
    });

    onSnapshot(query(serviciosCol, orderBy('nombre')), snap => {
      cacheServicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      populateServicios();
    });

    document.getElementById('empLogoutBtn').addEventListener('click', onLogout);
  }

  window.Panel.Empleado = { initEmpleado };
})();
