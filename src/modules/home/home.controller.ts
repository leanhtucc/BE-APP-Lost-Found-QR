import { NextFunction, Request, Response } from "express";
import { homeService } from "./home.service";
import { prisma } from "../../libs/prisma";

export class HomeController {
  getLostFeed = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id || "";
      const lat =
        req.query.lat !== undefined && req.query.lat !== ""
          ? Number(req.query.lat)
          : undefined;
      const lng =
        req.query.lng !== undefined && req.query.lng !== ""
          ? Number(req.query.lng)
          : undefined;
      const radius =
        req.query.radius !== undefined && req.query.radius !== ""
          ? Number(req.query.radius)
          : 50000;

      const lostFeed = await homeService.getLostFeed(userId, {
        lat,
        lng,
        radius,
      });

      const user = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              displayName: true,
              photoURL: true,
            },
          })
        : null;

      res.json({
        success: true,
        data: {
          user: {
            userId: user?.id,
            fullName: user?.displayName,
            avatarUrl:
              user?.photoURL ?? "https://i.pravatar.cc/150?u=placeholder",
          },
          lostFeed,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const homeController = new HomeController();
