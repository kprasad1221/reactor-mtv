# Next local increment: one controlled live passage

The v0.1 interface is complete as a demo without a token broker. No configuration value enables paid generation in this version.

## Existing reference and current documentation

- Existing Jukebox: kprasad1221/pixel-rhythms-jukebox, branch codex/omni-jukebox-prototype, inspected commit 2078d009140d733ae6cd71847f9bf64ba0039148.
- Its package pins @reactor-team/js-sdk 3.1.0. No AGENTS.md was present in that branch's recursive tree.
- Its server exchanges a server-held key for a model-scoped token with one session and a 30-second maximum. The old endpoint alone does not provide server-owned attempt deduplication or durable cleanup authority; do not copy it as a complete implementation.
- [Reactor authentication](https://docs.reactor.inc/authentication), [Omni schema](https://docs.reactor.inc/model-api-reference/fast-h3-omni/schema) were consulted on October 23, 2026.

## Contract for the live adapter

Keep the existing serializable recipe separate from generation and output.

1. Validate files and compose the exact prompt before exchanging credentials or starting a session.
2. Read a host key only from ignored server configuration. Bind the local host to loopback and validate origins. Never send the raw key to this browser or static host.
3. Require a deliberate operator action showing the selected model, current verified pricing, proposed one-clip limit, and cleanup expectation.
4. Own a single attempt on the server. Dedupe start requests by attempt ID; reject concurrent tabs and starts while closure is unresolved.
5. Mint one scoped grant for reactor/fast-h3-omni with max_sessions: 1 and max_session_duration_seconds: 30. Retain cleanup authority for that attempt; don't mint an unrelated grant each time.
6. Request one 5.875-second clip. No auto retries or fallback model/account.
7. Distinguish command acceptance, generated clip, requested playback, first browser-presented frame, soundtrack playback, capture completion, and provider closure.
8. Always terminate early after the attempt. Capture/export failure must never hold a session open. A browser timer or disconnect is not proof of termination.
9. Unknown cleanup blocks another attempt. Provider duration enforcement supplies the independent backstop if the app disappears.
10. Replay captured bytes locally. Do not reconnect to replay.

Provider behavior, billed duration, musical continuity, and successful Windows/iPad live capture cannot be proven by this mock.

## Future personal-key broker

Do not add a decorative key field before the broker and ownership checks exist. The future form must explain that the trusted HTTPS backend transiently handles the key. Clear it after exchange and retain only protected short-lived cleanup authority. Never log request/response bodies. Fake-key, invalid-token, cross-owner, duplicate-issuance and cleanup tests must precede real credentials.

## Future output adapter

Browser playback/capture stays independent of X output. Reuse the existing local WSL/FFmpeg broadcaster later. Verify picture and sound with a synthetic signal in a private X test destination before a paid generation. Stop encoder, terminate Reactor and end an X show are separate operations. The public demo never reaches a laptop's localhost.
