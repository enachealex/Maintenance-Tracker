import { Vehicle } from '../core/types';

/**
 * Navigation state. Three tab roots (home, maintenance, wheels) sit at the
 * base; every other screen is pushed on top of one of them and remembers which
 * via `from`, so backing out returns to the tab you came from rather than
 * always dumping you on home.
 */
export type TabKey = 'home' | 'maintenance' | 'wheels';

export type Nav =
  | { screen: 'home' }
  | { screen: 'maintenance' }
  | { screen: 'wheels'; vehicleId?: string }
  | { screen: 'add-vehicle'; from: TabKey }
  | { screen: 'add-mileage'; vehicle: Vehicle; from: TabKey }
  | { screen: 'vehicle'; id: string; editMileage?: boolean; from: TabKey };

export const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { key: 'wheels', label: 'Tires', icon: '🛞' },
];

/** The three base screens; everything else is a push on top of one of them. */
export function isTabRoot(n: Nav): boolean {
  return n.screen === 'home' || n.screen === 'maintenance' || n.screen === 'wheels';
}

/** Which tab a screen belongs to, including pushed screens. */
export function tabOf(n: Nav): TabKey {
  switch (n.screen) {
    case 'home':
    case 'maintenance':
    case 'wheels':
      return n.screen;
    default:
      return n.from;
  }
}

/**
 * The screen a back action (button, gesture, or hardware key) returns to.
 * Home is the base: callers guard against it rather than relying on a fixed
 * point here.
 */
export function parentOf(n: Nav): Nav {
  if (n.screen === 'add-mileage') return { screen: 'add-vehicle', from: n.from };
  // A selected vehicle inside Wheels backs out to the Wheels picker, not home.
  if (n.screen === 'wheels' && n.vehicleId) return { screen: 'wheels' };
  if (isTabRoot(n)) return { screen: 'home' };
  const tab = tabOf(n);
  return tab === 'maintenance'
    ? { screen: 'maintenance' }
    : tab === 'wheels'
      ? { screen: 'wheels' }
      : { screen: 'home' };
}
