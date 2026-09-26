import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  deleteUserDeviceSchema,
  registerUserDeviceSchema,
} from "./notification.schema";
import { userDeviceController } from "./user-device.controller";

const router = Router();

router.get("/", authMiddleware, userDeviceController.list);
router.post(
  "/",
  authMiddleware,
  validate(registerUserDeviceSchema),
  userDeviceController.register
);
router.delete(
  "/:id",
  authMiddleware,
  validate(deleteUserDeviceSchema),
  userDeviceController.remove
);

export default router;
