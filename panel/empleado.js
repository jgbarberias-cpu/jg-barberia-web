(function () {
  const { db, collection, addDoc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const clientesCol = collection(db, 'clientes');
  const turnosCol = collection(db, 'turnos');
  let cacheClientes = [];
  let cacheTurnos = [];
  let busqueda = '';

  const RECORDATORIO_DIAS = 14;

  function normTel(t) { return (t || '').replace(/\D/g, ''); }

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

  function statsCliente(cliente) {
    const key = normTel(cliente.telefono) || cliente.nombre.toLowerCase();
    let cantidad = 0, ultima = '', ultimoServicio = '';
    cacheTurnos.forEach(t => {
      const tKey = normTel(t.telefono) || t.cliente.toLowerCase();
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

      const card = document.createElement('div');
      card.className = 'emp-card' + (recordatorio ? ' emp-card--alerta' : '');
      card.innerHTML = `
        <div class="emp-card__avatar">${c.nombre.charAt(0).toUpperCase()}</div>
        <div class="emp-card__info">
          <div class="emp-card__nombre">${c.nombre}</div>
          <div class="emp-card__tel">${c.telefono || 'Sin número'}</div>
          ${s.ultima ? `<div class="emp-card__ultima">Último corte: ${fmtFecha(s.ultima)} · ${s.ultimoServicio}</div>` : '<div class="emp-card__ultima">Sin visitas registradas</div>'}
        </div>
        <div class="emp-card__badges">
          ${s.cantidad > 0 ? `<span class="emp-badge emp-badge--visitas">${s.cantidad} corte${s.cantidad !== 1 ? 's' : ''}</span>` : ''}
          ${recordatorio ? `<span class="emp-badge emp-badge--recordar">Recordar (${dias}d)</span>` : ''}
        </div>
      `;
      lista.appendChild(card);
    });
  }

  function initEmpleado(onLogout) {
    onSnapshot(query(clientesCol, orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
    });

    onSnapshot(query(turnosCol, orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
    });

    document.getElementById('empBuscar').addEventListener('input', e => {
      busqueda = e.target.value.trim();
      renderLista();
    });

    document.getElementById('empForm').addEventListener('submit', async e => {
      e.preventDefault();
      const nombre = document.getElementById('empNombre').value.trim();
      const telefono = normTel(document.getElementById('empTelefono').value);
      const msg = document.getElementById('empMsg');

      // Verificar si ya existe
      const existe = cacheClientes.find(c => normTel(c.telefono) === telefono && telefono);
      if (existe) {
        msg.textContent = `${existe.nombre} ya está registrado.`;
        msg.hidden = false;
        msg.style.color = 'var(--gold)';
        setTimeout(() => { msg.hidden = true; }, 3000);
        return;
      }

      await addDoc(clientesCol, { nombre, telefono: document.getElementById('empTelefono').value.trim(), notas: '' });
      document.getElementById('empForm').reset();
      msg.textContent = `✓ ${nombre} registrado correctamente.`;
      msg.hidden = false;
      msg.style.color = 'var(--green)';
      setTimeout(() => { msg.hidden = true; }, 3000);
    });

    document.getElementById('empLogoutBtn').addEventListener('click', onLogout);
  }

  window.Panel.Empleado = { initEmpleado };
})();
