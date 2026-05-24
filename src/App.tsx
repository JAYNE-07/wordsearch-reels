import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { placeWords, wordsForTheme, themeTitle } from './lib/wordsearch';
import { PALETTES, type Palette } from './lib/palettes';
import { buildScene, drawFrame, REEL_TIMING, type Scene } from './lib/animate';
import { recordCanvas } from './lib/record';
import type { MusicTiming } from './lib/music';

const REEL_W = 1080;
const REEL_H = 1920;
const REEL_SECONDS = REEL_TIMING.duration;
const MUSIC_TIMING: MusicTiming = {
  titlePopAt: REEL_TIMING.titleStart,
  countdownStart: REEL_TIMING.countdownStart,
  walkStart: REEL_TIMING.sweepStart,
  walkEnd: REEL_TIMING.sweepEnd,
  ctaAt: REEL_TIMING.ctaStart,
};
const REEL_FPS = 30;
const COLS_FOR_REEL = 12; // smaller grid pairs nicely with 5 words and stays readable on phones
const WORDS_PER_REEL = 5;  // fewer words = lower barrier, viewers more likely to try

const BANNER = 'Can you find these words?';

// Word-search themed CTA pool.
const RANDOM_CTAS = [
  'Find all 14? Real puzzle books are in my bio',
  'Too easy for you? More puzzles in my bio',
  'Solve 100 more — link in my bio',
  'Want a real challenge? My puzzle book is in my bio',
  'If you spotted them all, try the book in my bio',
  'Think this is simple? Harder ones in my bio',
  "Bored already? The real book is in my bio",
  'Hooked? 100+ themed puzzles in my bio',
  'Want more? Tap the link in my bio',
  'Loved this? Puzzle book in my bio',
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function shuffledPalettes(): Palette[] {
  const out = [...PALETTES];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Status = 'idle' | 'working' | 'done';

interface CompletedReel {
  id: string;
  index: number;
  blob: Blob;
  url: string;
  poster: string;
  filename: string;
  paletteName: string;
  selected: boolean;
}

export default function App() {
  const [keyword, setKeyword] = useState('animals');
  const [count, setCount] = useState(5);
  const [cta, setCta] = useState('');
  const [handle, setHandle] = useState('@iqexploratorium');
  const [withAudio, setWithAudio] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [reels, setReels] = useState<CompletedReel[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cancelRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (status !== 'idle' || !canvasRef.current) return;
    const cv = canvasRef.current;
    cv.width = REEL_W;
    cv.height = REEL_H;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, REEL_H);
    g.addColorStop(0, '#0a1a3a');
    g.addColorStop(1, '#15356b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, REEL_W, REEL_H);
    ctx.fillStyle = '#e6f4ff';
    ctx.textAlign = 'center';
    ctx.font =
      'bold 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Word Search Reels', REEL_W / 2, REEL_H * 0.46);
    ctx.font = '40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(230,244,255,0.7)';
    ctx.fillText('preview appears here', REEL_W / 2, REEL_H * 0.52);
  }, [status]);

  useEffect(() => {
    return () => {
      reels.forEach((r) => URL.revokeObjectURL(r.url));
    };
  }, [reels]);

  const appendLog = (line: string) =>
    setLog((arr) => [...arr.slice(-60), line]);

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reel';

  const clearAll = () => {
    reels.forEach((r) => URL.revokeObjectURL(r.url));
    setReels([]);
    setStatus('idle');
    setLog([]);
  };

  const toggleSelect = (id: string) =>
    setReels((arr) => arr.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));

  const downloadSelected = async () => {
    const chosen = reels.filter((r) => r.selected);
    for (const r of chosen) {
      downloadBlob(r.blob, r.filename);
      await sleep(350);
    }
  };

  const generate = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw || status === 'working') return;
    cancelRef.current = false;
    if (withAudio && !audioCtxRef.current) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new AC();
      } catch {
        audioCtxRef.current = null;
      }
    }
    setStatus('working');
    reels.forEach((r) => URL.revokeObjectURL(r.url));
    setReels([]);
    setLog([]);
    const cv = canvasRef.current!;
    cv.width = REEL_W;
    cv.height = REEL_H;
    const baseSeed = Math.floor(Math.random() * 1e9);
    const batchPalettes = shuffledPalettes();
    const title = themeTitle(kw);

    let made = 0;
    let skipped = 0;

    for (let i = 0; i < count; i++) {
      if (cancelRef.current) break;

      const palette = batchPalettes[i % batchPalettes.length];
      const reelCta = cta.trim() || RANDOM_CTAS[Math.floor(Math.random() * RANDOM_CTAS.length)];

      setProgress(`Reel ${i + 1} of ${count} — building puzzle…`);
      let scene: Scene | null = null;

      for (let attempt = 0; attempt < 4 && !scene; attempt++) {
        if (cancelRef.current) break;
        const seed = ((baseSeed + i * 131 + attempt * 977) >>> 0) || 1;
        const wordPool = wordsForTheme(kw, WORDS_PER_REEL + 8, seed);
        const ws = placeWords(wordPool, COLS_FOR_REEL, COLS_FOR_REEL, seed);
        if (ws.placed.length >= WORDS_PER_REEL) {
          // Trim to first 14 actually-placed words.
          ws.placed = ws.placed.slice(0, WORDS_PER_REEL);
          ws.placements = ws.placements.slice(0, WORDS_PER_REEL);
          scene = buildScene(
            REEL_W,
            REEL_H,
            ws,
            palette,
            BANNER,
            title,
            reelCta,
            handle,
            REEL_SECONDS,
            seed,
          );
        }
      }
      if (!scene) {
        appendLog(`✗ reel ${i + 1}: couldn't place enough words — skipped`);
        skipped++;
        continue;
      }

      setProgress(`Reel ${i + 1} of ${count} — recording ${REEL_SECONDS} s (${palette.name})`);
      const sceneFinal = scene;
      const drawFn = (recCtx: CanvasRenderingContext2D, t: number) =>
        drawFrame(recCtx, sceneFinal, t);
      let result;
      try {
        result = await recordCanvas(
          cv,
          REEL_FPS,
          REEL_SECONDS,
          drawFn,
          withAudio ? audioCtxRef.current : null,
          MUSIC_TIMING,
        );
      } catch (e) {
        appendLog(
          `… reel ${i + 1}: audio recording failed (${e instanceof Error ? e.message : 'error'}), retrying silent`,
        );
        try {
          result = await recordCanvas(cv, REEL_FPS, REEL_SECONDS, drawFn, null, null);
        } catch (e2) {
          appendLog(
            `✗ reel ${i + 1}: recording failed (${e2 instanceof Error ? e2.message : 'error'})`,
          );
          skipped++;
          continue;
        }
      }

      const url = URL.createObjectURL(result.blob);
      const filename = `${String(i + 1).padStart(2, '0')}-${slugify(title)}-${slugify(palette.name)}.${result.extension}`;
      const completed: CompletedReel = {
        id: `${baseSeed}-${i}`,
        index: i + 1,
        blob: result.blob,
        url,
        poster: result.poster,
        filename,
        paletteName: palette.name,
        selected: true,
      };
      setReels((arr) => [...arr, completed]);
      appendLog(`✓ reel ${i + 1}: ready (${(result.blob.size / 1e6).toFixed(1)} MB, ${palette.name})`);
      made++;

      if (i < count - 1) await sleep(1500);
    }
    setProgress('');
    setStatus('done');
    appendLog(`Done — ${made} ready, ${skipped} skipped`);
  }, [keyword, count, cta, handle, status, reels, withAudio]);

  const cancel = () => {
    cancelRef.current = true;
  };

  const ctaPlaceholder = useMemo(
    () => `random per reel (e.g. "Find all 14? Link in bio")`,
    [],
  );

  const selectedCount = reels.filter((r) => r.selected).length;

  return (
    <div className="app">
      <header>
        <h1>Word Search Reels Generator</h1>
        <p className="sub">
          9:16 reels for Instagram — themed 12×12 word search with 5 words, ~5 s for viewers
          to scan, then capsule highlights sweep every word. All reels generate
          first, then you pick which to save.
        </p>
      </header>

      <div className="panel">
        <label className="row">
          <span>Theme keyword</span>
          <input
            value={keyword}
            placeholder="animals, fruits, space, ocean…"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        <label className="row">
          <span>How many reels</span>
          <input
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
            }
          />
        </label>
        <label className="row">
          <span>CTA text</span>
          <input
            value={cta}
            placeholder={ctaPlaceholder}
            onChange={(e) => setCta(e.target.value)}
          />
        </label>
        <label className="row">
          <span>Your @handle</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} />
        </label>
        <label className="row check">
          <span>Anxious music</span>
          <input
            type="checkbox"
            checked={withAudio}
            onChange={(e) => setWithAudio(e.target.checked)}
          />
          <em>
            Adds a procedural ticking/heartbeat backing track that fades into a
            sweep arpeggio. Uncheck for silent reels.
          </em>
        </label>

        <p className="note">
          Each reel is 12 s — ~5 s think time + 3-2-1 countdown (a small "⏸
          pause if you need more time" hint sits under the grid), then a 2 s
          highlight sweep over every word and a ~1 s CTA. 1080×1920 with
          ticking-clock background and event sounds. Leave the CTA blank to
          randomize per reel. Recording is real-time so {count} reel
          {count === 1 ? '' : 's'} take ~{count * 13} s.
        </p>

        <div className="row actions">
          {status !== 'working' ? (
            <button className="primary" onClick={generate} disabled={!keyword.trim()}>
              {status === 'done' ? 'Generate another batch' : 'Generate reels'}
            </button>
          ) : (
            <button onClick={cancel}>Stop</button>
          )}
          {reels.length > 0 && status !== 'working' && (
            <button onClick={clearAll}>Clear all</button>
          )}
        </div>
      </div>

      {progress && <div className="progress">{progress}</div>}

      <div className="stage">
        <div className="phone">
          <canvas ref={canvasRef} className="reel" />
        </div>
        {log.length > 0 && (
          <ul className="log">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>

      {reels.length > 0 && (
        <section className="gallery">
          <div className="gallery-head">
            <h2>
              Generated reels — {selectedCount} of {reels.length} selected
            </h2>
            <div>
              <button
                onClick={() =>
                  setReels((arr) => arr.map((r) => ({ ...r, selected: true })))
                }
              >
                Select all
              </button>
              <button
                onClick={() =>
                  setReels((arr) => arr.map((r) => ({ ...r, selected: false })))
                }
              >
                Select none
              </button>
              <button
                className="primary"
                disabled={selectedCount === 0}
                onClick={downloadSelected}
              >
                Download {selectedCount}
              </button>
            </div>
          </div>
          <div className="grid">
            {reels.map((r) => (
              <label
                key={r.id}
                className={'card' + (r.selected ? ' on' : '')}
              >
                <video
                  src={r.url}
                  poster={r.poster}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                />
                <div className="card-row">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => toggleSelect(r.id)}
                  />
                  <span className="card-meta">
                    <strong>#{r.index}</strong> · {r.paletteName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      downloadBlob(r.blob, r.filename);
                    }}
                  >
                    Save
                  </button>
                </div>
                <code className="card-name">{r.filename}</code>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
