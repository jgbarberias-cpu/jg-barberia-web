(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } = window.Panel.Storage;

  const finanzasCol = collection(db, 'finanzas');
  let cache = [];
  let editingMov = null;

  function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmt(n) {
    return '$' + Number(n).toLocaleString('es-AR');
  }

  function renderChart(month, rows) {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const daily = {};
    for (let d = 1; d <= daysInMonth; d++) daily[d] = { ingreso: 0, egreso: 0 };
    rows.forEach(mv => {
      const day = Number(mv.fecha.split('-')[2]);
      if (daily[day]) daily[day][mv.tipo] += Number(mv.monto);
    });

    const max = Math.max(1, ...Object.values(daily).flatMap(d => [d.ingreso, d.egreso]));
    const chart = document.getElementById('finanzasChart');
    chart.innerHTML = Object.keys(daily).map(d => {
      const { ingreso, egreso } = daily[d];
      const ingH = Math.round((ingreso / max) * 100);
      const egrH = Math.round((egreso / max) * 100);
      return `
        <div class="chart-day" title="Día ${d}: ingresos ${fmt(ingreso)}, egresos ${fmt(egreso)}">
          <div class="chart-bars">
            <div class="chart-bar chart-bar--ingreso" style="height:${ingH}%"></div>
            <div class="chart-bar chart-bar--egreso" style="height:${egrH}%"></div>
          </div>
          <span class="chart-day__label">${d}</span>
        </div>
      `;
    }).join('');
  }

  function renderTable() {
    const monthInput = document.getElementById('finanzasMonth');
    const month = monthInput.value || currentMonthValue();
    const rows = cache
      .filter(m => m.fecha && m.fecha.startsWith(month))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    renderChart(month, rows);

    const tbody = document.getElementById('finanzasTbody');
    const empty = document.getElementById('finanzasEmpty');
    tbody.innerHTML = '';
    empty.hidden = rows.length > 0;

    let ingresos = 0, egresos = 0;
    rows.forEach(m => {
      if (m.tipo === 'ingreso') ingresos += Number(m.monto); else egresos += Number(m.monto);
      const tr = document.createElement('tr');
      const origenBadge = m.origen === 'turno'
        ? '<span class="badge badge--turno">Turno</span>'
        : '<span class="badge badge--manual">Manual</span>';
      tr.innerHTML = `
        <td>${m.fecha}</td>
        <td>${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
        <td>${m.descripcion}</td>
        <td>${m.categoria || '-'}</td>
        <td>${origenBadge}</td>
        <td class="amount--${m.tipo}">${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
        <td>
          <button class="link-btn" data-edit-mov="${m.id}">Editar</button> ·
          <button class="link-btn" data-delete-mov="${m.id}">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('totalIngresos').textContent = fmt(ingresos);
    document.getElementById('totalEgresos').textContent = fmt(egresos);
    document.getElementById('totalBalance').textContent = fmt(ingresos - egresos);
  }

  function initFinanzas() {
    const monthInput = document.getElementById('finanzasMonth');
    monthInput.value = currentMonthValue();
    monthInput.addEventListener('change', renderTable);

    onSnapshot(query(finanzasCol, orderBy('fecha', 'desc')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });

    const modal = document.getElementById('movModal');
    const form = document.getElementById('movForm');
    const deleteBtn = document.getElementById('deleteMovBtn');
    const tipoInput = document.getElementById('movTipo');
    const fechaInput = document.getElementById('movFecha');
    const montoInput = document.getElementById('movMonto');
    const descInput = document.getElementById('movDescripcion');
    const catInput = document.getElementById('movCategoria');

    async function eliminarMov(mov) {
      if (!confirm('¿Eliminar este movimiento?')) return;
      await deleteDoc(doc(db, 'finanzas', mov.id));
      if (mov.origen === 'turno' && mov.turnoId) {
        await updateDoc(doc(db, 'turnos', mov.turnoId), { facturado: false, finanzaId: null });
      }
    }

    function abrirModal(mov) {
      editingMov = mov || null;
      form.reset();
      modal.querySelector('h3').textContent = mov ? 'Editar movimiento' : 'Nuevo movimiento';
      deleteBtn.hidden = !mov;
      if (mov) {
        tipoInput.value = mov.tipo;
        fechaInput.value = mov.fecha;
        montoInput.value = mov.monto;
        descInput.value = mov.descripcion;
        catInput.value = mov.categoria || '';
      } else {
        fechaInput.value = new Date().toISOString().slice(0, 10);
      }
      modal.showModal();
    }

    document.getElementById('newMovBtn').addEventListener('click', () => abrirModal(null));

    document.getElementById('finanzasTbody').addEventListener('click', async (e) => {
      const editId = e.target.dataset.editMov;
      const delId = e.target.dataset.deleteMov;
      if (editId) {
        const mov = cache.find(m => m.id === editId);
        if (mov) abrirModal(mov);
      }
      if (delId) {
        const mov = cache.find(m => m.id === delId);
        if (mov) await eliminarMov(mov);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (editingMov) {
        await eliminarMov(editingMov);
        modal.close();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        tipo: tipoInput.value,
        fecha: fechaInput.value,
        monto: Number(montoInput.value),
        descripcion: descInput.value.trim(),
        categoria: catInput.value.trim()
      };
      if (editingMov) {
        await updateDoc(doc(db, 'finanzas', editingMov.id), data);
      } else {
        await addDoc(finanzasCol, { ...data, origen: 'manual', turnoId: null, createdAt: serverTimestamp() });
      }
      modal.close();
    });
  }

  async function createTurnoIncome(turno) {
    const docRef = await addDoc(finanzasCol, {
      tipo: 'ingreso',
      fecha: turno.fecha,
      monto: Number(turno.precio) || 0,
      descripcion: `Turno - ${turno.cliente} (${turno.servicioNombre})`,
      categoria: 'Servicios',
      origen: 'turno',
      turnoId: turno.id,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async function deleteFinanzaEntry(finanzaId) {
    if (!finanzaId) return;
    await deleteDoc(doc(db, 'finanzas', finanzaId));
  }

  window.Panel.Finanzas = { initFinanzas, createTurnoIncome, deleteFinanzaEntry };
})();
