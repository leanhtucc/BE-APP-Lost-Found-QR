import { Router } from "express";
import { requireGuestAuth } from "../../middlewares/guest-auth.middleware";
import { rateLimit } from "../../middlewares/rate-limit.middleware";
import { guestController } from "./guest.controller";

const router = Router();
router.use(
  rateLimit({
    windowMs: 60_000,
    max: 10,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  })
);
router.post("/refresh", requireGuestAuth, guestController.refresh);
router.post("/stream-token", requireGuestAuth, guestController.streamToken);
export default router;
