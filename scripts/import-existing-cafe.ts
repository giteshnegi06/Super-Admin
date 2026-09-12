/**
 * Register an already-running cafe database as a client (no provisioning).
 * Usage:
 *   npm run client:import -- --db QR-Order --slug negis-kitchen --owner "Gitesh Negi" --email negigitesh@gmail.com [--app https://qr-ordering-sable.vercel.app]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { attachExistingDatabase } from "../src/lib/provisioning";
import { connect, connectionStringFor } from "../src/lib/tenant-db";

const prisma = new PrismaClient();
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const db = arg("db"), slug = arg("slug"), owner = arg("owner") ?? "Owner", email = arg("email");
  if (!db || !slug || !email) {
    console.error('Usage: npm run client:import -- --db QR-Order --slug negis-kitchen --owner "Name" --email you@x.com [--app https://...]');
    process.exit(1);
  }
  const [cafe] = await connect(connectionStringFor(db)).query(`SELECT id, name, tagline, address, phone FROM cafes LIMIT 1`);
  if (!cafe) throw new Error(`No cafes row in database ${db}`);

  const client = await prisma.client.upsert({
    where: { slug },
    update: {},
    create: {
      slug, cafeName: cafe.name, tagline: cafe.tagline, address: cafe.address, ownerPhone: cafe.phone,
      ownerName: owner, ownerEmail: email.toLowerCase(), status: "ACTIVE", appUrl: arg("app") ?? null, cafeId: cafe.id,
    },
  });
  await attachExistingDatabase(client.id, db);
  console.log(`Linked "${cafe.name}" (db ${db}, cafe id ${cafe.id}) → client ${client.id}`);
}
main().finally(() => prisma.$disconnect());
