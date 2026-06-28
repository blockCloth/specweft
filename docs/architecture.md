# SpecWeft Architecture

SpecWeft is intentionally split into stable layers:

```text
CLI / Web / MCP adapters
        |
  Agent Harness templates
        |
      Core
        |
Scanner / Pool / Capability Center / Recommender / Diff / Memory / Policy
        |
Global ~/.specweft pools + local project .specweft storage
```

The rule is simple:

- adapters handle user interaction
- core owns product behavior
- storage stays local-first

This keeps the CLI, Web UI, and MCP server on the same behavior model. Desktop and editor-plugin packaging are intentionally out of scope for the current version.

## Agent Harness Layer

SpecWeft treats CLI commands and MCP tools as the stable capability layer. Agent Harness files are the project-local UX layer that lets Codex and Claude discover the right workflow without making the user remember every command.

`specweft init` writes:

```text
.agents/skills/specweft-*/SKILL.md
.codex/skills/specweft-*/SKILL.md
.codex/prompts/specweft-*.md
.claude/skills/specweft-*/SKILL.md
.claude/commands/specweft/*.md
```

The Harness layer has three jobs:

```text
auto-trigger Skills -> tell the agent when to call prepare/restore/record tools
manual prompts/commands -> give the user short review/continue/restore/finish entry points
shared .agents skills -> keep cross-client behavior in one readable place
```

It must not duplicate business logic. A Skill or command should name the trigger, call order, and output expectation. The tested behavior still lives in `@specweft/core`, and the live execution still goes through the SpecWeft MCP tools.

The Web overview renders an Agent bootstrap context panel from the same `createBootstrapSession` data that backs `specweft.bootstrap_session`. This is intentionally user-visible: a beginner can see the exact project profile, runtime assembly, workflow, and memory digest that Codex or Claude should read when a thread starts.

## MCP Adapter

The MCP adapter lives in:

```text
packages/cli/src/mcp/server.ts
packages/cli/src/mcp/tools.ts
```

It wraps core functions as MCP tools:

```text
specweft.prepare_task
specweft.get_memory_index
specweft.get_memory_digest
specweft.restore_requirement
specweft.recommend_skills_for_task
specweft.bootstrap_session
specweft.get_project_profile
specweft.recommend_project_tools
specweft.get_capability_center
specweft.get_runtime_assembly
specweft.get_recording_status
specweft.start_work_segment
specweft.get_work_segment_status
specweft.complete_work_segment
specweft.get_memory_timeline
specweft.get_requirement_dossier
specweft.review_current_diff
specweft.record_current_diff
specweft.save_session_memory
specweft.recall_sessions
specweft.create_memory_handoff
specweft.recommend_marketplace_mcps
specweft.install_marketplace_mcp
specweft.recommend_marketplace_skills
specweft.install_marketplace_skill
specweft.apply_project_mcp
specweft.apply_project_skill
```

The MCP layer should not own business logic. It should only:

```text
parse tool input
call @specweft/core
return JSON text results
```

## Task Preparation Flow

The primary product flow is now task-first, not MCP-first:

```text
user request
  -> specweft.prepare_task
  -> clarified goal
  -> step-by-step execution plan
  -> likely files
  -> task-specific Skill suggestions
  -> lightweight memory matches
  -> guardrail.startWorkSegmentInput
  -> guardrail.recordCurrentDiffInput
  -> agent instructions
```

`prepare_task` lives in:

```text
packages/core/src/task/task-preparer.ts
```

It stays rule-based in v1 so the result is explainable and works without an LLM key. The `guardrail` field is intentionally structured JSON: agents should pass those exact inputs to `specweft.start_work_segment` before editing and `specweft.record_current_diff` after editing, instead of reconstructing requirement ids or titles from prose. The MCP marketplace is optional enrichment; it should not be required for the normal beginner workflow.

## Memory Index And Restore

Memory is intentionally split into a small index and on-demand restoration:

```text
.specweft/memory.json
  -> specweft.get_memory_digest
  -> requirement/thread summaries, key files, status counts, restore hints
  -> specweft.get_memory_index
  -> memory titles, keywords, files, restore hints
  -> specweft.restore_requirement only for the relevant match
```

The digest is the default long-term memory entrance. The index is still available for recent raw entries. This prevents long-running projects from pushing every historical review into the agent context. Full review reports stay available by path, but the default context only gets summaries and restore handles.

## Memory Protection

Requirement memory can be protected with a local key:

```text
SPECWEFT_MEMORY_KEY
  -> AES-256-GCM secure JSON
  -> .specweft/memory.json
  -> .specweft/requirements.json
  -> .specweft/work-segments.json
  -> .specweft/agent-activity.json
```

The protection layer is optional in v1. Without a key, these files remain readable JSON for easier debugging. When the key is configured, secure JSON is used automatically for future writes, and `specweft protect` migrates existing plaintext state. Markdown review reports stay plaintext by design in v1 because they are the primary human review artifact.

## Work Segments

Work segments are lightweight request boundaries for uncommitted changes:

```text
specweft.prepare_task
  -> guardrail.startWorkSegmentInput
  -> specweft.start_work_segment
  -> code edits
  -> guardrail.recordCurrentDiffInput
  -> specweft.record_current_diff
  -> segment closes with reviewPath + memoryId
```

They are stored in `.specweft/work-segments.json`. A segment records the start snapshot, end snapshot, active requirement, baseline changed files, new changed files, and carried files. It does not store full patch text. This gives Codex and Claude a way to tell whether a file changed during the current request or was already dirty before the request began. If a new segment starts while another is active, the old one is marked `interrupted` instead of being silently overwritten.

## Current Storage Model

Global pools:

```text
~/.specweft/projects.json
~/.specweft/mcp/registry.json
~/.specweft/mcp/manifests/*.json
~/.specweft/skills/registry.json
~/.specweft/skills/<skill-id>/SKILL.md
```

## Capability Center

Capability Center is the unified read model for agent abilities:

```text
MCP pool + Skill pool + built-in CLI capability templates
        |
        -> capability manifest list
        -> status, risk, permissions, auth needs, install/run command
```

MCP and Skill capabilities can be enabled for a project. CLI capabilities are currently recommendation-only: SpecWeft shows install and run commands, but it does not execute them automatically.

Project storage:

```text
.specweft/profile.json
.specweft/mcp.json
.specweft/skills.json
.specweft/requirements.json
.specweft/work-segments.json
.specweft/memory.json
.specweft/reports/*.md
.specweft/reports/<requirement-id>/*.md
```

The global pools answer “what is available”. Project storage answers “what this project selected”.

Marketplace Skills follow the same split:

```text
skillsmp candidate -> ~/.specweft/skills/<skill-id>/SKILL.md
                  -> .specweft/skills.json
```

The Skill body is installed once into the global pool. Each project only stores an enabled/disabled/ignored selection. `pool init` updates built-in entries but keeps marketplace and manual entries.

Marketplace MCPs follow the same shape:

```text
curated/GitHub candidate -> ~/.specweft/mcp/manifests/<mcp-id>.json
                        -> .specweft/mcp.json
                        -> runtime assembly
```

The MCP manifest stores runtime details, permissions, env var names, and risk level. SpecWeft can assemble both stdio and remote MCP configs, but it does not write global Codex or Claude settings directly.

## Review And Memory Flow

The review feature now creates three artifacts from one command:

```text
git diff -> active requirement -> active work segment -> structured review draft -> markdown report
                              |
                              -> escaped HTML report
                              |
                              -> requirement-scoped session memory
                              -> closes work segment with reviewPath + memoryId
```

The CLI prints a context-first review digest as readable Chinese text: requirement context, one-line summary, requirement/feature sections, why it changed, implementation approach, reading entries, notes, and validation. The Web UI shows the same digest first and keeps the detailed HTML report behind an advanced section, so users are not forced through low-level source evidence or batch-level data for routine review.

The MCP tool `specweft.review_current_diff` returns a compact diff summary and an `agentReview` packet first. `agentReview` contains the review digest, requirement/feature sections, read-first files, suggested agent response, and next actions. The full structured review is still available as `advancedReview`, but agents should only use it when the user asks for deeper evidence. Full patch text is intentionally omitted from MCP output, so routine review calls do not consume the whole model context.

When an active work segment exists, review generation uses its start snapshot to explain which changed files are new to the current request and which files were already dirty before the segment began. This does not replace requirement or functional grouping; it adds a second axis for review so users can separate “this request changed it” from “this file was already in the working tree”.

Review grouping is intentionally explainable. A single uncommitted diff can contain several user requests, but git does not retain the order or boundary of those edits. SpecWeft first turns the grouped files into requirement blocks, so users see “current request”, “historical requirement”, “functional candidate”, or “carried changes” before reading individual files. Under that layer, files are grouped by the strongest available signals: requirement memory, strong file overlap, useful path keywords, functional area, and module path. Functional areas cover Web UI, task preparation, memory/dossier, review reports, requirements, recording, CLI runtime, MCP server, bootstrap, capability management, and verification. Low-signal shared files such as `package.json`, `index.ts`, and `types.ts` are treated as weak evidence, so an old broad memory cannot swallow a new mixed diff by itself. Each group carries a grouping reason and confidence so the user can quickly decide whether the split is trustworthy or should be reviewed manually.

The markdown report is kept on disk for durable local review. New reports are stored under the active requirement directory when a requirement exists. The session memory is for future recall when a user opens a new thread and wants to recover the previous requirement context.
