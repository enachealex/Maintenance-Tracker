import { Vehicle } from './types';

/**
 * Best-effort factory tire sizes for common US-market vehicles.
 *
 * There is no free, unauthenticated source of OEM tire sizes by
 * year/make/model (NHTSA vPIC only carries wheel data on VIN decodes, and
 * the real fitment databases are licensed), so this is a curated table of
 * the most popular models. Every size here is the typical fitment for the
 * matched trim — staggered setups list the front size. The UI treats a hit
 * as a pre-fill, never as truth: the field stays editable and the hint
 * points at the door-jamb placard.
 *
 * Match order: make+model exact (case-insensitive), year inside the range,
 * then the first trim rule whose keyword appears in the trim string; `size`
 * is the fallback when no rule matches.
 */

interface OemEntry {
  make: string;
  model: string;
  from: number;
  to: number;
  /** First keyword hit wins; checked against the trim, case-insensitively. */
  trims?: { keywords: string[]; size: string }[];
  size: string;
}

const OEM_FITMENTS: OemEntry[] = [
  // ——— Demo & enthusiast staples ———
  {
    make: 'Ford', model: 'Mustang', from: 2015, to: 2023,
    trims: [
      { keywords: ['gt premium'], size: '255/40R19' },
      { keywords: ['mach 1'], size: '255/40R19' },
      { keywords: ['gt'], size: '235/50R18' },
    ],
    size: '235/50R18',
  },
  {
    make: 'Toyota', model: 'Tacoma', from: 2016, to: 2023,
    trims: [
      { keywords: ['trd off-road', 'trd off road', 'trd pro'], size: '265/70R16' },
      { keywords: ['trd sport'], size: '265/65R17' },
      { keywords: ['limited'], size: '265/60R18' },
    ],
    size: '245/75R16',
  },
  {
    make: 'Chevrolet', model: 'Camaro', from: 2016, to: 2023,
    trims: [{ keywords: ['ss'], size: '245/40R20' }],
    size: '245/50R18',
  },
  {
    make: 'Dodge', model: 'Challenger', from: 2015, to: 2023,
    trims: [{ keywords: ['r/t', 'scat', 'srt'], size: '245/45R20' }],
    size: '235/55R18',
  },
  {
    make: 'Dodge', model: 'Charger', from: 2015, to: 2023,
    trims: [{ keywords: ['r/t', 'scat', 'srt'], size: '245/45R20' }],
    size: '235/55R19',
  },
  // ——— Pickups ———
  { make: 'Ford', model: 'F-150', from: 2015, to: 2024, size: '265/70R17' },
  { make: 'Ford', model: 'Ranger', from: 2019, to: 2023,
    trims: [{ keywords: ['lariat'], size: '265/60R18' }], size: '255/70R16' },
  { make: 'Ford', model: 'Maverick', from: 2022, to: 2024,
    trims: [{ keywords: ['lariat'], size: '225/60R18' }], size: '225/65R17' },
  { make: 'Chevrolet', model: 'Silverado 1500', from: 2014, to: 2024, size: '265/70R17' },
  { make: 'Chevrolet', model: 'Colorado', from: 2015, to: 2022, size: '255/65R17' },
  { make: 'GMC', model: 'Sierra 1500', from: 2014, to: 2024, size: '265/70R17' },
  { make: 'Ram', model: '1500', from: 2013, to: 2024, size: '275/65R18' },
  // ——— SUVs & crossovers ———
  {
    make: 'Toyota', model: 'RAV4', from: 2019, to: 2024,
    trims: [{ keywords: ['xse', 'limited'], size: '235/55R19' }],
    size: '225/65R17',
  },
  {
    make: 'Toyota', model: '4Runner', from: 2010, to: 2024,
    trims: [{ keywords: ['limited'], size: '245/60R20' }],
    size: '265/70R17',
  },
  { make: 'Toyota', model: 'Highlander', from: 2020, to: 2024,
    trims: [{ keywords: ['limited', 'platinum'], size: '235/55R20' }], size: '235/65R18' },
  {
    make: 'Honda', model: 'CR-V', from: 2017, to: 2022,
    trims: [{ keywords: ['lx'], size: '235/65R17' }],
    size: '235/60R18',
  },
  { make: 'Honda', model: 'Pilot', from: 2016, to: 2022, size: '245/60R18' },
  {
    make: 'Jeep', model: 'Wrangler', from: 2018, to: 2024,
    trims: [
      { keywords: ['rubicon'], size: '285/70R17' },
      { keywords: ['sahara'], size: '255/70R18' },
    ],
    size: '245/75R17',
  },
  { make: 'Jeep', model: 'Grand Cherokee', from: 2011, to: 2021, size: '265/60R18' },
  {
    make: 'Ford', model: 'Bronco', from: 2021, to: 2024,
    trims: [
      { keywords: ['sasquatch'], size: '315/70R17' },
      { keywords: ['badlands'], size: '285/70R17' },
    ],
    size: '255/70R16',
  },
  { make: 'Ford', model: 'Explorer', from: 2020, to: 2024,
    trims: [{ keywords: ['st'], size: '275/45R21' }], size: '255/65R18' },
  { make: 'Ford', model: 'Escape', from: 2020, to: 2024,
    trims: [{ keywords: ['titanium'], size: '225/55R19' }], size: '225/65R17' },
  { make: 'Chevrolet', model: 'Equinox', from: 2018, to: 2024,
    trims: [{ keywords: ['premier'], size: '235/50R19' }], size: '225/65R17' },
  { make: 'Nissan', model: 'Rogue', from: 2021, to: 2024,
    trims: [{ keywords: ['sl', 'platinum'], size: '235/55R19' }], size: '235/65R17' },
  { make: 'Subaru', model: 'Outback', from: 2020, to: 2024,
    trims: [{ keywords: ['xt', 'touring'], size: '225/60R18' }], size: '225/65R17' },
  { make: 'Subaru', model: 'Forester', from: 2019, to: 2024,
    trims: [{ keywords: ['sport'], size: '225/55R18' }], size: '225/60R17' },
  { make: 'Subaru', model: 'Crosstrek', from: 2018, to: 2023, size: '225/60R17' },
  { make: 'Hyundai', model: 'Tucson', from: 2022, to: 2024,
    trims: [{ keywords: ['limited'], size: '235/55R19' }], size: '235/65R17' },
  { make: 'Kia', model: 'Telluride', from: 2020, to: 2024,
    trims: [{ keywords: ['ex', 'sx'], size: '245/50R20' }], size: '245/60R18' },
  { make: 'Kia', model: 'Sportage', from: 2023, to: 2024,
    trims: [{ keywords: ['sx'], size: '235/55R19' }], size: '235/65R17' },
  // ——— Sedans & hatchbacks ———
  {
    make: 'Toyota', model: 'Camry', from: 2018, to: 2024,
    trims: [
      { keywords: ['se', 'xse'], size: '235/45R18' },
      { keywords: ['le'], size: '205/65R16' },
    ],
    size: '215/55R17',
  },
  {
    make: 'Toyota', model: 'Corolla', from: 2020, to: 2024,
    trims: [{ keywords: ['se', 'xse'], size: '225/40R18' }],
    size: '205/55R16',
  },
  {
    make: 'Honda', model: 'Civic', from: 2016, to: 2021,
    trims: [
      { keywords: ['sport', 'touring'], size: '235/40R18' },
      { keywords: ['lx'], size: '215/55R16' },
    ],
    size: '215/50R17',
  },
  {
    make: 'Honda', model: 'Accord', from: 2018, to: 2022,
    trims: [{ keywords: ['sport', 'touring'], size: '235/40R19' }],
    size: '225/50R17',
  },
  { make: 'Nissan', model: 'Altima', from: 2019, to: 2024,
    trims: [{ keywords: ['sr'], size: '235/40R19' }], size: '215/55R17' },
  { make: 'Hyundai', model: 'Elantra', from: 2021, to: 2024,
    trims: [{ keywords: ['limited'], size: '225/45R17' }], size: '205/55R16' },
  { make: 'Hyundai', model: 'Sonata', from: 2020, to: 2023,
    trims: [{ keywords: ['limited', 'sel plus'], size: '235/45R18' }], size: '215/55R17' },
  {
    make: 'Tesla', model: 'Model 3', from: 2017, to: 2023,
    trims: [{ keywords: ['performance'], size: '235/35R20' }],
    size: '235/45R18',
  },
  {
    make: 'Tesla', model: 'Model Y', from: 2020, to: 2024,
    trims: [{ keywords: ['performance'], size: '255/35R21' }],
    size: '255/45R19',
  },
  // ——— Minivans ———
  { make: 'Toyota', model: 'Sienna', from: 2021, to: 2024, size: '235/60R18' },
  { make: 'Honda', model: 'Odyssey', from: 2018, to: 2024, size: '235/60R18' },
];

const norm = (s: string) => s.trim().toLowerCase();

/** Keyword present as a whole word — "XLE" must not satisfy an "le" rule. */
function hasKeyword(trim: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(trim);
}

/**
 * The typical factory tire size for this vehicle, or null when the model
 * isn't in the table. A hit is a suggestion to pre-fill, not a guarantee.
 */
export function lookupOemTireSize(vehicle: Vehicle): string | null {
  const make = norm(vehicle.make);
  const model = norm(vehicle.model);
  const trim = norm(vehicle.trim ?? '');
  for (const entry of OEM_FITMENTS) {
    if (norm(entry.make) !== make || norm(entry.model) !== model) continue;
    if (vehicle.year < entry.from || vehicle.year > entry.to) continue;
    for (const rule of entry.trims ?? []) {
      if (rule.keywords.some((k) => hasKeyword(trim, k))) return rule.size;
    }
    return entry.size;
  }
  return null;
}
