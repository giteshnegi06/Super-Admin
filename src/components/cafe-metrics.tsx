import { IndianRupee, CalendarDays, History, Sigma, Armchair, Flame, UtensilsCrossed, Power } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueBars } from "@/components/revenue-chart";
import type { CafeMetrics } from "@/lib/metrics";
import { cn } from "@/lib/cn";
import { money } from "@/lib/currencies";
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", pct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
}

export function CafeMetricsPanel({ m }: { m: CafeMetrics }) {
  const c = m.cafe.currency;
  const tiles = [
    { label: "Today", value: money(m.today.revenue, c), sub: `${m.today.orders} orders`, icon: IndianRupee, extra: <Delta cur={m.today.revenue} prev={m.yesterday.revenue} />, hero: true },
    { label: "This month", value: money(m.thisMonth.revenue, c), sub: `${m.thisMonth.orders} orders`, icon: CalendarDays, extra: <Delta cur={m.thisMonth.revenue} prev={m.lastMonth.revenue} /> },
    { label: "Last month", value: money(m.lastMonth.revenue, c), sub: `${m.lastMonth.orders} orders`, icon: History },
    { label: "All time", value: money(m.allTime.revenue, c), sub: `${m.allTime.orders} orders`, icon: Sigma },
    { label: "Tables", value: m.tables.total, sub: `${m.tables.occupied} occupied · ${m.tables.available} free`, icon: Armchair },
    { label: "Active orders", value: m.activeOrders, sub: "not yet served", icon: Flame },
    { label: "Menu items", value: m.menu.items, sub: `${m.menu.available} available · ${m.menu.categories} categories`, icon: UtensilsCrossed },
    { label: "Ordering", value: m.cafe.isAcceptingOrders ? "Open" : "Paused", sub: `cafe id · ${m.cafe.id}`, icon: Power },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={cn(
            "relative overflow-hidden rounded-xl border p-5 shadow-card",
            t.hero ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200/80 bg-white",
          )}>
            <div className="flex items-center justify-between">
              <div className={cn("text-[11px] font-semibold uppercase tracking-wider", t.hero ? "text-ink-400" : "text-ink-500")}>{t.label}</div>
              <t.icon size={15} className={t.hero ? "text-brand-300" : "text-ink-400"} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className={cn("tabular text-[26px] font-semibold leading-none", t.hero ? "text-white" : "text-ink-900")}>{t.value}</div>
              {t.extra}
            </div>
            <div className={cn("mt-2 truncate text-xs", t.hero ? "text-ink-400" : "text-ink-500")}>{t.sub}</div>
            {t.hero && <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-500/25 blur-2xl" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Daily revenue" description="Last 30 days · subtotal + service charge, cancelled orders excluded"
          action={<Badge color="gray">{m.latencyMs} ms</Badge>} />
        <CardBody><RevenueBars points={m.last30Days} currency={c} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Monthly revenue" description="Since the cafe went live" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr><th>Month</th><th className="text-right">Orders</th><th className="text-right">Revenue</th><th className="text-right">Avg / order</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[...m.months].reverse().map((r) => (
                <tr key={r.month} className={cn("table-row tabular", r.revenue === 0 && "text-ink-400")}>
                  <td className="font-medium">{r.month}</td>
                  <td className="text-right">{r.orders}</td>
                  <td className="text-right font-semibold">{money(r.revenue, c)}</td>
                  <td className="text-right">{r.orders ? money(r.revenue / r.orders, c) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
