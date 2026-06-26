function doGet(e) {
  if (e.parameter.action === 'dedup' && e.parameter.confirm === 'si') {
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
