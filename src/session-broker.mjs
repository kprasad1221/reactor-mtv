import { randomUUID } from "node:crypto";
import { MODEL, CLIP_SECONDS, promptFor } from "../dist/src/styles.js";
const API = "https://api.reactor.inc";
export class BrokerError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export class SessionBroker {
  constructor({
    apiKey = "",
    request = fetch,
    watchdogMs = 45000,
    pollMs = 400,
  } = {}) {
    this.key = apiKey;
    this.request = request;
    this.watchdogMs = watchdogMs;
    this.pollMs = pollMs;
    this.active = null;
    this.last = "idle";
  }
  info() {
    return {
      configured: Boolean(this.key),
      state: this.active?.state || this.last,
      attemptId: this.active?.id || null,
      model: MODEL,
      seconds: CLIP_SECONDS,
      sessionLimitSeconds: 30,
    };
  }
  setKey(key) {
    if (this.active) throw new BrokerError(409, "attempt_active");
    if (
      typeof key !== "string" ||
      key.length > 512 ||
      (key && !/^rk_[A-Za-z0-9_-]{8,}$/.test(key))
    )
      throw new BrokerError(400, "invalid_key");
    this.key = key;
  }
  async call(path, options = {}) {
    return this.request(API + path, {
      ...options,
      headers: { "Reactor-API-Version": "1", ...options.headers },
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  }
  async start(styleId, attemptId = randomUUID()) {
    const prompt = promptFor(styleId);
    if (this.active) throw new BrokerError(409, "attempt_active");
    if (!this.key) throw new BrokerError(503, "key_required");
    const a = {
      id: attemptId,
      state: "starting",
      cancelled: false,
      sessionId: null,
      jwt: null,
      createSent: false,
    };
    this.active = a;
    a.timer = setTimeout(() => {
      void this.stop();
    }, this.watchdogMs);
    a.timer.unref?.();
    a.creating = this.create(a);
    try {
      await a.creating;
      if (a.cancelled) {
        await this.stop();
        throw new BrokerError(409, "attempt_cancelled");
      }
      a.state = "active";
      return {
        attemptId: a.id,
        sessionId: a.sessionId,
        jwt: a.jwt,
        model: MODEL,
        seconds: CLIP_SECONDS,
        prompt,
      };
    } catch (error) {
      if (a.sessionId) await this.stop();
      else if (a.createSent) {
        a.state = "closure_unknown";
        clearTimeout(a.timer);
      } else {
        clearTimeout(a.timer);
        if (this.active === a) this.active = null;
        this.last = "idle";
      }
      throw error instanceof BrokerError
        ? error
        : new BrokerError(502, "reactor_unavailable");
    }
  }
  async create(a) {
    const token = await this.call("/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Reactor-API-Key": this.key,
      },
      body: JSON.stringify({
        expires_after: 120,
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: [MODEL] } },
            constraints: { max_sessions: 1, max_session_duration_seconds: 30 },
          },
        ],
      }),
    });
    if (!token.ok)
      throw new BrokerError(
        502,
        token.status === 401 || token.status === 403
          ? "credentials_rejected"
          : "token_failed",
      );
    const t = await token.json();
    if (
      typeof t.jwt !== "string" ||
      !Number.isFinite(t.expires_at) ||
      t.expires_at * 1000 < Date.now() + 45000 ||
      t.expires_at * 1000 > Date.now() + 180000
    )
      throw new BrokerError(502, "invalid_token_response");
    a.jwt = t.jwt;
    if (a.cancelled) throw new BrokerError(409, "attempt_cancelled");
    a.createSent = true;
    const created = await this.call("/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${a.jwt}`,
      },
      body: JSON.stringify({
        model: { name: MODEL },
        client_info: { sdk_type: "javascript", sdk_version: "3.3.0" },
        supported_transports: [{ protocol: "webrtc", version: "1.0" }],
      }),
    });
    if (!created.ok) {
      if (created.status >= 400 && created.status < 500) a.createSent = false;
      throw new BrokerError(502, "session_create_failed");
    }
    const body = await created.json();
    if (
      typeof body.session_id !== "string" ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(body.session_id)
    )
      throw new BrokerError(502, "invalid_session_response");
    a.sessionId = body.session_id;
  }
  async stop(attemptId) {
    const a = this.active;
    if (!a) return { state: this.last };
    if (attemptId && a.id !== attemptId)
      throw new BrokerError(409, "attempt_active");
    a.cancelled = true;
    if (a.closing) return a.closing;
    a.closing = this.close(a).finally(() => {
      a.closing = null;
    });
    return a.closing;
  }
  async close(a) {
    try {
      await a.creating;
    } catch {}
    clearTimeout(a.timer);
    if (!a.sessionId) {
      if (a.createSent) {
        a.state = "closure_unknown";
        return { state: a.state };
      }
      if (this.active === a) this.active = null;
      this.last = "closed";
      return { state: "closed" };
    }
    a.state = "closing";
    try {
      // Use this attempt's scoped token, never accept an arbitrary session ID from the browser.
      await this.call("/sessions/" + a.sessionId, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${a.jwt}` },
      });
      for (let i = 0; i < 3; i++) {
        const r = await this.call("/sessions/" + a.sessionId, {
          headers: { Authorization: `Bearer ${a.jwt}` },
        });
        if (r.ok) {
          const body = await r.json();
          if (["CLOSED", "INACTIVE"].includes(body.state)) {
            a.jwt = null;
            if (this.active === a) this.active = null;
            this.last = "closed";
            return { state: "closed" };
          }
        }
        if (i < 2) await new Promise((r) => setTimeout(r, this.pollMs));
      }
    } catch {}
    a.state = "closure_unknown";
    return { state: a.state };
  }
}
