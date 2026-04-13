import { RpgBuildLab } from "@/components/rpg-build-lab";
import type { Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function RpgBuildLabPage({ searchParams }: Props) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  return <RpgBuildLab initialLocale={locale} />;
}
