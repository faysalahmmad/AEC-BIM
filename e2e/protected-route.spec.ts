import { test, expect } from "@playwright/test";
import { resetSsoStorage } from "./helpers/mock-sso";

const SSO_SERVER_URL = "https://api-gw-dev.2x22.com/sso/api/v1";

test("visiting a protected route while unauthenticated redirects to /login", async ({ page }) => {
  await resetSsoStorage(page);

  // With an empty IndexedDB and no email/token query params, the SDK resolves the
  // unauthenticated state entirely locally - no network call should happen.
  const unexpectedCalls: string[] = [];
  await page.route(`${SSO_SERVER_URL}/**`, (route) => {
    unexpectedCalls.push(route.request().url());
    return route.abort();
  });

  await page.goto("/");

  await page.waitForURL("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  expect(unexpectedCalls).toEqual([]);
});
