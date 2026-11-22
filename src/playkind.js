// Match the actual start paths: campaign is solo; the package loader creates an
// opposing team only when a second castle exists. Assault rules need that team.
export const PLAY_KINDS = {
  solo: { name: 'Alleine', players: '1 Spieler', desc: 'Dein Abenteuer, dein Tempo' },
  coop: { name: 'Zusammen', players: '2–4 Spieler', desc: 'Eine Burg, ein gemeinsames Ziel' },
  versus: { name: 'Gegeneinander', players: '2–4 Spieler', desc: 'Zwei Teams, zwei Burgen – wer gewinnt?' },
};
export function supportsKind(M, kind) {
  if (!M || !PLAY_KINDS[kind]) return false;
  if (M.campaign || M.daily) return kind === 'solo';
  if (M.endless) return kind !== 'versus';
  if (M.pkg?.rules?.assault) return kind === 'versus';
  if (kind === 'versus' && M.pkg) return M.pkg.objects.some(o => o.t === 'base' && o.team === 1);
  return true;
}
