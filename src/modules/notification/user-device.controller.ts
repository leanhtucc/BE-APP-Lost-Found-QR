import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { notificationService } from "./notification.service";

export class UserDeviceController {
  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const devices = await notificationService.getUserDevices(req.user!.id);
      ResponseUtil.success(res, devices, "Get user devices successfully.");
    } catch (error) {
      next(error);
    }
  };

  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const device = await notificationService.registerDevice(
        req.user!.id,
        req.body
      );
      ResponseUtil.success(res, device, "Device registered successfully.");
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await notificationService.unregisterDeviceById(
        req.user!.id,
        req.params.id || ""
      );
      ResponseUtil.success(res, null, "Device removed successfully.");
    } catch (error) {
      next(error);
    }
  };
}

export const userDeviceController = new UserDeviceController();
