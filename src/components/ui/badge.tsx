import type { ClientStatus, ProvisionStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import { CLIENT_STATUS_LABEL, PROVISION_STATUS_LABEL } from "@/types";

const tone = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  gray: "bg-ink-100 text-ink-600 ring-ink-500/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
};

export function Badge({ children, color = "gray", pulse }: { children: React.ReactNode; color?: keyof typeof tone; pulse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tone[color])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {children}
    </span>
  );
}

const clientTone: Record<ClientStatus, keyof typeof tone> = { ACTIVE: "green", SUSPENDED: "red" };
export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge color={clientTone[status]}>{CLIENT_STATUS_LABEL[status]}</Badge>;
}

const provTone: Record<ProvisionStatus, keyof typeof tone> = {
  PENDING: "gray", CREATING_DATABASE: "blue", RUNNING_MIGRATIONS: "blue", SEEDING: "blue",
  READY: "green", FAILED: "red", DELETING: "amber",
};
const busy: ProvisionStatus[] = ["CREATING_DATABASE", "RUNNING_MIGRATIONS", "SEEDING", "DELETING"];
export function ProvisionBadge({ status }: { status: ProvisionStatus }) {
  return <Badge color={provTone[status]} pulse={busy.includes(status)}>{PROVISION_STATUS_LABEL[status]}</Badge>;
}
