# SpecWeft Architecture

SpecWeft is intentionally split into stable layers:

```text
CLI / Web / MCP adapters
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
  -> agent instructions
```

`prepare_task` lives in:

```text
packages/core/src/task/task-preparer.ts
```

It stays rule-based in v1 so the result is explainable and works without an LLM key. The MCP marketplace is optional enrichment; it should not be required for the normal beginner workflow.

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

## Work Segments

Work segments are lightweight request boundaries for uncommitted changes:

```text
specweft.prepare_task
  -> specweft.start_work_segment
  -> code edits
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

The CLI prints the structured review as readable Chinese text. The Web UI renders the escaped HTML report directly, so the browser does not need to parse Markdown or inspect JSON.

The MCP tool `specweft.review_current_diff` returns a compact diff summary, changed files, code snapshot, requirement blocks, and a structured review draft. It intentionally omits the full patch text by default, because coding agents should first use the requirement split, source reading guide, and only inspect exact hunks when needed. This keeps routine review calls from consuming the whole model context.

When an active work segment exists, review generation uses its start snapshot to explain which changed files are new to the current request and which files were already dirty before the segment began. This does not replace requirement or functional grouping; it adds a second axis for review so users can separate “this request changed it” from “this file was already in the working tree”.

Review grouping is intentionally explainable. A single uncommitted diff can contain several user requests, but git does not retain the order or boundary of those edits. SpecWeft first turns the grouped files into requirement blocks, so users see “current request”, “historical requirement”, “functional candidate”, or “carried changes” before reading individual files. Under that layer, files are grouped by the strongest available signals: requirement memory, strong file overlap, useful path keywords, functional area, and module path. Functional areas cover Web UI, task preparation, memory/dossier, review reports, requirements, recording, CLI runtime, MCP server, bootstrap, capability management, and verification. Low-signal shared files such as `package.json`, `index.ts`, and `types.ts` are treated as weak evidence, so an old broad memory cannot swallow a new mixed diff by itself. Each group carries a grouping reason and confidence so the user can quickly decide whether the split is trustworthy or should be reviewed manually.

The markdown report is kept on disk for durable local review. New reports are stored under the active requirement directory when a requirement exists. The session memory is for future recall when a user opens a new thread and wants to recover the previous requirement context.
