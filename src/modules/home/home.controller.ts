import { NextFunction, Request, Response } from "express";
import { homeService } from "./home.service";
import { prisma } from "../../libs/prisma";
import { LostFeedQuery } from "./home.types";

export class HomeController {
  getLostFeed = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id; // optional from optionalAuth
      const validatedRequest = res.locals.validatedRequest as
        { query?: LostFeedQuery } | undefined;
      const query =
        validatedRequest?.query ?? (req.query as unknown as LostFeedQuery);
      const lostFeed = await homeService.getLostFeed(userId, query);

      let userData: {
        userId?: string;
        fullName?: string;
        avatarUrl?: string;
      } | null = null;

      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        });

        if (user) {
          userData = {
            userId: user.id,
            fullName: user.displayName,
            avatarUrl:
              user.photoURL ?? "https://i.pravatar.cc/150?u=placeholder",
          };
        }
      }

      res.json({
        success: true,
        data: {
          user: userData,
          lostFeed,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const homeController = new HomeController();
