import { test, expect } from "@playwright/test";
import { mockSsoRoutes, resetSsoStorage } from "./helpers/mock-sso";
import { TEST_EMAIL, TEST_OTP } from "./fixtures/sso";

test.beforeEach(async ({ page }) => {
  await resetSsoStorage(page);
  await mockSsoRoutes(page);
});

test("requesting and verifying an OTP code signs the user in", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Email me a code" }).click();

  await expect(page.getByText(`Enter the code we emailed to ${TEST_EMAIL}`)).toBeVisible();

  await page.getByLabel("Code").fill(TEST_OTP);
  await page.getByRole("button", { name: "Verify code" }).click();

  await page.waitForURL("/");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
});
