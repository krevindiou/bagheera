import { startInfra } from "./infra";

export default async function globalSetup(): Promise<void> {
  const infra = await startInfra();
  // Handed to tests via playwright.config.ts's baseURL/use, and to the
  // mailpit helper via env (no cross-process globals in Playwright).
  process.env.E2E_BASE_URL = infra.baseUrl;
  process.env.E2E_MAILPIT_HTTP_URL = infra.mailpitHttpUrl;
}
