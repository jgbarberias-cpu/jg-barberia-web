(function () {
  // Login desactivado temporalmente. panel/auth.js sigue existiendo (sin usar) para
  // cuando se quiera reactivar: hay que volver a poner el bloque #loginScreen en
  // index.html y el chequeo de isLoggedIn/login/logout acá.
  const { initServicios } = window.Panel.Servicios;
  const { initTurnos } = window.Panel.Turnos;
  const { initFinanzas } = window.Panel.Finanzas;
  const { initClientes } = window.Panel.Clientes;
  const { initResenas } = window.Panel.Resenas;
  const { initTareas } = window.Panel.Tareas;

  initServicios();
  initTurnos();
  initFinanzas();
  initClientes();
  initResenas();
  initTareas();

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
