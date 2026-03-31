// functions/_lib.js
// Shared utilities imported by API functions

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function uid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function token64() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function genSalt() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function logRevision(env, { projectId, userId, entityType, entityId, action, before, after }) {
  await env.DB.prepare(
    'INSERT INTO revisions (project_id, user_id, entity_type, entity_id, action, before_data, after_data, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(projectId, userId, entityType, entityId, action,
    before ? JSON.stringify(before) : null,
    after  ? JSON.stringify(after)  : null,
    Date.now()
  ).run();
}

export function getUser(context) {
  return context.data.user;
}

export async function canAccessProject(env, userId, projectId) {
  const owned = await env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND owner_id = ?'
  ).bind(projectId, userId).first();
  if (owned) return 'owner';

  const member = await env.DB.prepare(
    'SELECT permission FROM project_members WHERE project_id = ? AND user_id = ?'
  ).bind(projectId, userId).first();
  if (member) return member.permission;

  return null;
}
