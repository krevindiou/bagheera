import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { latestEmailLink } from "./mailpit";

export const PASSWORD = "correct-horse-battery";

let counter = 0;

/** A fresh, unique address per call — E2E specs never reuse a member. */
export function uniqueEmail(): string {
  counter += 1;
  return `e2e-${Date.now()}-${counter}@example.com`;
}

export async function register(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/en/register");
  await page.locator("#register-email").fill(email);
  await page.locator("#register-country").selectOption("US");
  await page.locator("#register-password").fill(password);
  await page.locator("#register-password-confirmation").fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
}

export async function activateFromEmail(page: Page, email: string): Promise<void> {
  const link = await latestEmailLink(email);
  await page.goto(link);
  await expect(page.getByRole("alert")).toBeVisible();
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
}

/** Full register → activate → sign-in journey, landing on the dashboard. */
export async function registerActivateSignIn(
  page: Page,
  password = PASSWORD,
): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();
  await register(page, email, password);
  await activateFromEmail(page, email);
  await signIn(page, email, password);
  return { email, password };
}
