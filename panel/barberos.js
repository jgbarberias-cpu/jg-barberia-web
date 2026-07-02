(function () {
  const { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } = window.Panel.Storage;

  const barberosCol = collection(db, 'barberos');

  function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

  function render(cache) {
    const tbody = document.getElementById('barberosTbody');
    const empty = document.getElementById('barberosEmpty');
    if (!tbody) return;
    empty.hidden = cache.length > 0;
    tbody.innerHTML = '';
    cache.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${b.nombre}</strong></td>
        <td>${b.apodo}</td>
        <td>${b.comision != null ? fmt(b.comision) + ' por corte' : '<span style="color:var(--text-muted)">Total (dueño)</span>'}</td>
        <td><span class="badge badge--${b.activo !== false ? 'completado' : 'cancelado'}">${b.activo !== false ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="link-btn" data-edit="${b.id}">Editar</button></td>
      `;
      tr.querySelector('[data-edit]').addEventListener('click', () => openModal(b));
      tbody.appendChild(tr);
    });
  }

  function openModal(b = null) {
    const modal     = document.getElementById('barberoModal');
    const titleEl   = document.getElementById('barberoModalTitle');
    const idInput   = document.getElementById('barberoId');
    const nombreIn  = document.getElementById('barberoNombre');
    const apodoIn   = document.getElementById('barberoApodo');
    const comIn     = document.getElementById('barberoComision');
    const duenioChk = document.getElementById('barberoDuenio');
    const comLabel  = document.getElementById('barberoComisionLabel');
    const activoChk = document.getElementById('barberoActivo');
    const delBtn    = document.getElementById('deleteBarberoBtn');

    if (b) {
      titleEl.textContent = 'Editar barbero';
      idInput.value       = b.id;
      nombreIn.value      = b.nombre;
      apodoIn.value       = b.apodo;
      const esDuenio      = b.comision == null;
      duenioChk.checked   = esDuenio;
      comIn.value         = esDuenio ? '' : b.comision;
      comLabel.hidden     = esDuenio;
      activoChk.checked   = b.activo !== false;
      delBtn.hidden       = false;
    } else {
      titleEl.textContent = 'Nuevo barbero';
      document.getElementById('barberoForm').reset();
      idInput.value   = '';
      comLabel.hidden = false;
      delBtn.hidden   = true;
    }
    modal.showModal();
  }

  function initBarberos() {
    const modal     = document.getElementById('barberoModal');
    const form      = document.getElementById('barberoForm');
    const duenioChk = document.getElementById('barberoDuenio');
    const comLabel  = document.getElementById('barberoComisionLabel');
    const delBtn    = document.getElementById('deleteBarberoBtn');

    document.getElementById('newBarberoBtn').addEventListener('click', () => openModal());

    duenioChk.addEventListener('change', () => { comLabel.hidden = duenioChk.checked; });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const id       = document.getElementById('barberoId').value;
      const nombre   = document.getElementById('barberoNombre').value.trim();
      const apodo    = document.getElementById('barberoApodo').value.trim();
      const esDuenio = document.getElementById('barberoDuenio').checked;
      const comision = esDuenio ? null : Number(document.getElementById('barberoComision').value);
      const activo   = document.getElementById('barberoActivo').checked;
      const data     = { nombre, apodo, comision, activo };

      if (id) {
        await updateDoc(doc(db, 'barberos', id), data);
      } else {
        await addDoc(barberosCol, { ...data, createdAt: serverTimestamp() });
      }
      modal.close();
    });

    delBtn.addEventListener('click', async () => {
      const id = document.getElementById('barberoId').value;
      if (id && confirm('¿Eliminar este barbero? Los cortes registrados no se borran.')) {
        await deleteDoc(doc(db, 'barberos', id));
        modal.close();
      }
    });

    modal.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => modal.close()));
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    onSnapshot(query(barberosCol, orderBy('nombre')), snap => {
      render(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  window.Panel.Barberos = { initBarberos };
})();
