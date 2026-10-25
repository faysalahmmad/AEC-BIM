import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import sso from "../lib/sso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EventLog from "./EventLog";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/assets", label: "Build Avatar", end: false },
  { to: "/organizations", label: "Organizations", end: false },
];

export default function Layout() {
  const { status, profile } = useAuth();

  const handleLogout = async () => {
    await sso.logout();
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-md px-2.5 py-1.5 text-sm opacity-75 transition-all hover:opacity-100",
      isActive &&
        "bg-gradient-to-r from-primary to-brand-2 font-semibold text-primary-foreground opacity-100 shadow-md shadow-primary/25",
    );

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-brand-2 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-32 size-96 rounded-full bg-black/10 blur-3xl" />

          <span className="relative z-10 text-sm font-semibold tracking-widest text-white/70 uppercase">
            Avatar SSO
          </span>

          <div className="relative z-10 max-w-md">
            <p className="mb-4 text-5xl leading-[1.05] font-semibold tracking-tight text-white">
              One identity for every world you build.
            </p>
            <p className="text-lg text-white/80">
              Sign in once to manage avatars, organizations, and spaces everywhere your users
              show up.
            </p>
          </div>

          <span className="relative z-10 text-sm text-white/60">Powered by Allium Cloud</span>
        </div>

        <div className="flex items-center justify-center px-6 py-12">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border px-3 py-6">
        <span className="mb-6 flex items-center gap-2 px-2.5 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-brand-2 text-xs font-bold text-white">
            A
          </span>
          Avatar SSO
        </span>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </aside>

      <main className="flex-1 px-8 py-8 pb-16">
        <div className="mx-auto max-w-[960px]">
          <Outlet />
        </div>
      </main>

      <div className="fixed top-4 right-4 z-[1000] flex items-center gap-2.5 rounded-full border border-border bg-card/92 py-1.5 pr-1.5 pl-3 text-sm shadow-lg backdrop-blur-sm">
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

      <EventLog />
    </div>
  );
}
