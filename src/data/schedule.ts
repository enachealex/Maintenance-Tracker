import { ScheduleItem } from '../types';

/**
 * Generic manufacturer-typical maintenance intervals (miles).
 * These are widely-accepted averages; the owner's manual always wins.
 */
export const SCHEDULE: ScheduleItem[] = [
  {
    id: 'oil-change',
    name: 'Engine oil & filter',
    description: 'Replace engine oil and oil filter.',
    intervalMiles: 5000,
    intervalMonths: 6,
    icon: '🛢️',
  },
  {
    id: 'tire-rotation',
    name: 'Tire rotation',
    description: 'Rotate tires to even out tread wear.',
    intervalMiles: 5000,
    intervalMonths: 6,
    icon: '🛞',
  },
  {
    id: 'brake-inspection',
    name: 'Brake inspection',
    description: 'Inspect brake pads, rotors and lines for wear.',
    intervalMiles: 10000,
    intervalMonths: 12,
    icon: '🛑',
  },
  {
    id: 'wiper-blades',
    name: 'Wiper blades',
    description: 'Replace windshield wiper blades.',
    intervalMiles: 15000,
    intervalMonths: 12,
    icon: '🌧️',
  },
  {
    id: 'cabin-air-filter',
    name: 'Cabin air filter',
    description: 'Replace the cabin (HVAC) air filter.',
    intervalMiles: 15000,
    intervalMonths: 12,
    icon: '🌬️',
  },
  {
    id: 'alignment-check',
    name: 'Wheel alignment check',
    description: 'Check and adjust wheel alignment if pulling or uneven wear.',
    intervalMiles: 20000,
    intervalMonths: 24,
    icon: '📐',
  },
  {
    id: 'engine-air-filter',
    name: 'Engine air filter',
    description: 'Replace the engine air intake filter.',
    intervalMiles: 30000,
    intervalMonths: 36,
    icon: '💨',
  },
  {
    id: 'brake-fluid',
    name: 'Brake fluid',
    description: 'Flush and replace brake fluid.',
    intervalMiles: 30000,
    intervalMonths: 36,
    icon: '🧪',
  },
  {
    id: 'battery-test',
    name: 'Battery test',
    description: 'Load-test the 12V battery and clean terminals.',
    intervalMiles: 30000,
    intervalMonths: 36,
    icon: '🔋',
  },
  {
    id: 'transmission-fluid',
    name: 'Transmission fluid',
    description: 'Replace automatic/manual transmission fluid.',
    intervalMiles: 60000,
    intervalMonths: 60,
    icon: '⚙️',
  },
  {
    id: 'coolant',
    name: 'Engine coolant',
    description: 'Drain and replace engine coolant / antifreeze.',
    intervalMiles: 60000,
    intervalMonths: 60,
    icon: '🌡️',
  },
  {
    id: 'spark-plugs',
    name: 'Spark plugs',
    description: 'Replace spark plugs (iridium plugs may last up to 100k).',
    intervalMiles: 60000,
    intervalMonths: 72,
    icon: '⚡',
  },
  {
    id: 'serpentine-belt',
    name: 'Serpentine belt',
    description: 'Inspect and replace the accessory drive belt.',
    intervalMiles: 60000,
    intervalMonths: 60,
    icon: '➰',
  },
  {
    id: 'differential-fluid',
    name: 'Differential / transfer case fluid',
    description: 'Replace differential (and transfer case, if AWD/4WD) fluid.',
    intervalMiles: 60000,
    intervalMonths: 60,
    icon: '🔩',
  },
];

export const getItem = (id: string): ScheduleItem | undefined =>
  SCHEDULE.find((s) => s.id === id);
