import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { rateLimit } from "../../middlewares/rate-limit.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { mapController } from "./map.controller";
import {
  activeUsersSchema,
  autocompleteSchema,
  geocodeSchema,
  nearbySchema,
  placeDetailsSchema,
  reverseGeocodeSchema,
} from "./map.schema";

const router = Router();

// Focused rate limiter for public billing-sensitive Places API endpoints
const placesLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// GET /api/map/nearby - requires auth (optional, but we keep auth for now)
router.get(
  "/nearby",
  authMiddleware,
  validate(nearbySchema),
  mapController.getNearby
);

// GET /api/map/active-users
router.get(
  "/active-users",
  authMiddleware,
  validate(activeUsersSchema),
  mapController.countActiveUsers
);

// Map Search & Geocoding Endpoints (Accessible for place searching in reports/vault)
router.get(
  "/autocomplete",
  placesLimiter,
  validate(autocompleteSchema),
  mapController.autocomplete
);

router.get(
  "/places/autocomplete",
  placesLimiter,
  validate(autocompleteSchema),
  mapController.autocomplete
);

router.get(
  "/place-details",
  placesLimiter,
  validate(placeDetailsSchema),
  mapController.getPlaceDetails
);

router.get(
  "/places/details",
  placesLimiter,
  validate(placeDetailsSchema),
  mapController.getPlaceDetails
);

router.get(
  "/reverse-geocode",
  validate(reverseGeocodeSchema),
  mapController.reverseGeocode
);

router.get("/geocode", validate(geocodeSchema), mapController.geocode);

export default router;
