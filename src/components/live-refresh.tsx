"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Keeps server-rendered data fresh without a page reload.
 *
 * Every `intervalMs` it calls router.refresh(), which re-runs the server
 * components for the current route and patches the DOM in place — client
 * state, scroll position and half-typed form fields are preserved. Refreshes
 * are skipped while the tab is hidden or the user is typing in a field.
 */
export function LiveRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastAt, setLastAt] = useState<number>(() => Date.now());
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const refresh = () => {
      if (document.hidden || isTyping() || busy.current) return;
      busy.current = true;
      setRefreshing(true);
      router.refresh();
      // router.refresh() has no promise; give the RSC round-trip a moment before re-enabling
      setTimeout(() => { busy.current = false; setRefreshing(false); setLastAt(Date.now()); }, 1500);
    };
    const id = setInterval(refresh, intervalMs);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, intervalMs]);

  // re-render the "Xs ago" label once a second
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const ago = Math.max(0, Math.round((Date.now() - lastAt) / 1000));

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 shadow-card">
      <span className={cn("h-1.5 w-1.5 rounded-full bg-emerald-500", refreshing ? "animate-ping" : "animate-pulse")} />
      Live · updated {ago < 2 ? "just now" : `${ago}s ago`}
    </div>
  );
}
