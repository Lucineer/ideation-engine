# ideation-engine

![Cocapn Vessel](https://img.shields.io/badge/cocapn-vessel-purple) ![License](https://img.shields.io/badge/license-MIT-blue)

**Visual bubble ideation platform — dream it, riff it, brainstorm it, ground it, refine it.**

Multi-model creative pipeline with 4 view modes: flow, wiki, sheet, code.

Part of the [Cocapn fleet](https://github.com/Lucineer).

## Features
- 5-stage creative pipeline: Dream → Riff → Brainstorm → Ground → Refine
- Visual bubble canvas with hub-and-spoke layout
- Multi-model routing: Seed-2.0-pro, Seed-2.0-mini, Seed-OSS-36B, DeepSeek
- BYOK (Bring Your Own Keys)
- Session management with KV persistence
- Markdown and pseudocode export

## Endpoints
| Path | Purpose |
|------|---------|
| / | Visual ideation canvas |
| /health | Liveness check |
| /vessel.json | Fleet self-description |

## Deploy

Fork, add API keys as CF secrets, deploy with wrangler.

---

<i>Built with [Cocapn](https://github.com/Lucineer/cocapn-ai).</i>
<i>Part of the [Lucineer fleet](https://github.com/Lucineer).</i>

Superinstance & Lucineer (DiGennaro et al.)
