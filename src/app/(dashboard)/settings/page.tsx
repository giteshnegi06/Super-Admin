import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sharedSql } from "@/lib/tenant-db";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function bytes(n: number) {
  if (n > 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

export default async function SettingsPage() {
  const session = await getSession();
  const [admins, clients] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.client.findMany({ select: { cafeId: true, cafeName: true, provisionStatus: true } }),
  ]);

  let sizeBytes = 0;
  let dbError: string | null = null;
  try {
    const [row] = await sharedSql().query(`SELECT pg_database_size(current_database())::bigint AS size`);
    sizeBytes = Number(row.size);
  } catch (e) { dbError = e instanceof Error ? e.message : String(e); }
  const host = new URL(env.SHARED_DB_URL).hostname;
  const dbName = new URL(env.SHARED_DB_URL).pathname.replace(/^\//, "");

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Shared database and admin team" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shared database" description="Every cafe's data lives here, scoped by cafe_id"
            action={<Badge color={dbError ? "red" : "green"}>{dbError ? "Error" : "Connected"}</Badge>} />
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Host</span><span className="font-mono text-xs">{host}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Database</span><span className="font-mono text-xs">{dbName}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Size</span><span className="font-mono text-xs">{bytes(sizeBytes)}</span></div>
            {process.env.NEON_PROJECT_ID && (
              <div className="flex justify-between"><span className="text-ink-500">Project</span>
                <a className="font-mono text-xs text-brand-600 hover:underline" target="_blank" href={`https://console.neon.tech/app/projects/${process.env.NEON_PROJECT_ID}`}>{process.env.NEON_PROJECT_ID}</a>
              </div>
            )}
            {dbError && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{dbError}</div>}
          </CardBody>
          <div className="border-t border-ink-100">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr><th>Cafe</th><th>cafe_id</th><th className="text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {clients.map((c) => (
                  <tr key={c.cafeId ?? c.cafeName} className="table-row">
                    <td className="text-xs">{c.cafeName}</td>
                    <td className="font-mono text-xs">{c.cafeId ?? <span className="text-ink-400">not provisioned</span>}</td>
                    <td className="text-right text-xs">{c.provisionStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Admin team" description="Add users with: npm run admin:create" />
          <ul className="divide-y divide-ink-100 text-sm">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-medium">{a.name}{a.id === session?.sub && <span className="ml-2 text-xs text-ink-400">(you)</span>}</div>
                  <div className="text-xs text-ink-500">{a.email} · last login {formatDateTime(a.lastLoginAt)}</div>
                </div>
                <Badge color={a.role === "SUPER_ADMIN" ? "amber" : "gray"}>{a.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
