"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface Props {
  devLogin: boolean;
  googleConfigured: boolean;
  callbackUrl: string;
}

export default function SignInForm({ devLogin, googleConfigured, callbackUrl }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <button
        onClick={() => signIn("google", { callbackUrl })}
        disabled={!googleConfigured}
        className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        title={googleConfigured ? "" : "Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET to enable"}
      >
        Continue with Google
      </button>
      {!googleConfigured && (
        <p className="text-center text-xs text-neutral-400">
          Google sign-in is not configured yet (missing AUTH_GOOGLE_ID).
        </p>
      )}

      {devLogin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn("dev", { email, name, callbackUrl });
          }}
          className="space-y-2 rounded-md border border-dashed border-amber-400 p-4"
        >
          <p className="text-xs font-medium text-amber-600">Developer login (non-production)</p>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="w-full rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
            Dev sign in
          </button>
        </form>
      )}
    </div>
  );
}
