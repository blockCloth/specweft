# SpecWeft CLI

SpecWeft is a local context layer for Codex, Claude Code, and other MCP-compatible coding agents.

It helps a coding agent prepare better context before edits, recommend task-specific Skills, keep requirement-scoped memory, and explain code changes afterward.

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

`specweft init` writes project-local SpecWeft files, initializes the global MCP/Skill pool, and writes Agent instructions into `AGENTS.md` and `CLAUDE.md`.

`specweft start` opens the local Web UI. If an older SpecWeft UI is already running on the same port, it is stopped and replaced by the current version. If another app owns the port, SpecWeft tries the next available port.

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

## Common Commands

```bash
specweft prepare --task "Improve login validation"
specweft review
specweft digest
specweft dossier
specweft restore --keyword "login"
specweft capabilities
specweft segment status
specweft handoff --keyword "login"
```

See the repository README for full documentation.
