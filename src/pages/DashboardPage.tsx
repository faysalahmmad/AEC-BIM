import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Shirt } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    to: "/assets",
    title: "Build Avatar",
    description: "Equip clothing, materials, a skull, and a body for your avatar.",
    icon: Shirt,
  },
  {
    to: "/organizations",
    title: "Organizations",
    description: "Manage organizations, members, and spaces.",
    icon: Building2,
  },
];

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-brand-2 px-8 py-10">
        <div className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-white/10 blur-3xl" />
        <p className="relative z-10 mb-2 text-sm font-semibold tracking-widest text-white/70 uppercase">
          Dashboard
        </p>
        <h1 className="relative z-10 mb-1 text-white">
          Welcome{profile?.firstName ? `, ${profile.firstName}` : ""}
        </h1>
        <p className="relative z-10 text-white/80">You're signed in with Avatar SSO.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.to} to={feature.to} className="group">
              <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <CardContent className="flex flex-col gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-2 text-white">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-base font-semibold text-foreground">
                      {feature.title}
                      <ArrowUpRight className="size-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
