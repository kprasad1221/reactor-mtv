# Reactor MTV

An independent music-video experiment: choose a source image, change channels to select a directing style, and generate a short audiovisual take with Reactor H3 Omni.

This repository contains the local application, the real Reactor integration, and a free browser-generated test signal. The six channels map to curated music and video direction. There is no prompt editor or prompt export workflow.

**Status:** local integration implemented; offline lifecycle/security tests pass. A credentialed H3 generation has **not yet been verified** for this release. Follow the live acceptance test below before describing this as a working public generation demo. The previously published static preview is not this local integration.

## Run locally

Requires Node.js 22 or newer (Node 24 recommended) and a current desktop Chrome or Edge browser.

```sh
git clone https://github.com/kprasad1221/reactor-mtv.git
cd reactor-mtv
npm ci
npm run dev
```

Open **http://127.0.0.1:8094**. `npm run dev` builds the pinned Reactor SDK bundle and starts the local server. On Windows PowerShell, use `npm.cmd ci` and `npm.cmd run dev` if PowerShell blocks `npm.ps1`.

For an existing checkout, pull the latest code before installing dependencies. If you have local changes, commit or stash them first.

```sh
git pull --ff-only
npm ci
npm run dev
```

Stop the server with **Ctrl+C**. A different port is supported with `npm run dev -- --port 8095`.

## First: the free test

Click **Play free test pattern**. Confirm a moving yellow marker, advancing time, and a quiet 440 Hz tone. The signal monitor should report displayed frames and an audio signal. Check Sound off/on, Stop, and channel switching.

This test uses Canvas, Web Audio and a browser MediaStream. It makes **no Reactor request**, needs no credentials and does not test Reactor authentication or WebRTC connectivity.

## Next: test the image upload only (v0.2.1)

This isolates the stage where the previous MTV attempt stopped. It creates a real bounded session, uploads the prepared PNG, then closes the session. **It never sends enqueue or play.** It is not a free/offline check: connection and upload can use Reactor credits, with the same 30-second provider session limit and no automatic retry.

1. Choose a PNG, JPEG or WebP source image (under 10 MB and 25 megapixels).
2. Open **Your Reactor API key**, enter your own key into the local application, and select **Use key locally**. This stores it in local server memory without contacting Reactor.
3. Read and select the credit-use checkbox, then click **Test upload only** once.
4. Expect **Connecting to Reactor → Uploading source image → Source image uploaded → Closing Reactor session → Session closed**, followed by **Upload succeeded**. No generated picture or soundtrack is expected.
5. If it fails, select **Copy test log** in the signal monitor and share that log. It retains the failing stage even after closure, plus an allowlisted SDK error code, HTTP status and operation when available. It omits raw SDK messages, credentials and signed storage URLs. Do not share a raw browser network export.
6. Check the Reactor dashboard for the ended session before another attempt. **Stop Reactor** cancels an in-progress test; Ctrl+C stops the local server after cleanup.

The browser connection policy now permits HTTPS storage uploads. The old policy allowed only Reactor hosts, although the SDK obtains a signed URL and sends image bytes directly to object storage. This is a plausible cause of the earlier upload failure, not a credentialed diagnosis. A browser-policy rejection is now reported explicitly without recording its URL. The installed SDK 3.3.0 accepts the prepared PNG Blob with a name override; that input type is supported.

## Then: one real generation

After a successful upload test, choose the directing style, select fresh credit consent and click **Generate with Reactor** once. Watch upload, generation, playback and closure. Success requires a new moving picture, generated audio and **Session closed**. Replay or save the captured take; changing channels never generates automatically.

Each generation requests one **5.875-second clip** from `reactor/fast-h3-omni`, with a **30-second maximum session duration**. Reactor bills session time, so overhead can cost more than the clip duration alone. A timeout or failed attempt may still consume credits. The overall local deadline is 26 seconds after creation returns; a slow startup can exhaust it. No generation or upload is automatically retried.

If closure cannot be confirmed, both test and generation stay blocked. Use **Retry session closure** and inspect the Reactor dashboard. A disconnected player is not evidence that billing stopped. See [Testing](docs/TESTING.md).

## Credentials and deployment

The default server binds only to `127.0.0.1`. Credentials are accepted only through the local API, guarded by exact Host/Origin checks, Fetch Metadata checks and a process-specific CSRF token. API keys are never returned by the API, written to app storage, placed in URLs, or included in diagnostics. The password input is cleared immediately after submission.

The backend exchanges the key for a short-lived token limited to one H3 Omni session with a duration cap. It creates the session, owns its identifier and verifies termination. The browser receives only that scoped token. An independent server watchdog requests cleanup if the browser disappears. See [Security](docs/SECURITY.md) for limitations and the threat model.

Alternatively, copy `.env.example` to `.env.local` and set `REACTOR_API_KEY` there. This optional method **does store a key on disk**. Environment files are ignored by Git and are not served. The local password form is the default if you prefer memory-only entry. An environment key is reloaded at server restart even if you selected Forget key during the previous run.

**Do not expose this server through a tunnel or public reverse proxy.** Non-loopback preview mode disables the Reactor API. A public hosted service accepting personal credentials is outside this release: it needs authenticated, isolated user sessions and a separate deployment/security review. Public GitHub access does not mean public access to a running local server.

## Development

```sh
npm test
npm run build
npm start
```

`npm test` uses a fake provider and SDK for contract, cancellation, credential-boundary and lifecycle tests. It never calls Reactor and must not be represented as live-generation evidence. `npm run build` bundles the exact SDK version from the lockfile; the generated vendor bundle is ignored by Git.

| Location | Responsibility |
| --- | --- |
| `dist/src/styles.js` | Stable channel keys, research references, music/video prompt mapping |
| `dist/src/reactor-session.js` | One-attempt connection, upload, enqueue and playback lifecycle |
| `src/session-broker.mjs` | Server-only key, token scope, session ownership and verified closure |
| `server.mjs` | Loopback HTTP API, request protections and static delivery |
| `dist/src/media.js` | Source preparation, free signal and local stream capture |
| `dist/src/app.js` | Controls, observable stages and in-memory channel takes |

Read [Architecture](docs/ARCHITECTURE.md), [Design research](docs/DESIGN.md), [Security](docs/SECURITY.md), and [Testing](docs/TESTING.md).

## Scope

Available: six directing styles; user-supplied source image; local picture/audio test; explicit one-take Reactor flow; Stop; bounded session handling; in-memory channel playback and browser recording where supported.

Not implemented: continuous live redirection within a running generation, uploaded song timing, automatic playlists, persistent media hosting, or a public multi-user credential service. Generated audio follows the selected music direction; precise rhythm, subject preservation, cuts and style fidelity require live evaluation. Captures are browser recordings of the received stream, not guaranteed frame-exact provider masters. Reloading clears source images and captured takes.

This is an independent experiment, not affiliated with MTV. Historical videos are research references; their footage and audio are not bundled.
