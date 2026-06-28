<!-- SPECWEFT:START -->
# SpecWeft Agent Instructions

Project: specweft-monorepo

When this project is opened in Codex, Claude, or another MCP-compatible coding agent:

1. At the beginning of a coding session, call `specweft.bootstrap_session` once.
2. Read `specweft.get_memory_digest` and `specweft.get_requirement_dossier` as the long-term memory entry points. Restore only the relevant requirement, never the entire history.
3. Before planning or editing a user request, call `specweft.prepare_task` with the user's natural language task.
4. If `prepare_task` returns `missingQuestions`, ask the user unless the answer is obvious from the repository.
5. If `prepare_task` returns relevant memories, call `specweft.restore_requirement` for the best match instead of loading every memory.
6. Before editing, call `specweft.start_work_segment` with `prepare_task.guardrail.startWorkSegmentInput`, so mixed uncommitted diffs can be separated by request boundary.
7. Use `prepare_task.skillContext` as the only valid Skill context for the current request. Do not rely on Skill content loaded for earlier requests unless the latest `selectionRevision` and `allowedSkillIds` still allow it.
8. Read full Skill content only with `specweft.read_skill_detail` and the latest `selectionRevision`; otherwise keep Skills metadata-only.
9. Use `specweft.recommend_skills_for_task` for task-specific Skill routing. Treat MCP recommendations as optional, not required.
10. Call `specweft.get_recording_status` before and after edits; never finish with an unrecorded or changed-after-record diff.
11. After changing code, call `specweft.record_current_diff` with `prepare_task.guardrail.recordCurrentDiffInput`, then use `agentReview.suggestedAgentResponse` for the user-facing explanation.
12. Do not install marketplace MCPs or Skills automatically when they require credentials, network access, database access, or conflict with local rules.

<!-- SPECWEFT:END -->
