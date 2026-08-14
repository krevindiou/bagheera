import { ChildProcess, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(dirname, "..", "..", "..", "..");
const API_ROOT = path.join(dirname, "..", "..", "..", "api");
const API_PORT = 3000;
const WEB_PORT = 5173;

// Short idle timeout for the whole harness so the idle-timeout journey
// doesn't have to wait out the real 30-minute default — every other test
// completes each step well under this window, and express-session's
// rolling cookie resets the clock on every request.
const SESSION_IDLE_TTL_SECONDS = 8;

let postgresContainer: StartedTestContainer | undefined;
let valkeyContainer: StartedTestContainer | undefined;
let mailpitContainer: StartedTestContainer | undefined;
let apiProcess: ChildProcess | undefined;
let webProcess: ChildProcess | undefined;

export interface RunningInfra {
  baseUrl: string;
  apiBaseUrl: string;
  mailpitHttpUrl: string;
}

async function startContainers(): Promise<{
  databaseUrl: string;
  valkeyUrl: string;
  mailpitSmtpUrl: string;
  mailpitHttpUrl: string;
}> {
  postgresContainer = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_USER: "bagheera",
      POSTGRES_PASSWORD: "bagheera",
      POSTGRES_DB: "bagheera",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  valkeyContainer = await new GenericContainer("valkey/valkey:8-alpine")
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();

  mailpitContainer = await new GenericContainer("axllent/mailpit:latest")
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp("/readyz", 8025))
    .start();

  const databaseUrl = `postgres://bagheera:bagheera@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/bagheera`;
  const valkeyUrl = `redis://${valkeyContainer.getHost()}:${valkeyContainer.getMappedPort(6379)}`;
  const mailpitSmtpUrl = `smtp://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(1025)}`;
  const mailpitHttpUrl = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;

  return { databaseUrl, valkeyUrl, mailpitSmtpUrl, mailpitHttpUrl };
}

// Reuses the api package's own migrate/seed scripts (rather than importing
// its Drizzle setup into the web package) so schema/seed logic has one
// owner.
function migrateAndSeed(databaseUrl: string): void {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  for (const script of ["db:migrate", "db:seed"]) {
    const result = spawnSync("pnpm", ["--filter", "api", "run", script], {
      cwd: REPO_ROOT,
      env,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`pnpm --filter api run ${script} failed`);
    }
  }
}

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 300);
    };
    void attempt();
  });
}

export async function startInfra(): Promise<RunningInfra> {
  const { databaseUrl, valkeyUrl, mailpitSmtpUrl, mailpitHttpUrl } = await startContainers();
  migrateAndSeed(databaseUrl);

  const apiEnv = {
    ...process.env,
    PORT: String(API_PORT),
    DATABASE_URL: databaseUrl,
    VALKEY_URL: valkeyUrl,
    CRYPTO_KEYS: '{"1":"8mJ0e7Z3vscIKX6Sp4hzw1tCTQiSVF0gzOREHMhYTYM="}',
    CRYPTO_ACTIVE_KEY_ID: "1",
    SESSION_SECRET: "e2e-session-secret",
    CSRF_SECRET: "e2e-csrf-secret",
    SESSION_IDLE_TTL_SECONDS: String(SESSION_IDLE_TTL_SECONDS),
    APP_URL: `http://localhost:${WEB_PORT}`,
    EMAIL_SMTP_URL: mailpitSmtpUrl,
    EMAIL_FROM: "Bagheera <no-reply@bagheera.example>",
  };

  apiProcess = spawn(
    "node",
    ["-r", "ts-node/register", "-r", "tsconfig-paths/register", "src/main.ts"],
    { cwd: API_ROOT, env: apiEnv, stdio: "inherit" },
  );

  await waitForHttp(`http://localhost:${API_PORT}/health`, 60_000);

  webProcess = spawn("pnpm", ["exec", "vite", "--port", String(WEB_PORT), "--strictPort"], {
    cwd: path.join(dirname, "..", ".."),
    env: process.env,
    stdio: "inherit",
  });

  await waitForHttp(`http://localhost:${WEB_PORT}/`, 60_000);

  return {
    baseUrl: `http://localhost:${WEB_PORT}`,
    apiBaseUrl: `http://localhost:${API_PORT}`,
    mailpitHttpUrl,
  };
}

function killProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.killed || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 5000);
  });
}

export async function stopInfra(): Promise<void> {
  await killProcess(webProcess);
  await killProcess(apiProcess);
  webProcess = undefined;
  apiProcess = undefined;

  await postgresContainer?.stop();
  await valkeyContainer?.stop();
  await mailpitContainer?.stop();
  postgresContainer = undefined;
  valkeyContainer = undefined;
  mailpitContainer = undefined;
}
