# Authenticated runtime connection

Status: FH-006 implementation contract, 2026-08-20.

This document owns the Node side of Engine ADR 0087. It does not define native
Protocol command/event CBOR and does not authorize a discoverable IPC listener.

## Bootstrap and frames

`RuntimeTransport.connect` generates a 256-bit bootstrap secret before spawning
`vitrum-runtime.exe`. The secret is sent only through inherited stdin. The
runtime authenticates a fresh non-zero 128-bit `ConnectionEpoch`, native
Protocol 1.0, and capability bit 0 before it starts one Engine. Client key
confirmation completes before the runtime publishes the Engine `SessionId`.

Application frames authenticate the fixed header and opaque payload with
HMAC-SHA-256. The 36-byte header contains magic/version, direction, kind,
16-byte epoch, 64-bit contiguous sequence, and 32-bit payload length. The
receiver rejects wrong version/direction/epoch/sequence and payloads above one
MiB from the header alone, before reading or decoding the payload. Each
direction starts at sequence one on every new epoch.

The inherited pipe is private to the spawned parent/child pair. HMAC supplies
peer authentication and integrity, not encryption. A future named-pipe or
multi-client endpoint needs a separate endpoint-discovery, ACL, confidentiality,
supervisor, and bootstrap-secret delivery decision.

## SDK connection state

```text
Disconnected -> Authenticating(generation) -> Active(generation, epoch, session)
      ^                    |                         |
      +------ failed ------+------ loss/restart ----+
```

`ConnectionOwner` serializes connect/restart/close transitions. Every attempt
consumes a monotonically increasing safe-integer generation. Restart removes
the active connection, rejects every pending request of that generation once,
emits disconnection, and closes the old process before authenticating a
replacement. Only then is the new snapshot published.

Handles store their owner and creation generation. A stale handle returns
`STALE_HANDLE` without writing to any transport. Frame and close callbacks
capture their generation; late old callbacks are ignored. Correlations are
unique while pending and old-generation completions cannot complete new work.
There is no automatic command, View, package, or state replay.

## Errors and cleanup

- `HANDSHAKE_FAILED`: malformed, incomplete, or timed-out bootstrap.
- `AUTHENTICATION_FAILED`: peer, ready, frame tag, or epoch proof failed.
- `PROTOCOL_MISMATCH`: version, capability, direction, sequence, or size differs.
- `CONNECTION_CLOSED`: process/pipe loss or explicit close.
- `RUNTIME_RESTARTED`: accepted pending work was invalidated by host restart.
- `STALE_HANDLE`: an object belongs to another SDK generation.
- `DUPLICATE_REQUEST`: a correlation is already pending.

Handshake failure kills the child. Frame/authentication failure destroys the
pipe and kills the child. Explicit close first closes stdin so the runtime can
run its bounded Engine disconnect shutdown, then waits at most five seconds for
a clean zero-code process exit. Forced termination is only a timeout escalation.
Secret and session-key buffers are overwritten when their ownership ends.

The runtime input owner uses a one-slot channel: at most one authenticated frame
is queued and one is held by a blocked reader before bounded OS-pipe
backpressure applies. Ordinary terminal request correlations are released
immediately; only pending work and the current successful package activation
for each live View remain addressable.

## Verification

`scripts/check.ps1` requires an exact runtime executable path and rejects a run
where the two real-process tests would be skipped. Unit tests cover every SDK
generation invariant; process tests prove new epochs despite repeated Engine
session values and prove two simultaneous processes publish distinct epochs.
