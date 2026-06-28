import vm from "node:vm";
import { renderApp } from "../packages/web/dist/ui.js";

const html = renderApp("/tmp/specweft-smoke-project");
const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || "";
const staticShell = html.slice(0, html.indexOf("<script>"));
const styleShell = staticShell.slice(staticShell.indexOf("<style>"), staticShell.indexOf("</style>"));
const viewNames = ["overview", "skills", "mcp", "config", "history", "threads"];

assertInlineScriptParses(inlineScript);
assertUniqueStaticIds(staticShell);
assertIncludes(html, "SpecWeft — AI Coding Agent 本地伴侣层", "Open Design title should be preserved");
assertIncludes(styleShell, "--bg: #f7f4ef", "Open Design background color should be preserved");
assertIncludes(styleShell, "--accent: #c4612f", "Open Design accent color should be preserved");
assertIncludes(staticShell, "class=\"app-shell\"", "Open Design shell is missing");
assertIncludes(staticShell, "class=\"sidebar-header\"", "Open Design sidebar header is missing");
assertIncludes(staticShell, "class=\"project-picker\"", "Project picker is missing");
assertIncludes(staticShell, "class=\"nav-item active\" data-view-target=\"skills\"", "Skills should remain the default reference view");
assertIncludes(staticShell, "id=\"pageTitle\">Skills 管理", "Default page title should match reference UI");

for (const viewName of viewNames) {
  assertIncludes(staticShell, `id="view-${viewName}"`, `Missing ${viewName} view`);
  assertIncludes(staticShell, `id="topbarActions${capitalize(viewName)}"`, `Missing ${viewName} topbar action group`);
}

assertIncludes(staticShell, "id=\"skillTabInstalled\"", "Installed Skills tab is missing");
assertIncludes(staticShell, "id=\"skillTabRecommended\"", "Recommended Skills tab is missing");
assertIncludes(staticShell, "id=\"mcpList\"", "MCP list is missing");
assertIncludes(staticShell, "id=\"historyList\"", "History list is missing");
assertIncludes(staticShell, "id=\"threadList\"", "Thread list is missing");
assertIncludes(staticShell, "id=\"marketplaceModal\"", "Skills marketplace modal is missing");
assertIncludes(staticShell, "id=\"mcpMarketplaceModal\"", "MCP marketplace modal is missing");
assertIncludes(staticShell, "id=\"newThreadModal\"", "New thread modal is missing");
assertIncludes(staticShell, "id=\"reviewModal\"", "Review modal is missing");
assertIncludes(staticShell, "id=\"detailModal\"", "Readable detail modal is missing");
assertIncludes(inlineScript, "\"/api/dashboard/summary?repo=\"", "UI should read backend dashboard summary");
assertIncludes(inlineScript, "\"/api/task-skills\"", "UI should support demand-based Skill recommendation");
assertNotIncludes(inlineScript, "taskMarketplaceSkills", "Demand-based Skill recommendation should stay local-only");
assertIncludes(inlineScript, "\"/api/marketplace/skills", "UI should support Skill marketplace search");
assertIncludes(inlineScript, "\"/api/marketplace/mcps", "UI should support MCP marketplace search");
assertIncludes(inlineScript, "\"/api/review\"", "UI should generate readable code review summaries");
assertIncludes(inlineScript, "\"/api/restore-requirement\"", "UI should restore requirement context");
assertNotIncludes(staticShell, "<section id=\"view-tools\"", "Old tools dashboard view should not ship");
assertNotIncludes(staticShell, "<section id=\"view-runtime\"", "Old runtime package view should not ship");
assertNotIncludes(staticShell, "<section id=\"view-connect\"", "Old agent bridge page should not ship as a default UI page");
assertNotIncludes(staticShell, "raw JSON", "UI copy should not encourage reading raw JSON");

process.stdout.write("Web UI smoke passed\n");

function assertInlineScriptParses(script) {
  try {
    new vm.Script(script, { filename: "specweft-ui-inline.js" });
  } catch (error) {
    throw new Error("inline UI script should parse: " + error.message);
  }
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
}

function assertNotIncludes(value, expected, message) {
  if (value.includes(expected)) {
    throw new Error(message);
  }
}

function assertUniqueStaticIds(value) {
  const ids = [...value.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Static shell should not contain duplicate ids: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
