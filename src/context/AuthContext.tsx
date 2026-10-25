import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Actions, Profile } from "@alliumcloud/avatar-sso";
import sso from "../lib/sso";

export interface EventLogEntry {
  id: number;
  timestamp: Date;
  type: Actions["type"];
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  events: EventLogEntry[];
  refreshProfile: () => Promise<void>;
  clearEvents: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MAX_EVENTS = 30;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);

  const refreshProfile = useCallback(async () => {
    try {
      const fresh = await sso.fetchProfile();
      setProfile(fresh);
      setStatus("authenticated");
    } catch {
      setProfile(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await sso.exchange();
      } catch {
        // no active/valid session yet, or exchange link already used - fall through
      }

      const localUser = await sso.getLocalUser().catch(() => null);
      if (cancelled) return;

      if (!localUser) {
        setStatus("unauthenticated");
        return;
      }

      await refreshProfile();
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  useEffect(() => {
    const unsubscribe = sso.onEvents((action) => {
      setEvents((prev) =>
        [
          { id: Date.now() + Math.random(), timestamp: new Date(), type: action.type },
          ...prev,
        ].slice(0, MAX_EVENTS),
      );

      switch (action.type) {
        case "local-exchange":
        case "sso-exchange":
        case "profile.fetch":
        case "profile.update":
          setProfile(action.payload);
          setStatus("authenticated");
          break;
        case "profile-photo.update":
          setProfile((prev) => (prev ? { ...prev, photoURL: action.payload.photoURL } : prev));
          break;
        case "session-cleared":
        case "local-logout":
        case "logout":
          setProfile(null);
          setStatus("unauthenticated");
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, profile, events, refreshProfile, clearEvents }),
    [status, profile, events, refreshProfile, clearEvents],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
