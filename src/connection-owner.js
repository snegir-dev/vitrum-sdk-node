import { EventEmitter } from "node:events";

import {
  ConnectionClosedError,
  DuplicateRequestError,
  RuntimeRestartedError,
  StaleHandleError,
} from "./errors.js";

export class RuntimeHandle {
  #owner;
  #generation;
  #identifier;

  constructor(owner, generation, identifier) {
    this.#owner = owner;
    this.#generation = generation;
    this.#identifier = Object.freeze({ ...identifier });
  }

  get identifier() {
    return this.#identifier;
  }

  get generation() {
    return this.#generation;
  }

  request(correlation, payload) {
    return this.#owner.requestForHandle(this, correlation, payload);
  }

  assertCurrent(owner, generation) {
    if (this.#owner !== owner || this.#generation !== generation) {
      throw new StaleHandleError();
    }
  }
}

export class ConnectionOwner extends EventEmitter {
  #transportFactory;
  #active = null;
  #nextGeneration = 1;
  #pending = new Map();
  #transition = Promise.resolve();

  constructor(transportFactory) {
    super();
    if (typeof transportFactory !== "function") {
      throw new TypeError("transportFactory must be a function");
    }
    this.#transportFactory = transportFactory;
  }

  get connected() {
    return this.#active !== null;
  }

  get generation() {
    return this.#active?.generation ?? null;
  }

  snapshot() {
    if (!this.#active) return null;
    return Object.freeze({
      generation: this.#active.generation,
      epoch: Buffer.from(this.#active.transport.epoch),
      sessionId: this.#active.transport.sessionId,
    });
  }

  connect() {
    return this.#serialize(() => this.#connect());
  }

  restart() {
    return this.#serialize(async () => {
      if (this.#active) {
        const old = this.#active;
        this.#active = null;
        this.#rejectGeneration(old.generation, new RuntimeRestartedError());
        this.emit("disconnected", {
          generation: old.generation,
          reason: "restart",
        });
        await old.transport.close();
      }
      return this.#connect();
    });
  }

  close() {
    return this.#serialize(async () => {
      if (!this.#active) return;
      const old = this.#active;
      this.#active = null;
      this.#rejectGeneration(old.generation, new ConnectionClosedError("Vitrum connection closed"));
      this.emit("disconnected", {
        generation: old.generation,
        reason: "closed",
      });
      await old.transport.close();
    });
  }

  createViewHandle(identifier) {
    if (!this.#active) throw new ConnectionClosedError();
    return new RuntimeHandle(this, this.#active.generation, identifier);
  }

  request(correlation, payload) {
    if (!this.#active) return Promise.reject(new ConnectionClosedError());
    return this.#requestOn(this.#active, correlation, payload);
  }

  requestForHandle(handle, correlation, payload) {
    if (!this.#active) return Promise.reject(new StaleHandleError());
    try {
      handle.assertCurrent(this, this.#active.generation);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.#requestOn(this.#active, correlation, payload);
  }

  completeRequest(correlation, value, generation = this.#active?.generation) {
    const entry = this.#pending.get(correlation);
    if (!entry || entry.generation !== generation || this.#active?.generation !== generation) {
      return false;
    }
    this.#pending.delete(correlation);
    entry.resolve(value);
    return true;
  }

  failRequest(correlation, error, generation = this.#active?.generation) {
    const entry = this.#pending.get(correlation);
    if (!entry || entry.generation !== generation || this.#active?.generation !== generation) {
      return false;
    }
    this.#pending.delete(correlation);
    entry.reject(error);
    return true;
  }

  #serialize(operation) {
    const result = this.#transition.then(operation, operation);
    this.#transition = result.catch(() => {});
    return result;
  }

  async #connect() {
    if (this.#active) throw new Error("Vitrum runtime is already connected");
    const generation = this.#nextGeneration;
    this.#nextGeneration = checkedNextGeneration(generation);
    const transport = await this.#transportFactory({
      onFrame: (payload) => this.#receiveFrame(generation, payload),
      onClose: (error) => this.#connectionLost(generation, error),
    });
    if (transport.closed) {
      await transport.close();
      throw new ConnectionClosedError("Vitrum runtime closed during authentication");
    }
    this.#active = { generation, transport };
    const snapshot = this.snapshot();
    this.emit("connected", snapshot);
    return snapshot;
  }

  #requestOn(active, correlation, payload) {
    if (this.#pending.has(correlation)) {
      return Promise.reject(new DuplicateRequestError());
    }
    let resolve;
    let reject;
    const completion = new Promise((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    this.#pending.set(correlation, {
      generation: active.generation,
      resolve,
      reject,
    });
    void active.transport.send(payload).catch((error) => {
      this.#connectionLost(
        active.generation,
        error instanceof ConnectionClosedError
          ? error
          : new ConnectionClosedError("Vitrum request write failed", { cause: error }),
      );
    });
    return completion;
  }

  #receiveFrame(generation, payload) {
    if (this.#active?.generation !== generation) return;
    this.emit("frame", Buffer.from(payload), generation);
  }

  #connectionLost(generation, error) {
    if (this.#active?.generation !== generation) return;
    const old = this.#active;
    this.#active = null;
    const reason =
      error instanceof ConnectionClosedError
        ? error
        : new ConnectionClosedError("Vitrum runtime connection lost", { cause: error });
    this.#rejectGeneration(generation, reason);
    this.emit("disconnected", { generation, reason });
    void old.transport.close();
  }

  #rejectGeneration(generation, error) {
    for (const [correlation, entry] of this.#pending) {
      if (entry.generation !== generation) continue;
      this.#pending.delete(correlation);
      entry.reject(error);
    }
  }
}

function checkedNextGeneration(current) {
  if (!Number.isSafeInteger(current) || current < 1 || current === Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Vitrum connection generation exhausted");
  }
  return current + 1;
}
