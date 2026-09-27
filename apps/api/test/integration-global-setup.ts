import { startIntegrationInfra, stopIntegrationInfra } from './integration-infra';

// Vitest's globalSetup runs this module's default export once for the
// whole run and, if it returns a function, calls that as teardown — the
// one supported way to pair setup/teardown here (unlike Jest's separate
// globalSetup/globalTeardown files sharing module-scope state).
export default async function globalSetup(): Promise<() => Promise<void>> {
  await startIntegrationInfra();
  return stopIntegrationInfra;
}
