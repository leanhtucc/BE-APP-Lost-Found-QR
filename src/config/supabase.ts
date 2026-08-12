import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let adminClient: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseStorageConfigured()) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  if (!adminClient) {
    adminClient = createClient(
      ENV.SUPABASE_URL,
      ENV.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return adminClient;
}
