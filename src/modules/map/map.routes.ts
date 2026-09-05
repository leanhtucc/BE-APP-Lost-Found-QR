import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
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
  validate(autocompleteSchema),
  mapController.autocomplete
);

router.get(
  "/places/autocomplete",
  validate(autocompleteSchema),
  mapController.autocomplete
);

router.get(
  "/place-details",
  validate(placeDetailsSchema),
  mapController.getPlaceDetails
);

router.get(
  "/places/details",
  validate(placeDetailsSchema),
  mapController.getPlaceDetails
);

router.get(
  "/reverse-geocode",
  validate(reverseGeocodeSchema),
  mapController.reverseGeocode
);

router.get(
  "/geocode",
  validate(geocodeSchema),
  mapController.geocode
);

export default router;

