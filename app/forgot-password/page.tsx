"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center bg-grid-columns py-12">
      <Container className="max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <KeyRound className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tightest text-ink">
            Reset your password
          </h1>
        </div>

        {sent ? (
          <p className="mt-6 text-sm leading-relaxed text-ink-secondary">
            If an account exists for <span className="text-ink">{email}</span>, a reset link is on its way. It&apos;ll
            work for 30 minutes.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-secondary">
              Enter your email and we&apos;ll send you a link to set a new password.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full border border-border-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>

              {error && (
                <p className="border border-faller/30 bg-faller/10 px-3 py-2 text-sm text-faller">
                  {error}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-tertiary">
          <Link href="/login" className="text-accent hover:underline">
            Back to log in
          </Link>
        </p>
      </Container>
    </main>
  );
}
