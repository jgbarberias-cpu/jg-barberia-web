(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const tareasCol = collection(db, 'tareas');
  let cache = [];
  let editingTarea = null;

  function fmtFecha(f) {
    if (!f) return '-';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  }

  function vencida(t) {
    if (!t.fecha || t.completada) return false;
    return t.fecha < new Date().toISOString().slice(0, 10);
  }

  function renderTable() {
    const tbody = document.getElementById('tareasTbody');
    const empty = document.getElementById('tareasEmpty');
    tbody.innerHTML = '';

    const pendientes = cache.filter(t => !t.completada);
    empty.hidden = pendientes.length > 0;

    cache
      .slice()
      .sort((a, b) => {
        if (a.completada !== b.completada) return a.completada ? 1 : -1;
        return (a.fecha || '9999') < (b.fecha || '9999') ? -1 : 1;
      })
      .forEach(t => {
        const tr = document.createElement('tr');
        if (t.completada) tr.classList.add('tarea--hecha');
        const fechaTxt = vencida(t)
          ? `<span class="badge badge--recordatorio">${fmtFecha(t.fecha)}</span>`
          : fmtFecha(t.fecha);
        tr.innerHTML = `
          <td><input type="checkbox" data-toggle-tarea="${t.id}" ${t.completada ? 'checked' : ''}></td>
          <td>${t.descripcion}</td>
          <td>${fechaTxt}</td>
          <td>
            <button class="link-btn" data-edit-tarea="${t.id}">Editar</button> ·
            <button class="link-btn" data-delete-tarea="${t.id}">Eliminar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  function initTareas() {
    onSnapshot(query(tareasCol, orderBy('createdAt', 'desc')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });

    const modal = document.getElementById('tareaModal');
    const form = document.getElementById('tareaForm');
    const deleteBtn = document.getElementById('deleteTareaBtn');
    const idInput = document.getElementById('tareaId');
    const descInput = document.getElementById('tareaDescripcion');
    const fechaInput = document.getElementById('tareaFecha');

    function abrirModal(tarea) {
      editingTarea = tarea || null;
      form.reset();
      modal.querySelector('h3').textContent = tarea ? 'Editar tarea' : 'Nueva tarea';
      deleteBtn.hidden = !tarea;
      if (tarea) {
        idInput.value = tarea.id;
        descInput.value = tarea.descripcion;
        fechaInput.value = tarea.fecha || '';
      } else {
        idInput.value = '';
      }
      modal.showModal();
    }

    document.getElementById('newTareaBtn').addEventListener('click', () => abrirModal(null));

    document.getElementById('tareasTbody').addEventListener('click', (e) => {
      const editId = e.target.dataset.editTarea;
      const delId = e.target.dataset.deleteTarea;
      if (editId) {
        const t = cache.find(x => x.id === editId);
        if (t) abrirModal(t);
      }
      if (delId) {
        if (confirm('¿Eliminar esta tarea?')) deleteDoc(doc(db, 'tareas', delId));
      }
    });

    document.getElementById('tareasTbody').addEventListener('change', (e) => {
      const toggleId = e.target.dataset.toggleTarea;
      if (toggleId) {
        updateDoc(doc(db, 'tareas', toggleId), { completada: e.target.checked });
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (editingTarea && confirm('¿Eliminar esta tarea?')) {
        deleteDoc(doc(db, 'tareas', editingTarea.id));
        modal.close();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        descripcion: descInput.value.trim(),
        fecha: fechaInput.value || null
      };
      if (editingTarea) {
        await updateDoc(doc(db, 'tareas', editingTarea.id), data);
      } else {
        await addDoc(tareasCol, { ...data, completada: false });
      }
      modal.close();
    });
  }

  window.Panel.Tareas = { initTareas };
})();
