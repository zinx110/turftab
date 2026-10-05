"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getGameDue, getPlayerBalance } from "@/lib/data";
import { todayISO } from "@/lib/dates";

const amountSchema = z.number().int().min(1).max(10_000_000);

// "Mark paid": with no amount it records the player's full outstanding
// balance; with an amount it records a partial (or advance) payment.
export async function markPaid(playerId: number, amount?: number) {
  await requireAdmin();
  let pay = amount;
  if (pay === undefined) {
    pay = await getPlayerBalance(playerId);
    if (pay <= 0) return { error: "Nothing owed." };
  } else if (!amountSchema.safeParse(pay).success) {
    return { error: "Enter a whole amount above 0." };
  }
  await db().insert(payments).values({ playerId, amount: pay, paidOn: todayISO() });
  revalidatePath("/", "layout");
  return {};
}

// Same, but for one game: with no amount it settles what this payer still
// owes for that game; with an amount it records a partial payment against it.
export async function markGamePaid(gameId: number, playerId: number, amount?: number) {
  await requireAdmin();
  let pay = amount;
  if (pay === undefined) {
    pay = await getGameDue(playerId, gameId);
    if (pay <= 0) return { error: "Nothing owed for this game." };
  } else if (!amountSchema.safeParse(pay).success) {
    return { error: "Enter a whole amount above 0." };
  } else if ((await getGameDue(playerId, gameId)) <= 0) {
    return { error: "Nothing owed for this game." };
  }
  await db().insert(payments).values({ playerId, gameId, amount: pay, paidOn: todayISO() });
  revalidatePath("/", "layout");
  return {};
}

export async function deletePayment(id: number) {
  await requireAdmin();
  await db().delete(payments).where(eq(payments.id, id));
  revalidatePath("/", "layout");
}
