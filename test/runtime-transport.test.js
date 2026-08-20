import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";
import { test } from "node:test";

import { ConnectionClosedError, RuntimeTransport } from "../src/index.js";

const runtimePath = process.env.VITRUM_RUNTIME_PATH;

function turn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function cborHead(major, value) {
  const number = BigInt(value);
  if (number <= 23n) return Buffer.from([(major << 5) | Number(number)]);
  if (number <= 0xffn) return Buffer.from([(major << 5) | 24, Number(number)]);
  if (number <= 0xffffn) {
    const result = Buffer.alloc(3);
    result[0] = (major << 5) | 25;
    result.writeUInt16BE(Number(number), 1);
    return result;
  }
  if (number <= 0xffff_ffffn) {
    const result = Buffer.alloc(5);
    result[0] = (major << 5) | 26;
    result.writeUInt32BE(Number(number), 1);
    return result;
  }
  const result = Buffer.alloc(9);
  result[0] = (major << 5) | 27;
  result.writeBigUInt64BE(number, 1);
  return result;
}

function cborUnsigned(value) {
  return cborHead(0, value);
}

function cborText(value) {
  const text = Buffer.from(value, "utf8");
  return Buffer.concat([cborHead(3, text.length), text]);
}

function cborMap(entries) {
  return Buffer.concat([
    cborHead(5, entries.length),
    ...entries.flatMap(([key, value]) => [cborText(key), value]),
  ]);
}

function discoverCapabilitiesEnvelope(sessionId, sequence, requestId) {
  return cborMap([
    ["protocol_major", cborUnsigned(1)],
    ["protocol_minor", cborUnsigned(0)],
    ["session_id", cborUnsigned(sessionId)],
    ["sequence", cborUnsigned(sequence)],
    [
      "message",
      cborMap([
        ["kind", cborText("command")],
        [
          "payload",
          cborMap([
            ["operation", cborText("discover_capabilities")],
            ["arguments", cborMap([["request_id", cborUnsigned(requestId)]])],
          ]),
        ],
      ]),
    ],
  ]);
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

test("explicit_close_timeout_is_connection_failure_and_forces_termination", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killCalls = 0;
  child.kill = () => {
    child.killCalls += 1;
    child.signalCode = "SIGTERM";
    queueMicrotask(() => child.emit("exit", null, "SIGTERM"));
    return true;
  };
  const exitPromise = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const transport = new RuntimeTransport({
    child,
    input: { end() {} },
    reader: {},
    epoch: Buffer.alloc(16, 1),
    sessionId: 1n,
    sessionKey: Buffer.alloc(32, 2),
    exitPromise,
    timeoutMs: 10,
    onFrame: () => {},
    onClose: () => {},
  });

  await assert.rejects(transport.close(), ConnectionClosedError);
  assert.equal(child.killCalls, 1);
});

test(
  "explicit_close_drains_the_real_runtime_to_a_clean_exit",
  { skip: runtimePath ? false : "VITRUM_RUNTIME_PATH is not set" },
  async () => {
    const transport = await RuntimeTransport.connect(runtimePath);
    await transport.close();
  },
);

test(
  "explicit_close_drains_busy_runtime_output_before_clean_exit",
  { skip: runtimePath ? false : "VITRUM_RUNTIME_PATH is not set" },
  async () => {
    const requestCount = 1_024;
    let publishedFrames = 0;
    const transport = await RuntimeTransport.connect(runtimePath, {
      onFrame: () => {
        publishedFrames += 1;
        const deadline = performance.now() + 0.25;
        while (performance.now() < deadline) {
          // Deliberately let the child build stdout pressure while commands
          // continue entering its bounded transport/Engine owners.
        }
      },
    });
    const sends = [];
    for (let value = 1; value <= requestCount; value += 1) {
      sends.push(
        transport.send(discoverCapabilitiesEnvelope(transport.sessionId, value, value)),
      );
    }
    await Promise.all(sends);
    assert.ok(publishedFrames > 0, "runtime must publish completions before busy close");

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
