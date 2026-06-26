(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;
  const { getTurnos, onTurnosChange } = window.Panel.Turnos;
  const { logCliente } = window.Panel.Sheets;

  const clientesCol = collection(db, 'clientes');
  let cache = [];
  let editingCliente = null;
  const RECORDATORIO_DIAS = 14;

  function normTel(tel) {
    return (tel || '').replace(/\D/g, '');
  }

  function claveCliente(nombre, telefono) {
    const tel = normTel(telefono);
    return tel ? `tel_${tel}` : `nombre_${(nombre || '').trim().toLowerCase()}`;
  }

  function fmtMonto(n) {
    return '$' + Number(n || 0).toLocaleString('es-AR');
  }

  function fmtFecha(f) {
    if (!f) return '-';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  }

  function diasDesde(fecha) {
    if (!fecha) return null;
    const hoy = new Date();
    const [y, m, d] = fecha.split('-').map(Number);
    const visita = new Date(y, m - 1, d);
    return Math.floor((hoy - visita) / 86400000);
  }

  function statsPorTelefono() {
    const stats = new Map();
    getTurnos().forEach(t => {
      const key = claveCliente(t.cliente, t.telefono);
      const actual = stats.get(key) || { cantidad: 0, ultima: '', totalGastado: 0, ultimoServicio: '', ultimaCompletada: '' };
      actual.cantidad += 1;
      if (!actual.ultima || t.fecha >= actual.ultima) actual.ultima = t.fecha;
      if (t.estado === 'completado') {
        actual.totalGastado += Number(t.precio) || 0;
        if (!actual.ultimaCompletada || t.fecha >= actual.ultimaCompletada) {
          actual.ultimaCompletada = t.fecha;
          actual.ultimoServicio = t.servicioNombre;
        }
      }
      stats.set(key, actual);
    });
    return stats;
  }

  function renderTable() {
    const stats = statsPorTelefono();
    const tbody = document.getElementById('clientesTbody');
    const empty = document.getElementById('clientesEmpty');
    const total = document.getElementById('clientesTotal');

    tbody.innerHTML = '';
    empty.hidden = cache.length > 0;
    total.textContent = cache.length;

    cache
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach(c => {
        const key = claveCliente(c.nombre, c.telefono);
        const s = stats.get(key) || { cantidad: 0, ultima: '', totalGastado: 0, ultimoServicio: '' };
        const dias = diasDesde(s.ultima);
        const recordatorio = dias !== null && dias >= RECORDATORIO_DIAS
          ? `<span class="badge badge--recordatorio">Recordar (${dias} días)</span>`
          : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.nombre}</td>
          <td>${c.telefono || '-'}</td>
          <td>${fmtFecha(s.ultima)}</td>
          <td>${s.ultimoServicio || '-'}</td>
          <td>${fmtMonto(s.totalGastado)}</td>
          <td>${recordatorio}</td>
          <td>
            <button class="link-btn" data-edit-cliente="${c.id}">Editar</button> ·
            <button class="link-btn" data-delete-cliente="${c.id}">Eliminar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function openClienteModal(cliente) {
    editingCliente = cliente || null;
    const modal = document.getElementById('clienteModal');
    const form = document.getElementById('clienteForm');
    form.reset();
    modal.querySelector('h3').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
    document.getElementById('deleteClienteBtn').hidden = !cliente;

    if (cliente) {
      document.getElementById('clienteId').value = cliente.id;
      document.getElementById('clienteNombre').value = cliente.nombre;
      document.getElementById('clienteTelefono').value = cliente.telefono || '';
      document.getElementById('clienteInstagram').value = cliente.instagram || '';
      document.getElementById('clienteEmail').value = cliente.email || '';
      document.getElementById('clienteNotas').value = cliente.notas || '';
    } else {
      document.getElementById('clienteId').value = '';
    }
    modal.showModal();
  }

  async function eliminarCliente(cliente) {
    if (confirm(`¿Eliminar a ${cliente.nombre} de la lista de clientes? (No borra sus turnos pasados)`)) {
      await deleteDoc(doc(db, 'clientes', cliente.id));
      logCliente(cliente, 'Eliminado');
    }
  }

  // Crea automáticamente los clientes que aparecen en turnos y todavía no están en la lista.
  function syncClientesFromTurnos(turnos) {
    const vistos = new Set(cache.map(c => claveCliente(c.nombre, c.telefono)));
    const nuevos = new Map();
    turnos.forEach(t => {
      const key = claveCliente(t.cliente, t.telefono);
      if (!vistos.has(key) && !nuevos.has(key) && t.cliente) {
        nuevos.set(key, { nombre: t.cliente, telefono: (t.telefono || '').trim() });
      }
    });
    nuevos.forEach((c, key) => {
      vistos.add(key);
      addDoc(clientesCol, { nombre: c.nombre, telefono: c.telefono, notas: '' });
    });
  }

  function exportarCSV() {
    const headers = ['Nombre', 'WhatsApp', 'Instagram', 'Email', 'Notas'];
    const filas = cache.map(c => [c.nombre, c.telefono || '', c.instagram || '', c.email || '', c.notas || '']);
    const csv = [headers, ...filas]
      .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-jg-barberia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function initClientes() {
    onSnapshot(query(clientesCol, orderBy('nombre')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });

    onTurnosChange(turnos => {
      syncClientesFromTurnos(turnos);
      renderTable();
    });

    document.getElementById('newClienteBtn').addEventListener('click', () => openClienteModal(null));
    document.getElementById('exportClientesBtn').addEventListener('click', exportarCSV);

    document.getElementById('clientesTbody').addEventListener('click', (e) => {
      const editId = e.target.dataset.editCliente;
      const delId = e.target.dataset.deleteCliente;
      if (editId) {
        const c = cache.find(x => x.id === editId);
        if (c) openClienteModal(c);
      }
      if (delId) {
        const c = cache.find(x => x.id === delId);
        if (c) eliminarCliente(c);
      }
    });

    document.getElementById('deleteClienteBtn').addEventListener('click', async () => {
      if (editingCliente) {
        await eliminarCliente(editingCliente);
        document.getElementById('clienteModal').close();
      }
    });

    document.getElementById('clienteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nombre: document.getElementById('clienteNombre').value.trim(),
        telefono: document.getElementById('clienteTelefono').value.trim(),
        instagram: document.getElementById('clienteInstagram').value.trim(),
        email: document.getElementById('clienteEmail').value.trim(),
        notas: document.getElementById('clienteNotas').value.trim()
      };
      if (editingCliente) {
        await updateDoc(doc(db, 'clientes', editingCliente.id), data);
        logCliente(data, 'Actualizado');
      } else {
        await addDoc(clientesCol, data);
        logCliente(data, 'Nuevo');
      }
      document.getElementById('clienteModal').close();
    });
  }

  window.Panel.Clientes = { initClientes };
})();
