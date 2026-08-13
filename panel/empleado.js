(function () {
  const { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, escapeHtml } = window.Panel.Storage;

  const clientesCol  = collection(db, 'clientes');
  const turnosCol    = collection(db, 'turnos');
  const finanzasCol  = collection(db, 'finanzas');
  const serviciosCol = collection(db, 'servicios');
  const barberosCol  = collection(db, 'barberos');

  let cacheClientes  = [];
  let cacheTurnos    = [];
  let cacheFinanzas  = [];
  let cacheServicios = [];
  let cacheBarberos  = [];

  const BARBEROS_DEFAULT = [
    { nombre: 'Santiago Barone',  apodo: 'Santy', comision: 5000, activo: true },
    { nombre: 'Sebastian Peralta', apodo: 'Seba',  comision: 5500, activo: true },
    { nombre: 'Juan Griguoli',    apodo: 'Juan',  comision: null,  activo: true },
  ];

  function getBarberos() {
    return cacheBarberos.length > 0 ? cacheBarberos : BARBEROS_DEFAULT;
  }

  function normTel(t) { return (t || '').replace(/\D/g, ''); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function horaActual() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
  function diasDesde(fecha) {
    if (!fecha) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    return Math.floor((new Date() - new Date(y, m - 1, d)) / 86400000);
  }
  function fmtFecha(f) {
    if (!f) return '-';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  }
  function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

  // ── Tabs empleado ──────────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.emp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab').forEach(t => t.classList.remove('is-active'));
        document.querySelectorAll('.emp-view').forEach(v => v.classList.remove('is-active'));
        tab.classList.add('is-active');
        document.getElementById(`empView${capitalize(tab.dataset.empView)}`).classList.add('is-active');
      });
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Vista Clientes ─────────────────────────────────────────────
  function yesterdayISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function renderLista() {
    const total = document.getElementById('empTotal');
    if (total) total.textContent = cacheClientes.length;

    const dl = document.getElementById('empClientesList');
    if (dl) dl.innerHTML = cacheClientes.map(c => `<option value="${c.nombre}">`).join('');

    const contenedor = document.getElementById('empClientesRecientes');
    if (!contenedor) return;

    const hoy  = todayISO();
    const ayer = yesterdayISO();

    const grupos = [
      { label: 'Hoy',  fecha: hoy },
      { label: 'Ayer', fecha: ayer }
    ];

    let html = '';
    grupos.forEach(({ label, fecha }) => {
      const cortes = cacheTurnos
        .filter(t => t.fecha === fecha && t.estado === 'completado')
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      if (cortes.length === 0) return;
      html += `<div class="emp-recientes-grupo">
        <div class="emp-recientes-titulo">${label} <span class="emp-recientes-count">${cortes.length}</span></div>
        ${cortes.map(t => {
          const tel = normTel(t.telefono);
          const waBtn = tel
            ? `<a href="https://wa.me/549${tel}" target="_blank" class="wa-circle-btn" title="WhatsApp"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>`
            : '';
          return `<div class="emp-reciente-fila">
            <span class="emp-reciente-hora">${t.hora || '—'}</span>
            <span class="emp-reciente-nombre">${t.cliente || '—'}</span>
            <span class="emp-reciente-barbero">${t.barbero || ''}</span>
            ${waBtn}
          </div>`;
        }).join('')}
      </div>`;
    });

    contenedor.innerHTML = html || '<p class="empty-state" style="margin-top:16px">No hay clientes de hoy ni de ayer.</p>';
  }

  function initFormClientes() {
    document.getElementById('empForm').addEventListener('submit', async e => {
      e.preventDefault();
      const nombre   = document.getElementById('empNombre').value.trim();
      const telRaw   = document.getElementById('empTelefono').value.trim();
      const telefono = normTel(telRaw);
      const msg      = document.getElementById('empMsg');

      const existe = cacheClientes.find(c => normTel(c.telefono) === telefono && telefono);
      if (existe) {
        msg.textContent = `${existe.nombre} ya está registrado.`;
        msg.style.color = 'var(--gold)';
        msg.hidden = false;
        setTimeout(() => { msg.hidden = true; }, 3000);
        return;
      }

      await addDoc(clientesCol, { nombre, telefono: telRaw, notas: '' });
      window.Panel.Sheets.logCliente({ nombre, telefono: telRaw, notas: '' }, 'Nuevo');
      document.getElementById('empForm').reset();
      msg.textContent = `✓ ${nombre} registrado correctamente.`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Avisos de beneficios ───────────────────────────────────────
  const WA_ICON_SMALL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  function renderBeneficiosNotif() {
    const el = document.getElementById('empBeneficiosNotif');
    if (!el) return;

    const conBeneficio = cacheClientes.filter(c => {
      const n = c.cantidadCortes || 0;
      const mod = n % 10;
      return n > 0 && (mod === 3 || mod === 6 || mod === 0);
    });

    if (conBeneficio.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="emp-beneficios-header">🎉 Clientes con beneficio disponible</div>
      ${conBeneficio.map(c => {
        const n   = c.cantidadCortes || 0;
        const mod = n % 10;
        const tel = normTel(c.telefono);
        const pNombre = (c.nombre || '').split(' ')[0];
        const label = mod === 0 ? '🎁 Corte gratis' : mod === 6 ? '✂️ 50% descuento' : '🥤 Bebida gratis';
        const msg = mod === 0
          ? `Hola ${pNombre}! 🎁 Llegaste a tu corte N°${n} en JG Barbería. ¡Tu próximo corte es GRATIS! Escribinos para reservar 💈`
          : mod === 6
          ? `Hola ${pNombre}! ✂️ Llegaste a tu corte N°${n} en JG Barbería. ¡Tu próximo corte tiene 50% de descuento! Escribinos para reservar 💈`
          : `Hola ${pNombre}! 🥤 Llegaste a tu corte N°${n} en JG Barbería. ¡Tenés una bebida gratis esperándote! Pasá cuando quieras 💈`;
        const waUrl = tel ? `https://wa.me/549${tel}?text=${encodeURIComponent(msg)}` : null;
        return `
          <div class="notif-beneficio">
            <div class="notif-beneficio__info">
              <span class="notif-beneficio__nombre">${c.nombre}</span>
              <span class="notif-beneficio__label">${label} — corte N°${n}</span>
            </div>
            ${waUrl
              ? `<a href="${waUrl}" target="_blank" rel="noopener" class="notif-wa-btn">${WA_ICON_SMALL} Avisar</a>`
              : '<span class="notif-sin-tel">Sin WA</span>'}
          </div>`;
      }).join('')}`;
  }

  // ── Contadores por barbero (dinámico desde DB) ─────────────────
  function renderContadores() {
    const hoy  = todayISO();
    const grid = document.getElementById('empContadoresGrid');
    if (!grid) return;

    let totalCortes = 0, totalDinero = 0;
    const activos = getBarberos().filter(b => b.activo !== false);

    grid.innerHTML = activos.map(b => {
      const cortes = cacheTurnos.filter(t =>
        t.fecha === hoy && t.barbero === b.nombre && t.estado === 'completado'
      );
      const dinero = cortes.reduce((s, t) => s + Number(t.precio || 0), 0);
      totalCortes += cortes.length;
      totalDinero += dinero;
      const para = b.comision != null ? cortes.length * b.comision : null;
      const display = (b.apodo || b.nombre).toUpperCase();
      return `
        <div class="emp-counter-card">
          <div class="emp-counter-name">${display}</div>
          <button class="emp-counter-btn" data-barbero="${b.nombre}" data-display="${display}">+</button>
          <div class="emp-counter-stats">
            <span class="emp-counter-num">${cortes.length}</span>
            <span class="emp-counter-label">cortes hoy</span>
          </div>
          <div class="emp-counter-money">${fmt(dinero)}</div>
          ${para !== null ? `<div class="emp-counter-comision">${fmt(para)} para ${b.apodo || b.nombre}</div>` : ''}
        </div>`;
    }).join('');

    const totalEl = document.getElementById('cntTotal');
    if (totalEl) totalEl.textContent = `${totalCortes} corte${totalCortes !== 1 ? 's' : ''} — ${fmt(totalDinero)}`;

    const listaEl = document.getElementById('cntClientesHoy');
    if (listaEl) {
      const cortesHoy = cacheTurnos
        .filter(t => t.fecha === hoy && t.estado === 'completado')
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      if (cortesHoy.length === 0) {
        listaEl.innerHTML = '';
      } else {
        listaEl.innerHTML = `
          <div class="cnt-clientes-hoy__titulo">Clientes de hoy</div>
          ${cortesHoy.map((t, i) => {
            const tel = normTel(t.telefono);
            const waBtn = tel
              ? `<a href="https://wa.me/549${escapeHtml(tel)}" target="_blank" rel="noopener" class="cnt-clientes-hoy__wa">WP</a>`
              : '';
            return `
            <div class="cnt-clientes-hoy__fila">
              <span class="cnt-clientes-hoy__num">${i + 1}</span>
              <span class="cnt-clientes-hoy__nombre">${escapeHtml(t.cliente || '—')}</span>
              <span class="cnt-clientes-hoy__barbero">${escapeHtml(t.barbero || '—')}</span>
              <span class="cnt-clientes-hoy__hora">${escapeHtml(t.hora || '')}</span>
              ${waBtn}
            </div>`;
          }).join('')}`;
      }
    }
  }

  // ── Resumen mensual en Finanzas ────────────────────────────────
  function renderResumenMes() {
    const ahora     = new Date();
    const mesISO    = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const mesNombre = ahora.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
    const periodoEl = document.getElementById('finMesPeriodo');
    if (periodoEl) periodoEl.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

    const grid = document.getElementById('finMesGrid');
    if (!grid) return;

    let totalCortes = 0, totalDinero = 0, totalComisiones = 0;
    const activos = getBarberos().filter(b => b.activo !== false && b.comision !== null);

    grid.innerHTML = activos.map(b => {
      const cortes = cacheTurnos.filter(t =>
        t.fecha && t.fecha.startsWith(mesISO) && t.barbero === b.nombre && t.estado === 'completado'
      );
      const dinero = cortes.reduce((s, t) => s + Number(t.precio || 0), 0);
      totalCortes += cortes.length;
      totalDinero += dinero;
      const comision = b.comision != null ? cortes.length * b.comision : 0;
      totalComisiones += comision;
      const comisionLine = b.comision != null
        ? `<div class="emp-mes-card__comision">${fmt(comision)} para ${b.apodo || b.nombre}</div>`
        : '';
      return `
        <div class="emp-mes-card">
          <div class="emp-mes-card__nombre">${(b.apodo || b.nombre).toUpperCase()}</div>
          <div class="emp-mes-card__cortes">${cortes.length} corte${cortes.length !== 1 ? 's' : ''}</div>
          <div class="emp-mes-card__dinero">${fmt(dinero)}</div>
          ${comisionLine}
        </div>`;
    }).join('');

    const neto = totalDinero - totalComisiones;
    grid.innerHTML += `
      <div class="emp-mes-card emp-mes-card--neto">
        <div class="emp-mes-card__nombre">PARA VOS (NETO)</div>
        <div class="emp-mes-card__cortes">${fmt(totalDinero)} − ${fmt(totalComisiones)} comisiones</div>
        <div class="emp-mes-card__dinero emp-mes-card__dinero--neto">${fmt(neto)}</div>
      </div>`;

    const totalEl = document.getElementById('finMesTotal');
    if (totalEl) totalEl.textContent = `${totalCortes} corte${totalCortes !== 1 ? 's' : ''} — ${fmt(totalDinero)} bruto`;
  }

  // ── Inicializar modal de contador ──────────────────────────────
  function initContadores() {
    const modal       = document.getElementById('counterModal');
    const form        = document.getElementById('counterForm');
    const successDiv  = document.getElementById('counterSuccess');
    const successTitle = document.getElementById('counterSuccessTitle');
    const successPts  = document.getElementById('counterSuccessPts');
    const waLink      = document.getElementById('counterWaLink');
    const barbInput   = document.getElementById('counterBarbero');
    const cliInput    = document.getElementById('counterCliente');
    const wppInput    = document.getElementById('counterWpp');
    const titleEl     = document.getElementById('counterModalTitle');
    const nuevoMsg    = document.getElementById('counterNuevoMsg');

    function resetModal() {
      form.hidden = false;
      successDiv.hidden = true;
      cliInput.value = '';
      wppInput.value = '';
      nuevoMsg.hidden = true;
    }

    function refreshDatalist() {
      const dl = document.getElementById('counterClientesList');
      if (dl) dl.innerHTML = cacheClientes.map(c => `<option value="${c.nombre}">`).join('');
    }

    modal.addEventListener('close', resetModal);

    // Event delegation: el grid se regenera en cada render
    document.getElementById('empContadoresGrid').addEventListener('click', e => {
      const btn = e.target.closest('.emp-counter-btn');
      if (!btn) return;
      resetModal();
      barbInput.value = btn.dataset.barbero;
      titleEl.textContent = `Corte — ${btn.dataset.display}`;
      refreshDatalist();
      modal.showModal();
      setTimeout(() => cliInput.focus(), 80);
    });

    cliInput.addEventListener('input', () => {
      const nombre = cliInput.value.trim();
      if (!nombre) { nuevoMsg.hidden = true; wppInput.value = ''; return; }
      const existe = cacheClientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (existe) {
        wppInput.value = existe.telefono || '';
        nuevoMsg.hidden = true;
      } else {
        wppInput.value = '';
        nuevoMsg.textContent = `"${nombre}" no está en la base — se creará como cliente nuevo`;
        nuevoMsg.hidden = false;
      }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const barbero       = barbInput.value;
      const clienteNombre = cliInput.value.trim();
      const wpp           = wppInput.value.trim();
      if (!clienteNombre) return;
      if (!wpp) { wppInput.focus(); wppInput.style.borderColor = 'red'; return; }
      wppInput.style.borderColor = '';

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;

      try {
        const servicio       = cacheServicios[0];
        const precio         = servicio ? servicio.precio : 10000;
        const servicioNombre = servicio ? servicio.nombre : 'Corte';
        const servicioId     = servicio ? servicio.id : null;

        const clienteReg = cacheClientes.find(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());
        let telefono = wpp;
        let clienteId = null;
        let currentPuntos = 0;
        let currentCortes = 0;

        if (!clienteReg) {
          const newRef = await addDoc(clientesCol, { nombre: clienteNombre, telefono: wpp, notas: '' });
          clienteId = newRef ? newRef.id : null;
          window.Panel.Sheets.logCliente({ nombre: clienteNombre, telefono: wpp, instagram: '', email: '', notas: '' }, 'Nuevo');
        } else {
          clienteId = clienteReg.id;
          currentPuntos = clienteReg.puntos || 0;
          currentCortes = clienteReg.cantidadCortes || 0;
          telefono = clienteReg.telefono || wpp;
          if (!clienteReg.telefono && wpp) {
            await updateDoc(doc(db, 'clientes', clienteReg.id), { telefono: wpp });
            window.Panel.Sheets.logCliente({ nombre: clienteNombre, telefono: wpp, instagram: '', email: '', notas: '' }, 'Actualizado');
          }
        }

        const finanzaRef = await addDoc(finanzasCol, {
          tipo: 'ingreso', fecha: todayISO(), monto: precio,
          descripcion: `${clienteNombre} — ${servicioNombre}`,
          categoria: 'Servicios', origen: 'contador', turnoId: null,
          createdAt: serverTimestamp()
        });

        const turnoRef = await addDoc(turnosCol, {
          cliente: clienteNombre, telefono, fecha: todayISO(), hora: horaActual(),
          servicioId, servicioNombre, precio, estado: 'completado',
          barbero, notas: '', facturado: true,
          finanzaId: finanzaRef.id, createdAt: serverTimestamp()
        });
        window.Panel.Sheets.logTurno({
          id: turnoRef ? turnoRef.id : '', cliente: clienteNombre, telefono,
          fecha: todayISO(), hora: horaActual(),
          servicioNombre, precio, estado: 'completado', notas: ''
        }, 'Nuevo');

        if (clienteId) {
          await updateDoc(doc(db, 'clientes', clienteId), {
            puntos: currentPuntos + 1,
            ultimaVisita: todayISO(),
            cantidadCortes: currentCortes + 1
          });
        }

        // Mostrar estado de éxito con botón WA
        const nuevoPuntos  = currentPuntos + 1;
        const nuevosCortes = currentCortes + 1;
        const pNombre      = clienteNombre.split(' ')[0];
        const telNorm      = normTel(telefono);
        const waMsg = `Hola ${pNombre}, gracias por tu visita a JG Barberia! Ya tenes ${nuevoPuntos} punto${nuevoPuntos !== 1 ? 's' : ''} acumulado${nuevoPuntos !== 1 ? 's' : ''}. Podes ver tu estado en: https://pagina-web-barberia-xi.vercel.app/cliente.html`;

        successTitle.textContent = `Corte de ${clienteNombre} registrado`;
        successPts.textContent   = `Corte N° ${nuevosCortes} — ${nuevoPuntos} punto${nuevoPuntos !== 1 ? 's' : ''} acumulado${nuevoPuntos !== 1 ? 's' : ''}`;

        if (telNorm) {
          waLink.href    = `https://wa.me/549${telNorm}?text=${encodeURIComponent(waMsg)}`;
          waLink.hidden  = false;
        } else {
          waLink.hidden = true;
        }

        form.hidden      = true;
        successDiv.hidden = false;

      } catch (err) { console.error(err); }

      submitBtn.disabled = false;
    });

    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    modal.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => modal.close()));
  }

  // ── Vista Finanzas del día ─────────────────────────────────────
  function populateServicios() {
    const sel = document.getElementById('empCorteServicio');
    if (!sel) return;
    const activos = cacheServicios.filter(s => s.activo !== false);
    sel.innerHTML = activos.map(s =>
      `<option value="${s.id}" data-precio="${s.precio}" data-nombre="${s.nombre}">${s.nombre} (${fmt(s.precio)})</option>`
    ).join('');
    const precioEl = document.getElementById('empCortePrecio');
    if (activos.length > 0 && precioEl) precioEl.value = activos[0].precio;
  }

  function populateBarberoSelect() {
    const sel = document.getElementById('empCorteBarbero');
    if (!sel) return;
    const activos = getBarberos().filter(b => b.activo !== false);
    sel.innerHTML = activos.map(b =>
      `<option value="${b.nombre}">${b.apodo || b.nombre}</option>`
    ).join('');
  }

  function renderCortes() {
    const hoy    = todayISO();
    const lista  = document.getElementById('empCortesLista');
    const empty  = document.getElementById('empCortesEmpty');
    const totalEl = document.getElementById('empTotalDia');
    if (!lista) return;

    const cortesHoy = cacheFinanzas
      .filter(f => f.fecha === hoy && f.tipo === 'ingreso')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    totalEl.textContent = fmt(cortesHoy.reduce((s, f) => s + Number(f.monto), 0));
    empty.hidden = cortesHoy.length > 0;
    lista.innerHTML = '';

    cortesHoy.forEach(f => {
      const row = document.createElement('div');
      row.className = 'emp-corte-row';
      row.innerHTML = `
        <div class="emp-corte-info">
          <span class="emp-corte-desc">${f.descripcion}</span>
          <span class="emp-corte-cat">${f.categoria || ''}</span>
        </div>
        <div class="emp-corte-right">
          <span class="emp-corte-monto">${fmt(f.monto)}</span>
          <button class="emp-corte-del" data-id="${f.id}" title="Eliminar">✕</button>
        </div>
      `;
      lista.appendChild(row);
    });

    lista.querySelectorAll('.emp-corte-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar este corte?')) await deleteDoc(doc(db, 'finanzas', btn.dataset.id));
      });
    });
  }

  function initFormCortes() {
    const sel    = document.getElementById('empCorteServicio');
    const precio = document.getElementById('empCortePrecio');
    if (!sel || !precio) return;

    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      if (opt) precio.value = opt.dataset.precio;
    });

    document.getElementById('empCorteForm').addEventListener('submit', async e => {
      e.preventDefault();
      const cliente        = document.getElementById('empCorteCliente').value.trim();
      const barbero        = document.getElementById('empCorteBarbero').value;
      const opt            = sel.selectedOptions[0];
      const servicioNombre = opt ? opt.dataset.nombre : '';
      const servicioId     = opt ? opt.value : null;
      const monto          = Number(precio.value);
      const msg            = document.getElementById('empCorteMsg');
      if (!cliente || !monto) return;

      const clienteReg = cacheClientes.find(c => c.nombre.toLowerCase() === cliente.toLowerCase());
      const telefono   = clienteReg ? clienteReg.telefono : '';

      const finanzaRef = await addDoc(finanzasCol, {
        tipo: 'ingreso', fecha: todayISO(), monto,
        descripcion: `${cliente} — ${servicioNombre}`,
        categoria: 'Servicios', origen: 'turno', turnoId: null,
        createdAt: serverTimestamp()
      });

      const turnoRef = await addDoc(turnosCol, {
        cliente, telefono, barbero, fecha: todayISO(), hora: horaActual(),
        servicioId, servicioNombre, precio: monto, estado: 'completado',
        notas: '', facturado: true, finanzaId: finanzaRef.id,
        createdAt: serverTimestamp()
      });
      window.Panel.Sheets.logTurno({
        id: turnoRef ? turnoRef.id : '', cliente, telefono,
        fecha: todayISO(), hora: horaActual(),
        servicioNombre, precio: monto, estado: 'completado', notas: ''
      }, 'Nuevo');

      if (clienteReg) {
        await updateDoc(doc(db, 'clientes', clienteReg.id), {
          puntos: (clienteReg.puntos || 0) + 1,
          ultimaVisita: todayISO(),
          cantidadCortes: (clienteReg.cantidadCortes || 0) + 1
        });
      }

      document.getElementById('empCorteForm').reset();
      populateServicios();
      populateBarberoSelect();
      msg.textContent = `✓ Corte de ${cliente} (${barbero}) registrado — ${fmt(monto)}`;
      msg.style.color = 'var(--green)';
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 3000);
    });
  }

  // ── Resumen de hoy en Finanzas ────────────────────────────────
  function renderResumenHoy() {
    const grid = document.getElementById('finHoyGrid');
    const totalEl = document.getElementById('finHoyTotal');
    if (!grid) return;

    const hoy = todayISO();
    let totalCortes = 0, totalDinero = 0;
    const activos = getBarberos().filter(b => b.activo !== false && b.comision !== null);

    grid.innerHTML = activos.map(b => {
      const cortes = cacheTurnos.filter(t =>
        t.fecha === hoy && t.barbero === b.nombre && t.estado === 'completado'
      );
      const dinero = cortes.reduce((s, t) => s + Number(t.precio || 0), 0);
      totalCortes += cortes.length;
      totalDinero += dinero;
      if (cortes.length === 0) return '';
      const comision = b.comision != null ? cortes.length * b.comision : 0;
      return `
        <div class="emp-mes-card">
          <div class="emp-mes-card__nombre">${(b.apodo || b.nombre).toUpperCase()}</div>
          <div class="emp-mes-card__cortes">${cortes.length} corte${cortes.length !== 1 ? 's' : ''}</div>
          <div class="emp-mes-card__dinero">${fmt(dinero)}</div>
          ${b.comision != null ? `<div class="emp-mes-card__comision">${fmt(comision)} para ${b.apodo || b.nombre}</div>` : ''}
        </div>`;
    }).join('');

    if (!grid.innerHTML.trim()) grid.innerHTML = '<p class="empty-state">Todavía no hay cortes hoy.</p>';
    if (totalEl) totalEl.textContent = `${totalCortes} corte${totalCortes !== 1 ? 's' : ''} — ${fmt(totalDinero)}`;
  }

  // ── Init principal ─────────────────────────────────────────────
  function initEmpleado(onLogout) {
    initTabs();
    initFormClientes();
    initFormCortes();
    initContadores();
    populateBarberoSelect();

    onSnapshot(query(clientesCol, orderBy('nombre')), snap => {
      cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
      renderBeneficiosNotif();
    });

    onSnapshot(query(turnosCol, orderBy('fecha')), snap => {
      cacheTurnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLista();
      renderContadores();
      renderResumenMes();
      renderResumenHoy();
    });

    onSnapshot(query(finanzasCol, orderBy('fecha', 'desc')), snap => {
      cacheFinanzas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCortes();
    });

    onSnapshot(query(serviciosCol, orderBy('nombre')), snap => {
      cacheServicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      populateServicios();
    });

    onSnapshot(query(barberosCol, orderBy('nombre')), snap => {
      cacheBarberos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderContadores();
      renderResumenMes();
      renderResumenHoy();
      populateBarberoSelect();
    });

    document.getElementById('empLogoutBtn').addEventListener('click', onLogout);
  }

  window.Panel.Empleado = { initEmpleado };
})();
