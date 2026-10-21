"use client";

import { useEffect } from "react";

/**
 * Next.js's special catch for errors thrown by the *root layout*
 * itself (app/layout.tsx) — a different, rarer case than app/error.tsx,
 * which only catches errors from page content rendered *inside* that
 * layout. If the root layout throws (a provider crashing during
 * render, for instance), app/error.tsx can't help — it's a sibling of
 * the very layout that failed, so it never gets a chance to mount.
 * Without this file, that specific failure falls through to Next's
 * own unstyled default error page instead of anything resembling the
 * site.
 *
 * Deliberately self-contained rather than reusing Container/Button
 * from the rest of the app: this has to render its own complete
 * <html>/<body> (the real root layout isn't available to wrap it,
 * since that layout is what's currently broken), and pulling in
 * shared components that themselves depend on providers/context this
 * page can't assume are safe defeats the purpose of a last-resort
 * fallback. Plain elements, inline Tailwind classes, no font imports
 * (the system font stack is a fine trade for not adding another
 * moving part to the one page that has to work when everything else
 * hasn't) — just enough to look like the site, not exercise the parts
 * of it that might have just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F6F7F9",
          color: "#14161B",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              height: "3.5rem",
              width: "3.5rem",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #CBCFD6",
              backgroundColor: "#FFFFFF",
              color: "#6B7280",
              fontSize: "1.5rem",
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            !
          </span>
          <h1 style={{ marginTop: "1.5rem", fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#565D6B" }}>
            Dynasty Database hit an unexpected error loading the page. This is usually temporary.
          </p>
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#2563EB",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#14161B",
                backgroundColor: "transparent",
                border: "1px solid #CBCFD6",
                textDecoration: "none",
              }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
