"use client";

import { useState } from "react";

import { AnalysisPanel } from "@/components/analysis-panel";
import { StateForm } from "@/components/state-form";
import type { AnalysisResponse } from "@/lib/types";

type Props = {
  initialStateText: string;
};

export default function HomeClient({ initialStateText }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  return (
    <section className="mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <StateForm initialStateText={initialStateText} onResult={setResult} />
      <AnalysisPanel result={result} />
    </section>
  );
}
