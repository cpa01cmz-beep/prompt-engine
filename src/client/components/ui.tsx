import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

import { cn } from "./utils";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

const INPUT_BASE =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25";

const LABEL_BASE = "block text-sm font-medium leading-none text-slate-700";

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  inset = false,
  className = "",
  children,
}: {
  inset?: boolean;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        inset
          ? "rounded-2xl border border-slate-200 bg-slate-50 p-5"
          : "rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6",
        "transition-colors",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
  secondary: "bg-slate-600 text-white shadow-sm hover:bg-slate-700",
  tertiary: "border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
  lg: "px-5 py-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}): JSX.Element {
  return (
    <button
      type={props.type ?? "button"}
      {...props}
      aria-busy={props["aria-busy"] ?? (loading || undefined)}
      disabled={props.disabled ?? (loading || undefined)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
        FOCUS_RING,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? "Working…" : children}
    </button>
  );
}


/* ------------------------- Labeled controls helpers ------------------------ */

function describedByFor(id: string, hint?: string | undefined): string | undefined {
  return hint ? `${id}-hint` : undefined;
}

/* ----------------------------- Status messaging ---------------------------- */

type AlertTone = "error" | "success" | "info" | "warning";

const ALERT_TONES: Record<AlertTone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const ALERT_ICONS: Record<AlertTone, string> = {
  error: "bg-rose-500/10 text-rose-600",
  success: "bg-emerald-500/10 text-emerald-600",
  info: "bg-sky-500/10 text-sky-600",
  warning: "bg-amber-500/10 text-amber-600",
};

const ALERT_GLYPHS: Record<AlertTone, string> = {
  error: "!",
  success: "+",
  info: "i",
  warning: "!",
};

export function Alert({
  role = "status",
  tone = "info",
  title,
  description,
  children,
  className = "",
}: {
  role?: "status" | "alert";
  tone?: AlertTone;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
      className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", ALERT_TONES[tone], className)}
    >
      <span
        aria-hidden="true"
        className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", ALERT_ICONS[tone])}
      >
        {ALERT_GLYPHS[tone]}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {description ? <p className="opacity-90">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ message, className }: { message: string | null; className?: string }): JSX.Element | null {
  if (!message) return null;
  return <Alert tone="error" title="Error" className={className}>{message}</Alert>;
}

export function SuccessText({ message, className }: { message: string | null; className?: string }): JSX.Element | null {
  if (!message) return null;
  return <Alert tone="success" title="Success" className={className}>{message}</Alert>;
}

/* ----------------------------- Loading states ------------------------------ */

export function Spinner({ className = "" }: { className?: string }): JSX.Element {
  return (
    <svg className={cn("h-5 w-5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label, className = "" }: { label?: string; className?: string }): JSX.Element {
  const text = label ?? "Loading…";
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-2 text-sm text-slate-600", className)}>
      <Spinner className="h-4 w-4 text-indigo-600" />
      <span>{text}</span>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }): JSX.Element {
  return <div aria-hidden="true" {...props} className={cn("animate-pulse rounded-lg bg-slate-200/80", className)} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }): JSX.Element {
  const widths = ["w-3/4", "w-full", "w-5/6", "w-2/3"];
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_unused, index) => (
        <Skeleton key={index} className={cn("h-4", widths[index % widths.length])} />
      ))}
    </div>
  );
}

export function ResultPanel({
  title = "Result",
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section aria-label={title} className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

/* ------------------------------ Chip / Stats ------------------------------- */

type ChipTone = "slate" | "indigo" | "emerald" | "rose" | "amber";

const CHIP_TONES: Record<ChipTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-800",
};

export function Chip({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}): JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", CHIP_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-center", className)}>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {children}
    </div>
  );
}

/* ----------------------------- Labeled controls ---------------------------- */

export function Input({
  label,
  hint,
  required,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  required?: boolean;
}): JSX.Element {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL_BASE}>
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-rose-500">*</span> : null}
      </label>
      <input
        {...props}
        id={id}
        required={required}
        aria-describedby={describedByFor(id, hint)}
        className={cn(INPUT_BASE, className)}
      />
      {hint ? <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  required,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  required?: boolean;
}): JSX.Element {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL_BASE}>
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-rose-500">*</span> : null}
      </label>
      <textarea
        {...props}
        id={id}
        required={required}
        aria-describedby={describedByFor(id, hint)}
        className={cn(INPUT_BASE, "resize-y leading-relaxed", className)}
      />
      {hint ? <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------- Field ------------------------------------- */

export function Field({
  id,
  label,
  hint,
  required = false,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: (attributes: {
    id: string;
    required?: boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span
        id={`${id}-label`}
        className="block text-sm font-medium leading-none text-slate-700"
      >
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children({
        id,
        required: required || undefined,
        "aria-describedby": describedByFor(id, hint),
      })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
