"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProvisionStatus } from "@prisma/client";
import { ProvisionBadge } from "@/components/ui/badge";

const BUSY: ProvisionStatus[] = ["CREATING_DATABASE", "RUNNING_MIGRATIONS", "SEEDING", "DELETING"];

/** Shows provisioning status and polls until it settles, then refreshes the page. */
export function ProvisionStatusLive({ clientId, initial }: { clientId: string; initial: ProvisionStatus }) {
  const [status, setStatus] = useState(initial);
  const router = useRouter();

  useEffect(() => {
    setStatus(initial);
    if (!BUSY.includes(initial)) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/clients/${clientId}/status`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { provisionStatus: ProvisionStatus };
      setStatus(j.provisionStatus);
      if (!BUSY.includes(j.provisionStatus)) {
        clearInterval(t);
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [clientId, initial, router]);

  return <ProvisionBadge status={status} />;
}
