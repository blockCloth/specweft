# SpecWeft Continue

Project: specweft-monorepo
Invocation: `/specweft-continue <keyword>`

Use this prompt when continuing old work or switching back to a previous requirement.

Call `specweft.get_memory_digest`, then `specweft.get_requirement_dossier`, then `specweft.restore_requirement` with the user's keyword. Explain the recovered requirement before editing.

Use SpecWeft MCP tools. Do not reimplement this workflow with shell commands unless MCP is unavailable.
