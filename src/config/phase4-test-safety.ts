export interface Phase4DatabaseSafetyInput {
  databaseUrl?: string;
  directUrl?: string;
  testDatabaseUrl?: string;
  productionDatabaseUrl?: string;
  explicitlyConfirmed?: boolean;
}

interface DatabaseIdentity {
  url: URL;
  database: string;
  projectRef: string | null;
  isLocal: boolean;
  isExplicitlyNamedTest: boolean;
}

function parseDatabaseIdentity(
  label: string,
  value: string | undefined
): DatabaseIdentity {
  if (!value) throw new Error(`[Phase 4 safety] Missing ${label}`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`[Phase 4 safety] ${label} is not a valid database URL`);
  }

  const database = url.pathname.slice(1).toLowerCase();
  const directRef = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
  const username = decodeURIComponent(url.username);
  const pooledRef = username.includes(".") ? username.split(".").at(-1) : null;

  return {
    url,
    database,
    projectRef: directRef || pooledRef || null,
    isLocal: ["localhost", "127.0.0.1", "::1"].includes(url.hostname),
    isExplicitlyNamedTest: /test|dev|phase4|local/i.test(database),
  };
}

function sameDatabaseTarget(a: DatabaseIdentity, b: DatabaseIdentity): boolean {
  if (a.projectRef && b.projectRef) return a.projectRef === b.projectRef;
  return (
    a.url.hostname === b.url.hostname &&
    a.url.port === b.url.port &&
    a.database === b.database &&
    decodeURIComponent(a.url.username) === decodeURIComponent(b.url.username)
  );
}

export function assertPhase4TestDatabaseSafety(
  input: Phase4DatabaseSafetyInput
): void {
  const database = parseDatabaseIdentity("DATABASE_URL", input.databaseUrl);
  const direct = parseDatabaseIdentity("DIRECT_URL", input.directUrl);
  const test = parseDatabaseIdentity(
    "PHASE4_TEST_DATABASE_URL/DATABASE_URL_TEST",
    input.testDatabaseUrl
  );
  const production = parseDatabaseIdentity(
    "PHASE4_PRODUCTION_DATABASE_URL",
    input.productionDatabaseUrl
  );

  if (sameDatabaseTarget(test, production)) {
    throw new Error("[Phase 4 safety] Test database resolves to production");
  }
  if (
    sameDatabaseTarget(database, production) ||
    sameDatabaseTarget(direct, production)
  ) {
    throw new Error(
      "[Phase 4 safety] DATABASE_URL or DIRECT_URL resolves to production"
    );
  }
  if (
    !sameDatabaseTarget(database, test) ||
    !sameDatabaseTarget(direct, test)
  ) {
    throw new Error(
      "[Phase 4 safety] DATABASE_URL and DIRECT_URL must both resolve to the declared test database"
    );
  }

  const classificationProven =
    test.isLocal ||
    test.isExplicitlyNamedTest ||
    (input.explicitlyConfirmed === true &&
      Boolean(test.projectRef) &&
      Boolean(production.projectRef) &&
      test.projectRef !== production.projectRef);

  if (!classificationProven) {
    throw new Error(
      "[Phase 4 safety] Safe TEST classification cannot be proven"
    );
  }
}
