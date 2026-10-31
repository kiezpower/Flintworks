// Pseudo-localisation for testing layouts (development only, ?lang=pseudo): every text gets
// accents, about a third more length and brackets, so cut-off, overflowing or untranslated
// (bracket-less) texts stand out. Placeholders like {n} stay as they are.
const MAP = {
  a: 'á',
  e: 'é',
  i: 'î',
  o: 'ö',
  u: 'ü',
  A: 'Å',
  E: 'É',
  I: 'Î',
  O: 'Ö',
  U: 'Ü',
  c: 'ç',
  n: 'ñ',
  s: 'š',
  y: 'ý',
};
function pseudo(s) {
  let out = '',
    inPh = false;
  for (const ch of s) {
    if (ch === '{') inPh = true;
    out += inPh ? ch : MAP[ch] || ch;
    if (ch === '}') inPh = false;
  }
  const pad = '·'.repeat(Math.ceil(s.length * 0.35));
  return `[${out}${pad}]`;
}
export { pseudo };
