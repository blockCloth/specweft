---
name: specweft-prepare-task
description: Use before planning or editing any coding request in this repository. It clarifies vague requirements, locates relevant files, recommends task Skills, and restores only relevant memory through SpecWeft MCP.
---

# specweft-prepare-task

Project: specweft-monorepo

Use this skill when a user gives a coding request, especially when the request is vague, continues older work, mentions a prior requirement, or may need project-specific rules.

Workflow:
1. Call `specweft.prepare_task` with the user's request before editing files.
2. If the result has `missingQuestions`, ask the user unless the answer is obvious from the repository.
3. If the result has `matchedRequirement` or `memorySuggestions`, call `specweft.restore_requirement` for the best matching requirement instead of loading all memory.
4. Read `guardrail.startWorkSegmentInput` and `guardrail.recordCurrentDiffInput`; use these exact inputs later instead of inventing your own requirement id or title.
5. Read the returned `codePointers`, `skillSuggestions`, and `executionPlan` before deciding where to edit.
6. Treat `skillContext` as the source of truth for this task. Read full Skill content only through `specweft.read_skill_detail` when the Skill is still listed in `skillContext.allowedSkillIds` and the selection revision matches.
7. Prefer local `AGENTS.md` / `CLAUDE.md` rules over marketplace Skills when guidance conflicts.

If a later request has a new `skillContext.selectionRevision` or a different `allowedSkillIds` list, discard previously loaded Skill content.
Do not install marketplace MCP servers automatically. Treat MCP recommendations as optional external integrations.

Required MCP tools:
- `specweft.prepare_task`
- `specweft.get_memory_digest`
- `specweft.restore_requirement`
- `specweft.recommend_skills_for_task`
- `specweft.get_skill_context_index`
- `specweft.read_skill_detail`
- `specweft.bootstrap_session`
- `specweft.get_recording_status`
- `specweft.start_work_segment`
- `specweft.get_requirement_dossier`
- `specweft.review_current_diff`
- `specweft.record_current_diff`
