import Link from "next/link";

import { ReviewClient } from "@/components/review-client";

export default function ReviewPage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine">GameBuddy Agent</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Review report</h1>
        </div>
        <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">
          New analysis
        </Link>
      </div>
      <div className="mx-auto max-w-6xl">
        <ReviewClient />
      </div>
    </main>
  );
}
