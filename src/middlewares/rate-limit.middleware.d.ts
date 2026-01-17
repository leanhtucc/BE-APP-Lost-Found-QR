import { Request, Response, NextFunction } from "express";
/**
 * Simple Rate Limiting Middleware
 * TODO: Implement với Redis cho production
 */
interface RateLimitConfig {
    windowMs: number;
    max: number;
}
export declare function rateLimit(config: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=rate-limit.middleware.d.ts.map