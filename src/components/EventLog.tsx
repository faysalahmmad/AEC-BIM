import { useState, type PointerEvent } from "react";
import { Terminal, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { clearSdkEvents, useSdkEvents } from "@/lib/allium/event-log";
import { cn } from "@/lib/utils";

const MIN_HEIGHT = 120;

export default function EventLog() {
  const { events: ssoEvents, clearEvents: clearSsoEvents } = useAuth();
  const sdkEvents = useSdkEvents();
  // One feed, newest first: SSO events plus the calls the other SDKs make.
  const events = [
    ...ssoEvents.map((e) => ({ ...e, ok: true })),
    ...sdkEvents,
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const clearEvents = () => {
    clearSsoEvents();
    clearSdkEvents();
  };
  const [open, setOpen] = useState(false);
  // null until first dragged: the panel then opens at half the window.
  const [height, setHeight] = useState<number | null>(null);

  // Dragging the top edge up grows the panel, down shrinks it.
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // no text selection while dragging
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const resize = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setHeight(
      Math.min(
        Math.max(window.innerHeight - e.clientY, MIN_HEIGHT),
        window.innerHeight * 0.9,
      ),
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-4 left-4 z-[1000] flex size-10 items-center justify-center rounded-full border border-border bg-card/92 text-muted-foreground shadow-lg backdrop-blur-sm transition-colors hover:text-foreground",
          open && "hidden",
        )}
      >
        <Terminal className="size-5" />
        <span className="sr-only">Show SDK events</span>
      </button>

      {open && (
        <aside
          style={{ height: height ?? "50vh" }}
          className="fixed inset-x-0 bottom-0 z-[1000] flex flex-col border-t border-border bg-card/95 text-xs text-foreground shadow-2xl backdrop-blur-sm"
        >
          <div
            onPointerDown={startResize}
            onPointerMove={resize}
            className="group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center"
          >
            <span className="h-0.5 w-10 rounded-full bg-border transition-colors group-hover:bg-primary" />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2">
            <h2 className="flex items-center gap-2 text-[0.8rem] font-medium text-foreground">
              <Terminal className="size-3.5" />
              SDK events
              <span className="font-normal opacity-65">
                Live feed from the SDKs
              </span>
            </h2>
            <div className="flex items-center gap-2">
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
                onClick={() => setOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          <ol className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-3">
            {events.length === 0 && (
              <li className="justify-start opacity-60">No events yet</li>
            )}
            {events.map((event) => (
              <li
                key={event.id}
                className="flex justify-between gap-2 border-b border-border pb-1.5 last:border-none last:pb-0"
              >
                <span
                  className={cn(
                    "font-mono",
                    event.ok ? "text-primary" : "text-destructive",
                  )}
                >
                  {event.type}
                </span>
                <time className="whitespace-nowrap opacity-60">
                  {event.timestamp.toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </>
  );
}
