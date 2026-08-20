import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ConnectionClosedError,
  ConnectionOwner,
  RuntimeRestartedError,
  StaleHandleError,
} from "../src/index.js";

class FakeTransport {
  constructor(id, callbacks) {
    this.id = id;
    this.epoch = Buffer.alloc(16, id);
    this.sessionId = 1n;
    this.closed = false;
    this.sends = [];
    this.callbacks = callbacks;
  }

  async send(payload) {
    if (this.closed) throw new ConnectionClosedError();
    this.sends.push(Buffer.from(payload));
  }

  async close() {
    this.closed = true;
  }

  emitFrame(payload) {
    this.callbacks.onFrame(Buffer.from(payload));
  }

  crash(error = new ConnectionClosedError("injected crash")) {
    this.closed = true;
    this.callbacks.onClose(error);
  }
}

function immediateFactory() {
  const transports = [];
  const factory = async (callbacks) => {
    const transport = new FakeTransport(transports.length + 1, callbacks);
    transports.push(transport);
    return transport;
  };
  return { factory, transports };
}

function deferred() {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

function turn() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("reconnect_invalidates_all_old_handles_before_new_connection_is_visible", async () => {
  const second = deferred();
  const transports = [];
  const owner = new ConnectionOwner(async (callbacks) => {
    const transport = new FakeTransport(transports.length + 1, callbacks);
    transports.push(transport);
    if (transports.length === 2) await second.promise;
    return transport;
  });
  await owner.connect();
  const handle = owner.createViewHandle({ sessionId: 1n, slot: 0, generation: 1 });

  const restart = owner.restart();
  await turn();

  assert.equal(owner.connected, false);
  await assert.rejects(handle.request(1n, Buffer.from("stale")), StaleHandleError);
  second.resolve();
  const replacement = await restart;
  assert.equal(owner.connected, true);
  assert.equal(replacement.generation, 2);
});

test("pending_requests_fail_exactly_once_on_runtime_restart", async () => {
  const { factory, transports } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  await owner.connect();
  let rejectionCount = 0;
  const pending = owner.request(9n, Buffer.from("mutation")).catch((error) => {
    rejectionCount += 1;
    throw error;
  });

  await owner.restart();
  await assert.rejects(pending, RuntimeRestartedError);
  transports[0].crash();
  await turn();

  assert.equal(rejectionCount, 1);
});

test("old_handle_methods_fail_locally_without_writing_to_new_transport", async () => {
  const { factory, transports } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  await owner.connect();
  const old = owner.createViewHandle({ sessionId: 1n, slot: 0, generation: 1 });
  await owner.restart();

  await assert.rejects(old.request(3n, Buffer.from("must-not-write")), StaleHandleError);

  assert.equal(transports[1].sends.length, 0);
});

test("views_are_recreated_only_by_explicit_host_intent", async () => {
  const { factory, transports } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  await owner.connect();
  owner.createViewHandle({ sessionId: 1n, slot: 0, generation: 1 });

  await owner.restart();
  assert.equal(transports[1].sends.length, 0, "restart must not replay View creation");

  const replacement = owner.createViewHandle({ sessionId: 1n, slot: 0, generation: 1 });
  const pending = replacement.request(4n, Buffer.from("explicit-create"));
  assert.equal(transports[1].sends.length, 1);
  owner.completeRequest(4n, "created");
  assert.equal(await pending, "created");
});

test("restart_race_does_not_deliver_old_events_to_new_listeners", async () => {
  const { factory, transports } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  const frames = [];
  owner.on("frame", (payload) => frames.push(payload.toString("utf8")));
  await owner.connect();
  await owner.restart();

  transports[0].emitFrame("late-old");
  transports[1].emitFrame("current");

  assert.deepEqual(frames, ["current"]);
});

test("late_old_event_cannot_complete_new_epoch_request", async () => {
  const { factory } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  const first = await owner.connect();
  await owner.restart();
  const pending = owner.request(12n, Buffer.from("new-request"));

  assert.equal(owner.completeRequest(12n, "old", first.generation), false);
  assert.equal(owner.completeRequest(12n, "new"), true);
  assert.equal(await pending, "new");
});

test("crash_after_acceptance_fails_pending_request_without_replay", async () => {
  const { factory, transports } = immediateFactory();
  const owner = new ConnectionOwner(factory);
  await owner.connect();
  const pending = owner.request(17n, Buffer.from("accepted-mutation"));
  assert.equal(transports[0].sends.length, 1);

  transports[0].crash();
  await assert.rejects(pending, ConnectionClosedError);
  await owner.connect();

  assert.equal(transports[1].sends.length, 0, "ambiguous mutation must not replay");
});
