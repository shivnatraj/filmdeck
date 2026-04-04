// FilmDeck Offline — fetch interceptor v3
// Load in <head> BEFORE the main app script
(function () {
  'use strict';
  const _fetch = window.fetch;

  // ── localStorage helpers ──────────────────────────────────────
  const LS = {
    get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k)    { try { localStorage.removeItem(k); } catch {} },
  };

  function queueAdd(item) {
    const q = LS.get('fd_queue') || [];
    q.push({ ...item, ts: Date.now() });
    LS.set('fd_queue', q);
    updateOfflineBar();
  }
  function queueAll()      { return LS.get('fd_queue') || []; }
  function queueRemove(ts) { LS.set('fd_queue', (LS.get('fd_queue') || []).filter(i => i.ts !== ts)); }

  function updateOfflineBar() {
    const bar = document.getElementById('offlineBar');
    if (!bar) return;
    const n = queueAll().length;
    bar.textContent = n
      ? `You are offline — ${n} change${n !== 1 ? 's' : ''} queued. Will sync when reconnected.`
      : 'You are offline — viewing cached data. Changes will sync when reconnected.';
  }

  function toast(msg, err) {
    const el = document.getElementById('toastEl');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (err ? ' err' : '');
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 3500);
  }

  function localId() {
    return 'offline_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ── Fake response for offline POSTs ──────────────────────────
  function fakeBody(url, method, rawBody) {
    const b = (() => { try { return JSON.parse(rawBody || '{}'); } catch { return {}; } })();
    const now = Date.now();
    if (method === 'POST' && url.includes('/api/scenes')) {
      return { ok: true, scene: {
        id: localId(), project_id: b.projectId || '',
        name: b.name || '', ie: b.ie || 'INT', dn: b.dn || 'DAY',
        cast: b.cast || '', description: b.description || '',
        pages: b.pages || 1, priority: b.priority || 'MEDIUM',
        sort_order: 0, created_at: now, updated_at: now,
      }};
    }
    if (method === 'POST' && url.includes('/api/shots')) {
      return { ok: true, shot: {
        id: localId(), scene_id: b.sceneId || '', project_id: b.projectId || '',
        type: b.type || 'MS', lens: b.lens || '', description: b.description || '',
        movement: b.movement || 'Static', notes: b.notes || '',
        mins: b.mins || 20, sort_order: 0, created_at: now, updated_at: now,
      }};
    }
    return { ok: true };
  }

  // ── Cached GET responses ──────────────────────────────────────
  function cachedGet(url) {
    try {
      const u   = new URL(url, location.href);
      const pid = u.searchParams.get('project_id');
      if (u.pathname.includes('/api/scenes') && pid) return { scenes: LS.get('fd_scenes_' + pid) || [] };
      if (u.pathname.includes('/api/shots')  && pid) return { shots:  LS.get('fd_shots_'  + pid) || [] };
      if (u.pathname.match(/\/api\/projects\/[^/?]+$/)) {
        const id = u.pathname.split('/api/projects/')[1];
        return LS.get('fd_project_' + id);
      }
      if (u.pathname === '/api/projects')           return LS.get('fd_projects');
      if (u.pathname.includes('/api/revisions'))    return { revisions: [] };
      if (u.pathname.includes('/api/users'))        return { users: [] };
      if (u.pathname.includes('/api/auth/me'))      return LS.get('fd_me');
    } catch {}
    return null;
  }

  // ── Detect "effectively offline" ─────────────────────────────
  // Handles both: ERR_INTERNET_DISCONNECTED (thrown) and SW fallback 503 (returned)
  function isOfflineResponse(res) {
    return res.status === 503 || res.status === 0;
  }

  // ── Patched fetch ─────────────────────────────────────────────
  window.fetch = async function (input, init) {
    const url    = typeof input === 'string' ? input : (input && input.url) || '';
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const body   = (init && init.body) || null;
    const isAPI  = url.includes('/api/');

    let res;
    try {
      res = await _fetch(input, init);
    } catch (err) {
      // Network-level failure (ERR_INTERNET_DISCONNECTED etc.)
      if (!isAPI) throw err;
      res = null; // treat as offline below
    }

    // SW returned a 503 fallback — treat as offline for API calls
    if (res && isAPI && isOfflineResponse(res)) {
      res = null;
    }

    if (res) {
      // Online success — cache useful GET responses
      if (res.ok && method === 'GET' && isAPI) {
        res.clone().json().then(data => window._fdCache && window._fdCache(url, data)).catch(() => {});
      }
      return res;
    }

    // ── Offline handling ──────────────────────────────────────
    if (method === 'GET') {
      const cached = cachedGet(url);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ scenes: [], shots: [], revisions: [], users: [], owned: [], shared: [], ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Write — queue and return fake success so UI updates immediately
    const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : null);
    queueAdd({ url, method, body: bodyStr });
    return new Response(JSON.stringify(fakeBody(url, method, bodyStr)), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };

  // ── Sync flush ────────────────────────────────────────────────
  async function flushQueue() {
    const queue = queueAll();
    if (!queue.length) return;
    toast(`Syncing ${queue.length} queued change${queue.length > 1 ? 's' : ''}…`);
    for (const item of queue) {
      try {
        const r = await _fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: item.body || undefined,
        });
        if (r.ok || r.status === 409) queueRemove(item.ts);
      } catch { break; }
    }
    const left = queueAll().length;
    if (!left) {
      toast('All changes synced ✓');
      document.getElementById('offlineBar')?.classList.remove('show');
      // Reload data after sync
      if (window.FD) {
        try { await FD.scenes.load(); } catch {}
      }
    } else {
      updateOfflineBar();
    }
  }

  window.addEventListener('online', () => {
    const sb = document.getElementById('syncBar');
    if (sb) { sb.classList.add('show'); setTimeout(() => sb.classList.remove('show'), 3000); }
    flushQueue();
  });
  window.addEventListener('offline', () => {
    document.getElementById('offlineBar')?.classList.add('show');
    updateOfflineBar();
  });

  if (navigator.onLine) setTimeout(flushQueue, 2000);

  // ── Cache writer ──────────────────────────────────────────────
  window._fdCache = function (url, data) {
    try {
      const u   = new URL(url, location.href);
      const pid = u.searchParams.get('project_id');
      if (u.pathname.includes('/api/scenes') && pid && data.scenes)  LS.set('fd_scenes_' + pid, data.scenes);
      if (u.pathname.includes('/api/shots')  && pid && data.shots)   LS.set('fd_shots_'  + pid, data.shots);
      if (u.pathname.match(/\/api\/projects\/[^/?]+$/) && data.project) LS.set('fd_project_' + data.project.id, data);
      if (u.pathname === '/api/projects')          LS.set('fd_projects', data);
      if (u.pathname.includes('/api/auth/me'))     LS.set('fd_me', data);
    } catch {}
  };

  // ── Clear stale project cache on delete ───────────────────────
  window._fdClearProjectCache = function (id) {
    LS.del('fd_project_' + id);
    LS.del('fd_scenes_' + id);
    LS.del('fd_shots_' + id);
    // Update projects list cache
    const projects = LS.get('fd_projects');
    if (projects) {
      if (projects.owned) projects.owned = projects.owned.filter(p => p.id !== id);
      if (projects.shared) projects.shared = projects.shared.filter(p => p.id !== id);
      LS.set('fd_projects', projects);
    }
  };

  console.log('[FilmDeck Offline] fetch interceptor ready');
})();
