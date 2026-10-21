import {
  circleScore,
  detectWheels,
  extractTireSizeFromText,
  refineCircle,
  ImageDataLike,
} from '../detect';

/**
 * Synthetic side-on car scene: light background, a brighter body slab, and
 * two wheels drawn as dark rubber rings with bright hubs — the same contrast
 * structure the detector keys on in a real photo.
 */
const TRUTH = { r: 28, y: 140, x1: 100, x2: 270 };

function scene(t = TRUTH): ImageDataLike {
  const width = 360;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, v: number) => {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 120; // background
      if (y < t.y - t.r * 0.5 && y > 40) v = 160; // body slab above the wheels
      for (const cx of [t.x1, t.x2]) {
        const d = Math.hypot(x - cx, y - t.y);
        if (d <= t.r) v = d <= t.r * 0.62 ? 185 : 18; // bright hub, dark rubber
      }
      put(x, y, v);
    }
  }
  return { width, height, data };
}

function flat(v = 128): ImageDataLike {
  const width = 240;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4).fill(v);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

describe('circleScore', () => {
  it('scores a true wheel far above a random patch', () => {
    const img = scene();
    const onWheel = circleScore(img, TRUTH.x1, TRUTH.y, TRUTH.r);
    const offWheel = circleScore(img, 185, 100, TRUTH.r);
    expect(onWheel).toBeGreaterThan(0.3);
    expect(onWheel).toBeGreaterThan(offWheel + 0.2);
  });

  it('gives nothing to a flat region', () => {
    expect(circleScore(flat(), 120, 100, 30)).toBeLessThanOrEqual(0.05);
  });
});

describe('detectWheels', () => {
  it('finds both wheels close to their true centres and radii', () => {
    const found = detectWheels(scene());
    expect(found).toHaveLength(2);
    for (const truthX of [TRUTH.x1, TRUTH.x2]) {
      const hit = found.find((c) => Math.hypot(c.x - truthX, c.y - TRUTH.y) < 4);
      expect(hit).toBeDefined();
      expect(Math.abs(hit!.r - TRUTH.r)).toBeLessThanOrEqual(2);
    }
  });

  it('returns the two wheels apart, not the same one twice', () => {
    const [a, b] = detectWheels(scene());
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(TRUTH.r * 2);
  });

  it('finds nothing on a flat image', () => {
    expect(detectWheels(flat())).toHaveLength(0);
  });

  it('finds nothing in plain noise-free gradients', () => {
    const width = 240;
    const height = 160;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const v = Math.round((x / width) * 255);
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    expect(detectWheels({ width, height, data })).toHaveLength(0);
  });
});

describe('refineCircle', () => {
  it('snaps an offset guess back onto the wheel', () => {
    const img = scene();
    const refined = refineCircle(img, { x: TRUTH.x1 + 5, y: TRUTH.y - 4, r: TRUTH.r + 4 }, 8, 6);
    expect(Math.hypot(refined.x - TRUTH.x1, refined.y - TRUTH.y)).toBeLessThan(3);
    expect(Math.abs(refined.r - TRUTH.r)).toBeLessThanOrEqual(2);
  });
});

describe('extractTireSizeFromText', () => {
  it('reads a plain metric size', () => {
    expect(extractTireSizeFromText('225/45R17')).toBe('225/45R17');
  });

  it('reads a size embedded in other text', () => {
    expect(extractTireSizeFromText('Michelin PS4S 245/40ZR19 98Y XL')).toBe('245/40R19');
  });

  it('drops LT/P prefixes', () => {
    expect(extractTireSizeFromText('LT265/70R17 load E')).toBe('265/70R17');
    expect(extractTireSizeFromText('P215/60R16')).toBe('215/60R16');
  });

  it('reads flotation sizes', () => {
    expect(extractTireSizeFromText('33x12.50R15 mud terrain')).toBe('33x12.50R15');
  });

  it('returns null when there is no size', () => {
    expect(extractTireSizeFromText('rotate every 5000 miles')).toBeNull();
  });
});
