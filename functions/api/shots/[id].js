// functions/api/shots/[id].js
import { json, err, getUser, canAccessProject, logRevision } from '../../_lib.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const shot = await env.DB.prepare('SELECT * FROM shots WHERE id = ?').bind(params.id).first();
  if (!shot) return err('Not found', 404);

  const perm = await canAccessProject(env, user.id, shot.project_id);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  const before = { ...shot };
  const { type, lens, description, movement, notes, mins } = body;

  await env.DB.prepare(
    'UPDATE shots SET type=COALESCE(?,type), lens=COALESCE(?,lens), description=COALESCE(?,description), movement=COALESCE(?,movement), notes=COALESCE(?,notes), mins=COALESCE(?,mins), updated_at=? WHERE id=?'
  ).bind(type??null, lens??null, description??null, movement??null, notes??null, mins??null, Date.now(), params.id).run();

  await logRevision(env, { projectId: shot.project_id, userId: user.id, entityType: 'shot', entityId: params.id, action: 'update', before, after: body });

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const user = getUser(context);

  const shot = await env.DB.prepare('SELECT * FROM shots WHERE id = ?').bind(params.id).first();
  if (!shot) return err('Not found', 404);

  const perm = await canAccessProject(env, user.id, shot.project_id);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  await logRevision(env, { projectId: shot.project_id, userId: user.id, entityType: 'shot', entityId: params.id, action: 'delete', before: shot, after: null });

  await env.DB.prepare('DELETE FROM shots WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
