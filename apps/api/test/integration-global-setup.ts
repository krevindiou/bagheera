import { startIntegrationInfra } from './integration-infra';

export default async function globalSetup(): Promise<void> {
  await startIntegrationInfra();
}
