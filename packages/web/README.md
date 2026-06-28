# @specweft/web

Local Web UI server for SpecWeft.

The UI is the product workbench for the local SpecWeft workflow. It keeps
task preparation, Skill routing, Review Lens explanations, Memory Vault restore,
and Agent Bridge connection state in one browser surface.

Most users should start it through the CLI:

```bash
specweft start
```

`specweft start` keeps the UI on a predictable local port. If an older
SpecWeft UI owns that port, it is replaced by the current version. If another
app owns the port, SpecWeft tries the next available port.

Use this package directly only when embedding the Web server into another local
tooling flow.

```ts
import { startWebServer } from "@specweft/web";

await startWebServer({
  repoPath: process.cwd(),
  port: 4177,
});
```

## What The UI Shows

- SpecWeft Workbench: raw task input, Codex / Claude auto-use status, next actions, and context budget
- Skill Router: enabled Skills, task-specific recommendations, Skill detail preview, and optional MCP candidates
- Review Lens: why the change exists, how it was implemented, where to read first, validation, and mixed-diff grouping
- Memory Vault: requirement digest, scoped restore, timeline, handoff prompt, work segments, and memory protection
- Agent Bridge: generated Harness entries, MCP connection summary, expected tool order, and advanced raw config snippets
- Project Settings and Runtime Assembly: recording policy, compression, ignored paths, Skill registry, timeout, and final agent-readable config

Default views avoid raw JSON. Long config snippets, full dossiers, and source
details stay in advanced sections for troubleshooting.

See the repository README for full documentation.
