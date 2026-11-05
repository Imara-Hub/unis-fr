"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { FullPageSpinner } from "@/components/AuthCard";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { DashboardShell } from "@/components/DashboardShell";
import { LOGOUT, ME } from "@/lib/graphql/auth";
import { useLiveUpdates } from "@/lib/useLiveUpdates";

const TAB_TITLES: Record<string, string> = { ADMIN: "Admin", JUDGE: "Judge", STAFF: "Staff" };

// Every page after login (dashboard, participants, phones, …): must be logged in, gets the sidebar, logout and live updates.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery(ME, { fetchPolicy: "network-only" });
  const [logout, { loading: loggingOut }] = useMutation(LOGOUT);

  const user = data?.me;
  const pathname = usePathname();
  // The browser tab says who is using it, like "Stage · Musabaqa" on the stage screen.
  // Set again after each page change, because Next puts its own title back on navigation.
  const role = user?.role;
  useEffect(() => {
    const label = role ? TAB_TITLES[role] : undefined;
    if (label) document.title = `${label} · Musabaqa`;
  }, [role, pathname]);
  // The server answered "nobody is logged in" (or the session was revoked).
  const loggedOut = !loading && !error && !user;

  useEffect(() => {
    if (loggedOut) router.replace("/login");
  }, [loggedOut, router]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      // Forget all cached data from this user, even if the request failed.
      await client.clearStore();
      router.replace("/login");
    }
  }

  // Spinner only before we know the user. When ME is fetched again later (new photo,
  // new name), `loading` is true for a moment too, but the app must stay on screen:
  // swapping it for the spinner would throw away the page and anything being typed.
  if (!user) {
    if (error) return <ServerUnreachable onRetry={() => refetch()} />;
    return <FullPageSpinner />;
  }

  return (
    <LiveShell user={user} onLogout={onLogout} loggingOut={loggingOut}>
      {children}
    </LiveShell>
  );
}

// Separate component so live updates start only once the user is known to be logged in.
function LiveShell(props: Omit<ComponentProps<typeof DashboardShell>, "live">) {
  const live = useLiveUpdates();
  return <DashboardShell {...props} live={live} />;
}
