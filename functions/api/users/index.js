// functions/api/users/index.js
import { json, err, getUser } from '../../_lib.js';

export async function onRequestGet(context) {
  const { env } = context;
  const user = getUser(context);
  if (user.role !== 'admin') return err('Admin only', 403);

  const users = await env.DB.prepare(
    'SELECT id, username, role, created_at, last_login FROM users ORDER BY role DESC, username ASC'
  ).all();

  return json({ users: users.results });
}
