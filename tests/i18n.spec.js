// Every text a player sees has an English version: the German literals handed to tr(), toast()
// and announce(), the setting tiles (settings.js item) and the names of the own keys (keys.js)
// are looked up in the translation tables (i18n.js, i18n2.js): npm test
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// German texts written straight into the source, with where they stand
function literals() {
  const files = [];
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      // (translations themselves, and the dev-only editor, draft and test hooks)
      else if (p.endsWith('.js') && !/i18n|pseudo|debug|editor|draft/.test(p)) files.push(p);
    }
  })('src');
  const q = `(['"])((?:\\\\.|(?!\\X).)*)\\X`;
  const one = n => q.replace(/X/g, String(n));
  const pats = [
    // tr('…'), toast('…'), announce('…')
    new RegExp(`\\b(?:tr|toast|announce)\\(\\s*${one(1)}`, 'g'),
    // item(section, 'title', 'explanation', …) in settings.js
    new RegExp(`\\bitem\\(\\s*\\w+,\\s*${one(1)},\\s*${one(3)}`, 'g'),
  ];
  const out = new Map();
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    for (const re of pats) {
      let m;
      while ((m = re.exec(s)))
        for (const k of [m[2], m[4]]) {
          if (k === undefined) continue;
          const t = k.replace(/\\(['"])/g, '$1');
          // (ids and symbols are no texts)
          if (/[A-Za-zÄÖÜäöüß]{2}/.test(t) && /[A-ZÄÖÜ ]/.test(t)) out.set(t, f);
        }
    }
  }
  return out;
}

test('every German text in the source has an English translation', async ({ page }) => {
  const texts = literals();
  expect(texts.size).toBeGreaterThan(300);
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  const missing = await page.evaluate(async list => {
    const { hasEnglish } = await import('/src/i18n.js'),
      { ACTIONS } = await import('/src/keys.js');
    const out = list.filter(([t]) => !hasEnglish(t)).map(([t, f]) => `${f}: ${t}`);
    for (const [, , name] of ACTIONS) if (!hasEnglish(name)) out.push(`src/keys.js: ${name}`);
    return out;
  }, [...texts]);
  expect(missing).toEqual([]);
});
