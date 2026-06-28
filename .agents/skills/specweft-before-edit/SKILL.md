---
name: specweft-before-edit
description: Use immediately before modifying code in a SpecWeft-enabled repository. It creates a lightweight work boundary so mixed diffs can be explained and remembered by requirement.
---

# specweft-before-edit

Project: specweft-monorepo

Use this skill after task preparation and before applying edits.

Workflow:
1. Call `specweft.get_recording_status` to understand whether the current diff is already recorded.
2. Call `specweft.start_work_segment` with the exact `guardrail.startWorkSegmentInput` returned by `specweft.prepare_task`.
3. If there are existing uncommitted changes, keep them separate in your explanation and avoid treating them as part of the new task unless the user says so.

This skill does not replace normal code review. It only marks the local boundary that makes later review readable.

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
