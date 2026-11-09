// Packing a level for a link (?lvl=…): JSON → deflate-raw → base64url, and back. Kept free of the
// game's modules, so the level editor (editor.html) can use it on its own; the check of what
// comes back is in share.js.
const MAX_JSON = 400_000; // characters of the unpacked level
const MAX_LINK = 60_000; // characters of the packed level in the address

class BadLink extends Error {
  constructor(what) {
    super('bad level: ' + what);
    this.badLevel = true;
  }
}
const b64url = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = str => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
};
async function packLevel(L) {
  const json = new TextEncoder().encode(JSON.stringify(L));
  const out = new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  return b64url(new Uint8Array(await out.arrayBuffer()));
}
// the JSON of a link, not checked yet; at most MAX_JSON characters (a small link must not
// unfold into something huge)
async function unpackJson(code) {
  if (typeof code !== 'string' || !code || code.length > MAX_LINK || !/^[A-Za-z0-9_-]+$/.test(code)) throw new BadLink('link');
  let bytes;
  try {
    bytes = unb64url(code);
  } catch {
    throw new BadLink('link');
  }
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),
    parts = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > MAX_JSON) {
        reader.cancel().catch(() => {});
        throw new BadLink('too big');
      }
      parts.push(value);
    }
  } catch (e) {
    throw e.badLevel ? e : new BadLink('packing');
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    throw new BadLink('json');
  }
}

export { BadLink, MAX_LINK, packLevel, unpackJson };
