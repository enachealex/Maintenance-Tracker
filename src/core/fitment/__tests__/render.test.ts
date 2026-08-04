import { geometryOf } from '../geometry';
import {
  exposedRingPx,
  layoutFor,
  occludesOriginal,
  pixelsPerInch,
  RIM_FLANGE_ALLOWANCE_IN,
  rimScaleFactor,
  scaleCalibration,
} from '../render';
import { parseTireSize } from '../size';

const size = (s: string) => parseTireSize(s)!;

describe('pixelsPerInch', () => {
  it('divides the traced circle by the exact overall diameter', () => {
    // 225/45R17 is 634.3mm ≈ 24.97" overall. A 500px trace ⇒ ~20.02 px/in.
    const fitted = geometryOf(size('225/45R17'));
    expect(pixelsPerInch(500, fitted)).toBeCloseTo(500 / fitted.overallDiameterIn, 6);
    expect(pixelsPerInch(500, fitted)).toBeCloseTo(20.02, 1);
  });

  it('adds the flange allowance when tracing the rim lip instead', () => {
    const fitted = geometryOf(size('225/45R17'));
    const viaLip = pixelsPerInch(400, fitted, 'rim-lip');
    expect(viaLip).toBeCloseTo(400 / (17 + RIM_FLANGE_ALLOWANCE_IN), 6);
  });

  it('would be about 8% out on a 17" wheel if the flange were ignored', () => {
    // This is why the allowance exists — the error is large enough to matter.
    const naive = 400 / 17;
    const corrected = 400 / (17 + RIM_FLANGE_ALLOWANCE_IN);
    expect((naive - corrected) / corrected).toBeGreaterThan(0.07);
    expect((naive - corrected) / corrected).toBeLessThan(0.09);
  });

  it('returns zero rather than Infinity on degenerate input', () => {
    const fitted = geometryOf(size('225/45R17'));
    expect(pixelsPerInch(0, fitted)).toBe(0);
    expect(pixelsPerInch(-10, fitted)).toBe(0);
  });
});

describe('layoutFor', () => {
  it('places radii in the order rim < lip < tire', () => {
    const l = layoutFor(size('225/45R17'), 20, 300, 400);
    expect(l.rimRadiusPx).toBeLessThan(l.rimLipRadiusPx);
    expect(l.rimLipRadiusPx).toBeLessThan(l.tireRadiusPx);
    expect(l.sidewallPx).toBeGreaterThan(0);
  });

  it('computes radii against hand-worked values', () => {
    const l = layoutFor(size('225/45R17'), 20, 0, 0);
    expect(l.rimRadiusPx).toBeCloseTo((17 / 2) * 20, 6);
    // 24.97" overall ⇒ radius 12.485" ⇒ ~249.7px at 20 px/in.
    expect(l.tireRadiusPx).toBeCloseTo(249.7, 0);
  });

  it('keeps the centre it was given', () => {
    const l = layoutFor(size('225/45R17'), 20, 300, 400);
    expect(l.centerX).toBe(300);
    expect(l.centerY).toBe(400);
  });

  it('scales linearly with pixels per inch', () => {
    const a = layoutFor(size('225/45R17'), 10, 0, 0);
    const b = layoutFor(size('225/45R17'), 20, 0, 0);
    expect(b.tireRadiusPx).toBeCloseTo(a.tireRadiusPx * 2, 6);
    expect(b.sidewallPx).toBeCloseTo(a.sidewallPx * 2, 6);
  });

  /**
   * The visual point of the whole feature: going up a wheel size makes the rim
   * bigger and the sidewall thinner while the tire stays about the same size.
   */
  it('grows the rim and thins the sidewall on a plus-one, at near-constant outer size', () => {
    const stock = layoutFor(size('225/45R17'), 20, 0, 0);
    const plusOne = layoutFor(size('225/40R18'), 20, 0, 0);
    expect(plusOne.rimRadiusPx).toBeGreaterThan(stock.rimRadiusPx);
    expect(plusOne.sidewallPx).toBeLessThan(stock.sidewallPx);
    expect(plusOne.tireRadiusPx / stock.tireRadiusPx).toBeCloseTo(1, 1);
  });
});

describe('rimScaleFactor', () => {
  it('is one for an unchanged rim diameter', () => {
    expect(rimScaleFactor(size('225/45R17'), size('245/40R17'))).toBeCloseTo(1, 6);
  });

  it('grows going up a wheel size', () => {
    expect(rimScaleFactor(size('225/45R17'), size('225/40R18'))).toBeCloseTo(18 / 17, 6);
  });

  it('shrinks going down', () => {
    expect(rimScaleFactor(size('225/40R18'), size('225/45R17'))).toBeCloseTo(17 / 18, 6);
  });

  it('does not divide by zero on a degenerate fitted size', () => {
    expect(rimScaleFactor({ ...size('225/45R17'), rimDiameterIn: 0 }, size('225/40R18'))).toBe(1);
  });
});

describe('occlusion', () => {
  it('covers the original when the proposed tire is the same size', () => {
    expect(occludesOriginal(size('225/45R17'), size('225/45R17'))).toBe(true);
    expect(exposedRingPx(size('225/45R17'), size('225/45R17'), 20)).toBeCloseTo(0, 6);
  });

  it('covers the original when the proposed tire is taller', () => {
    expect(occludesOriginal(size('225/45R17'), size('255/45R17'))).toBe(true);
  });

  /**
   * Plus sizing holds overall diameter roughly constant by design, so the
   * common case needs no fill at all — the reason simple occlusion works.
   */
  it('covers the original on a proper plus-one', () => {
    expect(occludesOriginal(size('225/45R17'), size('225/40R18'))).toBe(true);
  });

  it('leaves a ring exposed when the proposed tire is shorter', () => {
    const fitted = size('245/45R17');
    const proposed = size('205/40R17');
    expect(occludesOriginal(fitted, proposed)).toBe(false);
    expect(exposedRingPx(fitted, proposed, 20)).toBeGreaterThan(0);
  });

  it('never reports a negative exposed ring', () => {
    expect(exposedRingPx(size('205/40R17'), size('245/45R17'), 20)).toBe(0);
  });

  it('scales the exposed ring with the render scale', () => {
    const fitted = size('245/45R17');
    const proposed = size('205/40R17');
    expect(exposedRingPx(fitted, proposed, 40)).toBeCloseTo(
      exposedRingPx(fitted, proposed, 20) * 2,
      6,
    );
  });
});

describe('scaleCalibration', () => {
  const calibration = {
    pixelsPerInch: 40,
    centerX: 800,
    centerY: 600,
    imageWidth: 2000,
  };

  it('halves every measurement when the display is half the image width', () => {
    const s = scaleCalibration(calibration, 1000);
    expect(s.pixelsPerInch).toBeCloseTo(20, 6);
    expect(s.centerX).toBeCloseTo(400, 6);
    expect(s.centerY).toBeCloseTo(300, 6);
  });

  it('is a no-op at native width', () => {
    const s = scaleCalibration(calibration, 2000);
    expect(s.pixelsPerInch).toBeCloseTo(40, 6);
    expect(s.centerX).toBeCloseTo(800, 6);
  });

  it('passes through unchanged rather than dividing by zero', () => {
    const s = scaleCalibration({ ...calibration, imageWidth: 0 }, 1000);
    expect(s.pixelsPerInch).toBe(40);
    expect(s.centerX).toBe(800);
  });

  /**
   * Rendering at display scale must match measuring at image scale — otherwise
   * the composite drifts as the view resizes.
   */
  it('keeps the layout consistent between image space and display space', () => {
    const tire = size('225/45R17');
    const atImage = layoutFor(tire, calibration.pixelsPerInch, calibration.centerX, calibration.centerY);
    const s = scaleCalibration(calibration, 1000);
    const atDisplay = layoutFor(tire, s.pixelsPerInch, s.centerX, s.centerY);
    expect(atDisplay.tireRadiusPx).toBeCloseTo(atImage.tireRadiusPx / 2, 6);
    expect(atDisplay.centerX).toBeCloseTo(atImage.centerX / 2, 6);
  });
});
