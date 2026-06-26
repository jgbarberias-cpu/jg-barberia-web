function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.tipo === 'cliente') {
    upsertClienteInfo(ss, data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
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

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getClientesSheet(ss) {
  var sheet = ss.getSheetByName('Clientes') || ss.insertSheet('Clientes');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Nombre', 'Teléfono', 'Instagram', 'Email', 'Notas', 'Cantidad de turnos', 'Última visita']);
  }
  return sheet;
}

function findClienteRow(sheet, telefono, nombre) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (telefono && values[i][1] === telefono) return i + 1;
    if (!telefono && values[i][0] === nombre) return i + 1;
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
