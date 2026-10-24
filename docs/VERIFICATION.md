# Verification — v0.1.0

Checked October 23, 2026. No Reactor session or X broadcast was started.

## Observed

- 15 Node checks pass: bundled assets, all genre recipes, explicit music override, custom image metadata, source-pair metadata, diagnostic redaction, mock event ordering, duplicate prevention, stale callback rejection after cancellation, errors, timeout, unknown closure, no generation code, and local HTTP/media behavior.
- Desktop Chromium rendered the station and three preset images.
- Recorded Caustics video played; the player emitted a presented-frame callback.
- Recording downloaded 1,274,763 bytes of WebM. FFmpeg decoded approximately 5.01 seconds, with 1344 × 768 VP8 picture and stereo 48 kHz Opus audio. The decoded audio was non-silent (mean -13.7 dB, peak -3.1 dB). This verifies captured data, not human listening on KP's speakers.
- Explicit MUSIC: text overrode the genre menu and appeared in the direction preview.
- Synthetic unconfirmed closure disabled another run; explicit mock confirmation restored it. Canceling another run closed it and returned to the reference image.
- A 390 × 844 embedded viewport rendered the phone layout and direction preview. Status/error notices are fixed in view on small screens.
- A custom PNG was selected through the browser file picker. It displayed as a local image, cleared the preset selection, and disabled the unavailable recorded result.
- The three original bundled clips each contain H.264 picture and AAC audio, at 1344 × 768, with 5.184-second container durations.

Two browser issues discovered during QA were corrected: a UUID fallback for non-secure preview origins, and bound wrappers around the browser timer functions used by the mock adapter.

## Limits

- Phone-sized Chromium layout inspection is not an actual iPhone/iPad Safari test.
- No Windows machine was available in this workspace. The same Node server is used locally; KP's Windows run remains the hands-on check.
- Cross-tab Web Locks are used when available. This non-secure internal preview does not expose that API; multi-tab browser behavior needs checking on HTTPS or localhost. There is no paid host or session in this demo.
- Actual blocked-autoplay, malformed upload, and recording-export failure were not forced in the browser. They have visible handling paths; lifecycle error/timeout/cancel behavior was exercised with the mock and offline tests.
- Provider limits, real session cleanup, usage charges, real generated audiovisual output, continuation, personal-key isolation, and X delivery remain unimplemented and unverified.
- The exact UI timing in mock events is synthetic, not a Reactor latency measurement.

Future integration requirements are in INTEGRATION.md.
