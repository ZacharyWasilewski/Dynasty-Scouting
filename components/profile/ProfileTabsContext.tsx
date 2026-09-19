"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ProfileTabId = "overview" | "progression" | "comps" | "draft";

interface ProfileTabsValue {
  activeTab: ProfileTabId;
  setActiveTab: (id: ProfileTabId) => void;
}

const ProfileTabsContext = createContext<ProfileTabsValue | null>(null);

const TAB_TARGET_IDS: Record<ProfileTabId, string> = {
  overview: "overview",
  progression: "class-progression",
  comps: "similar-prospects",
  draft: "draft-projection",
};

/**
 * Wraps the whole player-profile page. Lets the quick-nav pills in
 * ProfileHeader (Overview / Progression / Comps / Draft) and the
 * actual section content in ModelScoresSection / the similar-players
 * panel / DraftProjection — three separate components, rendered at
 * different points in app/players/[id]/page.tsx — agree on which one
 * is "active" on mobile, without threading that state through props
 * across files that otherwise have no reason to know about each
 * other. Only matters on small screens: see ProfileTabPanel for the
 * desktop behavior (always shown, this state has no effect there).
 *
 * Always starts server- and client-render at "overview", then swaps
 * on mount if the URL's hash names a different tab (e.g. a direct
 * link to /players/x#similar-prospects, used elsewhere on the site).
 * Reading location.hash straight into the initial state would've
 * been simpler, but the server never sees a URL fragment at all — an
 * SSR render always assumes "overview," so seeding the client's very
 * first render with a different value from the hash produces a
 * hydration mismatch. Deferring the hash check to an effect costs a
 * one-frame flash to the right tab on a deep link, in exchange for a
 * clean hydration on every normal visit (the overwhelming majority).
 */
export function ProfileTabsProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>("overview");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const match = (Object.entries(TAB_TARGET_IDS) as [ProfileTabId, string][]).find(([, targetId]) => targetId === hash);
    if (match) setActiveTab(match[0]);
    // Intentionally only on mount — this seeds the initial tab from
    // a deep link; it shouldn't re-fire and fight the user's own
    // subsequent tab clicks just because the hash also changes as a
    // side effect of InPageAnchor's scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ProfileTabsContext.Provider value={{ activeTab, setActiveTab }}>{children}</ProfileTabsContext.Provider>;
}

export function useProfileTabs(): ProfileTabsValue {
  const ctx = useContext(ProfileTabsContext);
  if (!ctx) throw new Error("useProfileTabs must be used within a ProfileTabsProvider");
  return ctx;
}
