"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, CheckCircle2 } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center bg-grid-columns py-12">
        <Container className="max-w-sm text-center">
          <p className="text-sm text-ink-secondary">
            This reset link is missing its token. Request a new one from the{" "}
            <Link href="/forgot-password" className="text-accent hover:underline">
              forgot password
            </Link>{" "}
            page.
          </p>
        </Container>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center bg-grid-columns py-12">
        <Container className="max-w-sm text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center border border-riser/40 bg-riser/10 text-riser">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h1 className="mt-3 font-display text-xl font-semibold text-ink">Password updated</h1>
          <p className="mt-2 text-sm text-ink-secondary">Taking you to log in…</p>
        </Container>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center bg-grid-columns py-12">
      <Container className="max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <KeyRound className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tightest text-ink">
            Set a new password
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full border border-border-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full border border-border-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
            />
          </div>

          {error && (
            <p className="border border-faller/30 bg-faller/10 px-3 py-2 text-sm text-faller">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Update password
          </Button>
        </form>
      </Container>
    </main>
  );
}
