"use client";

// 复盘客户端组件，负责从本地缓存恢复分析结果并渲染详情。
import Link from "next/link";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { translations } from "@/lib/content";
import { isLocalPage } from "@/lib/api-client";
import type { AnalysisResponse, Locale } from "@/lib/types";

type Props = {
  initialLocale: Locale;
};

export function ReviewClient({ initialLocale }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("gamebuddy:last-result") || (isLocalPage() ? window.localStorage.getItem("gamebuddy:last-result") : null);
    const params = new URLSearchParams(window.location.search);
    const queryLocale = params.get("lang");
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (stored) {
      try { setResult(JSON.parse(stored) as AnalysisResponse); }
      catch { window.sessionStorage.removeItem("gamebuddy:last-result"); }
    }
    if (queryLocale === "en" || queryLocale === "zh") {
      setLocale(queryLocale);
    } else if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
  }, []);

  const t = translations[locale];

  if (!result) {
    return (
      <section className="border-y border-ink/30 bg-white px-6 py-12 md:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/65">REVIEW FILE / EMPTY</p>
        <h2 className="mt-5 text-2xl font-black">{locale === "zh" ? "还没有复盘记录" : "No match review yet"}</h2>
        <p className="mt-4 text-sm leading-7 text-ink/65">{t.noReview}</p>
        <Link href={`/?lang=${locale}`} className="mt-7 inline-flex items-center gap-5 border-b border-ink pb-1 text-xs font-bold">{t.returnHome}<span aria-hidden="true">↗</span></Link>
      </section>
    );
  }

  const report = result.review_report;
  const sections = [
    { number: "01", title: t.likelyMistakes, label: "WHAT TO CHECK", items: report.likely_mistakes },
    { number: "02", title: t.recommendedActions, label: "NEXT SESSION", items: report.recommended_actions },
    { number: "03", title: t.longerTerm, label: "LONG GAME", items: report.longer_term_improvement },
  ];

  return (
    <article className="border border-ink/30 bg-[#f7f6f1]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/30 px-5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65">REVIEW NOTES / {String(result.metadata.game_title ?? result.metadata.game ?? "GAMEBUDDY")}</p>
        <LocaleSwitcher locale={locale} label={t.langLabel} onLocaleChange={setLocale} />
      </div>
      <section className="grid gap-5 border-b border-ink/30 bg-white p-6 md:grid-cols-[125px_minmax(0,1fr)] md:p-8">
        <div><p className="font-mono text-[10px] text-[#d34524]">00 / OVERVIEW</p><h2 className="mt-3 text-sm font-bold">{t.reviewTitle}</h2></div>
        <div className="min-w-0"><p className="max-w-4xl whitespace-pre-wrap text-lg font-semibold leading-8 tracking-tight text-ink">{result.summary}</p><p className="mt-6 max-w-3xl border-l-2 border-[#f05a32] pl-4 text-xs leading-7 text-ink/65">{report.current_situation}</p></div>
      </section>
      {sections.map((section) => <section key={section.number} className="grid border-b border-ink/25 last:border-b-0 md:grid-cols-[190px_minmax(0,1fr)]">
        <header className={`border-b border-ink/20 p-6 md:border-b-0 md:border-r ${section.number === "02" ? "bg-[#e5f36a]" : ""}`}><p className="font-mono text-[10px] text-ink/65">{section.number} / {section.label}</p><h3 className="mt-3 text-lg font-bold">{section.title}</h3></header>
        <ol className="divide-y divide-ink/20 bg-white">
          {section.items.length === 0 ? <li className="px-6 py-7 text-xs text-ink/65">{locale === "zh" ? "暂无记录。" : "No entries in this record."}</li> : section.items.map((item, index) => <li key={`${item}-${index}`} className="grid grid-cols-[25px_minmax(0,1fr)] gap-3 px-6 py-5"><span className="pt-1 font-mono text-[10px] text-ink/65">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-7 text-ink/80">{item}</p></li>)}
        </ol>
      </section>)}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/30 px-5 py-3 text-[10px] text-ink/65"><span>GAMEBUDDY / REVIEW FILE</span><Link href={`/assistant?lang=${locale}`} className="border-b border-ink/50 pb-0.5 font-semibold text-ink">{locale === "zh" ? "继续提问" : "Ask another question"} ↗</Link></footer>
    </article>
  );
}
