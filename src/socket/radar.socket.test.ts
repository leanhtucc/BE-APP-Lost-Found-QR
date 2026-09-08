import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock redis
vi.mock("../libs/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Mock logger
vi.mock("../libs/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock return.socket
vi.mock("./return.socket", () => ({
  registerReturnSocketHandlers: vi.fn(),
}));

import { HOME_LOST_RADIUS_METERS } from "../utils/constants";
import {
  emitLostItemRemovedToNearbyUsers,
  emitLostItemToNearbyUsers,
  initializeSocketServer,
  shutdownSocketServer,
} from "./radar.socket";

describe("RadarSocket", () => {
  let httpServer: http.Server;
  let io: any;

  function createFakeSocket(id: string, userId: string) {
    const listeners = new Map<string, Function>();
    const emittedToSocket: { event: string; data: any }[] = [];

    const socket = {
      id,
      data: { userId },
      handshake: {
        auth: { token: "valid-token" },
        headers: {},
      },
      on: vi.fn((event: string, fn: Function) => {
        listeners.set(event, fn);
      }),
      emit: vi.fn((event: string, data: any) => {
        emittedToSocket.push({ event, data });
      }),
      join: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) {
          if (!io.sockets.adapter.rooms.has(k)) {
            io.sockets.adapter.rooms.set(k, new Set());
          }
          io.sockets.adapter.rooms.get(k).add(id);
        }
      }),
      leave: vi.fn(async (key: string) => {
        const room = io.sockets.adapter.rooms.get(key);
        if (room) {
          room.delete(id);
          if (room.size === 0) {
            io.sockets.adapter.rooms.delete(key);
          }
        }
      }),
      trigger: async (event: string, ...args: any[]) => {
        const fn = listeners.get(event);
        if (fn) return await fn(...args);
      },
      emittedToSocket,
    };

    return socket;
  }

  function connectSocket(socket: any) {
    const listeners = io.of("/").listeners("connection");
    for (const fn of listeners) {
      fn(socket);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    httpServer = http.createServer();
    io = initializeSocketServer(httpServer);
  });

  afterEach(async () => {
    await shutdownSocketServer();
  });

  describe("radar:subscribe and radius clamping", () => {
    it("caps subscription radius to HOME_LOST_RADIUS_METERS (10,000m) when client requests larger", async () => {
      const socket = createFakeSocket("socket-1", "user-1");
      connectSocket(socket);

      let ackResult: any;
      await socket.trigger(
        "radar:subscribe",
        {
          latitude: 21.0285,
          longitude: 105.8542,
          radius: 50000, // 50km requested
        },
        (res: any) => {
          ackResult = res;
        }
      );

      expect(ackResult).toBeDefined();
      expect(ackResult.success).toBe(true);
      expect(ackResult.data.radiusMeters).toBe(HOME_LOST_RADIUS_METERS);
      expect(socket.join).toHaveBeenCalled();
    });

    it("rejects subscription when radius is below minimum (< 100m)", async () => {
      const socket = createFakeSocket("socket-2", "user-2");
      connectSocket(socket);

      let ackResult: any;
      await socket.trigger(
        "radar:subscribe",
        {
          latitude: 21.0285,
          longitude: 105.8542,
          radius: 50, // Below min 100m
        },
        (res: any) => {
          ackResult = res;
        }
      );

      expect(ackResult).toBeDefined();
      expect(ackResult.success).toBe(false);
      expect(ackResult.message).toContain("at least 100 meters");
    });

    it("rejects subscription when coordinates are invalid", async () => {
      const socket = createFakeSocket("socket-3", "user-3");
      connectSocket(socket);

      let ackResult: any;
      await socket.trigger(
        "radar:subscribe",
        {
          latitude: 95, // Invalid latitude
          longitude: 105.8542,
        },
        (res: any) => {
          ackResult = res;
        }
      );

      expect(ackResult).toBeDefined();
      expect(ackResult.success).toBe(false);
      expect(ackResult.message).toContain("Invalid latitude");
    });
  });

  describe("radar:new-lost-item targeting", () => {
    it("delivers new lost item to subscribers within radius and filters out subscribers beyond radius", async () => {
      const deliveries = new Map<string, any[]>();
      vi.spyOn(io, "to").mockImplementation((...args: any[]) => {
        const targetId = String(args[0]);
        return {
          emit: (eventName: string, payload: any) => {
            if (!deliveries.has(targetId)) deliveries.set(targetId, []);
            deliveries.get(targetId)!.push({ eventName, payload });
          },
        } as any;
      });

      // Socket A is at Hoan Kiem (~500m from lost item at 21.0285, 105.8542)
      const socketA = createFakeSocket("socket-near", "user-a");
      connectSocket(socketA);
      await socketA.trigger("radar:subscribe", {
        latitude: 21.031,
        longitude: 105.852,
        radius: 3000,
      });

      // Socket B is at Ha Dong (~12km from lost item)
      const socketB = createFakeSocket("socket-far", "user-b");
      connectSocket(socketB);
      await socketB.trigger("radar:subscribe", {
        latitude: 20.972,
        longitude: 105.777,
        radius: 5000,
      });

      // Emit new lost item at Hoan Kiem
      await emitLostItemToNearbyUsers({
        id: "item-internal-id",
        itemId: "item-public-id",
        name: "Ví da",
        category: "wallet",
        latitude: 21.0285,
        longitude: 105.8542,
        reportedAt: new Date().toISOString(),
      });

      // Near socket should receive the event
      const nearEvents = deliveries.get("socket-near") || [];
      expect(nearEvents.length).toBe(1);
      expect(nearEvents[0].eventName).toBe("radar:new-lost-item");
      expect(nearEvents[0].payload.itemId).toBe("item-public-id");
      expect(nearEvents[0].payload.distanceMeters).toBeLessThan(3000);

      // Far socket should NOT receive the event
      const farEvents = deliveries.get("socket-far") || [];
      expect(farEvents.length).toBe(0);
    });
  });

  describe("radar:lost-item-removed targeting", () => {
    it("delivers item removed event to subscribers within radius", async () => {
      const deliveries = new Map<string, any[]>();
      vi.spyOn(io, "to").mockImplementation((...args: any[]) => {
        const targetId = String(args[0]);
        return {
          emit: (eventName: string, payload: any) => {
            if (!deliveries.has(targetId)) deliveries.set(targetId, []);
            deliveries.get(targetId)!.push({ eventName, payload });
          },
        } as any;
      });

      const socket = createFakeSocket("socket-remove", "user-remove");
      connectSocket(socket);
      await socket.trigger("radar:subscribe", {
        latitude: 21.0285,
        longitude: 105.8542,
        radius: 5000,
      });

      await emitLostItemRemovedToNearbyUsers({
        itemId: "item-public-id",
        latitude: 21.029,
        longitude: 105.855,
        status: "SAFE",
        removedAt: new Date().toISOString(),
      });

      const events = deliveries.get("socket-remove") || [];
      expect(events.length).toBe(1);
      expect(events[0].eventName).toBe("radar:lost-item-removed");
      expect(events[0].payload).toMatchObject({
        itemId: "item-public-id",
        status: "SAFE",
      });
    });
  });

  describe("radar:unsubscribe and disconnect", () => {
    it("removes active subscription when unsubscribe is called", async () => {
      const socket = createFakeSocket("socket-unsub", "user-unsub");
      connectSocket(socket);
      await socket.trigger("radar:subscribe", {
        latitude: 21.0285,
        longitude: 105.8542,
        radius: 3000,
      });

      let unsubAck: any;
      await socket.trigger("radar:unsubscribe", (res: any) => {
        unsubAck = res;
      });

      expect(unsubAck).toEqual({ success: true });
      expect(socket.leave).toHaveBeenCalled();
    });
  });
});
