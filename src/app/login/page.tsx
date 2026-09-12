import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-700/20 blur-3xl" />
        <Image src="/brand/chotu-logo.png" alt="Chotu" width={220} height={115} priority className="relative h-auto w-[220px]" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Every cafe on Chotu, in one place.</h2>
          <p className="mt-4 text-ink-400">Revenue, tables, orders and databases for all your clients — and a one-click setup for the next one.</p>
        </div>
        <div className="relative text-xs text-ink-500">© {new Date().getFullYear()} Chotu · QR Ordering System</div>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="inline-block rounded-xl bg-ink-950 px-4 py-3">
              <Image src="/brand/chotu-logo.png" alt="Chotu" width={120} height={63} className="h-auto w-[120px]" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Super admin access only.</p>
          <div className="mt-8"><LoginForm next={searchParams.next} /></div>
        </div>
      </section>
    </main>
  );
}
