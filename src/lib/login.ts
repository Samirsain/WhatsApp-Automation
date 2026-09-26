import { z } from "zod";

/**
 * The sign-in identifier is a username or an email. It is stored in
 * `users.email`, which is just the unique login id.
 */
const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export function parseLogin(raw: unknown): { login: string; password: string } | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  return { login: parsed.data.email.toLowerCase(), password: parsed.data.password };
}
