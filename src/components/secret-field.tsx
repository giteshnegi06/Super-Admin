"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

/** Monospace value with copy (and optional reveal) controls. */
export function SecretField({ value, secret = false }: { value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded-md bg-ink-100 px-2 py-1 font-mono text-[13px] text-ink-900">
        {shown ? value : "•".repeat(Math.min(value.length, 12))}
      </code>
      {secret && (
        <button type="button" onClick={() => setShown((s) => !s)} title={shown ? "Hide" : "Show"}
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      <button type="button" title="Copy"
        onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
        className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
        {done ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
