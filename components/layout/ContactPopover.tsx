"use client";

import { useState } from "react";
import { X, Mail } from "@/components/ui/SiteIcons";

const CONTACT_EMAIL = "dynastydatabase@gmail.com";

export function ContactPopover() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-ink-secondary transition-colors hover:text-ink"
      >
        Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm border border-border-strong bg-surface p-6 shadow-xl sm:p-8">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-ink-tertiary transition-colors duration-150 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-accent">
              <Mail className="h-4 w-4" strokeWidth={1.75} />
              <span className="font-mono text-xs uppercase tracking-widest2">Contact</span>
            </div>

            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-4 block font-mono text-lg font-semibold text-ink hover:text-accent"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
