// functions/api/scenes/[id].js
import { json, err, getUser, canAccessProject, logRevision } from '../../_lib.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const user = getUser(context);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const scene = await env.DB.prepare('SELECT * FROM scenes WHERE id = ?').bind(params.id).first();
  if (!scene) return err('Not found', 404);

  const perm = await canAccessProject(env, user.id, scene.project_id);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  const before = { ...scene };
  const { name, ie, dn, cast, description, pages, priority, sort_order } = body;

  await env.DB.prepare(
    'UPDATE scenes SET name=COALESCE(?,name), ie=COALESCE(?,ie), dn=COALESCE(?,dn), cast=COALESCE(?,cast), description=COALESCE(?,description), pages=COALESCE(?,pages), priority=COALESCE(?,priority), sort_order=COALESCE(?,sort_order), updated_at=? WHERE id=?'
  ).bind(name??null, ie??null, dn??null, cast??null, description??null, pages??null, priority??null, sort_order??null, Date.now(), params.id).run();

  await logRevision(env, { projectId: scene.project_id, userId: user.id, entityType: 'scene', entityId: params.id, action: 'update', before, after: body });

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const user = getUser(context);

  const scene = await env.DB.prepare('SELECT * FROM scenes WHERE id = ?').bind(params.id).first();
  if (!scene) return err('Not found', 404);

  const perm = await canAccessProject(env, user.id, scene.project_id);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  await logRevision(env, { projectId: scene.project_id, userId: user.id, entityType: 'scene', entityId: params.id, action: 'delete', before: scene, after: null });

  await env.DB.prepare('DELETE FROM scenes WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
