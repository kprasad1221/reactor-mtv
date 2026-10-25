# Security model

This release is a single-user, loopback application. Its credential boundary is the user's local computer. It is not a public BYOK hosting service and has not received an independent security audit.

## Key handling

The password form sends the key to the same-origin loopback Node server. The input is immediately cleared. The server retains the key only in process memory, unless the operator deliberately supplies it through `.env.local` or the process environment. Forget key clears the broker's current copy; restarting with an environment key loads it again.

The app does not use localStorage, sessionStorage, IndexedDB, cookies, analytics or remote scripts. It never returns the API key or writes it to logs. Error responses use fixed application codes instead of upstream response bodies. SDK console logging is disabled. The browser still temporarily handles the key during entry and can inspect its own local request; a compromised browser or local machine is outside this protection.

The local server contacts the fixed HTTPS Reactor API to mint a scoped JWT. The token expires after 120 seconds, permits the H3 Omni model and one session, and requests a 30-second maximum session duration. It is deliberately exposed to the browser because WebRTC signaling and reference upload require authorization. It must still be treated as a credential; do not share network captures or raw SDK objects.

## Request boundary

- Default bind address: `127.0.0.1`.
- API Host must exactly match `127.0.0.1:<port>` or `localhost:<port>`.
- Mutations require a matching HTTP Origin, JSON content type and a random process-specific CSRF header.
- Cross-site Fetch Metadata is rejected; no permissive CORS headers are emitted.
- Mutation request bodies are limited to 4 KiB. The source image is uploaded directly through the SDK, not through this API.
- Provider base URL, model, duration and prompt mapping are not user-supplied API parameters.
- Static delivery is confined to `dist`; environment files, dot paths and parent traversal are rejected.
- CSP restricts scripts to this origin and connections to this origin/Reactor domains. Framing, plugins and external forms are blocked. Responses are not cached.
- Non-loopback preview startup disables all credential and generation endpoints.

These protections address unsolicited web-origin requests and accidental key publication. They do not authenticate another local OS user or protect against a malicious extension, compromised dependency, local malware, developer tools access, or a reverse proxy that rewrites requests into a trusted local origin. Do not publish or tunnel this server.

## Cost and lifecycle controls

Only an explicit Generate request may mint a token. One active lease spans tabs. Starting, cancelling, closing, and unknown-closure states block another paid attempt. Automatic cleanup is bound to the attempt ID; clients cannot supply a provider session ID or URL to delete arbitrary resources.

The client deadline, server watchdog, shutdown handler and provider token constraints are independent controls. No client or network mechanism can guarantee that a remote operation stopped when its response was lost. Closure is reported as confirmed only after Reactor returns a terminal session state. If verification fails, the UI remains blocked and tells the operator to check their Reactor dashboard. Restarting the process clears memory but does not itself prove a remote session ended.

## Source and result privacy

The selected source is decoded and re-encoded locally to a metadata-free PNG, with a generic upload name. Only an explicit generation action sends it to Reactor. Reactor receives the prepared image and directing prompt and applies its own service/data policies. The local server receives neither image bytes nor result recordings.

Captured takes are browser memory objects until downloaded. They are not published to GitHub or a hosted gallery. The app does not request microphone or camera access.

## Before public credential hosting

A separate hosted design needs HTTPS, authentication, per-user authorization and isolation, credential storage/retention decisions, per-user limits, abuse prevention, durable session ownership/cleanup, controlled logs and tested deletion flows. Loopback protections are not a substitute for these. Do not enable credential entry on a static public preview as a shortcut.

## Reporting

Do not include keys, tokens, environment files or unredacted HAR/network exports in public issues. Report the application stage, a fixed error code, OS/browser versions and reproducible non-secret steps. Rotate a credential in Reactor if it was exposed.
