// Safety guard for the integration test harness. Imported as the very
// first thing by setup.ts so it runs BEFORE any db-touching code loads.
// This file MUST NOT import anything (especially nothing that transitively
// loads ../lib/db.ts), otherwise db.ts's top-level `await db.connect()`
// would race the check.
//
// Two fail-closed conditions:
//   1. BLOGFLOCK_TEST_MODE=1 must be set (only test/run.sh sets it).
//   2. POSTGRES_DB must contain "test" so we can never TRUNCATE a
//      production-shaped database name.
//
// If you find yourself wanting to bypass this, you almost certainly want
// to run `deno task test:integration` instead.

if (Deno.env.get("BLOGFLOCK_TEST_MODE") !== "1") {
  throw new Error(
    "test harness refusing to load: BLOGFLOCK_TEST_MODE != 1. " +
      "Run integration tests via `deno task test:integration` (which " +
      "invokes test/run.sh against an ephemeral postgres). Never run " +
      "`deno test` directly against a real .env — resetDb() would " +
      "TRUNCATE every table.",
  );
}

const targetDb = Deno.env.get("POSTGRES_DB") ?? "";
if (!/test/i.test(targetDb)) {
  throw new Error(
    `test harness refusing to load: POSTGRES_DB="${targetDb}" does not ` +
      `contain "test". Refusing to TRUNCATE a database whose name doesn't ` +
      `look test-shaped.`,
  );
}
