"use client";

// 分析结果面板，用于展示总结、方向判断和复盘信息。
import Link from "next/link";
import { useState } from "react";

import { saveFeedback } from "@/lib/api";
import { translations } from "@/lib/content";
import type { AnalysisResponse, FeedbackRating, Locale, UserProfile } from "@/lib/types";

type Props = {
  result: AnalysisResponse | null;
  locale: Locale;
  sessionId: string;
  userProfile: UserProfile;
};

export function AnalysisPanel({ result, locale, sessionId, userProfile }: Props) {
  const t = translations[locale];
  const [correction, setCorrection] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);

  async function handleFeedback(rating: FeedbackRating) {
    if (!result) {
      return;
    }
    const game = String(result.metadata.game ?? "pokemon-battle-demo") as "pokemon-battle-demo" | "moba-postmatch-demo" | "rpg-build-demo";
    const question = String(result.metadata.question ?? "");
    setSavingFeedback(true);
    setFeedbackStatus(null);
    try {
      await saveFeedback({
        game,
        question,
        response: result,
        rating,
        session_id: sessionId,
        user_id: userProfile.user_id || undefined,
        user_profile: userProfile.user_id ? userProfile : null,
        correction: correction.trim() || null,
        tags: correction.trim() ? ["user-correction"] : [],
      });
      setFeedbackStatus(locale === "zh" ? "反馈已保存，可用于后续 SFT / 偏好数据整理。" : "Feedback saved for later SFT / preference data export.");
    } catch {
      setFeedbackStatus(locale === "zh" ? "反馈保存失败。" : "Failed to save feedback.");
    } finally {
      setSavingFeedback(false);
    }
  }

  if (!result) {
    // 还没有结果时，展示空状态占位。
    return (
      <div className="rounded-3xl border border-dashed border-ink/20 bg-white/50 p-8 text-sm text-ink/65">
        {t.emptyResult}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部摘要区：先给用户一句整体判断，再给初学者解释。 */}
      <div className="rounded-3xl bg-ink p-6 text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.24em] text-gold/80">{t.summary}</p>
        <h3 className="mt-3 text-2xl font-semibold">{result.summary}</h3>
        <p className="mt-4 text-sm text-white/75">{result.beginner_explanation}</p>
      </div>

      {/* 阶段判断区：这是后端的 direction_prediction，可视为“现在最该朝哪个方向处理”。 */}
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

      {/* 战术建议列表：逐条渲染后端返回的 tactical_advice。 */}
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

      {/* 风险与下一步：把“不确定性”和“可执行动作”并排展示，便于用户快速消化。 */}
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

      {/* 跳转到 review 页面，查看更偏复盘视角的完整内容。 */}
      <Link
        href={`/review?lang=${locale}`}
        className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine/90"
      >
        {t.openReview}
      </Link>

      <section className="rounded-3xl border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">Feedback loop</p>
            <h4 className="mt-2 text-lg font-semibold text-ink">
              {locale === "zh" ? "回答质量回溯" : "Response quality feedback"}
            </h4>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingFeedback}
              onClick={() => handleFeedback("up")}
              className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {locale === "zh" ? "有用" : "Useful"}
            </button>
            <button
              type="button"
              disabled={savingFeedback}
              onClick={() => handleFeedback("down")}
              className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {locale === "zh" ? "需改进" : "Needs work"}
            </button>
          </div>
        </div>
        <textarea
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          rows={3}
          placeholder={locale === "zh" ? "可选：写下更理想的回答方向或修正意见" : "Optional: describe a better answer or correction"}
          className="mt-4 w-full rounded-3xl border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none"
        />
        {feedbackStatus ? <p className="mt-3 text-sm text-ink/65">{feedbackStatus}</p> : null}
      </section>
    </div>
  );
}
