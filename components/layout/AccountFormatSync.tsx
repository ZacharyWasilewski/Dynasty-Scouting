"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isValidFormat } from "@/lib/globalFormat";

/**
 * Mounted once at the root layout. When the user is logged in, pulls
 * their saved account format preference and writes it into the same
 * localStorage key every page reads — closing the one real gap in
 * the localStorage-first design: a brand new device (or a fresh
 * login after clearing storage) won't have the right value until
 * this resolves and the next page mounts. Runs once per login, not
 * on every navigation (this component itself never unmounts).
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
        if (isValidFormat(data.format)) {
          try {
            localStorage.setItem("dd_global_format", data.format);
          } catch {
            // Private browsing / storage disabled — nothing to do;
            // the account is still the source of truth for next time
            // storage is available.
          }
        }
      })
      .catch(() => {});
  }, [user]);

  return null;
}
