import { Server, Socket } from "socket.io";
import { prisma } from "../libs/prisma";
import { redis } from "../libs/redis";
import { logger } from "../libs/logger";
import {
  HandoverDetails,
  LiveLocation,
  ReturnSession,
  ReturnSessionStatus,
  RewardPayout,
} from "../modules/return/return.types";
import { isActionAllowed } from "../modules/return/return.policy";

const LOCATION_TTL_SECONDS = 120;
const MIN_LOCATION_INTERVAL_MS = 2000;

// Track last location update timestamp per user in memory to throttle
const lastLocationUpdateTimes = new Map<string, number>();
const ROOM_REVOKED_STATES: ReturnSessionStatus[] = [
  "COMPLETED",
  "MEETUP_CANCELLED",
  "TRACKING_EXPIRED",
  "HANDOVER_DISPUTED",
  "REFUND_PENDING",
];

export function toReturnRoomKey(sessionId: string): string {
  return `return:${sessionId}`;
}

let socketServerInstance: Server | null = null;

export function setReturnSocketServer(io: Server) {
  socketServerInstance = io;
}

export function registerReturnSocketHandlers(socket: Socket, io: Server) {
  socketServerInstance = io;
  const userId = String(socket.data.userId || "");

  // return:join
  socket.on(
    "return:join",
    async (
      payload: { sessionId: string },
      ack?: (res: { success: boolean; message?: string }) => void
    ) => {
      try {
        const sessionId = payload?.sessionId;
        if (!sessionId) {
          ack?.({ success: false, message: "sessionId is required" });
          return;
        }

        // Verify participant authorization
        const session = await prisma.returnSession.findUnique({
          where: { id: sessionId },
          select: { id: true, ownerId: true, finderId: true, status: true },
        });

        if (!session) {
          ack?.({ success: false, message: "Return session not found" });
          return;
        }

        if (session.ownerId !== userId && session.finderId !== userId) {
          logger.warn(
            `[ReturnSocket] Unauthorized join attempt by ${userId} to ${sessionId}`
          );
          ack?.({
            success: false,
            message: "You are not a participant in this session",
          });
          return;
        }

        if (
          ROOM_REVOKED_STATES.includes(session.status as ReturnSessionStatus)
        ) {
          ack?.({
            success: false,
            message: "Return session is no longer active",
          });
          return;
        }

        const roomKey = toReturnRoomKey(sessionId);
        await socket.join(roomKey);

        logger.info(`[ReturnSocket] User ${userId} joined room ${roomKey}`);
        ack?.({ success: true });
      } catch (err: any) {
        logger.error("[ReturnSocket] Error on return:join", err);
        ack?.({ success: false, message: err?.message || "Join failed" });
      }
    }
  );

  // return:leave
  socket.on(
    "return:leave",
    async (
      payload: { sessionId: string },
      ack?: (res: { success: boolean }) => void
    ) => {
      try {
        const sessionId = payload?.sessionId;
        if (sessionId) {
          const roomKey = toReturnRoomKey(sessionId);
          await socket.leave(roomKey);
          logger.info(`[ReturnSocket] User ${userId} left room ${roomKey}`);
        }
        ack?.({ success: true });
      } catch {
        ack?.({ success: true });
      }
    }
  );

  // return:update-location
  socket.on(
    "return:update-location",
    async (
      payload: {
        sessionId: string;
        location: LiveLocation;
      },
      ack?: (res: { success: boolean; message?: string }) => void
    ) => {
      try {
        const { sessionId, location } = payload || {};
        if (!sessionId || !location) {
          ack?.({ success: false, message: "sessionId and location required" });
          return;
        }

        const roomKey = toReturnRoomKey(sessionId);
        if (!socket.rooms.has(roomKey)) {
          ack?.({
            success: false,
            message: "Join the authorized return session first",
          });
          return;
        }

        const session = await prisma.returnSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            ownerId: true,
            finderId: true,
            status: true,
            trackingExpiresAt: true,
            serverRevision: true,
          },
        });
        if (
          !session ||
          (session.ownerId !== userId && session.finderId !== userId)
        ) {
          ack?.({
            success: false,
            message: "Not authorized for this return session",
          });
          return;
        }
        if (
          !isActionAllowed(
            "UPDATE_LOCATION",
            session.status as ReturnSessionStatus,
            session.trackingExpiresAt
          )
        ) {
          if (
            ["TRACKING_ACTIVE", "ARRIVAL_PENDING"].includes(session.status) &&
            session.trackingExpiresAt &&
            session.trackingExpiresAt.getTime() <= Date.now()
          ) {
            const updated = await prisma.returnSession.update({
              where: { id: sessionId },
              data: {
                status: "TRACKING_EXPIRED",
                serverRevision: { increment: 1 },
              },
              select: { serverRevision: true },
            });
            await Promise.all([
              redis.del(`return:loc:${sessionId}:${session.ownerId}`),
              redis.del(`return:loc:${sessionId}:${session.finderId}`),
            ]);
            emitReturnLocationCleared(sessionId, updated.serverRevision);
          }
          ack?.({
            success: false,
            message: "Live location sharing is not allowed",
          });
          return;
        }

        // Validate coordinates
        const lat = Number(location.latitude);
        const lng = Number(location.longitude);
        if (
          !Number.isFinite(lat) ||
          lat < -90 ||
          lat > 90 ||
          !Number.isFinite(lng) ||
          lng < -180 ||
          lng > 180
        ) {
          ack?.({ success: false, message: "Invalid latitude or longitude" });
          return;
        }

        // Rate limit: max 1 update every 2 seconds per user
        const now = Date.now();
        const lastUpdate = lastLocationUpdateTimes.get(userId) || 0;
        if (now - lastUpdate < MIN_LOCATION_INTERVAL_MS) {
          ack?.({ success: true, message: "Throttled" });
          return;
        }
        lastLocationUpdateTimes.set(userId, now);

        const normalizedLocation: LiveLocation = {
          latitude: lat,
          longitude: lng,
          accuracy:
            location.accuracy != null ? Number(location.accuracy) : null,
          heading: location.heading != null ? Number(location.heading) : null,
          speed: location.speed != null ? Number(location.speed) : null,
          capturedAt: location.capturedAt || new Date().toISOString(),
          ttlSeconds: LOCATION_TTL_SECONDS,
        };

        // Cache in Redis with short TTL
        const cacheKey = `return:loc:${sessionId}:${userId}`;
        await redis.set(cacheKey, normalizedLocation, LOCATION_TTL_SECONDS);

        // Broadcast to partners in room (excluding sender)
        socket.to(roomKey).emit("return:location-updated", {
          sessionId,
          userId,
          location: normalizedLocation,
        });

        ack?.({ success: true });
      } catch (err: any) {
        logger.error("[ReturnSocket] Error on update-location", err);
        ack?.({
          success: false,
          message: err?.message || "Location update failed",
        });
      }
    }
  );

  socket.on("disconnect", () => {
    lastLocationUpdateTimes.delete(userId);
  });
}

// ─── Broadcasters (Server-to-Client) ──────────────────────────────────────────

export function emitReturnLocationUpdated(
  sessionId: string,
  userId: string,
  location: LiveLocation
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:location-updated", { sessionId, userId, location });
}

export function emitReturnParticipantArrived(
  sessionId: string,
  userId: string
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:participant-arrived", { sessionId, userId });
}

export function emitReturnHandoverUpdated(
  sessionId: string,
  handover: HandoverDetails,
  status: ReturnSessionStatus
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:handover-updated", {
      sessionId,
      status,
      eventType: "HANDOVER_UPDATED",
    });
}

export function emitReturnRewardUpdated(
  sessionId: string,
  reward: RewardPayout,
  status: ReturnSessionStatus
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:reward-updated", {
      sessionId,
      status,
      eventType: "REWARD_UPDATED",
    });
}

export function emitReturnSessionUpdated(
  sessionId: string,
  session: ReturnSession
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:session-updated", {
      sessionId,
      revision: session.serverRevision,
      status: session.status,
      eventType: "SESSION_UPDATED",
    });
}

export function emitReturnLocationCleared(
  sessionId: string,
  revision?: number
): void {
  if (!socketServerInstance) return;
  socketServerInstance
    .to(toReturnRoomKey(sessionId))
    .emit("return:location-cleared", {
      sessionId,
      revision,
      eventType: "LOCATION_CLEARED",
    });
}
