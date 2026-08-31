import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ResponseUtil } from "../utils/response";

/**
 * Validation Middleware using Zod
 */

function overwriteMutableObject(target: unknown, source: unknown): void {
  if (!target || typeof target !== "object") return;
  if (!source || typeof source !== "object") return;

  const targetRecord = target as Record<string, unknown>;

  for (const key of Object.keys(targetRecord)) {
    delete targetRecord[key];
  }

  Object.assign(targetRecord, source as Record<string, unknown>);
}

export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedParams = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsedParams && typeof parsedParams === "object") {
        const parsed = parsedParams as {
          body?: unknown;
          query?: unknown;
          params?: unknown;
        };

        if ("body" in parsed && parsed.body !== undefined) {
          req.body = parsed.body;
        }

        if ("query" in parsed && parsed.query !== undefined) {
          overwriteMutableObject(req.query, parsed.query);
        }

        if ("params" in parsed && parsed.params !== undefined) {
          overwriteMutableObject(req.params, parsed.params);
        }
      }

      next();
    } catch (error: any) {
      const issues = error?.issues || error?.errors;
      const fields: Record<string, string> = {};
      for (const issue of issues || []) {
        const path = Array.isArray(issue.path) ? issue.path : [];
        const field = String(path[path.length - 1] || "request");
        if (!fields[field]) fields[field] = issue.message;
      }

      const invalidRadius = Boolean(
        fields.notificationRadiusMeters || fields.nearbyRadius
      );
      const profileRequest = req.path.includes("/profile");
      return res.status(invalidRadius ? 422 : 400).json({
        success: false,
        message: invalidRadius
          ? "Notification radius is invalid"
          : profileRequest
          ? "Profile data is invalid"
          : "Request data is invalid",
        error: {
          code: invalidRadius
            ? "INVALID_NOTIFICATION_RADIUS"
            : "VALIDATION_ERROR",
          fields:
            Object.keys(fields).length > 0
              ? fields
              : { request: error.message || "Validation failed" },
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
