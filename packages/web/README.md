# @specweft/web

Local Web UI server for SpecWeft.

The UI helps you inspect project context, recommended Skills, optional MCPs,
runtime assembly, review explanations, work segments, and requirement memory.

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

- project profile and recording status
- task preparation results for vague requirements
- Skill recommendations and Skill detail previews
- optional MCP marketplace candidates
- review overview grouped by requirement or work batch
- requirement dossier, timeline, recall, and handoff context
- Codex and Claude MCP connection snippets

See the repository README for full documentation.
