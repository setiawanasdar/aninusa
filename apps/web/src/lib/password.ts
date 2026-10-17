import bcrypt from "bcryptjs";

export const PASSWORD_COST = 12;

/**
 * Password hashing is isolated from session code so it can be unit tested and
 * reused by CLI tools without pulling in Next.js request APIs.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= 10 &&
    password.length <= 128 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
