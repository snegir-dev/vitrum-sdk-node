# Vitrum Node SDK roadmap

- [x] Establish independent repository and no-legacy-V8-in-Node boundary.
- [x] Implement the Engine runtime executable client and authenticated inherited-
  pipe handshake with restart-unique connection epochs (FH-006 slice).
- [x] Implement SDK-local generation fencing, pending-request invalidation,
  stale-handle rejection, late-event isolation, and no-replay restart behavior.
- [ ] Implement a Node-API 8 addon and Promise/EventEmitter facade mapping
  package lifecycle, typed actions, host results, capabilities, and frames.
- [ ] Implement cleanup hooks, TSFN backpressure, worker-thread isolation, Job
  Object ownership, and production supervisor policy.
- [ ] Decide and implement the post-inherited-pipe endpoint/ACL contract; a
  named-pipe listener is not implied by FH-006.
- [ ] Package exact optional `win32-x64-msvc` artifacts with no install download.
- [ ] Pass the shared native package/action scenario on Node 22, 24, and 26.
- [ ] Pass create/close, cleanup, crash, and memory stress gates.
