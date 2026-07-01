(function () {
  const { isLoggedIn, login, logout, getRole } = window.Panel.Auth;

  let initialized = false;

  function initModules() {
    if (initialized) return;
    initialized = true;
    window.Panel.Servicios.initServicios();
    window.Panel.Turnos.initTurnos();
    window.Panel.Finanzas.initFinanzas();
    window.Panel.Clientes.initClientes();
    window.Panel.Resenas.initResenas();
    window.Panel.Tareas.initTareas();
    window.Panel.Planificacion.initPlanificacion();

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
        tab.classList.add('is-active');
        document.getElementById(`view-${tab.dataset.view}`).classList.add('is-active');
      });
    });

    // Cierre genérico de modales
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('dialog').close());
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await logout();
      location.reload();
    });
  }

  function applyRole(role) {
    document.getElementById('sidebarRole').textContent = role === 'dueno' ? 'Dueño' : 'Empleado';
    document.querySelectorAll('[data-role-only]').forEach(el => {
      if (el.dataset.roleOnly !== role) el.style.display = 'none';
    });
  }

  async function showDashboard() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('dashboard').hidden = false;
    initModules();
    const role = await getRole();
    applyRole(role);
  }

  function showLogin(message) {
    document.getElementById('dashboard').hidden = true;
    document.getElementById('loginScreen').hidden = false;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const ok = await login(email, password);
    if (ok) {
      showDashboard();
    } else {
      showLogin('Email o contraseña incorrectos.');
    }
  });

  (async () => {
    if (await isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }
  })();
})();
