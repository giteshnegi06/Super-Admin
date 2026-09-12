/**
 * Create a super-admin user.
 * Usage: npm run admin:create -- --email you@x.com --name "Your Name" --password "secret"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const name = arg("name") ?? "Super Admin";
  const password = arg("password");
  if (!email || !password) {
    console.error('Usage: npm run admin:create -- --email you@x.com --name "Name" --password "secret"');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name, role: "SUPER_ADMIN", isActive: true },
    create: { email, name, passwordHash, role: "SUPER_ADMIN" },
  });
  console.log(`Admin ready: ${user.email} (${user.role})`);
}

main().finally(() => prisma.$disconnect());
