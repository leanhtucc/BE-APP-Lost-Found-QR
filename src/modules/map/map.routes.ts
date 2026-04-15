import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { MapController } from "./map.controller";
import { nearbyMapSchema } from "./map.schema";

const router = Router();
const mapController = new MapController();

// GET /api/map/nearby
router.get(
  "/nearby",
  authMiddleware,
  validate(nearbyMapSchema),
  mapController.getNearbyItems
);

export default router;
