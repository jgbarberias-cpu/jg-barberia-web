// Login con Supabase Auth (email + contraseña creados en el dashboard de Supabase).
// Cada usuario tiene una fila en "profiles" con su rol: 'empleado' o 'dueno'.
(function () {
  const client = window.Panel.client;

  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session || null;
  }

  async function isLoggedIn() {
    return !!(await getSession());
  }

  async function login(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    return !error;
  }

  async function logout() {
    await client.auth.signOut();
  }

  // Devuelve 'empleado', 'dueno', o null si no se pudo determinar.
  async function getRole() {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await client
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (error || !data) return null;
    return data.role;
  }

  window.Panel.Auth = { isLoggedIn, login, logout, getRole };
})();
