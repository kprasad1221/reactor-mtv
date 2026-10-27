import { MODEL, CLIP_SECONDS, styleFor } from "./styles.js";
const brokerCodes = new Set([
  "credentials_rejected",
  "key_required",
  "attempt_active",
  "attempt_cancelled",
  "reactor_unavailable",
  "session_create_failed",
  "token_failed",
  "invalid_token_response",
  "invalid_session_response",
]);

export class AttemptError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

// Keep provider text, signed URLs and credentials out of diagnostics.
const sdkCodes = new Set([
  "NETWORK_ERROR", "UNAUTHORIZED", "NOT_FOUND", "CONFLICT", "RATE_LIMITED",
  "BAD_REQUEST", "SERVER_ERROR", "VERSION_MISMATCH", "DECODE_FAILED",
  "INVALID_STATE", "SESSION_TERMINAL", "MESSAGE_TOO_LARGE", "TRANSPORT_ERROR",
  "DISCONNECTED", "REQUEST_TIMEOUT", "ABORTED", "INTERNAL_ERROR",
]);
function sdkDetails(error) {
  const details = {};
  if (sdkCodes.has(error?.code)) details.sdkCode = error.code;
  if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599)
    details.httpStatus = error.status;
  if (["connect", "uploadFile", "sendCommand"].includes(error?.operation))
    details.operation = error.operation;
  return details;
}

// One session, at most one enqueue. No reconnection, retry, or speculative generation.
export class ReactorAttempt {
  constructor({
    api,
    makeReactor,
    onStage = () => {},
    onDiagnostic = () => {},
    onTracks = async () => {},
    timeoutMs = 26000,
    drainMs = 350,
  }) {
    Object.assign(this, {
      api,
      makeReactor,
      onStage,
      onDiagnostic,
      onTracks,
      timeoutMs,
      drainMs,
    });
    this.controller = new AbortController();
    this.events = [];
    this.listeners = new Set();
    this.tracks = new Map();
    this.started = false;
    this.stage = "idle";
    this.id = crypto.randomUUID();
  }
  emit(event) {
    this.events.push(event);
    for (const listener of this.listeners) listener();
  }
  change(stage) {
    this.stage = stage;
    this.onStage(stage);
  }
  check() {
    if (this.controller.signal.aborted) throw this.controller.signal.reason;
  }
  fail(code, details) {
    if (!this.controller.signal.aborted)
      this.controller.abort(new AttemptError(code, details));
  }
  cancel() {
    this.fail("cancelled");
    if (this.requested) {
      // Cancel creation promptly; final cleanup still handles a late response.
      void this.api("/api/stop", { attemptId: this.id }).catch(() => {});
    }
  }
  async guard(promise) {
    this.check();
    const signal = this.controller.signal;
    let abort;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  async waitFor(predicate) {
    this.check();
    if (predicate()) return;
    let listener;
    try {
      await this.guard(
        new Promise((resolve) => {
          listener = () => {
            if (predicate()) resolve();
          };
          this.listeners.add(listener);
        }),
      );
    } finally {
      this.listeners.delete(listener);
    }
  }
  async command(type, data, replyType) {
    this.check();
    const reply = await this.guard(this.reactor.sendCommand(type, data));
    this.check();
    if (replyType && reply?.type !== replyType)
      throw new AttemptError("command_not_acknowledged");
    return reply;
  }
  async run({ styleId, image, uploadOnly = false }) {
    if (this.started) throw new AttemptError("attempt_already_used");
    styleFor(styleId);
    if (!image || !image.size) throw new AttemptError("image_required");
    if (typeof uploadOnly !== "boolean") throw new AttemptError("invalid_mode");
    this.started = true;
    let timer,
      result,
      failure,
      requested = false;
    const bindings = [];
    try {
      this.change("preflight");
      this.reactor = await this.guard(
        this.makeReactor({
          modelName: MODEL,
          logLevel: "off",
          readyTimeoutMs: 20000,
          controlRequestTimeoutMs: 5000,
        }),
      );
      const bind = (event, fn) => {
        this.reactor.on(event, fn);
        bindings.push([event, fn]);
      };
      bind("statusChanged", (status) => this.emit({ type: "status", status }));
      bind("error", (error) => this.fail("reactor_sdk_error", sdkDetails(error)));
      bind("message", (msg) => {
        if (msg.type === "command_error") this.fail("command_refused");
        if (msg.type === "clip_failed") this.fail("generation_failed");
        this.emit({ type: msg.type });
      });
      bind("runtimeMessage", (msg) => {
        if (msg.type === "moderation" && msg.data?.action === "terminate")
          this.fail("generation_stopped");
      });
      bind("trackReceived", (name, track) => {
        if (["main_video", "main_audio"].includes(name))
          this.tracks.set(name, track);
        this.emit({ type: "track" });
      });
      this.check();
      this.change("authorizing");
      requested = true;
      this.requested = true;
      // Do not abandon the POST: a late response may represent a billable session.
      const attempt = await this.api("/api/attempt", {
        styleId,
        consent: true,
        attemptId: this.id,
      });
      this.check();
      timer = setTimeout(() => this.fail("attempt_timeout"), this.timeoutMs);
      this.change("connecting");
      await this.guard(
        this.reactor.connect(attempt.jwt, { sessionId: attempt.sessionId }),
      );
      await this.waitFor(() => this.reactor.getStatus() === "ready");
      await this.command(
        "set_autoplay",
        { enabled: false },
        "autoplay_accepted",
      );
      if (!uploadOnly)
        await this.command("set_canvas", { aspect: "4:3" }, "canvas_accepted");
      this.change("uploading");
      this.onDiagnostic(`Sending source.png · ${image.size} bytes · image/png · SDK 3.3.0`);
      const reference = await this.guard(
        this.reactor.uploadFile(image, { name: "source.png" }),
      );
      this.check();
      if (!reference?.uploadId || reference.mimeType !== "image/png" || reference.size !== image.size)
        throw new AttemptError("invalid_upload_response");
      this.change("uploaded");
      this.onDiagnostic(`Upload confirmed · ${reference.size} bytes · image/png`);
      if (uploadOnly) {
        result = { completed: false, uploaded: true };
      } else {
        this.change("generating");
        await this.command(
          "enqueue",
          {
            prompt: attempt.prompt,
            seconds: CLIP_SECONDS,
            reference_images: [reference],
          },
          "clip_queued",
        );
        await this.waitFor(() =>
          this.events.some((e) => e.type === "clip_generated"),
        );
        await this.waitFor(
          () => this.tracks.has("main_video") && this.tracks.has("main_audio"),
        );
        await this.guard(this.onTracks([...this.tracks.values()]));
        this.change("playing");
        // play acknowledges without a reply; errors arrive through the SDK error event.
        await this.command("play", {});
        await this.waitFor(() =>
          this.events.some((e) => e.type === "clip_finished"),
        );
        await this.guard(
          new Promise((resolve) => setTimeout(resolve, this.drainMs)),
        );
        result = { completed: true, uploaded: true };
      }
    } catch (error) {
      failure =
        error instanceof AttemptError
          ? error
          : new AttemptError(
              brokerCodes.has(error?.code) ? error.code : "attempt_failed",
              sdkDetails(error),
            );
      this.failedStage = this.stage;
      failure.failedStage = this.failedStage;
      this.onDiagnostic(`Failure before cleanup · stage: ${this.failedStage} · ${failure.code}`);
    } finally {
      clearTimeout(timer);
      this.change("closing");
      for (const [event, fn] of bindings) this.reactor.off(event, fn);
      // Server cleanup must not wait behind an SDK connect/upload that has stalled.
      const disconnect = this.reactor
        ? Promise.resolve()
            .then(() => this.reactor.disconnect())
            .catch(() => {})
        : Promise.resolve();
      let closed;
      try {
        closed = requested
          ? await this.api("/api/stop", { attemptId: this.id })
          : { state: "idle" };
      } catch {
        closed = { state: "closure_unknown" };
      }
      await Promise.race([
        disconnect,
        new Promise((resolve) => {
          const t = setTimeout(resolve, 1000);
          t.unref?.();
        }),
      ]);
      this.closure = closed.state;
      this.change(
        closed.state === "closure_unknown" ? "closure_unknown" : "closed",
      );
      if (closed.state === "closure_unknown")
        failure = Object.assign(new AttemptError("closure_unknown"), { failedStage: this.failedStage });
    }
    if (failure) throw failure;
    return { ...result, closure: this.closure };
  }
}
