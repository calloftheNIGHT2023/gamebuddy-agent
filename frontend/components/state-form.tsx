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
        if (!privateAccess) throw new Error("公网截图分析需要管理员访问。请在 Agent Ops 输入有效令牌，或使用 JSON 局势分析。");
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
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-card backdrop-blur"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">{t.gameLabel}</label>
          <select
            value={game}
            onChange={(event) => onGameChange(event.target.value as GameKey)}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          >
            {Object.entries(gameOptions).map(([key, label]) => (
              <option key={key} value={key}>
                {label[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">{t.questionLabel}</label>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode("json")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "json" ? "bg-ink text-white" : "bg-mist text-ink"}`}
        >
          {t.formTabs.json}
        </button>
        <button
          type="button"
          onClick={() => setMode("screenshot")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "screenshot" ? "bg-ink text-white" : "bg-mist text-ink"}`}
        >
          {t.formTabs.screenshot}
        </button>
      </div>

      {mode === "json" ? (
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">{t.jsonLabel}</label>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            rows={18}
            className="w-full rounded-3xl border border-ink/10 bg-[#f7fbfd] px-4 py-4 font-mono text-sm text-ink outline-none"
          />
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">{t.screenshotLabel}</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full rounded-2xl border border-dashed border-ink/20 bg-mist px-4 py-6 text-sm text-ink/70"
          />
          <p className="mt-2 text-xs text-ink/55">{t.screenshotHelp}</p>
          <p className="mt-2 text-xs leading-6 text-ink/65">公网截图入口需要<Link href="/ops" className="font-semibold text-pine underline">管理员令牌</Link>。截图感知仍是演示占位：按所选游戏使用样例局势，不会真实识别图片。</p>
        </div>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || (mode === "screenshot" && !privateAccess)}
        className="inline-flex rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:bg-ember/90 disabled:opacity-60"
      >
        {loading ? t.loading : t.submit}
      </button>
    </form>
  );
}
