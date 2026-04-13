"use client";

import Link from "next/link";

import { translations } from "@/lib/content";
import type { AnalysisResponse, Locale } from "@/lib/types";

type Props = {
  result: AnalysisResponse | null;
  locale: Locale;
};

export function AnalysisPanel({ result, locale }: Props) {
  const t = translations[locale];

  if (!result) {
    return (
      <div className="rounded-3xl border border-dashed border-ink/20 bg-white/50 p-8 text-sm text-ink/65">
        {t.emptyResult}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink p-6 text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.24em] text-gold/80">{t.summary}</p>
        <h3 className="mt-3 text-2xl font-semibold">{result.summary}</h3>
        <p className="mt-4 text-sm text-white/75">{result.beginner_explanation}</p>
      </div>

      <div className="rounded-3xl border border-amber-200/40 bg-[linear-gradient(135deg,#fff8ea_0%,#fffdf6_100%)] p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember">Direction prediction</p>
            <h4 className="mt-2 text-2xl font-semibold text-ink">{result.direction_prediction.current_phase}</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-pine shadow-card">
            {result.direction_prediction.confidence}
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">Best direction</p>
            <p className="mt-2 text-base text-ink/90">{result.direction_prediction.best_direction}</p>
            <p className="mt-3 text-sm text-ink/65">{result.direction_prediction.why_now}</p>
          </article>
          <article className="rounded-3xl bg-[#fff3ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">Avoid this line</p>
            <p className="mt-2 text-base text-ink/90">{result.direction_prediction.avoid_direction}</p>
          </article>
        </div>
      </div>

      <div className="grid gap-4">
        {result.tactical_advice.map((item) => (
          <article key={item.title} className="rounded-3xl border border-ink/10 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-ink">{item.title}</h4>
              <span className="rounded-full bg-mist px-3 py-1 text-xs uppercase tracking-[0.18em] text-pine">
                {item.confidence}
              </span>
            </div>
            <p className="mt-3 text-base text-ink/85">{item.recommendation}</p>
            <p className="mt-2 text-sm text-ink/60">{item.reasoning}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-ink/10 bg-white p-5 shadow-card">
          <h4 className="text-lg font-semibold text-ink">{t.risks}</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/70">
            {result.risks_or_uncertainties.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-ink/10 bg-white p-5 shadow-card">
          <h4 className="text-lg font-semibold text-ink">{t.nextSteps}</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/70">
            {result.next_steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <Link
        href={`/review?lang=${locale}`}
        className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine/90"
      >
        {t.openReview}
      </Link>
    </div>
  );
}
