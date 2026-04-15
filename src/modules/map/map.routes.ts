import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { mapController } from "./map.controller";
import { nearbySchema } from "./map.schema";

const router = Router();

// GET /api/map/nearby - requires auth (optional, but we keep auth for now)
router.get(
  "/nearby",
  authMiddleware,
  validate(nearbySchema),
  mapController.getNearby
);

export default router;
