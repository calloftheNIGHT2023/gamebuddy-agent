import Image from "next/image";
import { readFileSync } from "fs";
import path from "path";

import HomeClient from "@/components/home-client";
import { PromptList } from "@/components/prompt-list";

export default function Home() {
  const samplePath = path.join(process.cwd(), "..", "samples", "game-states", "balanced-position.json");
  const initialStateText = readFileSync(samplePath, "utf-8");

  return (
    <main className="px-6 py-8 md:px-10 lg:px-16">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-pine backdrop-blur">
              Open-source gaming coach
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-tight text-ink md:text-6xl">
                GameBuddy Agent turns battle snapshots into clear coaching.
              </h1>
              <p className="max-w-2xl text-lg text-ink/72">
                A GitHub-ready AI companion for strategy guidance, beginner explanations, and post-game review.
                The MVP focuses on a Pokemon-style turn-based battle demo with honest screenshot parsing stubs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-ink/70">
              <span className="rounded-full bg-white/80 px-4 py-2 shadow-card">FastAPI backend</span>
              <span className="rounded-full bg-white/80 px-4 py-2 shadow-card">Next.js + Tailwind frontend</span>
              <span className="rounded-full bg-white/80 px-4 py-2 shadow-card">Modular multi-agent architecture</span>
            </div>
            <PromptList />
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-card backdrop-blur">
            <Image
              src="/demo/placeholder-battle.svg"
              alt="Placeholder battle screenshot"
              width={900}
              height={650}
              className="h-auto w-full rounded-[1.5rem]"
            />
            <p className="px-3 py-4 text-sm text-ink/60">
              Replace this placeholder in <code>frontend/public/demo/placeholder-battle.svg</code> with your own screenshot for a polished showcase.
            </p>
          </div>
        </div>
      </section>

      <HomeClient initialStateText={initialStateText} />
    </main>
  );
}
