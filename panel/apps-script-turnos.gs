// Ejecutar esta función manualmente una vez (▶ Ejecutar, eligiéndola en el
// desplegable de arriba) para que Google pida autorizar el acceso a Calendar.
function autorizarCalendar() {
  CalendarApp.getDefaultCalendar();
  Logger.log('Permisos de Calendar OK');
}

// ── Resumen diario por email ───────────────────────────────────────────────

// Ejecutar UNA VEZ manualmente para activar el envío automático a las 22hs.
function crearTriggerDiario() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'enviarResumenDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarResumenDiario')
    .timeBased()
    .atHour(22)
    .nearMinute(0)
    .everyDays(1)
    .create();
  Logger.log('Trigger creado: enviarResumenDiario a las 22hs');
}

function enviarResumenDiario() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Turnos');

  var ahora = new Date();
  var ahoraAr = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  var hoy = Utilities.formatDate(ahoraAr, 'UTC', 'yyyy-MM-dd');
  var mes = hoy.substring(0, 7);
  var fechaLinda = Utilities.formatDate(ahoraAr, 'UTC', 'dd/MM/yyyy');
  var mesLindo = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][ahoraAr.getMonth()] + ' ' + ahoraAr.getFullYear();

  var cortesHoy = [], cortesMes = [];

  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var fecha = String(row[2] || '').substring(0, 10);
      var estado = String(row[8] || '').toLowerCase();
      var accion = String(row[1] || '').toLowerCase();
      if (estado !== 'completado' || accion === 'eliminado') continue;
      var entry = { cliente: row[4] || '', servicio: row[6] || '', precio: Number(row[7]) || 0 };
      if (fecha === hoy) cortesHoy.push(entry);
      if (fecha.startsWith(mes)) cortesMes.push(entry);
    }
  }

  var totalHoy = cortesHoy.reduce(function(s, c) { return s + c.precio; }, 0);
  var totalMes = cortesMes.reduce(function(s, c) { return s + c.precio; }, 0);
  var fmt = function(n) { return '$' + n.toLocaleString('es-AR'); };

  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">';
  html += '<div style="background:#111;padding:20px;text-align:center"><span style="color:#c9a84c;font-size:22px;font-weight:bold">✂ JG Barbería</span></div>';

  // Resumen del día
  html += '<div style="padding:20px">';
  html += '<h2 style="color:#c9a84c;border-bottom:2px solid #c9a84c;padding-bottom:8px">Resumen del día — ' + fechaLinda + '</h2>';
  if (cortesHoy.length === 0) {
    html += '<p style="color:#888">Sin cortes registrados hoy.</p>';
  } else {
    html += '<p style="font-size:18px"><strong>' + cortesHoy.length + ' corte' + (cortesHoy.length !== 1 ? 's' : '') + '</strong> &nbsp;·&nbsp; <strong style="color:#c9a84c">' + fmt(totalHoy) + '</strong></p>';
    html += '<table style="width:100%;border-collapse:collapse;margin-top:8px">';
    html += '<tr style="background:#f5f5f5"><th style="text-align:left;padding:8px;border:1px solid #ddd">Cliente</th><th style="text-align:left;padding:8px;border:1px solid #ddd">Servicio</th><th style="text-align:right;padding:8px;border:1px solid #ddd">Precio</th></tr>';
    cortesHoy.forEach(function(c) {
      html += '<tr><td style="padding:8px;border:1px solid #ddd">' + c.cliente + '</td><td style="padding:8px;border:1px solid #ddd">' + c.servicio + '</td><td style="padding:8px;border:1px solid #ddd;text-align:right">' + fmt(c.precio) + '</td></tr>';
    });
    html += '</table>';
  }

  // Resumen del mes
  html += '<h2 style="color:#c9a84c;border-bottom:2px solid #c9a84c;padding-bottom:8px;margin-top:32px">Resumen del mes — ' + mesLindo + '</h2>';
  html += '<p style="font-size:18px"><strong>' + cortesMes.length + ' corte' + (cortesMes.length !== 1 ? 's' : '') + '</strong> &nbsp;·&nbsp; <strong style="color:#c9a84c">' + fmt(totalMes) + '</strong></p>';
  if (cortesMes.length > 0) {
    var promedio = Math.round(totalMes / cortesMes.length);
    html += '<p>Promedio por corte: <strong>' + fmt(promedio) + '</strong></p>';
  }

  html += '</div>';
  html += '<div style="background:#111;padding:12px;text-align:center;color:#666;font-size:12px">Enviado automáticamente desde el panel de JG Barbería</div>';
  html += '</div>';

  var asunto = 'JG Barbería ' + fechaLinda + ' — ' + cortesHoy.length + ' cortes hoy · ' + fmt(totalHoy);
  GmailApp.sendEmail('jgbarberias@gmail.com', asunto, '', { htmlBody: html });
}

var SPREADSHEET_ID = '17_xOGPKcw76AdiS8AMGk8jF9JydjReIyzC9RlAHBRQE';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === 'resumen') {
    enviarResumenDiario();
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === 'dedup' && params.confirm === 'si') {
    var resultado = deduplicarClientes();
    return ContentService.createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK');
}

// Fusiona filas duplicadas en "Clientes" (mismo teléfono normalizado, o mismo
// nombre si no hay teléfono), sumando cantidad de turnos y quedándose con el
// dato más completo de cada columna. Se llama solo manualmente vía GET con
// ?action=dedup&confirm=si.
function deduplicarClientes() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Clientes');
  if (!sheet) return { clientesFusionados: [], filasEliminadas: 0 };

  var values = sheet.getDataRange().getValues();
  var grupos = {};
  var orden = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var nombre = String(row[0] || '').trim();
    var tel = normTel(row[1]);
    var key = tel ? ('tel_' + tel) : ('nombre_' + nombre.toLowerCase());

    if (!grupos[key]) {
      grupos[key] = { indices: [], rows: [] };
      orden.push(key);
    }
    grupos[key].indices.push(i + 1);
    grupos[key].rows.push(row);
  }

  var reporte = [];
  var filasABorrar = [];

  orden.forEach(function (key) {
    var g = grupos[key];
    if (g.rows.length <= 1) return;

    var nombre = '', telefono = '', instagram = '', email = '', notas = '', cantidad = 0, ultima = '';
    g.rows.forEach(function (row) {
      if (String(row[0] || '').length > nombre.length) nombre = String(row[0] || '');
      if (!telefono && row[1]) telefono = row[1];
      if (!instagram && row[2]) instagram = row[2];
      if (!email && row[3]) email = row[3];
      if (!notas && row[4]) notas = row[4];
      cantidad += Number(row[5]) || 0;
      if (row[6] && (!ultima || String(row[6]) > String(ultima))) ultima = row[6];
    });

    var filaPrincipal = g.indices[0];
    sheet.getRange(filaPrincipal, 1, 1, 7).setValues([[nombre, telefono, instagram, email, notas, cantidad, ultima]]);

    for (var k = 1; k < g.indices.length; k++) {
      filasABorrar.push(g.indices[k]);
    }

    reporte.push({ cliente: nombre, telefono: telefono, filasFusionadas: g.indices.length, cantidadTotalTurnos: cantidad });
  });

  filasABorrar.sort(function (a, b) { return b - a; });
  filasABorrar.forEach(function (fila) { sheet.deleteRow(fila); });

  return { clientesFusionados: reporte, filasEliminadas: filasABorrar.length };
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = getSpreadsheet();

  if (data.tipo === 'cliente') {
    upsertClienteInfo(ss, data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.tipo === 'clientes_batch') {
    var clientes = data.clientes || [];
    clientes.forEach(function(c) { upsertClienteInfo(ss, c); });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, procesados: clientes.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var turnos = ss.getSheetByName('Turnos') || ss.insertSheet('Turnos');
  if (turnos.getLastRow() === 0) {
    turnos.appendRow([
      'Fecha registro', 'Acción', 'Fecha turno', 'Hora', 'Cliente',
      'Teléfono', 'Servicio', 'Precio', 'Estado', 'Notas'
    ]);
  }
  turnos.appendRow([
    new Date(), data.accion || '', data.fecha || '', data.hora || '',
    data.cliente || '', data.telefono || '', data.servicioNombre || '',
    data.precio || '', data.estado || '', data.notas || ''
  ]);

  if (data.accion !== 'Eliminado') {
    upsertClienteVisita(ss, data);
  }

  sincronizarCalendario(ss, data);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Crea/actualiza/borra el evento en Google Calendar correspondiente a un turno.
// Guarda la relación turnoId -> eventId en una hoja oculta "CalendarioIDs".
function getCalEventsSheet(ss) {
  var sheet = ss.getSheetByName('CalendarioIDs');
  if (!sheet) {
    sheet = ss.insertSheet('CalendarioIDs');
    sheet.appendRow(['TurnoId', 'EventId']);
    sheet.hideSheet();
  }
  return sheet;
}

function findEventRow(sheet, turnoId) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === turnoId) return i + 1;
  }
  return -1;
}

function sincronizarCalendario(ss, data) {
  if (!data.id || !data.fecha || !data.hora) return;

  var sheet = getCalEventsSheet(ss);
  var fila = findEventRow(sheet, data.id);
  var cal = CalendarApp.getDefaultCalendar();

  if (data.accion === 'Eliminado') {
    if (fila !== -1) {
      var eventId = sheet.getRange(fila, 2).getValue();
      try { cal.getEventById(eventId).deleteEvent(); } catch (err) { }
      sheet.deleteRow(fila);
    }
    return;
  }

  // Se fija la hora de Argentina (UTC-3, sin horario de verano) en el string ISO,
  // así no depende de la zona horaria configurada en el proyecto de Apps Script.
  var inicio = new Date(data.fecha + 'T' + data.hora + ':00-03:00');
  var fin = new Date(inicio.getTime() + 45 * 60000);
  var titulo = data.cliente + ' - ' + (data.servicioNombre || '');
  var descripcion = 'Servicio: ' + (data.servicioNombre || '') +
    '\nPrecio: $' + (data.precio || 0) +
    '\nTeléfono: ' + (data.telefono || '') +
    '\nEstado: ' + (data.estado || '') +
    (data.notas ? ('\nNotas: ' + data.notas) : '');

  if (fila === -1) {
    var event = cal.createEvent(titulo, inicio, fin, { description: descripcion });
    sheet.appendRow([data.id, event.getId()]);
  } else {
    var eventId2 = sheet.getRange(fila, 2).getValue();
    try {
      var ev = cal.getEventById(eventId2);
      ev.setTitle(titulo);
      ev.setTime(inicio, fin);
      ev.setDescription(descripcion);
    } catch (err) {
      var nuevoEvento = cal.createEvent(titulo, inicio, fin, { description: descripcion });
      sheet.getRange(fila, 2).setValue(nuevoEvento.getId());
    }
  }
}

function getClientesSheet(ss) {
  var sheet = ss.getSheetByName('Clientes') || ss.insertSheet('Clientes');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Nombre', 'Teléfono', 'Instagram', 'Email', 'Notas', 'Cantidad de turnos', 'Última visita']);
  }
  return sheet;
}

function normTel(tel) {
  return String(tel || '').replace(/\D/g, '');
}

function findClienteRow(sheet, telefono, nombre) {
  var tel = normTel(telefono);
  var nom = String(nombre || '').trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (tel && normTel(values[i][1]) === tel) return i + 1;
    if (!tel && String(values[i][0] || '').trim().toLowerCase() === nom) return i + 1;
  }
  return -1;
}

// Llamado al crear/editar un turno: solo actualiza nombre y visitas, no toca instagram/email.
function upsertClienteVisita(ss, data) {
  var telefono = (data.telefono || '').trim();
  var nombre = (data.cliente || '').trim();
  if (!telefono && !nombre) return;

  var sheet = getClientesSheet(ss);
  var fila = findClienteRow(sheet, telefono, nombre);

  if (fila === -1) {
    sheet.appendRow([nombre, telefono, '', '', '', 1, data.fecha || '']);
  } else {
    var actual = sheet.getRange(fila, 1, 1, 7).getValues()[0];
    sheet.getRange(fila, 1).setValue(nombre || actual[0]);
    if (data.accion === 'Nuevo') {
      sheet.getRange(fila, 6).setValue((actual[5] || 0) + 1);
    }
    sheet.getRange(fila, 7).setValue(data.fecha || actual[6]);
  }
}

// Llamado al crear/editar/eliminar un cliente desde la pestaña Clientes del panel.
function upsertClienteInfo(ss, data) {
  var sheet = getClientesSheet(ss);
  var telefono = (data.telefono || '').trim();
  var nombre = (data.nombre || '').trim();
  var fila = findClienteRow(sheet, telefono, nombre);

  if (data.accion === 'Eliminado') {
    if (fila !== -1) sheet.deleteRow(fila);
    return;
  }

  if (fila === -1) {
    sheet.appendRow([nombre, telefono, data.instagram || '', data.email || '', data.notas || '', 0, '']);
  } else {
    sheet.getRange(fila, 1).setValue(nombre);
    sheet.getRange(fila, 2).setValue(telefono);
    sheet.getRange(fila, 3).setValue(data.instagram || '');
    sheet.getRange(fila, 4).setValue(data.email || '');
    sheet.getRange(fila, 5).setValue(data.notas || '');
  }
}
