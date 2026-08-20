export class VitrumConnectionError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class HandshakeError extends VitrumConnectionError {
  constructor(message, options) {
    super(message, "HANDSHAKE_FAILED", options);
  }
}

export class AuthenticationError extends VitrumConnectionError {
  constructor(message, options) {
    super(message, "AUTHENTICATION_FAILED", options);
  }
}

export class ProtocolMismatchError extends VitrumConnectionError {
  constructor(message, options) {
    super(message, "PROTOCOL_MISMATCH", options);
  }
}

export class ConnectionClosedError extends VitrumConnectionError {
  constructor(message = "Vitrum runtime connection closed", options) {
    super(message, "CONNECTION_CLOSED", options);
  }
}

export class RuntimeRestartedError extends VitrumConnectionError {
  constructor(message = "Vitrum runtime restarted", options) {
    super(message, "RUNTIME_RESTARTED", options);
  }
}

export class StaleHandleError extends VitrumConnectionError {
  constructor(message = "Vitrum handle belongs to a stale runtime connection", options) {
    super(message, "STALE_HANDLE", options);
  }
}

export class DuplicateRequestError extends VitrumConnectionError {
  constructor(message = "Vitrum request correlation is already pending", options) {
    super(message, "DUPLICATE_REQUEST", options);
  }
}
