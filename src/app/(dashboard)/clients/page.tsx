import Link from "next/link";
import type { ClientStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ClientTable } from "@/components/client-table";
import { snapshotsFor } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const STATUSES: ClientStatus[] = ["ACTIVE", "SUSPENDED"];

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const status = STATUSES.includes(searchParams.status as ClientStatus) ? (searchParams.status as ClientStatus) : undefined;

  const where: Prisma.ClientWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? { OR: [
          { cafeName: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { ownerName: { contains: q, mode: "insensitive" } },
          { ownerEmail: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ] }
      : {}),
  };

  const clients = await prisma.client.findMany({ where, orderBy: { createdAt: "desc" } });
  const snapshots = await snapshotsFor(clients.filter((c) => c.provisionStatus === "READY").map((c) => c.id));

  return (
    <>
      <PageHeader eyebrow="Clients" title="Cafes" description={`${clients.length} cafe${clients.length === 1 ? "" : "s"}`}
        action={<Link href="/clients/new"><Button>+ Add cafe</Button></Link>} />

      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" placeholder="Search cafe, owner, email, city…" defaultValue={q} className="w-72" />
        <Select name="status" defaultValue={status ?? ""} className="w-40">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Button variant="secondary" type="submit">Filter</Button>
      </form>

      <Card><ClientTable clients={clients} snapshots={snapshots} /></Card>
    </>
  );
}
