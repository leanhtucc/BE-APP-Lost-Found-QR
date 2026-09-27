export interface NonProductionDatabaseSafetyInput {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  directUrl: string;
  allowRemoteNonProductionDatabase?: boolean;
}

function databaseHost(label: string, value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error(`[Database safety] ${label} is not a valid database URL`);
  }
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Development and test default to local databases. A remote non-production
 * database requires an explicit opt-in so a copied production URL cannot be
 * used silently. Production behavior is unchanged.
 */
export function assertNonProductionDatabaseSafety(
  input: NonProductionDatabaseSafetyInput
): void {
  if (input.nodeEnv === "production") return;

  const databaseHostName = databaseHost("DATABASE_URL", input.databaseUrl);
  const directHostName = databaseHost("DIRECT_URL", input.directUrl);
  const bothLocal = isLoopback(databaseHostName) && isLoopback(directHostName);

  if (!bothLocal && !input.allowRemoteNonProductionDatabase) {
    throw new Error(
      "[Database safety] Remote DATABASE_URL/DIRECT_URL is blocked outside production. " +
        "Set ALLOW_REMOTE_NON_PRODUCTION_DATABASE=true only after verifying the target is non-production."
    );
  }
}
