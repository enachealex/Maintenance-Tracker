import {
  backspacingToOffset,
  geometryOf,
  innerEdgeFromHubMm,
  offsetToBackspacing,
  outerEdgeFromHubMm,
  speedometerErrorPercent,
  stanceDelta,
  trueSpeed,
} from '../geometry';
import { parseTireSize } from '../size';

const size = (s: string) => parseTireSize(s)!;

describe('geometryOf', () => {
  it('computes 275/40R20 against hand-worked numbers', () => {
    const g = geometryOf(size('275/40R20'));
    // 275 × 0.40 = 110mm sidewall; 20" rim = 508mm; 508 + 220 = 728mm.
    expect(g.sidewallMm).toBeCloseTo(110, 4);
    expect(g.overallDiameterMm).toBeCloseTo(728, 4);
    expect(g.overallDiameterIn).toBeCloseTo(28.66, 2);
    expect(g.circumferenceIn).toBeCloseTo(90.04, 1);
    expect(g.revsPerMile).toBeCloseTo(703.7, 0);
  });

  it('computes 225/45R17', () => {
    const g = geometryOf(size('225/45R17'));
    expect(g.sidewallMm).toBeCloseTo(101.25, 4);
    expect(g.overallDiameterMm).toBeCloseTo(634.3, 1);
  });

  it('recovers the stated diameter of a flotation size', () => {
    // The whole point of the flotation format: 33" is given, not derived.
    const g = geometryOf(size('33x12.50R17'));
    expect(g.overallDiameterIn).toBeCloseTo(33, 4);
  });

  it('gives a larger tire fewer revolutions per mile', () => {
    expect(geometryOf(size('275/40R20')).revsPerMile).toBeLessThan(
      geometryOf(size('225/45R17')).revsPerMile,
    );
  });

  it('does not divide by zero on a degenerate size', () => {
    const g = geometryOf({ ...size('33x12.50R40'), aspectRatio: -100 });
    expect(Number.isFinite(g.revsPerMile)).toBe(true);
  });
});

describe('offset and backspacing', () => {
  it('converts offset to backspacing on an 8" +35 wheel', () => {
    // Overall rim width is bead seat + 1" of flange, so half is 4.5".
    expect(offsetToBackspacing(8, 35)).toBeCloseTo(5.878, 3);
  });

  it('round-trips back to the original offset', () => {
    for (const [width, offset] of [
      [8, 35],
      [9.5, 22],
      [7, -12],
      [12, 0],
    ] as const) {
      expect(backspacingToOffset(width, offsetToBackspacing(width, offset))).toBeCloseTo(
        offset,
        6,
      );
    }
  });

  it('treats zero offset as centered', () => {
    expect(offsetToBackspacing(9, 0)).toBeCloseTo(5, 6);
  });

  it('puts a negative-offset wheel further out than a positive one', () => {
    const deep = { diameterIn: 18, widthIn: 9, offsetMm: -12 };
    const tucked = { diameterIn: 18, widthIn: 9, offsetMm: 45 };
    expect(outerEdgeFromHubMm(deep)).toBeGreaterThan(outerEdgeFromHubMm(tucked));
  });

  it('puts a high-offset wheel deeper toward the strut', () => {
    const deep = { diameterIn: 18, widthIn: 9, offsetMm: -12 };
    const tucked = { diameterIn: 18, widthIn: 9, offsetMm: 45 };
    expect(innerEdgeFromHubMm(tucked)).toBeGreaterThan(innerEdgeFromHubMm(deep));
  });
});

describe('stanceDelta', () => {
  const oe = { diameterIn: 18, widthIn: 8, offsetMm: 45 };

  it('measures both edges moving when going wider and lower-offset', () => {
    const proposed = { diameterIn: 18, widthIn: 9, offsetMm: 35 };
    const d = stanceDelta(oe, proposed);
    // Outer: (114.3 − 35) − (101.6 − 45) = 22.7mm further out.
    expect(d.pokeDeltaMm).toBeCloseTo(22.7, 1);
    // Inner: (114.3 + 35) − (101.6 + 45) = 2.7mm deeper in.
    expect(d.innerClearanceDeltaMm).toBeCloseTo(2.7, 1);
  });

  it('reports no movement for an identical wheel', () => {
    const d = stanceDelta(oe, { ...oe });
    expect(d.pokeDeltaMm).toBeCloseTo(0, 6);
    expect(d.innerClearanceDeltaMm).toBeCloseTo(0, 6);
  });

  it('moves the wheel outboard as offset drops, width held constant', () => {
    const d = stanceDelta(oe, { ...oe, offsetMm: 25 });
    expect(d.pokeDeltaMm).toBeCloseTo(20, 6);
    // Same width and lower offset pulls the inner edge away from the strut.
    expect(d.innerClearanceDeltaMm).toBeCloseTo(-20, 6);
  });

  it('splits added width evenly when offset is unchanged', () => {
    const d = stanceDelta(oe, { ...oe, widthIn: 10 });
    expect(d.pokeDeltaMm).toBeCloseTo(25.4, 4);
    expect(d.innerClearanceDeltaMm).toBeCloseTo(25.4, 4);
  });
});

describe('speedometer error', () => {
  const oe = geometryOf(size('225/45R17'));

  it('is zero for an identical size', () => {
    expect(speedometerErrorPercent(oe, geometryOf(size('225/45R17')))).toBeCloseTo(0, 6);
  });

  it('is positive — under-reading — for a taller tire', () => {
    const taller = geometryOf(size('245/45R17'));
    expect(speedometerErrorPercent(oe, taller)).toBeGreaterThan(0);
  });

  it('is negative for a shorter tire', () => {
    const shorter = geometryOf(size('205/45R17'));
    expect(speedometerErrorPercent(oe, shorter)).toBeLessThan(0);
  });

  it('reports a true speed above the indicated one on a taller tire', () => {
    const taller = geometryOf(size('245/45R17'));
    expect(trueSpeed(60, oe, taller)).toBeGreaterThan(60);
  });

  it('agrees with the percentage it reports', () => {
    const taller = geometryOf(size('245/45R17'));
    const pct = speedometerErrorPercent(oe, taller);
    expect(trueSpeed(100, oe, taller)).toBeCloseTo(100 + pct, 6);
  });
});

describe('plus sizing', () => {
  /**
   * The compositor leans on this: a proper plus size keeps overall diameter
   * near constant, so a swapped wheel covers nearly the same pixels and simple
   * occlusion hides the original.
   */
  it('keeps overall diameter within one percent going up a wheel size', () => {
    const stock = geometryOf(size('225/45R17'));
    const plusOne = geometryOf(size('225/40R18'));
    const pct = Math.abs(speedometerErrorPercent(stock, plusOne));
    expect(pct).toBeLessThan(1);
  });

  it('trades sidewall for wheel while holding diameter', () => {
    const stock = geometryOf(size('225/45R17'));
    const plusOne = geometryOf(size('225/40R18'));
    expect(plusOne.sidewallMm).toBeLessThan(stock.sidewallMm);
    expect(plusOne.size.rimDiameterIn).toBeGreaterThan(stock.size.rimDiameterIn);
  });
});
