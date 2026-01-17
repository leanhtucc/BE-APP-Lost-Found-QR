import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
/**
 * Validation Middleware using Zod
 */
export declare function validate(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=validate.middleware.d.ts.map