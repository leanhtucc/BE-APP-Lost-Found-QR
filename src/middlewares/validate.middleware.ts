import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ResponseUtil } from "../utils/response";

/**
 * Validation Middleware using Zod
 */

export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[VALIDATION] Incoming request data:", {
        body: req.body,
        query: req.query,
        params: req.params,
      });

      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      console.log("[VALIDATION] ✅ Validation passed");
      next();
    } catch (error: any) {
      console.error("[VALIDATION] ❌ Validation failed:", {
        errors: error.errors,
        message: error.message,
        receivedData: req.body,
      });

      return ResponseUtil.badRequest(
        res,
        "Validation failed",
        error.errors?.[0]?.message || error.message
      );
    }
  };
}
