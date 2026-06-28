---
name: specweft-after-edit-review
description: Use after changing code in this repository. It records the current diff, generates a human-readable review explanation, closes the active work segment, and saves short-lived requirement memory.
---

# specweft-after-edit-review

Project: specweft-monorepo

Use this skill whenever code was modified by the agent.

Workflow:
1. Call `specweft.get_recording_status` after edits.
2. If the status is `unrecorded` or `changed-after-record`, call `specweft.record_current_diff` with the exact `guardrail.recordCurrentDiffInput` from task preparation when available.
3. Summarize the generated `agentReview.suggestedAgentResponse` for the user; do not paste the full `advancedReview` unless asked.
4. If the user only asks for a temporary explanation without saving memory, call `specweft.review_current_diff` instead.

Never finish a coding turn with an unrecorded or changed-after-record diff unless the user explicitly asks you not to record it.

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
