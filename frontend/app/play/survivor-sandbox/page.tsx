import { SurvivorSandbox } from "@/components/survivor-sandbox";
import type { Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function SurvivorSandboxPage({ searchParams }: Props) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  return <SurvivorSandbox initialLocale={locale} />;
}
