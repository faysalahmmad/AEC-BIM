import { createOrganizationSDK } from "@alliumcloud/organization-service";
import sso from "./sso";

const apiKey = import.meta.env.VITE_ORGANIZATION_API_KEY as string | undefined;

if (!apiKey) {
  console.warn(
    "VITE_ORGANIZATION_API_KEY is not set. Copy .env.example to .env.local and add your API key.",
  );
}

function jwtExpiresAt(token: string): number {
  const [, payload] = token.split(".");
  const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
    exp: number;
  };
  return exp * 1000;
}

// sso.refresh() rotates the (single-use) refresh token on every call, so calling it
// unconditionally per request causes concurrent requests to race - only the first
// succeeds, the rest get rejected as "already used" and the SDK clears the session.
// Instead, reuse the current access token until it's close to expiry, and de-dupe
// concurrent refreshes behind a single in-flight promise.
let refreshPromise: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  const { tokens } = await sso.getLocalUser();
  const isExpiringSoon = Date.now() > jwtExpiresAt(tokens.accessToken) - 5 * 60 * 1000;
  if (!isExpiringSoon) return tokens.accessToken;

  if (!refreshPromise) {
    refreshPromise = sso
      .refresh()
      .then(({ accessToken }) => accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const organization = createOrganizationSDK({
  apiKey: apiKey ?? "",
  accessTokenProvider: getAccessToken,
});

export default organization;
