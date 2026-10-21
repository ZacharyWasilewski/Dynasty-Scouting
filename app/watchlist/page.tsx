import { getProspects } from "@/lib/googleSheets";
import { WatchlistContent } from "@/components/watchlist/WatchlistContent";

// The server-fetched prospect data here is public and identical for
// every visitor — the user's actual saved watchlist is loaded
// client-side inside WatchlistContent, not here.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Watchlist, Dynasty Database",
  description: "Players you've saved to your Dynasty Database account.",
};

export default async function WatchlistPage() {
  const prospects = await getProspects();
  return <WatchlistContent prospects={prospects} />;
}
