/** Slows password guessing: 5 failures per username in 10 minutes, then a wait. In memory, per server process. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

function recent(username: string, now: number): number[] {
  const list = (fails.get(username) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(username, list);
  return list;
}

export function isLocked(username: string, now = Date.now()): boolean {
  return recent(username.toLowerCase(), now).length >= MAX_FAILS;
}

export function recordFailure(username: string, now = Date.now()) {
  recent(username.toLowerCase(), now).push(now);
}

export function clearFailures(username: string) {
  fails.delete(username.toLowerCase());
}
