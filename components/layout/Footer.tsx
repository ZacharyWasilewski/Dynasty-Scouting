"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { ContactPopover } from "@/components/layout/ContactPopover";

const FOOTER_COLUMNS = [
  { title: "Platform", links: [{ label: "Players", href: "/players" }, { label: "Classes", href: "/classes" }, { label: "Analytics", href: "/analytics" }] },
  { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Methodology", href: "/methodology" }, { label: "Glossary", href: "/glossary" }] },
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
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              {/* Removed the standalone mark icon that used to sit
                  here — the wordmark already contains the same "DD"
                  mark within it, so showing both right next to each
                  other was a literal duplicate, not two distinct
                  pieces of branding. */}
              <Image src="/branding/dynasty-database-wordmark.png" alt="Dynasty Database" width={550} height={187} className="h-auto w-[220px] object-contain object-left" quality={100} />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-tertiary">
              Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie since 2015.
            </p>
          </div>
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
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-ink-tertiary lg:flex-row lg:items-center">
          <p>© {new Date().getFullYear()} Dynasty Database. Not affiliated with the NFL.</p>
          <DataFreshness lastDataRefresh={lastDataRefresh} />
        </div>
      </Container>
    </footer>
  );
}
