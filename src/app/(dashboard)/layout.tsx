import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { LiveRefresh } from "@/components/live-refresh";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <Sidebar user={session} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1240px] px-8 py-8 lg:px-10">
          <div className="mb-2 flex justify-end"><LiveRefresh intervalMs={10_000} /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
