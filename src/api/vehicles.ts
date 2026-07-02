/**
 * Vehicle data sources:
 *  - NHTSA vPIC (vpic.nhtsa.dot.gov): US-government database, always current.
 *    Used for makes and models by year.
 *  - EPA fueleconomy.gov: engine/transmission variants per model (1984+),
 *    used for the sub-model & engine step. Coverage gaps fall back to
 *    manual entry in the UI.
 */

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const EPA = 'https://www.fueleconomy.gov/ws/rest/vehicle/menu';

export interface TrimInfo {
  trim: string;
  engine: string;
}

export interface MakeInfo {
  id: number;
  name: string;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function getYears(): number[] {
  const current = new Date().getFullYear() + 1; // include next model year
  const years: number[] = [];
  for (let y = current; y >= 1981; y--) years.push(y);
  return years;
}

/** Makes that sold passenger vehicles, from NHTSA vPIC. */
export async function getMakes(year: number): Promise<MakeInfo[]> {
  const types = ['passenger car', 'multipurpose passenger vehicle (mpv)', 'truck'];
  const results = await Promise.allSettled(
    types.map((t) =>
      fetchJson(`${VPIC}/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`),
    ),
  );
  const byId = new Map<number, MakeInfo>();
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.Results)) {
      for (const row of r.value.Results) {
        const id = Number(row?.MakeId);
        if (id && row?.MakeName && !byId.has(id)) {
          byId.set(id, { id, name: titleCase(String(row.MakeName)) });
        }
      }
    }
  }
  if (byId.size === 0) throw new Error('Could not load makes');
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Models by make ID — vPIC's name-based endpoint does substring matching
 * ("Ford" also returns Bradford Built models), so the exact ID is required.
 */
export async function getModels(year: number, makeId: number): Promise<string[]> {
  const data = await fetchJson(
    `${VPIC}/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}?format=json`,
  );
  const names = new Set<string>();
  if (Array.isArray(data?.Results)) {
    for (const row of data.Results) {
      if (row?.Model_Name) names.add(String(row.Model_Name).trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Engine/transmission variants from EPA fueleconomy.gov.
 * EPA model names differ from NHTSA's ("F150 Pickup 4WD" vs "F-150"),
 * so match models fuzzily and merge the variants of every match.
 * Returns [] when unknown; the caller falls back to manual entry.
 */
export async function getTrims(
  year: number,
  make: string,
  model: string,
): Promise<TrimInfo[]> {
  try {
    const menu = await fetchJson(
      `${EPA}/model?year=${year}&make=${encodeURIComponent(make)}`,
    );
    const epaModels: string[] = asMenuItems(menu).map((m) => String(m.value));
    const target = normalize(model);
    const matches = epaModels.filter((m) => {
      const n = normalize(m);
      return n.includes(target) || target.includes(n);
    });

    const out: TrimInfo[] = [];
    const seen = new Set<string>();
    for (const epaModel of matches) {
      const options = await fetchJson(
        `${EPA}/options?year=${year}&make=${encodeURIComponent(make)}` +
          `&model=${encodeURIComponent(epaModel)}`,
      );
      for (const opt of asMenuItems(options)) {
        const parsed = parseEpaOption(String(opt.text), epaModel, model);
        const key = `${parsed.trim}|${parsed.engine}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(parsed);
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** EPA menu endpoints return an object for one item, an array for many. */
function asMenuItems(data: any): { text: string; value: string }[] {
  const items = data?.menuItem;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

/** "Auto (S10), 8 cyl, 5.0 L, Turbo" → trim "Auto (S10)", engine "5.0L 8-cyl Turbo" */
function parseEpaOption(text: string, epaModel: string, baseModel: string): TrimInfo {
  const parts = text.split(',').map((p) => p.trim());
  const trans = parts[0] || '';
  const cyl = parts.find((p) => /cyl/i.test(p));
  const liters = parts.find((p) => /\d(\.\d+)?\s*L$/i.test(p));
  const extras = parts.slice(1).filter((p) => p !== cyl && p !== liters);
  const engineBits = [
    liters ? liters.replace(/\s+/g, '') : '',
    cyl ? cyl.replace(/\s*cyl/i, '-cyl') : '',
    ...extras,
  ].filter(Boolean);
  // "Mustang Convertible" with base model "Mustang" → sub-model "Convertible"
  const baseWords = new Set(baseModel.toLowerCase().split(/\s+/));
  const subModel = epaModel
    .split(/\s+/)
    .filter((w) => !baseWords.has(w.toLowerCase()))
    .join(' ');
  return {
    trim: [subModel, trans].filter(Boolean).join(' · '),
    engine: engineBits.join(' ') || 'Unknown engine',
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function titleCase(s: string): string {
  // Keep short all-caps brand names (BMW, GMC, RAM…) as-is.
  if (s.length <= 3) return s;
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bBmw\b/g, 'BMW')
    .replace(/\bGmc\b/g, 'GMC')
    .replace(/\bSrt\b/g, 'SRT')
    .replace(/\bMercedes-benz\b/gi, 'Mercedes-Benz');
}
