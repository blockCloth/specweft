export function renderApp(repoPath: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SpecWeft — AI Coding Agent 本地伴侣层</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f4ef;
      --surface: #fbf9f5;
      --surface-white: #ffffff;
      --border: #e7e1d7;
      --fg: #1f2421;
      --muted: #5c635d;
      --muted-soft: #7f837d;
      --accent: #c4612f;
      --accent-hover: #a94e22;
      --accent-tint: #f2e3d6;
      --dark: #1f2421;
      --success: #2d7a4f;
      --warning: #d97757;
      --danger: #b84a3a;
      --shadow: 0 12px 32px rgba(31, 36, 33, 0.08);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-width: 320px;
      font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", sans-serif;
      font-weight: 300;
      line-height: 1.6;
      color: var(--fg);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }

    button, input, select, textarea { font: inherit; }
    strong, b { font-weight: 500; }

    .app-shell {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      background: var(--dark);
      color: #fff;
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .sidebar-header h1 {
      font-family: "DM Serif Display", Georgia, serif;
      font-size: 22px;
      font-weight: 400;
      letter-spacing: 0;
      margin-bottom: 4px;
    }

    .tagline {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 400;
      letter-spacing: 0.02em;
    }

    .project-picker {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .project-picker label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 8px;
      font-weight: 500;
    }

    .project-select {
      width: 100%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      padding: 8px 32px 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 400;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='white' stroke-opacity='0.6' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
    }

    .project-select option { color: var(--fg); background: #fff; }

    .nav {
      flex: 1;
      padding: 12px 0;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      border-left: 3px solid transparent;
      font-weight: 400;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    .nav-item.active {
      background: rgba(196, 97, 47, 0.12);
      color: #fff;
      border-left-color: var(--accent);
      font-weight: 500;
    }

    .nav-item .icon {
      width: 18px;
      height: 18px;
      opacity: 0.8;
      flex: 0 0 auto;
    }

    .main {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .topbar {
      background: var(--surface-white);
      border-bottom: 1px solid var(--border);
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .topbar h2 {
      font-family: "DM Serif Display", Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      letter-spacing: 0;
      color: var(--fg);
      white-space: nowrap;
    }

    .topbar-actions {
      display: none;
      gap: 12px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .topbar-actions.active { display: flex; }

    .btn {
      min-height: 34px;
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
      white-space: nowrap;
    }

    .btn svg { flex: 0 0 auto; }

    .btn-primary {
      background: var(--accent);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: var(--surface);
      color: var(--fg);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--surface-white);
      transform: translateY(-1px);
    }

    .btn-plain {
      background: transparent;
      color: var(--accent);
      border: 0;
      padding-inline: 8px;
    }

    .btn[disabled] {
      opacity: 0.58;
      cursor: not-allowed;
      transform: none;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
      display: none;
    }

    .content.active { display: block; }

    .tabs {
      display: flex;
      gap: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
    }

    .tab {
      padding: 12px 4px;
      font-size: 14px;
      font-weight: 400;
      color: var(--muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .tab:hover { color: var(--fg); }

    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      font-weight: 500;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--surface-white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 500;
      color: var(--accent);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 13px;
      color: var(--muted);
      font-weight: 400;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .card {
      background: var(--surface-white);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      transition: box-shadow 0.15s, transform 0.15s;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--fg);
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }

    .card-meta {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 12px;
      overflow-wrap: anywhere;
    }

    .card-desc {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 16px;
      overflow-wrap: anywhere;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      max-width: 100%;
    }

    .badge-installed, .badge-active {
      background: rgba(45, 122, 79, 0.12);
      color: var(--success);
    }

    .badge-available {
      background: var(--accent-tint);
      color: var(--accent);
    }

    .badge-muted {
      background: var(--surface);
      color: var(--muted);
      border: 1px solid var(--border);
    }

    .badge-warning {
      background: rgba(217, 119, 87, 0.12);
      color: var(--warning);
    }

    .toggle {
      position: relative;
      width: 42px;
      height: 24px;
      background: var(--border);
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.2s;
      flex: 0 0 auto;
      border: 0;
    }

    .toggle.active { background: var(--accent); }

    .toggle::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle.active::after { transform: translateX(18px); }

    .list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .list-item {
      background: var(--surface-white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: box-shadow 0.15s, transform 0.15s;
    }

    .list-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(31, 36, 33, 0.06);
    }

    .list-item-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--accent-tint);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      color: var(--accent);
    }

    .list-item-icon svg {
      width: 20px;
      height: 20px;
      color: currentColor;
    }

    .list-item-content {
      flex: 1;
      min-width: 0;
    }

    .list-item-title {
      font-size: 15px;
      font-weight: 500;
      color: var(--fg);
      margin-bottom: 2px;
      overflow-wrap: anywhere;
    }

    .list-item-desc {
      font-size: 13px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }

    .list-item-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: none;
      border: 1px solid var(--border);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      color: var(--muted);
    }

    .icon-btn:hover {
      background: var(--surface);
      color: var(--fg);
    }

    .search-bar {
      position: relative;
      margin-bottom: 24px;
    }

    .search-bar input {
      width: 100%;
      padding: 12px 16px 12px 42px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      background: var(--surface-white);
      color: var(--fg);
      font-family: inherit;
      font-weight: 300;
    }

    .search-bar input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .search-bar::before {
      content: "⌕";
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      opacity: 0.5;
    }

    .empty-state {
      text-align: center;
      padding: 56px 32px;
      background: var(--surface-white);
      border: 1px dashed var(--border);
      border-radius: 12px;
    }

    .empty-state h3 {
      font-family: "DM Serif Display", Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      margin-bottom: 8px;
      color: var(--fg);
    }

    .empty-state p {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 18px;
    }

    .form-grid {
      max-width: 720px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--fg);
      margin-bottom: 8px;
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 300;
      background: var(--surface);
      color: var(--fg);
      font-family: inherit;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 92px;
    }

    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--accent);
      background: var(--surface-white);
    }

    .hint {
      font-size: 12px;
      color: var(--muted);
      margin-top: 6px;
      line-height: 1.5;
    }

    .thread-wrap {
      background: var(--surface-white);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      transition: box-shadow 0.15s;
    }

    .thread-wrap:hover { box-shadow: 0 2px 8px rgba(31, 36, 33, 0.06); }

    .thread-head {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      cursor: pointer;
    }

    .thread-tl {
      display: none;
      border-top: 1px solid var(--border);
      padding: 16px 20px 20px;
    }

    .thread-tl.open { display: block; }

    .tl-track {
      border-left: 2px solid var(--border);
      margin-left: 4px;
      padding-left: 20px;
    }

    .tl-item {
      position: relative;
      padding: 10px 0;
    }

    .tl-item::before {
      content: "";
      position: absolute;
      left: -27px;
      top: 15px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--surface-white);
      border: 2px solid var(--border);
    }

    .tl-item:first-child::before {
      background: var(--accent);
      border-color: var(--accent);
    }

    .tl-arrow {
      transition: transform 0.2s;
      flex-shrink: 0;
      color: var(--muted);
    }

    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(31, 36, 33, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .modal-overlay.active { display: flex; }

    .modal {
      background: var(--surface-white);
      border-radius: 16px;
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(31, 36, 33, 0.2);
    }

    .modal-wide { max-width: 900px; width: 95vw; }

    .modal-header {
      padding: 24px 28px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }

    .modal-header h3 {
      font-family: "DM Serif Display", Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      margin-bottom: 4px;
    }

    .modal-header p {
      font-size: 13px;
      color: var(--muted);
    }

    .modal-body {
      padding: 28px;
      overflow-y: auto;
      flex: 1;
    }

    .modal-footer {
      padding: 20px 28px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--muted);
      font-size: 22px;
      line-height: 1;
      padding: 0;
    }

    .readable {
      color: var(--fg);
      font-size: 14px;
      line-height: 1.75;
      overflow-wrap: anywhere;
    }

    .readable h1,
    .readable h2,
    .readable h3 {
      font-family: "DM Serif Display", Georgia, serif;
      font-weight: 400;
      line-height: 1.25;
      margin: 18px 0 8px;
    }

    .readable p { margin: 8px 0; }
    .readable ul, .readable ol { margin: 8px 0 8px 22px; }

    .codebox {
      margin: 0;
      padding: 16px;
      font-size: 12px;
      line-height: 1.7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow: auto;
      white-space: pre-wrap;
      tab-size: 2;
      color: var(--fg);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      max-height: 420px;
    }

    .toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 1200;
      display: grid;
      gap: 8px;
      width: min(360px, calc(100vw - 48px));
    }

    .toast-item {
      background: var(--dark);
      color: #fff;
      border-radius: 10px;
      padding: 12px 14px;
      box-shadow: var(--shadow);
      font-size: 13px;
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
    }

    .inline-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .soft-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
      letter-spacing: 0.02em;
    }

    @media (max-width: 900px) {
      .app-shell { grid-template-columns: 1fr; }
      .sidebar {
        height: auto;
        max-height: 46vh;
      }
      .main { min-height: 54vh; }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }
      .content { padding: 20px; }
      .split { grid-template-columns: 1fr; }
      .list-item {
        align-items: flex-start;
        flex-direction: column;
      }
      .list-item-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>SpecWeft</h1>
        <div class="tagline">AI Coding Agent 伴侣层</div>
      </div>

      <div class="project-picker">
        <label for="projectSelect">当前项目</label>
        <select id="projectSelect" class="project-select">
          <option value="${escapeAttribute(repoPath)}">${escapeHtml(repoPath)}</option>
        </select>
      </div>

      <nav class="nav" aria-label="SpecWeft navigation">
        <a href="#overview" class="nav-item" data-view-target="overview">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0v-4a1 1 0 011-1h2a1 1 0 011 1v4"/></svg>
          概览
        </a>
        <a href="#skills" class="nav-item active" data-view-target="skills">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2"/></svg>
          Skills
        </a>
        <a href="#mcp" class="nav-item" data-view-target="mcp">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          MCP 服务
        </a>
        <a href="#config" class="nav-item" data-view-target="config">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          项目配置
        </a>
        <a href="#history" class="nav-item" data-view-target="history">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          修改历史
        </a>
        <a href="#threads" class="nav-item" data-view-target="threads">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          需求线程
        </a>
      </nav>
    </aside>

    <main class="main">
      <div class="topbar">
        <h2 id="pageTitle">Skills 管理</h2>
        <div id="topbarActionsOverview" class="topbar-actions">
          <button class="btn btn-secondary" data-action="refresh">刷新</button>
        </div>
        <div id="topbarActionsSkills" class="topbar-actions active">
          <button class="btn btn-secondary" data-action="open-modal" data-modal="marketplaceModal">浏览市场</button>
          <button class="btn btn-primary" data-action="analyze-skills">重新分析</button>
        </div>
        <div id="topbarActionsMcp" class="topbar-actions">
          <button class="btn btn-secondary" data-action="open-modal" data-modal="mcpMarketplaceModal">浏览 MCP 市场</button>
          <button class="btn btn-primary" data-action="refresh-mcps">刷新列表</button>
        </div>
        <div id="topbarActionsConfig" class="topbar-actions">
          <button class="btn btn-secondary" data-action="reset-settings">重置默认</button>
          <button class="btn btn-primary" data-action="save-settings">保存配置</button>
        </div>
        <div id="topbarActionsHistory" class="topbar-actions">
          <button class="btn btn-primary" data-action="generate-review">生成当前修改讲解</button>
        </div>
        <div id="topbarActionsThreads" class="topbar-actions">
          <button class="btn btn-primary" data-action="open-modal" data-modal="newThreadModal">新建线程</button>
        </div>
      </div>

      <section id="view-overview" class="content view">
        <div id="overviewStats" class="stats"></div>
        <div class="split">
          <div>
            <h3 class="soft-title">最近活动</h3>
            <div id="activityList" class="list"></div>
          </div>
          <div>
            <h3 class="soft-title">活跃需求线程</h3>
            <div id="activeThreadList" class="list"></div>
          </div>
        </div>
      </section>

      <section id="view-skills" class="content view active">
        <div class="tabs">
          <button class="tab active" data-action="switch-tab" data-tab-group="skills" data-tab="installed">已安装</button>
          <button class="tab" data-action="switch-tab" data-tab-group="skills" data-tab="recommended">智能推荐</button>
        </div>
        <div id="skillTabInstalled" data-tab-panel="skills:installed">
          <div id="skillStats" class="stats"></div>
          <div id="installedSkills" class="card-grid"></div>
        </div>
        <div id="skillTabRecommended" data-tab-panel="skills:recommended" style="display:none">
          <div class="card" style="margin-bottom:20px">
            <div class="card-title">按当前需求推荐 Skill</div>
            <div class="card-desc">输入你准备交给 Codex 或 Claude 的需求，SpecWeft 只匹配本地已安装和全局池里的 Skill；需要外部候选时再点浏览市场。</div>
            <div class="inline-row">
              <input id="skillTaskInput" class="project-select" style="background:var(--surface);border-color:var(--border);color:var(--fg);max-width:560px" placeholder="例：帮我优化登录页的表单校验和错误提示" />
              <button class="btn btn-primary" data-action="analyze-skills">分析需求</button>
            </div>
          </div>
          <div id="recommendedSkills" class="card-grid"></div>
        </div>
      </section>

      <section id="view-mcp" class="content view">
        <div class="search-bar">
          <input id="mcpSearchInput" type="text" placeholder="搜索 MCP 服务…" />
        </div>
        <div id="mcpList" class="list"></div>
      </section>

      <section id="view-config" class="content view">
        <div class="form-grid">
          <div class="card" style="margin-bottom:20px">
            <div class="card-title">修改记录</div>
            <div class="card-meta">SpecWeft 在 AI 写入代码后自动捕获的内容</div>
            <div class="form-group">
              <label>自动记录 Diff</label>
              <div class="inline-row">
                <button id="autoRecordDiffInput" class="toggle" data-setting-toggle="autoRecordDiff" type="button"></button>
                <span class="hint">每次文件变更后生成带时间戳的 diff 快照</span>
              </div>
            </div>
            <div class="form-group">
              <label>自动关联需求线程</label>
              <div class="inline-row">
                <button id="autoLinkRequirementInput" class="toggle" data-setting-toggle="autoLinkRequirement" type="button"></button>
                <span class="hint">将修改自动归入当前活跃的需求线程</span>
              </div>
            </div>
            <div class="form-group">
              <label for="retentionDaysInput">记录保留天数</label>
              <div class="inline-row">
                <input id="retentionDaysInput" type="number" min="7" style="width:110px" />
                <span class="hint">天后自动清理旧记录，0 表示永久保留</span>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom:20px">
            <div class="card-title">上下文记忆</div>
            <div class="card-meta">需求线程的上下文窗口与压缩策略</div>
            <div class="form-group">
              <label for="maxRetainedTurnsInput">最大保留轮数</label>
              <div class="inline-row">
                <input id="maxRetainedTurnsInput" type="number" min="1" max="200" style="width:110px" />
                <span class="hint">超出后按压缩策略处理</span>
              </div>
            </div>
            <div class="form-group">
              <label for="compressionStrategyInput">压缩策略</label>
              <select id="compressionStrategyInput">
                <option value="summary">摘要压缩 — 保留语义，适合长期需求</option>
                <option value="sliding-window">滑动窗口 — 只保留最近上下文</option>
                <option value="none">不压缩 — 适合短线程</option>
              </select>
              <div class="hint">恢复线程时默认只给 Agent 入口摘要，不把所有历史硬塞进上下文。</div>
            </div>
            <div class="form-group">
              <label for="ignorePathsInput">忽略路径（每行一个）</label>
              <textarea id="ignorePathsInput" placeholder="node_modules/&#10;dist/&#10;.next/" style="font-family:ui-monospace,monospace;font-size:13px"></textarea>
            </div>
          </div>

          <div class="card" style="margin-bottom:20px">
            <div class="card-title">Skills 与 MCP</div>
            <div class="card-meta">控制推荐来源和本地 MCP 注册行为</div>
            <div class="form-group">
              <label for="skillRegistryUrlInput">Skill 注册表地址</label>
              <input id="skillRegistryUrlInput" type="text" placeholder="https://skillsmp.com/api/skills" />
            </div>
            <div class="form-group">
              <label>自动检查 Skill 更新</label>
              <div class="inline-row">
                <button id="autoCheckSkillUpdatesInput" class="toggle" data-setting-toggle="autoCheckSkillUpdates" type="button"></button>
                <span class="hint">项目打开时静默检查已安装 Skills 的新版本</span>
              </div>
            </div>
            <div class="form-group">
              <label for="mcpTimeoutInput">MCP stdio 默认超时（秒）</label>
              <div class="inline-row">
                <input id="mcpTimeoutInput" type="number" min="5" style="width:110px" />
                <span class="hint">超时后 SpecWeft 标记该 MCP 为不可用</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="view-history" class="content view">
        <div class="search-bar">
          <input id="historySearchInput" type="text" placeholder="搜索修改记录…" />
        </div>
        <div class="inline-row" style="margin-bottom:24px">
          <button class="btn btn-primary" data-history-filter="all">全部</button>
          <button class="btn btn-secondary" data-history-filter="current">当前代码</button>
          <button class="btn btn-secondary" data-history-filter="stale">历史版本</button>
        </div>
        <div id="historyList" class="list"></div>
      </section>

      <section id="view-threads" class="content view">
        <div class="search-bar" style="max-width:440px">
          <input id="threadSearchInput" type="text" placeholder="搜索需求线程…" />
        </div>
        <div id="threadList" style="display:flex;flex-direction:column;gap:12px"></div>
      </section>
    </main>
  </div>

  <div class="modal-overlay" id="newThreadModal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h3>新建需求线程</h3>
          <p>创建一个新的需求上下文，方便跨 Session 恢复</p>
        </div>
        <button class="close-btn" data-action="close-modal" data-modal="newThreadModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="newThreadTitle">需求标题</label>
          <input id="newThreadTitle" type="text" placeholder="例：用户权限体系重构" />
        </div>
        <div class="form-group">
          <label for="newThreadSummary">需求描述</label>
          <textarea id="newThreadSummary" placeholder="详细描述你的需求，SpecWeft 会将此作为上下文基础保存…"></textarea>
        </div>
        <div class="form-group">
          <label for="newThreadKeywords">关键词</label>
          <input id="newThreadKeywords" type="text" placeholder="权限, 登录, AuthService" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal" data-modal="newThreadModal">取消</button>
        <button class="btn btn-primary" data-action="create-thread">创建线程</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="marketplaceModal">
    <div class="modal" style="max-width:780px">
      <div class="modal-header">
        <div>
          <h3>Skills 市场</h3>
          <p>从社区和官方发布中找到适合你项目的 Skill</p>
        </div>
        <button class="close-btn" data-action="close-modal" data-modal="marketplaceModal">×</button>
      </div>
      <div class="modal-body">
        <div class="search-bar" style="margin-bottom:20px">
          <input id="skillMarketplaceSearch" type="text" placeholder="搜索 Skills…" />
        </div>
        <div class="inline-row" style="margin-bottom:20px">
          <button class="btn btn-secondary" data-market-keyword="">全部</button>
          <button class="btn btn-secondary" data-market-keyword="review">代码质量</button>
          <button class="btn btn-secondary" data-market-keyword="test">测试</button>
          <button class="btn btn-secondary" data-market-keyword="doc">文档</button>
          <button class="btn btn-secondary" data-market-keyword="security">安全</button>
        </div>
        <div id="skillMarketplaceList" class="card-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal" data-modal="marketplaceModal">关闭</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="mcpMarketplaceModal">
    <div class="modal" style="max-width:780px">
      <div class="modal-header">
        <div>
          <h3>MCP 市场</h3>
          <p>MCP 不是必须安装项，只在项目真正需要外部能力时推荐</p>
        </div>
        <button class="close-btn" data-action="close-modal" data-modal="mcpMarketplaceModal">×</button>
      </div>
      <div class="modal-body">
        <div class="search-bar" style="margin-bottom:20px">
          <input id="mcpMarketplaceSearch" type="text" placeholder="搜索 MCP…" />
        </div>
        <div class="inline-row" style="margin-bottom:20px">
          <button class="btn btn-secondary" data-mcp-keyword="">全部</button>
          <button class="btn btn-secondary" data-mcp-keyword="filesystem">文件系统</button>
          <button class="btn btn-secondary" data-mcp-keyword="database">数据库</button>
          <button class="btn btn-secondary" data-mcp-keyword="github">代码托管</button>
          <button class="btn btn-secondary" data-mcp-keyword="search">搜索</button>
        </div>
        <div id="mcpMarketplaceList" class="list"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal" data-modal="mcpMarketplaceModal">关闭</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="detailModal">
    <div class="modal modal-wide">
      <div class="modal-header">
        <div>
          <h3 id="detailTitle">详情</h3>
          <p id="detailMeta"></p>
        </div>
        <button class="close-btn" data-action="close-modal" data-modal="detailModal">×</button>
      </div>
      <div class="modal-body">
        <div id="detailBody" class="readable"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal" data-modal="detailModal">关闭</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="reviewModal">
    <div class="modal modal-wide">
      <div class="modal-header">
        <div>
          <h3 id="reviewTitle">代码讲解</h3>
          <p id="reviewMeta"></p>
        </div>
        <button class="close-btn" data-action="close-modal" data-modal="reviewModal">×</button>
      </div>
      <div class="modal-body">
        <div id="reviewBody" class="readable"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal" data-modal="reviewModal">关闭</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    var INITIAL_REPO = ${JSON.stringify(repoPath)};
    var state = {
      repoPath: INITIAL_REPO,
      activeView: "skills",
      projects: null,
      dashboard: null,
      settings: null,
      skillMarket: null,
      mcpMarket: null,
      historyFilter: "all"
    };

    var viewTitles = {
      overview: "概览",
      skills: "Skills 管理",
      mcp: "MCP 服务",
      config: "项目配置",
      history: "修改历史",
      threads: "需求线程"
    };

    init();

    async function init() {
      bindEvents();
      switchView((location.hash || "#skills").slice(1) || "skills");
      await loadProjectShell();
      await loadDashboard();
      await loadSkillMarketplace("");
      await loadMcpMarketplace("");
    }

    function bindEvents() {
      document.querySelectorAll(".nav-item").forEach(function(link) {
        link.addEventListener("click", function(event) {
          event.preventDefault();
          switchView(link.dataset.viewTarget || "skills");
        });
      });

      document.body.addEventListener("click", function(event) {
        var target = event.target.closest("[data-action]");
        if (!target) return;
        var action = target.dataset.action;
        if (action === "open-modal") openModal(target.dataset.modal);
        if (action === "close-modal") closeModal(target.dataset.modal);
        if (action === "switch-tab") switchTab(target);
        if (action === "refresh") loadDashboard(true);
        if (action === "refresh-mcps") loadDashboard(true);
        if (action === "analyze-skills") analyzeSkills(target);
        if (action === "toggle-capability") toggleCapability(target);
        if (action === "show-skill-detail") showSkillDetail(target.dataset.skillId);
        if (action === "preview-market-skill") previewMarketplaceSkill(target.dataset.skillId);
        if (action === "install-market-skill") installMarketplaceSkill(target.dataset.skillId);
        if (action === "install-market-mcp") installMarketplaceMcp(target.dataset.mcpId);
        if (action === "save-settings") saveSettings(target);
        if (action === "reset-settings") resetSettings();
        if (action === "generate-review") generateReview(target);
        if (action === "open-memory") openMemory(target.dataset.memoryId);
        if (action === "restore-thread") restoreThread(target.dataset.requirementId);
        if (action === "set-active-thread") setActiveThread(target.dataset.requirementId);
        if (action === "create-thread") createThread(target);
        if (action === "toggle-thread") toggleThread(target);
      });

      document.body.addEventListener("click", function(event) {
        var marketKeyword = event.target.closest("[data-market-keyword]");
        if (marketKeyword) loadSkillMarketplace(marketKeyword.dataset.marketKeyword || "");
        var mcpKeyword = event.target.closest("[data-mcp-keyword]");
        if (mcpKeyword) loadMcpMarketplace(mcpKeyword.dataset.mcpKeyword || "");
        var historyFilter = event.target.closest("[data-history-filter]");
        if (historyFilter) {
          state.historyFilter = historyFilter.dataset.historyFilter || "all";
          document.querySelectorAll("[data-history-filter]").forEach(function(item) {
            item.className = "btn " + (item.dataset.historyFilter === state.historyFilter ? "btn-primary" : "btn-secondary");
          });
          renderHistory();
        }
      });

      document.getElementById("projectSelect").addEventListener("change", async function(event) {
        state.repoPath = event.target.value || state.repoPath;
        await api("/api/projects/active", {
          method: "POST",
          body: { repoPath: state.repoPath }
        });
        await loadDashboard(true);
      });

      document.getElementById("mcpSearchInput").addEventListener("input", renderMcpList);
      document.getElementById("historySearchInput").addEventListener("input", renderHistory);
      document.getElementById("threadSearchInput").addEventListener("input", renderThreads);
      document.getElementById("skillMarketplaceSearch").addEventListener("keydown", function(event) {
        if (event.key === "Enter") loadSkillMarketplace(event.target.value.trim());
      });
      document.getElementById("mcpMarketplaceSearch").addEventListener("keydown", function(event) {
        if (event.key === "Enter") loadMcpMarketplace(event.target.value.trim());
      });

      document.querySelectorAll(".modal-overlay").forEach(function(overlay) {
        overlay.addEventListener("click", function(event) {
          if (event.target === overlay) overlay.classList.remove("active");
        });
      });

      document.querySelectorAll("[data-setting-toggle]").forEach(function(toggle) {
        toggle.addEventListener("click", function() {
          toggle.classList.toggle("active");
        });
      });
    }

    async function api(path, options) {
      options = options || {};
      var initOptions = {
        method: options.method || "GET",
        headers: options.headers || {}
      };
      if (options.body !== undefined) {
        initOptions.headers = Object.assign({}, initOptions.headers, { "Content-Type": "application/json" });
        initOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      }
      var response = await fetch(path, initOptions);
      var text = await response.text();
      var data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error((data && data.error) || text || response.statusText);
      }
      return data;
    }

    async function loadProjectShell() {
      try {
        state.projects = await api("/api/projects");
        renderProjects();
      } catch (error) {
        showToast("项目列表读取失败：" + error.message);
      }
    }

    async function loadDashboard(forceToast) {
      try {
        state.dashboard = await api("/api/dashboard/summary?repo=" + encodeURIComponent(state.repoPath));
        state.settings = state.dashboard.settings;
        if (state.dashboard.profile && state.dashboard.profile.rootPath) state.repoPath = state.dashboard.profile.rootPath;
        renderAll();
        if (forceToast) showToast("已刷新当前项目状态");
      } catch (error) {
        showToast("项目状态读取失败：" + error.message);
      }
    }

    function renderAll() {
      renderProjects();
      renderOverview();
      renderSkills();
      renderMcpList();
      renderSettings();
      renderHistory();
      renderThreads();
    }

    function renderProjects() {
      var select = document.getElementById("projectSelect");
      var projects = (state.projects && state.projects.projects) || [];
      var currentProfile = state.dashboard && state.dashboard.profile;
      var merged = projects.slice();
      if (currentProfile && !merged.some(function(project) { return project.rootPath === currentProfile.rootPath; })) {
        merged.unshift({
          id: currentProfile.id,
          name: currentProfile.name,
          rootPath: currentProfile.rootPath,
          languages: currentProfile.languages || [],
          frameworks: currentProfile.frameworks || []
        });
      }
      if (merged.length === 0) {
        merged = [{ name: shortPath(state.repoPath), rootPath: state.repoPath }];
      }
      select.innerHTML = merged.map(function(project) {
        var selected = project.rootPath === state.repoPath ? " selected" : "";
        return "<option value='" + attr(project.rootPath) + "'" + selected + ">" + h(project.name || shortPath(project.rootPath)) + "</option>";
      }).join("");
    }

    function renderOverview() {
      var dashboard = state.dashboard || {};
      var profile = dashboard.profile || {};
      var capabilitySummary = (dashboard.capabilityCenter && dashboard.capabilityCenter.summary) || {};
      var memoryDigest = dashboard.memoryDigest || {};
      var dossier = dashboard.requirementDossier || {};
      var stats = [
        [capabilitySummary.enabled || enabledCapabilities().length, "已启用能力"],
        [skillCapabilities().length, "Skills"],
        [mcpCapabilities().length, "MCP 服务"],
        [memoryDigest.totalMemories || 0, "修改记忆"],
        [dossier.totalRequirements || requirements().length || 0, "需求线程"]
      ];
      document.getElementById("overviewStats").innerHTML = stats.map(statCard).join("");

      var events = ((dashboard.agentActivity && dashboard.agentActivity.events) || []).slice(0, 5);
      if (events.length === 0) {
        events = memoryItems().slice(0, 5).map(function(item) {
          return {
            title: item.title,
            summary: item.latestSummary || item.summary || "已保存一次修改讲解。",
            createdAt: item.latestUpdatedAt,
            status: item.statusCounts && item.statusCounts.current ? "success" : "attention"
          };
        });
      }
      document.getElementById("activityList").innerHTML = events.length
        ? events.map(function(event) {
          var color = event.status === "error" ? "var(--danger)" : event.status === "attention" ? "var(--warning)" : "var(--success)";
          return "<div class='list-item' style='padding:14px 16px'>" +
            "<div style='width:8px;height:8px;border-radius:50%;background:" + color + ";flex-shrink:0;margin-top:4px'></div>" +
            "<div class='list-item-content'><div style='font-size:13px;font-weight:500'>" + h(event.title || "SpecWeft 活动") + "</div>" +
            "<div style='font-size:12px;color:var(--muted);margin-top:2px'>" + h(event.summary || "") + " · " + h(formatDate(event.createdAt)) + "</div></div>" +
          "</div>";
        }).join("")
        : emptyState("还没有活动", "当 Codex 或 Claude 调用 SpecWeft 后，这里会出现最近动作。");

      var activeThreads = threadItems().slice(0, 4);
      document.getElementById("activeThreadList").innerHTML = activeThreads.length
        ? activeThreads.map(function(item) {
          return "<div class='list-item' style='padding:14px 16px;cursor:pointer'>" +
            "<div class='list-item-content'><div style='font-size:13px;font-weight:500'>" + h(item.title) + "</div>" +
            "<div style='font-size:12px;color:var(--muted);margin-top:2px'>" + h(item.summary || item.latestSummary || "暂无摘要") + "</div></div>" +
            statusBadge(item.active ? "active" : item.status, item.active ? "进行中" : formatRequirementStatus(item.status)) +
          "</div>";
        }).join("")
        : emptyState("还没有需求线程", "新建线程后，后续修改会按需求归档。");

      if (profile.name) document.title = "SpecWeft — " + profile.name;
    }

    function renderSkills() {
      var skills = skillCapabilities();
      var enabled = skills.filter(function(item) { return item.status === "enabled"; });
      var updates = (state.dashboard && state.dashboard.skillUpdateCheck && state.dashboard.skillUpdateCheck.updateCount) || 0;
      document.getElementById("skillStats").innerHTML = [
        [skills.length, "已安装 Skills"],
        [enabled.length, "已启用"],
        [updates, "可更新"]
      ].map(statCard).join("");

      document.getElementById("installedSkills").innerHTML = skills.length
        ? skills.map(renderSkillCard).join("")
        : emptyState("还没有安装 Skill", "可以先打开市场，或让 SpecWeft 根据当前需求推荐。");

      renderRecommendedSkills();
    }

    function renderSkillCard(skill) {
      var active = skill.status === "enabled";
      return "<div class='card'>" +
        "<div class='card-header'><div><div class='card-title'>" + h(skill.name) + "</div>" +
        "<div class='card-meta'>" + h(skill.source || "local") + " · " + h(skill.risk || "low") + "</div></div>" +
        "<button class='toggle " + (active ? "active" : "") + "' data-action='toggle-capability' data-type='skill' data-id='" + attr(skill.id) + "' data-status='" + attr(skill.status) + "' type='button'></button></div>" +
        "<div class='card-desc'>" + h(skill.description || skill.reason || "这个 Skill 会在 Agent 执行任务前提供项目级规则。") + "</div>" +
        "<div class='card-footer'>" + statusBadge(skill.status, active ? "● 已启用" : "已安装") +
        "<button class='btn btn-secondary' style='font-size:12px;padding:6px 12px' data-action='show-skill-detail' data-skill-id='" + attr(skill.id) + "'>详情</button></div>" +
      "</div>";
    }

    function renderRecommendedSkills() {
      var suggestions = state.skillSuggestions || [];
      var fallback = recommendations().filter(function(item) { return item.type === "skill"; }).slice(0, 6);
      var items = suggestions.length ? suggestions : fallback;
      document.getElementById("recommendedSkills").innerHTML = items.length
        ? items.map(function(item) {
          return "<div class='card'>" +
            "<div class='card-header'><div><div class='card-title'>" + h(item.name) + "</div>" +
            "<div class='card-meta'>" + h(item.status || "recommended") + "</div></div><span class='badge badge-available'>推荐</span></div>" +
            "<div class='card-desc'>" + h(item.reason || item.usageHint || "适合当前项目画像。") + "</div>" +
            "<div class='card-footer'><span style='font-size:12px;color:var(--muted)'>" + h(item.conflictRisk ? "冲突风险：" + item.conflictRisk : item.risk ? "风险：" + item.risk : "本地规则优先") + "</span>" +
            "<button class='btn btn-primary' style='font-size:12px;padding:6px 12px' data-action='toggle-capability' data-type='skill' data-id='" + attr(item.id) + "' data-status='" + attr(item.status || "recommended") + "'>启用</button></div>" +
          "</div>";
        }).join("")
        : emptyState("暂无推荐", "输入需求后点击分析；外部 Skill 请从浏览市场单独获取。");
    }

    function renderMcpList() {
      var query = (document.getElementById("mcpSearchInput").value || "").toLowerCase();
      var mcps = mcpCapabilities().filter(function(item) {
        return !query || (item.name + " " + item.description + " " + item.id).toLowerCase().indexOf(query) >= 0;
      });
      document.getElementById("mcpList").innerHTML = mcps.length
        ? mcps.map(function(mcp) {
          var active = mcp.status === "enabled";
          return "<div class='list-item' data-name='" + attr(mcp.name.toLowerCase()) + "'>" +
            "<div class='list-item-icon'>" + terminalIcon() + "</div>" +
            "<div class='list-item-content'><div class='list-item-title'>" + h(mcp.name) + "</div>" +
            "<div class='list-item-desc'>" + h(mcp.description || mcp.reason || "项目可用 MCP 服务") + "</div></div>" +
            "<div class='list-item-actions'>" + statusBadge(mcp.status, active ? "● 运行中" : "已安装") +
            "<button class='toggle " + (active ? "active" : "") + "' data-action='toggle-capability' data-type='mcp' data-id='" + attr(mcp.id) + "' data-status='" + attr(mcp.status) + "' type='button'></button></div>" +
          "</div>";
        }).join("")
        : emptyState("没有匹配的 MCP", "MCP 是按需能力，不需要为每个项目都安装。");
    }

    function renderSettings() {
      var settings = state.settings || defaultSettings();
      setToggle("autoRecordDiffInput", settings.changeRecording && settings.changeRecording.autoRecordDiff);
      setToggle("autoLinkRequirementInput", settings.changeRecording && settings.changeRecording.autoLinkRequirement);
      setInput("retentionDaysInput", settings.changeRecording && settings.changeRecording.retentionDays);
      setInput("maxRetainedTurnsInput", settings.contextMemory && settings.contextMemory.maxRetainedTurns);
      setInput("compressionStrategyInput", settings.contextMemory && settings.contextMemory.compressionStrategy);
      setInput("ignorePathsInput", ((settings.contextMemory && settings.contextMemory.ignorePaths) || []).join("\\n"));
      setInput("skillRegistryUrlInput", settings.capabilities && settings.capabilities.skillRegistryUrl);
      setToggle("autoCheckSkillUpdatesInput", settings.capabilities && settings.capabilities.autoCheckSkillUpdates);
      setInput("mcpTimeoutInput", Math.round(((settings.capabilities && settings.capabilities.mcpStdioTimeoutMs) || 30000) / 1000));
    }

    function renderHistory() {
      var query = (document.getElementById("historySearchInput").value || "").toLowerCase();
      var items = memoryItems().filter(function(item) {
        var status = dominantCodeStatus(item);
        var matchesFilter = state.historyFilter === "all" || (state.historyFilter === "current" && status === "current") || (state.historyFilter === "stale" && status !== "current");
        var text = (item.title + " " + (item.latestSummary || item.summary || "") + " " + ((item.keyFiles || item.changedFiles || []).join(" "))).toLowerCase();
        return matchesFilter && (!query || text.indexOf(query) >= 0);
      });
      document.getElementById("historyList").innerHTML = items.length
        ? items.map(function(item) {
          var files = item.keyFiles || item.changedFiles || [];
          var status = dominantCodeStatus(item);
          return "<div class='list-item' style='align-items:flex-start;gap:20px;padding:20px'>" +
            "<div style='text-align:right;flex-shrink:0;width:80px'><div style='font-size:11px;color:var(--muted);font-weight:500;letter-spacing:0.02em'>" + h(dayLabel(item.latestUpdatedAt || item.updatedAt || item.createdAt)) + "</div>" +
            "<div style='font-size:11px;color:var(--muted)'>" + h(timeLabel(item.latestUpdatedAt || item.updatedAt || item.createdAt)) + "</div></div>" +
            "<div style='flex:1;min-width:0'><div style='font-size:14px;font-weight:500;margin-bottom:4px'>" + h(item.title) + "</div>" +
            "<div style='font-size:12px;color:var(--muted);margin-bottom:8px'>" + h(item.requirementTitle || "未绑定需求") + " · " + h(formatCodeStatus(status)) + "</div>" +
            "<div style='font-size:13px;color:var(--fg);line-height:1.5;margin-bottom:10px'>" + h(item.latestSummary || item.summary || "这次修改已经记录到 SpecWeft。") + "</div>" +
            "<div style='display:flex;gap:8px;flex-wrap:wrap'>" + files.slice(0, 4).map(function(file) { return "<span class='badge badge-muted'>" + h(file) + "</span>"; }).join("") + "</div></div>" +
            "<button class='btn btn-secondary' style='font-size:12px;padding:6px 12px;flex-shrink:0' data-action='open-memory' data-memory-id='" + attr(item.id) + "'>查看讲解</button>" +
          "</div>";
        }).join("")
        : emptyState("还没有修改记录", "点击右上角生成当前修改讲解，或让 Agent 通过 MCP 自动记录。");
    }

    function renderThreads() {
      var query = (document.getElementById("threadSearchInput").value || "").toLowerCase();
      var items = threadItems().filter(function(item) {
        var text = (item.title + " " + (item.summary || item.latestSummary || "") + " " + ((item.keywords || []).join(" "))).toLowerCase();
        return !query || text.indexOf(query) >= 0;
      });
      document.getElementById("threadList").innerHTML = items.length
        ? items.map(function(item) {
          var sessions = item.sessions || [];
          return "<div class='thread-wrap'>" +
            "<div class='thread-head' data-action='toggle-thread'><div style='flex:1;min-width:0'>" +
            "<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap'><span style='font-size:15px;font-weight:500'>" + h(item.title) + "</span>" + statusBadge(item.active ? "active" : item.status, item.active ? "进行中" : formatRequirementStatus(item.status)) + "</div>" +
            "<div style='font-size:13px;color:var(--fg);line-height:1.5;margin-bottom:12px'>" + h(item.summary || item.latestSummary || "暂无摘要") + "</div>" +
            "<div style='display:flex;align-items:center;gap:16px;flex-wrap:wrap'><span style='font-size:12px;color:var(--muted)'>" + h(String(item.sessionCount || sessions.length || 0)) + " 次 AI 修改</span><span style='font-size:12px;color:var(--muted)'>" + h(formatDate(item.latestUpdatedAt)) + "</span></div>" +
            "</div><div style='display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap'>" +
            "<button class='btn btn-secondary' style='font-size:12px;padding:6px 12px' data-action='restore-thread' data-requirement-id='" + attr(item.requirementId || item.id) + "'>恢复上下文</button>" +
            "<button class='btn btn-secondary' style='font-size:12px;padding:6px 12px' data-action='set-active-thread' data-requirement-id='" + attr(item.requirementId || item.id) + "'>设为当前</button>" +
            "<svg class='tl-arrow' width='16' height='16' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/></svg></div></div>" +
            "<div class='thread-tl'><div class='tl-track'>" + renderThreadSessions(sessions) + "</div></div></div>";
        }).join("")
        : emptyState("还没有需求线程", "可以新建线程，也可以在 Agent 修改后自动归档。");
    }

    function renderThreadSessions(sessions) {
      if (!sessions || sessions.length === 0) {
        return "<div class='tl-item'><div style='font-size:13px;color:var(--muted)'>暂无关联修改</div></div>";
      }
      return sessions.slice(0, 6).map(function(session) {
        return "<div class='tl-item'><div style='font-size:13px;font-weight:500;margin-bottom:3px'>" + h(session.title) + "</div>" +
          "<div style='font-size:12px;color:var(--muted);margin-bottom:6px'>" + h(formatDate(session.updatedAt || session.createdAt)) + "</div>" +
          "<div style='font-size:13px;color:var(--fg);margin-bottom:8px'>" + h(session.summary || "") + "</div>" +
          "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap'>" + (session.changedFiles || []).slice(0, 3).map(function(file) { return "<span class='badge badge-muted'>" + h(file) + "</span>"; }).join("") + "</div></div>";
      }).join("");
    }

    async function analyzeSkills(button) {
      var input = document.getElementById("skillTaskInput");
      var task = (input.value || "").trim();
      if (!task) {
        var profile = state.dashboard && state.dashboard.profile;
        task = "请根据当前项目 " + ((profile && profile.name) || "代码库") + " 推荐适合新手使用 Codex/Claude 的 Skills";
      }
      setBusy(button, true, "分析中");
      try {
        var result = await api("/api/task-skills", {
          method: "POST",
          body: { repoPath: state.repoPath, task: task }
        });
        state.skillSuggestions = result.skillSuggestions || [];
        switchTabByName("skills", "recommended");
        renderRecommendedSkills();
        showToast("已根据需求生成本地 Skill 推荐");
      } catch (error) {
        showToast("推荐失败：" + error.message);
      } finally {
        setBusy(button, false);
      }
    }

    async function toggleCapability(button) {
      var type = button.dataset.type;
      var id = button.dataset.id;
      var status = button.dataset.status;
      var action = status === "enabled" ? "disable" : "apply";
      setBusy(button, true);
      try {
        await api("/api/selection/" + action, {
          method: "POST",
          body: { repoPath: state.repoPath, type: type, id: id }
        });
        await loadDashboard();
        showToast((action === "apply" ? "已启用 " : "已停用 ") + id);
      } catch (error) {
        showToast("操作失败：" + error.message);
      } finally {
        setBusy(button, false);
      }
    }

    async function showSkillDetail(skillId) {
      if (!skillId) return;
      openDetail("Skill 详情", skillId, "<p>正在读取 Skill 内容…</p>");
      try {
        var detail = await api("/api/skills/" + encodeURIComponent(skillId));
        var html = "<p>" + h(detail.description || "本地 Skill") + "</p>";
        if (detail.path) html += "<p><strong>路径：</strong>" + h(detail.path) + "</p>";
        if (detail.content) html += "<pre class='codebox'>" + h(detail.content) + "</pre>";
        openDetail(detail.name || skillId, detail.source || skillId, html);
      } catch (error) {
        openDetail("Skill 详情", skillId, "<p>读取失败：" + h(error.message) + "</p>");
      }
    }

    async function loadSkillMarketplace(keyword) {
      var list = document.getElementById("skillMarketplaceList");
      if (list) list.innerHTML = loadingCard("正在读取 Skills 市场…");
      try {
        var url = "/api/marketplace/skills?repo=" + encodeURIComponent(state.repoPath);
        if (keyword) url += "&keyword=" + encodeURIComponent(keyword);
        state.skillMarket = await api(url);
        renderSkillMarketplace();
      } catch (error) {
        if (list) list.innerHTML = emptyState("市场读取失败", error.message);
      }
    }

    function renderSkillMarketplace() {
      var list = document.getElementById("skillMarketplaceList");
      if (!list) return;
      var items = ((state.skillMarket && state.skillMarket.candidates) || []).slice(0, 12);
      list.innerHTML = items.length
        ? items.map(function(skill) {
          return "<div class='card'><div class='card-title' style='margin-bottom:6px'>" + h(skill.name) + "</div>" +
            "<div class='card-meta'>" + h(skill.author || "community") + " · ★ " + h(String(skill.stars || 0)) + "</div>" +
            "<div class='card-desc'>" + h(skill.description || "") + "</div>" +
            "<div class='card-footer'><span style='font-size:12px;color:var(--muted)'>匹配度 " + h(String(skill.relevance || 0)) + "%</span>" +
            "<div class='inline-row'><button class='btn btn-secondary' style='font-size:12px;padding:6px 12px' data-action='preview-market-skill' data-skill-id='" + attr(skill.id) + "'>详情</button>" +
            "<button class='btn btn-primary' style='font-size:12px;padding:6px 12px' data-action='install-market-skill' data-skill-id='" + attr(skill.id) + "'>安装</button></div></div></div>";
        }).join("")
        : emptyState("没有找到 Skill", "换一个关键词试试，例如 java、review、test。");
    }

    async function previewMarketplaceSkill(skillId) {
      var skill = findMarketSkill(skillId);
      if (!skill) return;
      openDetail(skill.name, "正在读取 SKILL.md", "<p>正在读取市场内容…</p>");
      try {
        var preview = await api("/api/marketplace/skills/preview", {
          method: "POST",
          body: { repoPath: state.repoPath, skill: skill }
        });
        openDetail(skill.name, skill.githubUrl || skill.author, "<p>" + h(skill.description) + "</p><pre class='codebox'>" + h(preview.content || "") + "</pre>");
      } catch (error) {
        openDetail(skill.name, "读取失败", "<p>" + h(error.message) + "</p>");
      }
    }

    async function installMarketplaceSkill(skillId) {
      var skill = findMarketSkill(skillId);
      if (!skill) return;
      try {
        await api("/api/marketplace/skills/apply", {
          method: "POST",
          body: { repoPath: state.repoPath, skill: skill }
        });
        closeModal("marketplaceModal");
        await loadDashboard();
        showToast("已安装并启用 Skill：" + skill.name);
      } catch (error) {
        showToast("安装失败：" + error.message);
      }
    }

    async function loadMcpMarketplace(keyword) {
      var list = document.getElementById("mcpMarketplaceList");
      if (list) list.innerHTML = loadingList("正在读取 MCP 市场…");
      try {
        var url = "/api/marketplace/mcps?repo=" + encodeURIComponent(state.repoPath);
        if (keyword) url += "&keyword=" + encodeURIComponent(keyword);
        state.mcpMarket = await api(url);
        renderMcpMarketplace();
      } catch (error) {
        if (list) list.innerHTML = emptyState("MCP 市场读取失败", error.message);
      }
    }

    function renderMcpMarketplace() {
      var list = document.getElementById("mcpMarketplaceList");
      if (!list) return;
      var items = ((state.mcpMarket && state.mcpMarket.candidates) || []).slice(0, 10);
      list.innerHTML = items.length
        ? items.map(function(mcp) {
          return "<div class='list-item' style='padding:16px'>" +
            "<div class='list-item-icon'>" + terminalIcon() + "</div>" +
            "<div class='list-item-content'><div class='list-item-title'>" + h(mcp.name) + "</div>" +
            "<div class='list-item-desc'>" + h(mcp.description || "") + "</div></div>" +
            "<div class='list-item-actions'><span class='badge badge-muted'>" + h(mcp.runtime || "stdio") + "</span>" +
            "<button class='btn btn-primary' style='font-size:12px;padding:6px 12px' data-action='install-market-mcp' data-mcp-id='" + attr(mcp.id) + "'>安装</button></div></div>";
        }).join("")
        : emptyState("没有找到 MCP", "MCP 是可选能力，可以先不处理。");
    }

    async function installMarketplaceMcp(mcpId) {
      var mcp = findMarketMcp(mcpId);
      if (!mcp) return;
      try {
        await api("/api/marketplace/mcps/apply", {
          method: "POST",
          body: { repoPath: state.repoPath, mcp: mcp }
        });
        closeModal("mcpMarketplaceModal");
        await loadDashboard();
        showToast("已安装并启用 MCP：" + mcp.name);
      } catch (error) {
        showToast("安装失败：" + error.message);
      }
    }

    async function saveSettings(button) {
      setBusy(button, true, "保存中");
      try {
        var patch = {
          changeRecording: {
            autoRecordDiff: getToggle("autoRecordDiffInput"),
            autoLinkRequirement: getToggle("autoLinkRequirementInput"),
            retentionDays: Number(document.getElementById("retentionDaysInput").value || 0)
          },
          contextMemory: {
            maxRetainedTurns: Number(document.getElementById("maxRetainedTurnsInput").value || 20),
            compressionStrategy: document.getElementById("compressionStrategyInput").value,
            ignorePaths: document.getElementById("ignorePathsInput").value.split("\\n").map(function(item) { return item.trim(); }).filter(Boolean)
          },
          capabilities: {
            skillRegistryUrl: document.getElementById("skillRegistryUrlInput").value.trim(),
            autoCheckSkillUpdates: getToggle("autoCheckSkillUpdatesInput"),
            mcpStdioTimeoutMs: Number(document.getElementById("mcpTimeoutInput").value || 30) * 1000
          }
        };
        state.settings = await api("/api/settings", {
          method: "POST",
          body: { repoPath: state.repoPath, settings: patch }
        });
        renderSettings();
        showToast("配置已保存");
      } catch (error) {
        showToast("保存失败：" + error.message);
      } finally {
        setBusy(button, false);
      }
    }

    function resetSettings() {
      state.settings = defaultSettings();
      renderSettings();
      showToast("已恢复为默认值，点击保存后生效");
    }

    async function generateReview(button) {
      setBusy(button, true, "生成中");
      try {
        var data = await api("/api/review", {
          method: "POST",
          body: { repoPath: state.repoPath }
        });
        state.lastReview = data;
        if (data.memory) upsertMemory(data.memory);
        await loadDashboard();
        openReview(data.title || "代码讲解", data.reportPath || "已写入 SpecWeft 记忆", data.html || renderReviewSummary(data));
        showToast("已生成当前修改讲解");
      } catch (error) {
        openReview("代码讲解", "生成失败", "<p>" + h(error.message) + "</p>");
      } finally {
        setBusy(button, false);
      }
    }

    function openMemory(memoryId) {
      var item = memoryItems().find(function(memory) { return memory.id === memoryId; });
      if (!item) return;
      var files = item.keyFiles || item.changedFiles || [];
      var html = "<p>" + h(item.latestSummary || item.summary || "暂无摘要") + "</p>";
      if (item.compressedSummary) html += "<p><strong>压缩摘要：</strong>" + h(item.compressedSummary) + "</p>";
      if (files.length) html += "<p><strong>涉及文件：</strong></p><p>" + files.map(function(file) { return "<span class='badge badge-muted'>" + h(file) + "</span>"; }).join(" ") + "</p>";
      if (item.restoreHint) html += "<p><strong>恢复提示：</strong>" + h(item.restoreHint) + "</p>";
      openReview(item.title, item.requirementTitle || "修改记忆", html);
    }

    async function restoreThread(requirementId) {
      if (!requirementId) return;
      openReview("恢复上下文", "正在生成线程交接摘要", "<p>正在读取需求记忆…</p>");
      try {
        var result = await api("/api/restore-requirement", {
          method: "POST",
          body: { repoPath: state.repoPath, requirementId: requirementId }
        });
        var html = "<p>" + h(result.summary || "已恢复需求上下文。") + "</p>";
        if (result.handoff && result.handoff.prompt) html += "<h3>给 Agent 的上下文入口</h3><pre class='codebox'>" + h(result.handoff.prompt) + "</pre>";
        openReview((result.requirement && result.requirement.title) || "恢复上下文", "可以复制给新线程，也可以由 MCP 自动读取", html);
      } catch (error) {
        openReview("恢复上下文", "失败", "<p>" + h(error.message) + "</p>");
      }
    }

    async function setActiveThread(requirementId) {
      if (!requirementId) return;
      try {
        await api("/api/requirements/active", {
          method: "POST",
          body: { repoPath: state.repoPath, id: requirementId }
        });
        await loadDashboard();
        showToast("已切换当前需求线程");
      } catch (error) {
        showToast("切换失败：" + error.message);
      }
    }

    async function createThread(button) {
      var title = document.getElementById("newThreadTitle").value.trim();
      var summary = document.getElementById("newThreadSummary").value.trim();
      var keywords = document.getElementById("newThreadKeywords").value.split(",").map(function(item) { return item.trim(); }).filter(Boolean);
      if (!title) {
        showToast("请先填写需求标题");
        return;
      }
      setBusy(button, true, "创建中");
      try {
        await api("/api/requirements", {
          method: "POST",
          body: { repoPath: state.repoPath, title: title, summary: summary, keywords: keywords }
        });
        closeModal("newThreadModal");
        document.getElementById("newThreadTitle").value = "";
        document.getElementById("newThreadSummary").value = "";
        document.getElementById("newThreadKeywords").value = "";
        await loadDashboard();
        switchView("threads");
        showToast("需求线程已创建");
      } catch (error) {
        showToast("创建失败：" + error.message);
      } finally {
        setBusy(button, false);
      }
    }

    function switchView(view) {
      if (!viewTitles[view]) view = "skills";
      state.activeView = view;
      location.hash = view;
      document.getElementById("pageTitle").textContent = viewTitles[view];
      document.querySelectorAll(".nav-item").forEach(function(item) {
        item.classList.toggle("active", item.dataset.viewTarget === view);
      });
      document.querySelectorAll(".view").forEach(function(panel) {
        panel.classList.toggle("active", panel.id === "view-" + view);
      });
      document.querySelectorAll(".topbar-actions").forEach(function(panel) {
        panel.classList.remove("active");
      });
      var actions = document.getElementById("topbarActions" + capitalize(view));
      if (actions) actions.classList.add("active");
    }

    function switchTab(button) {
      switchTabByName(button.dataset.tabGroup, button.dataset.tab);
    }

    function switchTabByName(group, tab) {
      document.querySelectorAll("[data-tab-group='" + group + "']").forEach(function(item) {
        item.classList.toggle("active", item.dataset.tab === tab);
      });
      document.querySelectorAll("[data-tab-panel^='" + group + ":']").forEach(function(panel) {
        panel.style.display = panel.dataset.tabPanel === group + ":" + tab ? "" : "none";
      });
    }

    function toggleThread(target) {
      var wrap = target.closest(".thread-wrap");
      if (!wrap) return;
      var timeline = wrap.querySelector(".thread-tl");
      var arrow = wrap.querySelector(".tl-arrow");
      var open = timeline.classList.contains("open");
      timeline.classList.toggle("open", !open);
      if (arrow) arrow.style.transform = open ? "" : "rotate(180deg)";
    }

    function openModal(id) {
      var modal = document.getElementById(id);
      if (modal) modal.classList.add("active");
    }

    function closeModal(id) {
      var modal = document.getElementById(id);
      if (modal) modal.classList.remove("active");
    }

    function openDetail(title, meta, html) {
      document.getElementById("detailTitle").textContent = title || "详情";
      document.getElementById("detailMeta").textContent = meta || "";
      document.getElementById("detailBody").innerHTML = html || "";
      openModal("detailModal");
    }

    function openReview(title, meta, html) {
      document.getElementById("reviewTitle").textContent = title || "代码讲解";
      document.getElementById("reviewMeta").textContent = meta || "";
      document.getElementById("reviewBody").innerHTML = html || "";
      openModal("reviewModal");
    }

    function capabilities() {
      return (state.dashboard && state.dashboard.capabilityCenter && state.dashboard.capabilityCenter.capabilities) || [];
    }

    function skillCapabilities() {
      return capabilities().filter(function(item) { return item.kind === "skill" && item.status !== "ignored"; });
    }

    function mcpCapabilities() {
      return capabilities().filter(function(item) { return item.kind === "mcp" && item.status !== "ignored"; });
    }

    function enabledCapabilities() {
      return capabilities().filter(function(item) { return item.status === "enabled"; });
    }

    function recommendations() {
      return (state.dashboard && state.dashboard.recommendations) || [];
    }

    function requirements() {
      return (state.dashboard && state.dashboard.requirements) || [];
    }

    function memoryItems() {
      return (state.dashboard && state.dashboard.memoryDigest && state.dashboard.memoryDigest.items) || [];
    }

    function threadItems() {
      var dossierItems = (state.dashboard && state.dashboard.requirementDossier && state.dashboard.requirementDossier.items) || [];
      if (dossierItems.length) return dossierItems;
      return requirements().map(function(req) {
        return {
          id: req.id,
          requirementId: req.id,
          title: req.title,
          summary: req.summary,
          status: req.status,
          active: state.dashboard && state.dashboard.requirementDossier && state.dashboard.requirementDossier.activeRequirementId === req.id,
          sessionCount: req.reviewCount,
          sessions: [],
          keywords: req.keywords || [],
          latestUpdatedAt: req.updatedAt
        };
      });
    }

    function findMarketSkill(skillId) {
      return ((state.skillMarket && state.skillMarket.candidates) || [])
        .find(function(item) { return item.id === skillId; });
    }

    function findMarketMcp(mcpId) {
      return ((state.mcpMarket && state.mcpMarket.candidates) || []).find(function(item) { return item.id === mcpId; });
    }

    function upsertMemory(memory) {
      if (!state.dashboard) state.dashboard = {};
      if (!state.dashboard.memoryDigest) state.dashboard.memoryDigest = { items: [] };
      var items = state.dashboard.memoryDigest.items || [];
      state.dashboard.memoryDigest.items = [memory].concat(items.filter(function(item) { return item.id !== memory.id; }));
    }

    function defaultSettings() {
      return {
        changeRecording: { autoRecordDiff: true, autoLinkRequirement: true, retentionDays: 90 },
        contextMemory: { maxRetainedTurns: 20, compressionStrategy: "summary", ignorePaths: ["node_modules/", "dist/"] },
        capabilities: { skillRegistryUrl: "https://skillsmp.com/api/skills", autoCheckSkillUpdates: true, mcpStdioTimeoutMs: 30000 }
      };
    }

    function setInput(id, value) {
      var input = document.getElementById(id);
      if (input) input.value = value === undefined || value === null ? "" : String(value);
    }

    function setToggle(id, value) {
      var button = document.getElementById(id);
      if (button) button.classList.toggle("active", Boolean(value));
    }

    function getToggle(id) {
      var button = document.getElementById(id);
      return Boolean(button && button.classList.contains("active"));
    }

    function setBusy(button, busy, label) {
      if (!button) return;
      if (busy) {
        button.dataset.originalText = button.textContent;
        button.textContent = label || "处理中";
        button.disabled = true;
      } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
      }
    }

    function statCard(item) {
      return "<div class='stat-card'><div class='stat-value'>" + h(item[0]) + "</div><div class='stat-label'>" + h(item[1]) + "</div></div>";
    }

    function statusBadge(status, label) {
      var cls = status === "enabled" || status === "active" || status === "done" || status === "current"
        ? "badge-installed"
        : status === "recommended" || status === "available"
          ? "badge-available"
          : status === "paused" || status === "attention"
            ? "badge-warning"
            : "badge-muted";
      return "<span class='badge " + cls + "'>" + h(label || status || "unknown") + "</span>";
    }

    function emptyState(title, desc) {
      return "<div class='empty-state'><h3>" + h(title) + "</h3><p>" + h(desc || "") + "</p></div>";
    }

    function loadingCard(text) {
      return "<div class='card'><div class='card-desc'>" + h(text) + "</div></div>";
    }

    function loadingList(text) {
      return "<div class='list-item'><div class='list-item-content'><div class='list-item-title'>" + h(text) + "</div></div></div>";
    }

    function renderReviewSummary(data) {
      var review = data.review || {};
      var memory = data.memory || {};
      var html = "<p>" + h(memory.summary || review.summary || "已生成代码讲解。") + "</p>";
      var changes = review.mainChanges || review.implementationSummary || [];
      if (changes.length) {
        html += "<h3>主要修改</h3><ul>" + changes.slice(0, 8).map(function(item) { return "<li>" + h(item) + "</li>"; }).join("") + "</ul>";
      }
      return html;
    }

    function dominantCodeStatus(item) {
      if (item.codeStatus) return item.codeStatus;
      var counts = item.statusCounts || {};
      if (counts.current) return "current";
      if (counts.stale) return "stale";
      if (counts.reverted) return "reverted";
      return "unknown";
    }

    function formatCodeStatus(status) {
      var map = { current: "当前代码", stale: "历史版本", reverted: "已回滚", unknown: "未知状态" };
      return map[status] || status || "未知状态";
    }

    function formatRequirementStatus(status) {
      var map = { active: "进行中", paused: "暂停", done: "已完成", unscoped: "未归档" };
      return map[status] || status || "未归档";
    }

    function formatDate(value) {
      if (!value) return "刚刚";
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    function dayLabel(value) {
      if (!value) return "今天";
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return "今天";
      var today = new Date();
      var dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      var targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (targetStart === dayStart) return "今天";
      if (targetStart === dayStart - 86400000) return "昨天";
      return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    }

    function timeLabel(value) {
      if (!value) return "";
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }

    function shortPath(value) {
      if (!value) return "当前项目";
      var parts = String(value).split("/");
      return parts[parts.length - 1] || value;
    }

    function capitalize(value) {
      return value.slice(0, 1).toUpperCase() + value.slice(1);
    }

    function terminalIcon() {
      return "<svg fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/></svg>";
    }

    function showToast(message) {
      var box = document.getElementById("toast");
      var item = document.createElement("div");
      item.className = "toast-item";
      item.textContent = message;
      box.appendChild(item);
      setTimeout(function() {
        item.remove();
      }, 3200);
    }

    function h(value) {
      return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function attr(value) {
      return h(value);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
