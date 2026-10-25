import { test, expect } from "@playwright/test";
import { mockSsoRoutes, resetSsoStorage } from "./helpers/mock-sso";
import * as fx from "./fixtures/sso";

test.beforeEach(async ({ page }) => {
  await resetSsoStorage(page);
});

test("an invalid signin shows the error message and stays on the login form", async ({ page }) => {
  await mockSsoRoutes(page, { signin: fx.signinError, signinStatus: 400 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(fx.TEST_EMAIL);
  await page.getByRole("button", { name: "Email me a link" }).click();

  await expect(page.getByText(fx.signinError.message)).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeEnabled();
  await expect(page).toHaveURL("/login");
});

test("an invalid OTP code shows the error message and does not sign the user in", async ({
  page,
}) => {
  await mockSsoRoutes(page, { verify: fx.verifyError, verifyStatus: 400 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(fx.TEST_EMAIL);
  await page.getByRole("button", { name: "Email me a code" }).click();

  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Verify code" }).click();

  await expect(page.getByText(fx.verifyError.message)).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify code" })).toBeEnabled();
  await expect(page).toHaveURL("/login");
});
