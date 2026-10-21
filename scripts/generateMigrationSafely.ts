import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "host.docker.internal",
]);

function disposableDatabase(
  value: string | undefined,
  label: string,
  prefix: string,
): { url: URL; databaseName: string } {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }
  const databaseName = url.pathname.slice(1);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !LOCAL_DATABASE_HOSTS.has(url.hostname) ||
    !databaseName.startsWith(prefix)
  ) {
    throw new Error(
      `${label} must target a local disposable ${prefix}* database`,
    );
  }
  return { url, databaseName };
}

function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  label: string,
): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed`);
}

function capture(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  label: string,
): string {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${label} failed`);
  }
  return result.stdout;
}

function emptyMigration(sql: string): boolean {
  return sql.replace(/--[^\n]*(?:\n|$)/g, "").replace(/\s|;/g, "").length === 0;
}

function migrationTimestamp(now = new Date()): string {
  return now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

async function main() {
  if (process.env.ALLOW_DISPOSABLE_MIGRATION_GENERATION !== "true") {
    throw new Error(
      "Migration generation requires ALLOW_DISPOSABLE_MIGRATION_GENERATION=true after reviewing both disposable database URLs",
    );
  }
  const primary = disposableDatabase(
    process.env.DATABASE_URL,
    "DATABASE_URL",
    "runtime_convenience_migration_",
  );
  const shadow = disposableDatabase(
    process.env.SHADOW_DATABASE_URL,
    "SHADOW_DATABASE_URL",
    "runtime_convenience_shadow_",
  );
  if (primary.databaseName === shadow.databaseName) {
    throw new Error("Migration and shadow databases must be different");
  }
  if (process.argv.includes("--check-only")) {
    console.log(
      JSON.stringify({
        productionGeneration: true,
        primaryDatabase: primary.databaseName,
        shadowDatabase: shadow.databaseName,
      }),
    );
    return;
  }

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
  };
  const bin = (name: string) =>
    path.join(process.cwd(), "node_modules", ".bin", name);

  run(
    bin("keystone"),
    ["build", "--no-ui"],
    environment,
    "Keystone schema generation",
  );
  run(
    bin("tsx"),
    ["features/keystone/view-order/generate-view-order.ts"],
    environment,
    "View-order generation",
  );

  // Prove the checked-in history on the explicitly disposable primary first.
  // `migrate dev` refuses noninteractive execution by design; `migrate diff`
  // is Prisma's noninteractive SQL generator and uses the disposable shadow to
  // replay the complete migration history before comparing it to schema.prisma.
  run(
    bin("tsx"),
    ["scripts/preflightMigration.ts"],
    environment,
    "Disposable migration preflight",
  );
  run(
    bin("prisma"),
    ["migrate", "deploy"],
    environment,
    "Disposable migration deploy",
  );
  run(
    bin("tsx"),
    ["scripts/postMigrationIntegrity.ts"],
    environment,
    "Disposable post-migration integrity",
  );

  const generatedSql = capture(
    bin("prisma"),
    [
      "migrate",
      "diff",
      "--from-migrations",
      "migrations",
      "--to-schema-datamodel",
      "schema.prisma",
      "--shadow-database-url",
      shadow.url.toString(),
      "--script",
    ],
    environment,
    "Prisma migration diff generation",
  );

  let generatedMigration: string | null = null;
  if (!emptyMigration(generatedSql)) {
    const name = process.env.MIGRATION_NAME?.trim();
    if (!name || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) {
      throw new Error(
        "MIGRATION_NAME must be supplied for a non-empty diff and use lowercase letters, numbers, underscores, or hyphens",
      );
    }
    generatedMigration = `${migrationTimestamp()}_${name}`;
    const directory = path.join("migrations", generatedMigration);
    await mkdir(directory, { recursive: false });
    const body = generatedSql.trim();
    await writeFile(
      path.join(directory, "migration.sql"),
      `BEGIN;\n\n${body}\n\nCOMMIT;\n`,
      { flag: "wx" },
    );
    run(
      bin("prisma"),
      ["migrate", "deploy"],
      environment,
      "Generated migration disposable deploy",
    );
    run(
      bin("tsx"),
      ["scripts/postMigrationIntegrity.ts"],
      environment,
      "Generated migration post-integrity",
    );
  }

  const primaryDrift = capture(
    bin("prisma"),
    [
      "migrate",
      "diff",
      "--from-schema-datasource",
      "schema.prisma",
      "--to-schema-datamodel",
      "schema.prisma",
      "--script",
    ],
    environment,
    "Disposable primary drift check",
  );
  if (!emptyMigration(primaryDrift)) {
    throw new Error(
      "Generated migration did not leave the disposable primary aligned with schema.prisma",
    );
  }

  const generatedGraphql = await readFile(
    path.join(process.cwd(), "schema.graphql"),
    "utf8",
  );
  if (generatedGraphql.includes("createInitialUser")) {
    throw new Error(
      "Production migration generation exposed anonymous initial-user bootstrap",
    );
  }
  console.log(
    JSON.stringify({
      productionGeneration: true,
      primaryDatabase: primary.databaseName,
      shadowDatabase: shadow.databaseName,
      generatedMigration,
      schemaDrift: false,
      anonymousInitialUser: false,
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Safe migration generation failed",
  );
  process.exitCode = 1;
});
