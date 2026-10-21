/**
 * Wheel auto-detection on a car photo.
 *
 * Pure pixel math — no canvas, no DOM — so it runs anywhere something hands
 * it RGBA bytes and is testable with synthetic images. A tire reads as a
 * dark ring with a brighter wheel face inside it and (usually) brighter
 * bodywork outside; the detector scores circles on exactly that contrast
 * instead of running a general Hough transform, because this is the only
 * shape it will ever be asked for.
 */

export interface ImageDataLike {
  width: number;
  height: number;
  /** RGBA, row-major — what canvas getImageData().data gives. */
  data: Uint8ClampedArray | number[];
}

export interface DetectedCircle {
  /** Centre and radius, in this image's pixel space. */
  x: number;
  y: number;
  r: number;
  /** Ring-contrast score; larger is more wheel-like. */
  score: number;
}

/** Luminance 0..1 at integer coordinates, clamped to the image. */
function lum(img: ImageDataLike, x: number, y: number): number {
  const xi = x < 0 ? 0 : x >= img.width ? img.width - 1 : x | 0;
  const yi = y < 0 ? 0 : y >= img.height ? img.height - 1 : y | 0;
  const i = (yi * img.width + xi) * 4;
  return (Number(img.data[i]) + Number(img.data[i + 1]) + Number(img.data[i + 2])) / (3 * 255);
}

/** Mean luminance around a circle band. Angles where the band leaves the
 *  image are skipped; bands mostly outside the image return null. */
function bandLum(img: ImageDataLike, cx: number, cy: number, r: number, samples: number): number | null {
  let sum = 0;
  let n = 0;
  for (let a = 0; a < samples; a++) {
    const t = (a / samples) * Math.PI * 2;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    sum += lum(img, x, y);
    n++;
  }
  return n >= samples * 0.7 ? sum / n : null;
}

/**
 * How wheel-like a circle is: dark rubber at the ring, brighter wheel face
 * inside, brighter surroundings outside. Zero or negative for flat regions.
 */
export function circleScore(
  img: ImageDataLike,
  cx: number,
  cy: number,
  r: number,
  samples = 40,
): number {
  const ringA = bandLum(img, cx, cy, r * 0.95, samples);
  const ringB = bandLum(img, cx, cy, r * 0.8, samples);
  const hub = bandLum(img, cx, cy, r * 0.4, samples);
  const outer = bandLum(img, cx, cy, r * 1.3, samples);
  if (ringA == null || ringB == null || hub == null) return 0;
  const ring = (ringA + ringB) / 2;
  // Rubber is dark in any lighting; a bright "ring" is not a tire.
  if (ring > 0.55) return 0;
  const hubContrast = hub - ring;
  const outerContrast = outer == null ? 0 : outer - ring;
  return hubContrast + 0.5 * Math.max(0, outerContrast);
}

/**
 * The contrast score peaks with the band centred on the rubber, which sits a
 * few percent inside the tread's outer edge — but calibration means the
 * OUTER edge, where the user would tap. Walk outward until the band
 * brightens toward the surroundings.
 */
function expandToEdge(img: ImageDataLike, x: number, y: number, r: number): number {
  // Absolute thresholds fail here: the surroundings can be nearly as dark as
  // the rubber (night backgrounds, shadowed arches). The edge is wherever the
  // band luminance BRIGHTENS FASTEST going outward from the rubber.
  const from = Math.max(4, Math.round(r * 0.85));
  const to = Math.round(r * 1.35);
  const profile: number[] = [];
  for (let rr = from; rr <= to; rr++) {
    const b = bandLum(img, x, y, rr, 64);
    if (b == null) break;
    profile.push(b);
  }
  if (profile.length < 6) return r;
  // The FIRST strong brightening is the rubber's edge; stronger ones farther
  // out are bodywork (a bright sill makes a steeper step than the tire).
  let maxDiff = 0;
  for (let i = 0; i + 2 < profile.length; i++) {
    maxDiff = Math.max(maxDiff, profile[i + 2] - profile[i]);
  }
  if (maxDiff < 0.02) return r; // no edge worth trusting
  const threshold = Math.max(0.04, maxDiff * 0.35);
  for (let i = 0; i + 2 < profile.length; i++) {
    if (profile[i + 2] - profile[i] >= threshold) return from + i + 1;
  }
  return r;
}

/**
 * Geometric fit from per-ray edge crossings. The contrast score's optimum
 * drifts a few pixels toward whatever surrounds the tire (shadow below,
 * bright body above); the actual rubber edge doesn't. Rays start inside the
 * rubber and stop at their first sharp brightening; the circle through those
 * points is the wheel.
 */
function fitEdgeCircle(
  img: ImageDataLike,
  c: { x: number; y: number; r: number },
): { x: number; y: number; r: number } | null {
  const RAYS = 72;
  const pts: { x: number; y: number }[] = [];
  for (let a = 0; a < RAYS; a++) {
    const t = (a / RAYS) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const from = Math.max(3, Math.round(c.r * 0.8));
    const to = Math.round(c.r * 1.35);
    const l: number[] = [];
    for (let rr = from; rr <= to; rr++) {
      const x = c.x + cos * rr;
      const y = c.y + sin * rr;
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) break;
      l.push(lum(img, x, y));
    }
    for (let i = 1; i + 2 < l.length; i++) {
      const diff = (l[i + 1] + l[i + 2]) / 2 - (l[i - 1] + l[i]) / 2;
      if (diff >= 0.05) {
        const rr = from + i + 0.5;
        pts.push({ x: c.x + cos * rr, y: c.y + sin * rr });
        break;
      }
    }
  }
  if (pts.length < RAYS * 0.45) return null;
  // Kåsa least-squares circle fit — unlike a centroid, it stays unbiased when
  // the edge points only cover part of the circle (the ground shadow usually
  // hides the bottom arc).
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of pts) {
    const z = p.x * p.x + p.y * p.y;
    sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y;
    sx += p.x; sy += p.y;
    sxz += p.x * z; syz += p.y * z; sz += z;
  }
  const n = pts.length;
  const det3 = (
    a: number, b: number, cc: number,
    d: number, e: number, f: number,
    g: number, h: number, i: number,
  ) => a * (e * i - f * h) - b * (d * i - f * g) + cc * (d * h - e * g);
  const det = det3(sxx, sxy, sx, sxy, syy, sy, sx, sy, n);
  if (Math.abs(det) < 1e-9) return null;
  const D = det3(-sxz, sxy, sx, -syz, syy, sy, -sz, sy, n) / det;
  const E = det3(sxx, -sxz, sx, sxy, -syz, sy, sx, -sz, n) / det;
  const F = det3(sxx, sxy, -sxz, sxy, syy, -syz, sx, sy, -sz) / det;
  const cx = -D / 2;
  const cy = -E / 2;
  const r2 = (D * D + E * E) / 4 - F;
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2);
  // A fit that wandered away from the guess fit something else entirely.
  if (Math.hypot(cx - c.x, cy - c.y) > c.r * 0.3 || r < c.r * 0.6 || r > c.r * 1.5) return null;
  return { x: cx, y: cy, r };
}

/** Local search that snaps a rough circle onto the strongest nearby ring. */
export function refineCircle(
  img: ImageDataLike,
  guess: { x: number; y: number; r: number },
  window = 6,
  rWindow = 5,
): DetectedCircle {
  let best: DetectedCircle = { ...guess, score: circleScore(img, guess.x, guess.y, guess.r, 64) };
  for (let dy = -window; dy <= window; dy++) {
    for (let dx = -window; dx <= window; dx++) {
      for (let dr = -rWindow; dr <= rWindow; dr++) {
        const r = guess.r + dr;
        if (r < 4) continue;
        const score = circleScore(img, guess.x + dx, guess.y + dy, r, 64);
        if (score > best.score) best = { x: guess.x + dx, y: guess.y + dy, r, score };
      }
    }
  }
  // Two rounds of geometric re-fitting converge to the rubber's real edge.
  let fitted = { x: best.x, y: best.y, r: expandToEdge(img, best.x, best.y, best.r) };
  for (let i = 0; i < 2; i++) {
    const fit = fitEdgeCircle(img, fitted);
    if (!fit) break;
    fitted = fit;
  }
  return { ...fitted, score: best.score };
}

/** Candidates must score at least this to count as a wheel at all. */
const MIN_SCORE = 0.22;

/**
 * Find up to two wheels in a (reasonably small) car photo. Returns the
 * strongest circles, best first; empty when nothing ring-like stands out —
 * a flat or busy image must yield nothing rather than a confident guess.
 */
export function detectWheels(img: ImageDataLike): DetectedCircle[] {
  const minDim = Math.min(img.width, img.height);
  const rMin = Math.max(6, Math.round(minDim * 0.05));
  const rMax = Math.round(minDim * 0.28);
  const step = Math.max(2, Math.round(minDim / 90));

  // Wheels live in the lower half of a car photo; down-weight circles found
  // above it by not looking there at all.
  const yMin = Math.round(img.height * 0.35);
  const yMax = Math.round(img.height * 0.95);

  const candidates: DetectedCircle[] = [];
  for (let y = yMin; y <= yMax; y += step) {
    for (let x = 0; x < img.width; x += step) {
      let localBest: DetectedCircle | null = null;
      for (let r = rMin; r <= rMax; r = Math.max(r + 1, Math.round(r * 1.18))) {
        const score = circleScore(img, x, y, r, 24);
        if (score > MIN_SCORE && (!localBest || score > localBest.score)) {
          localBest = { x, y, r, score };
        }
      }
      if (localBest) candidates.push(localBest);
    }
  }
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);

  // Non-maximum suppression, then a precise local refinement of the winners.
  const picked: DetectedCircle[] = [];
  for (const c of candidates) {
    if (picked.length >= 2) break;
    if (picked.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < (p.r + c.r) * 1.2)) continue;
    picked.push(refineCircle(img, c, Math.max(4, step), Math.max(3, Math.round(c.r * 0.25))));
  }
  return picked.filter((p) => p.score > MIN_SCORE);
}

/**
 * Pull a tire size out of arbitrary text (an OCR pass, a listing title, a
 * pasted spec line). Returns the normalized size or null.
 */
export function extractTireSizeFromText(text: string): string | null {
  // Metric: optional LT/P prefix, 3-digit width, 2-digit aspect, R + rim.
  const metric = text.match(/\b(?:LT|P)?\s*(\d{3})\s*\/\s*(\d{2}(?:\.\d)?)\s*Z?R\s*(\d{2})\b/i);
  if (metric) return `${metric[1]}/${metric[2]}R${metric[3]}`;
  // Flotation: 33x12.50R15 and friends.
  const flot = text.match(/\b(\d{2}(?:\.\d)?)\s*[x×]\s*(\d{1,2}(?:\.\d{1,2})?)\s*R?\s*(\d{2})\b/i);
  if (flot) return `${flot[1]}x${flot[2]}R${flot[3]}`;
  return null;
}
