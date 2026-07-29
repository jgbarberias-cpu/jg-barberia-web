(function () {
  const { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const promosCol = collection(db, 'promociones');
  let cachePromos = [];

  function renderTable() {
    const tbody = document.getElementById('promosTbody');
    const empty = document.getElementById('promosEmpty');
    if (!tbody) return;

    if (cachePromos.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    tbody.innerHTML = cachePromos.map(p => `
      <tr>
        <td><strong>${p.titulo}</strong></td>
        <td style="color:var(--text-muted);font-size:0.85rem">${p.descripcion || '—'}</td>
        <td>
          <span class="badge ${p.activo ? 'badge--success' : 'badge--muted'}">
            ${p.activo ? 'Activa' : 'Inactiva'}
          </span>
        </td>
        <td>
          <button class="link-btn" data-edit-promo="${p.id}">Editar</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit-promo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const promo = cachePromos.find(p => p.id === btn.dataset.editPromo);
        if (promo) openModal(promo);
      });
    });
  }

  function openModal(promo) {
    const modal = document.getElementById('promoModal');
    const titleEl = document.getElementById('promoModalTitle');
    const delBtn = document.getElementById('deletePromoBtn');

    document.getElementById('promoId').value = promo ? promo.id : '';
    document.getElementById('promoTitulo').value = promo ? promo.titulo : '';
    document.getElementById('promoDescripcion').value = promo ? (promo.descripcion || '') : '';
    document.getElementById('promoActivo').checked = promo ? !!promo.activo : true;
    titleEl.textContent = promo ? 'Editar promoción' : 'Nueva promoción';
    delBtn.hidden = !promo;

    modal.showModal();
  }

  function initPromociones() {
    const newBtn = document.getElementById('newPromoBtn');
    if (!newBtn) return;

    newBtn.addEventListener('click', () => openModal(null));

    document.getElementById('promoForm').addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('promoId').value;
      const data = {
        titulo:      document.getElementById('promoTitulo').value.trim(),
        descripcion: document.getElementById('promoDescripcion').value.trim(),
        activo:      document.getElementById('promoActivo').checked
      };

      if (id) {
        await updateDoc(doc(db, 'promociones', id), data);
      } else {
        await addDoc(promosCol, data);
      }
      document.getElementById('promoModal').close();
    });

    document.getElementById('deletePromoBtn').addEventListener('click', async () => {
      const id = document.getElementById('promoId').value;
      if (!id) return;
      if (confirm('¿Eliminar esta promoción?')) {
        await deleteDoc(doc(db, 'promociones', id));
        document.getElementById('promoModal').close();
      }
    });

    document.getElementById('promoModal').addEventListener('click', e => {
      if (e.target === document.getElementById('promoModal')) document.getElementById('promoModal').close();
    });

    onSnapshot(query(promosCol, orderBy('created_at', 'desc')), snap => {
      cachePromos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
    });
  }

  window.Panel.Promociones = { initPromociones };
})();
