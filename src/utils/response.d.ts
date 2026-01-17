import { Response } from "express";
/**
 * Standardized API Response Utilities
 */
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    timestamp: string;
}
export declare class ResponseUtil {
    static success<T>(res: Response, data: T, message?: string, statusCode?: number): Response<any, Record<string, any>>;
    static created<T>(res: Response, data: T, message?: string): Response<any, Record<string, any>>;
    static error(res: Response, message?: string, statusCode?: number, error?: string): Response<any, Record<string, any>>;
    static badRequest(res: Response, message?: string, error?: string): Response<any, Record<string, any>>;
    static unauthorized(res: Response, message?: string): Response<any, Record<string, any>>;
    static forbidden(res: Response, message?: string): Response<any, Record<string, any>>;
    static notFound(res: Response, message?: string): Response<any, Record<string, any>>;
    static conflict(res: Response, message?: string): Response<any, Record<string, any>>;
}
//# sourceMappingURL=response.d.ts.map