# Testing and live acceptance

## Automated verification

Run `npm ci`, `npm test` and `npm run build`. Tests use an in-memory provider and SDK. They cover token constraints, session ownership, cancellation during token/session creation and upload, command refusal, missing tracks, deadlines, watchdog cleanup, ambiguous closure, Host/Origin/CSRF rejection, malformed requests and disabled preview endpoints.

These tests incur no Reactor usage. They do not prove authentication, WebRTC connectivity, a successful H3 generation, a provider-enforced cap or artistic quality against a live account.

## Free local acceptance

1. Open `http://127.0.0.1:8094` after `npm run dev`.
2. Select Play free test pattern. Confirm the moving marker and timer.
3. Listen for the quiet tone. The monitor should count displayed frames and detect an audio signal.
4. Toggle Sound off/on, stop, and change channels. Verify there is no remaining tone after stop or channel change.
5. Confirm no Reactor token/session/upload requests in the browser network panel. The initial `/api/config` request is local configuration only.

## Paid H3 acceptance

Use an image you can recognize easily: a single subject with a distinctive silhouette and a clear setting. Do not use a pre-generated video as evidence. Run one attempt first; compare styles only after that succeeds and closes.

| Check | Required evidence |
| --- | --- |
| Local configuration | Key set locally; no provider call from setting it |
| Authentication | Authorization stage completes with your own account |
| Transport | Connection reaches ready and named video/audio tracks arrive |
| Input | Upload completes for the selected source image |
| Generation | One enqueue acknowledged; clip becomes generated |
| Picture | Visible new movement; displayed-frame count increases |
| Sound | Generated soundtrack is audible; audio signal is detected |
| Source fidelity | Recognizable subject/setting from the selected image |
| Direction | Camera, lighting, material and action reflect the selected channel |
| Closure | Server verifies a terminal state; dashboard agrees |
| Replay | Captured take replays after closure without opening another session |

For a second comparison, retain the same image and select Drawn into the video or Frame-by-frame fantasy. Generate once with fresh consent. Compare the two results; changing only the channel label is not evidence of directed generation.

Record browser/OS, commit, style key, last stage, observed picture/sound, closure state and whether the dashboard shows an ended session. Do not record credentials or tokens in a public issue. A 5.875-second passage may not execute every requested cut or musical gesture; judge the output, not just event success.

## Failure checks

- **Rejected key:** authorization must fail without enqueueing. Do not repeatedly try guessed credentials.
- **Stop during connection/upload/generation:** no later enqueue or new attempt; closure must be checked.
- **Second tab:** another generation request must be rejected while the first lease exists.
- **Close browser tab:** the server watchdog must attempt cleanup; verify the Reactor dashboard.
- **Connection interruption:** the app must report failure/unknown closure, not claim a completed take.
- **No sound:** check browser playback controls, system volume and the monitor. A received audio track alone does not prove sound.
- **Slow startup:** the short test deadline may expire. Check the last stage and closure before another attempt. Do not increase caps to hide a lifecycle defect.
- **Closure unknown:** retry closure and inspect the dashboard. A lost session-create response may leave no session identifier to query, requiring dashboard inspection. Restart only after the remote state is understood.

## Release evidence

For this revision, automated offline tests and the browser's free video/audio signal have been exercised. Credentialed H3 generation remains pending. Do not mark the paid acceptance matrix passed until an actual local run demonstrates all required evidence.

The public static preview is a separate artifact and may be an earlier revision. This release's acceptance target is the GitHub checkout running locally.
