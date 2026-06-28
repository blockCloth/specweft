# SpecWeft Review

Project: specweft-monorepo
Invocation: `/specweft-review`

Use this prompt after code has changed.

Call `specweft.record_current_diff` with a concise title. Then explain the saved report in plain language:
- what changed
- where to start reading source code
- risks
- tests or checks to run

Use SpecWeft MCP tools. Do not reimplement this workflow with shell commands unless MCP is unavailable.
