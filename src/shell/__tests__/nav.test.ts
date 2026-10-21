import { isTabRoot, Nav, parentOf, tabOf } from '../nav';

const vehicle = { year: 2019, make: 'Ford', model: 'Mustang', trim: 'GT', engine: '5.0L V8' };

describe('isTabRoot', () => {
  it('is true for the three tab roots', () => {
    expect(isTabRoot({ screen: 'home' })).toBe(true);
    expect(isTabRoot({ screen: 'maintenance' })).toBe(true);
    expect(isTabRoot({ screen: 'wheels' })).toBe(true);
  });

  it('stays true for a wheels root that has a vehicle selected', () => {
    expect(isTabRoot({ screen: 'wheels', vehicleId: 'v1' })).toBe(true);
  });

  it('is false for pushed screens', () => {
    expect(isTabRoot({ screen: 'add-vehicle', from: 'home' })).toBe(false);
    expect(isTabRoot({ screen: 'vehicle', id: 'v1', from: 'maintenance' })).toBe(false);
  });
});

describe('tabOf', () => {
  it('reads the tab off a root directly', () => {
    expect(tabOf({ screen: 'maintenance' })).toBe('maintenance');
  });

  it('reads the originating tab off a pushed screen', () => {
    expect(tabOf({ screen: 'vehicle', id: 'v1', from: 'wheels' })).toBe('wheels');
    expect(tabOf({ screen: 'add-mileage', vehicle, from: 'home' })).toBe('home');
  });
});

describe('parentOf', () => {
  it('returns a pushed screen to the tab it came from, not always home', () => {
    expect(parentOf({ screen: 'vehicle', id: 'v1', from: 'maintenance' })).toEqual({
      screen: 'maintenance',
    });
    expect(parentOf({ screen: 'vehicle', id: 'v1', from: 'wheels' })).toEqual({
      screen: 'wheels',
    });
    expect(parentOf({ screen: 'vehicle', id: 'v1', from: 'home' })).toEqual({ screen: 'home' });
  });

  it('keeps the add-vehicle → add-mileage flow stepping backwards one screen', () => {
    expect(parentOf({ screen: 'add-mileage', vehicle, from: 'wheels' })).toEqual({
      screen: 'add-vehicle',
      from: 'wheels',
    });
  });

  it('sends non-home tab roots to home', () => {
    expect(parentOf({ screen: 'maintenance' })).toEqual({ screen: 'home' });
    expect(parentOf({ screen: 'wheels' })).toEqual({ screen: 'home' });
  });

  it('terminates at home so back from the base exits instead of looping', () => {
    expect(parentOf({ screen: 'home' })).toEqual({ screen: 'home' });
  });

  it('backs a selected Tires vehicle out to the picker, not home', () => {
    expect(parentOf({ screen: 'wheels', vehicleId: 'v1' })).toEqual({ screen: 'wheels' });
  });

  it('never returns a screen deeper than the one it was given', () => {
    const pushed: Nav[] = [
      { screen: 'add-vehicle', from: 'home' },
      { screen: 'add-mileage', vehicle, from: 'maintenance' },
      { screen: 'vehicle', id: 'v1', from: 'wheels' },
      { screen: 'maintenance' },
      { screen: 'wheels' },
    ];
    // Walking parents repeatedly must always reach home.
    for (const start of pushed) {
      let cur = start;
      for (let i = 0; i < 5 && cur.screen !== 'home'; i++) cur = parentOf(cur);
      expect(cur).toEqual({ screen: 'home' });
    }
  });
});
