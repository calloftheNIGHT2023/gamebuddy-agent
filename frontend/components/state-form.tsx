"use client";

// 分析表单组件，负责收集问题、状态和截图并调用后端接口。
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { analyzeScreenshot, analyzeState } from "@/lib/api";
import { gameOptions, promptSets, translations } from "@/lib/content";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import type { AnalysisResponse, GameKey, GameState, Locale, UserProfile } from "@/lib/types";

type Props = {
  locale: Locale;
  game: GameKey;
  samples: Record<GameKey, string>;
  sessionId: string;
  userProfile: UserProfile;
  onGameChange: (game: GameKey) => void;
  onResult: (result: AnalysisResponse) => void;
};

export function StateForm({ locale, game, samples, sessionId, userProfile, onGameChange, onResult }: Props) {
  const t = translations[locale];
  const [question, setQuestion] = useState(promptSets[game][locale][0]);
  const [mode, setMode] = useState<"json" | "screenshot">("json");
  const [jsonText, setJsonText] = useState(samples[game]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { health } = useConnectionStatus();
  const { hasToken } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;

  useEffect(() => {
    setJsonText(samples[game]);
    setQuestion(promptSets[game][locale][0]);
  }, [game, locale, samples]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result: AnalysisResponse;

      if (mode === "json") {
        const parsed = JSON.parse(jsonText) as GameState;
        result = await analyzeState(game, question, parsed, privateAccess ? { sessionId, userProfile } : undefined);
      } else {
        if (!privateAccess) throw new Error(locale === "zh" ? "导入图片需要管理员访问，也可直接填写局势。" : "Importing images requires administrator access. You can enter the game state instead.");
        if (!file) {
          throw new Error(t.chooseFile);
        }
        result = await analyzeScreenshot(game, question, file, { sessionId, userProfile });
      }

      try { window.sessionStorage.setItem("gamebuddy:last-result", JSON.stringify(result)); } catch { /* Keep displaying successful results if storage is unavailable. */ }
      window.localStorage.setItem("gamebuddy:locale", locale);
      onResult(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return (
    <form onSubmit={handleSubmit} className="gb-panel overflow-hidden" aria-busy={loading}>
      <div className="flex items-center justify-between gap-4 border-b border-ink bg-ink px-5 py-3 text-white">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">{locale === "zh" ? "局势分析" : "Game state"}</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">INPUT / 01</span>
      </div>

      <div className="grid gap-5 border-b border-ink/20 p-5 md:grid-cols-2">
        <div>
          <label htmlFor="state-game" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span className="font-mono text-xs text-ember">01</span>{t.gameLabel}</label>
          <select
            id="state-game"
            value={game}
            onChange={(event) => onGameChange(event.target.value as GameKey)}
            className="gb-field w-full"
          >
            {Object.entries(gameOptions).map(([key, label]) => (
              <option key={key} value={key}>
                {label[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="state-question" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span className="font-mono text-xs text-ember">02</span>{t.questionLabel}</label>
          <input
            id="state-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="gb-field w-full"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 bg-mist px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em]"><span className="mr-2 font-mono text-ember">03</span>{locale === "zh" ? "局势信息" : "Game state"}</p>
        <div className="inline-flex items-center gap-3" role="group" aria-label={locale === "zh" ? "输入方式" : "Input mode"}>
          <button type="button" onClick={() => setMode("json")} aria-pressed={mode === "json"} className={`border border-ink px-3 py-2 text-xs font-semibold transition-colors ${mode === "json" ? "bg-ink text-white" : "bg-white text-ink hover:bg-gold/30"}`}>
            {t.formTabs.json}
          </button>
          <button type="button" onClick={() => setMode("screenshot")} aria-pressed={mode === "screenshot"} className={`border-b px-1 py-1 text-xs transition-colors ${mode === "screenshot" ? "border-ink font-bold text-ink" : "border-transparent text-ink/65 hover:border-ink hover:text-ink"}`}>
            {t.formTabs.screenshot}
          </button>
        </div>
      </div>

      {mode === "json" ? (
        <div className="p-5">
          <label htmlFor="state-json" className="mb-3 block text-sm font-semibold text-ink">{t.jsonLabel}</label>
          <textarea
            id="state-json"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            rows={18}
            spellCheck={false}
            className="gb-field w-full resize-y bg-mist px-4 py-4 font-mono text-xs leading-6 text-ink sm:text-sm"
          />
          <div className="mt-2 flex justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65"><span>JSON / {jsonText.split("\n").length} {locale === "zh" ? "行" : "lines"}</span><span>{locale === "zh" ? "提交时校验" : "Validated on submit"}</span></div>
        </div>
      ) : (
        <div className="p-5">
          <label htmlFor="state-screenshot" className="mb-3 block text-sm font-semibold text-ink">{t.screenshotLabel}</label>
          <input
            id="state-screenshot"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full border border-dashed border-ink/40 bg-mist px-4 py-6 text-sm text-ink/70 file:mr-4 file:border file:border-ink file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink"
          />
          <p className="mt-3 text-xs leading-6 text-ink/65">{t.screenshotHelp}</p>
          <p className="mt-3 border-l-2 border-ember pl-3 text-xs leading-6 text-ink/70">{locale === "zh" ? <>导入图片需<Link href="/ops" className="font-semibold text-ink underline underline-offset-4">管理员令牌</Link>。</> : <>Importing images requires an <Link href="/ops" className="font-semibold text-ink underline underline-offset-4">administrator token</Link>.</>}</p>
        </div>
      )}

      {error ? <p role="alert" className="mx-5 mb-5 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/20 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65">{mode === "json" ? "STATE → ANALYSIS" : "IMAGE / SAMPLE STATE"}</p>
        <button type="submit" disabled={loading || (mode === "screenshot" && !privateAccess)} className="gb-button inline-flex items-center gap-5 border-ink bg-ember px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60">
          {loading ? t.loading : mode === "screenshot" ? (locale === "zh" ? "查看样例分析" : "Analyze sample state") : t.submit}<span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
