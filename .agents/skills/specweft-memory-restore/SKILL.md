---
name: specweft-memory-restore
description: Use when the user asks to continue, resume, recall, compare, or revisit older work. It reads the memory digest first, then restores only the relevant requirement memory.
---

# specweft-memory-restore

Project: specweft-monorepo

Use this skill when the user refers to previous work, an old feature, a missing thread, a rollback, or a requirement by keyword.

Workflow:
1. Call `specweft.get_memory_digest` to see the lightweight requirement-grouped memory entry point.
2. Call `specweft.get_requirement_dossier` when the user needs a human-readable map of previous review sessions.
3. Call `specweft.restore_requirement` with the best keyword or requirement id.
4. Explain which recovered memory matters before editing new code.

Do not paste the full memory history into context. Restore the smallest relevant requirement slice.

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
