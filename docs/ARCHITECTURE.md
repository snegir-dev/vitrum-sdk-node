# Vitrum Node SDK architecture

```text
Node application
      |
      v
ConnectionOwner (SDK-local generation and pending ownership)
      |
RuntimeTransport (spawn + authenticated inherited duplex pipe)
      |
vitrum-runtime.exe (owned by Engine release)
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

The future Node-API addon will map Engine/View commands to Promises and events
through one nonblocking ThreadsafeFunction per `napi_env`. Cleanup hooks, Job
Object ownership, a discoverable named-pipe endpoint, and native artifact
packaging remain later M5 work and require their own accepted security/lifecycle
contract.

The canonical IPC and embedding contracts are owned by Vitrum Engine; this
repository owns only their Node mapping and packaging.

See [RUNTIME_CONNECTION.md](RUNTIME_CONNECTION.md) for the exact current state
machine, errors, and test boundary.
