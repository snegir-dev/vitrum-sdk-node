import assert from "node:assert/strict";
import { test } from "node:test";

import { ConnectionClosedError, RuntimeTransport } from "../src/index.js";

const runtimePath = process.env.VITRUM_RUNTIME_PATH;

test("runtime_spawn_failure_is_reported_as_connection_error", async () => {
  await assert.rejects(
    RuntimeTransport.connect(`${process.cwd()}\\vitrum-runtime-does-not-exist.exe`, {
      timeoutMs: 500,
    }),
    ConnectionClosedError,
  );
});

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
