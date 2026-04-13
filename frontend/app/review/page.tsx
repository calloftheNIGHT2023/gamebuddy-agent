import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ReviewClient } from "@/components/review-client";
import { translations } from "@/lib/content";
import type { Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function ReviewPage({ searchParams }: Props) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  const t = translations[locale];

  return (
    <main className="min-h-screen px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine">GameBuddy Agent</p>
          <h1 className="mt-2 font-display text-4xl text-ink">{t.reviewTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} label={t.langLabel} />
          <Link href={`/?lang=${locale}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">
            {t.reviewBack}
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl">
        <ReviewClient initialLocale={locale} />
      </div>
    </main>
  );
}
