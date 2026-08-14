import { stopIntegrationInfra } from './integration-infra';

export default async function globalTeardown(): Promise<void> {
  await stopIntegrationInfra();
}
