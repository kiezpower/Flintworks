// Teams for Versus: every team has its own castle, cash, store, tools and progress. The game
// code works with G.money, G.store, G.base … of "the current team"; useTeam(t) swaps those
// values before the host simulates something of team t. Without teams (single game, Koop)
// everything here does nothing.
import { G } from './state.js';

const KEYS = ['money', 'store', 'tools', 'earned', 'base', 'mineMark', 'goldSold', 'sold', 'chestsFound', 'mis'];
const TEAM_COLS = ['#c8402c', '#2f7fd0'];
G.teams = null;
G.curTeam = 0;
G.myTeam = 0;

const teamOf = e => (e && e.team) || 0;
function useTeam(t) {
  if (!G.teams) return;
  t = t || 0;
  if (t === G.curTeam) return;
  const a = G.teams[G.curTeam];
  for (const k of KEYS) a[k] = G[k];
  const b = G.teams[t];
  for (const k of KEYS) G[k] = b[k];
  G.curTeam = t;
}
const useMine = () => useTeam(G.myTeam);
// write the current team's values back (before reading all teams)
function syncTeams() {
  if (!G.teams) return;
  const a = G.teams[G.curTeam];
  for (const k of KEYS) a[k] = G[k];
}
// team 0 takes the values the world was made with; the others start the same
function setupTeams(bases) {
  G.teams = bases.map((base, t) => (t === 0 ? {} : { ...freshTeam(), base }));
  G.curTeam = 0;
  syncTeams();
}
function freshTeam() {
  return { money: G.money, store: {}, tools: {}, earned: 0, mineMark: null, goldSold: 0, sold: {}, chestsFound: 0, mis: null };
}
function endTeams() {
  useTeam(0);
  G.teams = null;
  G.myTeam = 0;
}

export { TEAM_COLS, endTeams, setupTeams, syncTeams, teamOf, useMine, useTeam };
