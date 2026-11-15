import { COURSES, courseOf } from './blastrange-courses.js';

export const PROGRESS_KEY = 'flintworks-blast-courses-v1';
const LEGACY_KEY = 'flintworks-blast-range-v1';
const score = n => ['number', 'string'].includes(typeof n) && Number.isFinite(Number(n))
  ? Math.max(0, Math.min(1000000, Math.floor(Number(n)))) : 0;
const deviceStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
export function readProgress(storage = deviceStorage()) {
  let data, legacy = 0;
  try { data = JSON.parse(storage.getItem(PROGRESS_KEY) || 'null'); } catch {}
  try { legacy = score(storage.getItem(LEGACY_KEY)); } catch {}
  const scores = Object.fromEntries(COURSES.map(c => [c.id, score(data?.scores?.[c.id])]));
  scores.yard = Math.max(scores.yard, legacy);
  return { selected: courseOf(data?.selected).id, scores };
}
export function saveProgress(progress, storage = deviceStorage()) {
  // Another tab may have finished a better attempt while this one was open.
  const stored = readProgress(storage);
  for (const c of COURSES) progress.scores[c.id] = Math.max(score(progress.scores[c.id]), stored.scores[c.id]);
  progress.selected = courseOf(progress.selected).id;
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch {}
}
export function recordResult(progress, id, value, storage = deviceStorage()) {
  id = courseOf(id).id;
  progress.scores[id] = Math.max(score(progress.scores[id]), score(value));
  saveProgress(progress, storage);
}
