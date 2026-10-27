import { ContentDelivery } from "@alliumcloud/allium-content-delivery-sdk";
import { getAccessToken } from "./access-token";
import { trackSdk } from "./event-log";

const sdkKey = import.meta.env.VITE_CONTENT_SDK_KEY as string | undefined;

export const SDK_KEY_PROBLEM =
  "The Content Delivery SDK key is missing or expired. Please check the SDK key.";

// The SDK throws when constructed without a key, so build it on first use: a missing key
// then fails only the stream page, not the whole app.
let client: ContentDelivery | null = null;

// Content Delivery sends the viewer's SSO token with each session: who may enter is the
// space's rule in Application Configurations. The key needs "Accept Allium SSO" turned on.
export function getContentDelivery(): ContentDelivery {
  if (!sdkKey) throw new Error(SDK_KEY_PROBLEM);
  return (client ??= trackSdk(
    new ContentDelivery({
      sdkKey,
      accessTokenProvider: () => getAccessToken().catch(() => null),
    }),
    "contentDelivery",
  ));
}

export { isContentDeliveryError } from "@alliumcloud/allium-content-delivery-sdk";
export type * from "@alliumcloud/allium-content-delivery-sdk";
