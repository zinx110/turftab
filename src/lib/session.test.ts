import { describe, expect, it } from "vitest";
import { safeEqual, signSession, verifySession } from "./session";

const SECRET = "a".repeat(32);

describe("session", () => {
  it("accepts a token signed with the same secret", async () => {
    expect(await verifySession(await signSession(SECRET), SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret (secret rotation logs everyone out)", async () => {
    const token = await signSession(SECRET);
    expect(await verifySession(token, "b".repeat(32))).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(SECRET);
    const [h, p, s] = token.split(".");
    const forged = `${h}.${Buffer.from('{"role":"admin","x":1}').toString("base64url")}.${s}`;
    expect(p).not.toBe(forged.split(".")[1]);
    expect(await verifySession(forged, SECRET)).toBe(false);
  });

  it("rejects garbage and empty tokens", async () => {
    expect(await verifySession("", SECRET)).toBe(false);
    expect(await verifySession("not.a.jwt", SECRET)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("matches only the exact password", () => {
    expect(safeEqual("correct horse battery", "correct horse battery")).toBe(true);
    expect(safeEqual("correct horse batter", "correct horse battery")).toBe(false);
    expect(safeEqual("", "correct horse battery")).toBe(false);
  });
});
