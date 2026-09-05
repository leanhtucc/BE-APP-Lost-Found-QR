import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { ENV } from "../config/env";
import { verifyAccessToken } from "../libs/jwt";
import { logger } from "../libs/logger";
import { redis } from "../libs/redis";
import {
  encodeGeoHash,
  getGeoHashCellsCoveringRadius,
  getGeoHashPrecisionForRadius,
  haversineDistanceMeters,
} from "../utils/geospatial";
import { registerReturnSocketHandlers } from "./return.socket";

const MIN_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 20000;
const DEFAULT_RADIUS_METERS = 3000;
const HEARTBEAT_TTL_SECONDS = 120;
const MAX_GEOHASH_ROOM_CELLS = 500;
const EMIT_MATCH_PRECISIONS = [3, 4, 5, 6, 7] as const;

interface RadarSubscriptionPayload {
  latitude: number;
  longitude: number;
  radius?: number;
}

interface RadarSubscription {
  socketId: string;
  userId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  precision: number;
  roomKeys: string[];
  updatedAt: string;
}

export interface LostItemRadarEvent {
  id: string;
  itemId: string;
  name: string;
  category: string;
  description?: string;
  lostMessage?: string;
  imagePublicUrl?: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
}

interface SocketAck {
  (payload: {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
  }): void;
}

const activeSubscriptions = new Map<string, RadarSubscription>();
let ioInstance: Server | null = null;

function toRoomKey(precision: number, geohash: string): string {
  return `radar:p${precision}:${geohash}`;
}

function toUserRoomKey(userId: string): string {
  return `user:${userId}`;
}

function getAuthToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === "string" && authToken.trim().length > 0) {
    return authToken.replace("Bearer ", "").trim();
  }

  const headerValue = socket.handshake.headers.authorization;

  if (typeof headerValue === "string" && headerValue.startsWith("Bearer ")) {
    return headerValue.slice(7).trim();
  }

  return null;
}

function normalizeRadarPayload(payload: RadarSubscriptionPayload): {
  latitude: number;
  longitude: number;
  radiusMeters: number;
} {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const radiusMeters = payload.radius
    ? Number(payload.radius)
    : DEFAULT_RADIUS_METERS;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude");
  }

  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters < MIN_RADIUS_METERS ||
    radiusMeters > MAX_RADIUS_METERS
  ) {
    throw new Error(
      `Radius must be between ${MIN_RADIUS_METERS} and ${MAX_RADIUS_METERS} meters`
    );
  }

  return {
    latitude,
    longitude,
    radiusMeters,
  };
}

async function persistHeartbeat(subscription: RadarSubscription) {
  const heartbeatKey = `radar:heartbeat:${subscription.userId}:${subscription.socketId}`;

  await redis.set(
    heartbeatKey,
    {
      userId: subscription.userId,
      socketId: subscription.socketId,
      latitude: subscription.latitude,
      longitude: subscription.longitude,
      radiusMeters: subscription.radiusMeters,
      updatedAt: subscription.updatedAt,
    },
    HEARTBEAT_TTL_SECONDS
  );
}

async function clearHeartbeat(subscription: RadarSubscription | undefined) {
  if (!subscription) {
    return;
  }

  const heartbeatKey = `radar:heartbeat:${subscription.userId}:${subscription.socketId}`;
  await redis.del(heartbeatKey);
}

async function removeSubscription(socket: Socket) {
  const current = activeSubscriptions.get(socket.id);

  if (!current) {
    return;
  }

  if (current.roomKeys.length > 0) {
    for (const roomKey of current.roomKeys) {
      await socket.leave(roomKey);
    }
  }

  activeSubscriptions.delete(socket.id);
  await clearHeartbeat(current);
}

async function upsertSubscription(
  socket: Socket,
  payload: RadarSubscriptionPayload,
  ack?: SocketAck
) {
  const normalized = normalizeRadarPayload(payload);
  const previous = activeSubscriptions.get(socket.id);

  if (previous?.roomKeys.length) {
    for (const roomKey of previous.roomKeys) {
      await socket.leave(roomKey);
    }
  }

  let precision = getGeoHashPrecisionForRadius(normalized.radiusMeters);
  let geohashCells = getGeoHashCellsCoveringRadius(
    normalized.latitude,
    normalized.longitude,
    normalized.radiusMeters,
    precision,
    MAX_GEOHASH_ROOM_CELLS
  );

  while (geohashCells.length === 0 && precision > 3) {
    precision -= 1;
    geohashCells = getGeoHashCellsCoveringRadius(
      normalized.latitude,
      normalized.longitude,
      normalized.radiusMeters,
      precision,
      MAX_GEOHASH_ROOM_CELLS
    );
  }

  const effectiveCells =
    geohashCells.length > 0
      ? geohashCells
      : [encodeGeoHash(normalized.latitude, normalized.longitude, precision)];

  const roomKeys = effectiveCells.map((cell) => toRoomKey(precision, cell));
  await socket.join(roomKeys);

  const userId = String(socket.data.userId || "");
  const subscription: RadarSubscription = {
    socketId: socket.id,
    userId,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    radiusMeters: normalized.radiusMeters,
    precision,
    roomKeys,
    updatedAt: new Date().toISOString(),
  };

  activeSubscriptions.set(socket.id, subscription);
  await persistHeartbeat(subscription);

  ack?.({
    success: true,
    data: {
      joinedRooms: roomKeys.length,
      precision,
      radiusMeters: normalized.radiusMeters,
    },
  });
}

export function initializeSocketServer(httpServer: HttpServer): Server {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: ENV.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    const token = getAuthToken(socket);

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = String(socket.data.userId || "");
    if (userId) {
      socket.join(toUserRoomKey(userId));
    }

    logger.info("[RadarSocket] Client connected", { socketId: socket.id });
    registerReturnSocketHandlers(socket, ioInstance!);

    socket.on(
      "radar:subscribe",
      async (payload: RadarSubscriptionPayload, ack?: SocketAck) => {
        try {
          await upsertSubscription(socket, payload, ack);
        } catch (error: any) {
          ack?.({
            success: false,
            message: error?.message || "Unable to subscribe radar",
          });
        }
      }
    );

    socket.on(
      "radar:heartbeat",
      async (payload: RadarSubscriptionPayload, ack?: SocketAck) => {
        try {
          const current = activeSubscriptions.get(socket.id);

          const fallbackPayload: RadarSubscriptionPayload = {
            latitude: payload.latitude,
            longitude: payload.longitude,
            radius:
              payload.radius || current?.radiusMeters || DEFAULT_RADIUS_METERS,
          };

          await upsertSubscription(socket, fallbackPayload, ack);
        } catch (error: any) {
          ack?.({
            success: false,
            message: error?.message || "Unable to process heartbeat",
          });
        }
      }
    );

    socket.on("radar:unsubscribe", async (ack?: SocketAck) => {
      try {
        await removeSubscription(socket);
        ack?.({ success: true });
      } catch (error: any) {
        ack?.({
          success: false,
          message: error?.message || "Unable to unsubscribe radar",
        });
      }
    });

    socket.on("disconnect", async () => {
      await removeSubscription(socket);
      logger.info("[RadarSocket] Client disconnected", { socketId: socket.id });
    });
  });

  return ioInstance;
}

export async function emitLostItemToNearbyUsers(event: LostItemRadarEvent) {
  if (!ioInstance) {
    return;
  }

  const candidateSocketIds = new Set<string>();

  for (const precision of EMIT_MATCH_PRECISIONS) {
    const geohash = encodeGeoHash(event.latitude, event.longitude, precision);
    const roomKey = toRoomKey(precision, geohash);
    const socketsInRoom = ioInstance.sockets.adapter.rooms.get(roomKey);

    if (!socketsInRoom) {
      continue;
    }

    for (const socketId of socketsInRoom) {
      candidateSocketIds.add(socketId);
    }
  }

  let deliveredCount = 0;

  for (const socketId of candidateSocketIds) {
    const subscription = activeSubscriptions.get(socketId);

    if (!subscription) {
      continue;
    }

    const distanceMeters = haversineDistanceMeters(
      subscription.latitude,
      subscription.longitude,
      event.latitude,
      event.longitude
    );

    if (distanceMeters > subscription.radiusMeters) {
      continue;
    }

    ioInstance.to(socketId).emit("radar:new-lost-item", {
      ...event,
      distanceMeters: Math.round(distanceMeters),
    });

    deliveredCount += 1;
  }

  logger.info("[RadarSocket] Lost item notification dispatched", {
    itemId: event.itemId,
    matchedSockets: candidateSocketIds.size,
    deliveredCount,
  });
}

export async function shutdownSocketServer(): Promise<void> {
  if (!ioInstance) {
    return;
  }

  activeSubscriptions.clear();

  await new Promise<void>((resolve) => {
    ioInstance?.close(() => resolve());
  });

  ioInstance = null;
}

export function emitInAppNotificationToUser(
  userId: string,
  payload: unknown,
  eventName = "notification:new"
): boolean {
  if (!ioInstance || !userId) {
    return false;
  }

  ioInstance.to(toUserRoomKey(userId)).emit(eventName, payload);
  return true;
}

export function getSocketServer(): Server | null {
  return ioInstance;
}
