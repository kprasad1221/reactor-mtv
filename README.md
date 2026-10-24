# Reactor MTV

A little music-video station you can direct. Pick an image, choose the music, and give the next scene somewhere to go.

An early Pixel Rhythms Labs playground by KP. This is a separate project from the Jukebox.

## Run on your Windows laptop

Requires **Node 22 or newer**. The Node 24 installation used for the Jukebox works here. No npm package installation or API key is needed.

Download this repository with **Code → Download ZIP**, extract it, and put the project folder at **D:\Projects\reactor-mtv**. Make sure package.json is directly inside that folder.

In PowerShell:

~~~powershell
cd D:\Projects\reactor-mtv
npm.cmd run dev
~~~

Open **http://127.0.0.1:8094**.

1. Press **Play recorded example** to watch and hear a Deep Ocean clip.
2. Choose another image, a genre, and edit **What should happen?**
3. Press **Preview direction** to see the composed brief. Expand **See the exact prompt** to copy it or save a recipe.
4. Open **Inside the station** to rehearse success, failure, timeout, cancellation, and uncertain closure. These are explicitly synthetic tests.
5. For a capture test, open that drawer first, play an example, then press **Record example** while it plays. Save the take after it finishes.

Stop the app with **Ctrl+C** in PowerShell. The demo has no paid session to terminate.

macOS/Linux: run npm run dev in this folder. Optional alternative port: npm run dev -- --port 8095.

## What works in v0.1.0

- Three actual Deep Ocean reference images with matched original recorded clips.
- Local PNG/JPEG/WebP uploads, six genre directions, editable action, and deterministic VISUAL / MUSIC composition.
- Explicit MUSIC: lines override the genre menu and disclose the override in the interface.
- Recorded playback is labeled with its original recipe; changing a genre never relabels or remakes the old clip.
- Local recipe exports, allowlisted diagnostic logs, mock lifecycle tests, and recording of existing media.
- A lightweight local static server with byte-range video support. No third-party runtime dependencies.

**This version is the no-spend demo.** It has no Reactor SDK, key input, token broker, paid generation route, or X broadcaster. The local version runs the same tested interface as the hosted demo.

## What comes next

The next bounded increment is a protected local Omni adapter through this same interface. The proposed test is one 5.875-second clip, one active attempt, max_sessions: 1, and a provider-enforced 30-second session limit, with explicit termination and confirmed closure. These are implementation requirements, not a claim that this demo connects to Reactor.

An operator must deliberately approve a displayed paid test before it runs. No retries, automatic connections on reload, or fallback accounts. Personal-key web mode, continuation, and X delivery remain later work.

The existing Jukebox's JS SDK checkpoint was **3.1.0**, inspected at commit 2078d009140d733ae6cd71847f9bf64ba0039148. It is a reference for the next integration, not an installed dependency here.

## Files

| File | Purpose |
| --- | --- |
| dist/index.html, dist/style.css | Station layout and visual identity |
| dist/src/core.js | Recipes, diagnostic allowlist, mock adapter |
| dist/src/app.js | Player, local image selection, UI, capture |
| dist/original-recipes.json | Original media metadata, public source links and SHA-256 hashes |
| dist/media/ | Bundled original images and videos |
| server.mjs | Local demo server; defaults to loopback port 8094 |
| docs/INTEGRATION.md | Boundaries for the next live increment |
| docs/VERIFICATION.md | What was tested and what remains unverified |

Run offline checks with **npm test**.

## Creative source

The initial catalogue uses **Caustics**, **God rays**, and **Fog** from KP’s Deep Ocean study. The friendly station names are Pool of light, Light from above, and Violet afterhours. This is three performances of one world, not three unrelated worlds. Clean matched Aurora Porch and Midnight Drive packs remain to be recovered.

Original videos were generated with MiniMax H3 Max Turbo through Krea. Selected duration: 5 seconds; containers are approximately 5.184 seconds, 1344 × 768 H.264 with AAC audio. Original workshop prompts are not included in the public bundle. New editable directions and genre choices are separately authored proposals.

The creative media belongs to KP / Pixel Rhythms Labs. Repository visibility does not confer a separate blanket media license. Reactor MTV is a working project name; the station graphics are original, not an official MTV identity.
