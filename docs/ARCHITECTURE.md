# Vitrum Node SDK architecture

```text
Node application
      |
      v
Node-API addon (no page V8)
      |
authenticated versioned named pipe
      |
vitrum-runtime.exe (owned by Engine release)
```

The addon maps Engine/View commands to Promises and events through one
nonblocking ThreadsafeFunction per `napi_env`. Cleanup cancels pending work,
quiesces delivery, and terminates the child runtime through a Job Object.

The canonical IPC and embedding contracts are owned by Vitrum Engine; this
repository owns only their Node mapping and packaging.
