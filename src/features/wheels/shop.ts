import { parseTireSize } from '../../core/fitment';

/**
 * Outbound retailer links for a tire size — the commerce model under
 * decision 9. No accounts and no server: the link carries the size (and an
 * affiliate tag once one exists), and attribution happens on the retailer's
 * side. We never learn who clicked.
 */

/**
 * Affiliate tag, appended when non-empty. Left blank until a program is set
 * up (open question O12) — links work either way, they just don't attribute.
 */
export const AFFILIATE_TAG = '';

export interface ShopLink {
  retailer: string;
  url: string;
}

/** Retailer size-search links for a metric size; empty when unparseable. */
export function shopLinksFor(sizeText: string): ShopLink[] {
  const size = parseTireSize(sizeText);
  if (!size || size.kind !== 'metric') return [];
  const width = Math.round(size.sectionWidthMm);
  const aspect = Math.round(size.aspectRatio);
  const rim = size.rimDiameterIn;
  const tag = AFFILIATE_TAG ? `&affiliate=${encodeURIComponent(AFFILIATE_TAG)}` : '';
  return [
    {
      retailer: 'Tire Rack',
      url: `https://www.tirerack.com/tires/TireSearchResults.jsp?width=${width}%2F&ratio=${aspect}&diameter=${rim}${tag}`,
    },
    {
      retailer: 'Discount Tire',
      url: `https://www.discounttire.com/buy-tires/size/${width}-${aspect}-${rim}${tag ? `?${tag.slice(1)}` : ''}`,
    },
  ];
}
