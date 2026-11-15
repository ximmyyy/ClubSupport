export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#13794d" />
      <rect x="6" y="9" width="20" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.6" />
      <line x1="16" y1="9" x2="16" y2="23" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <rect x="6" y="9" width="10" height="7" fill="#6fc89b" opacity="0.9" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-stone-900"}`}>
        Club<span className={light ? "text-brand-300" : "text-brand-600"}>Support</span>
      </span>
    </span>
  );
}
