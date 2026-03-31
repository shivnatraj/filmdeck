import { getUser, json, err } from '../_lib.js';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'google_client_id' LIMIT 1"
    ).first();
    return json({ google_client_id: row?.value || '' });
  } catch(e) {
    return json({ google_client_id: '' });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = getUser(context);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'admin') return err('Admin only', 403);

  const body = await request.json().catch(() => ({}));
  const clientId = (body.google_client_id || '').trim();

  if (clientId && !clientId.match(/^\d+-\w+\.apps\.googleusercontent\.com$/)) {
    return err('Invalid Client ID format. Must end in .apps.googleusercontent.com', 400);
  }

  try {
    await env.DB.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('google_client_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(clientId).run();
    return json({ ok: true });
  } catch(e) {
    return err('DB error: ' + e.message, 500);
  }
}
