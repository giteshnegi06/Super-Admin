"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, Settings, LogOut, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/actions/auth";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Cafes", icon: Store },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: { user: { name: string; email: string; role: string } }) {
  const pathname = usePathname();
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-ink-950 text-ink-300">
      {/* Brand */}
      <div className="px-6 pb-4 pt-7">
        <Link href="/dashboard" className="block">
          <Image src="/brand/chotu-logo.png" alt="Chotu" width={150} height={78} priority className="h-auto w-[150px]" />
        </Link>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">Super Admin</div>
      </div>

      <div className="px-4">
        <Link href="/clients/new"
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white shadow-pop transition hover:bg-brand-400">
          <Plus size={16} /> Add cafe
        </Link>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-white/10 text-white" : "text-ink-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={17} className={cn(active ? "text-brand-400" : "text-ink-500 group-hover:text-ink-300")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300 ring-1 ring-brand-500/30">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user.name}</div>
            <div className="truncate text-[11px] text-ink-500">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button title="Sign out" className="rounded-md p-1.5 text-ink-500 transition hover:bg-white/10 hover:text-white">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
