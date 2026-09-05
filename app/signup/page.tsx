"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create account.");
        return;
      }
      setUser(data.user);
      router.push(redirect);
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
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tightest text-ink">
            Create an account
          </h1>
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          Save players to your watchlist across visits.
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
          <div>
            <label htmlFor="password" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
              Password
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
            <p className="mt-1.5 text-xs text-ink-tertiary">At least 8 characters.</p>
          </div>

          {error && (
            <p className="border border-faller/30 bg-faller/10 px-3 py-2 text-sm text-faller">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-tertiary">
          Already have an account?{" "}
          <Link
            href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="text-accent hover:underline"
          >
            Log in
          </Link>
        </p>
      </Container>
    </main>
  );
}
