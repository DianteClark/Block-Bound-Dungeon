/* Boot: settings, art preloading, then the title screen (or the saved run). */
import { app, go, applySettings } from './ui/app.js';
import { preloadTiles } from './ui/combat.js';
import './ui/screens.js';
import { toast } from './ui/dom.js';

/* Stop iOS rubber-band scrolling outside scrollable areas. */
document.addEventListener('touchmove', e => {
  if (!e.target.closest('.scroll, .mapwrap, #sheet .panel')) e.preventDefault();
}, { passive: false });

window.addEventListener('error', e => {
  console.error(e.error || e.message);
  toast('<b>Something went wrong.</b> Your run is saved; reopen the app if anything looks stuck.', null, 4000);
});

applySettings();
preloadTiles().catch(() => {}).finally(() => go('title'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
