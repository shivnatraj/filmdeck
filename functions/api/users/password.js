// functions/api/users/password.js
import { json, err, getUser, hashPassword, genSalt } from '../../_lib.js';

export async function onRequestPut(context) {
  const { request, env } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const { currentPassword, newPassword, targetUserId } = body;

  // Admin resetting another user's password
  if (targetUserId && user.role === 'admin' && targetUserId !== user.id) {
    if (!newPassword || newPassword.length < 6) return err('Password must be at least 6 characters');
    const salt = genSalt();
    const hash = await hashPassword(newPassword, salt);
    await env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, targetUserId).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(targetUserId).run();
    return json({ ok: true });
  }

  // User changing own password
  if (!currentPassword || !newPassword) return err('Current and new password required');
  if (newPassword.length < 6) return err('New password must be at least 6 characters');

  const dbUser = await env.DB.prepare('SELECT password_hash, salt FROM users WHERE id=?').bind(user.id).first();
  const check = await hashPassword(currentPassword, dbUser.salt);
  if (check !== dbUser.password_hash) return err('Current password is incorrect', 401);

  const salt = genSalt();
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, user.id).run();

  // Invalidate other sessions (keep current)
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/fd_session=([a-f0-9]{64})/);
  if (match) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').bind(user.id, match[1]).run();
  }

  return json({ ok: true });
}
