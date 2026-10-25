import test from "node:test";
import assert from "node:assert/strict";
import { SessionBroker } from "../src/session-broker.mjs";
import { fakeProvider, key, deferred, reply } from "./helpers.mjs";
const style = "drawn-world";
function setup(options = {}) {
  const provider = fakeProvider(options);
  return {
    ...provider,
    broker: new SessionBroker({
      apiKey: key,
      request: provider.request,
      pollMs: 0,
    }),
  };
}
test("one scoped session is created with a duration cap, then closure is verified", async () => {
  const { broker, calls } = setup();
  const result = await broker.start(style);
  assert.equal(result.model, "reactor/fast-h3-omni");
  assert.match(result.prompt, /MUSIC DIRECTION[\s\S]*VIDEO DIRECTION/);
  const token = JSON.parse(calls[0].body);
  assert.equal(token.expires_after, 120);
  assert.deepEqual(token.authorization_details[0].constraints, {
    max_sessions: 1,
    max_session_duration_seconds: 30,
  });
  assert.deepEqual(token.authorization_details[0].resources.models.match, [
    "reactor/fast-h3-omni",
  ]);
  assert.equal(calls[0].headers["Reactor-API-Key"], key);
  assert.equal(calls[1].headers["Reactor-API-Key"], undefined);
  assert.equal(
    JSON.parse(calls[1].body).supported_transports[0].version,
    "1.0",
  );
  assert.deepEqual(await broker.stop(), { state: "closed" });
  assert.deepEqual(
    calls.map((c) => c.method),
    ["POST", "POST", "DELETE", "GET"],
  );
  assert.equal(broker.active, null);
});
test("parallel starts and credential changes are rejected while a session exists", async () => {
  const { broker, calls } = setup();
  await broker.start(style);
  await assert.rejects(broker.start(style), { code: "attempt_active" });
  assert.throws(() => broker.setKey(""), { code: "attempt_active" });
  assert.equal(calls.filter((c) => c.path === "/sessions").length, 1);
  await broker.stop();
});
test("a different attempt cannot close the active session", async () => {
  const { broker, calls } = setup();
  await broker.start(style, "owner");
  await assert.rejects(broker.stop("other"), { code: "attempt_active" });
  assert.equal(calls.length, 2);
  await broker.stop("owner");
});
test("unknown closure retains the lease and blocks another paid start", async () => {
  const { broker } = setup({ terminal: "ACTIVE" });
  await broker.start(style);
  assert.equal((await broker.stop()).state, "closure_unknown");
  await assert.rejects(broker.start(style), { code: "attempt_active" });
});
test("cancel while token is pending never creates a session", async () => {
  const held = deferred();
  const { broker, calls } = setup({ holdToken: held.promise });
  const start = broker.start(style);
  const rejected = assert.rejects(start, { code: "attempt_cancelled" });
  const stop = broker.stop();
  held.resolve();
  await rejected;
  await stop;
  assert.equal(calls.length, 1);
  assert.equal(broker.active, null);
});
test("cancel during creation closes the late session", async () => {
  const held = deferred();
  const { broker, calls } = setup({ holdCreate: held.promise });
  const start = broker.start(style);
  const rejected = assert.rejects(start, { code: "attempt_cancelled" });
  await new Promise((r) => setImmediate(r));
  const stop = broker.stop();
  held.resolve();
  await rejected;
  assert.equal((await stop).state, "closed");
  assert.ok(calls.some((c) => c.method === "DELETE"));
});
test("an ambiguous create failure is held for manual inspection, never auto-retried", async () => {
  const { broker, calls } = setup({ throwCreate: true });
  await assert.rejects(broker.start(style), { code: "reactor_unavailable" });
  assert.equal(broker.info().state, "closure_unknown");
  await assert.rejects(broker.start(style), { code: "attempt_active" });
  assert.equal(calls.length, 2);
});
test("a rejected key produces a safe error and no session", async () => {
  const { broker, calls } = setup({ tokenStatus: 401 });
  await assert.rejects(broker.start(style), { code: "credentials_rejected" });
  assert.equal(calls.length, 1);
  assert.equal(broker.active, null);
  assert.ok(!JSON.stringify(broker.info()).includes(key));
});
test("token expiry outside the requested window is rejected before session creation", async () => {
  let count = 0;
  const broker = new SessionBroker({
    apiKey: key,
    request: async () => {
      count++;
      return reply({
        jwt: "x",
        expires_at: Math.floor(Date.now() / 1000) + 900,
      });
    },
  });
  await assert.rejects(broker.start(style), { code: "invalid_token_response" });
  assert.equal(count, 1);
});
test("watchdog closes a session without a browser cleanup request", async () => {
  const p = fakeProvider();
  const broker = new SessionBroker({
    apiKey: key,
    request: p.request,
    watchdogMs: 10,
    pollMs: 0,
  });
  await broker.start(style);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(broker.info().state, "closed");
  assert.ok(p.calls.some((c) => c.method === "DELETE"));
});
test("missing key and invalid style never contact the provider", async () => {
  const { broker, calls } = setup();
  broker.setKey("");
  await assert.rejects(broker.start(style), { code: "key_required" });
  await assert.rejects(broker.start("random"));
  assert.equal(calls.length, 0);
});
