# SpecWeft CLI

SpecWeft is a local context layer for Codex, Claude Code, and other MCP-compatible coding agents.

It helps a coding agent prepare better context before edits, recommend task-specific Skills, keep requirement-scoped memory, and explain code changes afterward.

The CLI is the installable entry point. It initializes project-local Agent Harness files, starts the Web UI, exposes the MCP server, and keeps all tested behavior in `@specweft/core`.

## Install

```bash
npm install -g specweft
```

## Quick Start

Run these inside a project:

```bash
specweft init
specweft doctor
specweft start
```

`specweft init` writes project-local SpecWeft files, initializes the global MCP/Skill pool, writes Agent instructions into `AGENTS.md` and `CLAUDE.md`, and creates project-local Agent Harness files for Codex/Claude Skills and Commands.

`specweft start` opens the local Web UI. If an older SpecWeft UI is already running on the same port, it is stopped and replaced by the current version. If another app owns the port, SpecWeft tries the next available port.

The Web UI is built around the same flow the generated Harness asks Codex and Claude to follow:

1. prepare the task from the user's raw request
2. route a small set of non-conflicting Skills
3. mark a work segment before editing
4. create a readable Review Lens explanation after edits
5. use Memory Vault to save requirement memory and restore only the relevant slice in future threads

## Codex And Claude

SpecWeft does not silently edit global Codex or Claude settings. Print the config snippet and copy it into your client:

```bash
specweft setup-codex
specweft setup-claude
```

Useful checks:

```bash
specweft doctor
specweft mcp-inspect
```

Expected agent workflow:

1. call `specweft.bootstrap_session` once at the beginning of a thread
2. call `specweft.prepare_task` before planning or editing
3. call `specweft.start_work_segment` before editing
4. call `specweft.get_memory_digest` before continuing old work
5. call `specweft.restore_requirement` only for relevant memory
6. call `specweft.record_current_diff` after edits

`specweft init` also writes:

```text
.agents/skills/specweft-*/SKILL.md
.codex/skills/specweft-*/SKILL.md
.codex/prompts/specweft-*.md
.claude/skills/specweft-*/SKILL.md
.claude/commands/specweft/*.md
```

These files are thin workflow wrappers. They tell Codex/Claude when to call SpecWeft MCP tools; they do not replace the CLI or duplicate core logic.

## Common Commands

```bash
specweft init
specweft start
specweft doctor
specweft setup-codex
specweft setup-claude
specweft mcp-inspect
specweft prepare --task "Improve login validation"
specweft review
specweft digest
specweft dossier
specweft restore --keyword "login"
specweft capabilities
specweft segment status
specweft handoff --keyword "login"
```

`specweft start` does not require `--repo` in normal use. It uses the current directory and can manage registered projects from one local UI.

CLI help defaults to Chinese. Set `SPECWEFT_LANG=en` or `SPECWEFT_LOCALE=en` when you want English help output.

See the repository README for full documentation.
