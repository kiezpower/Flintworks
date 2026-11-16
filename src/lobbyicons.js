// Smooth scalable pictograms; no bitmap enlargement in the menu.
const shapes = {
  crystal: '<path d="M5 10 11 3h14l6 7-13 22Z" fill="#6ed7f1"/><path d="m11 3 7 29 7-29M5 10h26L18 32" fill="none" stroke="#daf8ff"/>',
  crew: '<circle cx="13" cy="11" r="6" fill="#ffd99a"/><path d="M3 30v-5a10 10 0 0 1 20 0v5Z" fill="#69b4c1"/><circle cx="25" cy="13" r="5" fill="#f2be7c"/><path d="M23 21q10-2 10 9h-7Z" fill="#8fd3c7"/>',
  castle: '<path d="M4 9h5V4h5v5h8V4h5v5h5v22H4Z" fill="#d4ccac"/><path d="M14 31v-9a4 4 0 0 1 8 0v9" fill="#6b4d36"/><path d="M7 14h3m16 0h3M16 13h4" stroke="#8d8877" stroke-width="3"/>',
  dig: '<path d="m8 29 18-22" stroke="#c68b4c" stroke-width="4"/><path d="M8 29q-7 3-5-5l5-6 7 6Z" fill="#d3e3e5"/><path d="m22 5 5-3 4 4-3 5Z" fill="none" stroke="#ebc27e" stroke-width="2"/>',
  gear: '<path d="m15 2 6 0 1 5 5 2 4-2 3 6-4 3v5l4 3-3 6-5-2-4 2-1 5h-6l-1-5-5-2-4 2-3-6 4-3v-5l-4-3 3-6 5 2 4-2Z" fill="#d6c296"/><circle cx="18" cy="18" r="7" fill="#65523b"/><circle cx="18" cy="18" r="4" fill="#b7d1d0"/>',
  throw: '<circle cx="16" cy="22" r="10" fill="#4a5260"/><path d="M17 12q-2-8 8-7" fill="none" stroke="#d9bc80" stroke-width="3"/><path d="m26 0 2 5 6 1-5 3 1 6-5-4-5 2 2-6-3-4Z" fill="#ffd56c"/>',
};
function lobbyIcon(kind) {
  const path = shapes[kind];
  return path ? `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' + path + '</svg>')}` : null;
}
export { lobbyIcon };
