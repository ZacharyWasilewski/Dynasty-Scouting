"use client";

import type { ReactNode } from "react";
import { useProfileTabs, type ProfileTabId } from "@/components/profile/ProfileTabsContext";

/**
 * On sm+ (tablet/desktop) this is `display: contents` — completely
 * inert, children render exactly as if this wrapper weren't there —
 * so desktop keeps the full, always-visible, information-rich
 * profile layout untouched, anchor jumps and all.
 *
 * On mobile it shows its children only when this id matches the
 * ProfileTabsContext's active tab (set by the quick-nav pills in
 * ProfileHeader), turning that existing "Overview / Progression /
 * Comps / Draft" nav — previously just scroll-to-anchor links with a
 * permanently-stuck "active" highlight — into a real tab switcher:
 * the answer for whichever category the user tapped, not a forced
 * scroll through all four.
 */
export function ProfileTabPanel({ id, children }: { id: ProfileTabId; children: ReactNode }) {
  const { activeTab } = useProfileTabs();
  const isActive = activeTab === id;

  return <div className={isActive ? "sm:contents" : "hidden sm:contents"}>{children}</div>;
}
