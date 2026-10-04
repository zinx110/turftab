import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "turftab_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds

const key = (secret: string) => new TextEncoder().encode(secret);

export function signSession(secret: string) {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
    });
    return payload.role === "admin";
  } catch {
    return false; // bad signature, expired, malformed
  }
}

// Constant-time string compare (passwords, share tokens). Hash both sides first so the compared buffers are always the same length.
export function safeEqual(input: string, expected: string) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
