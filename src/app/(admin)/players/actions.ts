"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { newToken } from "@/lib/data";

const profile = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  phone: z.string().trim().max(30).optional(),
});

export async function createPlayer(input: { name: string; phone?: string }) {
  await requireAdmin();
  const parsed = profile.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [row] = await db()
    .insert(players)
    .values({ name: parsed.data.name, phone: parsed.data.phone || null })
    .returning({ id: players.id, name: players.name });
  revalidatePath("/", "layout");
  return { player: row };
}

export async function updatePlayer(id: number, input: { name: string; phone?: string }) {
  await requireAdmin();
  const parsed = profile.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db()
    .update(players)
    .set({ name: parsed.data.name, phone: parsed.data.phone || null })
    .where(eq(players.id, id));
  revalidatePath("/", "layout");
  return {};
}

export async function setPlayerActive(id: number, active: boolean) {
  await requireAdmin();
  await db().update(players).set({ active }).where(eq(players.id, id));
  revalidatePath("/", "layout");
}

export async function regeneratePlayerToken(id: number) {
  await requireAdmin();
  await db().update(players).set({ token: newToken() }).where(eq(players.id, id));
  revalidatePath("/", "layout");
}
