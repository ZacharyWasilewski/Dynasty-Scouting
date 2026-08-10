import { Layers } from "lucide-react";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { DraftClasses } from "@/components/home/DraftClasses";
import { getProspects } from "@/lib/googleSheets";

export const metadata = {
  title: "Draft Classes — Dynasty Database",
};

export default async function ClassesPage() {
  const prospects = await getProspects();

  return (
    <main>
      <SectionIntro
        icon={Layers}
        eyebrow="Draft Classes"
        title="Every class, since 2015."
        description="Every incoming dynasty relevant rookie class, graded and ranked."
      />
      <DraftClasses prospects={prospects} />
    </main>
  );
}
