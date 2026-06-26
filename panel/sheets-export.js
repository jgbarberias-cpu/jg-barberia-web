// Manda una copia de cada turno y cada cambio de cliente a Google Sheets,
// vía un Apps Script Web App (ver sheets-config.js). Si falla, no rompe el panel,
// solo se pierde ese registro en la hoja (los datos reales siguen en Supabase).
(function () {
  function send(payload) {
    const url = window.PANEL_SHEETS_WEBHOOK_URL;
    if (!url || url.indexOf('REEMPLAZAR') === 0) return;

    fetch(url, { method: 'POST', body: JSON.stringify(payload) })
      .catch(err => console.warn('No se pudo registrar en Google Sheets:', err));
  }

  function logTurno(turno, accion) {
    send({
      tipo: 'turno',
      accion,
      fecha: turno.fecha,
      hora: turno.hora,
      cliente: turno.cliente,
      telefono: turno.telefono,
      servicioNombre: turno.servicioNombre,
      precio: turno.precio,
      estado: turno.estado,
      notas: turno.notas
    });
  }

  function logCliente(cliente, accion) {
    send({
      tipo: 'cliente',
      accion,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      instagram: cliente.instagram,
      email: cliente.email,
      notas: cliente.notas
    });
  }

  window.Panel = window.Panel || {};
  window.Panel.Sheets = { logTurno, logCliente };
})();
