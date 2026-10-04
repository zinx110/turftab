"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { newToken, writeSetting } from "@/lib/data";

const bkash = z.string().trim().max(30);

export async function saveBkash(input: string) {
  await requireAdmin();
  const parsed = bkash.safeParse(input);
  if (!parsed.success) return { error: "That number looks too long." };
  await writeSetting("bkash_number", parsed.data);
  revalidatePath("/", "layout");
  return {};
}

export async function regenerateGroupToken() {
  await requireAdmin();
  await writeSetting("group_token", newToken());
  revalidatePath("/", "layout");
}
