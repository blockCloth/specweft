

<!-- SPECWEFT:START -->
# SpecWeft Agent Instructions

Project: specweft-monorepo

When this project is opened in Codex, Claude, or another MCP-compatible coding agent:

1. At the beginning of a coding session, call `specweft.bootstrap_session` once.
2. Use the returned project profile, enabled MCP/Skill assembly, recommendations, and memory handoff before planning edits.
3. If the user asks to continue earlier work, call `specweft.create_memory_handoff` with the user's keyword.
4. After changing code, call `specweft.review_current_diff` and then `specweft.save_session_memory`.
5. Do not install marketplace MCPs or Skills automatically when they require credentials, network access, database access, or conflict with local rules.

<!-- SPECWEFT:END -->