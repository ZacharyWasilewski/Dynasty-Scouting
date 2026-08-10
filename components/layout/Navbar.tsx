"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Layers,
  BarChart3,
  Info,
  Search,
  Menu,
  X,
  GitCompareArrows,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useSearch } from "@/components/search/SearchProvider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Players", href: "/players", icon: Users },
  { label: "Classes", href: "/classes", icon: Layers },
  { label: "Player Comparison", href: "/compare", icon: GitCompareArrows },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "About", href: "/about", icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { setOpen: setSearchOpen } = useSearch();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-void/80 backdrop-blur-md transition-shadow duration-300",
        scrolled ? "border-border shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)]" : "border-transparent"
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-tightest text-ink transition-opacity hover:opacity-80"
          >
            <span className="flex h-7 w-7 items-center justify-center border border-accent/40 bg-accent/10 font-mono text-xs text-accent">
              DD
            </span>
            <span className="hidden sm:inline">DYNASTY DATABASE</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200"
                >
                  <link.icon
                    className={cn(
                      "h-4 w-4 transition-all duration-200 group-hover:-translate-y-0.5",
                      active
                        ? "text-accent"
                        : "text-ink-tertiary group-hover:text-accent"
                    )}
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-ink" : "text-ink-secondary group-hover:text-ink"
                    )}
                  >
                    {link.label}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-1 left-3 right-3 h-[2px] origin-center scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100",
                      active && "scale-x-100"
                    )}
                  />
                </Link>
              );
            })}
          </div>

          <div className="hidden lg:flex">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search prospects"
              className="flex items-center gap-2 border border-border px-3 py-2 text-ink-secondary transition-colors duration-200 hover:border-accent/50 hover:text-accent"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search</span>
              <kbd className="ml-2 border border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search prospects"
              className="flex h-9 w-9 items-center justify-center border border-border text-ink-secondary transition-colors duration-200 hover:border-accent/50 hover:text-accent"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center border border-border text-ink"
            >
              <Menu
                className={cn(
                  "absolute h-5 w-5 transition-all duration-200",
                  open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                )}
              />
              <X
                className={cn(
                  "absolute h-5 w-5 transition-all duration-200",
                  open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                )}
              />
            </button>
          </div>
        </nav>
      </Container>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-void transition-[max-height] duration-300 ease-in-out lg:hidden",
          open ? "max-h-[28rem]" : "max-h-0 border-t-0"
        )}
      >
        <Container className="flex flex-col gap-1 py-4">
          {NAV_LINKS.map((link, i) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-2 py-3 text-sm font-medium transition-all duration-300",
                  open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-ink-secondary hover:bg-surface hover:text-ink"
                )}
              >
                <link.icon className="h-4 w-4" strokeWidth={1.75} />
                {link.label}
              </Link>
            );
          })}
        </Container>
      </div>
    </header>
  );
}

