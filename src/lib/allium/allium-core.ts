import { createOrganizationSDK } from "@alliumcloud/organization-service";
import { getAccessToken } from "./access-token";
import { trackSdk } from "./event-log";

const apiKey = import.meta.env.VITE_ORGANIZATION_SDK_KEY as string | undefined;

if (!apiKey) {
  console.warn(
    "VITE_ORGANIZATION_SDK_KEY is not set. Copy .env.example to .env.local and add your SDK key.",
  );
}

export const organization = trackSdk(
  createOrganizationSDK({
    apiKey: apiKey ?? "",
    accessTokenProvider: getAccessToken,
  }),
  "organization",
);

export type * from "@alliumcloud/organization-service";
