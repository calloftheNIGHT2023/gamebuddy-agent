"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { translations } from "@/lib/content";
import type { AnalysisResponse, Locale } from "@/lib/types";

type Props = {
  initialLocale: Locale;
};

export function ReviewClient({ initialLocale }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem("gamebuddy:last-result");
    const params = new URLSearchParams(window.location.search);
    const queryLocale = params.get("lang");
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (stored) {
      setResult(JSON.parse(stored) as AnalysisResponse);
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
      <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-card">
        <p className="text-ink/70">{t.noReview}</p>
        <Link href={`/?lang=${locale}`} className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          {t.returnHome}
        </Link>
      </div>
    );
  }

  const report = result.review_report;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LocaleSwitcher locale={locale} label={t.langLabel} onLocaleChange={setLocale} />
      </div>
      <div className="rounded-3xl bg-ink p-8 text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.24em] text-gold/80">{t.reviewTitle}</p>
        <h1 className="mt-3 text-3xl font-semibold">{result.summary}</h1>
        <p className="mt-4 max-w-3xl text-sm text-white/75">{report.current_situation}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-ink">{t.likelyMistakes}</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink/75">
            {report.likely_mistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-ink">{t.recommendedActions}</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink/75">
            {report.recommended_actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-ink">{t.longerTerm}</h2>
        <ul className="mt-4 space-y-2 text-sm text-ink/75">
          {report.longer_term_improvement.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
