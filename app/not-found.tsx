import { Compass } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

/**
 * The site's one genuinely generic 404 — for any URL that doesn't
 * match a real route at all (a typo, an old bookmark, a dead external
 * link), and for every dynamic-segment page that calls notFound()
 * without its own more specific not-found.tsx (confirmed by checking
 * every [param] route in the app directory: app/board/[year],
 * app/mock-drafts/[id], and both app/shared/.../[id] pages all had no
 * coverage at any level before this file existed — Next.js walks up
 * to the nearest one it can find, so this single file now covers all
 * of them at once, not just the truly-unmatched-URL case). The
 * specific ones that already existed (players/[id], classes/[year],
 * positions/[position]) are more helpful for their own case and take
 * priority automatically; this is only ever the fallback.
 */
export default function NotFound() {
  return (
    <main>
      <Container className="flex flex-col items-center py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface text-ink-tertiary">
          <Compass className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tightest text-ink">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          The page you&apos;re looking for doesn&apos;t exist, or may have moved.
        </p>
        <div className="mt-8">
          <Button href="/" variant="secondary">
            Back home
          </Button>
        </div>
      </Container>
    </main>
  );
}
