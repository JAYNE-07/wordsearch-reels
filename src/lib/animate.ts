// 9:16 word-search reel renderer.
//
// Layout: top banner + theme title, centered 18x18 letter grid, two-column
// word list below, big 3-2-1 countdown, then capsule-highlight sweep over
// each placed word, finally CTA pop.

import type { Palette } from './palettes';
import type { Placement, WordSearch } from './wordsearch';

export interface Scene {
  width: number;
  height: number;
  ws: WordSearch;
  palette: Palette;
  banner: string;
  title: string;        // theme title, uppercase
  cta: string;
  handle: string;
  duration: number;
  seedSalt: number;
}

/** Single source of truth for the reel timeline. */
export const REEL_TIMING = {
  duration: 12,
  bannerStart: 0,
  titleStart: 0.5,
  gridFadeIn: 1.5,
  wordListFadeIn: 2.0,
  thinkStart: 2.0,
  countdownStart: 7.0,
  countdownEnd: 9.0,
  sweepStart: 9.0,
  sweepEnd: 11.0,
  ctaStart: 11.0,
  ctaEnd: 11.8,
} as const;

export function buildScene(
  width: number,
  height: number,
  ws: WordSearch,
  palette: Palette,
  banner: string,
  title: string,
  cta: string,
  handle: string,
  duration: number,
  seedSalt = 1,
): Scene {
  return { width, height, ws, palette, banner, title, cta, handle, duration, seedSalt };
}

// ---------- math helpers ----------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ---------- layout ----------

interface GridLayout {
  cell: number;
  gx: number;
  gy: number;
  gridW: number;
  gridH: number;
  cols: number;
  rows: number;
}

function gridLayout(width: number, _height: number, ws: WordSearch): GridLayout {
  const sidePad = 30;
  // Centered horizontally; grid sized so it fits in width with side pad.
  const cell = Math.floor((width - sidePad * 2) / ws.cols);
  const gridW = cell * ws.cols;
  const gridH = cell * ws.rows;
  const gx = (width - gridW) / 2;
  // Vertical band: under the title (~350) and above word list / countdown.
  const gy = 430;
  return { cell, gx, gy, gridW, gridH, cols: ws.cols, rows: ws.rows };
}

// ---------- per-frame draw ----------

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  t: number,
): void {
  const { width, height, ws, palette, banner, title, cta, handle } = scene;

  // animated background
  const drift = Math.sin(t * 0.6) * 30;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, palette.bg);
  bg.addColorStop(0.5, mix(palette.bg, palette.bgEnd, 0.5 + drift * 0.002));
  bg.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // subtle vignette
  const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  const layout = gridLayout(width, height, ws);

  const {
    titleStart,
    gridFadeIn,
    wordListFadeIn,
    countdownStart,
    countdownEnd,
    sweepStart,
    sweepEnd,
    ctaStart,
    ctaEnd,
  } = REEL_TIMING;

  // 1) banner — small, fades in 0..0.5s, sits all 0..2s
  const bannerP = clamp01(t / 0.5);
  if (bannerP > 0) {
    drawBanner(ctx, banner, width / 2, 130, bannerP, palette);
  }

  // 2) theme title — fades in at titleStart, fades out before countdown.
  const titleP = clamp01((t - titleStart) / 0.7);
  if (titleP > 0) {
    const fadeOut = clamp01(1 - (t - (countdownStart - 0.6)) / 0.4);
    const bob = t > 2 && t < countdownStart - 0.6 ? Math.sin((t - 2) * 2.4) * 6 : 0;
    drawTitle(ctx, title, width / 2, 260 + bob, titleP * fadeOut, palette);
  }

  // 3) grid fade-in
  const gridP = clamp01((t - gridFadeIn) / 0.6);
  if (gridP > 0) {
    const popScale = easeOutBack(Math.min(1, gridP));
    ctx.save();
    ctx.globalAlpha = gridP;
    const cx = layout.gx + layout.gridW / 2;
    const cy = layout.gy + layout.gridH / 2;
    ctx.translate(cx, cy);
    ctx.scale(popScale, popScale);
    ctx.translate(-cx, -cy);
    drawGrid(ctx, ws, layout, palette);
    ctx.restore();
  }

  // 4) sweep highlights — drawn after letters with semi-transparent capsules
  // so the letters underneath stay visible.
  if (t >= sweepStart && gridP > 0) {
    drawSweepCapsules(ctx, ws.placements, layout, palette, t);
  }

  // 5) word list — two columns below the grid
  const listY = layout.gy + layout.gridH + 30;
  const listP = clamp01((t - wordListFadeIn) / 0.6);
  if (listP > 0) {
    ctx.save();
    ctx.globalAlpha = listP;
    drawWordList(ctx, ws.placed, width, listY, height, palette, t);
    ctx.restore();
  }

  // 6) pause-for-time hint — between grid appearing and countdown
  if (t > gridFadeIn + 0.8 && t < countdownStart) {
    const inP = clamp01((t - (gridFadeIn + 0.8)) / 0.3);
    const outP = clamp01((countdownStart - t) / 0.3);
    const alpha = Math.min(inP, outP);
    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    const { stroke, shadow } = contrast(palette.text);
    ctx.fillStyle = palette.text;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      'italic 600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 12;
    const hint = '⏸  pause for more time';
    const hintY = height - 240;
    ctx.strokeText(hint, width / 2, hintY);
    ctx.fillText(hint, width / 2, hintY);
    ctx.restore();
  }

  // 7) countdown
  if (t >= countdownStart && t < countdownEnd) {
    drawCountdown(ctx, t, countdownStart, width, palette);
  }

  // 8) celebrate burst once sweep is done
  if (t > sweepEnd + 0.05) {
    const cp = clamp01((t - (sweepEnd + 0.05)) / 1.2);
    drawConfetti(ctx, width / 2, layout.gy + layout.gridH / 2, cp, scene.seedSalt);
  }

  // 9) CTA pop
  const ctaP = clamp01((t - ctaStart) / (ctaEnd - ctaStart));
  if (ctaP > 0) {
    drawCtaPop(ctx, cta, handle, width / 2, height - 280, ctaP, palette);
  }
}

// ---------- grid ----------

function drawGrid(
  ctx: CanvasRenderingContext2D,
  ws: WordSearch,
  l: GridLayout,
  palette: Palette,
) {
  const { cell, gx, gy, gridW, gridH, cols, rows } = l;

  // backing card with subtle shadow
  ctx.save();
  ctx.fillStyle = withAlpha(palette.text, 0.08);
  roundRect(ctx, gx - 10, gy - 10, gridW + 20, gridH + 20, 18);
  ctx.fill();
  ctx.restore();

  // grid lines
  ctx.save();
  ctx.strokeStyle = withAlpha(palette.wall, 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(gx, gy + r * cell);
    ctx.lineTo(gx + gridW, gy + r * cell);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(gx + c * cell, gy);
    ctx.lineTo(gx + c * cell, gy + gridH);
  }
  ctx.stroke();
  ctx.restore();

  // outer border bolder
  ctx.save();
  ctx.strokeStyle = palette.wall;
  ctx.lineWidth = 3;
  ctx.strokeRect(gx, gy, gridW, gridH);
  ctx.restore();

  // letters
  ctx.save();
  const { stroke, shadow } = contrast(palette.wall);
  ctx.fillStyle = palette.wall;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.floor(cell * 0.62);
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif`;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = ws.grid[r][c];
      const x = gx + c * cell + cell / 2;
      const y = gy + r * cell + cell / 2;
      ctx.fillText(ch, x, y);
    }
  }
  ctx.restore();
}

// ---------- sweep capsules ----------

const DIR_OFF: Array<{ dr: number; dc: number }> = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 },
];

function sweepProgress(
  placements: Placement[],
  t: number,
): { full: number; partial: number } {
  const total = placements.length;
  if (total === 0) return { full: 0, partial: 0 };
  const { sweepStart, sweepEnd } = REEL_TIMING;
  const span = sweepEnd - sweepStart;
  const per = span / total;
  const local = Math.max(0, t - sweepStart);
  const k = Math.min(total, local / per);
  return { full: Math.floor(k), partial: k - Math.floor(k) };
}

function drawSweepCapsules(
  ctx: CanvasRenderingContext2D,
  placements: Placement[],
  l: GridLayout,
  palette: Palette,
  t: number,
) {
  const { full, partial } = sweepProgress(placements, t);
  for (let i = 0; i < placements.length; i++) {
    if (i > full) break;
    const p = placements[i];
    // Grow over the first ~60% of this slot, then stay full.
    const grow = i < full ? 1 : easeOutCubic(Math.min(1, partial / 0.6));
    drawCapsule(ctx, p, l, palette, grow, i);
  }
}

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  p: Placement,
  l: GridLayout,
  palette: Palette,
  grow: number,
  index: number,
) {
  const { cell, gx, gy } = l;
  const { dr, dc } = DIR_OFF[p.dir];
  const last = p.word.length - 1;
  const x1 = gx + p.col * cell + cell / 2;
  const y1 = gy + p.row * cell + cell / 2;
  const x2 = gx + (p.col + dc * last) * cell + cell / 2;
  const y2 = gy + (p.row + dr * last) * cell + cell / 2;
  const ex = lerp(x1, x2, grow);
  const ey = lerp(y1, y2, grow);

  const angle = Math.atan2(ey - y1, ex - x1);
  const len = Math.hypot(ex - x1, ey - y1);
  const cap = cell * 0.82;

  ctx.save();
  ctx.translate((x1 + ex) / 2, (y1 + ey) / 2);
  ctx.rotate(angle);
  const cap1 = palette.trail;
  const cap2 = withAlpha(palette.ctaBg, 0.55);
  ctx.fillStyle = index % 2 === 0 ? cap1 : cap2;
  ctx.strokeStyle = palette.wall;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.78;
  roundRect(ctx, -len / 2 - cap / 2, -cap / 2, len + cap, cap, cap / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- word list ----------

function drawWordList(
  ctx: CanvasRenderingContext2D,
  words: string[],
  width: number,
  topY: number,
  height: number,
  palette: Palette,
  t: number,
) {
  if (!words.length) return;
  const lineH = 82;
  const { sweepStart, sweepEnd } = REEL_TIMING;
  const span = sweepEnd - sweepStart;
  const per = words.length > 0 ? span / words.length : 0;

  const { stroke, shadow } = contrast(palette.text);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '800 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 8;

  // Keep the entire block above the CTA region.
  const maxBottom = height - 360;
  const actualLineH = Math.min(lineH, Math.max(48, (maxBottom - topY) / words.length));
  const cx = width / 2;

  for (let i = 0; i < words.length; i++) {
    const x = cx;
    const y = topY + i * actualLineH + actualLineH / 2;

    const wordRevealAt = sweepStart + per * (i + 0.5);
    const found = t >= wordRevealAt;

    ctx.fillStyle = found ? withAlpha(palette.text, 0.5) : palette.text;
    ctx.strokeStyle = stroke;
    const label = words[i];
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);

    if (found) {
      const w = ctx.measureText(label).width;
      ctx.save();
      ctx.strokeStyle = palette.ctaBg;
      ctx.lineWidth = 5;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x + w / 2, y);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------- banner / title / countdown / cta ----------

function drawBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  p: number,
  palette: Palette,
) {
  ctx.save();
  ctx.globalAlpha = p;
  const { stroke, shadow } = contrast(palette.ctaBg);
  ctx.fillStyle = palette.ctaBg;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  const single = text.toUpperCase();
  ctx.strokeText(single, cx, cy);
  ctx.fillText(single, cx, cy);
  ctx.restore();
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  p: number,
  palette: Palette,
) {
  ctx.save();
  ctx.globalAlpha = p;
  const slide = (1 - p) * -24;
  const { stroke, shadow } = contrast(palette.text);
  ctx.fillStyle = palette.text;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '900 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.strokeText(text, cx, cy + slide);
  ctx.fillText(text, cx, cy + slide);
  ctx.restore();
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  t: number,
  countdownStart: number,
  width: number,
  palette: Palette,
) {
  const perDigit = 2 / 3; // 2 s window for 3,2,1
  const elapsed = t - countdownStart;
  const idx = Math.floor(elapsed / perDigit);
  const digit = 3 - idx;
  if (digit < 1 || digit > 3) return;
  const sub = (elapsed - idx * perDigit) / perDigit;

  let alpha = 1;
  let scale = 1;
  if (sub < 0.25) {
    const k = sub / 0.25;
    scale = easeOutBack(k);
    alpha = k;
  } else if (sub > 0.75) {
    const k = (sub - 0.75) / 0.25;
    alpha = 1 - k;
    scale = 1 + k * 0.4;
  }

  // Sit the countdown in the title's old space (above the grid). The title
  // has fully faded out by countdownStart, so this area is empty.
  const cx = width / 2;
  const cy = 280;

  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  const ringR = 150 * scale;
  const ring = ctx.createRadialGradient(cx, cy, ringR * 0.15, cx, cy, ringR);
  ring.addColorStop(0, palette.ctaBg);
  ring.addColorStop(0.6, palette.ctaBg + '00');
  ring.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = palette.ctaBg;
  ctx.strokeStyle = palette.ctaText;
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '900 220px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.strokeText(String(digit), cx, cy);
  ctx.fillText(String(digit), cx, cy);
  ctx.restore();
}

function drawConfetti(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  p: number,
  salt: number,
) {
  const colors = ['#f72585', '#7209b7', '#3a86ff', '#ffbe0b', '#fb5607', '#06d6a0', '#f5d3ff'];
  const N = 22;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const seed = (salt * 9301 + i * 49297) % 233280;
    const angle = (i / N) * Math.PI * 2 + ((seed % 100) / 100) * 0.6;
    const speed = 260 + (seed % 110);
    const distP = easeOutCubic(p);
    const px = cx + Math.cos(angle) * speed * distP;
    const py = cy + Math.sin(angle) * speed * distP * 0.6 + 360 * p * p;
    const size = (10 + (seed % 14)) * (1 - p * 0.4);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = Math.max(0, 1 - p * 1.1);
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(px, py, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(((seed % 360) / 360) * Math.PI * 2 + p * Math.PI * 2);
      ctx.fillRect(-size * 0.5, -size * 0.25, size, size * 0.5);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawCtaPop(
  ctx: CanvasRenderingContext2D,
  cta: string,
  handle: string,
  cx: number,
  cy: number,
  p: number,
  palette: Palette,
) {
  const scale = easeOutBack(p);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const { stroke: ctaStroke, shadow: ctaShadow } = contrast(palette.ctaBg);
  ctx.fillStyle = palette.ctaBg;
  ctx.strokeStyle = ctaStroke;
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '800 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
  ctx.shadowColor = ctaShadow;
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 9;
  const lines = splitCtaLines(ctx, cta, 540);
  const lh = 70;
  const offset = -((lines.length - 1) * lh) / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = cy + offset + i * lh;
    ctx.strokeText(lines[i], cx, y);
    ctx.fillText(lines[i], cx, y);
  }

  if (handle) {
    const handleC = contrast(palette.text);
    ctx.shadowColor = handleC.shadow;
    ctx.shadowBlur = 16;
    ctx.font =
      '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
    ctx.lineWidth = 5;
    ctx.fillStyle = palette.text;
    ctx.strokeStyle = handleC.stroke;
    const hy = cy + offset + lines.length * lh + 28;
    ctx.strokeText(handle, cx, hy);
    ctx.fillText(handle, cx, hy);
  }
  ctx.restore();
}

function splitCtaLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const m = text.match(/^(.+?[?!])\s+(.+)$/);
  if (m) return [m[1], m[2]];
  const dash = text.match(/^(.+?)\s+[-—]\s+(.+)$/);
  if (dash) return [dash[1], dash[2]];
  return wrapToLines(ctx, text, maxWidth);
}

// ---------- helpers ----------

function wrapToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function lum(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function contrast(fillHex: string): { stroke: string; shadow: string } {
  return lum(fillHex) > 0.55
    ? { stroke: '#000000', shadow: 'rgba(0,0,0,0.65)' }
    : { stroke: '#ffffff', shadow: 'rgba(255,255,255,0.45)' };
}

function withAlpha(hex: string, a: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function mix(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const r = Math.round(lerp(pa[0], pb[0], t));
  const g = Math.round(lerp(pa[1], pb[1], t));
  const bl = Math.round(lerp(pa[2], pb[2], t));
  return `rgb(${r},${g},${bl})`;
}

function hex(s: string): [number, number, number] {
  const h = s.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
