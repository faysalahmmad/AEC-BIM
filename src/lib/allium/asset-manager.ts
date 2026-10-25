import { createAssetManagerSDK } from "@alliumcloud/asset-manager";
import { getAccessToken } from "./access-token";

const apiKey = import.meta.env.VITE_ASSET_MANAGER_API_KEY as string | undefined;

if (!apiKey) {
  console.warn(
    "VITE_ASSET_MANAGER_API_KEY is not set. Copy .env.example to .env.local and add your API key.",
  );
}

// Avatar SSO integration path: tokens issued by Avatar SSO are trusted automatically,
// so no jwksUri is required - we just bridge the SSO access token in.
export const assetManager = createAssetManagerSDK({
  apiKey: apiKey ?? "",
  accessTokenProvider: getAccessToken,
});

export type * from "@alliumcloud/asset-manager";
