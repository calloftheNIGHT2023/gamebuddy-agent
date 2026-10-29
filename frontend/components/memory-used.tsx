"use client";

const labels: Record<string, string> = { display_name: "称呼", skill_level: "熟练度", preferred_style: "回答风格", favorite_role: "常玩定位", favorite_character: "常用角色", goals: "练习目标", notes: "个人备注" };
const values: Record<string, string> = { beginner: "新手", intermediate: "熟悉", advanced: "熟练", concise: "简短", balanced: "适中", detailed: "详细" };

export function MemoryUsed({ metadata }: { metadata: Record<string, unknown> }) {
  const memory = metadata.memory as { items?: { id: string; content: string; reason?: string }[]; episodes?: { id: string; content: string; created_at: string }[]; profile_fields?: Record<string, string | string[]>; saved?: { content?: string }; recorded_episode_id?: string } | undefined;
  if (!memory) return null;
  const fields = Object.entries(memory.profile_fields ?? {}).filter(([key]) => key in labels);
  const count = fields.length + (memory.items?.length ?? 0) + (memory.episodes?.length ?? 0);
  if (!count && !memory.saved && !memory.recorded_episode_id) return null;
  return <details className="mt-5 border-y border-ink/20 py-3 text-xs leading-6">
    <summary className="cursor-pointer font-bold">{memory.saved ? "已记下这件事" : count ? `这次用到的记忆 · ${count}` : "这局复盘已记下"}</summary>
    {memory.saved?.content && <p className="mt-3">{memory.saved.content}</p>}
    {memory.recorded_episode_id && <p className="mt-3">这局的结果已存入玩家记忆，保留 30 天。</p>}
    {fields.map(([key, value]) => <p key={key} className="mt-2"><b>{labels[key]}：</b>{Array.isArray(value) ? value.join("；") : values[value] ?? value}</p>)}
    {memory.items?.map((item) => <p key={item.id} className="mt-3"><span className="mr-2 text-ink/60">{item.reason ?? "个人提醒"}</span>{item.content}</p>)}
    {memory.episodes?.map((item) => <p key={item.id} className="mt-3"><span className="mr-2 text-ink/60">{item.created_at.slice(0, 10)} 的对局</span>{item.content}</p>)}
  </details>;
}
