import { NextFunction, Request, Response } from "express";
import { authenticateAccessToken } from "../libs/supabase-auth";
import { guestMaxAgeSeconds, verifyGuestToken } from "../libs/guest-jwt";
import { prisma } from "../libs/prisma";
import { ResponseUtil } from "../utils/response";

async function validateGuest(token: string, req: Request) {
  const claims = verifyGuestToken(token);
  if (Math.floor(Date.now() / 1000) > claims.oiat + guestMaxAgeSeconds()) {
    throw new Error("Guest session maximum age exceeded");
  }
  const guest = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, role: true, scheduledDeletionAt: true },
  });
  if (!guest || guest.role !== "guest" || guest.scheduledDeletionAt) {
    throw new Error("Guest account is not active");
  }
  const session = await prisma.returnSession.findUnique({
    where: { id: claims.rsid },
    select: { id: true, finderId: true, status: true },
  });
  if (!session || session.finderId !== guest.id) {
    throw Object.assign(new Error("Guest session is not authorized"), {
      status: 403,
    });
  }
  if (session.status === "COMPLETED" || session.status === "MEETUP_CANCELLED") {
    throw Object.assign(new Error("Return session is closed"), { status: 403 });
  }
  if (req.params.id && req.params.id !== session.id) {
    throw Object.assign(new Error("Guest token is scoped to another return"), {
      status: 403,
    });
  }
  req.guest = { id: guest.id, returnSessionId: session.id, oiat: claims.oiat };
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.substring(7) : undefined;
}

export async function requireGuestAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = bearer(req);
    if (!token) return ResponseUtil.unauthorized(res, "No token provided");
    await validateGuest(token, req);
    next();
  } catch (error: any) {
    const status = error.status === 403 ? 403 : 401;
    return res.status(status).json({
      success: false,
      message: status === 403 ? error.message : "Invalid guest session",
    });
  }
}

export async function guestOrUserAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = bearer(req);
  if (!token) return ResponseUtil.unauthorized(res, "No token provided");
  try {
    const user = await authenticateAccessToken(token, false);
    if (user) {
      const localUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { tokenVersion: true, scheduledDeletionAt: true },
      });
      if (
        !localUser ||
        localUser.scheduledDeletionAt ||
        (user.tokenVersion ?? 0) !== localUser.tokenVersion
      ) {
        return ResponseUtil.unauthorized(res, "Account is not active");
      }
      req.user = user;
      return next();
    }
  } catch {
    // A guest token is signed with a separate key and is checked below.
  }
  try {
    await validateGuest(token, req);
    next();
  } catch (error: any) {
    const status = error.status === 403 ? 403 : 401;
    return res.status(status).json({
      success: false,
      message: status === 403 ? error.message : "Invalid guest session",
    });
  }
}
