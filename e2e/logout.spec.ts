import { test, expect } from "@playwright/test";
import { mockSsoRoutes, resetSsoStorage } from "./helpers/mock-sso";
import { TEST_EMAIL, TEST_OTP } from "./fixtures/sso";

test("logging out returns the user to the login form", async ({ page }) => {
  await resetSsoStorage(page);
  await mockSsoRoutes(page);

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Code").fill(TEST_OTP);
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.waitForURL("/");

  await page.getByRole("button", { name: "Log out" }).click();

  await page.waitForURL("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
