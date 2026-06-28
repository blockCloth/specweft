# SpecWeft Finish

Project: specweft-monorepo
Invocation: `/specweft-finish`

Use this prompt before handing work back to the user.

Call `specweft.get_recording_status`. If the diff is unrecorded or changed after the last record, call `specweft.record_current_diff`. Then provide a compact finish summary.

Use SpecWeft MCP tools. Do not reimplement this workflow with shell commands unless MCP is unavailable.
