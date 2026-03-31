// functions/api/projects/index.js
import { json, err, uid, getUser, logRevision } from '../../_lib.js';

export async function onRequestGet(context) {
  const { env } = context;
  const user = getUser(context);
  const now = Date.now();

  // Get projects owned by user OR shared with user
  const owned = await env.DB.prepare(
    'SELECT p.*, u.username as owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.owner_id = ? ORDER BY p.updated_at DESC'
  ).bind(user.id).all();

  const shared = await env.DB.prepare(
    'SELECT p.*, u.username as owner_name, pm.permission FROM projects p JOIN users u ON u.id = p.owner_id JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.updated_at DESC'
  ).bind(user.id).all();

  const allUsers = await env.DB.prepare('SELECT id, username, role FROM users ORDER BY username').all();

  return json({
    owned: owned.results,
    shared: shared.results,
    users: allUsers.results
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const { name, aspectRatio, director, writer, status, format, logline } = body;
  if (!name?.trim()) return err('Project name required');

  const id = uid();
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO projects (id, name, owner_id, aspect_ratio, director, writer, status, format, logline, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, name.trim(), user.id, aspectRatio||'2.39:1', director||'', writer||'', status||'Development', format||'Short Film', logline||'', now, now).run();

  await env.DB.prepare(
    'INSERT INTO schedule_config (project_id) VALUES (?)'
  ).bind(id).run();

  await logRevision(env, {
    projectId: id, userId: user.id,
    entityType: 'project', entityId: id,
    action: 'create', before: null, after: { name, aspectRatio, director, writer, status }
  });

  return json({ ok: true, id, name: name.trim(), owner_id: user.id, aspect_ratio: aspectRatio||'2.39:1', director: director||'', writer: writer||'', status: status||'Development', format: format||'Short Film', logline: logline||'', created_at: now, updated_at: now });
}
