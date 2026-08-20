# Vitrum Node SDK architecture

```text
Node application
      |
Node-API addon (control only; no legacy Engine V8)
      |
authenticated versioned named pipe
      |
vitrum-runtime.exe (V8-free Native HTML/CSS runtime)
```

The addon maps Engine/View/package/action commands to Promises and lifecycle,
action, diagnostics, and frame events through nonblocking ThreadsafeFunction
delivery per `napi_env`. Cleanup cancels pending work, quiesces delivery, and
terminates the child runtime through a Job Object.

Engine owns native package/action/protocol semantics; this repository owns only
their Node mapping and packaging.
