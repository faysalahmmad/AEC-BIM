import SSO from "@alliumcloud/avatar-sso";
import { trackSdk } from "./event-log";

const sdkKey = import.meta.env.VITE_SSO_SDK_KEY as string | undefined;

if (!sdkKey) {
  console.warn(
    "VITE_SSO_SDK_KEY is not set. Copy .env.example to .env.local and add your SDK key.",
  );
}

// getLocalUser() runs before every SDK request to read the token, and onEvents() is the
// subscription itself, so neither is logged.
export const sso = trackSdk(
  new SSO({
    sdkKey: sdkKey ?? "",
  }),
  "sso",
  ["getLocalUser", "onEvents"],
);

export type * from "@alliumcloud/avatar-sso";
