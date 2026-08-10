import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { ContactPopover } from "@/components/layout/ContactPopover";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Players", href: "/players" },
      { label: "Classes", href: "/classes" },
      { label: "Analytics", href: "/analytics" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Methodology", href: "/methodology" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-void">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-display text-lg font-semibold tracking-tightest text-ink">
              <span className="flex h-7 w-7 items-center justify-center border border-accent/40 bg-accent/10 font-mono text-xs text-accent">
                DD
              </span>
              DYNASTY DATABASE
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-tertiary">
              Analytical grades, position rankings, and draft-class boards
              for every incoming dynasty relevant rookie since 2015.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-secondary transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.title === "Company" && (
                  <li>
                    <ContactPopover />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-ink-tertiary lg:flex-row lg:items-center">
          <p>© {new Date().getFullYear()} Dynasty Database. Not affiliated with the NFL.</p>
        </div>
      </Container>
    </footer>
  );
}
