# Vitrum Node SDK status

Last updated: 2026-07-15

Status: **DOCS-ONLY — M5 implementation has not started.**

There is no `.node` addon, npm package, IPC client, or runtime package. The
offscreen Node widget under the sibling examples repository is an M1 developer
prototype and is not this SDK.

Verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
```

Next action: after Engine freezes the runtime bootstrap and authenticated IPC
handshake, scaffold the Node-API addon without linking V8.
