import { lookupOemTireSize } from '../oemTires';
import { Vehicle } from '../types';

const v = (year: number, make: string, model: string, trim = ''): Vehicle => ({
  year,
  make,
  model,
  trim,
  engine: '',
});

describe('lookupOemTireSize', () => {
  it('matches make/model/year with the default size', () => {
    expect(lookupOemTireSize(v(2020, 'Ford', 'F-150', 'XLT'))).toBe('265/70R17');
  });

  it('is case-insensitive on make and model', () => {
    expect(lookupOemTireSize(v(2020, 'ford', 'f-150'))).toBe('265/70R17');
  });

  it('picks the trim-specific size when a keyword matches', () => {
    expect(lookupOemTireSize(v(2019, 'Ford', 'Mustang', 'GT Premium'))).toBe('255/40R19');
    expect(lookupOemTireSize(v(2022, 'Toyota', 'Tacoma', 'TRD Off-Road'))).toBe('265/70R16');
    expect(lookupOemTireSize(v(2021, 'Jeep', 'Wrangler', 'Rubicon'))).toBe('285/70R17');
  });

  it('longer trim rules win over their prefixes', () => {
    // "GT Premium" must not fall through to the plain "GT" rule.
    expect(lookupOemTireSize(v(2019, 'Ford', 'Mustang', 'GT'))).toBe('235/50R18');
    expect(lookupOemTireSize(v(2019, 'Ford', 'Mustang', 'GT Premium'))).toBe('255/40R19');
  });

  it('matches trim keywords as whole words only', () => {
    // XLE contains "le" but is not the LE trim.
    expect(lookupOemTireSize(v(2020, 'Toyota', 'Camry', 'XLE'))).toBe('215/55R17');
    expect(lookupOemTireSize(v(2020, 'Toyota', 'Camry', 'LE'))).toBe('205/65R16');
    expect(lookupOemTireSize(v(2020, 'Toyota', 'Camry', 'XSE'))).toBe('235/45R18');
  });

  it('falls back to the default size for unknown trims', () => {
    expect(lookupOemTireSize(v(2022, 'Toyota', 'Tacoma', 'SR5'))).toBe('245/75R16');
  });

  it('returns null outside the year range', () => {
    expect(lookupOemTireSize(v(2005, 'Ford', 'Mustang', 'GT'))).toBeNull();
  });

  it('returns null for models not in the table', () => {
    expect(lookupOemTireSize(v(2020, 'Bugatti', 'Chiron', ''))).toBeNull();
  });
});
