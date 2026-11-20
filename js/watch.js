// Watchlist: indicator ids the visitor pins. Stored in localStorage only (never sent anywhere); every call tolerates blocked storage.
const KEY = 'mt-watch';
let mem = null;
export function getWatch() {
  if (mem) return mem;
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); mem = Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { mem = []; }
  return mem;
}
export const isWatched = id => getWatch().includes(id);
export function toggleWatch(id) {
  const w = getWatch(), i = w.indexOf(id);
  if (i >= 0) w.splice(i, 1); else w.push(id);
  try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { /* storage blocked: the list still works for this visit */ }
  document.dispatchEvent(new CustomEvent('watchchange', { detail: { id, on: i < 0 } }));
  return i < 0;
}
