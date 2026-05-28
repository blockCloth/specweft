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
        grid-template-columns: minmax(0, 1fr) auto auto;
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

      .markdown-body {
        display: grid;
        gap: 10px;
      }

      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3 {
        margin: 8px 0 0;
      }

      .markdown-body h1 {
        font-size: 22px;
      }

      .markdown-body h2 {
        font-size: 17px;
      }

      .markdown-body ul {
        margin: 0;
        padding-left: 20px;
        line-height: 1.7;
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
          <button data-view-button="tools" data-i18n="navTools">工具</button>
          <button data-view-button="runtime" data-i18n="navRuntime">运行配置</button>
          <button data-view-button="review" data-i18n="navReview">代码讲解</button>
          <button data-view-button="memory" data-i18n="navMemory">记忆</button>
          <button data-view-button="connect" data-i18n="navConnect">接入配置</button>
        </nav>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="repo-row">
            <input id="repoInput" class="input" aria-label="Repository path" />
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
            <h1 data-i18n="tools">工具</h1>
            <div class="toolbar">
              <select id="toolFilterSelect" class="select toolbar-select" aria-label="Tool type filter">
                <option value="all" data-i18n="filterAll">全部</option>
                <option value="mcp" data-i18n="filterMcp">MCP</option>
                <option value="skill" data-i18n="filterSkill">Skill</option>
              </select>
              <button id="recommendButton" class="btn primary" data-i18n="refreshRecommendations">刷新推荐</button>
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
                  <th data-i18n="reason">原因</th>
                  <th data-i18n="actions">操作</th>
                </tr>
              </thead>
              <tbody id="recommendationRows"></tbody>
            </table>
          </div>
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
              <button id="recallButton" class="btn primary" data-i18n="recall">召回</button>
            </div>
            <div id="recallOutput" class="result-view"></div>
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
          navTools: "工具",
          navRuntime: "运行配置",
          navReview: "代码讲解",
          navMemory: "记忆",
          navConnect: "接入配置",
          language: "语言",
          refresh: "刷新",
          initPool: "初始化工具池",
          overview: "总览",
          project: "项目",
          languages: "语言",
          enabledTools: "已启用工具",
          tools: "工具",
          filterAll: "全部",
          filterMcp: "MCP",
          filterSkill: "Skill",
          noToolsForFilter: "当前筛选下没有工具。",
          refreshRecommendations: "刷新推荐",
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
          noReviewYet: "还没有生成代码讲解。",
          noRuntimeYet: "暂无运行配置。",
          noConnectYet: "暂无接入配置。"
        },
        "en-US": {
          brandSubtitle: "Local agent console",
          navOverview: "Overview",
          navTools: "Tools",
          navRuntime: "Runtime",
          navReview: "Review",
          navMemory: "Memory",
          navConnect: "Connect",
          language: "Language",
          refresh: "Refresh",
          initPool: "Init Pool",
          overview: "Overview",
          project: "Project",
          languages: "Languages",
          enabledTools: "Enabled Tools",
          tools: "Tools",
          filterAll: "All",
          filterMcp: "MCP",
          filterSkill: "Skill",
          noToolsForFilter: "No tools match this filter.",
          refreshRecommendations: "Refresh Recommendations",
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
          noReviewYet: "No review has been created yet.",
          noRuntimeYet: "No runtime assembly yet.",
          noConnectYet: "No connection config yet."
        }
      };

      const state = {
        repoPath: "",
        dashboard: undefined,
        locale: localStorage.getItem("specweft.locale") || "zh-CN",
        toolFilter: localStorage.getItem("specweft.toolFilter") || "all"
      };

      const repoInput = document.getElementById("repoInput");
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
        renderDashboard(data);
        setStatus("ready");
      }

      function renderDashboard(data) {
        document.getElementById("projectName").textContent = data.profile.name;
        document.getElementById("languages").textContent = data.profile.languages.join(", ") || "-";
        const enabled = data.recommendations.filter((item) => item.status === "enabled").length;
        document.getElementById("enabledCount").textContent = String(enabled);
        renderRecommendations(data.recommendations);
        renderAssembly(data.assembly);
        renderConnect(data.mcpInspect);
      }

      function renderEmptyOutputs() {
        document.getElementById("assemblyOutput").innerHTML = emptyState(t("noRuntimeYet"));
        document.getElementById("connectOutput").innerHTML = emptyState(t("noConnectYet"));
        document.getElementById("reviewOutput").innerHTML = emptyState(t("noReviewYet"));
        document.getElementById("recallOutput").innerHTML = emptyState(t("noSessions"));
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
          sectionCard(t("summary"), "<p>" + escapeHtml(data.memory?.summary || "-") + "</p>"),
          sectionCard(t("keywords"), listHtml(data.memory?.keywords?.length ? data.memory.keywords : [t("noKeywords")])),
          sectionCard(t("changedFiles"), listHtml(data.memory?.changedFiles?.length ? data.memory.changedFiles : [t("noChangedFiles")])),
          sectionCard(t("review"), markdownToHtml(data.markdown || ""))
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

      function renderRecommendations(items) {
        const rows = document.getElementById("recommendationRows");
        rows.innerHTML = "";
        const visibleItems = state.toolFilter === "all"
          ? items
          : items.filter((item) => item.type === state.toolFilter);

        if (visibleItems.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = "<td colspan='6'>" + emptyState(t("noToolsForFilter")) + "</td>";
          rows.appendChild(tr);
          return;
        }

        for (const item of visibleItems) {
          const tr = document.createElement("tr");
          tr.innerHTML = [
            "<td><strong>" + escapeHtml(item.name) + "</strong><br><span class='muted'>" + escapeHtml(item.id) + "</span></td>",
            "<td>" + escapeHtml(t("type_" + item.type)) + "</td>",
            "<td><span class='tag " + escapeHtml(item.status) + "'>" + escapeHtml(t("status_" + item.status)) + "</span></td>",
            "<td><span class='tag'>" + escapeHtml(t("risk_" + item.risk)) + "</span></td>",
            "<td>" + escapeHtml(item.reason) + "</td>",
            "<td><div class='actions'>" + actionButtons(item) + "</div></td>"
          ].join("");
          rows.appendChild(tr);
        }
      }

      function actionButtons(item) {
        const type = item.type;
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

      function markdownToHtml(markdown) {
        const lines = markdown.split("\\n");
        const html = [];
        let listItems = [];

        function flushList() {
          if (listItems.length === 0) {
            return;
          }
          html.push("<ul>" + listItems.map((item) => "<li>" + formatInlineMarkdown(item) + "</li>").join("") + "</ul>");
          listItems = [];
        }

        for (const line of lines) {
          if (!line.trim()) {
            flushList();
            continue;
          }

          if (line.startsWith("# ")) {
            flushList();
            html.push("<h1>" + escapeHtml(line.slice(2)) + "</h1>");
            continue;
          }

          if (line.startsWith("## ")) {
            flushList();
            html.push("<h2>" + escapeHtml(line.slice(3)) + "</h2>");
            continue;
          }

          if (line.startsWith("### ")) {
            flushList();
            html.push("<h3>" + escapeHtml(line.slice(4)) + "</h3>");
            continue;
          }

          if (line.startsWith("- ")) {
            listItems.push(line.slice(2));
            continue;
          }

          flushList();
          html.push("<p>" + formatInlineMarkdown(line) + "</p>");
        }

        flushList();
        return "<div class='markdown-body'>" + html.join("") + "</div>";
      }

      function formatInlineMarkdown(value) {
        return escapeHtml(value).replace(/\\\`([^\\\`]+)\\\`/g, "<span class='inline-code'>$1</span>");
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
      });

      document.getElementById("refreshButton").addEventListener("click", () => loadDashboard().catch((error) => showToast(error.message)));
      document.getElementById("recommendButton").addEventListener("click", () => loadDashboard().catch((error) => showToast(error.message)));
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
      document.getElementById("assemblyButton").addEventListener("click", async () => {
        const data = await api("/api/assembly?repo=" + encodeURIComponent(repoInput.value));
        renderAssembly(data);
      });
      document.getElementById("connectButton").addEventListener("click", async () => {
        const data = await api("/api/mcp-inspect?repo=" + encodeURIComponent(repoInput.value));
        renderConnect(data);
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

      repoInput.value = ${JSON.stringify(repoPath)};
      applyLocale();
      renderEmptyOutputs();
      loadDashboard().catch((error) => {
        showToast(error.message);
        setStatus("error");
      });
    </script>
  </body>
</html>`;
}
