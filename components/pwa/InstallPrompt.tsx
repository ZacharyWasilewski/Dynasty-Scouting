"use client";

import { useEffect, useState } from "react";
import { X, ArrowUpRight, Share2 } from "@/components/ui/SiteIcons";

const DISMISS_KEY = "dd_install_dismissed_at";
// Don't re-show for two weeks after an explicit dismissal — this is
// meant to be a one-time, low-pressure offer, not a recurring nag
// every session.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

// Separate from the dismiss cooldown above: some browsers re-fire
// beforeinstallprompt on every fresh page load/reload while the
// install criteria remain met, regardless of whether the person has
// ever interacted with this component — that's standard browser
// behavior, not something this code controls. Without a per-session
// cap, that meant the prompt could reappear on every single page
// someone visited before they'd ever gotten the chance to dismiss it
// once. sessionStorage means "already offered this browser session"
// takes effect the moment it's first shown, not only after an
// explicit dismiss click.
const SHOWN_THIS_SESSION_KEY = "dd_install_shown_session";

function wasShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_THIS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "1");
  } catch {
    // Private browsing / storage disabled — worst case this can show
    // more than once in a session, not a real problem for a
    // low-pressure prompt with its own explicit dismiss control.
  }
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  // Two different signals for "already installed": the standard
  // media query (Android/Chrome/desktop) and Safari's own
  // non-standard navigator.standalone (iOS has never implemented the
  // display-mode media query the same way).
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  // iOS forces every browser onto WebKit, so "Chrome on iOS" also
  // matches a naive Safari check — excluding CriOS/FxiOS/etc. keeps
  // this specific to the actual Safari UI, which is the only one
  // where these Share-sheet instructions are accurate.
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && !isOtherIOSBrowser;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [visible, setVisible] = useState(false);

  // A subtle, one-time offer shouldn't sit on screen indefinitely
  // just because nobody happened to interact with it — auto-dismiss
  // (not counted against the 14-day cooldown, since ignoring it
  // isn't the same signal as actively closing it) after a reasonable
  // window keeps this from feeling like a persistent fixture on
  // whatever page it happened to first appear on.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 12_000);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed() || wasShownThisSession()) return;

    function handleBeforeInstallPrompt(e: Event) {
      // Stops Chrome's own default mini-infobar so this component is
      // the only install UI shown — otherwise a user could see both.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      markShownThisSession();
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS never fires beforeinstallprompt at all — there's no
    // programmatic install API on that platform, only manual
    // Share -> Add to Home Screen, which this offers instructions for
    // instead, gated by the exact same "not installed, not recently
    // dismissed, not already shown this session" checks.
    if (isIOSSafari()) {
      setShowIOSInstructions(true);
      setVisible(true);
      markShownThisSession();
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private browsing / storage disabled — worst case this can
      // show again next session, not a real problem for a one-time
      // low-pressure prompt.
    }
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Both an accept and a decline count as "seen it" — no reason to
    // ask again in either case.
    dismiss();
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Install Dynasty Database"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border border-border-strong bg-surface p-3.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] sm:inset-x-auto sm:right-6 sm:w-80 lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
          {showIOSInstructions ? <Share2 className="h-4 w-4" strokeWidth={1.75} /> : <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Install Dynasty Database</p>
          {showIOSInstructions ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">
              Tap <Share2 className="inline h-3 w-3 -translate-y-px" strokeWidth={2} /> Share, then{" "}
              <span className="text-ink-secondary">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">
              Add it to your home screen for quick, full-screen access.
            </p>
          )}
          {!showIOSInstructions && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="mt-2.5 border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest2 text-accent transition-colors duration-150 hover:bg-accent/20"
            >
              Install
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 text-ink-tertiary transition-colors duration-150 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
