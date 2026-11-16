// A small on-device evaluation, not a claim of measured population retention.
import { ev, events } from './analytics.js';
import { tr } from './i18n.js';
const KEY = 'flintworks-hero-visits';
const calendarDay = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
function recordVisit() {
  try {
    const old = JSON.parse(localStorage.getItem(KEY) || 'null'), day = calendarDay();
    const state = old && Number.isInteger(old.first) && Array.isArray(old.days) ? old : { first: day, days: [] };
    if (!state.days.includes(day)) state.days.push(day);
    if (day === state.first + 1) state.d1 = true;
    if (day === state.first + 7) state.d7 = true;
    state.days = state.days.filter(n => Number.isInteger(n) && n >= state.first && n <= day).slice(-90);
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
function insights() {
  let visit = null; try { visit = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const es = events(), casts = es.filter(e => e.e === 'hero_ability'), useful = es.filter(e => e.e === 'hero_useful');
  const returned = n => !visit || !Array.isArray(visit.days) || calendarDay() - visit.first < n ? null : !!visit['d' + n] || visit.days.includes(visit.first + n);
  return { d1: returned(1), d7: returned(7), casts: casts.reduce((n, e) => n + (e.amount || 1), 0), useful: useful.reduce((n, e) => n + (e.amount || 1), 0),
    roles: new Set(es.filter(e => e.e === 'hero_select' || e.e === 'hero_ability').map(e => e.hero)).size,
    chapters: es.filter(e => e.e === 'hero_chapter').length };
}
function insightsPanel(parent) {
  const s = insights(), box = document.createElement('section'); box.id = 'heroInsights';
  const title = document.createElement('h3'); title.textContent = tr('Spielverlauf auf diesem Gerät'); box.append(title);
  const state = v => tr(v === null ? 'Noch nicht auswertbar' : v ? 'Zurückgekehrt' : 'Nicht zurückgekehrt');
  for (const text of [tr('Rückkehr nach einem Tag') + ': ' + state(s.d1), tr('Rückkehr nach sieben Tagen') + ': ' + state(s.d7),
    tr('Fähigkeiten: {casts} aktiviert, {useful} mit Wirkung', s), tr('Ausprobierte Rollen: {n}', { n: s.roles }),
    tr('Abgeschlossene Kapitel: {n}', { n: s.chapters }), tr('Nur dieses Gerät; Ereignisse umfassen höchstens die letzten 300 Einträge. Keine Aussage über alle Spieler.')]) {
    const p = document.createElement('p'); p.textContent = text; box.append(p);
  }
  parent.append(box);
}
export { recordVisit, insights, insightsPanel };
