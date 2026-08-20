# Vitrum Node SDK architecture

```text
Node application
      |
      v
ConnectionOwner (SDK-local generation and pending ownership)
      |
RuntimeTransport (spawn + authenticated inherited duplex pipe)
      |
vitrum-runtime.exe (V8-free Native HTML/CSS runtime)
```

FH-006 implements the JavaScript process/connection layer. A parent-generated
256-bit bootstrap secret is written through the inherited stdin pipe, never
argv or environment. The runtime proves a fresh 128-bit epoch before starting
one Engine, then both directions use authenticated epoch/sequence frames. The
transport treats the native Protocol CBOR payload as opaque.

`ConnectionOwner` is the sole publisher of an active transport. It invalidates
the old SDK generation and rejects pending work before a replacement becomes
visible. Handles retain their creation generation and fail locally when stale;
late frames and completions carry the captured generation and cannot enter the
new connection. Restart never recreates Views or replays accepted mutations.

The future Node-API addon will map Engine/View/package/action commands to
Promises and lifecycle, action, diagnostics, and frame events through
nonblocking ThreadsafeFunction delivery per `napi_env`. Cleanup hooks, Job
Object ownership, a discoverable named-pipe endpoint, and native artifact
packaging remain later M5 work and require their own accepted security/lifecycle
contract. Neither current nor future layers link retained legacy Engine V8.

Engine owns native package/action/protocol and embedding semantics; this
repository owns only their Node mapping and packaging.

See [RUNTIME_CONNECTION.md](RUNTIME_CONNECTION.md) for the exact current state
machine, errors, and test boundary.
