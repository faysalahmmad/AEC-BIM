import { test, expect } from "@playwright/test";
import { mockSsoRoutes, resetSsoStorage } from "./helpers/mock-sso";
import { TEST_EMAIL, TEST_TOKEN } from "./fixtures/sso";

test.beforeEach(async ({ page }) => {
  await resetSsoStorage(page);
  await mockSsoRoutes(page);
});

test("requesting a magic link shows the check-your-email state", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Email me a link" }).click();

  await expect(page.getByText(`Check ${TEST_EMAIL} for a sign-in link`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Use a different email" })).toBeVisible();
});

test("opening the magic link completes sign-in and lands on projects", async ({ page }) => {
  await page.goto(`/callback?email=${encodeURIComponent(TEST_EMAIL)}&token=${TEST_TOKEN}`);

  await page.waitForURL("/");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
});
