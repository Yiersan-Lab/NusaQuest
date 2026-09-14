(function() {
  const pathname = window.location.pathname;
  const isLogin = pathname.includes('/dev/login');

  // Defense-in-depth: client-side auth verification on dev pages
  if (!isLogin && (pathname.startsWith('/dev') || pathname.includes('map_maker') || pathname.includes('npc_config') || pathname.includes('tile_viewer'))) {
    fetch('/api/dev/auth-status', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data || !data.authenticated) {
          window.location.replace('/dev/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        }
      })
      .catch(() => {
        window.location.replace('/dev/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
      });
  }

  const isMapMaker = pathname.includes('/dev/map_maker');
  const isTileViewer = pathname.includes('/dev/tile_viewer');
  const isNpcConfig = pathname.includes('/dev/npc_config');
  const isDevHub = pathname === '/dev' || pathname === '/dev/' || pathname.endsWith('/dev/index.html');


  const sidebarHtml = `
    <aside id="nqDevSidebar" class="nq-sidebar">
      <div class="nq-sidebar-header">
        <div class="nq-brand">
          <span class="nq-logo">NQ</span>
          <div class="nq-title-box">
            <span class="nq-title">NusaQuest</span>
            <span class="nq-subtitle">Dev Suite</span>
          </div>
        </div>
        <button id="nqToggleSidebarBtn" class="nq-toggle-btn" title="Toggle Sidebar"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
      </div>

      <nav class="nq-nav-menu">
        <a href="/dev/" class="nq-nav-item ${isDevHub ? 'active' : ''}">
          <span class="nq-icon"><i data-lucide="gamepad-2" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">Game Preview</span>
        </a>
        <a href="/dev/map_maker.html" class="nq-nav-item ${isMapMaker ? 'active' : ''}">
          <span class="nq-icon"><i data-lucide="map" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">Map Maker</span>
        </a>
        <a href="/dev/tile_viewer.html" class="nq-nav-item ${isTileViewer ? 'active' : ''}">
          <span class="nq-icon"><i data-lucide="grid" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">Tile Viewer & Tagger</span>
        </a>
        <a href="/dev/npc_config.html" class="nq-nav-item ${isNpcConfig ? 'active' : ''}">
          <span class="nq-icon"><i data-lucide="users" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">NPC Configurator</span>
        </a>
        <a href="/" class="nq-nav-item" style="margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 10px;">
          <span class="nq-icon"><i data-lucide="play" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">Main Game</span>
        </a>
        <button id="nqDevLogoutBtn" class="nq-nav-item nq-logout-item" style="background: none; border: none; width: 100%; text-align: left; cursor: pointer; color: #f87171;">
          <span class="nq-icon"><i data-lucide="log-out" style="width: 16px; height: 16px;"></i></span>
          <span class="nq-label">Lock Dev Suite</span>
        </button>
      </nav>

      <div class="nq-sidebar-footer">
        <div class="nq-sync-badge" title="Protected with HMAC session token">
          <span class="nq-dot"></span>
          <span>Dev Auth Active</span>
        </div>
      </div>
    </aside>
  `;


  const style = document.createElement('style');
  style.textContent = `
    body {
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
      transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    body.nq-sidebar-expanded {
      padding-left: 220px !important;
    }
    body.nq-sidebar-collapsed {
      padding-left: 60px !important;
    }

    .nq-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      width: 220px;
      background: #0b1324;
      border-right: 2px solid #334155;
      display: flex;
      flex-direction: column;
      height: 100vh;
      z-index: 9999;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      box-shadow: 4px 0 15px rgba(0,0,0,0.5);
    }
    .nq-sidebar.collapsed {
      width: 60px;
    }
    .nq-sidebar-header {
      padding: 14px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
    }
    .nq-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }
    .nq-logo {
      font-size: 20px;
    }
    .nq-title-box {
      display: flex;
      flex-direction: column;
      white-space: nowrap;
    }
    .nq-title {
      font-family: 'Press Start 2P', monospace, sans-serif;
      font-size: 11px;
      color: #f59e0b;
    }
    .nq-subtitle {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }
    .nq-sidebar.collapsed .nq-title-box,
    .nq-sidebar.collapsed .nq-label,
    .nq-sidebar.collapsed .nq-sidebar-footer span {
      display: none;
    }
    .nq-toggle-btn {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #475569;
      border-radius: 4px;
      width: 26px;
      height: 26px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.2s;
    }
    .nq-toggle-btn:hover {
      background: #334155;
      color: #fff;
    }
    .nq-nav-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 8px;
      flex: 1;
    }
    .nq-nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .nq-nav-item:hover {
      background: #1e293b;
      color: #f8fafc;
    }
    .nq-logout-item:hover {
      background: rgba(239, 68, 68, 0.15) !important;
      color: #fca5a5 !important;
    }
    .nq-nav-item.active {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .nq-icon {
      font-size: 16px;
    }
    .nq-sidebar-footer {
      padding: 12px;
      border-top: 1px solid #1e293b;
    }
    .nq-sync-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #4ade80;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.1);
      padding: 6px 10px;
      border-radius: 20px;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .nq-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }
  `;
  document.head.appendChild(style);

  function applyLayoutClass(isCollapsed) {
    if (isCollapsed) {
      document.body.classList.add('nq-sidebar-collapsed');
      document.body.classList.remove('nq-sidebar-expanded');
    } else {
      document.body.classList.add('nq-sidebar-expanded');
      document.body.classList.remove('nq-sidebar-collapsed');
    }
  }

  function initSidebar() {
    if (document.getElementById('nqDevSidebar')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = sidebarHtml;
    const sidebarEl = wrapper.firstElementChild;
    document.body.insertBefore(sidebarEl, document.body.firstChild);

    const isCollapsed = localStorage.getItem('NQ_SIDEBAR_COLLAPSED') === 'true';
    if (isCollapsed) {
      sidebarEl.classList.add('collapsed');
      const toggleBtn = sidebarEl.querySelector('#nqToggleSidebarBtn');
      if (toggleBtn) toggleBtn.innerHTML = '<i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>';
    }
    applyLayoutClass(isCollapsed);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }

    const logoutBtn = sidebarEl.querySelector('#nqDevLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await fetch('/api/dev/logout', { method: 'POST' });
        } catch (e) {}
        window.location.href = '/dev/login.html';
      });
    }

    sidebarEl.querySelector('#nqToggleSidebarBtn').addEventListener('click', () => {
      sidebarEl.classList.toggle('collapsed');
      const collapsedNow = sidebarEl.classList.contains('collapsed');
      sidebarEl.querySelector('#nqToggleSidebarBtn').innerHTML = collapsedNow
        ? '<i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>'
        : '<i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>';
      localStorage.setItem('NQ_SIDEBAR_COLLAPSED', collapsedNow);
      applyLayoutClass(collapsedNow);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    });
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();
