"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { ContactPopover } from "@/components/layout/ContactPopover";

const FOOTER_COLUMNS = [
  { title: "Database", links: [{ label: "Players", href: "/players" }, { label: "Classes", href: "/classes" }] },
  {
    title: "Tools",
    links: [
      { label: "Player Comparison", href: "/compare" },
      { label: "Mock Draft", href: "/mock-draft" },
      { label: "Big Board", href: "/board" },
      { label: "Team Sync", href: "/team-sync" },
    ],
  },
  { title: "Model", links: [{ label: "Analytics", href: "/analytics" }, { label: "Methodology", href: "/methodology" }, { label: "Glossary", href: "/glossary" }] },
  { title: "Company", links: [{ label: "About", href: "/about" }] },
];

function DataFreshness({ lastDataRefresh }: { lastDataRefresh: string | null }) {
  // Formatted client-side only, after mount — the server (Railway,
  // likely UTC) and a visitor's browser can disagree on locale/
  // timezone, which would otherwise cause a hydration mismatch
  // flashing the wrong time briefly on load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!lastDataRefresh || !mounted) return null;
  const time = new Date(lastDataRefresh).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <p className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-riser" />
      Data updated {time}
    </p>
  );
}

export function Footer({ lastDataRefresh }: { lastDataRefresh: string | null }) {
  return (
    <footer className="border-t border-border bg-void">
      <Container className="py-16">
        <div className="lg:flex lg:items-start lg:gap-24">
          {/* Branding on its own row rather than sharing a grid with
              the link columns — the old layout had it eating 2 of 4
              grid columns on row 1, which left the second row (Model,
              Company — only 2 categories) with 2 empty trailing
              columns and no way to look balanced regardless of
              spacing tweaks. Four link categories now get their own
              clean, evenly-divided row with nothing else competing
              for the same grid. */}
          <div className="max-w-xs shrink-0">
            <div className="flex items-center gap-3">
              {/* Removed the standalone mark icon that used to sit
                  here, the wordmark already contains the same "DD"
                  mark within it, so showing both right next to each
                  other was a literal duplicate, not two distinct
                  pieces of branding. */}
              <Image src="/branding/dynasty-database-wordmark.png" alt="Dynasty Database" width={550} height={187} className="h-auto w-[220px] object-contain object-left" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-tertiary">
              Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie since 2015.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 lg:mt-0 lg:flex lg:gap-16">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">{col.title}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}><Link href={link.href} className="text-sm text-ink-secondary transition-colors hover:text-ink">{link.label}</Link></li>
                  ))}
                  {col.title === "Company" && <li><ContactPopover /></li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-ink-tertiary lg:flex-row lg:items-center">
          <p>© {new Date().getFullYear()} Dynasty Database. Not affiliated with the NFL.</p>
          <DataFreshness lastDataRefresh={lastDataRefresh} />
        </div>
      </Container>
    </footer>
  );
}
