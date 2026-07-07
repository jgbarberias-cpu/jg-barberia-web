(function () {
  const { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } = window.Panel.Storage;

  const clientesCol  = collection(db, 'clientes');
  const turnosCol    = collection(db, 'turnos');
  const finanzasCol  = collection(db, 'finanzas');
  const serviciosCol = collection(db, 'servicios');
  const barberosCol  = collection(db, 'barberos');

  let cacheClientes  = [];
  let cacheTurnos    = [];
  let cacheFinanzas  = [];
  let cacheServicios = [];
  let cacheBarberos  = [];
  let busqueda = '';

  const RECORDATORIO_DIAS = 14;

  const BARBEROS_DEFAULT = [
    { nombre: 'Santiago Barone',  apodo: 'Santy', comision: 5000, activo: true },
    { nombre: 'Sebastian Peralta', apodo: 'Seba',  comision: 5000, activo: true },
    { nombre: 'Juan Griguoli',    apodo: 'Juan',  comision: null,  activo: true },
  ];

  function getBarberos() {
    return cacheBarberos.length > 0 ? cacheBarberos : BARBEROS_DEFAULT;
  }

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
    const lista = document.getElementById('empLista');
    const empty = document.getElementById('empEmpty');
    const total = document.getElementById('empTotal');
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
      const telNorm = normTel(c.telefono);
      const waHref  = telNorm ? `https://wa.me/549${telNorm}` : null;
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
          ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="emp-card__wa${recordatorio ? ' emp-card__wa--urgente' : ''}">WhatsApp</a>` : ''}
        </div>
      `;
      lista.appendChild(card);
    });

    const dl = document.getElementById('empClientesList');
    if (dl) dl.innerHTML = cacheClientes.map(c => `<option value="${c.nombre}">`).join('');
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
      window.Panel.Sheets.logCliente({ nombre, telefono: telRaw, notas: '' }, 'Nuevo');
      document.getElementById('empForm').reset();
      msg.textContent = `✓ ${nombre} registrado correctamente.`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Contadores por barbero (dinámico desde DB) ─────────────────
  function renderContadores() {
    const hoy  = todayISO();
    const grid = document.getElementById('empContadoresGrid');
    if (!grid) return;

    let totalCortes = 0, totalDinero = 0;
    const activos = getBarberos().filter(b => b.activo !== false);

    grid.innerHTML = activos.map(b => {
      const cortes = cacheTurnos.filter(t =>
        t.fecha === hoy && t.barbero === b.nombre && t.estado === 'completado'
      );
      const dinero = cortes.reduce((s, t) => s + Number(t.precio || 0), 0);
      totalCortes += cortes.length;
      totalDinero += dinero;
      const para = b.comision != null ? cortes.length * b.comision : null;
      const display = (b.apodo || b.nombre).toUpperCase();
      return `
        <div class="emp-counter-card">
          <div class="emp-counter-name">${display}</div>
          <button class="emp-counter-btn" data-barbero="${b.nombre}" data-display="${display}">+</button>
          <div class="emp-counter-stats">
            <span class="emp-counter-num">${cortes.length}</span>
            <span class="emp-counter-label">cortes hoy</span>
          </div>
          <div class="emp-counter-money">${fmt(dinero)}</div>
          ${para !== null ? `<div class="emp-counter-comision">${fmt(para)} para ${b.apodo || b.nombre}</div>` : ''}
        </div>`;
    }).join('');

    const totalEl = document.getElementById('cntTotal');
    if (totalEl) totalEl.textContent = `${totalCortes} corte${totalCortes !== 1 ? 's' : ''} — ${fmt(totalDinero)}`;
  }

  // ── Resumen mensual en Finanzas ────────────────────────────────
  function renderResumenMes() {
    const ahora     = new Date();
    const mesISO    = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const mesNombre = ahora.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
    const periodoEl = document.getElementById('finMesPeriodo');
    if (periodoEl) periodoEl.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

    const grid = document.getElementById('finMesGrid');
    if (!grid) return;

    let totalCortes = 0, totalDinero = 0;
    const activos = getBarberos().filter(b => b.activo !== false);

    grid.innerHTML = activos.map(b => {
      const cortes = cacheTurnos.filter(t =>
        t.fecha && t.fecha.startsWith(mesISO) && t.barbero === b.nombre && t.estado === 'completado'
      );
      const dinero = cortes.reduce((s, t) => s + Number(t.precio || 0), 0);
      totalCortes += cortes.length;
      totalDinero += dinero;
      const comisionLine = b.comision != null
        ? `<div class="emp-mes-card__comision">${fmt(cortes.length * b.comision)} para ${b.apodo || b.nombre}</div>`
        : '';
      return `
        <div class="emp-mes-card">
          <div class="emp-mes-card__nombre">${(b.apodo || b.nombre).toUpperCase()}</div>
          <div class="emp-mes-card__cortes">${cortes.length} corte${cortes.length !== 1 ? 's' : ''}</div>
          <div class="emp-mes-card__dinero">${fmt(dinero)}</div>
          ${comisionLine}
        </div>`;
    }).join('');

    const totalEl = document.getElementById('finMesTotal');
    if (totalEl) totalEl.textContent = `${totalCortes} corte${totalCortes !== 1 ? 's' : ''} — ${fmt(totalDinero)}`;
  }

  // ── Inicializar modal de contador ──────────────────────────────
  function initContadores() {
    const modal     = document.getElementById('counterModal');
    const form      = document.getElementById('counterForm');
    const barbInput = document.getElementById('counterBarbero');
    const cliInput  = document.getElementById('counterCliente');
    const wppInput  = document.getElementById('counterWpp');
    const titleEl   = document.getElementById('counterModalTitle');
    const nuevoMsg  = document.getElementById('counterNuevoMsg');

    function refreshDatalist() {
      const dl = document.getElementById('counterClientesList');
      if (dl) dl.innerHTML = cacheClientes.map(c => `<option value="${c.nombre}">`).join('');
    }

    // Event delegation: el grid se regenera en cada render
    document.getElementById('empContadoresGrid').addEventListener('click', e => {
      const btn = e.target.closest('.emp-counter-btn');
      if (!btn) return;
      barbInput.value = btn.dataset.barbero;
      titleEl.textContent = `Corte — ${btn.dataset.display}`;
      cliInput.value = '';
      wppInput.value = '';
      nuevoMsg.hidden = true;
      refreshDatalist();
      modal.showModal();
      setTimeout(() => cliInput.focus(), 80);
    });

    cliInput.addEventListener('input', () => {
      const nombre = cliInput.value.trim();
      if (!nombre) { nuevoMsg.hidden = true; wppInput.value = ''; return; }
      const existe = cacheClientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (existe) {
        wppInput.value = existe.telefono || '';
        nuevoMsg.hidden = true;
      } else {
        wppInput.value = '';
        nuevoMsg.textContent = `"${nombre}" no está en la base — se creará como cliente nuevo`;
        nuevoMsg.hidden = false;
      }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const barbero       = barbInput.value;
      const clienteNombre = cliInput.value.trim();
      const wpp           = wppInput.value.trim();
      if (!clienteNombre) return;

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;

      try {
        const servicio       = cacheServicios[0];
        const precio         = servicio ? servicio.precio : 9000;
        const servicioNombre = servicio ? servicio.nombre : 'Corte';
        const servicioId     = servicio ? servicio.id : null;

        const clienteReg = cacheClientes.find(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());
        let telefono = wpp;

        if (!clienteReg) {
          await addDoc(clientesCol, { nombre: clienteNombre, telefono: wpp, notas: '' });
          window.Panel.Sheets.logCliente({ nombre: clienteNombre, telefono: wpp, instagram: '', email: '', notas: '' }, 'Nuevo');
        } else {
          telefono = clienteReg.telefono || wpp;
          if (!clienteReg.telefono && wpp) {
            await updateDoc(doc(db, 'clientes', clienteReg.id), { telefono: wpp });
            window.Panel.Sheets.logCliente({ nombre: clienteNombre, telefono: wpp, instagram: '', email: '', notas: '' }, 'Actualizado');
          }
        }

        const finanzaRef = await addDoc(finanzasCol, {
          tipo: 'ingreso', fecha: todayISO(), monto: precio,
          descripcion: `${clienteNombre} — ${servicioNombre}`,
          categoria: 'Servicios', origen: 'contador', turnoId: null,
          createdAt: serverTimestamp()
        });

        const turnoRef = await addDoc(turnosCol, {
          cliente: clienteNombre, telefono, fecha: todayISO(), hora: horaActual(),
          servicioId, servicioNombre, precio, estado: 'completado',
          barbero, notas: '', facturado: true,
          finanzaId: finanzaRef.id, createdAt: serverTimestamp()
        });
        window.Panel.Sheets.logTurno({
          id: turnoRef ? turnoRef.id : '', cliente: clienteNombre, telefono,
          fecha: todayISO(), hora: horaActual(),
          servicioNombre, precio, estado: 'completado', notas: ''
        }, 'Nuevo');

        modal.close();
      } catch (err) { console.error(err); }

      submitBtn.disabled = false;
    });

    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    modal.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => modal.close()));
  }

  // ── Vista Finanzas del día ─────────────────────────────────────
  function populateServicios() {
    const sel = document.getElementById('empCorteServicio');
    if (!sel) return;
    const activos = cacheServicios.filter(s => s.activo !== false);
    sel.innerHTML = activos.map(s =>
      `<option value="${s.id}" data-precio="${s.precio}" data-nombre="${s.nombre}">${s.nombre} (${fmt(s.precio)})</option>`
    ).join('');
    if (activos.length > 0) document.getElementById('empCortePrecio').value = activos[0].precio;
  }

  function renderCortes() {
    const hoy    = todayISO();
    const lista  = document.getElementById('empCortesLista');
    const empty  = document.getElementById('empCortesEmpty');
    const totalEl = document.getElementById('empTotalDia');
    if (!lista) return;

    const cortesHoy = cacheFinanzas
      .filter(f => f.fecha === hoy && f.tipo === 'ingreso')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    totalEl.textContent = fmt(cortesHoy.reduce((s, f) => s + Number(f.monto), 0));
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
        if (confirm('¿Eliminar este corte?')) await deleteDoc(doc(db, 'finanzas', btn.dataset.id));
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
      const cliente        = document.getElementById('empCorteCliente').value.trim();
      const opt            = sel.selectedOptions[0];
      const servicioNombre = opt ? opt.dataset.nombre : '';
      const servicioId     = opt ? opt.value : null;
      const monto          = Number(precio.value);
      const msg            = document.getElementById('empCorteMsg');
      if (!cliente || !monto) return;

      const clienteReg = cacheClientes.find(c => c.nombre.toLowerCase() === cliente.toLowerCase());
      const telefono   = clienteReg ? clienteReg.telefono : '';

      const finanzaRef = await addDoc(finanzasCol, {
        tipo: 'ingreso', fecha: todayISO(), monto,
        descripcion: `${cliente} — ${servicioNombre}`,
        categoria: 'Servicios', origen: 'turno', turnoId: null,
        createdAt: serverTimestamp()
      });

      const turnoRef = await addDoc(turnosCol, {
        cliente, telefono, fecha: todayISO(), hora: horaActual(),
        servicioId, servicioNombre, precio: monto, estado: 'completado',
        notas: '', facturado: true, finanzaId: finanzaRef.id,
        createdAt: serverTimestamp()
      });
      window.Panel.Sheets.logTurno({
        id: turnoRef ? turnoRef.id : '', cliente, telefono,
        fecha: todayISO(), hora: horaActual(),
        servicioNombre, precio: monto, estado: 'completado', notas: ''
      }, 'Nuevo');

      document.getElementById('empCorteForm').reset();
      populateServicios();
      msg.textContent = `✓ Corte de ${cliente} registrado — ${fmt(monto)}`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Init principal ─────────────────────────────────────────────
  function initEmpleado(onLogout) {
    initTabs();
    initFormClientes();
    initFormCortes();
    initContadores();

    onSnapshot(query(clientesCol, orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
    });

    onSnapshot(query(turnosCol, orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
      renderCortes();
      renderContadores();
      renderResumenMes();
    });

    onSnapshot(query(finanzasCol, orderBy('fecha', 'desc')), snap => {
      cacheFinanzas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCortes();
    });

    onSnapshot(query(serviciosCol, orderBy('nombre')), snap => {
      cacheServicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      populateServicios();
    });

    onSnapshot(query(barberosCol, orderBy('nombre')), snap => {
      cacheBarberos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderContadores();
      renderResumenMes();
    });

    document.getElementById('empLogoutBtn').addEventListener('click', onLogout);
  }

  window.Panel.Empleado = { initEmpleado };
})();
