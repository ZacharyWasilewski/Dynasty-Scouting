import { SavedMockDraftDetail } from "@/components/mockDrafts/SavedMockDraftDetail";

export const metadata = {
  title: "Saved Mock Draft — Dynasty Database",
};

export default function SavedMockDraftPage({ params }: { params: { id: string } }) {
  return <SavedMockDraftDetail id={params.id} />;
}
