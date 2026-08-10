import { Hero } from "@/components/home/Hero";
import { ModelOverview } from "@/components/home/ModelOverview";
import { PositionNav } from "@/components/home/PositionNav";
import { DraftClasses } from "@/components/home/DraftClasses";
import { DashboardStats } from "@/components/analytics/DashboardStats";
import { Container } from "@/components/layout/Container";
import { getProspects } from "@/lib/googleSheets";

export default async function HomePage() {
  const prospects = await getProspects();

  return (
    <main>
      <Hero />
      <section className="border-b border-border bg-void py-10">
        <Container>
          <DashboardStats prospects={prospects} />
        </Container>
      </section>
      <ModelOverview />
      <PositionNav />
      <DraftClasses prospects={prospects} />
    </main>
  );
}
