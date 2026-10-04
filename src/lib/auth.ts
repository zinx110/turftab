import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "./session";

export async function isAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!token && (await verifySession(token, env().SESSION_SECRET));
}

// Call this at the top of every admin page and every server action / route
// handler that reads or writes data. Layouts and middleware are not enough.
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/login");
}

export async function startSession() {
  (await cookies()).set(SESSION_COOKIE, await signSession(env().SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
