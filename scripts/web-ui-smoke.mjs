import { renderApp } from "../packages/web/dist/ui.js";

const html = renderApp("/tmp/specweft-smoke-project");

assertIncludes(html, "data-view-button=\"overview\"", "overview navigation is missing");
assertIncludes(html, "data-view-button=\"review\"", "review navigation is missing");
assertIncludes(html, "aria-pressed=\"true\"", "active navigation button should expose aria-pressed");
assertIncludes(html, "data-view=\"overview\"", "overview view contract is missing");
assertIncludes(html, "data-view=\"review\"", "review view contract is missing");
assertIncludes(html, "aria-hidden=\"true\"", "inactive views should expose aria-hidden");
assertIncludes(html, "id=\"prepareTaskButton\"", "prepare task button is missing");
assertIncludes(html, "id=\"reviewButton\"", "review button is missing");
assertIncludes(html, "id=\"digestButton\"", "memory digest button is missing");
assertIncludes(html, "id=\"requirementDossierOutput\"", "requirement dossier output is missing");
assertIncludes(html, "renderRequirementDossier", "requirement dossier renderer is missing");
assertIncludes(html, "renderMatchedRequirement", "matched requirement renderer is missing");
assertIncludes(html, "executionPlan", "execution plan renderer or i18n key is missing");
assertIncludes(html, "creatingReview", "review loading state is missing");
assertIncludes(html, "loadingMemory", "memory loading state is missing");
assertIncludes(html, "networkFailed", "network error message is missing");
assertIncludes(html, "response.text()", "api helper should handle non-JSON error bodies");
assertIncludes(html, "formatGroupConfidence", "review confidence formatter is missing");
assertIncludes(html, "requirementSections", "review digest requirement sections should be rendered");
assertIncludes(html, "requirementBlocks", "review requirement block renderer or i18n key is missing");
assertIncludes(html, "renderReviewRequirementBlocks", "review requirement block renderer is missing");
assertIncludes(html, "formatRequirementBlockKind", "review requirement block kind formatter is missing");
assertIncludes(html, "reviewOverview", "review overview section should be rendered");
assertIncludes(html, "reviewOverviewBatches", "review batch overview i18n key is missing");
assertIncludes(html, "renderReviewBatches", "review batch renderer is missing");
assertIncludes(html, "reviewBatchSourceGroups", "review batch source group label is missing");
assertIncludes(html, "sourceReadingGuide", "advanced source details should be rendered outside the raw report");
assertIncludes(html, "reviewFocus", "review group focus notes should be rendered");
assertIncludes(html, "groupTestSuggestions", "review group verification suggestions should be rendered");
assertIncludes(html, "codexConfig", "connect view should render Codex config snippets");
assertIncludes(html, "claudeConfig", "connect view should render Claude config snippets");
assertNotIncludes(html, "currentLocale", "stale currentLocale reference should not ship");
assertNotIncludes(html, "await response.json()", "api helper should not assume every response is JSON");

process.stdout.write("Web UI smoke passed\n");

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
