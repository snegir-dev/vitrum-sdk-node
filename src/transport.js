import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";

import {
  AuthenticationError,
  ConnectionClosedError,
  HandshakeError,
  ProtocolMismatchError,
} from "./errors.js";

const HANDSHAKE_VERSION = 1;
const NATIVE_PROTOCOL_MAJOR = 1;
const NATIVE_PROTOCOL_MINOR = 0;
const RUNTIME_CAPABILITY_NATIVE_PROTOCOL = 1n;
const SERVER_HELLO_BYTES = 98;
const SERVER_HELLO_PREFIX_BYTES = 66;
const CLIENT_AUTH_BYTES = 86;
const CLIENT_AUTH_PREFIX_BYTES = 54;
const SERVER_READY_BYTES = 62;
const SERVER_READY_PREFIX_BYTES = 30;
const FRAME_HEADER_BYTES = 36;
const FRAME_TAG_BYTES = 32;
const MAX_FRAME_PAYLOAD_BYTES = 1_048_576;
const CLIENT_TO_RUNTIME = 1;
const RUNTIME_TO_CLIENT = 2;
const FRAME_KIND_APPLICATION = 1;
const SERVER_HELLO_DOMAIN = Buffer.from("vitrum-m5-server-hello-v1");
const CLIENT_AUTH_DOMAIN = Buffer.from("vitrum-m5-client-auth-v1");
const SESSION_KEY_DOMAIN = Buffer.from("vitrum-m5-session-key-v1");
const SERVER_READY_DOMAIN = Buffer.from("vitrum-m5-server-ready-v1");
const FRAME_DOMAIN = Buffer.from("vitrum-m5-application-frame-v1");

class ByteReader {
  #iterator;
  #buffer = Buffer.alloc(0);

  constructor(stream) {
    this.#iterator = stream[Symbol.asyncIterator]();
  }

  async readExact(length) {
    while (this.#buffer.length < length) {
      const { value, done } = await this.#iterator.next();
      if (done) {
        throw new ConnectionClosedError("Vitrum runtime closed its output pipe");
      }
      const chunk = Buffer.from(value);
      this.#buffer = Buffer.concat([this.#buffer, chunk], this.#buffer.length + chunk.length);
    }
    const result = Buffer.from(this.#buffer.subarray(0, length));
    this.#buffer = Buffer.from(this.#buffer.subarray(length));
    return result;
  }
}

export class RuntimeTransport {
  #child;
  #input;
  #reader;
  #sessionKey;
  #onFrame;
  #onClose;
  #closed = false;
  #closeNotified = false;
  #sendSequence = 1n;
  #receiveSequence = 1n;
  #writeChain = Promise.resolve();
  #exitPromise;

  constructor({ child, input, reader, epoch, sessionId, sessionKey, exitPromise, onFrame, onClose }) {
    this.#child = child;
    this.#input = input;
    this.#reader = reader;
    this.epoch = Buffer.from(epoch);
    this.sessionId = sessionId;
    this.#sessionKey = sessionKey;
    this.#onFrame = onFrame;
    this.#onClose = onClose;
    this.#exitPromise = exitPromise;
    child.once("exit", (code, signal) => {
      this.#notifyClose(
        new ConnectionClosedError(
          `Vitrum runtime exited (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    });
    child.once("error", (error) => {
      this.#notifyClose(new ConnectionClosedError("Vitrum runtime process failed", { cause: error }));
    });
    if (child.exitCode !== null || child.signalCode !== null) {
      queueMicrotask(() => {
        this.#notifyClose(new ConnectionClosedError("Vitrum runtime exited during authentication"));
      });
    }
  }

  static async connect(runtimePath, { onFrame = () => {}, onClose = () => {}, timeoutMs = 5_000 } = {}) {
    if (typeof runtimePath !== "string" || runtimePath.length === 0) {
      throw new TypeError("runtimePath must be a non-empty string");
    }
    const secret = randomBytes(32);
    const child = spawn(runtimePath, [], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const exitPromise = new Promise((resolve) => {
      child.once("exit", resolve);
    });
    let rejectSpawn;
    const spawnFailure = new Promise((_, reject) => {
      rejectSpawn = reject;
    });
    spawnFailure.catch(() => {});
    const onSpawnError = (error) => {
      rejectSpawn(new ConnectionClosedError("Vitrum runtime process failed to start", {
        cause: error,
      }));
    };
    child.once("error", onSpawnError);
    const input = child.stdin;
    const reader = new ByteReader(child.stdout);
    const duringHandshake = (promise, operation) =>
      withTimeout(Promise.race([promise, spawnFailure]), timeoutMs, operation);
    try {
      await duringHandshake(writeAll(input, secret), "writing runtime bootstrap secret");
      const hello = await duringHandshake(
        reader.readExact(SERVER_HELLO_BYTES),
        "waiting for runtime server hello",
      );
      const parsedHello = verifyServerHello(secret, hello);
      const authentication = createClientAuthentication(secret, hello, parsedHello.epoch);
      const sessionKey = hmac(secret, SESSION_KEY_DOMAIN, hello, authentication);
      secret.fill(0);
      await duringHandshake(
        writeAll(input, authentication),
        "writing runtime client authentication",
      );
      const ready = await duringHandshake(
        reader.readExact(SERVER_READY_BYTES),
        "waiting for runtime ready",
      );
      const sessionId = verifyServerReady(sessionKey, parsedHello.epoch, ready);
      child.off("error", onSpawnError);
      const transport = new RuntimeTransport({
        child,
        input,
        reader,
        epoch: parsedHello.epoch,
        sessionId,
        sessionKey,
        exitPromise,
        onFrame,
        onClose,
      });
      void transport.#pump();
      return transport;
    } catch (error) {
      child.off("error", onSpawnError);
      secret.fill(0);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      throw error;
    }
  }

  get closed() {
    return this.#closed;
  }

  send(payload) {
    const body = Buffer.from(payload);
    if (body.length > MAX_FRAME_PAYLOAD_BYTES) {
      return Promise.reject(new RangeError("runtime frame exceeds the one-mebibyte limit"));
    }
    if (this.#closed) {
      return Promise.reject(new ConnectionClosedError());
    }
    const sequence = this.#sendSequence;
    if (sequence === 0xffff_ffff_ffff_ffffn) {
      return Promise.reject(new ProtocolMismatchError("runtime send sequence exhausted"));
    }
    this.#sendSequence += 1n;
    const header = createFrameHeader(this.epoch, CLIENT_TO_RUNTIME, sequence, body.length);
    const tag = hmac(this.#sessionKey, FRAME_DOMAIN, header, body);
    const frame = Buffer.concat([header, body, tag]);
    this.#writeChain = this.#writeChain.then(() => writeAll(this.#input, frame));
    return this.#writeChain.catch((error) => {
      const closed = new ConnectionClosedError("failed to write to Vitrum runtime", {
        cause: error,
      });
      this.#notifyClose(closed);
      throw closed;
    });
  }

  async close() {
    if (!this.#closed) {
      this.#closed = true;
      this.#closeNotified = true;
      this.#sessionKey.fill(0);
      this.#input.end();
      if (this.#child.exitCode === null && this.#child.signalCode === null) {
        this.#child.kill();
      }
    }
    await withTimeout(this.#exitPromise, 5_000, "waiting for Vitrum runtime exit");
  }

  async #pump() {
    try {
      while (!this.#closed) {
        const header = await this.#reader.readExact(FRAME_HEADER_BYTES);
        const payloadLength = this.#inspectHeader(header);
        const payload = await this.#reader.readExact(payloadLength);
        const tag = await this.#reader.readExact(FRAME_TAG_BYTES);
        const expected = hmac(this.#sessionKey, FRAME_DOMAIN, header, payload);
        if (!timingSafeEqual(expected, tag)) {
          throw new AuthenticationError("runtime frame authentication failed");
        }
        this.#receiveSequence += 1n;
        this.#onFrame(Buffer.from(payload));
      }
    } catch (error) {
      if (!this.#closed) {
        this.#notifyClose(
          error instanceof Error
            ? error
            : new ConnectionClosedError("Vitrum runtime event pump failed", { cause: error }),
        );
      }
    }
  }

  #inspectHeader(header) {
    requireMagic(header, "VTF1", "runtime frame");
    if (header.readUInt16BE(4) !== HANDSHAKE_VERSION) {
      throw new ProtocolMismatchError("unsupported runtime frame version");
    }
    if (header[6] !== RUNTIME_TO_CLIENT) {
      throw new ProtocolMismatchError("runtime frame arrived on the wrong direction");
    }
    if (header[7] !== FRAME_KIND_APPLICATION) {
      throw new ProtocolMismatchError("unsupported runtime frame kind");
    }
    if (!header.subarray(8, 24).equals(this.epoch)) {
      throw new AuthenticationError("runtime frame belongs to a stale connection epoch");
    }
    if (header.readBigUInt64BE(24) !== this.#receiveSequence) {
      throw new ProtocolMismatchError("runtime frame sequence is not contiguous");
    }
    const payloadLength = header.readUInt32BE(32);
    if (payloadLength > MAX_FRAME_PAYLOAD_BYTES) {
      throw new ProtocolMismatchError("runtime frame exceeds the one-mebibyte limit");
    }
    return payloadLength;
  }

  #notifyClose(error) {
    if (this.#closeNotified) return;
    this.#closeNotified = true;
    this.#closed = true;
    this.#sessionKey.fill(0);
    this.#input.destroy();
    if (this.#child.exitCode === null && this.#child.signalCode === null) {
      this.#child.kill();
    }
    this.#onClose(error);
  }
}

export function createRuntimeTransportFactory(runtimePath, options = {}) {
  return (callbacks) => RuntimeTransport.connect(runtimePath, { ...options, ...callbacks });
}

function verifyServerHello(secret, hello) {
  requireMagic(hello, "VSH1", "server hello");
  if (hello.readUInt16BE(4) !== HANDSHAKE_VERSION) {
    throw new ProtocolMismatchError("unsupported runtime handshake version");
  }
  if (
    hello.readUInt16BE(6) !== NATIVE_PROTOCOL_MAJOR ||
    hello.readUInt16BE(8) !== NATIVE_PROTOCOL_MINOR ||
    hello.readBigUInt64BE(10) !== RUNTIME_CAPABILITY_NATIVE_PROTOCOL
  ) {
    throw new ProtocolMismatchError("runtime selected an unsupported protocol or capability set");
  }
  const epoch = Buffer.from(hello.subarray(18, 34));
  if (epoch.every((byte) => byte === 0)) {
    throw new HandshakeError("runtime returned the reserved all-zero connection epoch");
  }
  const expected = hmac(
    secret,
    SERVER_HELLO_DOMAIN,
    hello.subarray(0, SERVER_HELLO_PREFIX_BYTES),
  );
  if (!timingSafeEqual(expected, hello.subarray(SERVER_HELLO_PREFIX_BYTES))) {
    throw new AuthenticationError("runtime server hello authentication failed");
  }
  return { epoch };
}

function createClientAuthentication(secret, hello, epoch) {
  const prefix = Buffer.alloc(CLIENT_AUTH_PREFIX_BYTES);
  prefix.write("VCA1", 0, "ascii");
  prefix.writeUInt16BE(HANDSHAKE_VERSION, 4);
  epoch.copy(prefix, 6);
  randomBytes(32).copy(prefix, 22);
  const tag = hmac(secret, CLIENT_AUTH_DOMAIN, hello, prefix);
  const result = Buffer.concat([prefix, tag]);
  if (result.length !== CLIENT_AUTH_BYTES) throw new HandshakeError("invalid client auth length");
  return result;
}

function verifyServerReady(sessionKey, epoch, ready) {
  requireMagic(ready, "VSR1", "server ready");
  if (ready.readUInt16BE(4) !== HANDSHAKE_VERSION) {
    throw new ProtocolMismatchError("unsupported runtime ready version");
  }
  if (!ready.subarray(6, 22).equals(epoch)) {
    throw new AuthenticationError("runtime ready belongs to a different connection epoch");
  }
  const sessionId = ready.readBigUInt64BE(22);
  if (sessionId === 0n) throw new HandshakeError("runtime returned Engine session zero");
  const expected = hmac(
    sessionKey,
    SERVER_READY_DOMAIN,
    ready.subarray(0, SERVER_READY_PREFIX_BYTES),
  );
  if (!timingSafeEqual(expected, ready.subarray(SERVER_READY_PREFIX_BYTES))) {
    throw new AuthenticationError("runtime ready authentication failed");
  }
  return sessionId;
}

function createFrameHeader(epoch, direction, sequence, payloadLength) {
  const header = Buffer.alloc(FRAME_HEADER_BYTES);
  header.write("VTF1", 0, "ascii");
  header.writeUInt16BE(HANDSHAKE_VERSION, 4);
  header[6] = direction;
  header[7] = FRAME_KIND_APPLICATION;
  epoch.copy(header, 8);
  header.writeBigUInt64BE(sequence, 24);
  header.writeUInt32BE(payloadLength, 32);
  return header;
}

function hmac(key, domain, ...parts) {
  const value = createHmac("sha256", key);
  value.update(domain);
  for (const part of parts) value.update(part);
  return value.digest();
}

function requireMagic(buffer, expected, description) {
  if (buffer.subarray(0, 4).toString("ascii") !== expected) {
    throw new HandshakeError(`invalid ${description} magic`);
  }
}

function writeAll(stream, bytes) {
  return new Promise((resolve, reject) => {
    stream.write(bytes, (error) => (error ? reject(error) : resolve()));
  });
}

function withTimeout(promise, timeoutMs, operation) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new HandshakeError(`timed out ${operation}`)),
        timeoutMs,
      );
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}
