"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

/** Button that asks for confirmation before running a server action. */
export function ConfirmButton({
  action, confirm, children, ...props
}: { action: () => Promise<void>; confirm: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => { if (window.confirm(confirm)) start(() => action()); }}
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {children}
    </Button>
  );
}
