import { resolveEnv } from "@supabase/server/core";
import { ENV } from "../src/config/env";
import { getSupabaseAdmin } from "../src/config/supabase";

async function main() {
  const { data: supabaseEnv, error: envError } = resolveEnv();
  if (envError) {
    throw envError;
  }

  if (!supabaseEnv.publishableKeys.default) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is missing");
  }

  if (!supabaseEnv.secretKeys.default) {
    throw new Error("SUPABASE_SECRET_KEY is missing");
  }

  if (!supabaseEnv.jwks) {
    throw new Error("SUPABASE_JWKS_URL is missing or invalid");
  }

  const bucket = ENV.SUPABASE_STORAGE_BUCKET;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.getBucket(bucket);

  if (error) {
    throw new Error(
      `Unable to access Supabase Storage bucket "${bucket}": ${error.message}`
    );
  }

  if (!data.public) {
    throw new Error(
      `Supabase Storage bucket "${bucket}" must be public because the API returns getPublicUrl() links.`
    );
  }

  console.log(
    `Supabase Storage is configured: bucket="${data.name}", public=true`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
