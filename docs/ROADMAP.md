# Vitrum Node SDK roadmap

- [x] Establish an independent SDK repository and no-second-V8 contract.
- [ ] Wait for the Engine runtime executable and authenticated IPC handshake.
- [ ] Implement a Node-API 8 addon and Promise/EventEmitter facade.
- [ ] Implement cleanup hooks, TSFN backpressure, worker-thread isolation, and
  runtime crash/restart behavior.
- [ ] Package exact optional `win32-x64-msvc` native artifacts with no install
  download.
- [ ] Pass the shared binding scenario on Node 22, 24, and 26.
- [ ] Pass create/close, cleanup, crash, and memory stress gates.
