import { Hero } from "@/components/home/Hero";
import { PositionNav } from "@/components/home/PositionNav";
import { DraftClasses } from "@/components/home/DraftClasses";
import { getProspects } from "@/lib/googleSheets";

export default async function HomePage() {
  const prospects = await getProspects();

  return (
    <main>
      <Hero />
      <PositionNav />
      <DraftClasses prospects={prospects} />
    </main>
  );
}
