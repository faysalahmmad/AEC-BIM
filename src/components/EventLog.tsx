import { useState } from "react";
import { Maximize2, Minimize2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { clearSdkEvents, useSdkEvents } from "@/lib/allium/event-log";
import { cn } from "@/lib/utils";

export default function EventLog() {
  const { events: ssoEvents, clearEvents: clearSsoEvents } = useAuth();
  const sdkEvents = useSdkEvents();
  // One feed, newest first: SSO events plus the calls the other SDKs make.
  const events = [...ssoEvents.map((e) => ({ ...e, ok: true })), ...sdkEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
  const clearEvents = () => {
    clearSsoEvents();
    clearSdkEvents();
  };
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "fixed right-4 bottom-4 z-[1000] overflow-y-auto rounded-[10px] border border-border bg-card/92 p-3 text-xs text-foreground shadow-lg backdrop-blur-sm transition-all",
        expanded ? "max-h-[70vh] w-[380px]" : "max-h-[260px] w-[280px]",
      )}
    >
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <h2 className="text-[0.8rem] font-medium text-foreground">SDK events</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearEvents}
            disabled={events.length === 0}
            className="text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Clear events</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="sr-only">{expanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>
      <p className="mb-2 text-[0.68rem] opacity-65">Live feed from the SDKs</p>
      <ol className="flex flex-col gap-1.5">
        {events.length === 0 && <li className="justify-start opacity-60">No events yet</li>}
        {events.map((event) => (
          <li
            key={event.id}
            className="flex justify-between gap-2 border-b border-border pb-1.5 last:border-none last:pb-0"
          >
            <span className={cn("font-mono", event.ok ? "text-primary" : "text-destructive")}>
              {event.type}
            </span>
            <time className="whitespace-nowrap opacity-60">
              {event.timestamp.toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </aside>
  );
}
