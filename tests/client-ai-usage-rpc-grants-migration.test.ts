import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260904120000_harden_client_ai_usage_rpc_grants.sql",
  import.meta.url,
);

test("client AI usage mutation RPCs remain service-role only", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /REVOKE EXECUTE ON FUNCTION public\.increment_client_ai_monthly_usage\(uuid, date, integer\)\s+FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.increment_client_ai_monthly_usage\(uuid, date, integer\)\s+TO service_role;/,
  );
  assert.match(
    migration,
    /REVOKE EXECUTE ON FUNCTION public\.decrement_client_ai_monthly_usage\(uuid, date\)\s+FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.decrement_client_ai_monthly_usage\(uuid, date\)\s+TO service_role;/,
  );
});
