"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not log in.");
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
            <LogIn className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tightest text-ink">
            Log in
          </h1>
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          Welcome back.
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full border border-border-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
            />
          </div>

          {error && (
            <p className="border border-faller/30 bg-faller/10 px-3 py-2 text-sm text-faller">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-tertiary">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="text-accent hover:underline"
          >
            Sign up
          </Link>
        </p>
      </Container>
    </main>
  );
}
