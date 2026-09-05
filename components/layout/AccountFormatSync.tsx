"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Mounted once at the root layout. When the user is logged in, pulls
 * their saved account format preference for compatibility, but deliberately
 * does not apply it as the site-wide default. The product default is always
 * Superflex + Standard; individual page state is restored only when the
 * browser Back/Forward returns to that page. Runs once per login, not on every
 * navigation (this component itself never unmounts).
 */
export function AccountFormatSync() {
  const { user } = useAuth();
  const syncedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || syncedForUserId.current === user.id) return;
    syncedForUserId.current = user.id;
    fetch("/api/preferences/format")
      .then((res) => res.json())
      .then((data: { format: string | null }) => {
        // The site-wide default is intentionally fixed to Superflex + Standard.
        // Do not apply a saved account format globally here: page-level format
        // state is restored only on genuine browser Back/Forward navigation,
        // while fresh navigation always starts from the site default.
        void data;
      })
      .catch(() => {});
  }, [user]);

  return null;
}
