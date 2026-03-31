// functions/api/projects/[id].js
import { json, err, getUser, canAccessProject, logRevision } from '../../_lib.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const user = getUser(context);
  const perm = await canAccessProject(env, user.id, params.id);
  if (!perm) return err('Not found', 404);

  const project = await env.DB.prepare(
    'SELECT p.*, u.username as owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?'
  ).bind(params.id).first();
  if (!project) return err('Not found', 404);

  const members = await env.DB.prepare(
    'SELECT pm.user_id, pm.permission, u.username FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?'
  ).bind(params.id).all();

  const config = await env.DB.prepare('SELECT * FROM schedule_config WHERE project_id = ?').bind(params.id).first();

  return json({ project, members: members.results, config, permission: perm });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const user = getUser(context);
  const perm = await canAccessProject(env, user.id, params.id);
  if (!perm || perm === 'view') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request'); }

  const before = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();

  // Auto-save endpoints — return early
  const blobFields = ['quotation_data','budget_data','print_records','moodboard_data','todo_data'];
  for (const field of blobFields) {
    if (body[field] !== undefined) {
      await env.DB.prepare(`UPDATE projects SET ${field}=?, updated_at=? WHERE id=?`)
        .bind(JSON.stringify(body[field]), Date.now(), params.id).run();
      return json({ ok: true });
    }
  }

  // Update project metadata
  if (body.name !== undefined || body.aspectRatio !== undefined ||
      body.director !== undefined || body.writer !== undefined ||
      body.status !== undefined || body.format !== undefined || body.logline !== undefined) {
    await env.DB.prepare(
      'UPDATE projects SET name=COALESCE(?,name), aspect_ratio=COALESCE(?,aspect_ratio), director=COALESCE(?,director), writer=COALESCE(?,writer), status=COALESCE(?,status), format=COALESCE(?,format), logline=COALESCE(?,logline), updated_at=? WHERE id=?'
    ).bind(body.name??null, body.aspectRatio??null, body.director??null, body.writer??null, body.status??null, body.format??null, body.logline??null, Date.now(), params.id).run();
  }

  if (body.config) {
    const c = body.config;
    await env.DB.prepare(
      'UPDATE schedule_config SET shoot_date=?, call_time=?, mins_per_shot=?, meal_after_hrs=?, meal_dur_mins=?, shots_per_day=? WHERE project_id=?'
    ).bind(c.shoot_date||'', c.call_time||'07:00', c.mins_per_shot||20, c.meal_after_hrs||6, c.meal_dur_mins||30, c.shots_per_day||16, params.id).run();
  }

  if (body.share !== undefined) {
    const { userId, permission } = body.share;
    if (perm !== 'owner') return err('Only owner can share', 403);
    if (permission === null) {
      await env.DB.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').bind(params.id, userId).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO project_members (project_id, user_id, permission, added_at) VALUES (?,?,?,?) ON CONFLICT(project_id, user_id) DO UPDATE SET permission = ?'
      ).bind(params.id, userId, permission, Date.now(), permission).run();
    }
  }

  await logRevision(env, { projectId: params.id, userId: user.id, entityType: 'project', entityId: params.id, action: 'update', before, after: body });
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const user = getUser(context);
  const project = await env.DB.prepare('SELECT owner_id FROM projects WHERE id = ?').bind(params.id).first();
  if (!project || project.owner_id !== user.id) return err('Forbidden', 403);
  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
