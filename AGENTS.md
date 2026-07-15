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
