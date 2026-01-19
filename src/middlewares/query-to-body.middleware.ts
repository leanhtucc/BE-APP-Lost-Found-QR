import { NextFunction, Request, Response } from "express";

/**
 * Middleware để copy query params sang body nếu body trống
 * Giải quyết vấn đề URL encoding với dấu + trong email
 *
 * LƯU Ý: Middleware này chỉ nên dùng tạm thời
 * Best practice là frontend nên gửi data qua body cho POST requests
 */
export const queryToBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Nếu body trống hoặc undefined và có query params
  if (
    (!req.body || Object.keys(req.body).length === 0) &&
    req.query &&
    Object.keys(req.query).length > 0
  ) {
    console.log(
      "[QUERY_TO_BODY] Detected empty body with query params, copying query to body"
    );

    // Copy query params sang body
    req.body = { ...req.query };

    console.log("[QUERY_TO_BODY] Body after copy:", req.body);
  }

  next();
};
