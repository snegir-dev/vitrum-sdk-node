# Graphify

Graphify is project-local developer tooling. It is not a Node package, addon,
IPC transport, or replacement for the Engine's authenticated runtime protocol.
The committed Codex integration is in `AGENTS.md`, `.codex/skills/graphify/`,
and `.codex/hooks.json`.

Install the CLI once for the current user:

```powershell
uv tool install graphifyy
```

From this repository, build the initial graph with the Codex skill
`$graphify .`. It writes local generated output to `graphify-out/`, which is
ignored by Git. Use focused graph commands to navigate the planned boundary:

```powershell
graphify query "How does the Node control layer reach the Engine runtime?"
graphify path "Node-API addon" "vitrum-runtime.exe"
graphify update .
```

This graph contains only `vitrum-sdk-node`. For a question spanning sibling
repositories, run `$graphify .` from the plain `Vitrum` parent directory; it
does not create a shared Git workspace or permit Vitrum V8 inside Node. If the
Graphify executable moves, run `graphify codex install --project` here to
refresh the local Codex integration.
