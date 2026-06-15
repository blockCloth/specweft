export function renderApp(repoPath: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SpecWeft</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6faff;
        --panel: rgba(255, 255, 255, 0.68);
        --panel-soft: rgba(232, 242, 255, 0.68);
        --text: #0f1f3d;
        --muted: #64748b;
        --line: rgba(121, 169, 237, 0.26);
        --line-strong: rgba(90, 145, 225, 0.38);
        --accent: #1d75ff;
        --accent-strong: #0759d8;
        --accent-soft: rgba(222, 237, 255, 0.7);
        --cyan: #00a8d8;
        --green: #0f9f6e;
        --amber: #b7791f;
        --red: #d64545;
        --blue: #2563eb;
        --shadow: 0 24px 70px rgba(37, 99, 235, 0.1);
        --shadow-soft: 0 12px 34px rgba(37, 99, 235, 0.07);
        --glass: rgba(255, 255, 255, 0.62);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-width: 320px;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button,
      input,
      select {
        font: inherit;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 264px minmax(0, 1fr);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 24px 18px;
        border-right: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.58);
        backdrop-filter: blur(24px) saturate(145%);
        box-shadow: 18px 0 60px rgba(37, 99, 235, 0.06);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 22px;
      }

      .mark {
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(113, 169, 255, 0.34);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(239, 246, 255, 0.9), rgba(255, 255, 255, 0.56));
        color: var(--accent);
        font-weight: 800;
        box-shadow: 0 14px 34px rgba(29, 117, 255, 0.14);
      }

      .brand-title {
        font-size: 18px;
        font-weight: 760;
      }

      .brand-subtitle {
        margin-top: 2px;
        color: var(--muted);
        font-size: 12px;
      }

      .field-label {
        display: grid;
        gap: 6px;
        margin-bottom: 18px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .nav {
        display: grid;
        gap: 8px;
      }

      .nav button {
        width: 100%;
        min-height: 42px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        color: var(--muted);
        text-align: left;
        cursor: pointer;
      }

      .nav button.active,
      .nav button:hover {
        border-color: var(--line-strong);
        background: var(--accent-soft);
        color: var(--text);
      }

      .main {
        min-width: 0;
        padding: 26px;
      }

      .topbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        margin-bottom: 22px;
      }

      .repo-row {
        display: grid;
        grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr) auto auto auto;
        gap: 10px;
      }

      .input,
      .select {
        width: 100%;
        min-height: 42px;
        padding: 8px 11px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.62);
        color: var(--text);
        outline: none;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75) inset, var(--shadow-soft);
        backdrop-filter: blur(16px);
      }

      .input:focus,
      .select:focus {
        border-color: rgba(82, 145, 255, 0.62);
        box-shadow: 0 0 0 4px rgba(29, 117, 255, 0.11), var(--shadow-soft);
      }

      .btn {
        min-height: 42px;
        padding: 0 13px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.58);
        color: var(--text);
        cursor: pointer;
        white-space: nowrap;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(14px);
      }

      .btn:hover {
        border-color: var(--line-strong);
        background: rgba(255, 255, 255, 0.76);
      }

      .btn.primary {
        border-color: rgba(29, 117, 255, 0.38);
        background: linear-gradient(135deg, rgba(29, 117, 255, 0.94), rgba(53, 162, 255, 0.88));
        color: #fff;
        box-shadow: 0 14px 30px rgba(29, 117, 255, 0.2);
      }

      .btn.primary:hover {
        background: linear-gradient(135deg, var(--accent-strong), #168eff);
      }

      .btn.warn {
        color: var(--amber);
      }

      .btn.danger {
        color: var(--red);
      }

      .status-line {
        color: var(--muted);
        font-size: 13px;
        text-align: right;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.52);
        backdrop-filter: blur(14px);
      }

      .view {
        display: none;
      }

      .view.active {
        display: block;
      }

      .section-title {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 12px;
      }

      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
      }

      h2 {
        margin: 0;
        font-size: 17px;
      }

      .grid {
        display: grid;
        gap: 14px;
      }

      .grid.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .panel {
        background: var(--glass);
        border: 1px solid var(--line);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 16px;
        backdrop-filter: blur(20px) saturate(142%);
      }

      .metric {
        min-height: 92px;
        display: grid;
        align-content: space-between;
      }

      .metric-label {
        color: var(--muted);
        font-size: 13px;
      }

      .metric-value {
        margin-top: 10px;
        font-size: 23px;
        font-weight: 760;
        overflow-wrap: anywhere;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .toolbar-select {
        width: 180px;
      }

      .language-select {
        width: 100%;
      }

      .table-wrap {
        overflow-x: auto;
        border-radius: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 760px;
      }

      tbody tr {
        transition: background 160ms ease;
      }

      tbody tr:hover {
        background: rgba(232, 242, 255, 0.42);
      }

      th,
      td {
        padding: 11px 10px;
        border-bottom: 1px solid rgba(121, 169, 237, 0.16);
        text-align: left;
        vertical-align: top;
        font-size: 14px;
      }

      th {
        color: var(--muted);
        font-size: 12px;
        font-weight: 680;
        text-transform: uppercase;
        background: rgba(245, 250, 255, 0.62);
      }

      .tag {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(232, 242, 255, 0.62);
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
      }

      .tag.enabled {
        background: rgba(231, 248, 241, 0.76);
        color: var(--green);
      }

      .tag.recommended {
        background: rgba(232, 241, 255, 0.78);
        color: var(--blue);
      }

      .tag.disabled,
      .tag.ignored {
        background: rgba(255, 242, 220, 0.78);
        color: var(--amber);
      }

      .actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .codebox {
        width: 100%;
        min-height: 40px;
        padding: 12px;
        border: 1px solid rgba(121, 169, 237, 0.2);
        border-radius: 12px;
        background: rgba(9, 23, 47, 0.92);
        color: #e8f3ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        line-height: 1.55;
        overflow: auto;
        white-space: pre-wrap;
      }

      .prompt-box {
        width: 100%;
        min-height: 96px;
        padding: 13px;
        border: 1px solid rgba(121, 169, 237, 0.18);
        border-radius: 12px;
        background: rgba(246, 251, 255, 0.72);
        color: var(--text);
        font-size: 13px;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .result-view {
        display: grid;
        gap: 12px;
      }

      .result-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.58);
        padding: 14px;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px) saturate(140%);
      }

      .marketplace-header {
        display: grid;
        gap: 5px;
        margin: 18px 0 12px;
      }

      .marketplace-header p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .marketplace-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .marketplace-card {
        display: grid;
        gap: 10px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.58);
        padding: 14px;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px) saturate(140%);
      }

      .marketplace-card h3 {
        margin: 0;
        font-size: 15px;
      }

      .marketplace-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .marketplace-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .memory-stack {
        display: grid;
        gap: 10px;
      }

      .memory-item {
        display: grid;
        gap: 8px;
        padding: 12px;
        border: 1px solid rgba(121, 169, 237, 0.16);
        border-radius: 12px;
        background: rgba(246, 251, 255, 0.66);
      }

      .memory-item h3 {
        margin: 0;
        font-size: 14px;
      }

      .conflict-none {
        color: var(--green);
      }

      .conflict-medium,
      .conflict-high {
        color: var(--amber);
      }

      .warning-list {
        margin: 0;
        padding-left: 18px;
        color: var(--amber);
        line-height: 1.6;
      }

      .result-card h2,
      .result-card h3 {
        margin: 0 0 10px;
        font-size: 16px;
      }

      .result-card p {
        margin: 0 0 8px;
        color: var(--muted);
        line-height: 1.55;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .detail-item {
        min-width: 0;
        padding: 10px;
        border-radius: 10px;
        background: rgba(241, 247, 255, 0.62);
        border: 1px solid rgba(121, 169, 237, 0.16);
      }

      .detail-label {
        margin-bottom: 5px;
        color: var(--muted);
        font-size: 12px;
      }

      .detail-value {
        overflow-wrap: anywhere;
        font-weight: 650;
      }

      .plain-list {
        margin: 0;
        padding-left: 18px;
        line-height: 1.7;
      }

      .empty-state {
        min-height: 180px;
        display: grid;
        place-items: center;
        border: 1px dashed rgba(121, 169, 237, 0.34);
        border-radius: 12px;
        color: var(--muted);
        text-align: center;
      }

      .review-report {
        display: grid;
        gap: 12px;
      }

      .specweft-review-report {
        display: grid;
        gap: 12px;
      }

      .specweft-review-report section {
        padding: 12px;
        border: 1px solid rgba(121, 169, 237, 0.16);
        border-radius: 12px;
        background: rgba(246, 251, 255, 0.66);
      }

      .specweft-review-report h1,
      .specweft-review-report h2 {
        margin: 0 0 8px;
      }

      .specweft-review-report h1 {
        font-size: 20px;
      }

      .specweft-review-report h2 {
        font-size: 15px;
      }

      .specweft-review-report p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }

      .specweft-review-report ul {
        margin: 0;
        padding-left: 20px;
        line-height: 1.7;
      }

      .specweft-review-hero {
        background: rgba(232, 242, 255, 0.62);
      }

      .inline-code {
        display: inline-block;
        max-width: 100%;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(234, 243, 255, 0.76);
        overflow-wrap: anywhere;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
      }

      .form-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
      }

      .muted {
        color: var(--muted);
      }

      .toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        max-width: min(420px, calc(100vw - 36px));
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.76);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
        color: var(--text);
        display: none;
      }

      .toast.show {
        display: block;
      }

      @media (max-width: 880px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: static;
          height: auto;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .nav {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .topbar,
        .repo-row,
        .grid.three,
        .marketplace-grid,
        .detail-grid,
        .form-row {
          grid-template-columns: 1fr;
        }

        .toolbar-select {
          width: 100%;
        }

        .status-line {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">S</div>
          <div>
            <div class="brand-title">SpecWeft</div>
            <div class="brand-subtitle" data-i18n="brandSubtitle">本地 Agent 控制台</div>
          </div>
        </div>
        <label class="field-label">
          <span data-i18n="language">语言</span>
          <select id="languageSelect" class="select language-select">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <nav class="nav">
          <button class="active" data-view-button="overview" data-i18n="navOverview">总览</button>
          <button data-view-button="tools" data-i18n="navTools">能力中心</button>
          <button data-view-button="runtime" data-i18n="navRuntime">运行配置</button>
          <button data-view-button="review" data-i18n="navReview">代码讲解</button>
          <button data-view-button="memory" data-i18n="navMemory">记忆</button>
          <button data-view-button="connect" data-i18n="navConnect">接入配置</button>
        </nav>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="repo-row">
            <select id="projectSelect" class="select" aria-label="Project"></select>
            <input id="repoInput" class="input" aria-label="Repository path" />
            <button id="registerProjectButton" class="btn" data-i18n="registerProject">登记项目</button>
            <button id="refreshButton" class="btn primary" data-i18n="refresh">刷新</button>
            <button id="poolButton" class="btn" data-i18n="initPool">初始化工具池</button>
          </div>
          <div id="statusLine" class="status-line" data-status-key="idle">空闲</div>
        </div>

        <section id="overview" class="view active">
          <div class="section-title">
            <h1 data-i18n="overview">总览</h1>
          </div>
          <div class="grid three">
            <div class="panel metric">
              <div class="metric-label" data-i18n="project">项目</div>
              <div id="projectName" class="metric-value">-</div>
            </div>
            <div class="panel metric">
              <div class="metric-label" data-i18n="languages">语言</div>
              <div id="languages" class="metric-value">-</div>
            </div>
            <div class="panel metric">
              <div class="metric-label" data-i18n="enabledTools">已启用工具</div>
              <div id="enabledCount" class="metric-value">-</div>
            </div>
          </div>
        </section>

        <section id="tools" class="view">
          <div class="section-title">
            <h1 data-i18n="tools">能力中心</h1>
            <div class="toolbar">
              <select id="toolFilterSelect" class="select toolbar-select" aria-label="Tool type filter">
                <option value="all" data-i18n="filterAll">全部</option>
                <option value="mcp" data-i18n="filterMcp">MCP</option>
                <option value="skill" data-i18n="filterSkill">Skill</option>
                <option value="cli" data-i18n="filterCli">CLI</option>
              </select>
              <button id="recommendButton" class="btn primary" data-i18n="refreshRecommendations">刷新能力</button>
            </div>
          </div>
          <div class="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th data-i18n="name">名称</th>
                  <th data-i18n="type">类型</th>
                  <th data-i18n="status">状态</th>
                  <th data-i18n="risk">风险</th>
                  <th data-i18n="reason">原因 / 权限</th>
                  <th data-i18n="actions">操作</th>
                </tr>
              </thead>
              <tbody id="recommendationRows"></tbody>
            </table>
          </div>
          <div class="marketplace-header">
            <h2 data-i18n="marketplaceMcps">市场 MCP 候选</h2>
            <p data-i18n="marketplaceMcpNotice">根据项目画像和需求关键词搜索 MCP 候选，只写入 SpecWeft 工具池，不会直接修改 Codex 或 Claude 全局配置。</p>
          </div>
          <div class="panel grid marketplace-search">
            <div class="form-row">
              <input id="marketplaceMcpKeywordInput" class="input" data-i18n-placeholder="marketplaceMcpKeywordPlaceholder" placeholder="搜索 MCP 关键词，例如 github、playwright、postgres" />
              <button id="marketplaceMcpSearchButton" class="btn primary" data-i18n="searchMarketplaceMcp">搜索市场 MCP</button>
            </div>
          </div>
          <div id="marketplaceMcps" class="marketplace-grid"></div>

          <div class="marketplace-header">
            <h2 data-i18n="marketplaceSkills">市场 Skill 候选</h2>
            <p data-i18n="marketplaceNotice">根据当前项目关键词搜索外部 Skill，只做候选展示，不会自动应用或覆盖本地规范。</p>
          </div>
          <div class="panel grid marketplace-search">
            <div class="form-row">
              <input id="marketplaceKeywordInput" class="input" data-i18n-placeholder="marketplaceKeywordPlaceholder" placeholder="搜索 Skill 关键词，例如 java" />
              <button id="marketplaceSearchButton" class="btn primary" data-i18n="searchMarketplace">搜索市场 Skill</button>
            </div>
          </div>
          <div id="marketplaceSkills" class="marketplace-grid"></div>
        </section>

        <section id="runtime" class="view">
          <div class="section-title">
            <h1 data-i18n="runtime">运行配置</h1>
            <button id="assemblyButton" class="btn primary" data-i18n="buildAssembly">生成配置</button>
          </div>
          <div id="assemblyOutput" class="result-view"></div>
        </section>

        <section id="review" class="view">
          <div class="section-title">
            <h1 data-i18n="review">代码讲解</h1>
          </div>
          <div class="panel grid">
            <div class="form-row">
              <input id="reviewTitle" class="input" data-i18n-placeholder="reviewTitlePlaceholder" placeholder="代码讲解标题" />
              <button id="reviewButton" class="btn primary" data-i18n="createReview">生成讲解</button>
            </div>
            <div id="reviewOutput" class="result-view"></div>
          </div>
        </section>

        <section id="memory" class="view">
          <div class="section-title">
            <h1 data-i18n="memory">记忆</h1>
          </div>
          <div class="panel grid">
            <div class="form-row">
              <input id="keywordInput" class="input" data-i18n-placeholder="keywordPlaceholder" placeholder="关键词" />
              <div class="actions">
                <button id="recallButton" class="btn" data-i18n="recall">召回</button>
                <button id="handoffButton" class="btn primary" data-i18n="createHandoff">生成交接上下文</button>
              </div>
            </div>
            <div id="recallOutput" class="result-view"></div>
            <div id="handoffOutput" class="result-view"></div>
          </div>
        </section>

        <section id="connect" class="view">
          <div class="section-title">
            <h1 data-i18n="connect">接入配置</h1>
            <button id="connectButton" class="btn primary" data-i18n="generateConfig">生成配置</button>
          </div>
          <div id="connectOutput" class="result-view"></div>
        </section>
      </main>
    </div>
    <div id="toast" class="toast"></div>
    <script>
      const messages = {
        "zh-CN": {
          brandSubtitle: "本地 Agent 控制台",
          navOverview: "总览",
          navTools: "能力中心",
          navRuntime: "运行配置",
          navReview: "代码讲解",
          navMemory: "记忆",
          navConnect: "接入配置",
          language: "语言",
          refresh: "刷新",
          initPool: "初始化工具池",
          overview: "总览",
          project: "项目",
          projectSelectorPlaceholder: "选择已登记项目",
          registerProject: "登记项目",
          projectRegistered: "项目已登记",
          languages: "语言",
          enabledTools: "已启用工具",
          tools: "能力中心",
          filterAll: "全部",
          filterMcp: "MCP",
          filterSkill: "Skill",
          filterCli: "CLI",
          noToolsForFilter: "当前筛选下没有能力。",
          marketplaceMcps: "市场 MCP 候选",
          marketplaceMcpNotice: "根据项目画像和需求关键词搜索 MCP 候选，只写入 SpecWeft 工具池，不会直接修改 Codex 或 Claude 全局配置。",
          marketplaceMcpKeywordPlaceholder: "搜索 MCP 关键词，例如 github、playwright、postgres",
          searchMarketplaceMcp: "搜索市场 MCP",
          searchingMarketplaceMcp: "正在搜索市场 MCP",
          marketplaceMcpHiddenByFilter: "当前只筛选 Skill，市场 MCP 候选已隐藏。",
          noMarketplaceMcps: "暂时没有找到合适的市场 MCP。",
          applyMarketplaceMcp: "加入并启用",
          applyingMarketplaceMcp: "正在加入 MCP",
          marketplaceMcpApplied: "市场 MCP 已加入并启用",
          envVars: "环境变量",
          permissions: "权限",
          installable: "可安装",
          installable_yes: "是",
          installable_no: "需手动配置",
          marketplaceSkills: "市场 Skill 候选",
          marketplaceNotice: "根据当前项目关键词搜索外部 Skill，只做候选展示，不会自动应用或覆盖本地规范。",
          marketplaceKeywordPlaceholder: "搜索 Skill 关键词，例如 java",
          searchMarketplace: "搜索市场 Skill",
          searchingMarketplace: "正在搜索市场 Skill",
          marketplaceHiddenByFilter: "当前只筛选 MCP，市场 Skill 候选已隐藏。",
          noMarketplaceSkills: "暂时没有找到合适的市场 Skill。",
          searchedKeywords: "搜索关键词",
          matchedKeyword: "匹配关键词",
          conflictLevel: "冲突风险",
          conflict_none: "无明显冲突",
          conflict_low: "低",
          conflict_medium: "中",
          conflict_high: "高",
          marketplaceWarnings: "搜索提示",
          openGithub: "查看 GitHub",
          applyMarketplaceSkill: "加入并启用",
          applyingMarketplaceSkill: "正在加入 Skill",
          marketplaceSkillApplied: "市场 Skill 已加入并启用",
          stars: "Stars",
          forks: "Forks",
          refreshRecommendations: "刷新能力",
          name: "名称",
          type: "类型",
          status: "状态",
          risk: "风险",
          reason: "原因",
          actions: "操作",
          runtime: "运行配置",
          buildAssembly: "生成配置",
          review: "代码讲解",
          reviewTitlePlaceholder: "代码讲解标题",
          createReview: "生成讲解",
          memory: "记忆",
          keywordPlaceholder: "关键词",
          recall: "召回",
          createHandoff: "生成交接上下文",
          handoff: "线程交接",
          handoffPrompt: "新线程提示词",
          recoveredSessions: "恢复到的记忆",
          generatedAt: "生成时间",
          handoffReady: "交接上下文已生成",
          connect: "接入配置",
          generateConfig: "生成配置",
          idle: "空闲",
          loading: "加载中",
          ready: "就绪",
          updating: "更新中",
          error: "出错",
          initializingPool: "正在初始化工具池",
          selectionUpdated: "选择已更新",
          poolInitialized: "工具池已初始化",
          reviewSaved: "代码讲解已保存",
          requestFailed: "请求失败",
          defaultReviewTitle: "SpecWeft UI 代码讲解",
          actionEnable: "启用",
          actionDisable: "禁用",
          actionIgnore: "忽略",
          status_enabled: "已启用",
          status_recommended: "推荐",
          status_disabled: "已禁用",
          status_ignored: "已忽略",
          risk_low: "低",
          risk_medium: "中",
          risk_high: "高",
          type_mcp: "MCP",
          type_skill: "Skill",
          type_cli: "CLI",
          type_hook: "Hook",
          status_available: "可用",
          noMcpServers: "当前项目还没有启用 MCP 服务。",
          noSkills: "当前项目还没有启用 Skill。",
          mcpServers: "MCP 服务",
          skills: "Skills",
          command: "命令",
          arguments: "参数",
          path: "路径",
          clientCommand: "客户端启动命令",
          exposedTools: "暴露工具",
          serverName: "服务名",
          transport: "传输方式",
          reportPath: "报告路径",
          memoryId: "记忆 ID",
          expiresAt: "过期时间",
          summary: "摘要",
          changedFiles: "修改文件",
          keywords: "关键词",
          noChangedFiles: "没有记录修改文件",
          noKeywords: "没有关键词",
          noSessions: "没有找到相关记忆。",
          noHandoffYet: "还没有生成线程交接上下文。",
          noReviewYet: "还没有生成代码讲解。",
          noRuntimeYet: "暂无运行配置。",
          noConnectYet: "暂无接入配置。"
        },
        "en-US": {
          brandSubtitle: "Local agent console",
          navOverview: "Overview",
          navTools: "Capability Center",
          navRuntime: "Runtime",
          navReview: "Review",
          navMemory: "Memory",
          navConnect: "Connect",
          language: "Language",
          refresh: "Refresh",
          initPool: "Init Pool",
          overview: "Overview",
          project: "Project",
          projectSelectorPlaceholder: "Select registered project",
          registerProject: "Register Project",
          projectRegistered: "Project registered",
          languages: "Languages",
          enabledTools: "Enabled Tools",
          tools: "Capability Center",
          filterAll: "All",
          filterMcp: "MCP",
          filterSkill: "Skill",
          filterCli: "CLI",
          noToolsForFilter: "No tools match this filter.",
          marketplaceMcps: "Marketplace MCP Candidates",
          marketplaceMcpNotice: "Search MCP candidates from the project profile and requirement keywords. SpecWeft writes them to its tool pool and does not modify global Codex or Claude config directly.",
          marketplaceMcpKeywordPlaceholder: "Search MCP keyword, e.g. github, playwright, postgres",
          searchMarketplaceMcp: "Search Marketplace MCPs",
          searchingMarketplaceMcp: "Searching marketplace MCPs",
          marketplaceMcpHiddenByFilter: "Marketplace MCP candidates are hidden while Skill is selected.",
          noMarketplaceMcps: "No matching marketplace MCPs were found.",
          applyMarketplaceMcp: "Add and Enable",
          applyingMarketplaceMcp: "Adding MCP",
          marketplaceMcpApplied: "Marketplace MCP added and enabled",
          envVars: "Env vars",
          permissions: "Permissions",
          installable: "Installable",
          installable_yes: "Yes",
          installable_no: "Manual config",
          marketplaceSkills: "Marketplace Skill Candidates",
          marketplaceNotice: "External Skills are shown as candidates only. SpecWeft will not apply them automatically or override local rules.",
          marketplaceKeywordPlaceholder: "Search Skill keyword, e.g. java",
          searchMarketplace: "Search Marketplace Skills",
          searchingMarketplace: "Searching marketplace Skills",
          marketplaceHiddenByFilter: "Marketplace Skill candidates are hidden while MCP is selected.",
          noMarketplaceSkills: "No matching marketplace Skills were found.",
          searchedKeywords: "Search keywords",
          matchedKeyword: "Matched keyword",
          conflictLevel: "Conflict risk",
          conflict_none: "No obvious conflict",
          conflict_low: "Low",
          conflict_medium: "Medium",
          conflict_high: "High",
          marketplaceWarnings: "Search notes",
          openGithub: "Open GitHub",
          applyMarketplaceSkill: "Add and Enable",
          applyingMarketplaceSkill: "Adding Skill",
          marketplaceSkillApplied: "Marketplace Skill added and enabled",
          stars: "Stars",
          forks: "Forks",
          refreshRecommendations: "Refresh Capabilities",
          name: "Name",
          type: "Type",
          status: "Status",
          risk: "Risk",
          reason: "Reason",
          actions: "Actions",
          runtime: "Runtime",
          buildAssembly: "Build Assembly",
          review: "Review",
          reviewTitlePlaceholder: "Review title",
          createReview: "Create Review",
          memory: "Memory",
          keywordPlaceholder: "Keyword",
          recall: "Recall",
          createHandoff: "Create Handoff",
          handoff: "Thread Handoff",
          handoffPrompt: "New Thread Prompt",
          recoveredSessions: "Recovered Memories",
          generatedAt: "Generated at",
          handoffReady: "Handoff created",
          connect: "Connect",
          generateConfig: "Generate Config",
          idle: "Idle",
          loading: "Loading",
          ready: "Ready",
          updating: "Updating",
          error: "Error",
          initializingPool: "Initializing pool",
          selectionUpdated: "Selection updated",
          poolInitialized: "Pool initialized",
          reviewSaved: "Review saved",
          requestFailed: "Request failed",
          defaultReviewTitle: "SpecWeft UI review",
          actionEnable: "Enable",
          actionDisable: "Disable",
          actionIgnore: "Ignore",
          status_enabled: "Enabled",
          status_recommended: "Recommended",
          status_disabled: "Disabled",
          status_ignored: "Ignored",
          risk_low: "Low",
          risk_medium: "Medium",
          risk_high: "High",
          type_mcp: "MCP",
          type_skill: "Skill",
          type_cli: "CLI",
          type_hook: "Hook",
          status_available: "Available",
          noMcpServers: "No MCP servers are enabled for this project.",
          noSkills: "No Skills are enabled for this project.",
          mcpServers: "MCP Servers",
          skills: "Skills",
          command: "Command",
          arguments: "Arguments",
          path: "Path",
          clientCommand: "Client command",
          exposedTools: "Exposed tools",
          serverName: "Server name",
          transport: "Transport",
          reportPath: "Report path",
          memoryId: "Memory ID",
          expiresAt: "Expires at",
          summary: "Summary",
          changedFiles: "Changed files",
          keywords: "Keywords",
          noChangedFiles: "No changed files were recorded.",
          noKeywords: "No keywords.",
          noSessions: "No matching memories found.",
          noHandoffYet: "No thread handoff has been created yet.",
          noReviewYet: "No review has been created yet.",
          noRuntimeYet: "No runtime assembly yet.",
          noConnectYet: "No connection config yet."
        }
      };

      const state = {
        repoPath: "",
        projects: [],
        dashboard: undefined,
        locale: localStorage.getItem("specweft.locale") || "zh-CN",
        toolFilter: localStorage.getItem("specweft.toolFilter") || "all"
      };

      const repoInput = document.getElementById("repoInput");
      const projectSelect = document.getElementById("projectSelect");
      const statusLine = document.getElementById("statusLine");
      const toast = document.getElementById("toast");
      const languageSelect = document.getElementById("languageSelect");
      const toolFilterSelect = document.getElementById("toolFilterSelect");

      function t(key) {
        return messages[state.locale][key] || messages["zh-CN"][key] || key;
      }

      function applyLocale() {
        document.documentElement.lang = state.locale;
        document.querySelectorAll("[data-i18n]").forEach((node) => {
          node.textContent = t(node.dataset.i18n);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
          node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
        });
        languageSelect.value = state.locale;
        toolFilterSelect.value = state.toolFilter;
        renderProjectOptions();
        const statusKey = statusLine.dataset.statusKey || "idle";
        statusLine.textContent = t(statusKey);
        if (state.dashboard) {
          renderDashboard(state.dashboard);
        } else {
          renderEmptyOutputs();
        }
      }

      function setStatus(key) {
        statusLine.dataset.statusKey = key;
        statusLine.textContent = t(key);
      }

      function showToast(text) {
        toast.textContent = text;
        toast.classList.add("show");
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
      }

      async function api(path, options = {}) {
        const headers = { "content-type": "application/json", ...(options.headers || {}) };
        const response = await fetch(path, { ...options, headers });
        const value = await response.json();
        if (!response.ok) {
          throw new Error(value.error || t("requestFailed"));
        }
        return value;
      }

      async function loadDashboard() {
        setStatus("loading");
        const repo = encodeURIComponent(repoInput.value.trim());
        const data = await api("/api/dashboard?repo=" + repo);
        state.repoPath = data.profile.rootPath;
        state.dashboard = data;
        repoInput.value = state.repoPath;
        await loadProjects(state.repoPath);
        renderDashboard(data);
        setStatus("ready");
      }

      async function loadProjects(activePath = repoInput.value.trim()) {
        const registry = await api("/api/projects");
        state.projects = registry.projects || [];
        renderProjectOptions(activePath || registry.activeProjectPath || "");
      }

      function renderProjectOptions(activePath = repoInput.value.trim()) {
        const projects = state.projects || [];
        projectSelect.innerHTML = [
          "<option value=''>" + escapeHtml(t("projectSelectorPlaceholder")) + "</option>",
          ...projects.map((project) => {
            const label = project.name + " - " + project.rootPath;
            return "<option value='" + escapeHtml(project.rootPath) + "'>" + escapeHtml(label) + "</option>";
          })
        ].join("");
        projectSelect.value = projects.some((project) => project.rootPath === activePath) ? activePath : "";
      }

      function renderDashboard(data) {
        document.getElementById("projectName").textContent = data.profile.name;
        document.getElementById("languages").textContent = data.profile.languages.join(", ") || "-";
        const enabled = data.capabilityCenter?.summary?.enabled
          ?? data.recommendations.filter((item) => item.status === "enabled").length;
        document.getElementById("enabledCount").textContent = String(enabled);
        renderCapabilities(data.capabilityCenter?.capabilities || data.recommendations);
        renderMarketplaceMcps(data.marketplaceMcps);
        renderMarketplaceSkills(data.marketplaceSkills);
        renderAssembly(data.assembly);
        renderConnect(data.mcpInspect);
      }

      function renderEmptyOutputs() {
        document.getElementById("assemblyOutput").innerHTML = emptyState(t("noRuntimeYet"));
        document.getElementById("connectOutput").innerHTML = emptyState(t("noConnectYet"));
        document.getElementById("reviewOutput").innerHTML = emptyState(t("noReviewYet"));
        document.getElementById("recallOutput").innerHTML = emptyState(t("noSessions"));
        document.getElementById("handoffOutput").innerHTML = emptyState(t("noHandoffYet"));
        document.getElementById("marketplaceMcps").innerHTML = emptyState(t("noMarketplaceMcps"));
        document.getElementById("marketplaceSkills").innerHTML = emptyState(t("noMarketplaceSkills"));
      }

      function renderAssembly(assembly) {
        const servers = Object.entries(assembly.mcpServers || {});
        const skills = assembly.skills || [];
        document.getElementById("assemblyOutput").innerHTML = [
          sectionCard(t("mcpServers"), servers.length
            ? servers.map(([id, server]) => detailCard(id, [
                [t("command"), server.command],
                [t("arguments"), (server.args || []).join(" ")]
              ])).join("")
            : emptyState(t("noMcpServers"))),
          sectionCard(t("skills"), skills.length
            ? skills.map((skill) => detailCard(skill.id, [[t("path"), skill.path]])).join("")
            : emptyState(t("noSkills")))
        ].join("");
      }

      function renderConnect(config) {
        const spec = config.clientConfig?.mcpServers?.specweft;
        const command = spec ? [spec.command, ...(spec.args || [])].join(" ") : "-";
        document.getElementById("connectOutput").innerHTML = [
          sectionCard(t("clientCommand"), "<div class='codebox'>" + escapeHtml(command) + "</div>"),
          sectionCard(t("summary"), detailGrid([
            [t("serverName"), config.server],
            [t("transport"), config.transport]
          ])),
          sectionCard(t("exposedTools"), listHtml(config.tools || []))
        ].join("");
      }

      function renderReview(data) {
        document.getElementById("reviewOutput").innerHTML = [
          sectionCard(data.title, detailGrid([
            [t("reportPath"), data.reportPath],
            [t("memoryId"), data.memory?.id || "-"],
            [t("expiresAt"), data.memory?.expiresAt || "-"]
          ])),
          sectionCard(t("summary"), "<p>" + escapeHtml(data.review?.summary || data.memory?.summary || "-") + "</p>"),
          sectionCard(t("keywords"), listHtml(data.memory?.keywords?.length ? data.memory.keywords : [t("noKeywords")])),
          sectionCard(t("changedFiles"), listHtml(data.memory?.changedFiles?.length ? data.memory.changedFiles : [t("noChangedFiles")])),
          sectionCard(t("review"), "<div class='review-report'>" + (data.html || "") + "</div>")
        ].join("");
      }

      function renderRecall(data) {
        const sessions = data.sessions || [];
        document.getElementById("recallOutput").innerHTML = sessions.length
          ? sessions.map((session) => sectionCard(session.title, [
              detailGrid([
                [t("memoryId"), session.id],
                [t("expiresAt"), session.expiresAt]
              ]),
              "<p>" + escapeHtml(session.summary) + "</p>",
              "<h3>" + escapeHtml(t("keywords")) + "</h3>",
              listHtml(session.keywords?.length ? session.keywords : [t("noKeywords")]),
              "<h3>" + escapeHtml(t("changedFiles")) + "</h3>",
              listHtml(session.changedFiles?.length ? session.changedFiles : [t("noChangedFiles")])
            ].join(""))).join("")
          : emptyState(t("noSessions"));
      }

      function renderHandoff(data) {
        const handoff = data.handoff || data;
        const sessions = handoff.sessions || [];
        document.getElementById("handoffOutput").innerHTML = [
          sectionCard(t("handoff"), [
            detailGrid([
              [t("project"), handoff.projectName || "-"],
              [t("generatedAt"), handoff.generatedAt || "-"]
            ]),
            "<p>" + escapeHtml(handoff.summary || "-") + "</p>"
          ].join("")),
          sectionCard(t("handoffPrompt"), "<div class='prompt-box'>" + escapeHtml(handoff.prompt || "-") + "</div>"),
          sectionCard(t("keywords"), listHtml(handoff.keywords?.length ? handoff.keywords : [t("noKeywords")])),
          sectionCard(t("changedFiles"), listHtml(handoff.changedFiles?.length ? handoff.changedFiles : [t("noChangedFiles")])),
          sectionCard(t("recoveredSessions"), sessions.length
            ? "<div class='memory-stack'>" + sessions.map((session) => [
                "<div class='memory-item'>",
                "<h3>" + escapeHtml(session.title) + "</h3>",
                "<p>" + escapeHtml(session.summary || "-") + "</p>",
                detailGrid([
                  [t("memoryId"), session.id],
                  [t("expiresAt"), session.expiresAt]
                ]),
                "</div>"
              ].join("")).join("") + "</div>"
            : emptyState(t("noSessions")))
        ].join("");
      }

      function renderCapabilities(items) {
        const rows = document.getElementById("recommendationRows");
        rows.innerHTML = "";
        const visibleItems = state.toolFilter === "all"
          ? items
          : items.filter((item) => capabilityKind(item) === state.toolFilter);

        if (visibleItems.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = "<td colspan='6'>" + emptyState(t("noToolsForFilter")) + "</td>";
          rows.appendChild(tr);
          return;
        }

        for (const item of visibleItems) {
          const tr = document.createElement("tr");
          const kind = capabilityKind(item);
          tr.innerHTML = [
            "<td><strong>" + escapeHtml(item.name) + "</strong><br><span class='muted'>" + escapeHtml(item.id) + "</span></td>",
            "<td>" + escapeHtml(t("type_" + kind)) + "</td>",
            "<td><span class='tag " + escapeHtml(item.status) + "'>" + escapeHtml(t("status_" + item.status)) + "</span></td>",
            "<td><span class='tag'>" + escapeHtml(t("risk_" + item.risk)) + "</span></td>",
            "<td>" + capabilityDetails(item) + "</td>",
            "<td><div class='actions'>" + actionButtons(item) + "</div></td>"
          ].join("");
          rows.appendChild(tr);
        }
      }

      function capabilityKind(item) {
        return item.kind || item.type;
      }

      function capabilityDetails(item) {
        const parts = [];
        if (item.reason) {
          parts.push("<p>" + escapeHtml(item.reason) + "</p>");
        }
        if (item.permissions?.length) {
          parts.push("<p><strong>" + escapeHtml(t("permissions")) + ":</strong> " + escapeHtml(item.permissions.join(", ")) + "</p>");
        }
        if (item.installCommand) {
          parts.push("<p><strong>" + escapeHtml(t("command")) + ":</strong> " + inlineCode(item.installCommand) + "</p>");
        }
        if (item.runCommand && capabilityKind(item) === "cli") {
          parts.push("<p><strong>" + escapeHtml(t("clientCommand")) + ":</strong> " + inlineCode(item.runCommand) + "</p>");
        }
        return parts.join("") || escapeHtml(item.description || "-");
      }

      function renderMarketplaceSkills(result) {
        const container = document.getElementById("marketplaceSkills");

        if (state.toolFilter === "mcp" || state.toolFilter === "cli") {
          container.innerHTML = emptyState(t("marketplaceHiddenByFilter"));
          return;
        }

        if (!result) {
          container.innerHTML = emptyState(t("noMarketplaceSkills"));
          return;
        }

        const candidates = result.candidates || [];
        const keywordCard = sectionCard(
          t("searchedKeywords"),
          listHtml(result.keywords?.length ? result.keywords : ["-"]),
        );
        const warningCard = result.warnings?.length
          ? sectionCard(t("marketplaceWarnings"), "<ul class='warning-list'>" + result.warnings.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>")
          : "";

        if (candidates.length === 0) {
          container.innerHTML = keywordCard + warningCard + emptyState(t("noMarketplaceSkills"));
          return;
        }

        container.innerHTML = keywordCard
          + warningCard
          + candidates.map((skill) => [
            "<article class='marketplace-card'>",
            "<div>",
            "<h3>" + escapeHtml(skill.name) + "</h3>",
            "<p>" + escapeHtml(skill.description) + "</p>",
            "</div>",
            "<div class='marketplace-meta'>",
            "<span class='tag'>" + escapeHtml(skill.author) + "</span>",
            "<span class='tag'>" + escapeHtml(t("matchedKeyword")) + ": " + escapeHtml(skill.keyword) + "</span>",
            "<span class='tag'>" + escapeHtml(t("stars")) + ": " + escapeHtml(skill.stars) + "</span>",
            "<span class='tag'>" + escapeHtml(t("forks")) + ": " + escapeHtml(skill.forks) + "</span>",
            "<span class='tag conflict-" + escapeHtml(skill.conflictLevel) + "'>" + escapeHtml(t("conflictLevel")) + ": " + escapeHtml(t("conflict_" + skill.conflictLevel)) + "</span>",
            "</div>",
            skill.conflictReasons?.length ? listHtml(skill.conflictReasons) : "",
            "<div class='actions'>",
            "<button class='btn primary' data-marketplace-apply='" + escapeHtml(skill.id) + "'>" + escapeHtml(t("applyMarketplaceSkill")) + "</button>",
            "<a class='btn' href='" + escapeHtml(skill.githubUrl) + "' target='_blank' rel='noreferrer'>" + escapeHtml(t("openGithub")) + "</a>",
            "</div>",
            "</article>"
          ].join("")).join("");
      }

      function renderMarketplaceMcps(result) {
        const container = document.getElementById("marketplaceMcps");

        if (state.toolFilter === "skill" || state.toolFilter === "cli") {
          container.innerHTML = emptyState(t("marketplaceMcpHiddenByFilter"));
          return;
        }

        if (!result) {
          container.innerHTML = emptyState(t("noMarketplaceMcps"));
          return;
        }

        const candidates = result.candidates || [];
        const keywordCard = sectionCard(
          t("searchedKeywords"),
          listHtml(result.keywords?.length ? result.keywords : ["-"]),
        );
        const warningCard = result.warnings?.length
          ? sectionCard(t("marketplaceWarnings"), "<ul class='warning-list'>" + result.warnings.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>")
          : "";

        if (candidates.length === 0) {
          container.innerHTML = keywordCard + warningCard + emptyState(t("noMarketplaceMcps"));
          return;
        }

        container.innerHTML = keywordCard
          + warningCard
          + candidates.map((mcp) => [
            "<article class='marketplace-card'>",
            "<div>",
            "<h3>" + escapeHtml(mcp.name) + "</h3>",
            "<p>" + escapeHtml(mcp.description) + "</p>",
            "</div>",
            "<div class='marketplace-meta'>",
            "<span class='tag'>" + escapeHtml(mcp.author) + "</span>",
            "<span class='tag'>" + escapeHtml(t("matchedKeyword")) + ": " + escapeHtml(mcp.keyword) + "</span>",
            "<span class='tag'>" + escapeHtml(t("transport")) + ": " + escapeHtml(mcp.runtime) + "</span>",
            "<span class='tag'>" + escapeHtml(t("stars")) + ": " + escapeHtml(mcp.stars) + "</span>",
            "<span class='tag'>" + escapeHtml(t("risk")) + ": " + escapeHtml(t("risk_" + mcp.risk)) + "</span>",
            "<span class='tag'>" + escapeHtml(t("installable")) + ": " + escapeHtml(t(mcp.installable ? "installable_yes" : "installable_no")) + "</span>",
            "</div>",
            detailGrid([
              [t("command"), mcp.packageName || mcp.url || "-"],
              [t("envVars"), mcp.envVars?.length ? mcp.envVars.join(", ") : "-"],
              [t("permissions"), mcp.permissions?.length ? mcp.permissions.join(", ") : "-"]
            ]),
            mcp.riskReasons?.length ? listHtml(mcp.riskReasons) : "",
            "<div class='actions'>",
            "<button class='btn primary' data-marketplace-mcp-apply='" + escapeHtml(mcp.id) + "'>" + escapeHtml(t("applyMarketplaceMcp")) + "</button>",
            mcp.githubUrl ? "<a class='btn' href='" + escapeHtml(mcp.githubUrl) + "' target='_blank' rel='noreferrer'>" + escapeHtml(t("openGithub")) + "</a>" : "",
            "</div>",
            "</article>"
          ].join("")).join("");
      }

      function actionButtons(item) {
        const type = capabilityKind(item);
        if (type !== "mcp" && type !== "skill") {
          return "<span class='tag'>" + escapeHtml(item.authRequired ? "Auth" : "Local") + "</span>";
        }
        const id = escapeHtml(item.id);
        return [
          "<button class='btn primary' data-action='apply' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionEnable")) + "</button>",
          "<button class='btn warn' data-action='disable' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionDisable")) + "</button>",
          "<button class='btn danger' data-action='ignore' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionIgnore")) + "</button>"
        ].join("");
      }

      function sectionCard(title, body) {
        return "<article class='result-card'><h2>" + escapeHtml(title) + "</h2>" + body + "</article>";
      }

      function detailCard(title, rows) {
        return "<div class='result-card'><h3>" + escapeHtml(title) + "</h3>" + detailGrid(rows) + "</div>";
      }

      function detailGrid(rows) {
        return "<div class='detail-grid'>" + rows.map(([label, value]) => [
          "<div class='detail-item'>",
          "<div class='detail-label'>" + escapeHtml(label) + "</div>",
          "<div class='detail-value'>" + inlineCode(value || "-") + "</div>",
          "</div>"
        ].join("")).join("") + "</div>";
      }

      function listHtml(items) {
        return "<ul class='plain-list'>" + items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>";
      }

      function emptyState(text) {
        return "<div class='empty-state'>" + escapeHtml(text) + "</div>";
      }

      function inlineCode(value) {
        return "<span class='inline-code'>" + escapeHtml(value) + "</span>";
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      document.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) return;

        const view = button.dataset.viewButton;
        if (view) {
          document.querySelectorAll("[data-view-button]").forEach((node) => node.classList.remove("active"));
          document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
          button.classList.add("active");
          document.getElementById(view).classList.add("active");
          return;
        }

        const action = button.dataset.action;
        if (action) {
          try {
            setStatus("updating");
            await api("/api/selection/" + action, {
              method: "POST",
              body: JSON.stringify({ repoPath: repoInput.value, type: button.dataset.type, id: button.dataset.id })
            });
            await loadDashboard();
            showToast(t("selectionUpdated"));
          } catch (error) {
            showToast(error.message);
            setStatus("error");
          }
        }

        const marketplaceSkillId = button.dataset.marketplaceApply;
        if (marketplaceSkillId && state.dashboard?.marketplaceSkills?.candidates) {
          const skill = state.dashboard.marketplaceSkills.candidates.find((item) => item.id === marketplaceSkillId);
          if (!skill) {
            return;
          }

          try {
            setStatus("applyingMarketplaceSkill");
            await api("/api/marketplace/skills/apply", {
              method: "POST",
              body: JSON.stringify({ repoPath: repoInput.value, skill })
            });
            await loadDashboard();
            showToast(t("marketplaceSkillApplied"));
          } catch (error) {
            showToast(error.message);
            setStatus("error");
          }
        }

        const marketplaceMcpId = button.dataset.marketplaceMcpApply;
        if (marketplaceMcpId && state.dashboard?.marketplaceMcps?.candidates) {
          const mcp = state.dashboard.marketplaceMcps.candidates.find((item) => item.id === marketplaceMcpId);
          if (!mcp) {
            return;
          }

          try {
            setStatus("applyingMarketplaceMcp");
            await api("/api/marketplace/mcps/apply", {
              method: "POST",
              body: JSON.stringify({ repoPath: repoInput.value, mcp })
            });
            await loadDashboard();
            showToast(t("marketplaceMcpApplied"));
          } catch (error) {
            showToast(error.message);
            setStatus("error");
          }
        }
      });

      document.getElementById("refreshButton").addEventListener("click", () => loadDashboard().catch((error) => showToast(error.message)));
      document.getElementById("recommendButton").addEventListener("click", () => loadDashboard().catch((error) => showToast(error.message)));
      projectSelect.addEventListener("change", async () => {
        if (!projectSelect.value) {
          return;
        }

        repoInput.value = projectSelect.value;
        await api("/api/projects/active", {
          method: "POST",
          body: JSON.stringify({ repoPath: repoInput.value })
        });
        await loadDashboard();
      });
      languageSelect.addEventListener("change", () => {
        state.locale = languageSelect.value;
        localStorage.setItem("specweft.locale", state.locale);
        applyLocale();
      });
      toolFilterSelect.addEventListener("change", () => {
        state.toolFilter = toolFilterSelect.value;
        localStorage.setItem("specweft.toolFilter", state.toolFilter);
        applyLocale();
      });
      document.getElementById("poolButton").addEventListener("click", async () => {
        try {
          setStatus("initializingPool");
          await api("/api/pool/init", { method: "POST", body: JSON.stringify({}) });
          await loadDashboard();
          showToast(t("poolInitialized"));
        } catch (error) {
          showToast(error.message);
        }
      });
      document.getElementById("registerProjectButton").addEventListener("click", async () => {
        try {
          setStatus("updating");
          await api("/api/projects/register", {
            method: "POST",
            body: JSON.stringify({ repoPath: repoInput.value })
          });
          await loadProjects(repoInput.value);
          await loadDashboard();
          showToast(t("projectRegistered"));
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
      });
      document.getElementById("assemblyButton").addEventListener("click", async () => {
        const data = await api("/api/assembly?repo=" + encodeURIComponent(repoInput.value));
        renderAssembly(data);
      });
      document.getElementById("connectButton").addEventListener("click", async () => {
        const data = await api("/api/mcp-inspect?repo=" + encodeURIComponent(repoInput.value));
        renderConnect(data);
      });
      document.getElementById("marketplaceSearchButton").addEventListener("click", async () => {
        const keyword = document.getElementById("marketplaceKeywordInput").value.trim();
        setStatus("searchingMarketplace");
        const data = await api("/api/marketplace/skills?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        if (state.dashboard) {
          state.dashboard.marketplaceSkills = data;
        }
        renderMarketplaceSkills(data);
        setStatus("ready");
      });
      document.getElementById("marketplaceMcpSearchButton").addEventListener("click", async () => {
        const keyword = document.getElementById("marketplaceMcpKeywordInput").value.trim();
        setStatus("searchingMarketplaceMcp");
        const data = await api("/api/marketplace/mcps?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        if (state.dashboard) {
          state.dashboard.marketplaceMcps = data;
        }
        renderMarketplaceMcps(data);
        setStatus("ready");
      });
      document.getElementById("reviewButton").addEventListener("click", async () => {
        const title = document.getElementById("reviewTitle").value.trim() || t("defaultReviewTitle");
        const data = await api("/api/review", {
          method: "POST",
          body: JSON.stringify({ repoPath: repoInput.value, title })
        });
        renderReview(data);
        showToast(t("reviewSaved"));
      });
      document.getElementById("recallButton").addEventListener("click", async () => {
        const keyword = document.getElementById("keywordInput").value.trim();
        const data = await api("/api/recall?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        renderRecall(data);
      });
      document.getElementById("handoffButton").addEventListener("click", async () => {
        const keyword = document.getElementById("keywordInput").value.trim();
        const data = await api("/api/handoff?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        renderHandoff(data);
        showToast(t("handoffReady"));
      });

      repoInput.value = new URLSearchParams(window.location.search).get("repo") || ${JSON.stringify(repoPath)};
      applyLocale();
      renderEmptyOutputs();
      loadProjects(repoInput.value).catch((error) => showToast(error.message));
      loadDashboard().catch((error) => {
        showToast(error.message);
        setStatus("error");
      });
    </script>
  </body>
</html>`;
}
