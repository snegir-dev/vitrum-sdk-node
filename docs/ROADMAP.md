# Vitrum Node SDK roadmap

- [x] Establish independent repository and no-legacy-V8-in-Node boundary.
- [ ] Wait for Engine V8-free runtime bootstrap, native package/action contract,
  and authenticated IPC handshake.
- [ ] Implement Node-API 8 addon and Promise/EventEmitter facade.
- [ ] Map package lifecycle, typed actions, host results, frames, cleanup, and
  runtime crash/restart without blocking Node's event loop.
- [ ] Package exact optional `win32-x64-msvc` artifacts with no install download.
- [ ] Pass shared native package/action scenario on Node 22, 24, and 26.
- [ ] Pass create/close, cleanup, crash, and memory stress gates.
