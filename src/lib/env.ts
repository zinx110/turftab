import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be 12+ characters"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be 32+ characters"),
});

let cached: z.infer<typeof schema> | undefined;

// Parsed on first use, not at import, so `next build` doesn't need secrets.
export function env() {
  return (cached ??= schema.parse(process.env));
}
