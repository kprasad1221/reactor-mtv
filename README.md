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

## Then: one real Reactor test

1. Choose a PNG, JPEG or WebP source image (under 10 MB and 25 megapixels).
2. Select a music-video directing style. Keep the same source for a later comparison across channels.
3. Open **Your Reactor API key**, enter your own `rk_…` key into the local application, and select **Use key locally**. This stores it in the local server's memory; it does not contact Reactor yet.
4. Confirm the displayed credit-use checkbox and click **Generate with Reactor** once.
5. Watch the stages: authorization, connection, source upload, generation, playback, closure. Success requires a new moving picture, generated audio, and **Session closed**. Account access and available credits are required.
6. Replay or save the captured take. Changing to another channel does not generate automatically. A new take requires another explicit generation request.

Each attempt requests one **5.875-second clip** from `reactor/fast-h3-omni`, with a **30-second maximum session duration**. Reactor bills session time, so connection and generation overhead can cost more than the clip duration alone. A timeout or failed generation may still consume credits. No generation is automatically retried. The deliberately short test may time out during a slow model startup; inspect the last stage before another attempt.

If closure cannot be confirmed, generation stays blocked. Use **Retry session closure** and inspect the Reactor dashboard. Do not treat a disconnected player as evidence that billing stopped. See [Testing](docs/TESTING.md) for the acceptance checklist and troubleshooting.

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
