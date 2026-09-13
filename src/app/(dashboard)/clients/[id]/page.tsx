import { notFound } from "next/navigation";
import { Database, ExternalLink, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { decrypt, maskConnectionString } from "@/lib/crypto";
import { cafeMetrics, type CafeMetrics } from "@/lib/metrics";
import { ownerLoginStatus, type OwnerLoginStatus } from "@/lib/provisioning";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ClientStatusBadge } from "@/components/ui/badge";
import { ProvisionStatusLive } from "@/components/provision-status";
import { ClientForm } from "@/components/client-form";
import { CommissionForm } from "@/components/commission-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { CafeMetricsPanel } from "@/components/cafe-metrics";
import { AttachDbForm } from "./attach-db-form";
import { SecretField } from "@/components/secret-field";
import { provisionClientAction, deprovisionClientAction, deleteClientAction, setClientStatusAction, resetOwnerPasswordAction } from "@/actions/clients";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { activityLogs: { orderBy: { createdAt: "desc" }, take: 15, include: { admin: { select: { name: true } } } }, },
  });
  if (!client) notFound();

  let metrics: CafeMetrics | null = null;
  let metricsError: string | null = null;
  if (client.provisionStatus === "READY") {
    try { metrics = await cafeMetrics(client.id); } catch (e) { metricsError = e instanceof Error ? e.message : String(e); }
  }
  const connStr = client.dbConnectionEncrypted ? decrypt(client.dbConnectionEncrypted) : null;
  // Checked live against the cafe DB so a password changed from the cafe console is never shown stale
  let login: OwnerLoginStatus = { state: "missing" };
  if (client.provisionStatus === "READY") {
    try { login = await ownerLoginStatus(client); } catch { login = { state: "missing" }; }
  }
  const loginUrl = client.appUrl ? `${client.appUrl.replace(/\/$/, "")}/admin` : null;
  const isSuper = session?.role === "SUPER_ADMIN";

  return (
    <>
      <PageHeader
        eyebrow="Cafe"
        title={client.cafeName}
        description={`${client.ownerName} · ${client.ownerEmail}${client.city ? ` · ${client.city}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            {client.appUrl && (
              <a href={client.appUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                Open app <ExternalLink size={12} />
              </a>
            )}
            <ClientStatusBadge status={client.status} />
            <ProvisionStatusLive clientId={client.id} initial={client.provisionStatus} />
          </div>
        }
      />

      {/* ── Live business metrics from the cafe's own database ── */}
      {metrics && <div className="mb-6"><CafeMetricsPanel m={metrics} /></div>}
      {metricsError && (
        <div className="mb-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Could not read cafe database: {metricsError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ── Cafe admin login ── */}
          {client.provisionStatus === "READY" && (
            <Card>
              <CardHeader
                title="Cafe admin login"
                description="Credentials for the owner to sign in to their QR-Ordering admin console"
                action={
                  <ConfirmButton size="sm" variant="secondary" action={resetOwnerPasswordAction.bind(null, client.id)}
                    confirm="Generate a new password? The old one will stop working immediately.">
                    <KeyRound size={14} /> {login.state === "missing" ? "Generate login" : "Reset password"}
                  </ConfirmButton>
                }
              />
              <CardBody>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Login page</dt>
                    <dd className="mt-1 text-sm">
                      {loginUrl
                        ? <a href={loginUrl} target="_blank" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">{loginUrl} <ExternalLink size={12} /></a>
                        : <span className="text-ink-400">Set the App URL below</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Email / ID</dt>
                    <dd className="mt-1"><SecretField value={client.ownerEmail} /></dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Password</dt>
                    <dd className="mt-1">
                      {login.state === "ok" && <SecretField value={login.password} secret />}
                      {login.state === "missing" && <span className="text-sm text-ink-400">Not generated yet</span>}
                      {login.state === "changed_in_app" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          Changed by the owner in their console
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-500">
                  {login.state === "changed_in_app"
                    ? <>The cafe database only keeps a one-way hash, so the new password can't be read here. Use <b>Reset password</b> to issue a fresh one the owner can use.</>
                    : <>Role: <b>Admin</b> · set {formatDateTime(client.ownerPasswordSetAt)}. The owner can change it or add kitchen staff logins from their own console.</>}
                </p>
              </CardBody>
            </Card>
          )}

          {/* ── Database ── */}
          <Card>
            <CardHeader
              title="Cafe database"
              description="Dedicated Postgres database in your Neon project (same setup as QR-Order for Negi's Kitchen)"
              action={
                <div className="flex gap-2">
                  {client.provisionStatus !== "READY" && (
                    <ConfirmButton
                      size="sm"
                      action={provisionClientAction.bind(null, client.id)}
                      confirm={client.provisionStatus === "FAILED" ? "Retry provisioning?" : "Create a new database for this cafe?"}
                    >
                      <Database size={14} /> {client.provisionStatus === "FAILED" ? "Retry" : "Create database"}
                    </ConfirmButton>
                  )}
                  {client.provisionStatus === "READY" && (
                    <ConfirmButton
                      size="sm"
                      variant="secondary"
                      action={provisionClientAction.bind(null, client.id)}
                      confirm="Re-apply the schema and re-sync the cafe row? Existing orders/menu are kept."
                    >
                      <RefreshCw size={14} /> Re-run schema
                    </ConfirmButton>
                  )}
                </div>
              }
            />
            <CardBody className="space-y-3 text-sm">
              {client.provisionError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"><b>Error:</b> {client.provisionError}</div>
              )}
              <dl className="grid grid-cols-3 gap-y-2">
                <dt className="text-ink-500">Database name</dt>
                <dd className="col-span-2 font-mono text-xs">{client.dbName ?? "-"}</dd>
                <dt className="text-ink-500">Cafe id (cafes.id)</dt>
                <dd className="col-span-2 font-mono text-xs">{client.cafeId ?? "-"}</dd>
                <dt className="text-ink-500">Host</dt>
                <dd className="col-span-2 font-mono text-xs">{client.neonEndpointHost ?? "-"}</dd>
                <dt className="text-ink-500">Provisioned</dt>
                <dd className="col-span-2">{formatDateTime(client.provisionedAt)}</dd>
                {connStr && isSuper && (
                  <>
                    <dt className="text-ink-500">DATABASE_URL</dt>
                    <dd className="col-span-2 flex items-center gap-2 break-all font-mono text-xs">
                      {maskConnectionString(connStr)} <CopyButton value={connStr} label="Copy full" />
                    </dd>
                  </>
                )}
              </dl>
              {connStr && (
                <div className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  <b>To go live:</b> deploy the QR-Ordering repo on Vercel for this cafe and set <code>DATABASE_URL</code> to the value above, then paste the Vercel URL into <i>App URL</i> below.
                </div>
              )}
              {isSuper && client.provisionStatus !== "READY" && !client.dbName && (
                <div className="border-t border-ink-100 pt-3">
                  <div className="mb-2 text-xs font-medium text-ink-700">Or link an existing database</div>
                  <AttachDbForm clientId={client.id} />
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Edit details ── */}
          <Card>
            <CardHeader title="Client details" />
            <CardBody><ClientForm client={client} /></CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {isSuper && (
            <Card>
              <CardHeader title="Platform commission" description="Your cut of this cafe's orders" />
              <CardBody><CommissionForm client={client} /></CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Actions" />
            <CardBody className="flex flex-col gap-2">
              {client.status !== "ACTIVE" && (
                <ConfirmButton size="sm" variant="secondary" action={setClientStatusAction.bind(null, client.id, "ACTIVE")} confirm="Mark as active?">Mark active</ConfirmButton>
              )}
              {client.status !== "SUSPENDED" && (
                <ConfirmButton size="sm" variant="secondary" action={setClientStatusAction.bind(null, client.id, "SUSPENDED")} confirm="Suspend this cafe?">Suspend</ConfirmButton>
              )}
              {isSuper && client.dbName && (
                <ConfirmButton size="sm" variant="danger" action={deprovisionClientAction.bind(null, client.id)} confirm={`DROP database "${client.dbName}" and ALL its orders, menu and tables? This cannot be undone.`}>
                  <Trash2 size={14} /> Drop database
                </ConfirmButton>
              )}
              {isSuper && (
                <ConfirmButton size="sm" variant="danger" action={deleteClientAction.bind(null, client.id)} confirm="Delete this client AND drop its database permanently?">
                  <Trash2 size={14} /> Delete client
                </ConfirmButton>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="divide-y divide-ink-100">
              {client.activityLogs.map((l) => (
                <li key={l.id} className="px-5 py-2">
                  <div className="font-mono text-[11px] font-medium text-ink-800">{l.action}</div>
                  <div className="text-[11px] text-ink-500">{l.admin?.name ?? "system"} · {formatDateTime(l.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
