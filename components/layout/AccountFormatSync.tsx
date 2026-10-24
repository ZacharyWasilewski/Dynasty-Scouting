"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GLOBAL_FORMAT_EVENT, isValidFormat } from "@/lib/globalFormat";

/**
 * Mounted once at the root layout. When the user is logged in, pulls their
 * saved account format and adopts it only if this browser has no saved
 * preference yet (a choice made on this device always wins). Explicit
 * ?format= URLs still override both on the page they point at.
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
        if (!isValidFormat(data.format)) return;
        try {
          if (localStorage.getItem("dd_global_format")) return;
          localStorage.setItem("dd_global_format", data.format);
          window.dispatchEvent(new CustomEvent(GLOBAL_FORMAT_EVENT, { detail: data.format }));
        } catch {
          // storage unavailable: nothing to sync into
        }
      })
      .catch(() => {});
  }, [user]);

  return null;
}
