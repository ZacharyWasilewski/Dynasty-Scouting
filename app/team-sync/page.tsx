import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { TeamSyncContent } from "@/components/teamSync/TeamSyncContent";

export const metadata = {
  title: "Team Sync, Dynasty Database",
  description: "Link your Sleeper league to get draft recommendations based on your team's actual needs.",
};

export default function TeamSyncPage() {
  return (
    <main className="py-10">
      <Container>
        <SectionHeading
          eyebrow="Beta"
          title="Team Sync"
          size="hero"
          description="Link a Sleeper league to see your roster's positional depth and get future-draft recommendations targeted at your actual needs."
        />
        <div className="mt-8">
          <TeamSyncContent />
        </div>
      </Container>
    </main>
  );
}
