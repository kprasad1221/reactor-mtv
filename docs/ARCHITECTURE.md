# Architecture

## Channel model

A channel is a stable directing-style key. `styles.js` maps the key to a display name, reference, description and two prompt sections: `MUSIC DIRECTION` and `VIDEO DIRECTION`. The server constructs the prompt from the allowlisted key; it does not accept arbitrary model names, prompts, durations or provider URLs from the browser. A selected source image becomes `<Picture 1>` in H3 Omni's `reference_images` input.

Music genre, tempo and instrumentation are subordinate parts of a directing preset. They are not the top-level interaction. These are creative proposals, not measured transcriptions of the reference songs. The model generates an original soundtrack; no commercial recording is supplied.

## One-take execution

1. Decode the selected image locally, cap its long edge at 1536 pixels and encode a fresh PNG. This removes source file metadata and normalizes the upload name. The original file is not sent to the local server.
2. On an explicit Generate action, load the bundled SDK and create a unique attempt identifier. The frontend sends only the style key, attempt identifier and consent to the loopback API.
3. The broker obtains a 120-second JWT with `max_sessions: 1`, `max_session_duration_seconds: 30` and the exact H3 Omni model scope. It creates one session with that JWT. The raw key remains in the backend.
4. The browser adopts that session using the SDK, disables autoplay, sets the canvas to 4:3 and uploads the prepared reference through Reactor's SDK.
5. It enqueues exactly one 5.875-second clip. `clip_generated` and both named output tracks must arrive before playback. SDK failures and model command errors stop the attempt.
6. The received video/audio tracks share a MediaStream attached to the TV. A browser recorder captures the stream for local replay. `clip_finished` is followed by a short drain interval; it is not by itself proof that the browser displayed every frame.
7. Cleanup requests session deletion and polls its state. Only `CLOSED` or `INACTIVE` releases the broker's session lease. The independent watchdog also requests cleanup after 45 seconds from attempt start. Token constraints provide the requested provider-side duration cap.

The client uses an overall 26-second deadline after session creation returns. Slow connection, upload or generation can exhaust that budget. Cleanup does not wait behind a stuck SDK operation. A late upload completion cannot enqueue another clip after cancellation.

## Session ownership

One local server process permits one attempt at a time, including across tabs. Attempt IDs prevent one attempt's automatic cleanup from closing a different attempt. Server shutdown and the watchdog operate on the broker's own active session.

A failed create request is ambiguous if it might have reached Reactor. Without a returned session ID, the broker cannot identify the resource to delete. It retains the lease as `closure_unknown`; it never retries creation or fabricates closure. The operator must inspect their account before restarting after such a failure.

SDK clients that adopt sessions do not own their lifetime. The broker therefore verifies provider state independently of the client disconnect result.

## Media and channel switching

The free signal is generated entirely in the browser. It does not import the SDK, call the local attempt endpoint, upload a file or open a Reactor session. It verifies the player's local video and audio path only.

Channel changes select a style and replay an existing captured take, if any. Selecting a style is free. During an attempt the channel and source controls are locked; use Stop to end the attempt before changing direction. A new source clears prior channel takes to avoid confusing outputs from different images. All media stays in browser memory until the user saves a take; page reload discards it.

The visible media monitor counts displayed video frames and detects nonzero audio samples. These observations do not establish musical quality, source-image fidelity, or audiovisual synchronization. Those require reviewing the generated result.

## Upstream contracts

- [H3 Omni model API](https://www.reactor.inc/models/fast-h3-omni/api): reference images, discrete durations, canvas, queue commands and output tracks.
- [Authentication](https://docs.reactor.inc/authentication): token scope and session constraints.
- [Sessions](https://docs.reactor.inc/concepts/sessions): lifecycle and billing boundaries.
- [SDK class](https://docs.reactor.inc/sdk-reference/reactor-class) and [official protocol source](https://github.com/reactor-team/reactor-client-sdks/tree/main/crates/reactor-protocol/src): command responses, adopted sessions and HTTP shapes.

Dependencies are pinned in `package-lock.json`. Revalidate these contracts when upgrading; offline fixtures validate this application's behavior, not upstream service availability.
