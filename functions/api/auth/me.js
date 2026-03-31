// functions/api/auth/me.js
import { json, getUser } from '../../_lib.js';

export async function onRequestGet(context) {
  const user = getUser(context);
  return json({ user });
}
