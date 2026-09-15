import Link from "next/link";
import { ClientStatusBadge, ProvisionBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { ClientRow } from "@/types";
import type { CafeSnapshot } from "@/lib/metrics";
import { money } from "@/lib/currencies";

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-200">{initials}</div>;
}

export function ClientTable({ clients, snapshots = {} }: { clients: ClientRow[]; snapshots?: Record<string, CafeSnapshot> }) {
  if (clients.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="text-sm font-medium text-ink-700">No cafes yet</div>
        <div className="mt-1 text-xs text-ink-500">Use "Add cafe" to onboard your first client.</div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="table-head">
          <tr>
            <th>Cafe</th><th>Owner</th>
            <th className="text-right">Today</th><th className="text-right">This month</th><th className="text-right">Tables</th>
            <th>Status</th><th>Database</th><th>Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {clients.map((c) => {
            const s = snapshots[c.id];
            const ok = s && !s.error;
            return (
              <tr key={c.id} className="table-row">
                <td>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                    <Avatar name={c.cafeName} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-900 hover:text-brand-600">{c.cafeName}</div>
                      <div className="truncate text-xs text-ink-500">{c.cafeId ?? c.slug}{c.city ? ` · ${c.city}` : ""}</div>
                    </div>
                  </Link>
                </td>
                <td>
                  <div className="text-ink-800">{c.ownerName}</div>
                  <div className="text-xs text-ink-500">{c.ownerEmail}</div>
                </td>
                <td className="tabular text-right">
                  {ok ? <><div className="font-semibold text-ink-900">{money(s.todayRevenue, s.currency)}</div><div className="text-xs text-ink-500">{s.todayOrders} orders</div></> : <span className="text-ink-300">—</span>}
                </td>
                <td className="tabular text-right">
                  {ok ? <><div className="font-semibold text-ink-900">{money(s.monthRevenue, s.currency)}</div><div className="text-xs text-ink-500">{s.monthOrders} orders</div></> : <span className="text-ink-300">—</span>}
                </td>
                <td className="tabular text-right">
                  {ok ? <><div className="font-semibold text-ink-900">{s.tables}</div>{s.activeOrders > 0 && <div className="text-xs text-amber-600">{s.activeOrders} active</div>}</> : <span className="text-ink-300">—</span>}
                </td>
                <td><ClientStatusBadge status={c.status} /></td>
                <td><ProvisionBadge status={c.provisionStatus} /></td>
                <td className="text-xs text-ink-500">{formatDate(c.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
