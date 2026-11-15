"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { addDays, cap, formatDate, todayISO } from "@/lib/time";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        size === "sm" ? "h-8 px-2.5 text-sm" : "h-10 px-3.5 text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "secondary" && "border border-stone-200 bg-white text-stone-800 shadow-sm hover:bg-stone-50",
        variant === "ghost" && "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    />
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-brand-600">{icon}</div>}
        <div>
          <h2 className="font-semibold text-stone-900">{title}</h2>
          {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color, soft, className }: { children: React.ReactNode; color?: string; soft?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", !color && "bg-stone-100 text-stone-700", className)}
      style={color ? { backgroundColor: soft ?? `${color}22`, color: "#1c1917" } : undefined}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn("animate-pop max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Sluiten">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "pr-8", props.className)} />;
}

export function Segmented<T extends string | number>({ value, options, onChange, size = "md" }: {
  value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DateNavigator({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === todayISO();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
      <button onClick={() => onChange(addDays(value, -1))} className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100" aria-label="Vorige dag">
        <ChevronLeft size={18} />
      </button>
      <label className="relative cursor-pointer px-2 text-sm font-semibold text-stone-800">
        {cap(formatDate(value, { long: true }))}
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Kies datum"
        />
      </label>
      <button onClick={() => onChange(addDays(value, 1))} className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100" aria-label="Volgende dag">
        <ChevronRight size={18} />
      </button>
      {!isToday && (
        <button onClick={() => onChange(todayISO())} className="rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
          Vandaag
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-600">{icon}</div>
      <p className="font-semibold text-stone-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone = "default" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone?: "default" | "warn" | "good";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <div className={cn("rounded-lg p-1.5", tone === "warn" ? "bg-red-50 text-red-600" : tone === "good" ? "bg-brand-50 text-brand-600" : "bg-stone-100 text-stone-600")}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
    </Card>
  );
}
