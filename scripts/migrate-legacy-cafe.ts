/**
 * One-time migration: copy a cafe's data out of its old dedicated database
 * and into the new shared multi-tenant database (scoped by cafe_id).
 *
 * Usage:
 *   npm run client:migrate-legacy -- --from "postgresql://...old-cafe-db..." --slug negis-kitchen --owner "Gitesh Negi" --email negigitesh@gmail.com [--app https://...]
 *
 * Order matters (FK dependencies): cafes → admin_users → categories →
 * menu_items → tables → orders → order_rounds → order_items →
 * daily_revenue → service_requests.
 *
 * Safe to re-run: every insert is `ON CONFLICT (id) DO NOTHING`, so a partial
 * or repeated run never duplicates rows. Does NOT touch the old database —
 * decommission it manually once the migrated cafe has been smoke-tested.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { neon } from "@neondatabase/serverless";
import { sharedSql, runSqlScript, type Sql } from "../src/lib/tenant-db";
import { TENANT_SCHEMA_SQL } from "../src/lib/tenant-schema";

const prisma = new PrismaClient();
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

// jsonb columns come back from the legacy DB already parsed into JS objects/
// arrays; passed straight through as a query param they get mangled (the
// driver's default stringification isn't valid JSON), so re-stringify them.
const JSON_COLUMNS = new Set(["customization_groups", "selected_customizations"]);

async function copyTable(from: Sql, to: Sql, table: string, columns: string[], conflictKey = "id") {
  const rows = await from.query(`SELECT ${columns.join(", ")} FROM ${table}`);
  const cols = columns.join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  for (const row of rows) {
    const values = columns.map((c) => (JSON_COLUMNS.has(c) ? JSON.stringify(row[c]) : row[c]));
    await to.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictKey}) DO NOTHING`, values);
  }
  console.log(`  ${table}: ${rows.length} row(s)`);
  return rows.length;
}

async function main() {
  const from = arg("from"), slug = arg("slug"), owner = arg("owner") ?? "Owner", email = arg("email");
  if (!from || !slug || !email) {
    console.error('Usage: npm run client:migrate-legacy -- --from "postgresql://..." --slug negis-kitchen --owner "Name" --email you@x.com [--app https://...]');
    process.exit(1);
  }

  const legacy: Sql = neon(from);
  const shared = sharedSql();

  console.log("Applying shared schema (idempotent)...");
  await runSqlScript(shared, TENANT_SCHEMA_SQL);

  const [cafe] = await legacy.query(`SELECT * FROM cafes LIMIT 1`);
  if (!cafe) throw new Error(`No cafes row in the legacy database`);
  console.log(`Migrating cafe "${cafe.name}" (id ${cafe.id})...`);

  await shared.query(
    `INSERT INTO cafes (id, name, tagline, logo_url, address, phone, currency, tax_percent, service_charge_percent, is_accepting_orders, upi_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
    [cafe.id, cafe.name, cafe.tagline, cafe.logo_url, cafe.address, cafe.phone, cafe.currency, cafe.tax_percent,
     cafe.service_charge_percent, cafe.is_accepting_orders, cafe.upi_id, cafe.created_at, cafe.updated_at],
  );

  // admin_users/categories/menu_items/tables use ids that are only unique per
  // cafe (see tenant-schema.ts) — conflicts are checked on (cafe_id, id).
  await copyTable(legacy, shared, "admin_users", ["id", "cafe_id", "name", "email", "role", "password_hash", "created_at"], "cafe_id, id");
  await copyTable(legacy, shared, "categories", ["id", "cafe_id", "name", "icon", "display_order", "created_at"], "cafe_id, id");
  await copyTable(legacy, shared, "menu_items", ["id", "cafe_id", "category_id", "name", "description", "price", "veg_type",
    "image_url", "is_available", "preparation_time_min", "customization_groups", "created_at", "updated_at"], "cafe_id, id");
  await copyTable(legacy, shared, "tables", ["id", "cafe_id", "number", "code", "capacity", "status", "active_order_id", "created_at", "updated_at"], "cafe_id, id");
  // orders.id (e.g. "ORD-1001") is only unique PER CAFE — the shared DB's
  // primary key is (cafe_id, id), not id alone, so conflicts are checked on
  // that pair (two different cafes legitimately sharing the same order id
  // is expected and fine).
  await copyTable(legacy, shared, "orders", ["id", "cafe_id", "table_id", "table_number", "status", "customer_name", "customer_phone",
    "special_instructions", "payment_method", "payment_status", "subtotal", "tax", "service_charge", "total",
    "order_rounds_count", "is_merged", "merged_order_ids", "created_at", "updated_at"], "cafe_id, id");

  // order_rounds / order_items predate the cafe_id column in the legacy DB —
  // backfill it from the order row (not order_rounds — that column doesn't
  // exist yet in a legacy database that hasn't had migration 005 applied).
  const rounds = await legacy.query(`SELECT r.*, o.cafe_id AS derived_cafe_id FROM order_rounds r JOIN orders o ON r.order_id = o.id`);
  for (const r of rounds) {
    await shared.query(
      `INSERT INTO order_rounds (id, cafe_id, order_id, round_number, placed_at, estimated_prep_time_min, preparing_started_at, ready_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.cafe_id ?? r.derived_cafe_id, r.order_id, r.round_number, r.placed_at, r.estimated_prep_time_min, r.preparing_started_at, r.ready_at, r.status],
    );
  }
  console.log(`  order_rounds: ${rounds.length} row(s)`);

  const items = await legacy.query(`SELECT i.*, o.cafe_id AS derived_cafe_id FROM order_items i JOIN order_rounds r ON i.order_round_id = r.id JOIN orders o ON r.order_id = o.id`);
  for (const it of items) {
    await shared.query(
      `INSERT INTO order_items (id, cafe_id, order_round_id, menu_item_id, name, price, veg_type, quantity, item_total, special_instructions, preparation_time_min, selected_customizations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      [it.id, it.cafe_id ?? it.derived_cafe_id, it.order_round_id, it.menu_item_id, it.name, it.price, it.veg_type,
       it.quantity, it.item_total, it.special_instructions, it.preparation_time_min, JSON.stringify(it.selected_customizations)],
    );
  }
  console.log(`  order_items: ${items.length} row(s)`);

  await copyTable(legacy, shared, "daily_revenue", ["cafe_id", "business_date", "orders_count", "subtotal", "service_charge", "tax", "revenue", "time_zone", "updated_at"], "cafe_id, business_date").catch(() => console.log("  daily_revenue: table not present in legacy DB, skipped"));
  await copyTable(legacy, shared, "service_requests", ["id", "cafe_id", "table_id", "table_number", "request_type", "status", "created_at", "resolved_at"], "cafe_id, id").catch(() => console.log("  service_requests: table not present in legacy DB, skipped"));

  const client = await prisma.client.upsert({
    where: { slug },
    update: { cafeId: cafe.id, provisionStatus: "READY", provisionedAt: new Date() },
    create: {
      slug, cafeName: cafe.name, tagline: cafe.tagline, address: cafe.address, ownerPhone: cafe.phone,
      ownerName: owner, ownerEmail: email.toLowerCase(), status: "ACTIVE", appUrl: arg("app") ?? null,
      cafeId: cafe.id, provisionStatus: "READY", provisionedAt: new Date(),
    },
  });
  console.log(`Linked "${cafe.name}" (cafe id ${cafe.id}) -> client ${client.id}`);
  console.log("Done. Verify the data, then point cafeBackend's DATABASE_URL at the shared DB and deploy.");
}
main().finally(() => prisma.$disconnect());
