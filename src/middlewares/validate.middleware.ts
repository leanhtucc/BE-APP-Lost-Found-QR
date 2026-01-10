import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ResponseUtil } from "../utils/response";

/**
 * Validation Middleware using Zod
 */

export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      return ResponseUtil.badRequest(
        res,
        "Validation failed",
        error.errors?.[0]?.message || error.message
      );
    }
  };
}
