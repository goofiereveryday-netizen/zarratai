"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/lib/auth/client-auth";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await signup({}, formData);

    if (result.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-deep-moss">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-olive-branch">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.8 10-10 10Z" />
                <path d="M2 21c0-3 1.9-5.5 4.5-6.5" />
              </svg>
            </span>
            ZarratAI
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-deep-moss">
            Create account
          </h1>
          <p className="mt-1 text-sm text-forest-floor/70">
            Register with your mobile number
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-deep-moss"
            >
              Your name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Ahmad Khan"
              required
              maxLength={100}
              className="w-full rounded-lg border border-forest-floor/20 bg-white px-4 py-3 text-base text-deep-moss placeholder-forest-floor/30 transition-colors focus:border-olive-branch focus:outline-none focus:ring-2 focus:ring-olive-branch/20"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-deep-moss"
            >
              Mobile number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="03001234567"
              required
              className="w-full rounded-lg border border-forest-floor/20 bg-white px-4 py-3 text-base text-deep-moss placeholder-forest-floor/30 transition-colors focus:border-olive-branch focus:outline-none focus:ring-2 focus:ring-olive-branch/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-deep-moss"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-forest-floor/20 bg-white px-4 py-3 text-base text-deep-moss placeholder-forest-floor/30 transition-colors focus:border-olive-branch focus:outline-none focus:ring-2 focus:ring-olive-branch/20"
            />
            <p className="mt-1 text-xs text-forest-floor/50">
              At least 8 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-harvest-copper px-4 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citron-beam"
          >
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-forest-floor/70">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-olive-branch underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
