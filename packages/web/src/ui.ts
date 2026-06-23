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
        --bg: #f7f9fc;
        --panel: rgba(255, 255, 255, 0.82);
        --panel-soft: rgba(245, 248, 252, 0.82);
        --text: #172033;
        --muted: #687385;
        --line: rgba(98, 118, 148, 0.18);
        --line-strong: rgba(59, 102, 172, 0.28);
        --accent: #2563eb;
        --accent-strong: #1d4ed8;
        --accent-soft: rgba(229, 238, 255, 0.78);
        --cyan: #0891b2;
        --green: #0f8a5f;
        --amber: #a56712;
        --red: #c63d3d;
        --blue: #2563eb;
        --shadow: 0 22px 54px rgba(41, 62, 96, 0.08);
        --shadow-soft: 0 10px 26px rgba(41, 62, 96, 0.06);
        --glass: rgba(255, 255, 255, 0.76);
        --radius: 8px;
        --radius-sm: 7px;
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

      select {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 252px minmax(0, 1fr);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 22px 16px;
        border-right: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(22px) saturate(135%);
        box-shadow: 18px 0 54px rgba(41, 62, 96, 0.05);
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
        border: 1px solid rgba(78, 107, 158, 0.18);
        border-radius: var(--radius);
        background: rgba(245, 249, 255, 0.9);
        color: var(--accent);
        font-weight: 800;
        box-shadow: 0 12px 28px rgba(41, 62, 96, 0.08);
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
        gap: 6px;
      }

      .nav button {
        width: 100%;
        min-height: 42px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--muted);
        text-align: left;
        cursor: pointer;
        font-weight: 680;
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
      }

      .nav button.active,
      .nav button:hover {
        border-color: var(--line-strong);
        background: var(--accent-soft);
        color: var(--text);
      }

      .nav button.active {
        box-shadow: inset 3px 0 0 rgba(37, 99, 235, 0.72);
      }

      .main {
        min-width: 0;
        padding: 24px;
      }

      .topbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
        margin-bottom: 22px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.68);
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(20px) saturate(135%);
      }

      .topbar-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
      }

      .repo-row {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(260px, 1.45fr) auto auto auto;
        gap: 10px;
      }

      .requirement-row {
        display: grid;
        grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr) auto;
        gap: 10px;
      }

      .input,
      .select {
        width: 100%;
        min-height: 42px;
        padding: 8px 11px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.78);
        color: var(--text);
        outline: none;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.86) inset;
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
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.78);
        color: var(--text);
        cursor: pointer;
        white-space: nowrap;
        font-weight: 680;
        line-height: 1.2;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.82) inset;
        backdrop-filter: blur(14px);
        transition: transform 120ms ease, background 140ms ease, border-color 140ms ease;
      }

      .btn:hover {
        border-color: var(--line-strong);
        background: rgba(255, 255, 255, 0.76);
        transform: translateY(-1px);
      }

      .btn.primary {
        border-color: rgba(29, 117, 255, 0.38);
        background: var(--accent);
        color: #fff;
        box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
      }

      .btn.primary:hover {
        background: var(--accent-strong);
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
        background: rgba(255, 255, 255, 0.72);
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
        margin-bottom: 14px;
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
        border-radius: var(--radius);
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
        border-radius: var(--radius);
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

      td p {
        margin: 0 0 7px;
        line-height: 1.55;
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
        max-height: 520px;
        padding: 12px;
        border: 1px solid rgba(121, 169, 237, 0.2);
        border-radius: var(--radius);
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
        border-radius: var(--radius);
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

      .result-view:empty {
        display: none;
      }

      .skill-detail-panel {
        margin-top: 12px;
      }

      .result-card {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.72);
        padding: 14px;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px) saturate(140%);
        overflow: hidden;
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

      .advanced-section {
        margin-top: 18px;
        border: 1px solid rgba(121, 169, 237, 0.18);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.42);
        padding: 12px;
        box-shadow: var(--shadow-soft);
      }

      .advanced-section summary {
        cursor: pointer;
        color: var(--muted);
        font-size: 13px;
        font-weight: 720;
      }

      .advanced-section[open] summary {
        color: var(--text);
        margin-bottom: 6px;
      }

      .marketplace-card {
        display: grid;
        gap: 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.72);
        padding: 14px;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px) saturate(140%);
        overflow: hidden;
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
        border-radius: var(--radius);
        background: rgba(248, 250, 253, 0.74);
      }

      .memory-item.compact {
        padding: 11px;
      }

      .memory-item h3 {
        margin: 0;
        font-size: 14px;
      }

      .memory-item p,
      .dossier-card p,
      .dossier-session p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .dossier-card {
        display: grid;
        gap: 12px;
        border: 1px solid rgba(121, 169, 237, 0.16);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.74);
        padding: 14px;
        box-shadow: var(--shadow-soft);
      }

      .dossier-card.active {
        border-color: rgba(59, 130, 246, 0.32);
        background: rgba(242, 248, 255, 0.82);
      }

      .dossier-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .dossier-heading h3 {
        margin: 0;
        font-size: 16px;
      }

      .dossier-session {
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: var(--radius);
        background: rgba(248, 251, 255, 0.72);
        border: 1px solid rgba(121, 169, 237, 0.12);
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        min-height: 24px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(121, 169, 237, 0.2);
        background: rgba(239, 246, 255, 0.76);
        color: var(--text);
        font-size: 12px;
        font-weight: 650;
      }

      .status-pill.current {
        border-color: rgba(28, 126, 71, 0.22);
        background: rgba(232, 248, 239, 0.82);
        color: #166534;
      }

      .status-pill.stale {
        border-color: rgba(185, 126, 20, 0.24);
        background: rgba(255, 248, 226, 0.84);
        color: #8a5a0a;
      }

      .status-pill.reverted {
        border-color: rgba(194, 65, 12, 0.22);
        background: rgba(255, 241, 232, 0.84);
        color: #9a3412;
      }

      .status-pill.unknown {
        border-color: rgba(100, 116, 139, 0.22);
        background: rgba(241, 245, 249, 0.82);
        color: #475569;
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
        border-radius: var(--radius);
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

      .plain-list li {
        overflow-wrap: anywhere;
      }

      .empty-state {
        min-height: 180px;
        display: grid;
        place-items: center;
        border: 1px dashed rgba(121, 169, 237, 0.34);
        border-radius: var(--radius);
        color: var(--muted);
        text-align: center;
        background: rgba(255, 255, 255, 0.48);
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
        border-radius: var(--radius);
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

      .specweft-review-report dl,
      .review-batch-card dl {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 10px 0;
      }

      .specweft-review-report dt,
      .review-batch-card dt {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .specweft-review-report dd,
      .review-batch-card dd {
        margin: 4px 0 0;
        overflow-wrap: anywhere;
        color: var(--text);
        font-size: 13px;
        font-weight: 650;
      }

      .specweft-review-hero {
        border-color: rgba(37, 99, 235, 0.18);
        background: rgba(238, 244, 255, 0.78);
      }

      .review-batch-list {
        display: grid;
        gap: 12px;
        margin-top: 12px;
      }

      .review-batch-card {
        display: grid;
        gap: 8px;
        padding: 14px;
        border: 1px solid rgba(37, 99, 235, 0.16);
        border-left: 3px solid rgba(37, 99, 235, 0.48);
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.78);
        box-shadow: var(--shadow-soft);
      }

      .review-batch-card h3 {
        margin: 0;
        font-size: 15px;
      }

      .source-reading-list {
        display: grid;
        gap: 10px;
      }

      .source-reading-item {
        display: grid;
        gap: 6px;
        padding: 10px;
        border: 1px solid rgba(121, 169, 237, 0.16);
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.72);
      }

      .source-reading-item strong,
      .source-reading-item code,
      .source-reading-item small {
        overflow-wrap: anywhere;
      }

      .source-reading-item code {
        padding: 7px 8px;
        border-radius: 8px;
        background: rgba(238, 245, 255, 0.78);
        color: var(--text);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
      }

      .source-reading-item small {
        color: var(--muted);
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
        border-radius: var(--radius);
        background: rgba(255, 255, 255, 0.86);
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
          display: grid;
          grid-template-columns: minmax(0, 1fr) 118px;
          gap: 10px 12px;
          align-items: start;
          padding: 14px 15px 12px;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .brand {
          min-width: 0;
          margin-bottom: 0;
        }

        .field-label {
          margin-bottom: 0;
          gap: 4px;
        }

        .nav {
          grid-column: 1 / -1;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .nav button {
          min-height: 40px;
          justify-content: center;
          padding: 4px 8px;
          text-align: center;
          white-space: normal;
          font-size: 13px;
          line-height: 1.2;
        }

        .nav button.active {
          box-shadow: inset 0 -3px 0 rgba(37, 99, 235, 0.72);
        }

        .topbar,
        .topbar-main,
        .grid.three,
        .marketplace-grid,
        .detail-grid,
        .form-row,
        .specweft-review-report dl,
        .review-batch-card dl {
          grid-template-columns: 1fr;
        }

        .main {
          padding: 14px;
        }

        .topbar {
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px;
        }

        .repo-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .repo-row > select,
        .repo-row > input {
          grid-column: 1 / -1;
        }

        .requirement-row {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        #requirementSelect {
          grid-column: 1 / -1;
        }

        .btn {
          padding: 0 10px;
          white-space: normal;
          font-size: 13px;
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
          <button class="active" data-view-button="overview" aria-pressed="true" data-i18n="navOverview">总览</button>
          <button data-view-button="tools" aria-pressed="false" data-i18n="navTools">能力中心</button>
          <button data-view-button="runtime" aria-pressed="false" data-i18n="navRuntime">运行配置</button>
          <button data-view-button="review" aria-pressed="false" data-i18n="navReview">代码讲解</button>
          <button data-view-button="memory" aria-pressed="false" data-i18n="navMemory">记忆</button>
          <button data-view-button="connect" aria-pressed="false" data-i18n="navConnect">接入配置</button>
        </nav>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="topbar-main">
            <div class="repo-row">
              <select id="projectSelect" class="select" aria-label="Project"></select>
              <input id="repoInput" class="input" aria-label="Repository path" />
              <button id="registerProjectButton" class="btn" data-i18n="registerProject">登记项目</button>
              <button id="refreshButton" class="btn primary" data-i18n="refresh">刷新</button>
              <button id="poolButton" class="btn" data-i18n="initPool">初始化工具池</button>
            </div>
            <div id="statusLine" class="status-line" data-status-key="idle">空闲</div>
          </div>
          <div class="requirement-row">
            <select id="requirementSelect" class="select" aria-label="Requirement"></select>
            <input id="requirementTitleInput" class="input" data-i18n-placeholder="requirementTitlePlaceholder" placeholder="新需求标题" />
            <button id="createRequirementButton" class="btn" data-i18n="createRequirement">新建需求</button>
          </div>
        </div>

        <section id="overview" class="view active" data-view="overview" aria-hidden="false">
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
          <div id="recordingStatusOutput" class="result-view"></div>
          <div id="workSegmentOutput" class="result-view"></div>
          <div class="panel grid">
            <div class="form-row">
              <input id="taskInput" class="input" data-i18n-placeholder="taskPlaceholder" placeholder="输入需求，例如：帮我优化登录校验" />
              <button id="prepareTaskButton" class="btn primary" data-i18n="prepareTask">准备任务</button>
            </div>
            <div id="preparedTaskOutput" class="result-view"></div>
          </div>
        </section>

        <section id="tools" class="view" data-view="tools" aria-hidden="true">
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
          <div id="skillDetailOutput" class="result-view skill-detail-panel"></div>
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

          <details class="advanced-section">
            <summary>
              <span data-i18n="advancedMcpMarketplace">高级：MCP 市场候选</span>
            </summary>
            <div class="marketplace-header">
              <h2 data-i18n="marketplaceMcps">市场 MCP 候选</h2>
              <p data-i18n="marketplaceMcpNotice">MCP 适合需要连接外部系统、浏览器、数据库或远程服务的场景。它是可选增强，不是 SpecWeft 的默认主线。</p>
            </div>
            <div class="panel grid marketplace-search">
              <div class="form-row">
                <input id="marketplaceMcpKeywordInput" class="input" data-i18n-placeholder="marketplaceMcpKeywordPlaceholder" placeholder="搜索 MCP 关键词，例如 github、playwright、postgres" />
                <button id="marketplaceMcpSearchButton" class="btn primary" data-i18n="searchMarketplaceMcp">搜索市场 MCP</button>
              </div>
            </div>
            <div id="marketplaceMcps" class="marketplace-grid"></div>
          </details>
        </section>

        <section id="runtime" class="view" data-view="runtime" aria-hidden="true">
          <div class="section-title">
            <h1 data-i18n="runtime">运行配置</h1>
            <button id="assemblyButton" class="btn primary" data-i18n="buildAssembly">生成配置</button>
          </div>
          <div id="assemblyOutput" class="result-view"></div>
        </section>

        <section id="review" class="view" data-view="review" aria-hidden="true">
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

        <section id="memory" class="view" data-view="memory" aria-hidden="true">
          <div class="section-title">
            <h1 data-i18n="memory">记忆</h1>
          </div>
          <div class="panel grid">
            <div class="form-row">
              <input id="keywordInput" class="input" data-i18n-placeholder="keywordPlaceholder" placeholder="关键词" />
              <div class="actions">
                <button id="digestButton" class="btn" data-i18n="refreshDigest">刷新摘要</button>
                <button id="recallButton" class="btn" data-i18n="recall">召回</button>
                <button id="handoffButton" class="btn primary" data-i18n="createHandoff">生成交接上下文</button>
              </div>
            </div>
            <div id="requirementDossierOutput" class="result-view"></div>
            <div id="workSegmentMemoryOutput" class="result-view"></div>
            <div id="memoryDigestOutput" class="result-view"></div>
            <div id="timelineOutput" class="result-view"></div>
            <div id="recallOutput" class="result-view"></div>
            <div id="handoffOutput" class="result-view"></div>
          </div>
        </section>

        <section id="connect" class="view" data-view="connect" aria-hidden="true">
          <div class="section-title">
            <h1 data-i18n="connect">接入配置</h1>
            <button id="connectButton" class="btn primary" data-i18n="generateConfig">生成配置</button>
          </div>
          <div id="connectOutput" class="result-view"></div>
          <div id="llmConfigOutput" class="result-view"></div>
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
          requirementSelectorPlaceholder: "选择当前需求",
          requirementTitlePlaceholder: "新需求标题，例如 Skill 详情预览",
          createRequirement: "新建需求",
          requirementCreated: "需求已创建",
          requirementActivated: "当前需求已切换",
          currentRequirement: "当前需求",
          reviewCount: "讲解次数",
          recordingStatus: "记录状态",
          recordingClean: "当前没有未提交改动",
          recordingRecorded: "当前 diff 已记录",
          recordingUnrecorded: "当前 diff 未记录",
          recordingChanged: "代码已在记录后继续变化",
          recordCurrentDiff: "记录当前 diff",
          recordingCurrentDiff: "正在记录当前 diff",
          workSegments: "工作段",
          activeWorkSegment: "当前工作段",
          recentWorkSegments: "最近工作段",
          noWorkSegments: "还没有工作段。开始修改前由 Agent 调用 start_work_segment 后，这里会显示本次需求边界。",
          segmentStatus_active: "进行中",
          segmentStatus_recorded: "已记录",
          segmentStatus_interrupted: "已中断",
          segmentStatus_abandoned: "已放弃",
          baselineChangedFiles: "开始时已有改动",
          newChangedFiles: "本工作段新增改动",
          carriedChangedFiles: "沿用旧改动",
          prepareTask: "准备任务",
          preparingTask: "正在准备任务",
          taskPrepared: "任务上下文已生成",
          taskPlaceholder: "输入需求，例如：帮我优化登录校验",
          preparedTask: "任务上下文",
          taskAnalysis: "任务分析",
          intent: "意图",
          ambiguity: "清晰度",
          confidence: "置信度",
          routingReason: "路由依据",
          suggestedSearches: "建议搜索词",
          matchSource: "匹配来源",
          fileRole: "文件角色",
          codePreview: "源码摘录",
          clarifiedGoal: "补全后的目标",
          missingQuestions: "需要补充的问题",
          acceptanceCriteria: "验收标准",
          codePointers: "相关文件",
          skillSuggestions: "推荐 Skills",
          matchedSignals: "匹配信号",
          usageHint: "使用建议",
          localRuleNote: "本地规则提醒",
          memorySuggestions: "相关记忆",
          executionPlan: "执行路线",
          noExecutionPlan: "还没有生成执行路线。",
          agentInstructions: "Agent 执行建议",
          noPreparedTaskYet: "还没有准备任务上下文。",
          noCodePointers: "暂时没有强相关文件。",
          noSkillSuggestions: "暂时没有推荐 Skill。",
          noMemorySuggestions: "暂时没有相关记忆。",
          matchedRequirement: "命中的需求线",
          noMatchedRequirement: "没有命中历史需求线，本次会按新需求边界记录。",
          requirementMatchReason: "命中原因",
          startWorkSegmentTool: "开始工作段",
          recordDiffTool: "记录 diff",
          requirementDossier: "需求档案",
          requirementDossierHint: "按需求整理多次修改，先看档案，再恢复具体需求。",
          noRequirementDossier: "还没有需求档案。",
          activeRequirement: "当前需求",
          requirementStatus: "需求状态",
          nextAction: "下一步建议",
          keyFiles: "关键文件",
          latestSummary: "最近总结",
          reviewSessions: "修改记录",
          sessionsOmitted: "已省略修改记录",
          timeline: "需求时间线",
          timelineSummary: "时间线摘要",
          timelineEmpty: "还没有需求记忆。",
          currentCount: "当前",
          staleCount: "过期",
          revertedCount: "已回滚",
          unknownCount: "未知",
          languages: "语言",
          enabledTools: "已启用工具",
          tools: "能力中心",
          filterAll: "全部",
          filterMcp: "MCP",
          filterSkill: "Skill",
          filterCli: "CLI",
          noToolsForFilter: "当前筛选下没有能力。",
          advancedMcpMarketplace: "高级：MCP 市场候选",
          marketplaceMcps: "市场 MCP 候选",
          marketplaceMcpNotice: "MCP 适合连接外部系统、浏览器、数据库或远程服务。它是可选增强，不是默认主线。",
          marketplaceMcpKeywordPlaceholder: "搜索 MCP 关键词，例如 github、playwright、postgres",
          searchMarketplaceMcp: "搜索市场 MCP",
          searchingMarketplaceMcp: "正在搜索市场 MCP",
          marketplaceMcpHiddenByFilter: "当前只筛选 Skill，市场 MCP 候选已隐藏。",
          noMarketplaceMcps: "还没有搜索 MCP 候选。",
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
          noMarketplaceSkills: "还没有搜索 Skill 候选。",
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
          viewSkillDetail: "详情",
          previewSkillContent: "预览内容",
          loadingSkillDetail: "正在读取 Skill 内容",
          skillDetail: "Skill 详情",
          skillContent: "Skill 内容",
          contentSource: "内容来源",
          source: "来源",
          stars: "Stars",
          forks: "Forks",
          refreshRecommendations: "刷新能力",
          name: "名称",
          type: "类型",
          status: "状态",
          risk: "风险",
          reason: "原因",
          action: "动作",
          when: "时机",
          tool: "工具",
          actions: "操作",
          runtime: "运行配置",
          buildAssembly: "生成配置",
          review: "代码讲解",
          reviewTitlePlaceholder: "代码讲解标题",
          createReview: "生成讲解",
          reviewOverview: "本次修改概览",
          reviewOverviewBatches: "修改批次",
          reviewOverviewReadingOrder: "概览阅读顺序",
          reviewBatchSourceGroups: "关联分组",
          implementationSummary: "实现内容总结",
          sourceReadingGuide: "源码查看方式",
          reviewWalkthrough: "建议阅读顺序",
          risks: "风险提示",
          testSuggestions: "测试建议",
          changeGroups: "改动分组",
          groupMatchReason: "分组依据",
          groupConfidence: "分组置信度",
          requirementBlocks: "需求拆解",
          requirementBlockKind: "块类型",
          requirementBlockEvidence: "判断证据",
          requirementBlockAction: "建议动作",
          noRequirementBlocks: "还没有识别到需求拆解块。",
          reviewFocus: "Review 重点",
          groupTestSuggestions: "验证建议",
          noChangeGroups: "还没有识别到改动分组。",
          memory: "记忆",
          keywordPlaceholder: "关键词",
          recall: "召回",
          createHandoff: "生成交接上下文",
          refreshDigest: "刷新摘要",
          memoryDigest: "记忆摘要入口",
          memoryDigestHint: "先读摘要，再按需求恢复上下文。",
          totalThreads: "需求线",
          sessionCount: "记忆数",
          latestUpdatedAt: "最近更新",
          restoreHint: "恢复方式",
          handoff: "线程交接",
          handoffPrompt: "新线程提示词",
          recoveredSessions: "恢复到的记忆",
          generatedAt: "生成时间",
          handoffReady: "交接上下文已生成",
          connect: "接入配置",
          generateConfig: "生成配置",
          agentWorkflow: "Agent 自动调用顺序",
          codexConfig: "Codex 配置片段",
          claudeConfig: "Claude 配置 JSON",
          workflowBootstrap: "打开项目后先调用 specweft.bootstrap_session 获取项目画像和工作流。",
          workflowPrepare: "每次收到需求后调用 specweft.prepare_task，补全描述、定位文件并推荐 Skill。",
          workflowSegment: "修改前调用 specweft.start_work_segment，给本次需求留下本地边界。",
          workflowDigest: "需要延续旧需求时先读 specweft.get_memory_digest 和 specweft.get_requirement_dossier，再只恢复相关需求记忆。",
          workflowRecord: "修改代码后调用 specweft.record_current_diff，保存讲解和记忆。",
          llmReviewConfig: "LLM 讲解配置",
          llmEnabled: "已启用",
          llmDisabled: "未启用",
          model: "模型",
          baseUrl: "Base URL",
          maxDiffChars: "最大 diff 字符数",
          apiKeyEnv: "密钥环境变量",
          notDetected: "未检测到",
          llmConfigHint: "SpecWeft 只检测环境变量是否存在，不会在界面展示密钥。设置 SPECWEFT_LLM_API_KEY 后，review 会在规则讲解基础上追加 LLM 总结。",
          idle: "空闲",
          loading: "加载中",
          ready: "就绪",
          updating: "更新中",
          creatingReview: "正在生成代码讲解",
          loadingMemory: "正在读取记忆",
          error: "出错",
          initializingPool: "正在初始化工具池",
          selectionUpdated: "选择已更新",
          poolInitialized: "工具池已初始化",
          reviewSaved: "代码讲解已保存",
          requestFailed: "请求失败",
          networkFailed: "网络请求失败",
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
          codeStatus: "代码状态",
          expiresAt: "过期时间",
          summary: "摘要",
          changedFiles: "修改文件",
          keywords: "关键词",
          noChangedFiles: "没有记录修改文件",
          noKeywords: "没有关键词",
          noSessions: "没有找到相关记忆。",
          noHandoffYet: "还没有生成线程交接上下文。",
          noReviewYet: "还没有生成代码讲解。",
          noSkillDetailYet: "选择一个 Skill 查看具体内容。",
          noRuntimeYet: "暂无运行配置。",
          noConnectYet: "暂无接入配置。",
          noLlmConfigYet: "暂无 LLM 配置状态。"
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
          requirementSelectorPlaceholder: "Select current requirement",
          requirementTitlePlaceholder: "New requirement title, e.g. Skill detail preview",
          createRequirement: "New Requirement",
          requirementCreated: "Requirement created",
          requirementActivated: "Current requirement switched",
          currentRequirement: "Current requirement",
          reviewCount: "Review count",
          recordingStatus: "Recording status",
          recordingClean: "No uncommitted changes",
          recordingRecorded: "Current diff is recorded",
          recordingUnrecorded: "Current diff is not recorded",
          recordingChanged: "Code changed after the latest record",
          recordCurrentDiff: "Record Current Diff",
          recordingCurrentDiff: "Recording current diff",
          workSegments: "Work Segments",
          activeWorkSegment: "Active work segment",
          recentWorkSegments: "Recent work segments",
          noWorkSegments: "No work segment yet. Once an agent calls start_work_segment before editing, the task boundary appears here.",
          segmentStatus_active: "Active",
          segmentStatus_recorded: "Recorded",
          segmentStatus_interrupted: "Interrupted",
          segmentStatus_abandoned: "Abandoned",
          baselineChangedFiles: "Existing changes at start",
          newChangedFiles: "New changes in segment",
          carriedChangedFiles: "Carried changes",
          prepareTask: "Prepare Task",
          preparingTask: "Preparing task",
          taskPrepared: "Task context prepared",
          taskPlaceholder: "Enter a task, e.g. improve login validation",
          preparedTask: "Task Context",
          taskAnalysis: "Task Analysis",
          intent: "Intent",
          ambiguity: "Ambiguity",
          confidence: "Confidence",
          routingReason: "Routing reason",
          suggestedSearches: "Suggested searches",
          matchSource: "Match source",
          fileRole: "File role",
          codePreview: "Code preview",
          clarifiedGoal: "Clarified goal",
          missingQuestions: "Missing questions",
          acceptanceCriteria: "Acceptance criteria",
          codePointers: "Related files",
          skillSuggestions: "Recommended Skills",
          matchedSignals: "Matched signals",
          usageHint: "Usage hint",
          localRuleNote: "Local rule note",
          memorySuggestions: "Relevant memory",
          executionPlan: "Execution Plan",
          noExecutionPlan: "No execution plan was generated.",
          agentInstructions: "Agent instructions",
          noPreparedTaskYet: "No prepared task context yet.",
          noCodePointers: "No strong related file yet.",
          noSkillSuggestions: "No Skill suggestion yet.",
          noMemorySuggestions: "No relevant memory yet.",
          matchedRequirement: "Matched Requirement",
          noMatchedRequirement: "No existing requirement was matched. This task will be recorded as a new boundary.",
          requirementMatchReason: "Match reason",
          startWorkSegmentTool: "Start work segment",
          recordDiffTool: "Record diff",
          requirementDossier: "Requirement Dossier",
          requirementDossierHint: "Repeated changes are grouped by requirement. Read the dossier before restoring one requirement.",
          noRequirementDossier: "No requirement dossier yet.",
          activeRequirement: "Active requirement",
          requirementStatus: "Requirement status",
          nextAction: "Next action",
          keyFiles: "Key files",
          latestSummary: "Latest summary",
          reviewSessions: "Review sessions",
          sessionsOmitted: "Omitted sessions",
          timeline: "Requirement Timeline",
          timelineSummary: "Timeline summary",
          timelineEmpty: "No requirement memories yet.",
          currentCount: "Current",
          staleCount: "Stale",
          revertedCount: "Reverted",
          unknownCount: "Unknown",
          languages: "Languages",
          enabledTools: "Enabled Tools",
          tools: "Capability Center",
          filterAll: "All",
          filterMcp: "MCP",
          filterSkill: "Skill",
          filterCli: "CLI",
          noToolsForFilter: "No tools match this filter.",
          advancedMcpMarketplace: "Advanced: MCP Marketplace Candidates",
          marketplaceMcps: "Marketplace MCP Candidates",
          marketplaceMcpNotice: "MCP is useful when a task needs external systems, browsers, databases, or remote services. It is optional, not the default path.",
          marketplaceMcpKeywordPlaceholder: "Search MCP keyword, e.g. github, playwright, postgres",
          searchMarketplaceMcp: "Search Marketplace MCPs",
          searchingMarketplaceMcp: "Searching marketplace MCPs",
          marketplaceMcpHiddenByFilter: "Marketplace MCP candidates are hidden while Skill is selected.",
          noMarketplaceMcps: "No MCP search has been run yet.",
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
          noMarketplaceSkills: "No Skill search has been run yet.",
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
          viewSkillDetail: "Details",
          previewSkillContent: "Preview Content",
          loadingSkillDetail: "Loading Skill content",
          skillDetail: "Skill Detail",
          skillContent: "Skill Content",
          contentSource: "Content source",
          source: "Source",
          stars: "Stars",
          forks: "Forks",
          refreshRecommendations: "Refresh Capabilities",
          name: "Name",
          type: "Type",
          status: "Status",
          risk: "Risk",
          reason: "Reason",
          action: "Action",
          when: "When",
          tool: "Tool",
          actions: "Actions",
          runtime: "Runtime",
          buildAssembly: "Build Assembly",
          review: "Review",
          reviewTitlePlaceholder: "Review title",
          createReview: "Create Review",
          reviewOverview: "Review Overview",
          reviewOverviewBatches: "Review Batches",
          reviewOverviewReadingOrder: "Overview Reading Order",
          reviewBatchSourceGroups: "Source Groups",
          implementationSummary: "Implementation Summary",
          sourceReadingGuide: "Source Reading Guide",
          reviewWalkthrough: "Suggested Reading Order",
          risks: "Risks",
          testSuggestions: "Test Suggestions",
          changeGroups: "Change Groups",
          groupMatchReason: "Grouping reason",
          groupConfidence: "Grouping confidence",
          requirementBlocks: "Requirement Blocks",
          requirementBlockKind: "Block type",
          requirementBlockEvidence: "Evidence",
          requirementBlockAction: "Suggested action",
          noRequirementBlocks: "No requirement blocks were detected.",
          reviewFocus: "Review Focus",
          groupTestSuggestions: "Verification Suggestions",
          noChangeGroups: "No change groups were detected.",
          memory: "Memory",
          keywordPlaceholder: "Keyword",
          recall: "Recall",
          createHandoff: "Create Handoff",
          refreshDigest: "Refresh Digest",
          memoryDigest: "Memory Digest",
          memoryDigestHint: "Read the digest first, then restore one relevant requirement.",
          totalThreads: "Threads",
          sessionCount: "Memories",
          latestUpdatedAt: "Latest update",
          restoreHint: "Restore hint",
          handoff: "Thread Handoff",
          handoffPrompt: "New Thread Prompt",
          recoveredSessions: "Recovered Memories",
          generatedAt: "Generated at",
          handoffReady: "Handoff created",
          connect: "Connect",
          generateConfig: "Generate Config",
          agentWorkflow: "Agent workflow",
          codexConfig: "Codex Config Snippet",
          claudeConfig: "Claude Config JSON",
          workflowBootstrap: "Call specweft.bootstrap_session when a project opens to load profile and workflow.",
          workflowPrepare: "Call specweft.prepare_task for each user task to clarify scope, locate files, and recommend Skills.",
          workflowSegment: "Before editing, call specweft.start_work_segment to mark the local boundary for this request.",
          workflowDigest: "For old work, read specweft.get_memory_digest and specweft.get_requirement_dossier first, then restore only the relevant requirement.",
          workflowRecord: "After edits, call specweft.record_current_diff to save the explanation and memory.",
          llmReviewConfig: "LLM Review Config",
          llmEnabled: "Enabled",
          llmDisabled: "Disabled",
          model: "Model",
          baseUrl: "Base URL",
          maxDiffChars: "Max diff chars",
          apiKeyEnv: "API key env",
          notDetected: "Not detected",
          llmConfigHint: "SpecWeft only checks whether env vars exist and never displays secrets. Set SPECWEFT_LLM_API_KEY to add an LLM summary on top of rule-based reviews.",
          idle: "Idle",
          loading: "Loading",
          ready: "Ready",
          updating: "Updating",
          creatingReview: "Creating review",
          loadingMemory: "Loading memory",
          error: "Error",
          initializingPool: "Initializing pool",
          selectionUpdated: "Selection updated",
          poolInitialized: "Pool initialized",
          reviewSaved: "Review saved",
          requestFailed: "Request failed",
          networkFailed: "Network request failed",
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
          codeStatus: "Code status",
          expiresAt: "Expires at",
          summary: "Summary",
          changedFiles: "Changed files",
          keywords: "Keywords",
          noChangedFiles: "No changed files were recorded.",
          noKeywords: "No keywords.",
          noSessions: "No matching memories found.",
          noHandoffYet: "No thread handoff has been created yet.",
          noReviewYet: "No review has been created yet.",
          noSkillDetailYet: "Select a Skill to inspect its content.",
          noRuntimeYet: "No runtime assembly yet.",
          noConnectYet: "No connection config yet.",
          noLlmConfigYet: "No LLM config status yet."
        }
      };

      const state = {
        repoPath: "",
        projects: [],
        requirements: { version: 1, requirements: [] },
        dashboard: undefined,
        marketplaceSkills: undefined,
        marketplaceMcps: undefined,
        locale: localStorage.getItem("specweft.locale") || "zh-CN",
        toolFilter: localStorage.getItem("specweft.toolFilter") || "all"
      };

      const repoInput = document.getElementById("repoInput");
      const projectSelect = document.getElementById("projectSelect");
      const requirementSelect = document.getElementById("requirementSelect");
      const requirementTitleInput = document.getElementById("requirementTitleInput");
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
        renderRequirementOptions();
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
        let response;
        try {
          response = await fetch(path, { ...options, headers });
        } catch (error) {
          throw new Error((error && error.message) || t("networkFailed"));
        }

        const text = await response.text();
        let value = {};
        if (text) {
          try {
            value = JSON.parse(text);
          } catch {
            value = { error: text.slice(0, 240) };
          }
        }
        if (!response.ok) {
          throw new Error(value.error || response.statusText || t("requestFailed"));
        }
        return value;
      }

      async function loadDashboard() {
        setStatus("loading");
        const repo = encodeURIComponent(repoInput.value.trim());
        const data = await api("/api/dashboard?repo=" + repo);
        state.repoPath = data.profile.rootPath;
        state.dashboard = data;
        state.requirements = data.requirements || { version: 1, requirements: [] };
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

      function renderRequirementOptions() {
        const file = state.requirements || { requirements: [] };
        const requirements = file.requirements || [];
        requirementSelect.innerHTML = [
          "<option value=''>" + escapeHtml(t("requirementSelectorPlaceholder")) + "</option>",
          ...requirements.map((requirement) => {
            const label = requirement.title + " · " + t("reviewCount") + ": " + requirement.reviewCount;
            return "<option value='" + escapeHtml(requirement.id) + "'>" + escapeHtml(label) + "</option>";
          })
        ].join("");
        requirementSelect.value = file.activeRequirementId || "";
      }

      function activeRequirementId() {
        return requirementSelect.value || state.requirements?.activeRequirementId || "";
      }

      function renderDashboard(data) {
        document.getElementById("projectName").textContent = data.profile.name;
        document.getElementById("languages").textContent = data.profile.languages.join(", ") || "-";
        const enabled = data.capabilityCenter?.summary?.enabled
          ?? data.recommendations.filter((item) => item.status === "enabled").length;
        document.getElementById("enabledCount").textContent = String(enabled);
        renderCapabilities(data.capabilityCenter?.capabilities || data.recommendations);
        renderMarketplaceMcps(state.marketplaceMcps);
        renderMarketplaceSkills(state.marketplaceSkills);
        renderRequirementOptions();
        renderAssembly(data.assembly);
        renderConnect(data.mcpInspect);
        renderLlmConfig(data.llmConfig);
        renderRecordingStatus(data.recordingStatus);
        renderWorkSegments(data.workSegments);
        renderRequirementDossier(data.requirementDossier);
        renderMemoryDigest(data.memoryDigest);
        renderTimeline(data.timeline);
      }

      function renderEmptyOutputs() {
        document.getElementById("recordingStatusOutput").innerHTML = "";
        document.getElementById("workSegmentOutput").innerHTML = emptyState(t("noWorkSegments"));
        document.getElementById("workSegmentMemoryOutput").innerHTML = emptyState(t("noWorkSegments"));
        document.getElementById("preparedTaskOutput").innerHTML = emptyState(t("noPreparedTaskYet"));
        document.getElementById("assemblyOutput").innerHTML = emptyState(t("noRuntimeYet"));
        document.getElementById("connectOutput").innerHTML = emptyState(t("noConnectYet"));
        document.getElementById("llmConfigOutput").innerHTML = emptyState(t("noLlmConfigYet"));
        document.getElementById("reviewOutput").innerHTML = emptyState(t("noReviewYet"));
        document.getElementById("requirementDossierOutput").innerHTML = emptyState(t("noRequirementDossier"));
        document.getElementById("memoryDigestOutput").innerHTML = emptyState(t("timelineEmpty"));
        document.getElementById("timelineOutput").innerHTML = emptyState(t("timelineEmpty"));
        document.getElementById("recallOutput").innerHTML = emptyState(t("noSessions"));
        document.getElementById("handoffOutput").innerHTML = emptyState(t("noHandoffYet"));
        document.getElementById("skillDetailOutput").innerHTML = emptyState(t("noSkillDetailYet"));
        document.getElementById("marketplaceMcps").innerHTML = emptyState(t("noMarketplaceMcps"));
        document.getElementById("marketplaceSkills").innerHTML = emptyState(t("noMarketplaceSkills"));
      }

      function renderPreparedTask(data) {
        const requirement = data.requirement || {};
        const analysis = data.taskAnalysis || {};
        document.getElementById("preparedTaskOutput").innerHTML = [
          sectionCard(t("preparedTask"), detailGrid([
            [t("project"), data.projectName || "-"],
            [t("generatedAt"), data.generatedAt || "-"],
            [t("clarifiedGoal"), requirement.clarifiedGoal || "-"]
          ])),
          sectionCard(t("taskAnalysis"), [
            "<p>" + escapeHtml(analysis.summary || "-") + "</p>",
            detailGrid([
              [t("intent"), analysis.intent || "-"],
              [t("ambiguity"), analysis.ambiguity || "-"],
              [t("confidence"), analysis.confidence || "-"],
              [t("routingReason"), analysis.routingReason || "-"],
              [t("suggestedSearches"), analysis.suggestedSearches?.length ? analysis.suggestedSearches.join(", ") : "-"]
            ])
          ].join("")),
          sectionCard(t("missingQuestions"), listHtml(requirement.missingQuestions?.length ? requirement.missingQuestions : ["-"])),
          sectionCard(t("acceptanceCriteria"), listHtml(requirement.acceptanceCriteria?.length ? requirement.acceptanceCriteria : ["-"])),
          sectionCard(t("codePointers"), data.codePointers?.length
            ? data.codePointers.map((item) => detailCard(item.path, [
                [t("reason"), item.reason || "-"],
                [t("status"), item.confidence || "-"],
                [t("matchSource"), item.matchSource || "-"],
                [t("fileRole"), item.fileRole || "-"],
                [t("matchedSignals"), item.matchedSignals?.length ? item.matchedSignals.join(", ") : "-"],
                [t("codePreview"), item.preview ? (item.startLine ? "L" + item.startLine + ": " : "") + item.preview : "-"]
              ])).join("")
            : emptyState(t("noCodePointers"))),
          sectionCard(t("skillSuggestions"), data.skillSuggestions?.length
            ? data.skillSuggestions.map((item) => detailCard(item.name, [
                [t("memoryId"), item.id],
                [t("status"), item.status || "-"],
                [t("risk"), item.conflictRisk || "-"],
                [t("reason"), item.reason || "-"],
                [t("matchedSignals"), item.matchedSignals?.length ? item.matchedSignals.join(", ") : "-"],
                [t("usageHint"), item.usageHint || "-"],
                [t("localRuleNote"), item.localRuleNote || "-"]
              ])).join("")
            : emptyState(t("noSkillSuggestions"))),
          sectionCard(t("memorySuggestions"), data.memorySuggestions?.length
            ? data.memorySuggestions.map((item) => detailCard(item.title, [
                [t("memoryId"), item.memoryId],
                [t("currentRequirement"), item.requirementId || "-"],
                [t("reason"), item.reason || "-"],
                [t("command"), item.restoreTool || "-"]
              ])).join("")
            : emptyState(t("noMemorySuggestions"))),
          sectionCard(t("matchedRequirement"), renderMatchedRequirement(data.matchedRequirement)),
          sectionCard(t("executionPlan"), renderExecutionPlan(data.executionPlan || [])),
          sectionCard(t("agentInstructions"), "<div class='prompt-box'>" + escapeHtml(data.agentInstructions || "-") + "</div>")
        ].join("");
      }

      function renderExecutionPlan(steps) {
        if (!steps.length) {
          return emptyState(t("noExecutionPlan"));
        }

        return steps.map((step) => [
          "<div class='memory-item'>",
          "<h3>" + escapeHtml(step.order + ". " + (step.title || "-")) + "</h3>",
          detailGrid([
            [t("action"), step.action || "-"],
            [t("reason"), step.reason || "-"],
            [t("when"), step.when || "-"],
            [t("tool"), step.tool || "-"]
          ]),
          "</div>"
        ].join("")).join("");
      }

      function renderMatchedRequirement(requirement) {
        if (!requirement) {
          return emptyState(t("noMatchedRequirement"));
        }

        return detailCard(requirement.title || "-", [
          [t("currentRequirement"), requirement.requirementId || "-"],
          [t("status"), requirement.status || "-"],
          [t("reviewCount"), String(requirement.reviewCount || 0)],
          [t("requirementMatchReason"), requirement.reason || "-"],
          [t("keywords"), requirement.keywords?.length ? requirement.keywords.join(", ") : "-"],
          [t("startWorkSegmentTool"), requirement.startWorkSegmentTool || "-"],
          [t("recordDiffTool"), requirement.recordDiffTool || "-"]
        ]);
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
          sectionCard(t("codexConfig"), "<div class='codebox'>" + escapeHtml(config.codexToml || "-") + "</div>"),
          sectionCard(t("claudeConfig"), "<div class='codebox'>" + escapeHtml(config.claudeJson || JSON.stringify(config.clientConfig || {}, null, 2)) + "</div>"),
          sectionCard(t("summary"), detailGrid([
            [t("serverName"), config.server],
            [t("transport"), config.transport]
          ])),
          sectionCard(t("agentWorkflow"), listHtml(config.workflow?.length ? config.workflow : [
            t("workflowBootstrap"),
            t("workflowPrepare"),
            t("workflowSegment"),
            t("workflowDigest"),
            t("workflowRecord")
          ])),
          sectionCard(t("exposedTools"), listHtml(config.tools || []))
        ].join("");
      }

      function renderLlmConfig(config) {
        const status = config?.enabled ? t("llmEnabled") : t("llmDisabled");
        document.getElementById("llmConfigOutput").innerHTML = sectionCard(t("llmReviewConfig"), [
          detailGrid([
            [t("status"), status],
            [t("model"), config?.model || "-"],
            [t("baseUrl"), config?.baseUrl || "-"],
            [t("maxDiffChars"), String(config?.maxDiffChars || "-")],
            [t("apiKeyEnv"), config?.env?.apiKey || t("notDetected")]
          ]),
          "<p>" + escapeHtml(t("llmConfigHint")) + "</p>"
        ].join(""));
      }

      function renderRecordingStatus(status) {
        if (!status) {
          document.getElementById("recordingStatusOutput").innerHTML = "";
          return;
        }

        const title = statusTitle(status.status);
        const action = status.hasChanges && !status.isRecorded
          ? "<button id='recordCurrentDiffButton' class='btn primary'>" + escapeHtml(t("recordCurrentDiff")) + "</button>"
          : "";
        document.getElementById("recordingStatusOutput").innerHTML = sectionCard(t("recordingStatus"), [
          detailGrid([
            [t("status"), title],
            [t("summary"), status.reason || "-"],
            [t("changedFiles"), status.currentSnapshot?.changedFiles?.length ? status.currentSnapshot.changedFiles.join(", ") : "-"]
          ]),
          action ? "<div class='actions'>" + action + "</div>" : ""
        ].join(""));
      }

      function renderWorkSegments(report) {
        const overview = document.getElementById("workSegmentOutput");
        const memory = document.getElementById("workSegmentMemoryOutput");
        if (!report) {
          overview.innerHTML = emptyState(t("noWorkSegments"));
          memory.innerHTML = emptyState(t("noWorkSegments"));
          return;
        }

        const active = report.activeSegment;
        const recent = report.recentSegments || [];
        overview.innerHTML = sectionCard(t("workSegments"), [
          active ? renderWorkSegmentCard(active, true) : emptyState(t("noWorkSegments")),
          report.guidance?.length ? "<h3>" + escapeHtml(t("nextAction")) + "</h3>" + listHtml(report.guidance) : ""
        ].join(""));

        memory.innerHTML = sectionCard(t("recentWorkSegments"), recent.length
          ? "<div class='memory-stack'>" + recent.map((segment) => renderWorkSegmentCard(segment, false)).join("") + "</div>"
          : emptyState(t("noWorkSegments")));
      }

      function renderWorkSegmentCard(segment, compact) {
        const title = compact ? t("activeWorkSegment") + ": " + (segment.title || "-") : segment.title || "-";
        return [
          "<div class='memory-item'>",
          "<h3>" + escapeHtml(title) + "</h3>",
          "<p>" + escapeHtml(segment.summary || segment.task || "-") + "</p>",
          detailGrid([
            [t("status"), t("segmentStatus_" + segment.status)],
            [t("currentRequirement"), segment.requirementTitle || segment.requirementId || "-"],
            [t("baselineChangedFiles"), segment.baselineChangedFiles?.length ? segment.baselineChangedFiles.join(", ") : "-"],
            [t("newChangedFiles"), segment.newChangedFiles?.length ? segment.newChangedFiles.join(", ") : "-"],
            [t("carriedChangedFiles"), segment.carriedChangedFiles?.length ? segment.carriedChangedFiles.join(", ") : "-"],
            [t("reportPath"), segment.reviewPath || "-"],
            [t("memoryId"), segment.memoryId || "-"],
            [t("latestUpdatedAt"), segment.updatedAt || "-"]
          ]),
          "</div>"
        ].join("");
      }

      function renderTimeline(timeline) {
        const container = document.getElementById("timelineOutput");
        if (!timeline) {
          container.innerHTML = emptyState(t("timelineEmpty"));
          return;
        }

        const items = timeline.items || [];
        const summary = timeline.summary || {};
        const summaryCard = sectionCard(t("timelineSummary"), detailGrid([
          [t("currentRequirement"), timeline.activeRequirementId || "-"],
          [t("reviewCount"), String(summary.sessions || 0)],
          [t("currentCount"), String(summary.current || 0)],
          [t("staleCount"), String(summary.stale || 0)],
          [t("revertedCount"), String(summary.reverted || 0)],
          [t("unknownCount"), String(summary.unknown || 0)]
        ]));

        if (items.length === 0 && !(timeline.unscopedSessions || []).length) {
          container.innerHTML = summaryCard + emptyState(t("timelineEmpty"));
          return;
        }

        const requirementCards = items.map((item) => {
          const requirement = item.requirement || {};
          const sessions = item.sessions || [];
          return sectionCard(requirement.title || "-", [
            detailGrid([
              [t("memoryId"), requirement.id || "-"],
              [t("reviewCount"), String(requirement.reviewCount || sessions.length || 0)],
              [t("currentCount"), String(item.statusCounts?.current || 0)],
              [t("staleCount"), String(item.statusCounts?.stale || 0)],
              [t("revertedCount"), String(item.statusCounts?.reverted || 0)],
              [t("unknownCount"), String(item.statusCounts?.unknown || 0)]
            ]),
            sessions.length
              ? "<div class='memory-stack'>" + sessions.map(renderTimelineSession).join("") + "</div>"
              : emptyState(t("noSessions"))
          ].join(""));
        }).join("");

        const unscoped = timeline.unscopedSessions?.length
          ? sectionCard(t("recoveredSessions"), "<div class='memory-stack'>" + timeline.unscopedSessions.map(renderTimelineSession).join("") + "</div>")
          : "";

        container.innerHTML = summaryCard + requirementCards + unscoped;
      }

      function renderMemoryDigest(digest) {
        const container = document.getElementById("memoryDigestOutput");
        if (!digest) {
          container.innerHTML = emptyState(t("timelineEmpty"));
          return;
        }

        const items = digest.items || [];
        const summaryCard = sectionCard(t("memoryDigest"), [
          "<p>" + escapeHtml(digest.summary || t("memoryDigestHint")) + "</p>",
          detailGrid([
            [t("reviewCount"), String(digest.totalMemories || 0)],
            [t("totalThreads"), String(digest.totalThreads || 0)],
            [t("generatedAt"), digest.generatedAt || "-"]
          ])
        ].join(""));

        if (items.length === 0) {
          container.innerHTML = summaryCard + emptyState(t("timelineEmpty"));
          return;
        }

        const cards = items.map((item) => sectionCard(item.title || "-", [
          "<p>" + escapeHtml(item.latestSummary || "-") + "</p>",
          detailGrid([
            [t("currentRequirement"), item.requirementTitle || item.requirementId || "-"],
            [t("sessionCount"), String(item.sessionCount || 0)],
            [t("currentCount"), String(item.statusCounts?.current || 0)],
            [t("staleCount"), String(item.statusCounts?.stale || 0)],
            [t("revertedCount"), String(item.statusCounts?.reverted || 0)],
            [t("unknownCount"), String(item.statusCounts?.unknown || 0)],
            [t("latestUpdatedAt"), item.latestUpdatedAt || "-"],
            [t("restoreHint"), item.restoreHint || "-"]
          ]),
          "<h3>" + escapeHtml(t("keywords")) + "</h3>",
          listHtml(item.keywords?.length ? item.keywords : [t("noKeywords")]),
          "<h3>" + escapeHtml(t("changedFiles")) + "</h3>",
          listHtml(item.keyFiles?.length ? item.keyFiles : [t("noChangedFiles")])
        ].join(""))).join("");

        container.innerHTML = summaryCard + cards;
      }

      function renderRequirementDossier(dossier) {
        const container = document.getElementById("requirementDossierOutput");
        if (!dossier) {
          container.innerHTML = emptyState(t("noRequirementDossier"));
          return;
        }

        const items = dossier.items || [];
        const summaryCard = sectionCard(t("requirementDossier"), [
          "<p>" + escapeHtml(dossier.summary || t("requirementDossierHint")) + "</p>",
          detailGrid([
            [t("project"), dossier.projectName || "-"],
            [t("currentRequirement"), dossier.activeRequirementId || "-"],
            [t("reviewCount"), String(dossier.totalSessions || 0)],
            [t("generatedAt"), dossier.generatedAt || "-"]
          ])
        ].join(""));

        if (items.length === 0) {
          container.innerHTML = summaryCard + emptyState(t("noRequirementDossier"));
          return;
        }

        const cards = items.map(renderRequirementDossierItem).join("");
        container.innerHTML = summaryCard + "<div class='memory-stack'>" + cards + "</div>";
      }

      function renderRequirementDossierItem(item) {
        const sessions = item.sessions || [];
        const active = item.active ? " active" : "";
        return [
          "<div class='dossier-card" + active + "'>",
          "<div class='dossier-heading'>",
          "<h3>" + escapeHtml(item.title || "-") + "</h3>",
          item.active ? "<span class='status-pill current'>" + escapeHtml(t("activeRequirement")) + "</span>" : "",
          "</div>",
          "<p>" + escapeHtml(item.summary || "-") + "</p>",
          detailGrid([
            [t("currentRequirement"), item.requirementId || item.id || "-"],
            [t("requirementStatus"), item.status || "-"],
            [t("sessionCount"), String(item.sessionCount || 0)],
          [t("currentCount"), String(item.statusCounts?.current || 0)],
          [t("staleCount"), String(item.statusCounts?.stale || 0)],
          [t("revertedCount"), String(item.statusCounts?.reverted || 0)],
          [t("unknownCount"), String(item.statusCounts?.unknown || 0)],
          [t("sessionsOmitted"), String(item.sessionsOmitted || 0)],
          [t("latestUpdatedAt"), item.latestUpdatedAt || "-"],
          [t("restoreHint"), item.restoreHint || "-"],
          [t("nextAction"), item.nextAction || "-"]
          ]),
          "<h3>" + escapeHtml(t("keywords")) + "</h3>",
          listHtml(item.keywords?.length ? item.keywords : [t("noKeywords")]),
          "<h3>" + escapeHtml(t("keyFiles")) + "</h3>",
          listHtml(item.keyFiles?.length ? item.keyFiles : [t("noChangedFiles")]),
          "<h3>" + escapeHtml(t("reviewSessions")) + "</h3>",
          sessions.length
            ? sessions.map(renderDossierSession).join("")
            : emptyState((item.sessionsOmitted || 0) > 0
              ? t("sessionsOmitted") + ": " + String(item.sessionsOmitted)
              : t("noSessions")),
          "</div>"
        ].join("");
      }

      function renderDossierSession(session) {
        return [
          "<div class='dossier-session'>",
          "<h3>" + escapeHtml(session.title || "-") + "</h3>",
          "<p>" + escapeHtml(session.summary || "-") + "</p>",
          detailGrid([
            [t("codeStatus"), formatCodeStatus(session)],
            [t("reportPath"), session.reviewPath || "-"],
            [t("changedFiles"), session.changedFiles?.length ? session.changedFiles.join(", ") : "-"],
            [t("latestUpdatedAt"), session.updatedAt || "-"],
            [t("expiresAt"), session.expiresAt || "-"]
          ]),
          "</div>"
        ].join("");
      }

      function renderTimelineSession(session) {
        return [
          "<div class='memory-item'>",
          "<h3>" + escapeHtml(session.title || "-") + "</h3>",
          "<p>" + escapeHtml(session.summary || "-") + "</p>",
          detailGrid([
            [t("codeStatus"), formatCodeStatus(session)],
            [t("reportPath"), session.reviewPath || "-"],
            [t("changedFiles"), session.changedFiles?.length ? session.changedFiles.join(", ") : "-"],
            [t("expiresAt"), session.expiresAt || "-"]
          ]),
          "</div>"
        ].join("");
      }

      function renderReview(data) {
        document.getElementById("reviewOutput").innerHTML = [
          sectionCard(data.title, detailGrid([
            [t("currentRequirement"), data.requirement?.title || "-"],
            [t("reportPath"), data.reportPath],
            [t("memoryId"), data.memory?.id || "-"],
            [t("codeStatus"), formatCodeStatus(data.memory)],
            [t("expiresAt"), data.memory?.expiresAt || "-"]
          ])),
          sectionCard(t("summary"), "<p>" + escapeHtml(data.review?.summary || data.memory?.summary || "-") + "</p>"),
          sectionCard(t("requirementBlocks"), renderReviewRequirementBlocks(data.review?.requirementBlocks || [])),
          sectionCard(t("reviewOverview"), renderReviewOverview(data.review || {})),
          sectionCard(t("changeGroups"), renderReviewChangeGroups(data.review?.changeGroups || [])),
          sectionCard(t("review"), "<div class='review-report'>" + (data.html || "") + "</div>")
        ].join("");
      }

      function renderReviewOverview(review) {
        const overview = review.reviewOverview || {};
        return [
          overviewBlock(overview.title || t("reviewOverview"), [
            "<p>" + escapeHtml(overview.summary || review.summary || "-") + "</p>",
            detailGrid(overview.keyValues?.length ? overview.keyValues.map((item) => [item.key || "-", item.value || "-"]) : [[t("summary"), review.summary || "-"]])
          ].join("")),
          overviewBlock(t("reviewOverviewReadingOrder"), listHtml(overview.readingOrder?.length ? overview.readingOrder : ["-"])),
          overviewBlock(t("reviewOverviewBatches"), renderReviewBatches(overview.batches || [])),
          overviewBlock(t("implementationSummary"), listHtml(review.implementationSummary?.length ? review.implementationSummary : ["-"])),
          overviewBlock(t("sourceReadingGuide"), renderSourceReadingGuide(review.sourceReadingGuide || [])),
          overviewBlock(t("reviewWalkthrough"), listHtml(review.reviewWalkthrough?.length ? review.reviewWalkthrough : ["-"])),
          overviewBlock(t("risks"), listHtml(review.risks?.length ? review.risks : ["-"])),
          overviewBlock(t("testSuggestions"), listHtml(review.testSuggestions?.length ? review.testSuggestions : ["-"]))
        ].join("");
      }

      function overviewBlock(title, body) {
        return "<div class='memory-item compact'><h3>" + escapeHtml(title) + "</h3>" + body + "</div>";
      }

      function renderReviewBatches(batches) {
        if (!batches.length) {
          return emptyState(t("noRequirementBlocks"));
        }

        return "<div class='review-batch-list'>" + batches.map((batch) => [
          "<article class='review-batch-card'>",
          "<h3>" + escapeHtml(batch.title || "-") + "</h3>",
          "<p>" + escapeHtml(batch.summary || "-") + "</p>",
          detailGrid([
            [t("requirementBlockKind"), formatRequirementBlockKind(batch.kind)],
            [t("confidence"), formatGroupConfidence(batch.confidence)],
            [t("requirementBlockAction"), batch.suggestedAction || "-"],
            [t("reviewBatchSourceGroups"), batch.sourceGroupTitles?.length ? batch.sourceGroupTitles.join(", ") : "-"]
          ]),
          detailGrid((batch.keyValues || []).map((item) => [item.key || "-", item.value || "-"])),
          "<h3>" + escapeHtml(t("changedFiles")) + "</h3>",
          listHtml((batch.files || []).map((file) => file.path + " (+" + file.additions + " / -" + file.deletions + ")")),
          "</article>"
        ].join("")).join("") + "</div>";
      }

      function renderSourceReadingGuide(items) {
        if (!items.length) {
          return listHtml(["-"]);
        }

        return items.map((item) => [
          "<div class='memory-item compact'>",
          "<h3>" + escapeHtml(item.path || "-") + "</h3>",
          detailGrid([
            [t("reason"), item.reason || "-"],
            [t("command"), item.command || "-"]
          ]),
          "</div>"
        ].join("")).join("");
      }

      function renderReviewRequirementBlocks(blocks) {
        if (!blocks.length) {
          return emptyState(t("noRequirementBlocks"));
        }

        return blocks.map((block) => [
          "<div class='memory-item'>",
          "<h3>" + escapeHtml(block.title || "-") + "</h3>",
          "<p>" + escapeHtml(block.summary || "-") + "</p>",
          detailGrid([
            [t("requirementBlockKind"), formatRequirementBlockKind(block.kind)],
            [t("confidence"), formatGroupConfidence(block.confidence)],
            [t("requirementBlockAction"), block.suggestedAction || "-"]
          ]),
          detailGrid((block.keyValues || []).map((item) => [item.key || "-", item.value || "-"])),
          "<h3>" + escapeHtml(t("requirementBlockEvidence")) + "</h3>",
          listHtml(block.evidence?.length ? block.evidence : ["-"]),
          "<h3>" + escapeHtml(t("changedFiles")) + "</h3>",
          listHtml((block.files || []).map((file) => file.path + " (+" + file.additions + " / -" + file.deletions + ")")),
          "<h3>" + escapeHtml(t("reviewFocus")) + "</h3>",
          listHtml(block.reviewFocus?.length ? block.reviewFocus : ["-"]),
          "<h3>" + escapeHtml(t("groupTestSuggestions")) + "</h3>",
          listHtml(block.testSuggestions?.length ? block.testSuggestions : ["-"]),
          "</div>"
        ].join("")).join("");
      }

      function renderReviewChangeGroups(groups) {
        if (!groups.length) {
          return emptyState(t("noChangeGroups"));
        }

        return groups.map((group) => [
          "<div class='memory-item'>",
          "<h3>" + escapeHtml(group.title || "-") + "</h3>",
          "<p>" + escapeHtml(group.purpose || "-") + "</p>",
          "<p class='muted'>" + escapeHtml(t("groupMatchReason")) + ": " + escapeHtml(group.matchReason || "-") + "</p>",
          "<p class='muted'>" + escapeHtml(t("groupConfidence")) + ": " + escapeHtml(formatGroupConfidence(group.confidence)) + "</p>",
          detailGrid((group.keyValues || []).map((item) => [item.key || "-", item.value || "-"])),
          "<h3>" + escapeHtml(t("changedFiles")) + "</h3>",
          listHtml((group.files || []).map((file) => file.path + " (+" + file.additions + " / -" + file.deletions + ")")),
          "<h3>" + escapeHtml(t("reviewFocus")) + "</h3>",
          listHtml(group.reviewNotes?.length ? group.reviewNotes : ["-"]),
          "<h3>" + escapeHtml(t("groupTestSuggestions")) + "</h3>",
          listHtml(group.testSuggestions?.length ? group.testSuggestions : ["-"]),
          "</div>"
        ].join("")).join("");
      }

      function renderRecall(data) {
        const sessions = data.sessions || [];
        document.getElementById("recallOutput").innerHTML = sessions.length
          ? sessions.map((session) => sectionCard(session.title, [
              detailGrid([
                [t("currentRequirement"), session.requirementTitle || "-"],
                [t("memoryId"), session.id],
                [t("codeStatus"), formatCodeStatus(session)],
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

      function statusTitle(status) {
        if (status === "clean") {
          return t("recordingClean");
        }
        if (status === "recorded") {
          return t("recordingRecorded");
        }
        if (status === "changed-after-record") {
          return t("recordingChanged");
        }
        return t("recordingUnrecorded");
      }

      function renderHandoff(data) {
        const handoff = data.handoff || data;
        const sessions = handoff.sessions || [];
        document.getElementById("handoffOutput").innerHTML = [
          sectionCard(t("handoff"), [
            detailGrid([
              [t("project"), handoff.projectName || "-"],
              [t("currentRequirement"), handoff.requirementTitle || "-"],
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
                  [t("codeStatus"), formatCodeStatus(session)],
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
            "<button class='btn' data-marketplace-preview='" + escapeHtml(skill.id) + "'>" + escapeHtml(t("previewSkillContent")) + "</button>",
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
        const buttons = [
          "<button class='btn primary' data-action='apply' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionEnable")) + "</button>",
          "<button class='btn warn' data-action='disable' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionDisable")) + "</button>",
          "<button class='btn danger' data-action='ignore' data-type='" + type + "' data-id='" + id + "'>" + escapeHtml(t("actionIgnore")) + "</button>"
        ];
        if (type === "skill") {
          buttons.unshift("<button class='btn' data-skill-detail='" + id + "'>" + escapeHtml(t("viewSkillDetail")) + "</button>");
        }
        return buttons.join("");
      }

      function renderSkillDetail(detail) {
        const item = detail.item || {};
        document.getElementById("skillDetailOutput").innerHTML = [
          sectionCard(t("skillDetail"), detailGrid([
            [t("name"), item.name || "-"],
            [t("source"), item.source || "-"],
            [t("risk"), item.risk ? t("risk_" + item.risk) : "-"],
            [t("path"), item.skillPath || "-"]
          ])),
          sectionCard(t("summary"), "<p>" + escapeHtml(item.description || "-") + "</p>"),
          sectionCard(t("keywords"), listHtml(item.tags?.length ? item.tags : [t("noKeywords")])),
          sectionCard(t("skillContent"), "<div class='codebox'>" + escapeHtml(detail.content || "") + "</div>")
        ].join("");
      }

      function renderMarketplaceSkillPreview(preview) {
        const skill = preview.skill || {};
        document.getElementById("skillDetailOutput").innerHTML = [
          sectionCard(t("skillDetail"), detailGrid([
            [t("name"), skill.name || "-"],
            [t("source"), skill.author || "-"],
            [t("contentSource"), preview.contentSource || "-"],
            [t("path"), skill.path || "-"]
          ])),
          sectionCard(t("summary"), "<p>" + escapeHtml(skill.description || "-") + "</p>"),
          sectionCard(t("skillContent"), "<div class='codebox'>" + escapeHtml(preview.content || "") + "</div>")
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

      function formatCodeStatus(item) {
        const status = item?.codeStatus || "unknown";
        const reason = item?.codeStatusReason || "-";
        return status + " - " + reason;
      }

      function formatGroupConfidence(confidence) {
        if (confidence === "high") {
          return state.locale === "zh-CN" ? "高" : "High";
        }
        if (confidence === "medium") {
          return state.locale === "zh-CN" ? "中" : "Medium";
        }
        if (confidence === "low") {
          return state.locale === "zh-CN" ? "低" : "Low";
        }
        return "-";
      }

      function formatRequirementBlockKind(kind) {
        const zh = {
          "current-work": "当前需求",
          "historical-requirement": "历史需求",
          "functional-area": "功能域候选",
          "carried-work": "旧改动"
        };
        const en = {
          "current-work": "Current task",
          "historical-requirement": "Historical requirement",
          "functional-area": "Functional candidate",
          "carried-work": "Carried changes"
        };
        return (state.locale === "zh-CN" ? zh : en)[kind] || kind || "-";
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
          document.querySelectorAll("[data-view-button]").forEach((node) => {
            node.classList.remove("active");
            node.setAttribute("aria-pressed", "false");
          });
          document.querySelectorAll(".view").forEach((node) => {
            node.classList.remove("active");
            node.setAttribute("aria-hidden", "true");
          });
          button.classList.add("active");
          button.setAttribute("aria-pressed", "true");
          const nextView = document.getElementById(view);
          nextView.classList.add("active");
          nextView.setAttribute("aria-hidden", "false");
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

        const skillDetailId = button.dataset.skillDetail;
        if (skillDetailId) {
          try {
            setStatus("loadingSkillDetail");
            const detail = await api("/api/skills/" + encodeURIComponent(skillDetailId));
            renderSkillDetail(detail);
            setStatus("ready");
          } catch (error) {
            showToast(error.message);
            setStatus("error");
          }
        }

        const marketplacePreviewId = button.dataset.marketplacePreview;
        if (marketplacePreviewId && state.marketplaceSkills?.candidates) {
          const skill = state.marketplaceSkills.candidates.find((item) => item.id === marketplacePreviewId);
          if (!skill) {
            return;
          }

          try {
            setStatus("loadingSkillDetail");
            const preview = await api("/api/marketplace/skills/preview", {
              method: "POST",
              body: JSON.stringify({ repoPath: repoInput.value, skill })
            });
            renderMarketplaceSkillPreview(preview);
            setStatus("ready");
          } catch (error) {
            showToast(error.message);
            setStatus("error");
          }
        }

        const marketplaceSkillId = button.dataset.marketplaceApply;
        if (marketplaceSkillId && state.marketplaceSkills?.candidates) {
          const skill = state.marketplaceSkills.candidates.find((item) => item.id === marketplaceSkillId);
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
        if (marketplaceMcpId && state.marketplaceMcps?.candidates) {
          const mcp = state.marketplaceMcps.candidates.find((item) => item.id === marketplaceMcpId);
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

        if (button.id === "recordCurrentDiffButton") {
          try {
            setStatus("recordingCurrentDiff");
            const title = document.getElementById("reviewTitle").value.trim();
            const data = await api("/api/record-current-diff", {
              method: "POST",
              body: JSON.stringify({
                repoPath: repoInput.value,
                title: title || undefined,
                requirementId: activeRequirementId() || undefined
              })
            });
            renderReview(data);
            renderRecordingStatus(data.recordingStatus);
            renderWorkSegments(data.workSegments);
            renderTimeline(data.timeline);
            renderRequirementDossier(data.requirementDossier);
            await loadDashboard();
            showToast(t("reviewSaved"));
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
      requirementSelect.addEventListener("change", async () => {
        if (!requirementSelect.value) {
          return;
        }

        try {
          setStatus("updating");
          await api("/api/requirements/active", {
            method: "POST",
            body: JSON.stringify({ repoPath: repoInput.value, id: requirementSelect.value })
          });
          await loadDashboard();
          showToast(t("requirementActivated"));
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
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
      document.getElementById("createRequirementButton").addEventListener("click", async () => {
        const title = requirementTitleInput.value.trim();
        if (!title) {
          showToast(t("requirementTitlePlaceholder"));
          return;
        }

        try {
          setStatus("updating");
          await api("/api/requirements", {
            method: "POST",
            body: JSON.stringify({
              repoPath: repoInput.value,
              title,
              keywords: title.split(/\\s+/).filter(Boolean)
            })
          });
          requirementTitleInput.value = "";
          await loadDashboard();
          showToast(t("requirementCreated"));
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
        const [config, llmConfig] = await Promise.all([
          api("/api/mcp-inspect?repo=" + encodeURIComponent(repoInput.value)),
          api("/api/llm-config")
        ]);
        renderConnect(config);
        renderLlmConfig(llmConfig);
      });
      document.getElementById("prepareTaskButton").addEventListener("click", async () => {
        const task = document.getElementById("taskInput").value.trim();
        if (!task) {
          showToast(t("taskPlaceholder"));
          return;
        }

        try {
          setStatus("preparingTask");
          const data = await api("/api/prepare", {
            method: "POST",
            body: JSON.stringify({ repoPath: repoInput.value, task })
          });
          renderPreparedTask(data);
          setStatus("ready");
          showToast(t("taskPrepared"));
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
      });
      document.getElementById("marketplaceSearchButton").addEventListener("click", async () => {
        const keyword = document.getElementById("marketplaceKeywordInput").value.trim();
        setStatus("searchingMarketplace");
        const data = await api("/api/marketplace/skills?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        state.marketplaceSkills = data;
        renderMarketplaceSkills(data);
        setStatus("ready");
      });
      document.getElementById("marketplaceMcpSearchButton").addEventListener("click", async () => {
        const keyword = document.getElementById("marketplaceMcpKeywordInput").value.trim();
        setStatus("searchingMarketplaceMcp");
        const data = await api("/api/marketplace/mcps?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
        state.marketplaceMcps = data;
        renderMarketplaceMcps(data);
        setStatus("ready");
      });
      document.getElementById("reviewButton").addEventListener("click", async () => {
        try {
          setStatus("creatingReview");
          const title = document.getElementById("reviewTitle").value.trim();
          const data = await api("/api/review", {
            method: "POST",
            body: JSON.stringify({
              repoPath: repoInput.value,
              title: title || undefined,
              requirementId: activeRequirementId() || undefined
            })
          });
          renderReview(data);
          if (data.recordingStatus) {
            renderRecordingStatus(data.recordingStatus);
          }
          if (data.workSegments) {
            renderWorkSegments(data.workSegments);
          }
          if (data.timeline) {
            renderTimeline(data.timeline);
          }
          if (data.requirementDossier) {
            renderRequirementDossier(data.requirementDossier);
          }
          await loadDashboard();
          showToast(t("reviewSaved"));
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
      });
      document.getElementById("digestButton").addEventListener("click", async () => {
        try {
          setStatus("loadingMemory");
          const [digest, dossier] = await Promise.all([
            api("/api/memory-digest?repo=" + encodeURIComponent(repoInput.value)),
            api("/api/requirement-dossier?repo=" + encodeURIComponent(repoInput.value))
          ]);
          renderMemoryDigest(digest);
          renderRequirementDossier(dossier);
          setStatus("ready");
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
      });
      document.getElementById("recallButton").addEventListener("click", async () => {
        try {
          setStatus("loadingMemory");
          const keyword = document.getElementById("keywordInput").value.trim();
          const data = await api("/api/recall?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword) + "&requirementId=" + encodeURIComponent(activeRequirementId()));
          renderRecall(data);
          setStatus("ready");
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
      });
      document.getElementById("handoffButton").addEventListener("click", async () => {
        try {
          setStatus("loadingMemory");
          const keyword = document.getElementById("keywordInput").value.trim();
          const data = await api("/api/handoff?repo=" + encodeURIComponent(repoInput.value) + "&keyword=" + encodeURIComponent(keyword));
          renderHandoff(data);
          setStatus("ready");
          showToast(t("handoffReady"));
        } catch (error) {
          showToast(error.message);
          setStatus("error");
        }
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
