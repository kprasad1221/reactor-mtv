import test from "node:test";
import assert from "node:assert/strict";
import { ReactorAttempt } from "../dist/src/reactor-session.js";
import { deferred } from "./helpers.mjs";
function fixture({
  omitAudio = false,
  refuse = false,
  holdUpload,
  holdConnect,
  uploadError,
  invalidUpload = false,
  closure = "closed",
} = {}) {
  const handlers = new Map(),
    commands = [],
    apiCalls = [];
  let status = "disconnected";
  const emit = (type, ...args) => {
    for (const fn of handlers.get(type) || []) fn(...args);
  };
  const sdk = {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
    },
    off(type, fn) {
      handlers.get(type)?.delete(fn);
    },
    getStatus: () => status,
    async connect(jwt, options) {
      assert.equal(jwt, "token");
      assert.equal(options.sessionId, "session");
      if (holdConnect) await holdConnect;
      status = "ready";
      emit("statusChanged", "ready");
      emit("trackReceived", "main_video", { kind: "video" });
      if (!omitAudio) emit("trackReceived", "main_audio", { kind: "audio" });
    },
    async uploadFile(image, options) {
      assert.equal(options.name, "source.png");
      if (holdUpload) await holdUpload;
      if (uploadError) throw uploadError;
      return invalidUpload ? {} : { uploadId: "file", mimeType: "image/png", size: image.size };
    },
    async disconnect() {
      status = "disconnected";
    },
    async sendCommand(type, data) {
      commands.push({ type, data });
      if (refuse && type === "set_canvas") {
        emit("message", { type: "command_error" });
        return;
      }
      if (type === "enqueue") {
        emit("message", { type: "clip_generated" });
        return { type: "clip_queued" };
      }
      if (type === "play") {
        emit("message", { type: "clip_finished" });
        return;
      }
      return {
        type: type === "set_canvas" ? "canvas_accepted" : "autoplay_accepted",
      };
    },
  };
  const attempt = new ReactorAttempt({
    api: async (path, body) => {
      apiCalls.push({ path, body });
      return path === "/api/stop"
        ? { state: closure }
        : {
            jwt: "token",
            sessionId: "session",
            prompt: "MUSIC DIRECTION\nMusic\nVIDEO DIRECTION\nPicture",
          };
    },
    makeReactor: async () => sdk,
    timeoutMs: 60,
    drainMs: 0,
  });
  return { attempt, commands, apiCalls, sdk };
}
const input = { styleId: "drawn-world", image: new Blob(["png"]) };
test("one source image and style prompt are enqueued; early events are not lost", async () => {
  const f = fixture();
  const result = await f.attempt.run(input);
  assert.equal(result.closure, "closed");
  const enqueue = f.commands.filter((c) => c.type === "enqueue");
  assert.equal(enqueue.length, 1);
  assert.equal(enqueue[0].data.seconds, 5.875);
  assert.deepEqual(enqueue[0].data.reference_images, [{ uploadId: "file", mimeType: "image/png", size: input.image.size }]);
  assert.equal(
    f.commands.find((c) => c.type === "set_canvas").data.aspect,
    "4:3",
  );
  assert.equal(f.apiCalls.at(-1).path, "/api/stop");
  assert.equal(f.apiCalls[0].body.attemptId, f.apiCalls.at(-1).body.attemptId);
});
test("missing audio track times out and closes instead of claiming success", async () => {
  const f = fixture({ omitAudio: true });
  await assert.rejects(f.attempt.run(input), { code: "attempt_timeout" });
  assert.equal(f.apiCalls.at(-1).path, "/api/stop");
  assert.ok(!f.commands.some((c) => c.type === "play"));
});
test("command refusal never enqueues generation", async () => {
  const f = fixture({ refuse: true });
  await assert.rejects(f.attempt.run(input), { code: "command_refused" });
  assert.ok(!f.commands.some((c) => c.type === "enqueue"));
  assert.equal(f.attempt.closure, "closed");
});
test("cancel during upload cannot send a late enqueue", async () => {
  const held = deferred();
  const f = fixture({ holdUpload: held.promise });
  const run = f.attempt.run(input);
  const rejected = assert.rejects(run, { code: "cancelled" });
  await new Promise((r) => setImmediate(r));
  f.attempt.cancel();
  await rejected;
  held.resolve();
  await new Promise((r) => setImmediate(r));
  assert.ok(!f.commands.some((c) => c.type === "enqueue"));
  assert.equal(f.attempt.closure, "closed");
});
test("stalled SDK connection cannot block server cleanup", async () => {
  const held = deferred();
  const f = fixture({ holdConnect: held.promise });
  await assert.rejects(f.attempt.run(input), { code: "attempt_timeout" });
  assert.equal(f.apiCalls.at(-1).path, "/api/stop");
  held.resolve();
});
test("unconfirmed closure fails the test even when generation completed", async () => {
  const f = fixture({ closure: "closure_unknown" });
  await assert.rejects(f.attempt.run(input), { code: "closure_unknown" });
});
test("invalid source or directing key never creates a session", async () => {
  const f = fixture();
  await assert.rejects(f.attempt.run({ ...input, image: null }), {
    code: "image_required",
  });
  await assert.rejects(f.attempt.run({ ...input, styleId: "unknown" }));
  assert.equal(f.apiCalls.length, 0);
});

test("safe authorization errors survive the adapter without exposing provider text", async () => {
  const f = fixture();
  f.attempt.api = async (path) => {
    if (path === "/api/attempt")
      throw Object.assign(Error("private upstream text"), {
        code: "credentials_rejected",
      });
    return { state: "idle" };
  };
  await assert.rejects(
    f.attempt.run(input),
    (error) =>
      error.code === "credentials_rejected" &&
      !error.message.includes("private"),
  );
});

test("upload-only confirms the reference and closes without enqueue, play or canvas commands", async () => {
  const f = fixture();
  const stages = [], diagnostics = [];
  f.attempt.onStage = stage => stages.push(stage);
  f.attempt.onDiagnostic = text => diagnostics.push(text);
  const result = await f.attempt.run({ ...input, uploadOnly: true });
  assert.deepEqual(result, { uploaded: true, completed: false, closure: "closed" });
  assert.deepEqual(f.commands.map(c => c.type), ["set_autoplay"]);
  assert.ok(stages.includes("uploaded"));
  assert.equal(stages.at(-1), "closed");
  assert.match(diagnostics.join("\n"), /Upload confirmed/);
  assert.equal(f.apiCalls.filter(c => c.path === "/api/attempt").length, 1);
  assert.equal(f.apiCalls.at(-1).path, "/api/stop");
});
test("upload failure retains the failed stage and safe SDK fields after cleanup", async () => {
  const f = fixture({ uploadError: Object.assign(Error("secret rk_PRIVATE https://storage.example/image?signature=SECRET"), {
    code: "UNAUTHORIZED", operation: "uploadFile", status: 403,
  }) });
  await assert.rejects(f.attempt.run({ ...input, uploadOnly: true }), error => {
    assert.equal(error.failedStage, "uploading");
    assert.deepEqual(error.details, { sdkCode: "UNAUTHORIZED", httpStatus: 403, operation: "uploadFile" });
    assert.ok(!JSON.stringify(error).includes("SECRET"));
    assert.ok(!error.message.includes("PRIVATE"));
    return true;
  });
  assert.equal(f.attempt.stage, "closed");
  assert.ok(!f.commands.some(c => c.type === "enqueue"));
});
test("unknown SDK fields and provider messages are excluded from diagnostics", async () => {
  const f = fixture({ uploadError: { code: "rk_PRIVATE", operation: "Bearer SECRET", status: "403", message: "secret" } });
  await assert.rejects(f.attempt.run({ ...input, uploadOnly: true }), error => {
    assert.deepEqual(error.details, {});
    return true;
  });
});
test("an incomplete upload response cannot pass the upload test", async () => {
  const f = fixture({ invalidUpload: true });
  await assert.rejects(f.attempt.run({ ...input, uploadOnly: true }), { code: "invalid_upload_response", failedStage: "uploading" });
  assert.equal(f.attempt.closure, "closed");
});
test("upload-only timeout closes and cannot enqueue after a late upload", async () => {
  const held = deferred();
  const f = fixture({ holdUpload: held.promise });
  await assert.rejects(f.attempt.run({ ...input, uploadOnly: true }), { code: "attempt_timeout", failedStage: "uploading" });
  held.resolve();
  await new Promise(r => setImmediate(r));
  assert.ok(!f.commands.some(c => c.type === "enqueue"));
  assert.equal(f.attempt.closure, "closed");
});
test("upload-only cancellation closes and cannot enqueue after a late upload", async () => {
  const held = deferred();
  const f = fixture({ holdUpload: held.promise });
  const run = f.attempt.run({ ...input, uploadOnly: true });
  const rejected = assert.rejects(run, { code: "cancelled", failedStage: "uploading" });
  await new Promise(r => setImmediate(r));
  f.attempt.cancel();
  await rejected;
  held.resolve();
  await new Promise(r => setImmediate(r));
  assert.ok(!f.commands.some(c => c.type === "enqueue"));
  assert.equal(f.attempt.closure, "closed");
});
test("upload success with unknown closure is not reported as a passed test", async () => {
  const f = fixture({ closure: "closure_unknown" });
  await assert.rejects(f.attempt.run({ ...input, uploadOnly: true }), { code: "closure_unknown" });
});
