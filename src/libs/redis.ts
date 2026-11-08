import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, RedisClientType } from "redis";
import { ENV } from "../config/env";
import { logger } from "./logger";

/**
 * Redis client wrapper.
 *
 * Priority order:
 *  1. Upstash REST  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  2. Standard TCP  (REDIS_URL)
 *  3. In-memory fallback (no config required)
 */

export class RedisClient {
  // --- Upstash REST client ---
  private upstash: UpstashRedis | null = null;

  // --- Standard TCP client ---
  private client: RedisClientType | null = null;
  private connectPromise: Promise<void> | null = null;

  // --- In-memory fallback ---
  private useInMemoryFallback = false;
  private memoryStore = new Map<string, string>();
  private memoryExpiry = new Map<string, NodeJS.Timeout>();

  constructor() {
    // Initialise Upstash client immediately if credentials are present
    if (ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_REST_TOKEN) {
      this.upstash = new UpstashRedis({
        url: ENV.UPSTASH_REDIS_REST_URL,
        token: ENV.UPSTASH_REDIS_REST_TOKEN,
      });
      logger.info("Redis: using Upstash REST client");
    }
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** True when Upstash REST client is ready */
  private get hasUpstash(): boolean {
    return this.upstash !== null;
  }

  /** Ensure TCP client is connected (only used when no Upstash) */
  private async connectTcp() {
    if (this.hasUpstash || this.useInMemoryFallback || this.client?.isOpen) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (!ENV.REDIS_URL) {
      this.useInMemoryFallback = true;
      logger.warn(
        "Redis: no credentials configured – using in-memory fallback"
      );
      return;
    }

    this.client = createClient({
      url: ENV.REDIS_URL,
      socket: { reconnectStrategy: false },
    });

    this.client.on("error", (error: any) => {
      if (error?.code === "ECONNREFUSED" || error?.name === "AggregateError") {
        logger.warn(
          "Redis TCP connection refused – switching to in-memory fallback"
        );
      } else {
        logger.warn(
          "Redis TCP error – switching to in-memory fallback",
          error?.message || error
        );
      }
      this.useInMemoryFallback = true;
    });

    this.connectPromise = this.client
      .connect()
      .then(() => {
        logger.info("Redis: TCP client connected");
      })
      .catch((error: any) => {
        logger.warn(
          "Redis TCP unavailable – using in-memory fallback",
          error?.message || error
        );
        this.useInMemoryFallback = true;
        this.client = null;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  // ─── In-memory helpers ────────────────────────────────────────────────────

  private memGet(key: string): string | null {
    return this.memoryStore.get(key) ?? null;
  }

  private memSet(key: string, value: string, ttlSeconds?: number) {
    this.memoryStore.set(key, value);

    const existing = this.memoryExpiry.get(key);
    if (existing) {
      clearTimeout(existing);
      this.memoryExpiry.delete(key);
    }

    if (ttlSeconds && ttlSeconds > 0) {
      const timer = setTimeout(() => {
        this.memoryStore.delete(key);
        this.memoryExpiry.delete(key);
      }, ttlSeconds * 1000);
      this.memoryExpiry.set(key, timer);
    }
  }

  private memDel(key: string) {
    this.memoryStore.delete(key);
    const timer = this.memoryExpiry.get(key);
    if (timer) {
      clearTimeout(timer);
      this.memoryExpiry.delete(key);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<T | null> {
    // 1. Upstash REST
    if (this.hasUpstash) {
      try {
        return await this.upstash!.get<T>(key);
      } catch (err) {
        logger.error("Upstash GET error", err);
        return null;
      }
    }

    // 2. TCP Redis
    await this.connectTcp();
    if (!this.useInMemoryFallback && this.client?.isOpen) {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }

    // 3. In-memory
    const raw = this.memGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /**
   * @param options.strict Throw when the write fails. Use it for data that must
   *   not be lost silently (pending registrations, OTPs, handover codes).
   *   Caches keep the default fail-soft behaviour.
   */
  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
    options?: { strict?: boolean }
  ) {
    const serialized = JSON.stringify(value);

    // 1. Upstash REST
    if (this.hasUpstash) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.upstash!.set(key, serialized, { ex: ttlSeconds });
        } else {
          await this.upstash!.set(key, serialized);
        }
        return;
      } catch (err) {
        logger.error("Upstash SET error", err);
        if (options?.strict) throw err;
        return;
      }
    }

    // 2. TCP Redis
    await this.connectTcp();
    if (!this.useInMemoryFallback && this.client?.isOpen) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, { EX: ttlSeconds });
      } else {
        await this.client.set(key, serialized);
      }
      return;
    }

    // 3. In-memory
    this.memSet(key, serialized, ttlSeconds);
  }

  async del(key: string) {
    // 1. Upstash REST
    if (this.hasUpstash) {
      try {
        await this.upstash!.del(key);
        return;
      } catch (err) {
        logger.error("Upstash DEL error", err);
        return;
      }
    }

    // 2. TCP Redis
    await this.connectTcp();
    if (!this.useInMemoryFallback && this.client?.isOpen) {
      await this.client.del(key);
      return;
    }

    // 3. In-memory
    this.memDel(key);
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
