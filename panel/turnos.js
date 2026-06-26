(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } = window.Panel.Storage;
  const { getServicios, onServiciosChange } = window.Panel.Servicios;
  const { createTurnoIncome, deleteFinanzaEntry } = window.Panel.Finanzas;
  const { logTurno } = window.Panel.Sheets;

  const turnosCol = collection(db, 'turnos');
  let cache = [];
  let editingTurno = null;
  const turnosListeners = [];

  function getTurnos() {
    return cache;
  }

  function onTurnosChange(fn) {
    turnosListeners.push(fn);
  }

  function notifyTurnosChange() {
    turnosListeners.forEach(fn => fn(cache));
  }

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const ESTADOS = { pendiente: 'Pendiente', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };

  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();

  function toISODate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function todayISO() {
    return toISODate(today.getFullYear(), today.getMonth(), today.getDate());
  }

  function turnosByDate(dateStr) {
    return cache
      .filter(t => t.fecha === dateStr)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  }

  function populateServicioSelect() {
    const select = document.getElementById('turnoServicio');
    const current = select.value;
    const activos = getServicios().filter(s => s.activo !== false);
    select.innerHTML = activos
      .map(s => `<option value="${s.id}" data-precio="${s.precio}">${s.nombre} ($${s.precio})</option>`)
      .join('') || '<option value="">Sin servicios — creá uno en la pestaña Servicios</option>';
    if (current) select.value = current;
  }

  function renderCalendar() {
    document.getElementById('calendarLabel').textContent = `${MESES[viewMonth]} ${viewYear}`;
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      let cellDateStr, label;

      if (dayNum < 1) {
        label = daysInPrevMonth + dayNum;
        cell.classList.add('is-muted');
        const d = new Date(viewYear, viewMonth - 1, label);
        cellDateStr = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      } else if (dayNum > daysInMonth) {
        label = dayNum - daysInMonth;
        cell.classList.add('is-muted');
        const d = new Date(viewYear, viewMonth + 1, label);
        cellDateStr = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      } else {
        label = dayNum;
        cellDateStr = toISODate(viewYear, viewMonth, dayNum);
      }

      if (cellDateStr === todayISO()) cell.classList.add('is-today');

      const count = turnosByDate(cellDateStr).length;
      cell.innerHTML = `<span class="calendar-day__num">${label}</span>` +
        (count > 0 ? `<span class="calendar-day__badge">${count} turno${count > 1 ? 's' : ''}</span>` : '');

      cell.addEventListener('click', () => openDayModal(cellDateStr));
      grid.appendChild(cell);
    }
  }

  function formatDateLong(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} ${y}`;
  }

  function openDayModal(dateStr) {
    document.getElementById('dayModalTitle').textContent = `Turnos del ${formatDateLong(dateStr)}`;
    const list = document.getElementById('dayList');
    const turnos = turnosByDate(dateStr);
    list.innerHTML = turnos.length
      ? turnos.map(t => `
        <div class="day-list__item">
          <div class="day-list__info">
            <strong>${t.hora} · ${t.cliente}</strong>
            <small>${t.servicioNombre} · <span class="badge badge--${t.estado}">${ESTADOS[t.estado]}</span></small>
          </div>
          <div>
            <button class="link-btn" data-edit-turno="${t.id}">Editar</button> ·
            <button class="link-btn" data-delete-turno="${t.id}">Eliminar</button>
          </div>
        </div>
      `).join('')
      : '<p class="day-list__empty">No hay turnos este día.</p>';

    const dayModal = document.getElementById('dayModal');
    document.getElementById('addTurnoFromDay').onclick = () => {
      dayModal.close();
      openTurnoModal(null, dateStr);
    };
    dayModal.showModal();

    list.querySelectorAll('[data-edit-turno]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = cache.find(x => x.id === btn.dataset.editTurno);
        dayModal.close();
        openTurnoModal(t);
      });
    });
    list.querySelectorAll('[data-delete-turno]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = cache.find(x => x.id === btn.dataset.deleteTurno);
        if (t && confirm(`¿Eliminar el turno de ${t.cliente}?`)) {
          await deleteTurno(t);
          openDayModal(dateStr);
        }
      });
    });
  }

  function checkConflict(fecha, hora, excludeId) {
    const conflict = cache.find(t => t.fecha === fecha && t.hora === hora && t.id !== excludeId);
    const warning = document.getElementById('turnoWarning');
    if (conflict) {
      warning.textContent = `Ya hay un turno a esa hora: ${conflict.cliente} (${conflict.servicioNombre}).`;
      warning.hidden = false;
    } else {
      warning.hidden = true;
    }
  }

  function openTurnoModal(turno, defaultDate) {
    editingTurno = turno || null;
    populateServicioSelect();

    const form = document.getElementById('turnoForm');
    form.reset();
    document.getElementById('turnoWarning').hidden = true;
    document.getElementById('turnoModalTitle').textContent = turno ? 'Editar turno' : 'Nuevo turno';
    document.getElementById('deleteTurnoBtn').hidden = !turno;

    if (turno) {
      document.getElementById('turnoId').value = turno.id;
      document.getElementById('turnoCliente').value = turno.cliente;
      document.getElementById('turnoTelefono').value = turno.telefono || '';
      document.getElementById('turnoFecha').value = turno.fecha;
      document.getElementById('turnoHora').value = turno.hora;
      document.getElementById('turnoServicio').value = turno.servicioId;
      document.getElementById('turnoEstado').value = turno.estado;
      document.getElementById('turnoNotas').value = turno.notas || '';
    } else {
      document.getElementById('turnoId').value = '';
      document.getElementById('turnoFecha').value = defaultDate || todayISO();
      document.getElementById('turnoEstado').value = 'pendiente';
    }

    checkConflict(document.getElementById('turnoFecha').value, document.getElementById('turnoHora').value, turno?.id);
    document.getElementById('turnoModal').showModal();
  }

  async function deleteTurno(turno) {
    if (turno.facturado && turno.finanzaId) {
      await deleteFinanzaEntry(turno.finanzaId);
    }
    await deleteDoc(doc(db, 'turnos', turno.id));
    logTurno(turno, 'Eliminado');
  }

  function initTurnos() {
    onSnapshot(query(turnosCol, orderBy('fecha')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCalendar();
      notifyTurnosChange();
    });

    onServiciosChange(populateServicioSelect);

    document.getElementById('prevMonth').addEventListener('click', () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderCalendar();
    });
    document.getElementById('todayBtn').addEventListener('click', () => {
      viewYear = today.getFullYear(); viewMonth = today.getMonth();
      renderCalendar();
    });
    document.getElementById('newTurnoBtn').addEventListener('click', () => openTurnoModal(null));

    document.getElementById('turnoFecha').addEventListener('change', () => {
      checkConflict(document.getElementById('turnoFecha').value, document.getElementById('turnoHora').value, editingTurno?.id);
    });
    document.getElementById('turnoHora').addEventListener('change', () => {
      checkConflict(document.getElementById('turnoFecha').value, document.getElementById('turnoHora').value, editingTurno?.id);
    });

    document.getElementById('deleteTurnoBtn').addEventListener('click', async () => {
      if (editingTurno && confirm(`¿Eliminar el turno de ${editingTurno.cliente}?`)) {
        await deleteTurno(editingTurno);
        document.getElementById('turnoModal').close();
      }
    });

    document.getElementById('turnoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const servicioSelect = document.getElementById('turnoServicio');
      const selectedOption = servicioSelect.selectedOptions[0];
      if (!selectedOption || !selectedOption.value) {
        alert('Creá al menos un servicio antes de agendar turnos.');
        return;
      }

      const data = {
        cliente: document.getElementById('turnoCliente').value.trim(),
        telefono: document.getElementById('turnoTelefono').value.trim(),
        fecha: document.getElementById('turnoFecha').value,
        hora: document.getElementById('turnoHora').value,
        servicioId: selectedOption.value,
        servicioNombre: selectedOption.textContent.replace(/\s*\(\$\d+\)$/, ''),
        precio: Number(selectedOption.dataset.precio) || 0,
        estado: document.getElementById('turnoEstado').value,
        notas: document.getElementById('turnoNotas').value.trim()
      };

      if (editingTurno) {
        const oldFacturado = editingTurno.facturado;
        const oldFinanzaId = editingTurno.finanzaId;

        if (data.estado === 'completado' && !oldFacturado) {
          data.finanzaId = await createTurnoIncome({ ...data, id: editingTurno.id });
          data.facturado = true;
        } else if (data.estado !== 'completado' && oldFacturado) {
          await deleteFinanzaEntry(oldFinanzaId);
          data.facturado = false;
          data.finanzaId = null;
        } else {
          data.facturado = !!oldFacturado;
          data.finanzaId = oldFinanzaId || null;
        }

        await updateDoc(doc(db, 'turnos', editingTurno.id), data);
        logTurno(data, 'Actualizado');
      } else {
        const newDocRef = await addDoc(turnosCol, { ...data, facturado: false, finanzaId: null, createdAt: serverTimestamp() });
        if (data.estado === 'completado') {
          const finanzaId = await createTurnoIncome({ ...data, id: newDocRef.id });
          await updateDoc(newDocRef, { facturado: true, finanzaId });
        }
        logTurno(data, 'Nuevo');
      }

      document.getElementById('turnoModal').close();
    });
  }

  window.Panel.Turnos = { initTurnos, getTurnos, onTurnosChange };
})();
