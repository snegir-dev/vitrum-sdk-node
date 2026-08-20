# Vitrum Node SDK

Canonical repository name: `vitrum-sdk-node`.

This repository contains the first official `@vitrum/node` implementation
slice: the authenticated process transport and the restart-safe connection
owner for the separate Vitrum runtime. The eventual package also needs a
Node-API facade and platform packages.

Status: FH-006 runtime-incarnation and reconnect fencing are implemented. The
package is still private and pre-release; there is no `.node` addon, complete
command/event facade, named-pipe listener, or bundled runtime yet.

Node already embeds V8, so this SDK will never link or load Vitrum's page V8.
The current JavaScript transport starts `vitrum-runtime.exe`, authenticates an
inherited duplex pipe, and exposes opaque native-Protocol payload frames. The
`ConnectionOwner` maps transport loss/restart to generation-fenced Promises,
handles, and EventEmitter events; it never replays ambiguous mutations.

Read [status](docs/STATUS.md), [roadmap](docs/ROADMAP.md), and
[architecture](docs/ARCHITECTURE.md). The exact handshake/reconnect contract is
in [runtime connection](docs/RUNTIME_CONNECTION.md).
