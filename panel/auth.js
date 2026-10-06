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

  // Devuelve 'empleado', 'dueno', o null si el usuario no tiene rol asignado.
  // Si la consulta falla (red caída) tira el error: antes devolvía null y el
  // panel cerraba la sesión con "Sin acceso" por un simple corte de conexión.
  async function getRole() {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await client
      .from('barberia_roles')
      .select('rol')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ? data.rol : null;
  }

  window.Panel.Auth = { isLoggedIn, login, logout, getRole };
})();
