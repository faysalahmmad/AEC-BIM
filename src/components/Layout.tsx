import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sso } from "@/lib/allium/avatar-sso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import EventLog from "./EventLog";

export default function Layout() {
  const { status, profile } = useAuth();

  const handleLogout = async () => {
    await sso.logout();
  };

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-brand-2 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-blueprint-grid" />
          <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-on-brand/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-32 size-96 rounded-full bg-scrim/10 blur-3xl" />

          <span className="relative z-10 text-sm font-semibold tracking-widest text-on-brand/70 uppercase">
            AEC-BIM
          </span>

          <div className="relative z-10 max-w-md">
            <p className="mb-4 text-5xl leading-[1.05] font-semibold tracking-tight text-on-brand">
              Building Information Modeling, built on Allium.
            </p>
            <p className="text-lg text-on-brand/80">
              3D modeling, engineering, construction and visualization for AEC projects, all
              running on the Allium SDKs.
            </p>
          </div>

          <span className="relative z-10 text-sm text-on-brand/60">Powered by Allium Cloud</span>
        </div>

        <div className="flex items-center justify-center px-6 py-12">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-brand-2 text-xs font-bold text-on-brand">
            A
          </span>
          AEC-BIM
        </Link>
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/92 py-1.5 pr-1.5 pl-3 text-sm shadow-lg backdrop-blur-sm">
          <Link to="/profile" className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarImage src={profile?.photoURL ?? undefined} alt="" />
              <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                {profile?.firstName?.[0]}
                {profile?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{profile?.email}</span>
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="flex-1 px-8 pt-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <EventLog />
    </div>
  );
}
