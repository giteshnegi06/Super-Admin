import { notFound } from "next/navigation";
import { Database, ExternalLink, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
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
import { CafeMetricsPanel } from "@/components/cafe-metrics";
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
  // Checked live against the shared DB so a password changed from the cafe console is never shown stale
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

          {/* ── Cafe data ── */}
          <Card>
            <CardHeader
              title="Cafe data"
              description="Rows in the shared database, scoped by cafe_id — every cafe's app points at the same deployment"
              action={
                <div className="flex gap-2">
                  {client.provisionStatus !== "READY" && (
                    <ConfirmButton
                      size="sm"
                      action={provisionClientAction.bind(null, client.id)}
                      confirm={client.provisionStatus === "FAILED" ? "Retry provisioning?" : "Create this cafe's rows in the shared database?"}
                    >
                      <Database size={14} /> {client.provisionStatus === "FAILED" ? "Retry" : "Provision cafe"}
                    </ConfirmButton>
                  )}
                  {client.provisionStatus === "READY" && (
                    <ConfirmButton
                      size="sm"
                      variant="secondary"
                      action={provisionClientAction.bind(null, client.id)}
                      confirm="Re-sync the cafe row from these details? Existing orders/menu are kept."
                    >
                      <RefreshCw size={14} /> Re-sync
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
                <dt className="text-ink-500">Cafe id (cafes.id)</dt>
                <dd className="col-span-2 font-mono text-xs">{client.cafeId ?? "-"}</dd>
                <dt className="text-ink-500">Provisioned</dt>
                <dd className="col-span-2">{formatDateTime(client.provisionedAt)}</dd>
              </dl>
              {client.provisionStatus === "READY" && (
                <div className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  Currency, tax and other settings edited below apply directly to this cafe's row — no separate step needed.
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
              {isSuper && client.cafeId && (
                <ConfirmButton size="sm" variant="danger" action={deprovisionClientAction.bind(null, client.id)} confirm={`Remove "${client.cafeName}" and ALL its orders, menu and tables from the shared database? This cannot be undone.`}>
                  <Trash2 size={14} /> Remove cafe data
                </ConfirmButton>
              )}
              {isSuper && (
                <ConfirmButton size="sm" variant="danger" action={deleteClientAction.bind(null, client.id)} confirm="Delete this client AND its cafe data permanently?">
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
