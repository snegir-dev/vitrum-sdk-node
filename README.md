# Vitrum Node SDK

Canonical repository name: `vitrum-sdk-node`.

This repository will contain `@vitrum/node`: a Node-API control addon,
JavaScript/TypeScript facade, and platform packages for a separate Vitrum
Native HTML/CSS runtime.

Status: documentation scaffold. No addon, named-pipe transport, npm package,
or bundled runtime exists. Node controls native HTML/CSS packages and receives
their typed actions/events; it does not provide page JavaScript to widgets.

The addon never links legacy Engine V8. It starts `vitrum-runtime.exe` and maps
versioned IPC commands/events to Promises and EventEmitter events.

Read [status](docs/STATUS.md), [roadmap](docs/ROADMAP.md), and
[architecture](docs/ARCHITECTURE.md).
