import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { assetManager } from "@/lib/allium/asset-manager";
import { cn } from "@/lib/utils";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; latencyMs?: number }
  | { status: "error"; message: string };

// Lightweight liveness indicator for the Asset Manager service. Checks both the
// service and its Redis dependency so a degraded cache layer is visible too.
export default function HealthBadge() {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([assetManager.health.getHealth(), assetManager.health.getRedisHealth()])
      .then(([, redis]) => {
        if (!cancelled) setState({ status: "ok", latencyMs: redis.latencyMs });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "unreachable",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dotColor =
    state.status === "ok"
      ? "bg-success"
      : state.status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
      title={state.status === "error" ? state.message : undefined}
    >
      <Activity className="size-3.5" />
      <span className={cn("size-2 rounded-full", dotColor)} />
      {state.status === "loading" && "Checking service..."}
      {state.status === "ok" && (
        <>Service healthy{state.latencyMs != null ? ` · Redis ${state.latencyMs}ms` : ""}</>
      )}
      {state.status === "error" && "Service unreachable"}
    </span>
  );
}
