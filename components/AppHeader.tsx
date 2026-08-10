"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import Wordmark from "@/components/Wordmark";

interface Props {
  name: string | null;
  email: string | null;
  image: string | null;
}

export default function AppHeader({ name, email, image }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <Link href="/dashboard">
        <Wordmark size={20} />
      </Link>
      <div className="flex items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-6 w-6 rounded-full" />
        ) : null}
        <span className="text-neutral-500">{name ?? email}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
