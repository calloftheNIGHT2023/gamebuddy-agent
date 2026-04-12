"use client";

import { ChangeEvent, FormEvent, useState } from "react";

import { analyzeScreenshot, analyzeState } from "@/lib/api";
import type { AnalysisResponse, BattleState } from "@/lib/types";

type Props = {
  initialStateText: string;
  onResult: (result: AnalysisResponse) => void;
};

export function StateForm({ initialStateText, onResult }: Props) {
  const [question, setQuestion] = useState("What should I do next?");
  const [mode, setMode] = useState<"json" | "screenshot">("json");
  const [jsonText, setJsonText] = useState(initialStateText);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result: AnalysisResponse;

      if (mode === "json") {
        const parsed = JSON.parse(jsonText) as BattleState;
        result = await analyzeState(question, parsed);
      } else {
        if (!file) {
          throw new Error("Choose a screenshot file first.");
        }
        result = await analyzeScreenshot(question, file);
      }

      window.localStorage.setItem("gamebuddy:last-result", JSON.stringify(result));
      onResult(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
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
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode("json")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "json" ? "bg-ink text-white" : "bg-mist text-ink"}`}
        >
          Paste Game State
        </button>
        <button
          type="button"
          onClick={() => setMode("screenshot")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "screenshot" ? "bg-ink text-white" : "bg-mist text-ink"}`}
        >
          Upload Screenshot
        </button>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">Question</label>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
        />
      </div>

      {mode === "json" ? (
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Battle state JSON</label>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            rows={18}
            className="w-full rounded-3xl border border-ink/10 bg-[#f7fbfd] px-4 py-4 font-mono text-sm text-ink outline-none"
          />
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Screenshot</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full rounded-2xl border border-dashed border-ink/20 bg-mist px-4 py-6 text-sm text-ink/70"
          />
          <p className="mt-2 text-xs text-ink/55">The MVP uses an honest placeholder perception layer for screenshots.</p>
        </div>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:bg-ember/90 disabled:opacity-60"
      >
        {loading ? "Analyzing..." : "Generate Advice"}
      </button>
    </form>
  );
}
