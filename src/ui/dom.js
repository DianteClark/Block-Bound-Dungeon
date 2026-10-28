/* Small DOM helpers and screen-level feedback (toasts, floating numbers, banners, sheets). */
import { img } from '../art/index.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const wait = ms => new Promise(r => setTimeout(r, ms));

/** Replace the current screen. Returns the screen root. */
export function mount(html, cls = '') {
  const s = $('#screen');
  s.innerHTML = `<div class="${cls} enter" style="flex:1;min-height:0;display:flex;flex-direction:column">${html}</div>`;
  return s.firstElementChild;
}

/** Delegate clicks inside root: on(root, '[data-x]', el => ...). */
export function on(root, sel, fn, type = 'click') {
  root.addEventListener(type, e => {
    const el = e.target.closest(sel);
    if (el && root.contains(el)) fn(el, e);
  });
}

let toastTimer = 0;
export function toast(html, art, ms = 2600) {
  const t = $('#toast');
  t.innerHTML = (art ? img(art, 34) : '') + `<div>${html}</div>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

export function floatText(target, text, color = '#fff', big = false) {
  if (!target) return;
  const [x, y] = Array.isArray(target) ? target : centerOf(target);
  const d = document.createElement('div');
  d.className = 'float' + (big ? ' big' : '');
  d.style.left = x + (Math.random() * 16 - 8) + 'px';
  d.style.top = y + 'px';
  d.style.color = color;
  d.textContent = text;
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

export function banner(title, sub = '', ms = 1600) {
  const d = document.createElement('div');
  d.className = 'banner';
  d.style.animationDuration = ms + 'ms';
  d.innerHTML = `<h2 class="display">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}`;
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), ms);
}

export function flash(color) {
  if (document.body.classList.contains('reduce-motion')) return;
  const d = document.createElement('div');
  d.className = 'flash';
  d.style.background = color;
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), 360);
}

export function bump(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* ---------- bottom sheet ---------- */
let onClose = null;
export function openSheet(html, { closed } = {}) {
  const s = $('#sheet');
  s.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.hidden = false;
  onClose = closed || null;
  return s.firstElementChild;
}
export function closeSheet() {
  const s = $('#sheet');
  if (s.hidden) return;
  s.hidden = true;
  s.innerHTML = '';
  const fn = onClose; onClose = null;
  if (fn) fn();
}
document.addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
