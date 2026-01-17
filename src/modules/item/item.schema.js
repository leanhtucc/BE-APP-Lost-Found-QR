"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemIdParamSchema = exports.scanQRSchema = exports.listItemsSchema = exports.updateStatusSchema = exports.updateItemSchema = exports.createItemSchema = void 0;
const zod_1 = require("zod");
/**
 * Item Validation Schemas
 * Zod schemas để validate request data
 */
// Schema cho tạo item mới
exports.createItemSchema = zod_1.z.object({
    query: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, "Name is required")
            .max(100, "Name must be less than 100 characters"),
        category: zod_1.z
            .string()
            .min(1, "Category is required")
            .max(50, "Category must be less than 50 characters"),
        description: zod_1.z
            .string()
            .max(500, "Description must be less than 500 characters")
            .optional(),
        imagePublicUrl: zod_1.z
            .string()
            .url("Invalid image URL")
            .optional()
            .or(zod_1.z.literal("")),
        lastSeenLocation: zod_1.z
            .string()
            .refine((val) => {
            if (!val)
                return true;
            try {
                const parsed = JSON.parse(val);
                return (typeof parsed.lat === "number" && typeof parsed.lng === "number");
            }
            catch {
                return false;
            }
        }, { message: "lastSeenLocation must be valid JSON with lat and lng" })
            .optional(),
        securityPin: zod_1.z
            .string()
            .regex(/^\d{4}$/, "Security PIN must be 4 digits")
            .optional()
            .or(zod_1.z.literal("")),
    }),
});
// Schema cho cập nhật item
exports.updateItemSchema = zod_1.z.object({
    query: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, "Name is required")
            .max(100, "Name must be less than 100 characters")
            .optional(),
        category: zod_1.z
            .string()
            .min(1, "Category is required")
            .max(50, "Category must be less than 50 characters")
            .optional(),
        description: zod_1.z
            .string()
            .max(500, "Description must be less than 500 characters")
            .optional()
            .or(zod_1.z.literal("")),
        status: zod_1.z.enum(["safe", "lost"]).optional(),
        lostMessage: zod_1.z
            .string()
            .max(500, "Lost message must be less than 500 characters")
            .optional()
            .or(zod_1.z.literal("")),
        imagePublicUrl: zod_1.z
            .string()
            .url("Invalid image URL")
            .optional()
            .or(zod_1.z.literal("")),
        lastSeenLocation: zod_1.z
            .string()
            .refine((val) => {
            if (!val)
                return true;
            try {
                const parsed = JSON.parse(val);
                return (typeof parsed.lat === "number" && typeof parsed.lng === "number");
            }
            catch {
                return false;
            }
        }, { message: "lastSeenLocation must be valid JSON with lat and lng" })
            .optional()
            .or(zod_1.z.literal("")),
        securityPin: zod_1.z
            .string()
            .regex(/^\d{4}$/, "Security PIN must be 4 digits")
            .optional()
            .or(zod_1.z.literal("")),
    }),
});
// Schema cho update status
exports.updateStatusSchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.enum(["safe", "lost"], {
            required_error: "Status is required",
        }),
        lostMessage: zod_1.z
            .string()
            .max(500, "Lost message must be less than 500 characters")
            .optional()
            .or(zod_1.z.literal("")),
    }),
});
// Schema cho list items
exports.listItemsSchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.enum(["safe", "lost", "all"]).optional(),
        category: zod_1.z.string().max(50).optional(),
        page: zod_1.z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 1)),
        limit: zod_1.z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 10)),
    }),
});
// Schema cho scan QR (itemId trong params)
exports.scanQRSchema = zod_1.z.object({
    params: zod_1.z.object({
        itemId: zod_1.z.string().min(1, "Item ID is required"),
    }),
});
// Schema cho get/update/delete item (id trong params)
exports.itemIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, "Item ID is required"),
    }),
});
//# sourceMappingURL=item.schema.js.map