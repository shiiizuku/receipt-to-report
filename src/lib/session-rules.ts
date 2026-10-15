/**
 * A signed-in session stays valid until the account is disabled or its password changes.
 * `iat` is in whole seconds, so allow one second of slack for the rounding.
 */
export function sessionStillValid(issuedAtSeconds: number | undefined, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return true;
  if (typeof issuedAtSeconds !== "number") return false;
  return issuedAtSeconds * 1000 >= passwordChangedAt.getTime() - 1000;
}
