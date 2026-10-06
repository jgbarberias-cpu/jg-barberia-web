// Manda una copia de cada turno y cada cambio de cliente a Google Sheets,
// vía un Apps Script Web App (ver sheets-config.js). Si falla, no rompe el panel,
// solo se pierde ese registro en la hoja (los datos reales siguen en Supabase).
(function () {
  // Manda el payload junto con la sesión de quien está conectado: el Apps Script
  // la verifica contra Supabase y rechaza todo lo que no venga del personal.
  async function post(payload) {
    const url = window.PANEL_SHEETS_WEBHOOK_URL;
    if (!url || url.indexOf('REEMPLAZAR') === 0) return;

    const { data } = await window.Panel.client.auth.getSession();
    const accessToken = data.session ? data.session.access_token : null;
    return fetch(url, { method: 'POST', body: JSON.stringify({ ...payload, accessToken }) });
  }

  function send(payload) {
    post(payload).catch(err => console.warn('No se pudo registrar en Google Sheets:', err));
  }

  function logTurno(turno, accion) {
    send({
      tipo: 'turno',
      accion,
      id: turno.id,
      fecha: turno.fecha,
      // La base guarda "HH:MM:SS" y el Apps Script arma fecha + 'T' + hora + ':00':
      // con segundos la fecha queda inválida y el turno no llega al Calendar
      hora: turno.hora ? String(turno.hora).slice(0, 5) : turno.hora,
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
  window.Panel.Sheets = { logTurno, logCliente, post };
})();
