import { useSyncExternalStore } from "react";

// The SSO SDK has onEvents(); the other SDKs do not. This is the app's own feed for their calls.
export interface SdkEvent {
  id: number;
  timestamp: Date;
  type: string;
  ok: boolean;
}

const MAX_EVENTS = 100;
let events: SdkEvent[] = [];
const listeners = new Set<() => void>();

export function logEvent(type: string, ok = true): void {
  events = [{ id: Date.now() + Math.random(), timestamp: new Date(), type, ok }, ...events].slice(
    0,
    MAX_EVENTS,
  );
  listeners.forEach((l) => l());
}

export function clearSdkEvents(): void {
  events = [];
  listeners.forEach((l) => l());
}

export function useSdkEvents(): SdkEvent[] {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => events,
  );
}

// Wrap an SDK so every function call on it (at any depth) is logged by its path, such as
// "assetManager.assets.getAll()": once it settles, with "✗" when it fails. Methods run on the
// original object, so the SDKs' private fields keep working.
export function trackSdk<T extends object>(sdk: T, name: string, skip: string[] = []): T {
  return new Proxy(sdk, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof prop === "symbol") return value;
      const path = `${name}.${prop}`;
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          if (skip.includes(prop)) return value.apply(target, args);
          try {
            const result = value.apply(target, args);
            if (result instanceof Promise) {
              return result.then(
                (r) => (logEvent(`${path}()`), r),
                (err) => (logEvent(`${path}() ✗`, false), Promise.reject(err)),
              );
            }
            logEvent(`${path}()`);
            return result;
          } catch (err) {
            logEvent(`${path}() ✗`, false);
            throw err;
          }
        };
      }
      return value && typeof value === "object" && Object.getPrototypeOf(value) !== Array.prototype
        ? trackSdk(value as object, path, skip)
        : value;
    },
  });
}
