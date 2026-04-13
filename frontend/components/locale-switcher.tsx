"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Locale } from "@/lib/types";

type Props = {
  locale: Locale;
  label: string;
  onLocaleChange?: (locale: Locale) => void;
};

export function LocaleSwitcher({ locale, label, onLocaleChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setLocale(nextLocale: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLocale);
    window.localStorage.setItem("gamebuddy:locale", nextLocale);
    onLocaleChange?.(nextLocale);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 p-1 shadow-card">
      <span className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">{label}</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-2 text-sm font-semibold ${locale === "en" ? "bg-ink text-white" : "text-ink"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`rounded-full px-3 py-2 text-sm font-semibold ${locale === "zh" ? "bg-ink text-white" : "text-ink"}`}
      >
        中文
      </button>
    </div>
  );
}
