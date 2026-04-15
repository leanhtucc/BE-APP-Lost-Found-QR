-- Enable PostGIS for spatial operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Live Radar geospatial columns
ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "location_geohash" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "location" geography(Point,4326),
  ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);

-- Spatial index for fast ST_DWithin / ST_Distance queries
CREATE INDEX IF NOT EXISTS "Item_location_gist_idx"
  ON "Item" USING GIST ("location");

-- Prefix filtering index for optional geohash pre-filtering on high-volume datasets
CREATE INDEX IF NOT EXISTS "Item_location_geohash_idx"
  ON "Item" ("location_geohash");
