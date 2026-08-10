import { Info } from "lucide-react";
import { SectionIntro } from "@/components/layout/SectionIntro";

export default function AboutPage() {
  return (
    <main>
      <SectionIntro
        icon={Info}
        eyebrow="About"
        title="Analytical grades, built for dynasty."
        description="Dynasty Database is an independent dynasty rookie analytics project, grading every incoming dynasty relevant rookie since 2015 with a consistent, data-driven model."
      />
    </main>
  );
}
