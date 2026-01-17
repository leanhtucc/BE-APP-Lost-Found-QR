"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const response_1 = require("../utils/response");
/**
 * Validation Middleware using Zod
 */
function validate(schema) {
    return async (req, res, next) => {
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
        }
        catch (error) {
            console.error("[VALIDATION] ❌ Validation failed:", {
                errors: error.errors,
                message: error.message,
                receivedData: req.body,
            });
            return response_1.ResponseUtil.badRequest(res, "Validation failed", error.errors?.[0]?.message || error.message);
        }
    };
}
//# sourceMappingURL=validate.middleware.js.map