import type { Page } from "@playwright/test";
import * as fx from "../fixtures/sso";

// Hardcoded in the @alliumcloud/avatar-sso package; not overridable via this app's env today.
const SSO_SERVER_URL = "https://api-gw-dev.2x22.com/sso/api/v1";

interface MockSsoOverrides {
  signin?: unknown;
  signinStatus?: number;
  verify?: unknown;
  verifyStatus?: number;
  profile?: unknown;
  profileStatus?: number;
  logout?: unknown;
  logoutStatus?: number;
}

export async function mockSsoRoutes(page: Page, overrides: MockSsoOverrides = {}) {
  // Playwright matches routes in reverse registration order (most-recently-registered wins),
  // so the catch-all guard must be registered FIRST - the specific routes registered after
  // it are what actually handle matching requests.
  await page.route(`${SSO_SERVER_URL}/**`, (route) =>
    route.fulfill({
      status: 501,
      json: { statusCode: 501, success: false, message: "Unmocked SSO route in e2e test", data: null },
    }),
  );

  await page.route(`${SSO_SERVER_URL}/users/signin*`, (route) =>
    route.fulfill({
      status: overrides.signinStatus ?? 200,
      json: overrides.signin ?? fx.signinSuccess,
    }),
  );

  await page.route(`${SSO_SERVER_URL}/users/verify`, (route) =>
    route.fulfill({
      status: overrides.verifyStatus ?? 200,
      json: overrides.verify ?? fx.verifySuccess,
    }),
  );

  await page.route(`${SSO_SERVER_URL}/users/profile`, (route) =>
    route.fulfill({
      status: overrides.profileStatus ?? 200,
      json: overrides.profile ?? fx.profileSuccess,
    }),
  );

  await page.route(`${SSO_SERVER_URL}/users/logout`, (route) =>
    route.fulfill({
      status: overrides.logoutStatus ?? 200,
      json: overrides.logout ?? fx.logoutSuccess,
    }),
  );

  // Defensive: `sso/exchange` never actually fires for this app's callback flow (it bails
  // out whenever `email` is present, which it always is here), but stub it anyway so a test
  // never hangs/hits the real backend if that assumption ever changes.
  await page.route(`${SSO_SERVER_URL}/sso/exchange`, (route) =>
    route.fulfill({ status: 200, json: fx.verifySuccess }),
  );
}

// IndexedDB is origin-scoped, so `indexedDB.deleteDatabase` requires the page to already be
// on the app's origin. Playwright gives every test a fresh, isolated BrowserContext (no
// persisted storage) by default, so this is mostly defense-in-depth.
export async function resetSsoStorage(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => indexedDB.deleteDatabase("sso-sdk"));
}
