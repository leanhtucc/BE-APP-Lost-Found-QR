import { ENV } from "../../config/env";
import { logger } from "../../libs/logger";
import { countActiveUsersNear, findNearbyLostItems } from "./map.repository";
import {
  GeocodeResult,
  NearbyMapItemPublic,
  NearbyMapQuery,
  PlaceAutocompletePrediction,
  PlaceDetailsResult,
} from "./map.types";

export class MapService {
  async getNearby(query: NearbyMapQuery): Promise<NearbyMapItemPublic[]> {
    return await findNearbyLostItems(query);
  }

  async countActiveUsers(
    lat: number,
    lng: number,
    radius: number
  ): Promise<number> {
    return await countActiveUsersNear(lat, lng, radius);
  }

  /**
   * Search for address suggestions using Google Places API (New & Legacy).
   */
  async autocomplete(
    input: string,
    options?: { lat?: number; lng?: number; radius?: number; sessionToken?: string }
  ): Promise<PlaceAutocompletePrediction[]> {
    const trimmed = input.trim();
    if (!trimmed) return [];

    const apiKey = ENV.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.warn("GOOGLE_MAPS_API_KEY is not set. Map search will return empty results.");
      return [];
    }

    // 1. Try Google Places API (New)
    try {
      const payload: Record<string, unknown> = {
        input: trimmed,
        includedRegionCodes: ["vn"],
        languageCode: "vi",
      };

      if (options?.lat !== undefined && options?.lng !== undefined) {
        payload.locationBias = {
          circle: {
            center: {
              latitude: options.lat,
              longitude: options.lng,
            },
            radius: options.radius ?? 10000.0,
          },
        };
      }

      if (options?.sessionToken) {
        payload.sessionToken = options.sessionToken;
      }

      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          return data.suggestions.map((item: any) => {
            const pred = item.placePrediction || {};
            const placeId = pred.placeId || (pred.place ? String(pred.place).replace(/^places\//, "") : "");
            const description = pred.text?.text || "";
            const mainText = pred.structuredFormat?.mainText?.text || description;
            const secondaryText = pred.structuredFormat?.secondaryText?.text || "";
            return {
              place_id: placeId,
              description,
              main_text: mainText,
              secondary_text: secondaryText,
            };
          });
        }
      }
    } catch (err: any) {
      logger.warn(`Google Places API (New) autocomplete error: ${err?.message}`);
    }

    // 2. Fallback to Legacy Google Places Autocomplete API
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", trimmed);
      url.searchParams.set("components", "country:vn");
      url.searchParams.set("language", "vi");
      url.searchParams.set("key", apiKey);

      if (options?.lat !== undefined && options?.lng !== undefined) {
        url.searchParams.set("location", `${options.lat},${options.lng}`);
        url.searchParams.set("radius", String(options.radius ?? 10000));
      }
      if (options?.sessionToken) {
        url.searchParams.set("sessiontoken", options.sessionToken);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.status === "OK" && Array.isArray(data.predictions) && data.predictions.length > 0) {
          return data.predictions.map((item: any) => ({
            place_id: item.place_id,
            description: item.description,
            main_text: item.structured_formatting?.main_text || item.description,
            secondary_text: item.structured_formatting?.secondary_text || "",
          }));
        }
      }
    } catch (err: any) {
      logger.warn(`Google Places Legacy autocomplete error: ${err?.message}`);
    }

    // 3. Fallback to Geocoding API if Places API is not active
    try {
      const geoResults = await this.geocode(trimmed);
      if (geoResults) {
        return [
          {
            place_id: geoResults.place_id || `geo_${geoResults.lat}_${geoResults.lng}`,
            description: geoResults.formatted_address,
            main_text: geoResults.formatted_address.split(",")[0]?.trim() || geoResults.formatted_address,
            secondary_text: geoResults.formatted_address.split(",").slice(1).join(",").trim(),
          },
        ];
      }
    } catch (err: any) {
      logger.warn(`Geocode autocomplete fallback error: ${err?.message}`);
    }

    return [];
  }

  /**
   * Get full details (lat, lng, formatted address) from place_id.
   */
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<PlaceDetailsResult | null> {
    const apiKey = ENV.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    // If placeId is a custom fallback ID (geo_lat_lng)
    if (placeId.startsWith("geo_")) {
      const parts = placeId.split("_");
      const lat = parseFloat(parts[1] || "0");
      const lng = parseFloat(parts[2] || "0");
      const rev = await this.reverseGeocode(lat, lng);
      return {
        place_id: placeId,
        name: rev?.formatted_address.split(",")[0]?.trim() || "Vị trí đã chọn",
        formatted_address: rev?.formatted_address || `${lat}, ${lng}`,
        lat,
        lng,
      };
    }

    // 1. Try Places API (New) Place Details
    try {
      const cleanPlaceId = placeId.startsWith("places/") ? placeId.replace(/^places\//, "") : placeId;
      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanPlaceId)}`;
      const headers: Record<string, string> = {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        "Accept-Language": "vi",
      };
      if (sessionToken) {
        headers["X-Goog-Session-Token"] = sessionToken;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.location?.latitude && data.location?.longitude) {
          return {
            place_id: data.id || cleanPlaceId,
            name: data.displayName?.text || data.formattedAddress?.split(",")[0]?.trim() || "",
            formatted_address: data.formattedAddress || "",
            lat: data.location.latitude,
            lng: data.location.longitude,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`Google Place Details (New) error: ${err?.message}`);
    }

    // 2. Fallback to Legacy Google Place Details
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "geometry,formatted_address,name");
      url.searchParams.set("language", "vi");
      url.searchParams.set("key", apiKey);
      if (sessionToken) {
        url.searchParams.set("sessiontoken", sessionToken);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.status === "OK" && data.result?.geometry?.location) {
          return {
            place_id: placeId,
            name: data.result.name || data.result.formatted_address?.split(",")[0]?.trim() || "",
            formatted_address: data.result.formatted_address || "",
            lat: data.result.geometry.location.lat,
            lng: data.result.geometry.location.lng,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`Google Place Details Legacy error: ${err?.message}`);
    }

    // 3. Fallback to Geocoding by place_id
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("language", "vi");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
          const res = data.results[0];
          return {
            place_id: placeId,
            name: res.formatted_address?.split(",")[0]?.trim() || "",
            formatted_address: res.formatted_address || "",
            lat: res.geometry.location.lat,
            lng: res.geometry.location.lng,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`Geocode place_id lookup error: ${err?.message}`);
    }

    return null;
  }

  /**
   * Reverse geocode: Coordinates (lat, lng) -> Vietnamese formatted address.
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    const apiKey = ENV.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("language", "vi");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
          const first = data.results[0];
          return {
            formatted_address: first.formatted_address || `${lat}, ${lng}`,
            lat: first.geometry?.location?.lat ?? lat,
            lng: first.geometry?.location?.lng ?? lng,
            place_id: first.place_id,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`Google Reverse Geocode error: ${err?.message}`);
    }

    return null;
  }

  /**
   * Forward geocode: Address string -> Coordinates (lat, lng).
   */
  async geocode(address: string): Promise<GeocodeResult | null> {
    const apiKey = ENV.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", address);
      url.searchParams.set("components", "country:vn");
      url.searchParams.set("language", "vi");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
          const first = data.results[0];
          return {
            formatted_address: first.formatted_address || address,
            lat: first.geometry?.location?.lat,
            lng: first.geometry?.location?.lng,
            place_id: first.place_id,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`Google Geocode error: ${err?.message}`);
    }

    return null;
  }
}

export const mapService = new MapService();

