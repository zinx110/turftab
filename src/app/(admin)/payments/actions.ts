"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getPlayerBalance } from "@/lib/data";
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

export async function deletePayment(id: number) {
  await requireAdmin();
  await db().delete(payments).where(eq(payments.id, id));
  revalidatePath("/", "layout");
}
