import { createAssetManagerSDK } from "@alliumcloud/asset-manager";
import { getAccessToken } from "./access-token";
import { logEvent, trackSdk } from "./event-log";

const apiKey = import.meta.env.VITE_ASSET_MANAGER_SDK_KEY as string | undefined;

if (!apiKey) {
  console.warn(
    "VITE_ASSET_MANAGER_SDK_KEY is not set. Copy .env.example to .env.local and add your SDK key.",
  );
}

// Avatar SSO integration path: tokens issued by Avatar SSO are trusted automatically,
// so no jwksUri is required - we just bridge the SSO access token in.
export const assetManager = trackSdk(
  createAssetManagerSDK({
    apiKey: apiKey ?? "",
    accessTokenProvider: getAccessToken,
  }),
  "assetManager",
);

// The SDK has no method for the plugin tags yet: the same key and user token on a plain GET.
const baseUrl =
  (import.meta.env.VITE_ASSET_MANAGER_URL as string | undefined) ??
  "https://api.dev-env.allium.cloud/assets/api/v1";

export type PluginTag = { versionTag: string; unrealEngineVersions: string[] };

export async function getPluginTags(): Promise<PluginTag[]> {
  const res = await fetch(`${baseUrl}/uploader/plugin-tags`, {
    headers: {
      "x-allium-key": apiKey ?? "",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
  });
  const body = (await res.json().catch(() => null)) as {
    data?: PluginTag[];
    message?: string;
  } | null;
  if (!res.ok || !body) {
    logEvent("assetManager.getPluginTags() ✗", false);
    throw new Error(body?.message ?? `Asset Manager answered ${res.status}`);
  }
  logEvent("assetManager.getPluginTags()");
  return body.data ?? [];
}

export type * from "@alliumcloud/asset-manager";
