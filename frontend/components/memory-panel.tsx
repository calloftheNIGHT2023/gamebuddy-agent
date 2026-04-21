"use client";

import { useEffect, useState } from "react";

import { getAnalysisHistory, getUserProfile, saveUserProfile } from "@/lib/api";
import type { AnalysisHistoryItem, Locale, UserProfile } from "@/lib/types";

type Props = {
  locale: Locale;
  profile: UserProfile;
  sessionId: string;
  onProfileChange: (profile: UserProfile) => void;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function MemoryPanel({ locale, profile, sessionId, onProfileChange }: Props) {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.user_id) {
      setHistory([]);
      return;
    }

    let active = true;
    setLoadingHistory(true);
    getAnalysisHistory({ userId: profile.user_id, sessionId, limit: 6 })
      .then((items) => {
        if (active) {
          setHistory(items);
        }
      })
      .catch(() => {
        if (active) {
          setHistory([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [profile.user_id, sessionId]);

  async function handleSaveProfile() {
    if (!profile.user_id) {
      setMessage(locale === "zh" ? "请先填写 user id。" : "Add a user id first.");
      return;
    }

    setSavingProfile(true);
    setMessage(null);
    try {
      const saved = await saveUserProfile(profile);
      onProfileChange(saved);
      setMessage(locale === "zh" ? "画像已保存。" : "Profile saved.");
    } catch {
      setMessage(locale === "zh" ? "保存画像失败。" : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLoadProfile() {
    if (!profile.user_id) {
      setMessage(locale === "zh" ? "请先填写 user id。" : "Add a user id first.");
      return;
    }

    setMessage(null);
    try {
      const loaded = await getUserProfile(profile.user_id);
      if (!loaded) {
        setMessage(locale === "zh" ? "未找到画像记录。" : "No saved profile found.");
        return;
      }
      onProfileChange({
        ...loaded,
        goals: loaded.goals ?? [],
        notes: loaded.notes ?? [],
      });
      setMessage(locale === "zh" ? "画像已载入。" : "Profile loaded.");
    } catch {
      setMessage(locale === "zh" ? "载入画像失败。" : "Failed to load profile.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/78 p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ember">Memory</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">
            {locale === "zh" ? "个人偏好与历史" : "Profile and history"}
          </h3>
        </div>
        <span className="rounded-full bg-mist px-3 py-1 text-xs text-ink/70">{sessionId}</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">User ID</span>
          <input
            value={profile.user_id}
            onChange={(event) => onProfileChange({ ...profile, user_id: event.target.value })}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "显示名称" : "Display name"}</span>
          <input
            value={profile.display_name ?? ""}
            onChange={(event) => onProfileChange({ ...profile, display_name: event.target.value || null })}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "水平" : "Skill level"}</span>
          <select
            value={profile.skill_level ?? "intermediate"}
            onChange={(event) =>
              onProfileChange({ ...profile, skill_level: event.target.value as UserProfile["skill_level"] })
            }
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          >
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "回复风格" : "Response style"}</span>
          <select
            value={profile.preferred_style ?? "balanced"}
            onChange={(event) =>
              onProfileChange({ ...profile, preferred_style: event.target.value as UserProfile["preferred_style"] })
            }
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          >
            <option value="concise">concise</option>
            <option value="balanced">balanced</option>
            <option value="detailed">detailed</option>
          </select>
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "常玩定位" : "Favorite role"}</span>
          <input
            value={profile.favorite_role ?? ""}
            onChange={(event) => onProfileChange({ ...profile, favorite_role: event.target.value || null })}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "常用角色" : "Favorite character"}</span>
          <input
            value={profile.favorite_character ?? ""}
            onChange={(event) => onProfileChange({ ...profile, favorite_character: event.target.value || null })}
            className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-ink/75">
        <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "目标" : "Goals"}</span>
        <input
          value={profile.goals.join(", ")}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              goals: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          className="w-full rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-ink outline-none"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingProfile ? (locale === "zh" ? "保存中..." : "Saving...") : locale === "zh" ? "保存画像" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={handleLoadProfile}
          className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-ink"
        >
          {locale === "zh" ? "载入画像" : "Load profile"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-ink/68">{message}</p> : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-semibold text-ink">{locale === "zh" ? "最近历史" : "Recent history"}</h4>
          {loadingHistory ? <span className="text-xs text-ink/55">{locale === "zh" ? "加载中..." : "Loading..."}</span> : null}
        </div>
        <div className="mt-3 grid gap-3">
          {history.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/15 bg-mist p-4 text-sm text-ink/60">
              {locale === "zh" ? "还没有可展示的历史记录。" : "No history available yet."}
            </div>
          ) : (
            history.map((item) => (
              <article key={`${item.created_at}-${item.question}`} className="rounded-3xl bg-mist p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{item.question}</p>
                  <span className="text-xs text-ink/55">{formatTimestamp(item.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-ink/68">{item.response.summary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-pine">{item.game}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
