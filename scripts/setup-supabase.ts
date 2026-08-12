import { ENV } from "../src/config/env";
import { getSupabaseAdmin } from "../src/config/supabase";

const bucketOptions = {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
};

async function main() {
  const bucket = ENV.SUPABASE_STORAGE_BUCKET;
  const supabase = getSupabaseAdmin();
  const { data: existingBucket, error: lookupError } =
    await supabase.storage.getBucket(bucket);

  if (lookupError && lookupError.message !== "Bucket not found") {
    throw lookupError;
  }

  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(
      bucket,
      bucketOptions
    );

    if (createError) {
      throw createError;
    }

    console.log("Created public Supabase Storage bucket: " + bucket);
    return;
  }

  const { error: updateError } = await supabase.storage.updateBucket(
    bucket,
    bucketOptions
  );

  if (updateError) {
    throw updateError;
  }

  console.log("Updated Supabase Storage bucket settings: " + bucket);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
