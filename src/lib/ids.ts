import { z } from "zod";

const id = z.number().int().positive().max(2_147_483_647);

// Server actions can be called with arbitrary JSON, so check ids before they
// reach a query (a NaN or fractional id would otherwise be a database error).
export const validIds = (...values: unknown[]) => values.every((v) => id.safeParse(v).success);

export const INVALID = { error: "Invalid request." } as const;
