# Word Search Reels Generator

Produces 9:16 Instagram reels promoting word-search puzzle books. Each 12 s
reel: themed 18×18 grid fades in with a two-column word list, viewers get
~5 s of think time, a big 3-2-1 countdown plays, capsule highlights sweep
every word, and a CTA card pops in. Every reel uses a different brand
palette.

**Live site:** https://jayne-07.github.io/wordsearch-reels/

## Run locally

```sh
npm install
npm run dev
```

## How it works

- A small inline theme dictionary covers ~14 keywords (animals, fruits,
  vegetables, countries, space, ocean, sports, colors, instruments,
  weather, flowers, gemstones, trees, cars) plus a generic fallback.
- `placeWords()` carves 14 words into an 18×18 grid in four directions
  (→ ↓ ↘ ↗), filling empty cells with random uppercase letters.
- Canvas renders 1080×1920 frames at 30 fps; `MediaRecorder` captures the
  stream to MP4 (or WebM where MP4 isn't supported).
- Each reel is downloadable as a video file ready to upload to Instagram.
  Recording is real-time, so 10 reels ≈ 130 s.

## Note

Instagram prefers MP4. Recent Chrome/Edge/Safari on macOS produce MP4
directly; Firefox falls back to WebM (drag into CloudConvert or QuickTime
to convert).
