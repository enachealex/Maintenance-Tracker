import { formatTireSize, parseTireSize, recommendedRimWidthIn, validateTireSize } from '../size';

describe('parseTireSize — metric', () => {
  it('parses a plain size', () => {
    const s = parseTireSize('275/40R20')!;
    expect(s.kind).toBe('metric');
    expect(s.sectionWidthMm).toBe(275);
    expect(s.aspectRatio).toBe(40);
    expect(s.rimDiameterIn).toBe(20);
    expect(s.construction).toBe('R');
    expect(s.serviceType).toBe('');
    expect(s.loadIndex).toBeNull();
  });

  it('parses a P-metric size with load index and speed rating', () => {
    const s = parseTireSize('P225/45R17 91V')!;
    expect(s.serviceType).toBe('P');
    expect(s.sectionWidthMm).toBe(225);
    expect(s.loadIndex).toBe(91);
    expect(s.speedRating).toBe('V');
  });

  it('parses a light-truck size', () => {
    const s = parseTireSize('LT275/70R18')!;
    expect(s.serviceType).toBe('LT');
    expect(s.aspectRatio).toBe(70);
  });

  it('treats a Z before the R as the speed marking', () => {
    const s = parseTireSize('275/40ZR20')!;
    expect(s.zRated).toBe(true);
    expect(s.speedRating).toBe('ZR');
  });

  it('keeps an explicit rating when Z is also present', () => {
    const s = parseTireSize('275/40ZR20 106Y')!;
    expect(s.zRated).toBe(true);
    expect(s.speedRating).toBe('Y');
    expect(s.loadIndex).toBe(106);
  });

  it('is forgiving about case and whitespace', () => {
    const a = parseTireSize('  p225 / 45 r 17  ')!;
    expect(a.serviceType).toBe('P');
    expect(a.sectionWidthMm).toBe(225);
    expect(a.rimDiameterIn).toBe(17);
  });

  it('handles fractional rim diameters used on trucks', () => {
    const s = parseTireSize('295/75R22.5')!;
    expect(s.rimDiameterIn).toBe(22.5);
  });

  it('preserves the raw input for display', () => {
    expect(parseTireSize('  275/40R20 ')!.raw).toBe('275/40R20');
  });
});

describe('parseTireSize — flotation', () => {
  it('derives aspect ratio from the stated overall diameter', () => {
    const s = parseTireSize('33x12.50R17')!;
    expect(s.kind).toBe('flotation');
    expect(s.rimDiameterIn).toBe(17);
    // (33 - 17) / 2 = 8" of sidewall on a 12.5" section.
    expect(s.sectionWidthMm).toBeCloseTo(317.5, 1);
    expect(s.aspectRatio).toBeCloseTo(64, 1);
  });

  it('accepts an LT suffix and a rating', () => {
    const s = parseTireSize('35X12.50R20LT 121Q')!;
    expect(s.serviceType).toBe('LT');
    expect(s.loadIndex).toBe(121);
    expect(s.speedRating).toBe('Q');
  });
});

describe('parseTireSize — rejection', () => {
  it('returns null only when the input cannot be read at all', () => {
    expect(parseTireSize('')).toBeNull();
    expect(parseTireSize('not a tire')).toBeNull();
    expect(parseTireSize('275')).toBeNull();
    expect(parseTireSize('275/40')).toBeNull();
  });

  it('still parses sizes that are unusual rather than malformed', () => {
    // Deliberately extreme, but readable — the user gets a warning, not a wall.
    expect(parseTireSize('165/25R22')).not.toBeNull();
  });
});

describe('formatTireSize', () => {
  it('round-trips a metric size', () => {
    expect(formatTireSize(parseTireSize('275/40R20')!)).toBe('275/40R20');
  });

  it('round-trips a P-metric size with ratings', () => {
    expect(formatTireSize(parseTireSize('P225/45R17 91V')!)).toBe('P225/45R17 91V');
  });

  it('round-trips a flotation size', () => {
    expect(formatTireSize(parseTireSize('33x12.50R17')!)).toBe('33x12.50R17');
  });

  it('survives a parse → format → parse cycle unchanged', () => {
    for (const input of ['275/40R20', 'LT275/70R18', 'P225/45R17 91V', '33x12.50R17']) {
      const once = parseTireSize(input)!;
      const twice = parseTireSize(formatTireSize(once))!;
      expect(twice.sectionWidthMm).toBeCloseTo(once.sectionWidthMm, 2);
      expect(twice.aspectRatio).toBeCloseTo(once.aspectRatio, 2);
      expect(twice.rimDiameterIn).toBe(once.rimDiameterIn);
    }
  });
});

describe('validateTireSize', () => {
  it('passes an ordinary size with no complaints', () => {
    expect(validateTireSize(parseTireSize('225/45R17')!)).toEqual([]);
  });

  it('flags an unusual aspect ratio without blocking it', () => {
    const warnings = validateTireSize(parseTireSize('165/20R22')!);
    expect(warnings.map((w) => w.code)).toContain('unusual-aspect-ratio');
    expect(warnings.every((w) => w.level !== 'critical')).toBe(true);
  });

  it('flags an unusual section width', () => {
    expect(validateTireSize(parseTireSize('455/40R20')!).map((w) => w.code)).toContain(
      'unusual-section-width',
    );
  });

  it('flags an unusual rim diameter', () => {
    expect(validateTireSize(parseTireSize('275/40R34')!).map((w) => w.code)).toContain(
      'unusual-rim-diameter',
    );
  });

  it('calls a negative sidewall critical', () => {
    // A 40" rim under a 33" overall diameter is geometrically impossible.
    const impossible = parseTireSize('33x12.50R40')!;
    const warnings = validateTireSize(impossible);
    expect(warnings.map((w) => w.code)).toContain('impossible-sidewall');
    expect(warnings.find((w) => w.code === 'impossible-sidewall')!.level).toBe('critical');
  });

  it('notes non-radial construction', () => {
    expect(validateTireSize(parseTireSize('275/40D20')!).map((w) => w.code)).toContain(
      'non-radial',
    );
  });
});

describe('recommendedRimWidthIn', () => {
  it('brackets the published range for a common size', () => {
    // 225/45R17 is approved for roughly 7.0–8.5" rims.
    const { min, max } = recommendedRimWidthIn(parseTireSize('225/45R17')!);
    expect(min).toBeCloseTo(6.9, 1);
    expect(max).toBeCloseTo(8.9, 1);
  });

  it('scales with section width', () => {
    const narrow = recommendedRimWidthIn(parseTireSize('195/65R15')!);
    const wide = recommendedRimWidthIn(parseTireSize('305/30R20')!);
    expect(wide.min).toBeGreaterThan(narrow.min);
  });
});
