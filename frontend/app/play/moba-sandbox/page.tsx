import { MobaSandbox } from "@/components/moba-sandbox";
import type { Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function MobaSandboxPage({ searchParams }: Props) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  return <MobaSandbox initialLocale={locale} />;
}
