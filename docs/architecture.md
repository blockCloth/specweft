# SpecWeft Architecture

SpecWeft is intentionally split into stable layers:

```text
CLI / Web / MCP adapters
        |
      Core
        |
Scanner / Pool / Recommender / Diff / Memory / Policy
        |
Global ~/.specweft pools + local project .specweft storage
```

The rule is simple:

- adapters handle user interaction
- core owns product behavior
- storage stays local-first

This keeps the first CLI version compatible with later Web UI, MCP server, and desktop packaging.

## MCP Adapter

The MCP adapter lives in:

```text
packages/cli/src/mcp/server.ts
packages/cli/src/mcp/tools.ts
```

It wraps core functions as MCP tools:

```text
specweft.get_project_profile
specweft.recommend_project_tools
specweft.get_runtime_assembly
specweft.review_current_diff
specweft.save_session_memory
specweft.recall_sessions
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

## Current Storage Model

Global pools:

```text
~/.specweft/mcp/registry.json
~/.specweft/mcp/manifests/*.json
~/.specweft/skills/registry.json
~/.specweft/skills/<skill-id>/SKILL.md
```

Project storage:

```text
.specweft/profile.json
.specweft/mcp.json
.specweft/skills.json
.specweft/memory.json
.specweft/reports/*.md
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

The review feature now creates two artifacts from one command:

```text
git diff -> review draft -> markdown report
                    |
                    -> session memory
```

The markdown report is for human review. The session memory is for future recall when a user opens a new thread and wants to recover the previous requirement context.
