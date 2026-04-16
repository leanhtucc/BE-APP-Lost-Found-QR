import { createClient, RedisClientType } from "redis";
import { ENV } from "../config/env";
import { logger } from "./logger";

/**
 * Redis client wrapper.
 * Falls back to in-memory cache when Redis is unavailable.
 */

export class RedisClient {
  private client: RedisClientType | null = null;
  private connectPromise: Promise<void> | null = null;
  private useInMemoryFallback = false;
  private memoryStore = new Map<string, string>();
  private memoryExpiry = new Map<string, NodeJS.Timeout>();

  async connect() {
    if (this.useInMemoryFallback || this.client?.isOpen) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (!ENV.REDIS_URL) {
      this.useInMemoryFallback = true;
      logger.warn("Redis URL not configured, using in-memory fallback");
      return;
    }

    this.client = createClient({
      url: ENV.REDIS_URL,
      socket: {
        reconnectStrategy: false,
      },
    });

    this.client.on("error", (error: any) => {
      if (error?.code === "ECONNREFUSED" || error?.name === "AggregateError") {
        logger.warn(
          "Redis connection refused, switching to in-memory fallback"
        );
      } else {
        logger.warn(
          "Redis error, switching to in-memory fallback",
          error?.message || error
        );
      }
      this.useInMemoryFallback = true;
    });

    this.connectPromise = this.client
      .connect()
      .then(() => {
        logger.info("Redis connected");
      })
      .catch((error: any) => {
        if (
          error?.code === "ECONNREFUSED" ||
          error?.name === "AggregateError"
        ) {
          logger.warn(
            "Unable to connect Redis (ECONNREFUSED), using in-memory fallback"
          );
        } else {
          logger.warn(
            "Unable to connect Redis, using in-memory fallback",
            error?.message || error
          );
        }
        this.useInMemoryFallback = true;
        this.client = null;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.connect();

    if (this.useInMemoryFallback || !this.client?.isOpen) {
      const value = this.memoryStore.get(key);
      return value ? (JSON.parse(value) as T) : null;
    }

    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    await this.connect();
    const serialized = JSON.stringify(value);

    if (this.useInMemoryFallback || !this.client?.isOpen) {
      this.memoryStore.set(key, serialized);

      const existingTimer = this.memoryExpiry.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.memoryExpiry.delete(key);
      }

      if (ttlSeconds && ttlSeconds > 0) {
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.memoryExpiry.delete(key);
        }, ttlSeconds * 1000);

        this.memoryExpiry.set(key, timer);
      }

      return;
    }

    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, serialized, {
        EX: ttlSeconds,
      });
      return;
    }

    await this.client.set(key, serialized);
  }

  async del(key: string) {
    await this.connect();

    if (this.useInMemoryFallback || !this.client?.isOpen) {
      this.memoryStore.delete(key);

      const timer = this.memoryExpiry.get(key);
      if (timer) {
        clearTimeout(timer);
        this.memoryExpiry.delete(key);
      }

      return;
    }

    await this.client.del(key);
  }

  async disconnect() {
    if (this.client?.isOpen) {
      await this.client.disconnect();
    }

    for (const timer of this.memoryExpiry.values()) {
      clearTimeout(timer);
    }

    this.memoryStore.clear();
    this.memoryExpiry.clear();
  }
}

export const redis = new RedisClient();
