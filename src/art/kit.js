/* Sticker art kit. Every illustration is SVG on a 100x100 canvas built from a few rules:
 *  - one ink colour and outline weight,
 *  - one light source (top-left): each filled shape gets an automatic shade crescent on its
 *    lower-right and an optional gloss highlight, both clipped to the shape,
 *  - one palette of colour ramps (base / shade / light).
 * The sticker wrapper (see index.js) adds the white die-cut border and drop shadow. */

export const INK = '#21172b';
export const LINE = 4.5;

export const PAL = {
  red:     ['#f0555b', '#b5303d', '#ffa1a1'],
  ember:   ['#ff7a3d', '#c4461a', '#ffc199'],
  gold:    ['#ffc93c', '#cf8f12', '#fff0b0'],
  green:   ['#4fcf7a', '#228a4d', '#adf5c4'],
  moss:    ['#8cbf4a', '#557d24', '#d4f0a0'],
  teal:    ['#3cc9b9', '#1b8580', '#a6f3ea'],
  blue:    ['#4d9bff', '#2459c7', '#b4d6ff'],
  ice:     ['#9fe3ff', '#4f9ccc', '#effbff'],
  navy:    ['#3e4a8a', '#252c5a', '#8a96d6'],
  purple:  ['#9b5cf0', '#6131b0', '#d7bcff'],
  violet:  ['#c77dff', '#8a42c9', '#f0d9ff'],
  pink:    ['#ff7fb4', '#c94a80', '#ffd0e4'],
  bone:    ['#f1e6cd', '#c3b08a', '#ffffff'],
  stone:   ['#8c8698', '#5b5568', '#c9c3d4'],
  steel:   ['#c9d3e0', '#8794a8', '#f4f8fc'],
  iron:    ['#6f7a8c', '#454e5e', '#a9b3c4'],
  wood:    ['#b77a45', '#7d4c25', '#e3b07e'],
  leather: ['#8a5a3a', '#5c3a22', '#bf8a63'],
  skin:    ['#f6c39a', '#d18f63', '#ffe3cc'],
  dark:    ['#3a2f48', '#231b2e', '#6d5e80'],
  shadow:  ['#2a2238', '#17111f', '#4e4263'],
  white:   ['#f6f3fb', '#cfc6dc', '#ffffff'],
  slime:   ['#7be36c', '#3c9e3a', '#c9ffb8'],
  flesh:   ['#e8828a', '#a84b57', '#ffc3c8'],
  rust:    ['#c9643a', '#8c3a1d', '#f0a27e'],
};

let uid = 0;
export const resetIds = () => { uid = 0; };
const nid = () => 'k' + (uid++).toString(36);

/* ---------- path builders (so circles and rects can be shaded like any shape) ---------- */
export const circleD = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const ellD = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
export function rectD(x, y, w, h, r = 0) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
export function starD(cx, cy, R, r2, n = 5, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r2 : R;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
  }
  return d + 'Z';
}

/* ---------- shaded shapes ---------- */

/**
 * A filled, outlined shape with automatic lighting.
 * ramp: a PAL entry or [base, shade, light]; opts: { gloss: 0..1, depth: shade offset, line: outline width }
 */
export function shape(d, ramp, opts = {}) {
  const [base, shade, light] = typeof ramp === 'string' ? PAL[ramp] : ramp;
  const depth = opts.depth == null ? 5 : opts.depth;      // width of the shade crescent (lower right)
  const rim = opts.rim == null ? 3 : opts.rim;            // width of the light rim (upper left)
  const line = opts.line == null ? LINE : opts.line;
  const a = nid(), b = nid();
  // a: the shape; b: the shape nudged up-left. Inside a, shade shows wherever b doesn't reach.
  let s = `<clipPath id="${a}"><path d="${d}"/></clipPath>`
    + `<clipPath id="${b}"><path d="${d}" transform="translate(${-depth} ${-depth})"/></clipPath>`
    + `<g clip-path="url(#${a})"><path d="${d}" fill="${shade}"/><g clip-path="url(#${b})">`
    + `<path d="${d}" fill="${base}" transform="translate(${-depth} ${-depth})"/>`;
  if (rim) {
    s += `<path d="${d}" fill="${light}" opacity="${opts.gloss == null ? 0.75 : opts.gloss}" transform="translate(${-depth} ${-depth})"/>`
      + `<path d="${d}" fill="${base}" transform="translate(${rim} ${rim})"/>`;
  }
  s += `</g></g>`;
  if (line) s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${line}" stroke-linejoin="round"/>`;
  return s;
}

/** Flat fill, no shading (for small details). */
export const flat = (d, fill, line = 0) =>
  `<path d="${d}" fill="${fill}"${line ? ` stroke="${INK}" stroke-width="${line}" stroke-linejoin="round"` : ''}/>`;

/** A soft gloss streak for the top-left of round things. */
export const gloss = (x, y, rx, ry, rot = -35, op = 0.6) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;

/** An ink stroke (lines, mouths, cracks). */
export const ink = (d, w = 3.5) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A coloured stroke with an ink outline (straps, tails, wisps). */
export const rope = (d, col, w) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + LINE * 2 - 1}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* ---------- faces: one eye style for every creature ---------- */
export function eye(x, y, s = 7, look = [0.15, 0.2], col = '#fff') {
  return `<ellipse cx="${x}" cy="${y}" rx="${s * 0.82}" ry="${s}" fill="${col}" stroke="${INK}" stroke-width="${LINE * 0.75}"/>`
    + `<circle cx="${x + s * look[0]}" cy="${y + s * look[1]}" r="${s * 0.5}" fill="${INK}"/>`
    + `<circle cx="${x + s * look[0] - s * 0.22}" cy="${y + s * look[1] - s * 0.22}" r="${s * 0.18}" fill="#fff"/>`;
}
/** Glowing eye (undead, demons). */
export function glowEye(x, y, s, col) {
  return `<circle cx="${x}" cy="${y}" r="${s * 2}" fill="${col}" opacity=".22"/>`
    + `<circle cx="${x}" cy="${y}" r="${s}" fill="${col}" stroke="${INK}" stroke-width="${LINE * 0.6}"/>`
    + `<circle cx="${x - s * 0.3}" cy="${y - s * 0.3}" r="${s * 0.35}" fill="#fff"/>`;
}
export const brow = (x1, y1, x2, y2, w = 5) => ink(`M${x1} ${y1}L${x2} ${y2}`, w);
export const cheek = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff7f9a" opacity=".45"/>`;

/* ---------- composition ---------- */
export const mirrorX = s => `<g transform="translate(100 0) scale(-1 1)">${s}</g>`;
export const both = s => s + mirrorX(s);
export const scaleAt = (s, k, x, y) => `<g transform="translate(${x} ${y}) scale(${k})">${s}</g>`;
export const rotAt = (s, deg, x = 50, y = 50) => `<g transform="rotate(${deg} ${x} ${y})">${s}</g>`;
