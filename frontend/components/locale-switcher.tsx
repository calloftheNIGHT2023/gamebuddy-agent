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
