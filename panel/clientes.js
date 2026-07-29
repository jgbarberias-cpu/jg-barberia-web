(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;
  const { getTurnos, onTurnosChange } = window.Panel.Turnos;
  const { logCliente } = window.Panel.Sheets;

  const clientesCol = collection(db, 'clientes');
  let cache = [];
  let editingCliente = null;
  const RECORDATORIO_DIAS = 10;

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
      .sort((a, b) => {
        const ka = claveCliente(a.nombre, a.telefono);
        const kb = claveCliente(b.nombre, b.telefono);
        const ua = (stats.get(ka) || {}).ultima || '';
        const ub = (stats.get(kb) || {}).ultima || '';
        if (!ua && !ub) return a.nombre.localeCompare(b.nombre);
        if (!ua) return 1;
        if (!ub) return -1;
        return ub.localeCompare(ua);
      })
      .forEach(c => {
        const key = claveCliente(c.nombre, c.telefono);
        const s = stats.get(key) || { cantidad: 0, ultima: '', totalGastado: 0, ultimoServicio: '' };
        const dias = diasDesde(s.ultima);
        const telNorm = normTel(c.telefono);
        const waIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
        const waBtnAdmin = telNorm
          ? `<a href="https://wa.me/549${telNorm}" target="_blank" rel="noopener" class="wa-circle-btn" title="WhatsApp">${waIcon}</a>`
          : '';
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
          <td style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${waBtnAdmin}
            <button class="link-btn" data-edit-cliente="${c.id}">Editar</button>
            <span style="color:var(--border)">·</span>
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

  function syncClientesFromTurnos(turnos) {
    const telsEnCache = new Set(cache.map(c => normTel(c.telefono)).filter(Boolean));
    const nombresEnCache = new Set(cache.map(c => (c.nombre || '').trim().toLowerCase()));
    const agregando = new Set();

    turnos.forEach(t => {
      if (!t.cliente) return;
      const tel = normTel(t.telefono);
      const nombre = t.cliente.trim().toLowerCase();
      if (tel && (telsEnCache.has(tel) || agregando.has(`tel_${tel}`))) return;
      if (!tel && (nombresEnCache.has(nombre) || agregando.has(`nom_${nombre}`))) return;
      agregando.add(tel ? `tel_${tel}` : `nom_${nombre}`);
      addDoc(clientesCol, { nombre: t.cliente, telefono: t.telefono || '', notas: '' });
    });
  }

  async function sincronizarConSheets() {
    const url = window.PANEL_SHEETS_WEBHOOK_URL;
    if (!cache.length) { alert('No hay clientes para sincronizar.'); return; }
    if (!confirm(`¿Enviar ${cache.length} clientes a Google Sheets? Tarda ~${Math.ceil(cache.length * 0.8 / 60)} min, no cierres la pestaña.`)) return;

    const btn = document.getElementById('syncSheetsBtn');
    if (btn) { btn.disabled = true; }

    for (let i = 0; i < cache.length; i++) {
      const c = cache[i];
      if (btn) btn.textContent = `Enviando ${i + 1}/${cache.length}...`;
      try {
        await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            tipo: 'cliente', accion: 'Nuevo',
            nombre: c.nombre, telefono: c.telefono || '',
            instagram: c.instagram || '', email: c.email || '', notas: c.notas || ''
          })
        });
      } catch (e) {}
      await new Promise(r => setTimeout(r, 800));
    }

    if (btn) { btn.disabled = false; btn.textContent = '↑ Sincronizar con Sheets'; }
    alert(`✓ ${cache.length} clientes enviados.`);
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

    onTurnosChange(() => {
      renderTable();
    });

    document.getElementById('newClienteBtn').addEventListener('click', () => openClienteModal(null));
    document.getElementById('exportClientesBtn').addEventListener('click', exportarCSV);
    document.getElementById('syncSheetsBtn').addEventListener('click', sincronizarConSheets);

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
