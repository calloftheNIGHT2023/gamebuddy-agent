"use client";

// 分析结果面板，用于展示总结、方向判断和复盘信息。
import Link from "next/link";
import { useState } from "react";

import { saveFeedback } from "@/lib/api";
import { translations } from "@/lib/content";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
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
  const { health } = useConnectionStatus();
  const { hasToken } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;

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
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : locale === "zh" ? "反馈保存失败。" : "Failed to save feedback.");
    } finally {
      setSavingFeedback(false);
    }
  }

  if (!result) {
    // 还没有结果时，展示空状态占位。
    return (
      <div className="gb-panel flex min-h-[280px] flex-col justify-between border-dashed p-6">
        <div className="flex items-center justify-between border-b border-ink/20 pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65"><span>{locale === "zh" ? "战局简报" : "Match report"}</span><span>OUTPUT / 02</span></div>
        <div className="py-8"><span aria-hidden="true" className="font-display text-6xl text-ink/15">—</span><p className="mt-4 max-w-md text-sm leading-7 text-ink/65">{t.emptyResult}</p></div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember">{locale === "zh" ? "等待提交局势" : "Awaiting your situation"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 顶部摘要区：先给用户一句整体判断，再给初学者解释。 */}
      <div className="border border-ink bg-ink text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/20 px-5 py-3"><p className="font-mono text-xs uppercase tracking-[0.14em] text-gold">{t.summary}</p><span className="font-mono text-[10px] tracking-[0.12em] text-white/50">REPORT / 02</span></div>
        <div className="p-5 sm:p-6"><h3 className="whitespace-pre-line text-2xl font-semibold leading-relaxed">{result.summary}</h3><p className="mt-5 whitespace-pre-line border-l border-gold pl-4 text-sm leading-7 text-white/75">{result.beginner_explanation}</p></div>
      </div>

      {/* 阶段判断区：这是后端的 direction_prediction，可视为“现在最该朝哪个方向处理”。 */}
      <section className="gb-panel overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-ink/20 bg-gold/35 p-5">
          <div>
            <p className="gb-kicker">{locale === "zh" ? "方向判断" : "Direction prediction"}</p>
            <h4 className="mt-2 text-xl font-semibold leading-relaxed text-ink">{result.direction_prediction.current_phase}</h4>
          </div>
          <span className="shrink-0 border border-ink/35 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
            {result.direction_prediction.confidence}
          </span>
        </div>
        <div className="grid lg:grid-cols-2">
          <article className="p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">↗ {locale === "zh" ? "优先方向" : "Best direction"}</p>
            <p className="mt-3 text-base leading-7 text-ink/90">{result.direction_prediction.best_direction}</p>
            <p className="mt-3 text-sm leading-7 text-ink/65">{result.direction_prediction.why_now}</p>
          </article>
          <article className="border-t border-ink/20 bg-mist p-5 lg:border-l lg:border-t-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ember">× {locale === "zh" ? "避免路线" : "Avoid this line"}</p>
            <p className="mt-3 text-base leading-7 text-ink/90">{result.direction_prediction.avoid_direction}</p>
          </article>
        </div>
      </section>

      {/* 战术建议列表：逐条渲染后端返回的 tactical_advice。 */}
      {result.tactical_advice.length > 0 && <section className="gb-panel">
        <div className="border-b border-ink/20 px-5 py-3"><p className="gb-kicker">{locale === "zh" ? "战术笔记" : "Tactical notes"}</p></div>
        <div className="divide-y divide-ink/20">{result.tactical_advice.map((item, index) => (
          <article key={item.title} className="grid gap-3 p-5 sm:grid-cols-[2.5rem_1fr]">
            <span aria-hidden="true" className="font-mono text-2xl font-semibold text-ember">{String(index + 1).padStart(2, "0")}</span>
            <div><div className="flex items-start justify-between gap-3"><h4 className="text-base font-semibold leading-7 text-ink">{item.title}</h4><span className="border-b border-ink/35 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/65">{item.confidence}</span></div><p className="mt-2 text-sm leading-7 text-ink/85">{item.recommendation}</p><p className="mt-2 text-sm leading-7 text-ink/65">{item.reasoning}</p></div>
          </article>
        ))}</div>
      </section>}

      {/* 风险与下一步：把“不确定性”和“可执行动作”并排展示，便于用户快速消化。 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="gb-panel p-5">
          <h4 className="border-b border-ink/20 pb-3 text-base font-semibold text-ink">{t.risks}</h4>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-ink/70">
            {result.risks_or_uncertainties.map((item) => (
              <li key={item} className="flex gap-3"><span aria-hidden="true" className="font-mono text-ember">!</span><span>{item}</span></li>
            ))}
          </ul>
        </section>
        <section className="gb-panel p-5">
          <h4 className="border-b border-ink/20 pb-3 text-base font-semibold text-ink">{t.nextSteps}</h4>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-ink/70">
            {result.next_steps.map((item, index) => (
              <li key={item} className="flex gap-3"><span aria-hidden="true" className="font-mono text-ember">{index + 1}.</span><span>{item}</span></li>
            ))}
          </ol>
        </section>
      </div>

      {/* 跳转到 review 页面，查看更偏复盘视角的完整内容。 */}
      <Link
        href={`/review?lang=${locale}`}
        className="gb-button inline-flex items-center gap-6 border-ink bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember"
      >
        {t.openReview}<span aria-hidden="true">↗</span>
      </Link>

      <section className="gb-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="gb-kicker">{locale === "zh" ? "编辑批注" : "Editor's annotations"}</p>
            <h4 className="mt-2 text-base font-semibold text-ink">
              {locale === "zh" ? "回答质量回溯" : "Response quality feedback"}
            </h4>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingFeedback || !privateAccess}
              onClick={() => handleFeedback("up")}
              className="gb-button border-ink bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {locale === "zh" ? "有用" : "Useful"}
            </button>
            <button
              type="button"
              disabled={savingFeedback || !privateAccess}
              onClick={() => handleFeedback("down")}
              className="gb-button border-ink bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {locale === "zh" ? "需改进" : "Needs work"}
            </button>
          </div>
        </div>
        {!privateAccess && <p className="mt-4 border-l-2 border-ember pl-3 text-xs leading-6 text-ink/65">{locale === "zh" ? <>公开演示不保存匿名反馈。请到<Link href="/ops" className="font-semibold text-ink underline underline-offset-4">管理员入口</Link>登录后标注回答。</> : <>Anonymous feedback is not saved. Sign in through <Link href="/ops" className="font-semibold text-ink underline underline-offset-4">administrator access</Link> to annotate a response.</>}</p>}
        <label htmlFor="analysis-correction" className="sr-only">{locale === "zh" ? "修正意见" : "Response correction"}</label>
        <textarea
          id="analysis-correction"
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          rows={3}
          placeholder={locale === "zh" ? "可选：写下更理想的回答方向或修正意见" : "Optional: describe a better answer or correction"}
          className="gb-field mt-4 w-full bg-mist px-4 py-3 text-sm text-ink"
        />
        {feedbackStatus ? <p role="status" className="mt-3 text-sm leading-7 text-ink/65">{feedbackStatus}</p> : null}
      </section>
    </div>
  );
}
