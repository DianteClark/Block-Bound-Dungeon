/* Art registry: name -> SVG. Sprites render once to cached data URLs. */
import { INK, resetIds } from './kit.js';
import { HERO_ART } from './heroes.js';
import { MONSTER_ART } from './monsters.js';
import { ITEM_ART } from './items.js';
import { ICON_ART } from './icons.js';

export const ART = { ...HERO_ART, ...MONSTER_ART, ...ITEM_ART, ...ICON_ART };

/** Full sticker SVG: the drawing plus a white die-cut border and a soft drop shadow. */
export function svg(name, { sticker = true } = {}) {
  const fn = ART[name];
  if (!fn) throw new Error(`missing art: ${name}`);
  resetIds();
  const body = fn();
  if (!sticker) return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">${body}</svg>`;
  // The die-cut border and drop shadow are copies of the drawing with every fill and stroke
  // turned white (or ink) and every stroke thickened. Pure vectors: no filters, so they stay
  // sharp at any size on every device.
  const css = `<style>.w *,.d *{stroke-width:${BORDER}px;stroke-linejoin:round;stroke-linecap:round;opacity:1}`
    + `.w *{fill:#fff;stroke:#fff}.d *{fill:${INK};stroke:${INK}}.w .fx,.d .fx{display:none}</style>`;
  // The border and shadow only need each shape's outline, so the shading layers (clip paths and
  // the groups they clip) are dropped from those two copies: a third of the work to draw.
  const sil = body.replace(/<clipPath id="\w+"><path[^>]*\/><\/clipPath>/g, '')
    .replace(/<g clip-path="url\(#\w+\)">(?:(?!<\/g><\/g>).)*<\/g><\/g>/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="116" height="116" viewBox="-8 -8 116 116">${css}`
    + `<g class="d" opacity=".4" transform="translate(0 3.5)">${sil}</g><g class="w">${sil}</g>${body}</svg>`;
}

const BORDER = 13;
const cache = new Map();
export function artURL(name, opts) {
  const key = name + (opts && opts.sticker === false ? ':flat' : '');
  let u = cache.get(key);
  if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(name, opts)); cache.set(key, u); }
  return u;
}

/** <img> markup for a sprite. */
export function img(name, size, cls = '') {
  return `<img class="art ${cls}" src="${artURL(name)}" width="${size}" height="${size}" alt="" draggable="false">`;
}

/** Load a sprite as an Image for canvas drawing. */
export function loadImage(name, opts) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = artURL(name, opts);
  });
}

