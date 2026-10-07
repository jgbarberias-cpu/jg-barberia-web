(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, escapeHtml } = window.Panel.Storage;

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

  // ── Reparto del mes: cuánto le toca a cada barbero y cuánto le queda al dueño ──
  // Sale de los cortes completados del mes: a cada empleado le toca cortes × comisión;
  // al dueño, sus propios cortes, los cortes sin barbero y lo que queda de los cortes
  // de los empleados después de pagar la comisión.
  function renderReparto(month, ingresos, egresos) {
    const el = document.getElementById('finanzasReparto');
    if (!el) return;

    const turnos = (window.Panel.Turnos && window.Panel.Turnos.getTurnos()) || [];
    const barberos = (window.Panel.Barberos && window.Panel.Barberos.getBarberos()) || [];
    const porNombre = new Map(barberos.map(b => [b.nombre, b]));

    const grupos = new Map();
    // Los barberos activos aparecen aunque todavía no tengan cortes en el mes
    barberos.filter(b => b.activo !== false).forEach(b => grupos.set(b.nombre, { cortes: 0, facturo: 0 }));
    turnos
      .filter(t => t.estado === 'completado' && t.fecha && t.fecha.startsWith(month))
      .forEach(t => {
        const k = t.barbero || '';
        const g = grupos.get(k) || { cortes: 0, facturo: 0 };
        g.cortes++;
        g.facturo += Number(t.precio || 0);
        grupos.set(k, g);
      });

    let totalCortes = 0, totalFacturo = 0, totalComisiones = 0;
    const filas = [...grupos.entries()].map(([nombre, g]) => {
      const b = porNombre.get(nombre);
      const esEmpleado = !!b && b.comision != null;
      const comision = esEmpleado ? g.cortes * Number(b.comision) : 0;
      totalCortes += g.cortes;
      totalFacturo += g.facturo;
      totalComisiones += comision;
      return {
        ...g, comision, esEmpleado,
        esDueno: !!b && b.comision == null,
        nombre: b ? (b.apodo || b.nombre) : (nombre || 'Sin barbero asignado')
      };
    })
      // Si no cortó y no es un barbero activo, no hace falta mostrarlo
      .filter(f => f.cortes > 0 || f.esEmpleado || f.esDueno)
      // Primero los empleados (más cortes arriba), después el dueño y al final los sin barbero
      .sort((a, b) => (Number(b.esEmpleado) - Number(a.esEmpleado)) || (Number(b.esDueno) - Number(a.esDueno)) || (b.cortes - a.cortes));

    const paraVos = totalFacturo - totalComisiones;
    const despuesDeGastos = ingresos - egresos - totalComisiones;

    const rows = filas.map(f => `
      <tr>
        <td>${escapeHtml(f.nombre)}${f.esDueno ? ' <span class="reparto__tag">dueño</span>' : ''}</td>
        <td>${f.cortes}</td>
        <td>${fmt(f.facturo)}</td>
        <td>${f.esEmpleado
          ? `<span class="reparto__le-toca">${fmt(f.comision)}</span>`
          : '<span class="reparto__tuyo">es tuyo</span>'}</td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="reparto__grid">
        <div class="table-wrap">
          <table class="resumen-tabla reparto__tabla">
            <thead><tr><th>Barbero</th><th>Cortes</th><th>Facturó</th><th>Le toca</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No hay cortes completados este mes.</td></tr>'}</tbody>
            <tfoot><tr><td>Total</td><td>${totalCortes}</td><td>${fmt(totalFacturo)}</td><td>${fmt(totalComisiones)}</td></tr></tfoot>
          </table>
        </div>
        <div class="reparto__dueno">
          <span class="reparto__dueno-label">💰 Te quedó a vos</span>
          <strong class="reparto__dueno-monto">${fmt(paraVos)}</strong>
          <span class="reparto__dueno-sub">${fmt(totalFacturo)} en cortes − ${fmt(totalComisiones)} de comisiones</span>
          <span class="reparto__dueno-gastos">Después de los gastos del mes: <strong>${fmt(despuesDeGastos)}</strong></span>
          <span class="reparto__dueno-sub">Balance (${fmt(ingresos - egresos)}) − comisiones</span>
        </div>
      </div>`;
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
      // Los cortes del contador aparecían como "Manual"
      const origenBadge = m.origen === 'turno'
        ? '<span class="badge badge--turno">Turno</span>'
        : m.origen === 'contador'
        ? '<span class="badge badge--turno">Contador</span>'
        : '<span class="badge badge--manual">Manual</span>';
      tr.innerHTML = `
        <td>${escapeHtml(m.fecha)}</td>
        <td>${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
        <td>${escapeHtml(m.descripcion)}</td>
        <td>${escapeHtml(m.categoria) || '-'}</td>
        <td>${origenBadge}</td>
        <td class="amount--${escapeHtml(m.tipo)}">${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
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

    renderReparto(month, ingresos, egresos);
  }

  function initFinanzas() {
    const monthInput = document.getElementById('finanzasMonth');
    monthInput.value = currentMonthValue();
    monthInput.addEventListener('change', renderTable);

    onSnapshot(query(finanzasCol, orderBy('fecha', 'desc')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });

    // El reparto del mes también depende de los cortes y de los barberos
    if (window.Panel.Turnos) window.Panel.Turnos.onTurnosChange(renderTable);
    if (window.Panel.Barberos) window.Panel.Barberos.onBarberosChange(renderTable);

    const modal = document.getElementById('movModal');
    const form = document.getElementById('movForm');
    const deleteBtn = document.getElementById('deleteMovBtn');
    const tipoInput = document.getElementById('movTipo');
    const fechaInput = document.getElementById('movFecha');
    const montoInput = document.getElementById('movMonto');
    const descInput = document.getElementById('movDescripcion');
    const catInput = document.getElementById('movCategoria');

    // Devuelve true si se eliminó (false si se canceló o falló)
    async function eliminarMov(mov) {
      if (!confirm('¿Eliminar este movimiento?')) return false;
      try {
        await deleteDoc(doc(db, 'finanzas', mov.id));
        if (mov.origen === 'turno' && mov.turnoId) {
          await updateDoc(doc(db, 'turnos', mov.turnoId), { facturado: false, finanzaId: null });
        }
        return true;
      } catch (err) {
        alert('No se pudo eliminar el movimiento. Revisá la conexión e intentá de nuevo.');
        return false;
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
        const d = new Date();
        fechaInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      if (editingMov && await eliminarMov(editingMov)) {
        modal.close();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('[type="submit"]');
      const data = {
        tipo: tipoInput.value,
        fecha: fechaInput.value,
        monto: Number(montoInput.value),
        descripcion: descInput.value.trim(),
        categoria: catInput.value.trim()
      };
      submitBtn.disabled = true;
      try {
        if (editingMov) {
          await updateDoc(doc(db, 'finanzas', editingMov.id), data);
        } else {
          await addDoc(finanzasCol, { ...data, origen: 'manual', turnoId: null, createdAt: serverTimestamp() });
        }
        modal.close();
      } catch (err) {
        alert('No se pudo guardar el movimiento. Revisá la conexión e intentá de nuevo.');
      } finally {
        submitBtn.disabled = false;
      }
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

  // Corrige el ingreso de un turno ya cobrado cuando se edita su precio o fecha
  async function updateTurnoIncome(finanzaId, cambios) {
    if (!finanzaId) return;
    await updateDoc(doc(db, 'finanzas', finanzaId), cambios);
  }

  async function deleteFinanzaEntry(finanzaId) {
    if (!finanzaId) return;
    await deleteDoc(doc(db, 'finanzas', finanzaId));
  }

  window.Panel.Finanzas = { initFinanzas, createTurnoIncome, updateTurnoIncome, deleteFinanzaEntry };
})();
