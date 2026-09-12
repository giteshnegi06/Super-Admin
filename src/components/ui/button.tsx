import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "dark";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus-visible:ring-brand-500",
  secondary: "bg-white text-ink-800 border border-ink-200 shadow-sm hover:bg-ink-50 hover:border-ink-300 focus-visible:ring-ink-400",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:ring-red-500",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  dark: "bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-700",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.98]",
        variants[variant], sizes[size], className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
