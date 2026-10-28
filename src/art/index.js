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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">`
    + `<defs><filter id="st" x="-10%" y="-10%" width="120%" height="125%" color-interpolation-filters="sRGB">`
    + `<feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="discrete" tableValues="0 0 0 1"/></feComponentTransfer>`
    + `<feMorphology in="a" operator="dilate" radius="4" result="o"/>`
    + `<feFlood flood-color="#fff"/><feComposite in2="o" operator="in" result="w"/>`
    + `<feOffset in="o" dy="3.5" result="so"/><feGaussianBlur in="so" stdDeviation="1.6" result="sb"/>`
    + `<feFlood flood-color="${INK}" flood-opacity=".45"/><feComposite in2="sb" operator="in" result="s"/>`
    + `<feMerge><feMergeNode in="s"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge>`
    + `</filter></defs><g filter="url(#st)">${body}</g></svg>`;
}

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

