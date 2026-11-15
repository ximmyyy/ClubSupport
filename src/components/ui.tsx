"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, cap, formatDate, todayISO, WEEKDAYS_SHORT, weekdayOf } from "@/lib/time";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "destructive";
  size?: "sm" | "md";
};

/** Touch targets are at least 44px high on phones; denser on desktop. */
export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "min-h-11 px-3.5 py-1.5 text-sm sm:min-h-9 sm:px-3" : "min-h-12 px-4 py-2 text-base sm:min-h-10 sm:px-3.5 sm:text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
        variant === "secondary" && "border border-stone-300 bg-white text-stone-800 shadow-sm hover:bg-stone-50 active:bg-stone-100",
        variant === "ghost" && "text-stone-700 hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200",
        variant === "danger" && "border border-red-300 bg-white text-red-700 hover:bg-red-50 active:bg-red-100",
        variant === "destructive" && "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
        className,
      )}
    />
  );
}

/** Square icon-only button with a comfortable touch target. Always pass a label for screen readers. */
export function IconButton({ label, tone = "neutral", className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "neutral" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-9 sm:w-9",
        tone === "danger" ? "text-stone-500 hover:bg-red-50 hover:text-red-600" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                             */
/* ------------------------------------------------------------------ */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-brand-600">{icon}</div>}
        <div>
          <h2 className="text-lg font-semibold text-stone-900 sm:text-base">{title}</h2>
          {subtitle && <p className="text-sm text-stone-600">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color, soft, className }: { children: React.ReactNode; color?: string; soft?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap sm:px-2 sm:py-0.5", !color && "bg-stone-100 text-stone-700", className)}
      style={color ? { backgroundColor: soft ?? `${color}22`, color: "#1c1917" } : undefined}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wider text-brand-700 uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal: bottom sheet on phones, centred dialog on larger screens      */
/* ------------------------------------------------------------------ */

let scrollLocks = 0;
let lockedScrollY = 0;

/** Freeze the page behind a dialog. iOS otherwise scrolls the page to the top when an input gets focus. */
function lockScroll() {
  if (scrollLocks++ > 0) return;
  lockedScrollY = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${lockedScrollY}px`;
  b.left = "0";
  b.right = "0";
}

function unlockScroll() {
  if (--scrollLocks > 0) return;
  const b = document.body.style;
  b.position = "";
  b.top = "";
  b.left = "";
  b.right = "";
  window.scrollTo(0, lockedScrollY);
}

export function Modal({ open, onClose, title, children, footer, wide, cancelLabel = "Annuleren", hideCancel }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  cancelLabel?: string;
  hideCancel?: boolean;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    lockScroll();

    // On touch screens, do not pop up the keyboard right away: focus the dialog itself.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const first = touch ? null : dialog.current?.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=radio]), select, textarea");
    (first ?? dialog.current)?.focus({ preventScroll: true });

    // Keep the sheet inside the visible area when the on-screen keyboard opens.
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv || !overlay.current) return;
      overlay.current.style.height = `${vv.height}px`;
      overlay.current.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    fit();

    return () => {
      window.removeEventListener("keydown", onKey);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      unlockScroll();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={overlay} className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center bg-stone-950/50 sm:items-center sm:p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onFocus={(e) => {
          // Scroll the field the user tapped into view once the keyboard is up
          const el = e.target as HTMLElement;
          if (el.matches("input, select, textarea")) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
        }}
        className={cn(
          "animate-sheet flex max-h-[94%] w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[90%] sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 py-3 pr-3 pl-5">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 sm:text-lg">{title}</h2>
          <IconButton label="Sluiten" onClick={onClose}><X size={22} /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {(footer || !hideCancel) && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-stone-100 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            {!hideCancel && <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                        */
/* ------------------------------------------------------------------ */

export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base font-medium text-stone-800 sm:mb-1 sm:text-sm">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-stone-600 sm:text-xs">{hint}</span>}
    </label>
  );
}

/**
 * 16px text on phones: iOS zooms the whole page in when a focused field has smaller text.
 * `compact` only tightens the height on desktop; phones always get a 48px target.
 */
export function fieldClass(compact?: boolean) {
  return cn(
    "w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500 sm:text-sm",
    compact ? "h-12 sm:h-9" : "h-12 sm:h-10",
  );
}

type FieldSize = { compact?: boolean };

export function Input({ compact, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & FieldSize) {
  return <input {...props} className={cn(fieldClass(compact), className)} />;
}

export function Select({ compact, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & FieldSize) {
  return <select {...props} className={cn(fieldClass(compact), "pr-8", className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-stone-300 bg-white p-3 text-base text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none sm:text-sm",
        className,
      )}
    />
  );
}

/**
 * Text or number field that keeps its own draft and only reports the value when the user
 * leaves the field (or presses Enter). Avoids saving on every keystroke.
 */
export function CommitInput({ value, onCommit, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & FieldSize & {
  value: string | number;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== String(value)) onCommit(draft);
    setDraft(null);
  };
  return (
    <Input
      {...props}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Checkbox({ label, hint, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base text-stone-800 sm:min-h-0 sm:py-1 sm:text-sm", className)}>
      <input type="checkbox" {...props} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600 sm:h-4 sm:w-4" />
      <span>
        {label}
        {hint && <span className="block text-sm text-stone-600 sm:text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = "md", className }: {
  value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md"; className?: string;
}) {
  return (
    <div className={cn("scrollbar-none inline-flex max-w-full overflow-x-auto rounded-xl bg-stone-200/70 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 rounded-lg font-semibold whitespace-nowrap transition-colors",
            size === "sm" ? "min-h-9 px-2.5 text-sm sm:min-h-7 sm:text-xs" : "min-h-10 px-3.5 text-base sm:min-h-8 sm:px-3 sm:text-sm",
            value === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
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
    <div className="flex w-full items-center gap-1 rounded-2xl border border-stone-300 bg-white p-1 shadow-sm sm:w-auto">
      <IconButton label="Vorige dag" onClick={() => onChange(addDays(value, -1))}><ChevronLeft size={22} /></IconButton>
      <label className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-base font-semibold text-stone-900 hover:bg-stone-50 sm:min-h-9 sm:text-sm">
        <CalendarDays size={18} className="hidden shrink-0 text-brand-600 min-[400px]:block" />
        <span className="whitespace-nowrap sm:hidden">{cap(WEEKDAYS_SHORT[weekdayOf(value) - 1])} {formatDate(value, { long: true, weekday: false })}</span>
        <span className="hidden whitespace-nowrap sm:inline">{cap(formatDate(value, { long: true }))}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Kies een datum"
        />
      </label>
      <IconButton label="Volgende dag" onClick={() => onChange(addDays(value, 1))}><ChevronRight size={22} /></IconButton>
      {!isToday && (
        <button type="button" onClick={() => onChange(todayISO())} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:min-h-9">
          Vandaag
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-600">{icon}</div>
      <p className="text-lg font-semibold text-stone-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-stone-600">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone = "default", onClick }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone?: "default" | "warn" | "good"; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <div className={cn("shrink-0 rounded-lg p-1.5", tone === "warn" ? "bg-red-50 text-red-600" : tone === "good" ? "bg-brand-50 text-brand-600" : "bg-stone-100 text-stone-600")}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-stone-600">{sub}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md">
      {body}
    </button>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}
