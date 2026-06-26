// Capa de datos sobre Supabase. Imita la forma de las funciones de Firestore
// (collection/doc/addDoc/updateDoc/deleteDoc/onSnapshot/query/orderBy) para que
// servicios.js / finanzas.js / turnos.js no necesiten saber qué hay debajo.
(function () {
  const client = window.Panel.client;
  const db = {};
  const listenersByTable = {};
  const channelsByTable = {};

  function toSnake(str) {
    return str.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
  }

  function toCamel(str) {
    return str.replace(/_([a-z0-9])/g, (_, l) => l.toUpperCase());
  }

  function rowToCamel(row) {
    const out = {};
    for (const k in row) out[toCamel(k)] = row[k];
    return out;
  }

  function dataToSnake(data) {
    const out = {};
    for (const k in data) out[toSnake(k)] = data[k];
    return out;
  }

  function collection(_db, name) {
    return { name };
  }

  function doc(_db, name, id) {
    return { name, id };
  }

  function orderBy(field, direction = 'asc') {
    return { field: toSnake(field), direction };
  }

  function query(collectionRef, orderByRef) {
    return {
      name: collectionRef.name,
      orderByField: orderByRef && orderByRef.field,
      orderDirection: orderByRef && orderByRef.direction
    };
  }

  async function fetchSnapshot(name, sub) {
    let q = client.from(name).select('*');
    if (sub.orderByField) q = q.order(sub.orderByField, { ascending: sub.orderDirection !== 'desc' });
    const { data, error } = await q;
    if (error) {
      console.error(`Error leyendo "${name}":`, error.message);
      return { docs: [] };
    }
    return {
      docs: data.map(row => {
        const camel = rowToCamel(row);
        const { id, ...rest } = camel;
        return { id, data: () => rest };
      })
    };
  }

  function notifyTable(name) {
    const subs = listenersByTable[name];
    if (!subs) return;
    subs.forEach(sub => fetchSnapshot(name, sub).then(sub.callback));
  }

  function onSnapshot(refOrQuery, callback) {
    const name = refOrQuery.name;
    const sub = { orderByField: refOrQuery.orderByField, orderDirection: refOrQuery.orderDirection, callback };
    if (!listenersByTable[name]) listenersByTable[name] = new Set();
    listenersByTable[name].add(sub);

    fetchSnapshot(name, sub).then(callback);

    if (!channelsByTable[name]) {
      channelsByTable[name] = client
        .channel(`realtime-${name}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: name }, () => notifyTable(name))
        .subscribe();
    }

    return () => listenersByTable[name].delete(sub);
  }

  async function addDoc(collectionRef, data) {
    const row = dataToSnake(data);
    const { data: inserted, error } = await client.from(collectionRef.name).insert(row).select().single();
    if (error) {
      console.error(`Error creando en "${collectionRef.name}":`, error.message);
      throw error;
    }
    notifyTable(collectionRef.name);
    return { name: collectionRef.name, id: inserted.id };
  }

  async function updateDoc(docRef, data) {
    const row = dataToSnake(data);
    const { error } = await client.from(docRef.name).update(row).eq('id', docRef.id);
    if (error) console.error(`Error actualizando "${docRef.name}":`, error.message);
    notifyTable(docRef.name);
  }

  async function deleteDoc(docRef) {
    const { error } = await client.from(docRef.name).delete().eq('id', docRef.id);
    if (error) console.error(`Error eliminando en "${docRef.name}":`, error.message);
    notifyTable(docRef.name);
  }

  function serverTimestamp() {
    return new Date().toISOString();
  }

  window.Panel.Storage = {
    db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp
  };
})();
