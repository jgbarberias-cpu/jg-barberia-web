// Manda una copia de cada turno creado/editado/eliminado a Google Sheets,
// vía un Apps Script Web App (ver sheets-config.js). Si falla, no rompe el panel,
// solo se pierde ese registro en la hoja (los datos reales siguen en Supabase).
(function () {
  function logTurno(turno, accion) {
    const url = window.PANEL_SHEETS_WEBHOOK_URL;
    if (!url || url.indexOf('REEMPLAZAR') === 0) return;

    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        accion,
        fecha: turno.fecha,
        hora: turno.hora,
        cliente: turno.cliente,
        telefono: turno.telefono,
        servicioNombre: turno.servicioNombre,
        precio: turno.precio,
        estado: turno.estado,
        notas: turno.notas
      })
    }).catch(err => console.warn('No se pudo registrar en Google Sheets:', err));
  }

  window.Panel = window.Panel || {};
  window.Panel.Sheets = { logTurno };
})();
