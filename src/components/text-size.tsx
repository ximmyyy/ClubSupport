"use client";

import { useEffect, useState } from "react";
import { cn } from "./ui";

const KEY = "clubsupport:tekstgrootte";
const SIZES = [
  { id: "normaal", label: "Normaal", scale: "100%", sample: "text-sm" },
  { id: "groot", label: "Groot", scale: "112.5%", sample: "text-base" },
  { id: "extra", label: "Extra groot", scale: "125%", sample: "text-lg" },
] as const;
type SizeId = (typeof SIZES)[number]["id"];

function read(): SizeId {
  try {
    const v = window.localStorage.getItem(KEY);
    if (SIZES.some((s) => s.id === v)) return v as SizeId;
  } catch {
    /* ignore */
  }
  return "normaal";
}

function apply(id: SizeId) {
  // Everything is sized in rem, so the root font size scales the whole app.
  document.documentElement.style.fontSize = SIZES.find((s) => s.id === id)!.scale;
}

/** Applies the saved text size as soon as the app loads. */
export function ApplyTextSize() {
  useEffect(() => apply(read()), []);
  return null;
}

/** Three-step text size switch ("A A A") for people who want larger text. */
export function TextSizeControl({ dark }: { dark?: boolean }) {
  const [size, setSize] = useState<SizeId>(read);
  const choose = (id: SizeId) => {
    setSize(id);
    apply(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };
  return (
    <div>
      <p className={cn("mb-1.5 text-sm font-semibold", dark ? "text-brand-100" : "text-stone-800")}>Tekstgrootte</p>
      <div className={cn("inline-flex rounded-xl p-1", dark ? "bg-white/10" : "bg-stone-200/70")} role="radiogroup" aria-label="Tekstgrootte">
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={size === s.id}
            aria-label={s.label}
            title={s.label}
            onClick={() => choose(s.id)}
            className={cn(
              "flex h-11 w-12 items-center justify-center rounded-lg font-bold transition-colors sm:h-9",
              s.sample,
              size === s.id ? (dark ? "bg-white text-brand-950" : "bg-white text-stone-900 shadow-sm") : dark ? "text-brand-100/80 hover:text-white" : "text-stone-600 hover:text-stone-900",
            )}
          >
            A
          </button>
        ))}
      </div>
    </div>
  );
}
