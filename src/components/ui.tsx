"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Shared UI ported from our earlier v1.2 prototype
 * (hotelapp-v1.2/src/components/ui/index.tsx) — D1 / ANT-37.
 * Same look (colors, sizes, radii, shadows); only the pieces this app
 * uses, without the v1.2 fake-data store. Icons: lucide-react, as in v1.2.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------- Button ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: BtnProps) {
  const v = {
    primary:
      "bg-brand-700 text-white hover:bg-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,.12)]",
    dark: "bg-ink text-white hover:bg-ink-2",
    secondary: "bg-white text-ink border border-line hover:border-ink-4 hover:bg-canvas",
    ghost: "text-ink-2 hover:bg-ink/5",
    danger: "bg-white text-dirty-deep border border-dirty/30 hover:bg-dirty-soft",
  }[variant];
  const s = {
    // Tap targets are at least 44px on phones (U1); desktop keeps v1.2 sizes.
    sm: "h-11 px-3 text-[13px] gap-1.5 rounded-lg sm:h-8",
    md: "h-11 px-4 text-sm gap-2 rounded-lg sm:h-10",
    lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  }[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:shadow-ring",
        v,
        s,
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------- Form ----------
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">{label}</span>
      {children}
      {error ? (
        <span className="block text-[12.5px] text-dirty-deep mt-1.5">{error}</span>
      ) : hint ? (
        <span className="block text-[12.5px] text-ink-3 mt-1.5">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "w-full h-11 sm:h-10 px-3 rounded-lg border border-line bg-white text-sm text-ink placeholder:text-ink-4 transition focus:outline-none focus:border-brand-500 focus:shadow-ring aria-[invalid=true]:border-dirty";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...p }, ref) => (
  <input ref={ref} {...p} className={cx(inputCls, className)} />
));
Input.displayName = "Input";

export function PasswordInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...p} type={show ? "text" : "password"} className={cx(inputCls, "pr-10", p.className)} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-1 top-1/2 -translate-y-1/2 size-11 sm:size-7 grid place-items-center rounded-md text-ink-4 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export const Textarea = ({
  className,
  ...p
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, "h-auto py-2.5 min-h-[88px] resize-y", className)} />
);

// ---------- Display ----------
export function Card({
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  const c = className || "";
  const bg = /(^|\s)bg-/.test(c) ? "" : "bg-white";
  return (
    <div {...p} className={cx(bg, "border border-line rounded-xl2 shadow-card", c)}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  action,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub && <p className="text-[13px] text-ink-3 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-canvas text-ink-2 ring-line",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  brass: "bg-brass-soft text-brass-deep ring-brass/25",
  occ: "bg-occ-soft text-occ-deep ring-occ/25",
  ready: "bg-ready-soft text-ready-deep ring-ready/25",
  dirty: "bg-dirty-soft text-dirty-deep ring-dirty/25",
  clean: "bg-clean-soft text-clean-deep ring-clean/25",
  insp: "bg-insp-soft text-insp-deep ring-insp/25",
  ooo: "bg-ooo-soft text-ooo-deep ring-ooo/25",
};

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: string;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[12px] font-semibold ring-1 ring-inset whitespace-nowrap",
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Role colors from the v1.2 prototype (ROLE_HUE), keyed by our role/department names. */
const ROLE_HUE: Record<string, string> = {
  owner: "#0B434C",
  supervisor: "#5A3DB8",
  housekeeping: "#12704A",
  cleaner: "#12704A",
  maintenance: "#A9253D",
  front_desk: "#14808F",
  frontdesk: "#14808F",
  room_service: "#B4436B",
  roomservice: "#B4436B",
};

export const roleHue = (role: string) => ROLE_HUE[role] || "#465160";

export function Avatar({
  name,
  role,
  size = 32,
  className,
}: {
  name: string;
  role?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cx("inline-grid place-items-center shrink-0 rounded-full text-white font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: role ? roleHue(role) : "#465160",
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="text-sm text-ink-3 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** One page-title pattern everywhere (U1): clear title, one-line help, optional actions. */
export function PageHeader({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13.5px] text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Brand: Readybell (B1 / ANT-58) ----------
/** Small bell mark (public/brand). Used in the MOCK banner, QR cards, footers. */
export function BrandMark({ size = 20, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/readybell-mark.svg" alt="" width={size} height={size} className={className} aria-hidden />;
}

export function Logo({ light, small, stacked, markOnly, responsiveMark }: { light?: boolean; small?: boolean; stacked?: boolean; markOnly?: boolean; responsiveMark?: boolean }) {
  if (stacked) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/readybell-logo-stacked.svg" alt="Readybell" width={180} height={128} className="h-28 w-auto max-w-full" />;
  }
  if (markOnly) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/readybell-mark.svg" alt="Readybell" width={32} height={32} className="size-8" />;
  }
  const src = light ? "/brand/readybell-logo-on-dark.svg" : "/brand/readybell-logo.svg";
  const full = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Readybell" width={160} height={32} className={small ? "h-6 w-auto" : "h-7 w-auto"} />
  );
  if (responsiveMark) {
    return (
      <span className="inline-flex items-center">
        <span className="sm:hidden"><BrandMark size={30} /></span>
        <span className="hidden sm:inline-flex">{full}</span>
      </span>
    );
  }
  return <span className="inline-flex items-center">{full}</span>;
}

/** Tiny footer line for the guest page (B1). */
export function PoweredByReadybell() {
  return (
    <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-4">
      <BrandMark size={14} /> Powered by <span className="font-semibold text-ink-3">Readybell</span>
    </p>
  );
}
