import { createOrganizationSDK } from "@alliumcloud/organization-service";
import { getAccessToken } from "./access-token";

const apiKey = import.meta.env.VITE_ORGANIZATION_API_KEY as string | undefined;

if (!apiKey) {
  console.warn(
    "VITE_ORGANIZATION_API_KEY is not set. Copy .env.example to .env.local and add your API key.",
  );
}

export const organization = createOrganizationSDK({
  apiKey: apiKey ?? "",
  accessTokenProvider: getAccessToken,
});

export type * from "@alliumcloud/organization-service";
