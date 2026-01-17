"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activitySchema = exports.channelUserSchema = exports.banUserSchema = exports.muteUserSchema = exports.messageIdSchema = exports.closeChannelSchema = exports.createChannelSchema = void 0;
const zod_1 = require("zod");
exports.createChannelSchema = zod_1.z.object({
    params: zod_1.z.object({
        itemId: zod_1.z.string().min(1, "Item ID is required"),
        finderId: zod_1.z.string().min(1, "Finder ID is required"),
    }),
});
exports.closeChannelSchema = zod_1.z.object({
    params: zod_1.z.object({
        channelId: zod_1.z.string().min(1, "Channel ID is required"),
    }),
});
exports.messageIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        messageId: zod_1.z.string().min(1, "Message ID is required"),
    }),
});
exports.muteUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        channelId: zod_1.z.string().min(1, "Channel ID is required"),
        targetUserId: zod_1.z.string().min(1, "Target User ID is required"),
        timeout: zod_1.z.string().optional(), // timeout in minutes as string
    }),
});
exports.banUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        channelId: zod_1.z.string().min(1, "Channel ID is required"),
        targetUserId: zod_1.z.string().min(1, "Target User ID is required"),
        timeout: zod_1.z.string().optional(), // timeout in minutes
        reason: zod_1.z.string().optional(),
    }),
});
exports.channelUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        channelId: zod_1.z.string().min(1, "Channel ID is required"),
        targetUserId: zod_1.z.string().min(1, "Target User ID is required"),
    }),
});
exports.activitySchema = zod_1.z.object({
    params: zod_1.z.object({
        activityType: zod_1.z.enum([
            "new_message",
            "new_channel",
            "item_found",
            "item_returned",
        ]),
    }),
});
//# sourceMappingURL=stream.schema.js.map