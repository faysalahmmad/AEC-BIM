import { useAuth } from "../context/AuthContext";

export default function EventLog() {
  const { events } = useAuth();

  return (
    <aside className="fixed right-4 bottom-4 z-[1000] max-h-[260px] w-[280px] overflow-y-auto rounded-[10px] border border-border bg-card/92 p-3 text-xs text-foreground shadow-lg backdrop-blur-sm">
      <h2 className="mb-0.5 text-[0.8rem] font-medium text-foreground">SDK events</h2>
      <p className="mb-2 text-[0.68rem] opacity-65">Live feed from sso.onEvents()</p>
      <ol className="flex flex-col gap-1.5">
        {events.length === 0 && <li className="justify-start opacity-60">No events yet</li>}
        {events.map((event) => (
          <li
            key={event.id}
            className="flex justify-between gap-2 border-b border-border pb-1.5 last:border-none last:pb-0"
          >
            <span className="font-mono text-primary">{event.type}</span>
            <time className="whitespace-nowrap opacity-60">
              {event.timestamp.toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </aside>
  );
}
