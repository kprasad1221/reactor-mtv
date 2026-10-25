import { request as httpRequest } from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
import { fakeProvider, key } from "./helpers.mjs";
const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
async function withServer(fn, options = {}) {
  const provider = fakeProvider();
  const server = createApp({
    request: provider.request,
    pollMs: 0,
    ...options,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    await fn({ server, origin, ...provider });
  } finally {
    await server.station.stop();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
test("static app and configuration make zero provider calls and do not expose keys", () =>
  withServer(
    async ({ origin, calls }) => {
      const page = await fetch(origin);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Direct the next video/);
      assert.match(
        page.headers.get("content-security-policy"),
        /frame-ancestors 'none'/,
      );
      const config = await (await fetch(origin + "/api/config")).json();
      assert.equal(config.configured, true);
      assert.ok(!JSON.stringify(config).includes(key));
      assert.equal(calls.length, 0);
      assert.equal((await fetch(origin + "/.env.local")).status, 403);
      assert.equal((await fetch(origin + "/..%2fpackage.json")).status, 403);
      assert.equal((await fetch(origin + "/media/caustics.mp4")).status, 404);
    },
    { apiKey: key },
  ));
test("reject foreign Host, Origin, Fetch Metadata and requests without CSRF", () =>
  withServer(async ({ origin, calls }) => {
    for (const headers of [
      { Host: "evil.example" },
      { Origin: "https://evil.example" },
      { "Sec-Fetch-Site": "cross-site" },
    ])
      assert.equal(
        await new Promise((resolve, reject) => {
          const request = httpRequest(
            origin + "/api/config",
            { headers },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          );
          request.on("error", reject);
          request.end();
        }),
        403,
        JSON.stringify(headers),
      );
    const cfg = await (await fetch(origin + "/api/config")).json();
    for (const headers of [
      {},
      { Origin: origin, "Content-Type": "application/json" },
      {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
        "X-Station-CSRF": cfg.csrf,
      },
      {
        Origin: origin,
        "Content-Type": "text/plain",
        "X-Station-CSRF": cfg.csrf,
      },
    ])
      assert.equal(
        (
          await fetch(origin + "/api/credentials", {
            method: "POST",
            headers,
            body: JSON.stringify({ key }),
          })
        ).status,
        403,
      );
    assert.equal(calls.length, 0);
  }));
test("credentials stay in memory, explicit consent is required, and one attempt closes", () =>
  withServer(async ({ origin, calls }) => {
    const cfg = await (await fetch(origin + "/api/config")).json();
    const post = (path, body) =>
      fetch(origin + path, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "X-Station-CSRF": cfg.csrf,
        },
        body: JSON.stringify(body),
      });
    let r = await post("/api/credentials", { key });
    assert.equal(r.status, 200);
    assert.ok(!(await r.text()).includes(key));
    assert.equal(calls.length, 0);
    assert.equal(
      (await post("/api/attempt", { styleId: "drawn-world", attemptId: id }))
        .status,
      400,
    );
    assert.equal(calls.length, 0);
    assert.equal(
      (
        await post("/api/attempt", {
          styleId: "drawn-world",
          consent: true,
          attemptId: id,
        })
      ).status,
      200,
    );
    assert.equal((await post("/api/stop", { attemptId: id })).status, 200);
    assert.equal((await post("/api/credentials", { key: "" })).status, 200);
    assert.equal(
      (await (await fetch(origin + "/api/config")).json()).configured,
      false,
    );
  }));
test("oversized and malformed requests are rejected", () =>
  withServer(async ({ origin }) => {
    const cfg = await (await fetch(origin + "/api/config")).json();
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Station-CSRF": cfg.csrf,
    };
    for (const [body, status] of [
      ["null", 400],
      ["{", 400],
      [JSON.stringify({ key: "x".repeat(5000) }), 413],
    ])
      assert.equal(
        (
          await fetch(origin + "/api/credentials", {
            method: "POST",
            headers,
            body,
          })
        ).status,
        status,
      );
  }));
test("nonlocal preview mode cannot expose credentials or mint tokens", () =>
  withServer(
    async ({ origin, calls }) => {
      assert.equal((await fetch(origin + "/api/config")).status, 403);
      assert.equal(
        (await fetch(origin + "/api/attempt", { method: "POST" })).status,
        403,
      );
      assert.equal(calls.length, 0);
    },
    { apiEnabled: false, apiKey: key },
  ));
