(function () {
  const { db, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.Panel.Storage;

  const planCol = collection(db, 'planificacion');
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const CATS = { limpieza: '🧹 Limpieza', marketing: '📣 Marketing', otra: '📌 Otra' };
  let cache = [];

  function renderBoard() {
    const board = document.getElementById('planBoard');
    board.innerHTML = '';

    DIAS.forEach((dia, idx) => {
      const diaNum = idx + 1;
      const tareas = cache.filter(t => t.dia === diaNum)
        .sort((a, b) => a.categoria.localeCompare(b.categoria));

      const col = document.createElement('div');
      col.className = 'plan-col';
      col.innerHTML = `<div class="plan-col__header">${dia}</div>`;

      const list = document.createElement('div');
      list.className = 'plan-list';

      tareas.forEach(t => {
        const card = document.createElement('div');
        card.className = `plan-card plan-card--${t.categoria}`;
        card.innerHTML = `
          <span class="plan-card__text">${t.descripcion}</span>
          <div class="plan-card__actions">
            <button class="plan-edit-btn" data-id="${t.id}" title="Editar">✏️</button>
            <button class="plan-del-btn" data-id="${t.id}" title="Eliminar">✕</button>
          </div>
        `;
        list.appendChild(card);
      });

      col.appendChild(list);

      const addForm = document.createElement('div');
      addForm.className = 'plan-add-form';
      addForm.innerHTML = `
        <input type="text" class="plan-input" placeholder="Nueva tarea..." data-dia="${diaNum}">
        <select class="plan-cat" data-dia="${diaNum}">
          <option value="limpieza">🧹 Limpieza</option>
          <option value="marketing">📣 Marketing</option>
          <option value="otra">📌 Otra</option>
        </select>
        <button class="btn btn--primary btn--small plan-save-btn" data-dia="${diaNum}">+</button>
      `;
      col.appendChild(addForm);
      board.appendChild(col);
    });

    board.querySelectorAll('.plan-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const diaNum = Number(btn.dataset.dia);
        const input = board.querySelector(`.plan-input[data-dia="${diaNum}"]`);
        const cat = board.querySelector(`.plan-cat[data-dia="${diaNum}"]`);
        const desc = input.value.trim();
        if (!desc) return;
        await addDoc(planCol, { dia: diaNum, descripcion: desc, categoria: cat.value });
        input.value = '';
      });
    });

    board.querySelectorAll('.plan-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar esta tarea del plan?')) {
          await deleteDoc(doc(db, 'planificacion', btn.dataset.id));
        }
      });
    });

    board.querySelectorAll('.plan-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.plan-card');
        const textEl = card.querySelector('.plan-card__text');
        const t = cache.find(x => x.id === btn.dataset.id);
        if (!t) return;

        card.innerHTML = `
          <input type="text" class="plan-input" value="${t.descripcion}" style="flex:1">
          <select class="plan-cat">
            <option value="limpieza" ${t.categoria === 'limpieza' ? 'selected' : ''}>🧹 Limpieza</option>
            <option value="marketing" ${t.categoria === 'marketing' ? 'selected' : ''}>📣 Marketing</option>
            <option value="otra" ${t.categoria === 'otra' ? 'selected' : ''}>📌 Otra</option>
          </select>
          <button class="btn btn--primary btn--small plan-save-edit" data-id="${t.id}">✓</button>
          <button class="btn btn--ghost btn--small plan-cancel-edit">✕</button>
        `;

        card.querySelector('.plan-save-edit').addEventListener('click', async () => {
          const newDesc = card.querySelector('.plan-input').value.trim();
          const newCat = card.querySelector('.plan-cat').value;
          if (!newDesc) return;
          await updateDoc(doc(db, 'planificacion', t.id), { descripcion: newDesc, categoria: newCat });
        });

        card.querySelector('.plan-cancel-edit').addEventListener('click', () => renderBoard());
      });
    });
  }

  function initPlanificacion() {
    onSnapshot(query(planCol, orderBy('dia')), snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBoard();
    });
  }

  window.Panel.Planificacion = { initPlanificacion };
})();
