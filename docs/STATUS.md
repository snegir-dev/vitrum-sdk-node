# Vitrum Node SDK status

Last updated: 2026-08-21

Status: **FH-006 REVIEW COMPLETE — closure recording pending; full SDK remains
pre-release.**

The canonical repository and checkout directory name is `vitrum-sdk-node`.

Graphify is installed as project-scoped Codex tooling. Its generated
`graphify-out/` directory is ignored, and `docs/GRAPHIFY.md` keeps the tool
outside the Node-API and authenticated-IPC contract.

`src/transport.js` now starts the Engine-owned `vitrum-runtime.exe`, performs
the ADR 0087 authenticated inherited-pipe handshake, and verifies an explicit
epoch/direction/sequence before accepting a frame payload. `ConnectionOwner`
atomically fences reconnects with an SDK-local generation, rejects pending work
exactly once, makes old handles fail locally, ignores late old-generation
events/completions, and never recreates Views or replays mutations.

This is not the complete SDK. There is no `.node` addon, high-level native-
Protocol command/event codec, public npm package, platform package, Job Object,
or named-pipe listener. The offscreen Node widget under the sibling
`vitrum-examples` repository remains an M1 developer prototype and is not this
SDK.

Engine's target architecture is native HTML/CSS with Rust-owned behavior. This
SDK never sends widget JavaScript or links the retained legacy Engine V8.

Verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1 `
  -RuntimePath ..\vitrum-engine\target\debug\vitrum-runtime.exe
```

FH-006 exact evidence on 2026-08-21 covers Node
`ec3f72ce1b578460d9a56c7427e30803bdac402b` with Engine
`3a2553101454efc33d72af8d95642a9519767491`. `npm run check` passed 14/14 on
Node 22 with no skips against the sibling Engine runtime: restart, two live
processes, spawn failure, generation invalidation, late-event isolation,
no-replay, graceful idle/busy-output drain, and timeout escalation. Independent
GPT-5.6 Sol found and drove correction of the early-kill/stdout-drain defects,
then reported no P0--P3 findings and `VERDICT: NO BLOCKER` on this exact pair.

Graphify integration PASS on 2026-07-17: `graphify --version` reported
`0.8.50`; `graphify codex install --project` created the project-scoped Codex
skill and hook; and the generated `graphify-out/` path is ignored. This remains
tooling evidence independent of the FH-006 product gate.

Next action: record this repository's closure preparation and the Engine
closure recorder, then continue M5 with the native Protocol codec and Node-API
facade without linking V8.
