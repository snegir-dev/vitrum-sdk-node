# Vitrum Node SDK status

Last updated: 2026-07-19

Status: **DOCS-ONLY — implementation has not started.**

There is no `.node` addon, npm package, IPC client, or runtime package. The
sibling offscreen example is an M1 prototype, not this SDK.

Engine has switched its target architecture to native HTML/CSS with Rust-owned
behavior. This SDK will control a separate V8-free Engine runtime, load declared
packages, and map action/lifecycle/capability events to Node. It will not send
widget JavaScript or link the retained legacy V8 implementation.

Verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
```

PASS on 2026-07-15 for documentation scaffold only.

Next action: wait for Engine M3.0/M3.2 to freeze V8-free runtime bootstrap,
native package/action DTOs, and authenticated IPC requirements; then scaffold
the Node-API addon without Engine internals.
