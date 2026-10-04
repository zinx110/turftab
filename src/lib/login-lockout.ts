import { and, count, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 50; // caps attackers who rotate IPs

export const LOCKOUT_MINUTES = WINDOW_MS / 60000;

export async function isLockedOut(ip: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byIp, all] = await Promise.all([
    db()
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.attemptedAt, since))),
    db()
      .select({ n: count() })
      .from(loginAttempts)
      .where(gt(loginAttempts.attemptedAt, since)),
  ]);
  return byIp[0].n >= MAX_PER_IP || all[0].n >= MAX_GLOBAL;
}

export async function recordFailure(ip: string) {
  await db().insert(loginAttempts).values({ ip });
  // housekeeping: drop anything older than a day
  await db()
    .delete(loginAttempts)
    .where(lt(loginAttempts.attemptedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
