# Vitrum Node SDK roadmap

- [x] Establish an independent SDK repository and no-second-V8 contract.
- [x] Implement the Engine runtime executable client and authenticated inherited-
  pipe handshake with restart-unique connection epochs (FH-006 slice).
- [x] Implement SDK-local generation fencing, pending-request invalidation,
  stale-handle rejection, late-event isolation, and no-replay restart behavior.
- [ ] Implement a Node-API 8 addon and Promise/EventEmitter facade.
- [ ] Implement cleanup hooks, TSFN backpressure, worker-thread isolation, Job
  Object ownership, and production supervisor policy.
- [ ] Decide and implement the post-inherited-pipe endpoint/ACL contract; a
  named-pipe listener is not implied by FH-006.
- [ ] Package exact optional `win32-x64-msvc` native artifacts with no install
  download.
- [ ] Pass the shared binding scenario on Node 22, 24, and 26.
- [ ] Pass create/close, cleanup, crash, and memory stress gates.
