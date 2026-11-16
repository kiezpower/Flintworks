// Cosmetic selection only: no inventory, projectile or movement changes here.
const THROW_TICKS = 24;
function minerAction(c, frame, aimKind = null, aim = null, reducedMotion = false) {
  if (c.dead || c.tumble || c.ride != null) return null;
  const hook = c.hook || c.hookV;
  if (hook) {
    const age = Math.max(0, frame - (hook.started ?? frame - 24));
    const pulling = ['pull', 'step', 'up', 'over'].includes(hook.ph);
    return { action: 'hook', frame: reducedMotion ? (pulling ? 3 : 2) : pulling ? 3 + (Math.floor(age / 8) % 2) : hook.ph === 'back' ? 5 : age < 8 ? 1 : 2 };
  }
  const age = frame - (c.throwF ?? -1e9);
  if (age >= 0 && age < THROW_TICKS) return { action: 'throw', frame: reducedMotion ? 2 : Math.min(5, 2 + Math.floor(age / 6)) };
  if (aim && !c.climb && !c.hangle) {
    if (aimKind === 'hook') return { action: 'hook', frame: 0 };
    if (aimKind === 'toss' && c.inv?.length && !c.wield) return { action: 'throw', frame: 1 };
  }
  return null;
}
function minerIdentity(c, hero) { return hero || (c.pid != null ? 'anna' : ['bruno', 'mika', 'juna'][Math.abs(c.k ?? c.id ?? 0) % 3]); }
export { minerAction, minerIdentity, THROW_TICKS };
