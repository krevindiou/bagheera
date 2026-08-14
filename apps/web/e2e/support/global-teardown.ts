import { stopInfra } from "./infra";

export default async function globalTeardown(): Promise<void> {
  await stopInfra();
}
