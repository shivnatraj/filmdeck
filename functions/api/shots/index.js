// functions/api/shots/index.js
import { json, err, uid, getUser, canAccessProject, logRevision } from '../../_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = getUser(context);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!projectId) return err('project_id required');

  const perm = await canAccessProject(env, user.id, projectId);
  if (!perm) return err('Not found', 404);

  const shots = await env.DB.prepare(
    'SELECT * FROM shots WHERE project_id = ? ORDER BY scene_id, sort_order ASC, created_at ASC'
  ).bind(projectId).all();

  return json({ shots: shots.results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const { sceneId, projectId, type, lens, description, movement, notes, mins } = body;
  if (!sceneId || !projectId) return err('sceneId and projectId required');

  const perm = await canAccessProject(env, user.id, projectId);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM shots WHERE scene_id = ?').bind(sceneId).first();
  const sortOrder = countRow?.c || 0;

  const id = uid();
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO shots (id, scene_id, project_id, type, lens, description, movement, notes, mins, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, sceneId, projectId, type||'MS', lens||'', description||'', movement||'Static', notes||'', mins||20, sortOrder, now, now).run();

  const shot = { id, scene_id: sceneId, project_id: projectId, type: type||'MS', lens: lens||'', description: description||'', movement: movement||'Static', notes: notes||'', mins: mins||20, sort_order: sortOrder, created_at: now, updated_at: now };

  await logRevision(env, { projectId, userId: user.id, entityType: 'shot', entityId: id, action: 'create', before: null, after: shot });

  return json({ ok: true, shot });
}
