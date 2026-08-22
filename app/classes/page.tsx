import { getProspects } from "@/lib/googleSheets";
import { DraftClasses } from "@/components/home/DraftClasses";

export const revalidate = 60;

export const metadata = {
  title: "Draft Classes — Dynasty Database",
};

export default async function ClassesPage() {
  const prospects = await getProspects();

  // DraftClasses already renders its own complete heading section
  // (eyebrow, title, description) — it's shared with the homepage,
  // where it needs one. This page used to also render a separate
  // SectionIntro with the exact same text directly above it, so the
  // heading appeared twice in a row. That's what "the page to get to
  // each class is redundant" meant literally, not just a design
  // opinion — it was a real duplicate-content bug.
  return (
    <main>
      <DraftClasses prospects={prospects} />
    </main>
  );
}
