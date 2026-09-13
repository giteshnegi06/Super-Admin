import Link from "next/link";
import { Store, IndianRupee, Armchair, CalendarDays, Percent } from "lucide-react";
import { prisma } from "@/lib/db";
import { snapshotsFor } from "@/lib/metrics";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stats-cards";
import { Card, CardHeader } from "@/components/ui/card";
import { ClientTable } from "@/components/client-table";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

import { money, moneyPrecise } from "@/lib/currencies";

/** Sum a field per currency and render as "₹9,523 · $120". Cafes in different currencies are never added together. */
function perCurrency(
  snaps: { currency: string; [k: string]: unknown }[],
  field: "todayRevenue" | "monthRevenue" | "todayCommission" | "monthCommission",
  precise = false,
) {
  const totals = new Map<string, number>();
  for (const s of snaps) totals.set(s.currency, (totals.get(s.currency) ?? 0) + (s[field] as number));
  if (totals.size === 0) return "₹0";
  const fmt = precise ? moneyPrecise : money;
  return [...totals.entries()].map(([sym, n]) => fmt(n, sym)).join(" · ");
}

export default async function DashboardPage() {
  const [total, active, suspended, failed, clients, logs] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.client.count({ where: { status: "SUSPENDED" } }),
    prisma.client.count({ where: { provisionStatus: "FAILED" } }),
    prisma.client.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { client: { select: { cafeName: true } }, admin: { select: { name: true } } } }),
  ]);

  // Live numbers pulled from every ready cafe database in parallel
  const snapshots = await snapshotsFor(clients.filter((c) => c.provisionStatus === "READY").map((c) => c.id));
  const snaps = Object.values(snapshots).filter((s) => !s.error);
  const todayOrders = snaps.reduce((a, s) => a + s.todayOrders, 0);
  const monthOrders = snaps.reduce((a, s) => a + s.monthOrders, 0);
  const tables = snaps.reduce((a, s) => a + s.tables, 0);
  const activeOrders = snaps.reduce((a, s) => a + s.activeOrders, 0);
  const cutCafes = clients.filter((c) => c.commissionEnabled).length;

  return (
    <>
      <PageHeader eyebrow="Overview" title="Good to see you" description="Live numbers from every cafe running on Chotu"
        action={<Link href="/clients/new"><Button>+ Add cafe</Button></Link>} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent label="Today · all cafes" value={perCurrency(snaps, "todayRevenue")} sub={`${todayOrders} orders today`} icon={IndianRupee} />
        <StatCard label="This month · all cafes" value={perCurrency(snaps, "monthRevenue")} sub={`${monthOrders} orders`} icon={CalendarDays} />
        <StatCard label="Tables across cafes" value={tables} sub={`${activeOrders} orders in progress`} icon={Armchair} />
        <StatCard label="Cafes" value={total} sub={`${active} active · ${suspended} suspended${failed ? ` · ${failed} failed` : ""}`} icon={Store} />
      </div>

      {cutCafes > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <StatCard label="Your cut · today" value={perCurrency(snaps, "todayCommission", true)} sub={`${cutCafes} cafe${cutCafes === 1 ? "" : "s"} on commission`} icon={Percent} />
          <StatCard label="Your cut · this month" value={perCurrency(snaps, "monthCommission", true)} sub={`${cutCafes} cafe${cutCafes === 1 ? "" : "s"} on commission`} icon={Percent} />
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Cafes" description="Live revenue and tables from each cafe's database"
            action={<Link href="/clients" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
          <ClientTable clients={clients.slice(0, 10)} snapshots={snapshots} />
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {logs.length === 0 && <li className="px-5 py-6 text-center text-xs text-ink-500">No activity yet</li>}
            {logs.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <div className="font-mono text-[11px] font-medium text-ink-800">{l.action}</div>
                <div className="text-xs text-ink-500">
                  {l.client?.cafeName ? `${l.client.cafeName} · ` : ""}{l.admin?.name ?? "system"} · {formatDateTime(l.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
