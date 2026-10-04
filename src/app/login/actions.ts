"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, endSession, startSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { isLockedOut, LOCKOUT_MINUTES, recordFailure } from "@/lib/login-lockout";
import { safeEqual } from "@/lib/session";

export type LoginState = { error?: string };

const input = z.object({ password: z.string().min(1).max(200) });

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = input.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: "Enter the password." };

  const ip = await clientIp();
  if (await isLockedOut(ip)) {
    return { error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }
  if (!safeEqual(parsed.data.password, env().ADMIN_PASSWORD)) {
    await recordFailure(ip);
    return { error: "Wrong password." };
  }

  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
