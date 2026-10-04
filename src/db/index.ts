import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

let cached: ReturnType<typeof create> | undefined;

function create() {
  return drizzle(env().DATABASE_URL, { schema });
}

// Lazy so importing this file never needs DATABASE_URL at build time.
export function db() {
  return (cached ??= create());
}
