import { NextFunction, Request, Response } from "express";
import { returnService } from "./return.service";
import { guestClaimLifecycleService } from "./guest-claim-lifecycle.service";

function actorId(req: Request): string {
  return req.guest?.id ?? req.user!.id;
}

function getIfMatch(req: Request): number | undefined {
  const header = req.header("If-Match") || req.header("if-match");
  if (header) {
    const parsed = parseInt(header, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

export class ReturnController {
  rejectGuestClaim = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const ownerId = actorId(req);
      const sessionId = req.params.id as string;
      await guestClaimLifecycleService.rejectByOwner(ownerId, sessionId);
      const result = await returnService.getSession(ownerId, sessionId);
      res.status(200).json({
        success: true,
        data: result,
        message: "Guest claim rejected",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns
  createOrGetSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = actorId(req);
      const { channelId, itemId } = req.body;
      const result = await returnService.createOrGetSession(userId, {
        channelId,
        itemId,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: "Return session retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /v1/returns/:id
  getSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const result = await returnService.getSession(userId, sessionId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/meetup/propose
  proposeMeetup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.proposeMeetup(
        userId,
        sessionId,
        req.body,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Meetup proposal submitted",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/meetup/accept
  acceptMeetup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.acceptMeetup(
        userId,
        sessionId,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Meetup accepted",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/meetup/reject
  rejectMeetup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.rejectMeetup(
        userId,
        sessionId,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Meetup rejected",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/tracking/start
  startTracking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.startTracking(
        userId,
        sessionId,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Tracking started",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/tracking/stop
  stopTracking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.stopTracking(
        userId,
        sessionId,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Tracking stopped",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/arrival
  notifyArrival = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.notifyArrival(
        userId,
        sessionId,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Arrival reported",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/cancel
  cancelReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await returnService.cancelReturn(
        actorId(req),
        req.params.id as string,
        getIfMatch(req)
      );
      res.status(200).json({
        success: true,
        data: result,
        message: "Return session cancelled",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/handover/init
  initHandover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const result = await returnService.initHandover(userId, sessionId);

      res.status(200).json({
        success: true,
        data: result,
        message: "Handover initialized",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/handover/confirm
  confirmHandover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.confirmHandover(
        userId,
        sessionId,
        req.body,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Handover confirmed",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/handover/dispute
  disputeHandover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.disputeHandover(
        userId,
        sessionId,
        req.body,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Handover dispute registered",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /v1/returns/:id/reward
  getRewardStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = actorId(req);
      const sessionId = req.params.id as string;
      const result = await returnService.getRewardStatus(userId, sessionId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /v1/returns/:id/rating
  submitRating = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.id as string;
      const ifMatch = getIfMatch(req);
      const result = await returnService.submitRating(
        userId,
        sessionId,
        req.body,
        ifMatch
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Rating submitted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };
}

export const returnController = new ReturnController();
