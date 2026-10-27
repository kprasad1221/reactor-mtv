import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { SessionBroker, BrokerError } from "./src/session-broker.mjs";
import { STYLES } from "./dist/src/styles.js";
const root = fileURLToPath(new URL("./dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
};
async function readJSON(req) {
  let text = "";
  for await (const part of req) {
    text += part;
    if (Buffer.byteLength(text) > 4096)
      throw new BrokerError(413, "request_too_large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BrokerError(400, "invalid_json");
  }
}
export function createApp({
  apiEnabled = true,
  apiKey = "",
  request = fetch,
  watchdogMs,
  pollMs,
} = {}) {
  const broker = new SessionBroker({ apiKey, request, watchdogMs, pollMs });
  const csrf = randomBytes(32).toString("hex");
  const server = createServer(async (req, res) => {
    const json = (code, data) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https: wss://*.reactor.inc; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.startsWith("/api/")) {
        const port = req.socket.localPort;
        const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
        if (!apiEnabled || !hosts.includes(req.headers.host))
          return json(403, { error: "local_only" });
        if (
          req.headers["sec-fetch-site"] &&
          !["same-origin", "none"].includes(req.headers["sec-fetch-site"])
        )
          return json(403, { error: "origin_rejected" });
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`
        )
          return json(403, { error: "origin_rejected" });
        if (pathname === "/api/config" && req.method === "GET")
          return json(200, { ...broker.info(), csrf, local: true });
        if (req.method !== "POST")
          return json(405, { error: "method_not_allowed" });
        if (
          req.headers.origin !== `http://${req.headers.host}` ||
          req.headers["content-type"] !== "application/json"
        )
          return json(403, { error: "origin_rejected" });
        const provided = Buffer.from(req.headers["x-station-csrf"] || "");
        const expected = Buffer.from(csrf);
        if (
          provided.length !== expected.length ||
          !timingSafeEqual(provided, expected)
        )
          return json(403, { error: "csrf_rejected" });
        const body = await readJSON(req);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json(400, { error: "invalid_json" });
        if (pathname === "/api/credentials") {
          broker.setKey(body.key);
          return json(200, broker.info());
        }
        if (pathname === "/api/attempt") {
          if (body.consent !== true)
            return json(400, { error: "consent_required" });
          if (!STYLES.some((s) => s.id === body.styleId))
            return json(400, { error: "invalid_style" });
          if (
            typeof body.attemptId !== "string" ||
            !/^[a-f0-9-]{36}$/.test(body.attemptId)
          )
            return json(400, { error: "invalid_attempt" });
          return json(200, await broker.start(body.styleId, body.attemptId));
        }
        if (pathname === "/api/stop") {
          if (
            typeof body.attemptId !== "string" ||
            !/^[a-f0-9-]{36}$/.test(body.attemptId)
          )
            return json(400, { error: "invalid_attempt" });
          return json(200, await broker.stop(body.attemptId));
        }
        return json(404, { error: "not_found" });
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (
        !path.startsWith(root.endsWith(sep) ? root : root + sep) ||
        pathname.split("/").some((p) => p.startsWith("."))
      ) {
        res.writeHead(403);
        return res.end();
      }
      const info = await stat(path);
      if (!info.isFile()) throw Error("Not a file");
      res.setHeader(
        "Content-Type",
        types[extname(path)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = info.size - 1,
        status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!range || (!range[1] && !range[2])) {
          res.writeHead(416);
          return res.end();
        }
        if (!range[1]) start = Math.max(0, info.size - Number(range[2]));
        else {
          start = Number(range[1]);
          if (range[2]) end = Math.min(end, Number(range[2]));
        }
        if (start > end || start >= info.size) {
          res.writeHead(416);
          return res.end();
        }
        status = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader("Content-Length", end - start + 1);
      res.writeHead(status);
      if (req.method === "HEAD") return res.end();
      createReadStream(path, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(error instanceof BrokerError ? error.status : 404, {
        error: error instanceof BrokerError ? error.code : "not_found",
      });
    }
  });
  server.station = broker;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
export function startServer() {
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const option = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  const port = Number(option("--port", process.env.PORT || 8094));
  const host = option("--host", "127.0.0.1");
  const apiEnabled = ["127.0.0.1", "localhost"].includes(host);
  const server = createApp({
    apiEnabled,
    apiKey: apiEnabled ? process.env.REACTOR_API_KEY || "" : "",
  });
  server.listen(port, host, () =>
    console.log(
      `Reactor MTV — http://${host}:${port}\n${apiEnabled ? "Local Reactor controls enabled. Free test pattern never contacts Reactor." : "Read-only preview. Credentials and Reactor API disabled."}`,
    ),
  );
  server.on("error", () => {
    console.error("Server could not start. Check the port is available.");
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const r = await server.station.stop();
    console.log(
      r.state === "closure_unknown"
        ? "Session closure unconfirmed: check your Reactor dashboard."
        : "Station stopped.",
    );
    server.close();
    server.closeAllConnections();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) startServer();
