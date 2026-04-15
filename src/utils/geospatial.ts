const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const EARTH_RADIUS_METERS = 6371000;

const GEOHASH_CELL_SIZE_METERS: Record<
  number,
  { height: number; width: number }
> = {
  1: { height: 5009400, width: 4992600 },
  2: { height: 1252300, width: 624100 },
  3: { height: 156500, width: 156000 },
  4: { height: 39100, width: 19500 },
  5: { height: 4900, width: 4900 },
  6: { height: 1200, width: 609 },
  7: { height: 153, width: 152 },
  8: { height: 38.2, width: 19 },
};

export function encodeGeoHash(
  latitude: number,
  longitude: number,
  precision = 6
): string {
  let isEvenBit = true;
  let bit = 0;
  let hash = 0;
  let geohash = "";

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (isEvenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) {
        hash = (hash << 1) + 1;
        lngMin = mid;
      } else {
        hash <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        hash = (hash << 1) + 1;
        latMin = mid;
      } else {
        hash <<= 1;
        latMax = mid;
      }
    }

    isEvenBit = !isEvenBit;

    if (++bit === 5) {
      geohash += GEOHASH_BASE32[hash];
      bit = 0;
      hash = 0;
    }
  }

  return geohash;
}

export function getGeoHashPrecisionForRadius(radiusMeters: number): number {
  if (radiusMeters <= 150) {
    return 7;
  }
  if (radiusMeters <= 2000) {
    return 6;
  }
  return 5;
}

export function getGeoHashCellsCoveringRadius(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  precision: number,
  maxCells = 300
): string[] {
  const cellSize =
    GEOHASH_CELL_SIZE_METERS[precision] || GEOHASH_CELL_SIZE_METERS[6];

  if (!cellSize) {
    return [];
  }

  const metersPerLatDegree = 111320;
  const metersPerLngDegree = Math.max(
    1,
    Math.cos((latitude * Math.PI) / 180) * metersPerLatDegree
  );

  const latRange = radiusMeters / metersPerLatDegree;
  const lngRange = radiusMeters / metersPerLngDegree;

  const latStep = Math.max(cellSize.height / 2 / metersPerLatDegree, 0.00001);
  const lngStep = Math.max(cellSize.width / 2 / metersPerLngDegree, 0.00001);

  const cells = new Set<string>();

  for (let latOffset = -latRange; latOffset <= latRange; latOffset += latStep) {
    for (
      let lngOffset = -lngRange;
      lngOffset <= lngRange;
      lngOffset += lngStep
    ) {
      cells.add(
        encodeGeoHash(latitude + latOffset, longitude + lngOffset, precision)
      );

      if (cells.size > maxCells) {
        return [];
      }
    }
  }

  cells.add(encodeGeoHash(latitude, longitude, precision));
  return Array.from(cells);
}

export function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const latDelta = ((toLat - fromLat) * Math.PI) / 180;
  const lngDelta = ((toLng - fromLng) * Math.PI) / 180;

  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}
