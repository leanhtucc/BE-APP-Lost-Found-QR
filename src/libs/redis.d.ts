/**
 * Redis Client
 * TODO: Implement khi cần cache hoặc rate limiting
 */
export declare class RedisClient {
    connect(): Promise<void>;
    get(key: string): Promise<null>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    disconnect(): Promise<void>;
}
export declare const redis: RedisClient;
//# sourceMappingURL=redis.d.ts.map