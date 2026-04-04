// FilmDeck Patches — load at bottom of <body>, after FD's main script
(function () {
  'use strict';

  // ── Issue 1: Hide offline/sync bars in print ─────────────────
  const printCSS = document.createElement('style');
  printCSS.textContent = '@media print{.offline-bar,.sync-bar{display:none!important;}}';
  document.head.appendChild(printCSS);

  // ── Issue 4: Remove Anthropic API key section from Settings ──
  function removeApiKeySection() {
    document.querySelectorAll('#modal-settings .settings-section').forEach(sec => {
      if (sec.querySelector('.settings-title')?.textContent?.includes('Anthropic')) sec.remove();
    });
  }
  const settingsModal = document.getElementById('modal-settings');
  if (settingsModal) {
    new MutationObserver(removeApiKeySection).observe(settingsModal, { attributes: true, attributeFilter: ['class'] });
    removeApiKeySection();
  }

  setTimeout(function () {

    // Neutralise API key functions
    if (window.FD) { FD.saveApiKey = function(){}; FD.clearApiKey = function(){}; }

    // ── Issue 3: Patch project delete → clear cache + refresh UI ─
    if (window.FD?.projects?.delete) {
      const _orig = FD.projects.delete.bind(FD.projects);
      FD.projects.delete = async function (id) {
        await _orig(id);
        if (window._fdClearProjectCache) window._fdClearProjectCache(id);
        // Remove stale <option> immediately
        document.querySelector(`#projSel option[value="${id}"]`)?.remove();
      };
    }

    // ── Issue 5 & icon: Sidebar toggle — move ABOVE search bar ──
    // Use a distinct icon (not ☰ which clashes with Scenes ≡)
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
      toggle.remove();                // pull from header
      toggle.innerHTML = '◀';         // distinct collapse icon, not ☰/≡
      toggle.title = 'Toggle sidebar';
      // Re-style to fit sidebar top area
      toggle.style.cssText = [
        'width:100%',
        'padding:8px 14px',
        'background:none',
        'border:none',
        'border-bottom:1px solid var(--border)',
        'color:var(--text3)',
        'font-size:13px',
        'cursor:pointer',
        'text-align:left',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'transition:color .15s',
        'flex-shrink:0',
      ].join(';');
      toggle.onmouseover = function(){ this.style.color='var(--amber)'; };
      toggle.onmouseout  = function(){ this.style.color='var(--text3)'; };

      // Insert as FIRST child of sidebar (above .sidebar-logo and search)
      sidebar.insertBefore(toggle, sidebar.firstChild);

      // When collapsed, flip arrow direction
      const _origToggle = FD.toggleSidebar.bind(FD);
      FD.toggleSidebar = function() {
        _origToggle();
        const collapsed = sidebar.classList.contains('collapsed');
        toggle.innerHTML = collapsed ? '▶' : '◀';
      };
    }

    // ── Issue 6: Home button — inline in header next to logo ─────
    if (!document.getElementById('fdHomeBtn')) {
      const hdr = document.getElementById('hdr');
      if (!hdr) return;

      // Find the brand wrapper div (has .brand-name inside)
      const brandName = hdr.querySelector('.brand-name');
      const brandDiv  = brandName?.parentElement; // div with onclick="FD.go('overview')"
      if (!brandDiv) return;

      const btn = document.createElement('button');
      btn.id        = 'fdHomeBtn';
      btn.title     = 'Overview';
      btn.innerHTML = '⌂';
      btn.setAttribute('data-tip', 'Go to Overview');
      btn.style.cssText = [
        'background:none',
        'border:1px solid var(--border)',
        'color:var(--amber)',
        'width:26px',
        'height:26px',
        'border-radius:4px',
        'cursor:pointer',
        'font-size:14px',
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'flex-shrink:0',
        'vertical-align:middle',
        'transition:border-color .15s',
        'line-height:1',
      ].join(';');
      btn.onmouseover = function(){ this.style.borderColor='var(--amber)'; };
      btn.onmouseout  = function(){ this.style.borderColor='var(--border)'; };
      btn.onclick     = function(){ FD.go('overview'); };

      // Insert immediately AFTER the brand div, before the .hd divider
      brandDiv.insertAdjacentElement('afterend', btn);
    }

  }, 300);
})();
