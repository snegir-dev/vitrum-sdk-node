# AGENTS.md

These instructions apply to the Vitrum Node SDK.

1. Read all local docs and inspect this repository's Git status first.
2. Never link rusty_v8 or engine V8 into Node. The addon is a Node-API control
   layer for a separate runtime process.
3. Public operations are asynchronous Promises/events; do not block Node's
   event loop or call JS after environment cleanup.
4. IPC uses the engine's authenticated, versioned protocol and public DTOs.
5. Publishable packages pin exact native platform packages and contain no
   postinstall download.
6. Do not claim SDK readiness while this repository is `DOCS-ONLY`.
7. Update `docs/STATUS.md` with tests and next action after every work session.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
