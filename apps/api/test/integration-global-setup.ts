import { startIntegrationInfra, stopIntegrationInfra } from './integration-infra';

// Runs once for the whole run; the returned function is the teardown.
export default async function globalSetup(): Promise<() => Promise<void>> {
  await startIntegrationInfra();
  return stopIntegrationInfra;
}
