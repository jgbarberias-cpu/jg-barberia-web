// Portal del cliente (antes estaba en línea dentro de cliente.html; separado para la política de seguridad CSP)
(function () {
  const cfg = window.REVIEWS_SUPABASE_CONFIG;
  const sb  = supabase.createClient(cfg.url, cfg.anonKey);

  const PUNTOS_META = 10;

  const loginEl    = document.getElementById('cpLogin');
  const loadingEl  = document.getElementById('cpLoading');
  const notFoundEl = document.getElementById('cpNotFound');
  const dashEl     = document.getElementById('cpDashboard');
  const logoutBtn  = document.getElementById('cpLogoutBtn');

  function normTel(t) { return (t || '').replace(/\D/g, ''); }

  function fmtFecha(f) {
    if (!f) return null;
    const [y, m, d] = String(f).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  function diasDesde(f) {
    if (!f) return null;
    const s = String(f).slice(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    return Math.floor((new Date() - new Date(y, m - 1, d)) / 86400000);
  }

  function fmtPesos(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showScreen(name) {
    loginEl.classList.toggle('is-active',    name === 'login');
    loadingEl.classList.toggle('is-active',  name === 'loading');
    notFoundEl.classList.toggle('is-active', name === 'notfound');
    dashEl.classList.toggle('is-active',     name === 'dashboard');
    logoutBtn.style.display = name === 'dashboard' ? 'block' : 'none';
  }

  function renderDashboard(cliente, servicios) {
    document.getElementById('cpNombre').textContent = (cliente.nombre || '').trim();

    // Cortes y beneficios
    const puntos = cliente.puntos || 0;
    document.getElementById('cpPuntos').textContent = puntos;

    const badgeDrink = document.getElementById('cpBadgeDrink');
    const badgeHalf  = document.getElementById('cpBadgeHalf');
    const badgeFree  = document.getElementById('cpBadgeFree');
    [badgeDrink, badgeHalf, badgeFree].forEach(b => b.classList.remove('is-active'));

    const mod  = puntos % 10;
    let subText = '';
    // La barra es el ciclo completo de 10 cortes, con las marcas 3° / 6° / 10° al 30% / 60% / 100%.
    // Antes se llenaba por tramo (con 2 cortes quedaba en 66%, pasando la marca del 6°,
    // y con 3 cortes llegaba al 100%, sobre el 🎁 del 10°).
    const pct = puntos > 0 && mod === 0 ? 100 : mod * 10;

    if (puntos === 0) {
      subText = 'Faltan 3 cortes para tu primera bebida gratis';
    } else if (mod === 3) {
      badgeDrink.classList.add('is-active');
      subText = `¡Llegaste al corte N°${puntos}! Tenés una bebida gratis ✓`;
    } else if (mod === 6) {
      badgeHalf.classList.add('is-active');
      subText = `¡Llegaste al corte N°${puntos}! Tu próximo corte tiene 50% de descuento ✓`;
    } else if (mod === 0) {
      badgeFree.classList.add('is-active');
      subText = `¡Llegaste al corte N°${puntos}! El próximo es completamente gratis ✓`;
    } else if (mod < 3) {
      const faltan = 3 - mod;
      subText = `Faltan ${faltan} corte${faltan !== 1 ? 's' : ''} para tu bebida gratis`;
    } else if (mod < 6) {
      const faltan = 6 - mod;
      subText = `Faltan ${faltan} corte${faltan !== 1 ? 's' : ''} para el 50% de descuento`;
    } else {
      const faltan = 10 - mod;
      subText = `Faltan ${faltan} corte${faltan !== 1 ? 's' : ''} para un corte gratis`;
    }
    document.getElementById('cpPuntosSub').textContent = subText;
    document.getElementById('cpPuntosBar').style.width = pct + '%';

    // Stats
    const cortes = cliente.cantidad_cortes || 0;
    document.getElementById('cpCortes').textContent = cortes;

    const ultima = cliente.ultima_visita;
    const dias = diasDesde(ultima);
    document.getElementById('cpDias').textContent = dias !== null ? dias : '—';
    document.getElementById('cpUltimaFecha').textContent = ultima
      ? `Último corte: ${fmtFecha(ultima)}`
      : 'Sin registro aún';

    // Servicios
    const svcEl = document.getElementById('cpServiciosList');
    const activos = (servicios || []).filter(s => s.activo !== false);
    svcEl.innerHTML = activos.length
      ? activos.map(s => `
          <div class="cp-servicio">
            <span class="cp-servicio__nombre">${escapeHtml(s.nombre)}</span>
            <span class="cp-servicio__precio">${fmtPesos(s.precio)}</span>
          </div>`).join('')
      : '<p class="cp-empty">Sin servicios cargados.</p>';
  }

  async function buscarCliente(tel) {
    showScreen('loading');
    document.getElementById('cpLoginError').hidden = true;

    try {
      // La base devuelve solo el cliente de ese teléfono (la tabla de clientes ya no es pública)
      const [clientesRes, svcRes] = await Promise.all([
        sb.rpc('portal_cliente', { p_tel: tel }),
        sb.from('servicios').select('*').order('nombre')
      ]);

      // supabase-js no tira excepción si falla la red: devuelve { error }. Sin esto,
      // un corte de conexión mostraba "No te encontramos" a un cliente registrado.
      if (clientesRes.error) throw clientesRes.error;
      const cliente = (clientesRes.data || [])[0];

      if (!cliente) {
        showScreen('notfound');
        return;
      }

      renderDashboard(cliente, svcRes.data || []);
      showScreen('dashboard');
      sessionStorage.setItem('jg_cliente_tel', tel);
    } catch (err) {
      showScreen('login');
      const errEl = document.getElementById('cpLoginError');
      errEl.textContent = 'Error de conexión. Intentá de nuevo.';
      errEl.hidden = false;
    }
  }

  // Login form
  document.getElementById('cpLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const tel = normTel(document.getElementById('cpPhone').value);
    if (!tel) return;
    await buscarCliente(tel);
  });

  // Try again
  document.getElementById('cpTryAgainBtn').addEventListener('click', () => {
    document.getElementById('cpPhone').value = '';
    showScreen('login');
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('jg_cliente_tel');
    document.getElementById('cpPhone').value = '';
    showScreen('login');
  });

  // Auto-login si hay sesión guardada
  const savedTel = sessionStorage.getItem('jg_cliente_tel');
  if (savedTel) {
    document.getElementById('cpPhone').value = savedTel;
    buscarCliente(savedTel);
  }
})();

// Header scroll shadow
(function () {
  var header = document.querySelector('.cp-header');
  window.addEventListener('scroll', function () {
    header.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.5)' : '';
  }, { passive: true });
})();
