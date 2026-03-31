// functions/_middleware.js
// Runs before every /api/* request. Validates session cookie.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Allow login and logout without auth
  const publicRoutes = ['/api/auth/login', '/api/auth/logout'];
  if (publicRoutes.includes(url.pathname)) {
    return next();
  }

  // Only protect /api/* routes
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.data.user = session.user;
  return next();
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/fd_session=([a-f0-9]{64})/);
  if (!match) return null;

  const token = match[1];
  const now = Date.now();

  const row = await env.DB.prepare(
    'SELECT s.token, s.expires_at, u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, now).first();

  if (!row) return null;
  return { user: { id: row.id, username: row.username, role: row.role } };
}
