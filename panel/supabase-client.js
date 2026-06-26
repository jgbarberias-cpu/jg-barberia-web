(function () {
  const { url, anonKey } = window.PANEL_SUPABASE_CONFIG;
  window.Panel = window.Panel || {};
  window.Panel.client = window.supabase.createClient(url, anonKey);
})();
