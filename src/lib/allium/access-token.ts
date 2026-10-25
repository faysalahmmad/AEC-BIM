import { sso } from "./avatar-sso";

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

// Shared token bridge for every Allium SDK that authenticates off the Avatar SSO
// session (organization service, asset manager, ...). Pass this as `accessTokenProvider`.
export async function getAccessToken(): Promise<string> {
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
