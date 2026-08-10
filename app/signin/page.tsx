import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SignInForm from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = callbackUrl ?? "/dashboard";
  if (session) redirect(target);

  const devLogin =
    process.env.ENABLE_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";
  const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign in to Marquee</h1>
        <p className="text-sm text-neutral-500">
          Your screenplays, versions, and collaborators, saved to your account.
        </p>
      </div>
      <SignInForm devLogin={devLogin} googleConfigured={googleConfigured} callbackUrl={target} />
    </main>
  );
}
