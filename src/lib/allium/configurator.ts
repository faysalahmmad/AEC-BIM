import { createConfiguratorSDK } from "@alliumcloud/configurator-service";
import { getAccessToken } from "./access-token";
import { trackSdk } from "./event-log";

const apiKey = import.meta.env.VITE_CONFIGURATOR_SDK_KEY as string | undefined;

export const CONFIGURATOR_KEY_PROBLEM =
  "The Configurator SDK key is missing. Set VITE_CONFIGURATOR_SDK_KEY in .env.local and restart the dev server.";

// The SDK throws when constructed without a key, so build it on first use: a missing key
// then fails only the room item features, not the whole app.
let client: ReturnType<typeof createConfiguratorSDK> | null = null;

// Needs "Accept Allium SSO" on the key, and the write, update and delete scopes.
export function getConfigurator() {
  if (!apiKey) throw new Error(CONFIGURATOR_KEY_PROBLEM);
  return (client ??= trackSdk(
    createConfiguratorSDK({
      apiKey,
      accessTokenProvider: getAccessToken,
    }),
    "configurator",
  ));
}

export type * from "@alliumcloud/configurator-service";
