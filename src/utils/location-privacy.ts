/**
 * Helpers that blur a finder's location before it is shown to other people.
 * Coordinates are snapped to a ~110 m grid and street-level address parts are removed.
 */

const GRID = 1000; // 3 decimal places ≈ 110 m

export function blurCoordinate(value: number): number {
  return Math.round(value * GRID) / GRID;
}

const COORDINATE_TEXT = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

/**
 * Drop the street-level part (the first segment) of a formatted address and
 * never echo raw coordinates typed as an address.
 */
export function blurAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed || COORDINATE_TEXT.test(trimmed)) return "Khu vực lân cận";

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts.slice(1).join(", ");
  if (parts.length === 2 && /\d/.test(parts[0]!)) return parts[1]!;
  if (parts.length === 1 && /\d/.test(parts[0]!)) return "Khu vực lân cận";
  return parts.join(", ");
}

/** Replace location fields of a found report with their public (blurred) form. */
export function blurReportLocation<
  T extends { lat: number; lng: number; address: string },
>(report: T): T {
  return {
    ...report,
    lat: blurCoordinate(report.lat),
    lng: blurCoordinate(report.lng),
    address: blurAddress(report.address),
  };
}
