// functions/api/revisions/index.js
import { json, err, getUser, canAccessProject } from '../../_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = getUser(context);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!projectId) return err('project_id required');

  const perm = await canAccessProject(env, user.id, projectId);
  if (!perm) return err('Not found', 404);

  const revisions = await env.DB.prepare(
    'SELECT r.*, u.username FROM revisions r JOIN users u ON u.id = r.user_id WHERE r.project_id = ? ORDER BY r.created_at DESC LIMIT 100'
  ).bind(projectId).all();

  return json({ revisions: revisions.results });
}
