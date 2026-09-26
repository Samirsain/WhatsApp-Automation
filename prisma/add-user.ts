import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * npm run user:add -- staff@example.com "Staff Name"
 * Creates (or resets) a staff login and prints a one-time password.
 */
async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email?.includes("@")) throw new Error('Usage: npm run user:add -- email "Display Name"');
  const displayName = nameParts.join(" ") || email;
  const password = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.user.upsert({
    where: { email },
    create: { email, displayName, role: "ADMIN", passwordHash },
    update: { displayName, status: "ACTIVE", passwordHash },
  });
  await prisma.$disconnect();
  console.log(`Login: ${email}\nPassword: ${password}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
