// Login real con Supabase Auth (email + contraseña creados en el dashboard de Supabase).
(function () {
  const client = window.Panel.client;

  async function isLoggedIn() {
    const { data } = await client.auth.getSession();
    return !!data.session;
  }

  async function login(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    return !error;
  }

  async function logout() {
    await client.auth.signOut();
  }

  window.Panel.Auth = { isLoggedIn, login, logout };
})();
