import { randomInt } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 10;

// No 0/O, 1/l/I: a temporary password gets read out and retyped.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Returns a message for the person if the password is not acceptable, otherwise null. */
export function passwordProblem(password: string, username: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 100) return "Use 100 characters or fewer.";
  if (/^(.)\1+$/.test(password)) return "Use more than one repeated character.";
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "The password cannot contain the username.";
  return null;
}
