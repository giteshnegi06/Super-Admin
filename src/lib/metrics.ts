/**
 * Per-cafe metrics read straight from each tenant database.
 *
 * Revenue definition matches the QR-Ordering app's GET /api/revenue/daily:
 *   revenue = subtotal + service_charge  (tax is collected for the government)
 *   cancelled orders are excluded
 *   days are bucketed by business date in the cafe's time zone
 */
import { prisma } from "./db";
import { decrypt } from "./crypto";
import { connect } from "./tenant-db";

export type DayPoint = { date: string; orders: number; revenue: number };
export type MonthPoint = { month: string; orders: number; revenue: number };

export type CafeMetrics = {
  cafe: { id: string; name: string; isAcceptingOrders: boolean; currency: string };
  today: { orders: number; revenue: number };
  yesterday: { orders: number; revenue: number };
  thisMonth: { orders: number; revenue: number };
  lastMonth: { orders: number; revenue: number };
  allTime: { orders: number; revenue: number };
  tables: { total: number; occupied: number; available: number };
  menu: { items: number; available: number; categories: number };
  activeOrders: number; // not yet served / cancelled
  last30Days: DayPoint[];
  months: MonthPoint[]; // from the cafe's first month (creation or first order) to the current month
  latencyMs: number;
  /** Platform cut on this cafe's orders — undefined when the super admin has it turned off. */
  commission?: { percent: number; today: number; thisMonth: number; allTime: number };
};

const REVENUE = `sum(subtotal + COALESCE(service_charge, 0))::numeric`;

export async function cafeMetrics(clientId: string): Promise<CafeMetrics | null> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.dbConnectionEncrypted || client.provisionStatus !== "READY") return null;
  const sql = connect(decrypt(client.dbConnectionEncrypted));
  const tz = client.timeZone || "Asia/Kolkata";
  const start = Date.now();

  const [cafeRows, summary, tables, menu, days, months] = await Promise.all([
    sql.query(`SELECT id, name, is_accepting_orders, currency FROM cafes LIMIT 1`),
    sql.query(
      `WITH o AS (
         SELECT (created_at AT TIME ZONE $1)::date AS d, subtotal, service_charge, status FROM orders
       ), today AS (SELECT (now() AT TIME ZONE $1)::date AS d)
       SELECT
         count(*) FILTER (WHERE o.status <> 'cancelled' AND o.d = today.d)::int                                  AS today_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE o.status <> 'cancelled' AND o.d = today.d), 0) AS today_rev,
         count(*) FILTER (WHERE o.status <> 'cancelled' AND o.d = today.d - 1)::int                              AS yday_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE o.status <> 'cancelled' AND o.d = today.d - 1), 0) AS yday_rev,
         count(*) FILTER (WHERE o.status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d))::int AS month_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE o.status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d)), 0) AS month_rev,
         count(*) FILTER (WHERE o.status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d) - interval '1 month')::int AS lmonth_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE o.status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d) - interval '1 month'), 0) AS lmonth_rev,
         count(*) FILTER (WHERE o.status <> 'cancelled')::int                                                    AS all_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE o.status <> 'cancelled'), 0)           AS all_rev,
         count(*) FILTER (WHERE o.status NOT IN ('served','cancelled'))::int                                      AS active_orders
       FROM o, today`,
      [tz],
    ),
    sql.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status <> 'available' OR active_order_id IS NOT NULL)::int AS occupied
       FROM tables`,
    ),
    sql.query(
      `SELECT (SELECT count(*) FROM menu_items)::int AS items,
              (SELECT count(*) FROM menu_items WHERE is_available)::int AS available,
              (SELECT count(*) FROM categories)::int AS categories`,
    ),
    sql.query(
      `WITH days AS (
         SELECT generate_series((now() AT TIME ZONE $1)::date - 29, (now() AT TIME ZONE $1)::date, '1 day')::date AS d
       )
       SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
              count(o.*)::int AS orders,
              COALESCE(${REVENUE}, 0) AS revenue
       FROM days
       LEFT JOIN orders o ON (o.created_at AT TIME ZONE $1)::date = days.d AND o.status <> 'cancelled'
       GROUP BY days.d ORDER BY days.d`,
      [tz],
    ),
    sql.query(
      `WITH bounds AS (
         SELECT date_trunc('month', LEAST(
                  (SELECT min(created_at AT TIME ZONE $1) FROM orders),
                  (SELECT min(created_at AT TIME ZONE $1) FROM cafes),
                  now() AT TIME ZONE $1))::date AS first_m,
                date_trunc('month', (now() AT TIME ZONE $1)::date)::date AS last_m
       ), months AS (
         SELECT generate_series(first_m, last_m, '1 month')::date AS m FROM bounds
       )
       SELECT to_char(months.m, 'Mon YYYY') AS month,
              count(o.*)::int AS orders,
              COALESCE(${REVENUE}, 0) AS revenue
       FROM months
       LEFT JOIN orders o ON date_trunc('month', (o.created_at AT TIME ZONE $1)::date) = months.m AND o.status <> 'cancelled'
       GROUP BY months.m ORDER BY months.m`,
      [tz],
    ),
  ]);

  const s = summary[0];
  const t = tables[0];
  const m = menu[0];
  const cafe = cafeRows[0] ?? { id: client.cafeId, name: client.cafeName, is_accepting_orders: false, currency: "₹" };

  return {
    cafe: { id: cafe.id, name: cafe.name, isAcceptingOrders: !!cafe.is_accepting_orders, currency: cafe.currency ?? "₹" },
    today: { orders: s.today_orders, revenue: Number(s.today_rev) },
    yesterday: { orders: s.yday_orders, revenue: Number(s.yday_rev) },
    thisMonth: { orders: s.month_orders, revenue: Number(s.month_rev) },
    lastMonth: { orders: s.lmonth_orders, revenue: Number(s.lmonth_rev) },
    allTime: { orders: s.all_orders, revenue: Number(s.all_rev) },
    tables: { total: t.total, occupied: t.occupied, available: t.total - t.occupied },
    menu: { items: m.items, available: m.available, categories: m.categories },
    activeOrders: s.active_orders,
    last30Days: days.map((r) => ({ date: r.date, orders: r.orders, revenue: Number(r.revenue) })),
    months: months.map((r) => ({ month: r.month, orders: r.orders, revenue: Number(r.revenue) })),
    latencyMs: Date.now() - start,
    commission: client.commissionEnabled
      ? {
          percent: client.commissionPercent,
          today: Number(s.today_rev) * (client.commissionPercent / 100),
          thisMonth: Number(s.month_rev) * (client.commissionPercent / 100),
          allTime: Number(s.all_rev) * (client.commissionPercent / 100),
        }
      : undefined,
  };
}

/** Lightweight snapshot used on list pages / the global dashboard. */
export type CafeSnapshot = {
  clientId: string;
  todayRevenue: number; todayOrders: number;
  monthRevenue: number; monthOrders: number;
  tables: number; activeOrders: number;
  currency: string; // symbol from cafes.currency
  todayCommission: number; monthCommission: number; // 0 when the cut is turned off
  error?: string;
};

export async function cafeSnapshot(clientId: string): Promise<CafeSnapshot> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const empty: CafeSnapshot = { clientId, todayRevenue: 0, todayOrders: 0, monthRevenue: 0, monthOrders: 0, tables: 0, activeOrders: 0, currency: "₹", todayCommission: 0, monthCommission: 0 };
  if (!client.dbConnectionEncrypted || client.provisionStatus !== "READY") return empty;
  try {
    const sql = connect(decrypt(client.dbConnectionEncrypted));
    const tz = client.timeZone || "Asia/Kolkata";
    const [r] = await sql.query(
      `WITH o AS (SELECT (created_at AT TIME ZONE $1)::date AS d, subtotal, service_charge, status FROM orders),
            today AS (SELECT (now() AT TIME ZONE $1)::date AS d)
       SELECT
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE status <> 'cancelled' AND o.d = today.d), 0) AS today_rev,
         count(*) FILTER (WHERE status <> 'cancelled' AND o.d = today.d)::int AS today_orders,
         COALESCE(sum(subtotal + COALESCE(service_charge,0)) FILTER (WHERE status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d)), 0) AS month_rev,
         count(*) FILTER (WHERE status <> 'cancelled' AND date_trunc('month', o.d) = date_trunc('month', today.d))::int AS month_orders,
         count(*) FILTER (WHERE status NOT IN ('served','cancelled'))::int AS active_orders,
         (SELECT count(*) FROM tables)::int AS tables,
         (SELECT currency FROM cafes LIMIT 1) AS currency
       FROM o, today`,
      [tz],
    );
    const pct = client.commissionEnabled ? client.commissionPercent / 100 : 0;
    return {
      clientId,
      todayRevenue: Number(r.today_rev), todayOrders: r.today_orders,
      monthRevenue: Number(r.month_rev), monthOrders: r.month_orders,
      tables: r.tables, activeOrders: r.active_orders, currency: r.currency ?? "₹",
      todayCommission: Number(r.today_rev) * pct, monthCommission: Number(r.month_rev) * pct,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Snapshots for many clients in parallel (used by dashboard + list). */
export async function snapshotsFor(clientIds: string[]): Promise<Record<string, CafeSnapshot>> {
  const list = await Promise.all(clientIds.map(cafeSnapshot));
  return Object.fromEntries(list.map((s) => [s.clientId, s]));
}
