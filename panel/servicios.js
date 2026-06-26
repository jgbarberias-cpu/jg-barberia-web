(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const serviciosCol = collection(db, 'servicios');
  let cache = [];
  const listeners = [];

  function getServicios() {
    return cache;
  }

  function onServiciosChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(fn => fn(cache));
  }

  function badge(activo) {
    return activo
      ? '<span class="badge badge--completado">Sí</span>'
      : '<span class="badge badge--cancelado">No</span>';
  }

  function renderTable() {
    const tbody = document.getElementById('serviciosTbody');
    const empty = document.getElementById('serviciosEmpty');
    tbody.innerHTML = '';
    empty.hidden = cache.length > 0;
    cache.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.nombre}</td>
        <td>$${s.precio}</td>
        <td>${badge(s.activo)}</td>
        <td><button class="link-btn" data-edit-servicio="${s.id}">Editar</button> ·
            <button class="link-btn" data-delete-servicio="${s.id}">Eliminar</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function initServicios() {
    onSnapshot(query(serviciosCol, orderBy('nombre')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
      notify();
    });

    const modal = document.getElementById('servicioModal');
    const form = document.getElementById('servicioForm');
    const idInput = document.getElementById('servicioId');
    const nombreInput = document.getElementById('servicioNombre');
    const precioInput = document.getElementById('servicioPrecio');
    const activoInput = document.getElementById('servicioActivo');

    document.getElementById('newServicioBtn').addEventListener('click', () => {
      form.reset();
      idInput.value = '';
      activoInput.checked = true;
      modal.querySelector('h3').textContent = 'Nuevo servicio';
      modal.showModal();
    });

    document.getElementById('serviciosTbody').addEventListener('click', (e) => {
      const editId = e.target.dataset.editServicio;
      const delId = e.target.dataset.deleteServicio;
      if (editId) {
        const s = cache.find(x => x.id === editId);
        if (!s) return;
        idInput.value = s.id;
        nombreInput.value = s.nombre;
        precioInput.value = s.precio;
        activoInput.checked = s.activo;
        modal.querySelector('h3').textContent = 'Editar servicio';
        modal.showModal();
      }
      if (delId) {
        if (confirm('¿Eliminar este servicio? Esto no afecta los turnos ya creados.')) {
          deleteDoc(doc(db, 'servicios', delId));
        }
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nombre: nombreInput.value.trim(),
        precio: Number(precioInput.value),
        activo: activoInput.checked
      };
      if (idInput.value) {
        await updateDoc(doc(db, 'servicios', idInput.value), data);
      } else {
        await addDoc(serviciosCol, data);
      }
      modal.close();
    });
  }

  window.Panel.Servicios = { initServicios, getServicios, onServiciosChange };
})();
