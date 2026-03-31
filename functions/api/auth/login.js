// functions/api/auth/login.js
import { json, err, hashPassword, token64 } from '../../_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const { username, password, rememberMe } = body;
  if (!username || !password) return err('Username and password required');

  const user = await env.DB.prepare(
    'SELECT id, username, role, password_hash, salt FROM users WHERE username = ?'
  ).bind(username.trim()).first();

  if (!user) return err('Invalid username or password', 401);

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) return err('Invalid username or password', 401);

  const sessionToken = token64();
  const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const expiresAt = Date.now() + ttl;

  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at, remember_me) VALUES (?,?,?,?)'
  ).bind(sessionToken, user.id, expiresAt, rememberMe ? 1 : 0).run();

  await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Date.now(), user.id).run();

  const cookieOpts = [
    `fd_session=${sessionToken}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    ...(rememberMe ? [`Max-Age=${30 * 24 * 60 * 60}`] : [])
  ].join('; ');

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieOpts
    }
  });
}
