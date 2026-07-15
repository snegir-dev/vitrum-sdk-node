# Vitrum Node SDK

This repository will contain the official `@vitrum/node` package: a Node-API
control addon, JavaScript/TypeScript facade, and platform packages for the
separate Vitrum runtime.

Status: documentation scaffold. There is no addon, named-pipe transport, npm
package, or bundled runtime yet.

Node already embeds V8, so this SDK will never link or load Vitrum's page V8.
It will start `vitrum-runtime.exe` and map versioned IPC commands/events to
Promises and EventEmitter events.

Read [status](docs/STATUS.md), [roadmap](docs/ROADMAP.md), and
[architecture](docs/ARCHITECTURE.md).
