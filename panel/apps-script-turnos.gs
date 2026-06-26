function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var turnos = ss.getSheetByName('Turnos') || ss.insertSheet('Turnos');
  if (turnos.getLastRow() === 0) {
    turnos.appendRow([
      'Fecha registro', 'Acción', 'Fecha turno', 'Hora', 'Cliente',
      'Teléfono', 'Servicio', 'Precio', 'Estado', 'Notas'
    ]);
  }
  turnos.appendRow([
    new Date(),
    data.accion || '',
    data.fecha || '',
    data.hora || '',
    data.cliente || '',
    data.telefono || '',
    data.servicioNombre || '',
    data.precio || '',
    data.estado || '',
    data.notas || ''
  ]);

  if (data.accion !== 'Eliminado') {
    upsertCliente(ss, data);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function upsertCliente(ss, data) {
  var telefono = (data.telefono || '').trim();
  var nombre = (data.cliente || '').trim();
  if (!telefono && !nombre) return;

  var clientes = ss.getSheetByName('Clientes') || ss.insertSheet('Clientes');
  if (clientes.getLastRow() === 0) {
    clientes.appendRow(['Nombre', 'Teléfono', 'Cantidad de turnos', 'Última visita']);
  }

  var values = clientes.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (telefono && values[i][1] === telefono) { foundRow = i + 1; break; }
    if (!telefono && values[i][0] === nombre) { foundRow = i + 1; break; }
  }

  if (foundRow === -1) {
    clientes.appendRow([nombre, telefono, 1, data.fecha || '']);
  } else {
    var fila = values[foundRow - 1];
    clientes.getRange(foundRow, 1).setValue(nombre || fila[0]);
    if (data.accion === 'Nuevo') {
      clientes.getRange(foundRow, 3).setValue((fila[2] || 0) + 1);
    }
    clientes.getRange(foundRow, 4).setValue(data.fecha || fila[3]);
  }
}
