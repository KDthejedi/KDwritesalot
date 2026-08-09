import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";

/**
 * Guard for the authenticated app area. Runs on the server (Node), so `auth()`
 * fully resolves the session; signed-out users are redirected to /signin. Every
 * page under app/(app) is protected by this layout, and the API routes enforce
 * access again server-side.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="min-h-screen">
      <AppHeader
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        image={session.user.image ?? null}
      />
      {children}
    </div>
  );
}
