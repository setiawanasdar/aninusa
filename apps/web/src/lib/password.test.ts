import { describe, expect, it } from "vitest";
import { hashPassword, passwordMeetsPolicy, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a bcrypt hash that never contains the plaintext", async () => {
    const password = "Sup3rSecretPass!";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct-horse-9");
    expect(await verifyPassword("correct-horse-9", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-9");
    expect(await verifyPassword("wrong-horse-9", hash)).toBe(false);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("salts hashes so identical passwords differ", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-1"), hashPassword("same-password-1")]);
    expect(a).not.toBe(b);
  });
});

describe("password policy", () => {
  it("requires length and mixed letters/numbers", () => {
    expect(passwordMeetsPolicy("short1")).toBe(false);
    expect(passwordMeetsPolicy("alllettersonly")).toBe(false);
    expect(passwordMeetsPolicy("12345678901")).toBe(false);
    expect(passwordMeetsPolicy("validpass123")).toBe(true);
  });
});
