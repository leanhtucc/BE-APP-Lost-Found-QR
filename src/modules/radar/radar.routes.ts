import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { radarController } from "./radar.controller";
import { radarSimulateSchema } from "./radar.schema";

const router = Router();

// POST /v1/radar/simulate  (no auth required – FE calls when entering screen 2)
router.post(
  "/simulate",
  validate(radarSimulateSchema),
  radarController.simulate
);

export default router;
