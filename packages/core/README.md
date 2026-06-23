# @specweft/core

Core library for SpecWeft.

It contains the project scanner, MCP/Skill pool, capability recommendation,
runtime assembly, task preparation, code review explanation, work segments,
and requirement-scoped memory.

Most users should install the CLI instead:

```bash
npm install -g specweft
```

Use this package directly only when you are building a custom SpecWeft
integration or testing one of the lower-level flows.

```ts
import {
  createReviewReport,
  prepareTask,
  scanProject,
} from "@specweft/core";

const repoPath = process.cwd();
const profile = await scanProject(repoPath);

const prepared = await prepareTask(repoPath, "帮我优化登录校验");

const report = await createReviewReport(
  repoPath,
  profile,
  prepared.requirement.clarifiedGoal,
);

console.log(report.review.reviewOverview.title);
```

## Notes

- The public API is still young. Prefer the CLI for normal use.
- SpecWeft stores project-local state under `.specweft/`.
- Global MCP and Skill pool files live under the configured SpecWeft home.
- Review works without an LLM key; optional LLM review is layered on top of the
  rule-based output.

See the repository README for full documentation.
