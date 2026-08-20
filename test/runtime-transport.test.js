import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { ConnectionClosedError, RuntimeTransport } from "../src/index.js";

const runtimePath = process.env.VITRUM_RUNTIME_PATH;

function turn() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("runtime_spawn_failure_is_reported_as_connection_error", async () => {
  await assert.rejects(
    RuntimeTransport.connect(`${process.cwd()}\\vitrum-runtime-does-not-exist.exe`, {
      timeoutMs: 500,
    }),
    ConnectionClosedError,
  );
});

test(
  "explicit_close_waits_for_graceful_exit_before_kill_escalation",
  async () => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.killCalls = 0;
    child.kill = () => {
      child.killCalls += 1;
      return true;
    };
    let inputEnded = false;
    const input = {
      end() {
        inputEnded = true;
      },
    };
    const exitPromise = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const transport = new RuntimeTransport({
      child,
      input,
      reader: {},
      epoch: Buffer.alloc(16, 1),
      sessionId: 1n,
      sessionKey: Buffer.alloc(32, 2),
      exitPromise,
      onFrame: () => {},
      onClose: () => {},
    });

    const closing = transport.close();
    await turn();
    assert.equal(inputEnded, true);
    assert.equal(child.killCalls, 0, "close must not terminate a live child before its deadline");

    child.exitCode = 0;
    child.emit("exit", 0, null);
    await closing;
    assert.equal(child.killCalls, 0);
  },
);

test(
  "explicit_close_drains_the_real_runtime_to_a_clean_exit",
  { skip: runtimePath ? false : "VITRUM_RUNTIME_PATH is not set" },
  async () => {
    const transport = await RuntimeTransport.connect(runtimePath);
    await transport.close();
  },
);

test(
  "runtime_restart_never_reuses_an_authenticated_connection_epoch",
  { skip: runtimePath ? false : "VITRUM_RUNTIME_PATH is not set" },
  async () => {
    const first = await RuntimeTransport.connect(runtimePath);
    const firstEpoch = Buffer.from(first.epoch);
    const firstSession = first.sessionId;
    await first.close();

    const replacement = await RuntimeTransport.connect(runtimePath);
    const replacementEpoch = Buffer.from(replacement.epoch);

    assert.equal(firstSession, replacement.sessionId);
    assert.notDeepEqual(firstEpoch, replacementEpoch);
    await replacement.close();
  },
);

test(
  "two_live_runtime_instances_publish_independent_authenticated_epochs",
  { skip: runtimePath ? false : "VITRUM_RUNTIME_PATH is not set" },
  async () => {
    const first = await RuntimeTransport.connect(runtimePath);
    const second = await RuntimeTransport.connect(runtimePath);

    assert.equal(first.sessionId, second.sessionId);
    assert.notDeepEqual(first.epoch, second.epoch);

    await Promise.all([first.close(), second.close()]);
  },
);
