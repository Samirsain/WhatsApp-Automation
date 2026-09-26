import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * npm run user:add -- staff@example.com "Staff Name"
 * PASSWORD=... npm run user:add -- 3%club "3% Club"
 * Creates (or resets) a login. Without PASSWORD a one-time password is printed.
 * The login may be a username or an email; it is stored lower-case, as sign-in reads it.
 */
async function main() {
  const [rawLogin, ...nameParts] = process.argv.slice(2);
  if (!rawLogin?.trim()) throw new Error('Usage: [PASSWORD=...] npm run user:add -- username-or-email "Display Name"');
  const email = rawLogin.trim().toLowerCase();
  const displayName = nameParts.join(" ") || email;
  const password = process.env.PASSWORD || randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.user.upsert({
    where: { email },
    create: { email, displayName, role: "ADMIN", passwordHash },
    update: { displayName, role: "ADMIN", status: "ACTIVE", passwordHash },
  });
  await prisma.$disconnect();
  console.log(`Login: ${email}\nPassword: ${process.env.PASSWORD ? "(the one you set)" : password}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
