(function () {
  const { db, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const resenasCol = collection(db, 'resenas');
  let cache = [];

  function fmtFecha(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR');
  }

  function renderTable() {
    const tbody = document.getElementById('resenasTbody');
    const empty = document.getElementById('resenasEmpty');
    tbody.innerHTML = '';
    empty.hidden = cache.length > 0;

    cache.forEach(r => {
      const tr = document.createElement('tr');
      const estadoBadge = r.aprobado
        ? '<span class="badge badge--completado">Aprobada</span>'
        : '<span class="badge badge--pendiente">Pendiente</span>';
      const aprobarBtn = r.aprobado
        ? ''
        : `<button class="link-btn" data-aprobar="${r.id}">Aprobar</button> · `;
      tr.innerHTML = `
        <td>${fmtFecha(r.createdAt)}</td>
        <td>${r.nombre}</td>
        <td>${'★'.repeat(r.calificacion)}${'☆'.repeat(5 - r.calificacion)}</td>
        <td>${r.comentario}</td>
        <td>${estadoBadge}</td>
        <td>${aprobarBtn}<button class="link-btn" data-eliminar="${r.id}">Eliminar</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function initResenas() {
    onSnapshot(query(resenasCol, orderBy('createdAt', 'desc')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });

    document.getElementById('resenasTbody').addEventListener('click', async (e) => {
      const aprobarId = e.target.dataset.aprobar;
      const eliminarId = e.target.dataset.eliminar;
      if (aprobarId) {
        await updateDoc(doc(db, 'resenas', aprobarId), { aprobado: true });
      }
      if (eliminarId && confirm('¿Eliminar esta reseña?')) {
        await deleteDoc(doc(db, 'resenas', eliminarId));
      }
    });
  }

  window.Panel.Resenas = { initResenas };
})();
