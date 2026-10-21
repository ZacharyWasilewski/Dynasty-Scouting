import { getProspects } from "@/lib/googleSheets";
import { ClassesIndex } from "@/components/classes/ClassesIndex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Draft Classes, Dynasty Database",
};

export default async function ClassesPage() {
  const prospects = await getProspects();
  return <ClassesIndex prospects={prospects} />;
}
