"use client";

// 首页客户端容器，负责串联表单、结果面板和记忆面板。
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AnalysisPanel } from "@/components/analysis-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MemoryPanel } from "@/components/memory-panel";
import { PromptList } from "@/components/prompt-list";
import { StateForm } from "@/components/state-form";
import { promptSets, translations } from "@/lib/content";
import type { AnalysisResponse, GameKey, Locale, UserProfile } from "@/lib/types";

type Props = {
  samples: Record<GameKey, string>;
  initialLocale: Locale;
};

const DEFAULT_PROFILE: UserProfile = {
  user_id: "",
  display_name: null,
  skill_level: "intermediate",
  preferred_style: "balanced",
  favorite_role: null,
  favorite_character: null,
  goals: [],
  notes: [],
};

function buildSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

export default function HomeClient({ samples, initialLocale }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [game, setGame] = useState<GameKey>("pokemon-battle-demo");
  const [sessionId, setSessionId] = useState("session-loading");
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryLocale = params.get("lang");
    if (queryLocale === "en" || queryLocale === "zh") {
      setLocale(queryLocale);
      return;
    }
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    window.localStorage.setItem("gamebuddy:locale", locale);
  }, [locale]);

  useEffect(() => {
    const storedSessionId = window.localStorage.getItem("gamebuddy:session-id");
    const nextSessionId = storedSessionId || buildSessionId();
    window.localStorage.setItem("gamebuddy:session-id", nextSessionId);
    setSessionId(nextSessionId);

    const storedProfile = window.localStorage.getItem("gamebuddy:user-profile");
    if (!storedProfile) {
      return;
    }
    try {
      const parsed = JSON.parse(storedProfile) as UserProfile;
      setUserProfile({ ...DEFAULT_PROFILE, ...parsed, goals: parsed.goals ?? [], notes: parsed.notes ?? [] });
    } catch {
      setUserProfile(DEFAULT_PROFILE);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gamebuddy:user-profile", JSON.stringify(userProfile));
  }, [userProfile]);

  const t = translations[locale];

  return (
    <main className="px-6 py-8 md:px-10 lg:px-16">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher locale={locale} label={t.langLabel} onLocaleChange={setLocale} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-pine backdrop-blur">
              {t.badge}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-tight text-ink md:text-6xl">{t.title}</h1>
              <p className="max-w-2xl text-lg text-ink/72">{t.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-ink/70">
              {t.chips.map((chip) => (
                <span key={chip} className="rounded-full bg-white/80 px-4 py-2 shadow-card">
                  {chip}
                </span>
              ))}
            </div>
            <div className="rounded-[1.8rem] border border-pine/10 bg-white/80 p-5 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">{t.playTitle}</p>
              <p className="mt-2 text-sm text-ink/68">{t.playBody}</p>
              <Link href={`/play?lang=${locale}`} className="mt-4 inline-flex rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white">
                {t.playCta}
              </Link>
            </div>
            <PromptList title={t.promptsTitle} prompts={promptSets[game][locale]} />
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-card backdrop-blur">
            <Image
              src="/demo/placeholder-battle.svg"
              alt="Placeholder battle screenshot"
              width={900}
              height={650}
              className="h-auto w-full rounded-[1.5rem]"
            />
            <p className="px-3 py-4 text-sm text-ink/60">{t.imageNote}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl">
        <div className="rounded-[2rem] border border-white/60 bg-white/78 p-6 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ember">{t.logTitle}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {t.logEntries.map((entry, index) => (
              <article key={`${entry}-${index}`} className="rounded-[1.4rem] bg-mist p-4 text-sm text-ink/78">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">Update {String(index + 1).padStart(2, "0")}</p>
                <p className="mt-2">{entry}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <StateForm
          locale={locale}
          game={game}
          samples={samples}
          sessionId={sessionId}
          userProfile={userProfile}
          onGameChange={setGame}
          onResult={setResult}
        />
        <AnalysisPanel result={result} locale={locale} />
      </section>

      <section className="mx-auto mt-10 max-w-7xl">
        <MemoryPanel locale={locale} profile={userProfile} sessionId={sessionId} onProfileChange={setUserProfile} />
      </section>
    </main>
  );
}
