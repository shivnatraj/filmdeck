// functions/api/scenes/index.js
import { json, err, uid, getUser, canAccessProject, logRevision } from '../../_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = getUser(context);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!projectId) return err('project_id required');

  const perm = await canAccessProject(env, user.id, projectId);
  if (!perm) return err('Not found', 404);

  const scenes = await env.DB.prepare(
    'SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(projectId).all();

  return json({ scenes: scenes.results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const { projectId, name, ie, dn, cast, description, pages, priority } = body;
  if (!projectId) return err('projectId required');

  const perm = await canAccessProject(env, user.id, projectId);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM scenes WHERE project_id = ?').bind(projectId).first();
  const sortOrder = (countRow?.c || 0);

  const id = uid();
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO scenes (id, project_id, name, ie, dn, cast, description, pages, priority, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, projectId, name||'', ie||'INT', dn||'DAY', cast||'', description||'', pages||1, priority||'MEDIUM', sortOrder, now, now).run();

  const scene = { id, project_id: projectId, name: name||'', ie: ie||'INT', dn: dn||'DAY', cast: cast||'', description: description||'', pages: pages||1, priority: priority||'MEDIUM', sort_order: sortOrder, created_at: now, updated_at: now };

  await logRevision(env, { projectId, userId: user.id, entityType: 'scene', entityId: id, action: 'create', before: null, after: scene });

  return json({ ok: true, scene });
}
