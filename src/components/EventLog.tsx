import { useAuth } from "../context/AuthContext";
import "./EventLog.css";

export default function EventLog() {
  const { events } = useAuth();

  return (
    <aside className="event-log">
      <h2>SDK events</h2>
      <p className="event-log-hint">Live feed from sso.onEvents()</p>
      <ol>
        {events.length === 0 && <li className="event-log-empty">No events yet</li>}
        {events.map((event) => (
          <li key={event.id}>
            <span className="event-log-type">{event.type}</span>
            <time>{event.timestamp.toLocaleTimeString()}</time>
          </li>
        ))}
      </ol>
    </aside>
  );
}
