import { createAdminClient } from "@supabase/server/core";
import { ENV } from "./env";

let adminClient: ReturnType<typeof createAdminClient> | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_SECRET_KEY);
}

export function getSupabaseAdmin(): ReturnType<typeof createAdminClient> {
  if (!isSupabaseStorageConfigured()) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  if (!adminClient) {
    adminClient = createAdminClient();
  }

  return adminClient;
}
