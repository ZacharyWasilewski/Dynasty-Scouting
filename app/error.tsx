"use client";

import { useEffect } from "react";
import { AlertTriangle } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

/**
 * Next.js error boundary — catches anything that escapes a page's
 * own rendering, most realistically getSheetData() throwing because
 * the live sheet fetch failed AND there was no cached data anywhere
 * to fall back to (see the try/catch in lib/googleSheets.ts). That
 * combination should be rare — the disk/memory cache fallback there
 * covers ordinary transient failures — but this is the honest
 * last-resort state for when it still happens, rather than a blank
 * white screen or a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main>
      <Container className="flex flex-col items-center py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface text-ink-tertiary">
          <AlertTriangle className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tightest text-ink">
          Having trouble loading live data
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          Something went wrong pulling current prospect data. This is usually temporary, try again in a moment.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href="/" variant="secondary">
            Back home
          </Button>
        </div>
      </Container>
    </main>
  );
}
