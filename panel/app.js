(function () {
  const { isLoggedIn, login, logout } = window.Panel.Auth;
  const { initServicios } = window.Panel.Servicios;
  const { initTurnos } = window.Panel.Turnos;
  const { initFinanzas } = window.Panel.Finanzas;
  const { initClientes } = window.Panel.Clientes;
  const { initResenas } = window.Panel.Resenas;

  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  let modulesInitialized = false;

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    if (!modulesInitialized) {
      modulesInitialized = true;
      initServicios();
      initTurnos();
      initFinanzas();
      initClientes();
      initResenas();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  (async () => {
    if (await isLoggedIn()) showDashboard(); else showLogin();
  })();

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const ok = await login(email, password);
    submitBtn.disabled = false;
    if (ok) {
      errorEl.hidden = true;
      showDashboard();
    } else {
      errorEl.textContent = 'Email o contraseña incorrectos.';
      errorEl.hidden = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
    showLogin();
  });

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
})();
