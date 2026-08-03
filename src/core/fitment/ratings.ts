/**
 * Load index and speed rating lookups.
 *
 * Both are standardised tables, not formulas. Ratings below OE are a safety
 * issue rather than a styling preference, which is why they surface as
 * critical warnings in compare.ts.
 */

/** Load index → maximum load per tire, in kilograms. */
const LOAD_INDEX_KG: Record<number, number> = {
  60: 250, 61: 257, 62: 265, 63: 272, 64: 280, 65: 290, 66: 300, 67: 307,
  68: 315, 69: 325, 70: 335, 71: 345, 72: 355, 73: 365, 74: 375, 75: 387,
  76: 400, 77: 412, 78: 425, 79: 437, 80: 450, 81: 462, 82: 475, 83: 487,
  84: 500, 85: 515, 86: 530, 87: 545, 88: 560, 89: 580, 90: 600, 91: 615,
  92: 630, 93: 650, 94: 670, 95: 690, 96: 710, 97: 730, 98: 750, 99: 775,
  100: 800, 101: 825, 102: 850, 103: 875, 104: 900, 105: 925, 106: 950,
  107: 975, 108: 1000, 109: 1030, 110: 1060, 111: 1090, 112: 1120, 113: 1150,
  114: 1180, 115: 1215, 116: 1250, 117: 1285, 118: 1320, 119: 1360, 120: 1400,
  121: 1450, 122: 1500, 123: 1550, 124: 1600, 125: 1650, 126: 1700, 127: 1750,
  128: 1800, 129: 1850, 130: 1900,
};

/** Speed rating letter → maximum sustained speed, in km/h. */
const SPEED_RATING_KPH: Record<string, number> = {
  L: 120, M: 130, N: 140, P: 150, Q: 160, R: 170, S: 180, T: 190,
  U: 200, H: 210, V: 240, W: 270, Y: 300,
  // A ZR marking guarantees only "above 240"; treat it as exactly 240 so a
  // comparison never claims more capability than the marking promises.
  ZR: 240,
};

export function loadIndexToKg(index: number | null): number | null {
  if (index == null) return null;
  return LOAD_INDEX_KG[index] ?? null;
}

export function speedRatingToKph(rating: string | null): number | null {
  if (!rating) return null;
  return SPEED_RATING_KPH[rating.toUpperCase()] ?? null;
}

export function isKnownSpeedRating(rating: string): boolean {
  return rating.toUpperCase() in SPEED_RATING_KPH;
}
