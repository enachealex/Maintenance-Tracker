import { Platform } from 'react-native';

/**
 * Web-only: make the app fill the real usable screen space.
 *  - 100dvh tracks the *dynamic* viewport, so the layout resizes exactly to
 *    the usable area as browser UI (URL bar) shows/hides.
 *  - viewport-fit=cover lets the page extend edge-to-edge on gesture-nav
 *    devices, where env(safe-area-inset-*) then keeps controls clear of the
 *    system bars (the picker Close button already uses it).
 *  - overscroll-behavior stops the rubber-band glow from revealing the
 *    browser's white background behind the app.
 */
export function setupWebViewport(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const meta = document.querySelector('meta[name="viewport"]');
  const content = meta?.getAttribute('content') ?? '';
  if (meta && !content.includes('viewport-fit')) {
    meta.setAttribute('content', `${content}, viewport-fit=cover`);
  }

  const style = document.createElement('style');
  style.textContent =
    'html,body{height:100dvh !important;overscroll-behavior-y:none;background:#0F1420}' +
    '#root{height:100dvh !important;min-height:100dvh !important}';
  document.head.appendChild(style);
}
