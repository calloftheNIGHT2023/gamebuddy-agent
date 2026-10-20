"use client";

// 语言切换器，同时同步 URL 参数和本地存储中的语言偏好。
import type { Locale } from "@/lib/types";

type Props = {
  locale: Locale;
  label: string;
  onLocaleChange?: (locale: Locale) => void;
};

export function LocaleSwitcher({ locale, label, onLocaleChange }: Props) {
  function setLocale(nextLocale: Locale) {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", nextLocale);
    window.localStorage.setItem("gamebuddy:locale", nextLocale);
    onLocaleChange?.(nextLocale);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
  }

  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 items-stretch border border-ink bg-white">
      <span className="hidden items-center px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/65 sm:inline-flex">{label}</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`border-ink px-3 py-2 font-mono text-xs font-semibold transition-colors sm:border-l ${locale === "en" ? "bg-gold text-ink" : "text-ink hover:bg-mist"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
        className={`border-l border-ink px-3 py-2 text-xs font-semibold transition-colors ${locale === "zh" ? "bg-gold text-ink" : "text-ink hover:bg-mist"}`}
      >
        中文
      </button>
    </div>
  );
}
