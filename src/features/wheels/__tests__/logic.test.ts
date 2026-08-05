import {
  addBuild,
  stepTireSize,
  canVisualize,
  clearPhoto,
  fittedSizeOf,
  removeBuild,
  setPhoto,
  setPlacardSize,
  suggestedSizes,
  wheelsOf,
} from '../logic';
import { VehicleRecord, VehiclePhoto } from '../../../core/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const base: VehicleRecord = {
  id: 'v1',
  vehicle: { year: 2019, make: 'Ford', model: 'Mustang', trim: 'GT', engine: '5.0L 8-cyl' },
  currentMileage: 40_000,
  mileageUpdatedAt: null,
  tasks: {},
  mileageCadence: 'monthly',
  mileageCustomDays: 30,
  maintenanceCadence: 'weekly',
  maintenanceCustomDays: 7,
  customItems: [],
  createdAt: '2025-01-01T00:00:00.000Z',
};

const photo: VehiclePhoto = {
  uri: 'file:///car.jpg',
  calibration: {
    pixelsPerInch: 20,
    centerX: 100,
    centerY: 100,
    imageWidth: 1000,
    imageHeight: 800,
  },
  fittedTireSize: '235/40R18',
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('wheels state stays absent until used', () => {
  it('reads as empty without inventing the field', () => {
    expect(base.wheels).toBeUndefined();
    expect(wheelsOf(base).builds).toEqual([]);
  });

  it('never mutates the record it is given', () => {
    const next = setPlacardSize(base, '225/45R17');
    expect(base.wheels).toBeUndefined();
    expect(next.wheels!.placardTireSize).toBe('225/45R17');
  });

  it('leaves the rest of the record untouched', () => {
    const next = addBuild(base, '245/35R19');
    const { wheels: _a, ...restNext } = next;
    const { wheels: _b, ...restBase } = base;
    expect(restNext).toEqual(restBase);
  });
});

describe('fittedSizeOf', () => {
  it('is null before anything is known', () => {
    expect(fittedSizeOf(base)).toBeNull();
  });

  it('falls back to the placard size', () => {
    expect(fittedSizeOf(setPlacardSize(base, '225/45R17'))).toBe('225/45R17');
  });

  /**
   * The photo's fitted size wins over the placard. On a modified car those
   * differ, and calibration measures against the wheel actually in the photo.
   */
  it('prefers the size fitted in the photo over the factory placard', () => {
    const rec = setPhoto(setPlacardSize(base, '225/45R17'), photo);
    expect(fittedSizeOf(rec)).toBe('235/40R18');
  });
});

describe('builds', () => {
  it('adds a build, defaulting its name to the size', () => {
    const rec = addBuild(base, ' 245/35R19 ');
    expect(rec.wheels!.builds).toHaveLength(1);
    expect(rec.wheels!.builds[0].tireSize).toBe('245/35R19');
    expect(rec.wheels!.builds[0].name).toBe('245/35R19');
  });

  it('keeps a name when one is given', () => {
    const rec = addBuild(base, '245/35R19', 'Summer set');
    expect(rec.wheels!.builds[0].name).toBe('Summer set');
  });

  it('appends rather than replacing', () => {
    const rec = addBuild(addBuild(base, '245/35R19'), '225/40R18');
    expect(rec.wheels!.builds.map((b) => b.tireSize)).toEqual(['245/35R19', '225/40R18']);
  });

  it('removes only the build asked for', () => {
    const rec = addBuild(addBuild(base, '245/35R19'), '225/40R18');
    const id = rec.wheels!.builds[0].id;
    expect(removeBuild(rec, id).wheels!.builds.map((b) => b.tireSize)).toEqual(['225/40R18']);
  });

  it('ignores an unknown build id', () => {
    const rec = addBuild(base, '245/35R19');
    expect(removeBuild(rec, 'nope').wheels!.builds).toHaveLength(1);
  });

  it('keeps builds when the photo is cleared', () => {
    const rec = clearPhoto(setPhoto(addBuild(base, '245/35R19'), photo));
    expect(rec.wheels!.photo).toBeUndefined();
    expect(rec.wheels!.builds).toHaveLength(1);
  });
});

describe('canVisualize', () => {
  it('is false with no photo', () => {
    expect(canVisualize(base)).toBe(false);
  });

  it('is true with a calibrated photo and a readable fitted size', () => {
    expect(canVisualize(setPhoto(base, photo))).toBe(true);
  });

  it('is false when calibration never completed', () => {
    const bad = { ...photo, calibration: { ...photo.calibration, pixelsPerInch: 0 } };
    expect(canVisualize(setPhoto(base, bad))).toBe(false);
  });

  it('is false when the fitted size cannot be parsed', () => {
    const bad = { ...photo, fittedTireSize: 'not a size' };
    expect(canVisualize(setPhoto(base, bad))).toBe(false);
  });
});

describe('suggestedSizes', () => {
  it('offers a plus-one and a minus-one that hold diameter', () => {
    const out = suggestedSizes('225/45R17');
    expect(out).toContain('225/40R18');
    expect(out).toContain('225/50R16');
  });

  it('keeps section width, changing only rim and aspect', () => {
    for (const s of suggestedSizes('245/40R18')) {
      expect(s.startsWith('245/')).toBe(true);
    }
  });

  it('returns nothing for a flotation size, where plus sizing does not apply', () => {
    expect(suggestedSizes('33x12.50R17')).toEqual([]);
  });

  it('returns nothing for unreadable input', () => {
    expect(suggestedSizes('nonsense')).toEqual([]);
  });

  it('drops suggestions that would fall outside sane aspect ratios', () => {
    // A very low-profile 22" has no sensible plus-one.
    for (const s of suggestedSizes('285/25R22')) {
      const aspect = Number(s.split('/')[1].split('R')[0]);
      expect(aspect).toBeGreaterThanOrEqual(25);
      expect(aspect).toBeLessThanOrEqual(85);
    }
  });
});

describe('stepTireSize', () => {
  it('steps width by 10mm, aspect by 5, rim by 1"', () => {
    expect(stepTireSize('225/45R17', 'width', 1)).toBe('235/45R17');
    expect(stepTireSize('225/45R17', 'aspect', -1)).toBe('225/40R17');
    expect(stepTireSize('225/45R17', 'rim', 1)).toBe('225/45R18');
  });

  it('starts from the fallback when the current value is empty or unreadable', () => {
    expect(stepTireSize('', 'rim', 1, '225/45R17')).toBe('225/45R18');
    expect(stepTireSize('garbage', 'width', -1, '225/45R17')).toBe('215/45R17');
  });

  it('clamps at the edge of the plausible range', () => {
    expect(stepTireSize('105/45R17', 'width', -1)).toBeNull();
    expect(stepTireSize('225/20R17', 'aspect', -1)).toBeNull();
    expect(stepTireSize('225/45R30', 'rim', 1)).toBeNull();
  });

  it('does not step flotation sizes', () => {
    expect(stepTireSize('33x12.50R17', 'rim', 1)).toBeNull();
  });

  it('returns null with no base at all', () => {
    expect(stepTireSize('', 'rim', 1)).toBeNull();
  });

  it('drops load and speed markings rather than carrying unchecked ratings', () => {
    expect(stepTireSize('225/45R17 91V', 'rim', 1)).toBe('225/45R18');
  });

  it('round-trips through the parser', () => {
    const out = stepTireSize('265/35R19', 'aspect', 1)!;
    expect(out).toBe('265/40R19');
  });
});
