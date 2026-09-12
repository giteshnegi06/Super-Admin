import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; accent?: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 shadow-card",
      accent ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200/80 bg-white",
    )}>
      <div className="flex items-start justify-between">
        <div className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-ink-400" : "text-ink-500")}>{label}</div>
        <div className={cn("grid h-8 w-8 place-items-center rounded-lg", accent ? "bg-white/10 text-brand-300" : "bg-brand-50 text-brand-600")}>
          <Icon size={16} />
        </div>
      </div>
      <div className={cn("tabular mt-3 text-[28px] font-semibold leading-none", accent ? "text-white" : "text-ink-900")}>{value}</div>
      {sub && <div className={cn("mt-2 text-xs", accent ? "text-ink-400" : "text-ink-500")}>{sub}</div>}
      {accent && <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-500/20 blur-2xl" />}
    </div>
  );
}
