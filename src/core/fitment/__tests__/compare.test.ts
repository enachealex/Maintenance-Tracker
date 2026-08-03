import { compareFitment, worstLevel } from '../compare';
import { parseTireSize } from '../size';
import { WheelSpec } from '../types';

const size = (s: string) => parseTireSize(s)!;
const codes = (warnings: { code: string }[]) => warnings.map((w) => w.code);

const oeWheel: WheelSpec = { diameterIn: 17, widthIn: 7.5, offsetMm: 45 };

describe('compareFitment — a clean swap', () => {
  it('reports no warnings for an identical setup', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: oeWheel,
    });
    expect(result.warnings).toEqual([]);
    expect(worstLevel(result.warnings)).toBeNull();
  });

  it('reports zero deltas for an identical setup', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
    });
    expect(result.diameterDeltaMm).toBeCloseTo(0, 6);
    expect(result.sectionWidthDeltaMm).toBeCloseTo(0, 6);
    expect(result.revsPerMileDelta).toBeCloseTo(0, 6);
  });

  it('stays quiet about diameter on a proper plus-one', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/40R18'),
      oeWheel,
      proposedWheel: { diameterIn: 18, widthIn: 8, offsetMm: 45 },
    });
    expect(codes(result.warnings)).not.toContain('diameter-change');
  });
});

describe('compareFitment — diameter changes', () => {
  it('stays quiet just under the threshold', () => {
    // 245/45R17 on a 225/45R17 car is +2.8% — a common upsize, deliberately
    // below the point where the speedometer warning is worth showing.
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('245/45R17'),
    });
    expect(result.speedometerErrorPercent).toBeLessThan(3);
    expect(codes(result.warnings)).not.toContain('diameter-change');
  });

  it('warns once past three percent', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('255/45R17'),
    });
    expect(codes(result.warnings)).toContain('diameter-change');
  });

  it('escalates to critical past five percent, citing ABS', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('265/50R17'),
    });
    const warning = result.warnings.find((w) => w.code === 'diameter-change')!;
    expect(warning.level).toBe('critical');
    expect(warning.message).toMatch(/ABS/);
  });

  it('describes a taller tire as making the speedometer under-read', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('255/45R17'),
    });
    expect(result.speedometerErrorPercent).toBeGreaterThan(0);
    expect(result.warnings.find((w) => w.code === 'diameter-change')!.message).toMatch(
      /under-read/,
    );
  });

  it('describes a shorter tire as making it over-read', () => {
    const result = compareFitment({
      oeTire: size('245/45R17'),
      proposedTire: size('205/40R17'),
    });
    expect(result.speedometerErrorPercent).toBeLessThan(0);
    expect(result.warnings.find((w) => w.code === 'diameter-change')!.message).toMatch(
      /over-read/,
    );
  });
});

describe('compareFitment — load and speed ratings', () => {
  it('calls a load index below factory critical', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 94V'),
      proposedTire: size('225/45R17 88V'),
    });
    const warning = result.warnings.find((w) => w.code === 'load-index-below-oe')!;
    expect(warning.level).toBe('critical');
  });

  it('accepts a load index above factory', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 91V'),
      proposedTire: size('225/45R17 94V'),
    });
    expect(codes(result.warnings)).not.toContain('load-index-below-oe');
  });

  it('warns when a proposed size carries no load index at all', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 91V'),
      proposedTire: size('225/45R17'),
    });
    expect(codes(result.warnings)).toContain('load-index-unknown');
  });

  it('warns on a lower speed rating', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 91V'),
      proposedTire: size('225/45R17 91T'),
    });
    expect(codes(result.warnings)).toContain('speed-rating-below-oe');
  });

  it('accepts a higher speed rating', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 91V'),
      proposedTire: size('225/45R17 91Y'),
    });
    expect(codes(result.warnings)).not.toContain('speed-rating-below-oe');
  });
});

describe('compareFitment — stance', () => {
  it('skips stance entirely when wheels are not supplied', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
    });
    expect(result.stance).toBeNull();
    expect(codes(result.warnings)).not.toContain('poke');
  });

  it('warns about poke once the wheel moves 10mm outboard', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: { diameterIn: 17, widthIn: 7.5, offsetMm: 30 },
    });
    expect(codes(result.warnings)).toContain('poke');
  });

  it('escalates severe poke to critical and mentions coverage rules', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: { diameterIn: 17, widthIn: 7.5, offsetMm: 15 },
    });
    const warning = result.warnings.find((w) => w.code === 'poke-severe')!;
    expect(warning.level).toBe('critical');
    expect(warning.message).toMatch(/coverage|rules/i);
  });

  it('warns about inner clearance when offset climbs', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: { diameterIn: 17, widthIn: 7.5, offsetMm: 55 },
    });
    expect(codes(result.warnings)).toContain('inner-clearance');
  });

  it('does not warn about poke when the wheel tucks in', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: { diameterIn: 17, widthIn: 7.5, offsetMm: 55 },
    });
    expect(codes(result.warnings)).not.toContain('poke');
  });
});

describe('compareFitment — wheel and tire agreement', () => {
  it('calls a wheel/tire diameter mismatch critical', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/40R18'),
      oeWheel,
      proposedWheel: { diameterIn: 19, widthIn: 8, offsetMm: 45 },
    });
    const warning = result.warnings.find((w) => w.code === 'wheel-tire-diameter-mismatch')!;
    expect(warning.level).toBe('critical');
    expect(warning.message).toMatch(/will not mount/);
  });

  it('flags a stretched fit on an over-wide rim', () => {
    const result = compareFitment({
      oeTire: size('225/45R17'),
      proposedTire: size('225/45R17'),
      oeWheel,
      proposedWheel: { diameterIn: 17, widthIn: 10, offsetMm: 45 },
    });
    expect(codes(result.warnings)).toContain('tire-stretched');
  });

  it('flags a bulged fit on an under-wide rim', () => {
    const result = compareFitment({
      oeTire: size('275/40R20'),
      proposedTire: size('275/40R20'),
      oeWheel: { diameterIn: 20, widthIn: 9.5, offsetMm: 35 },
      proposedWheel: { diameterIn: 20, widthIn: 7, offsetMm: 35 },
    });
    expect(codes(result.warnings)).toContain('tire-bulged');
  });
});

describe('compareFitment — never blocks', () => {
  /**
   * An aggressive setup is a legitimate thing to want to look at. The engine
   * describes what is wrong with it and still returns full geometry so the
   * visualizer can render it.
   */
  it('returns usable geometry for a deliberately extreme setup', () => {
    const result = compareFitment({
      oeTire: size('225/45R17 91V'),
      proposedTire: size('165/25R22 80T'),
      oeWheel,
      proposedWheel: { diameterIn: 22, widthIn: 11, offsetMm: -20 },
    });
    expect(result.warnings.length).toBeGreaterThan(3);
    expect(worstLevel(result.warnings)).toBe('critical');
    // Still fully computed — nothing threw, nothing came back null.
    expect(result.proposed.overallDiameterMm).toBeGreaterThan(0);
    expect(result.stance).not.toBeNull();
    expect(Number.isFinite(result.proposed.revsPerMile)).toBe(true);
  });
});

describe('worstLevel', () => {
  it('ranks critical over caution over info', () => {
    expect(worstLevel([{ code: 'a', level: 'info', message: '' }])).toBe('info');
    expect(
      worstLevel([
        { code: 'a', level: 'info', message: '' },
        { code: 'b', level: 'caution', message: '' },
      ]),
    ).toBe('caution');
    expect(
      worstLevel([
        { code: 'a', level: 'caution', message: '' },
        { code: 'b', level: 'critical', message: '' },
      ]),
    ).toBe('critical');
  });

  it('returns null for a clean setup', () => {
    expect(worstLevel([])).toBeNull();
  });
});
