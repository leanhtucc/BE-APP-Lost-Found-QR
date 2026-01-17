import { z } from "zod";
export declare const createChannelSchema: z.ZodObject<{
    params: z.ZodObject<{
        itemId: z.ZodString;
        finderId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        finderId: string;
    }, {
        itemId: string;
        finderId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        itemId: string;
        finderId: string;
    };
}, {
    params: {
        itemId: string;
        finderId: string;
    };
}>;
export declare const closeChannelSchema: z.ZodObject<{
    params: z.ZodObject<{
        channelId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        channelId: string;
    }, {
        channelId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        channelId: string;
    };
}, {
    params: {
        channelId: string;
    };
}>;
export declare const messageIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        messageId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        messageId: string;
    }, {
        messageId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        messageId: string;
    };
}, {
    params: {
        messageId: string;
    };
}>;
export declare const muteUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        channelId: z.ZodString;
        targetUserId: z.ZodString;
        timeout: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        channelId: string;
        targetUserId: string;
        timeout?: string | undefined;
    }, {
        channelId: string;
        targetUserId: string;
        timeout?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        channelId: string;
        targetUserId: string;
        timeout?: string | undefined;
    };
}, {
    params: {
        channelId: string;
        targetUserId: string;
        timeout?: string | undefined;
    };
}>;
export declare const banUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        channelId: z.ZodString;
        targetUserId: z.ZodString;
        timeout: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        channelId: string;
        targetUserId: string;
        reason?: string | undefined;
        timeout?: string | undefined;
    }, {
        channelId: string;
        targetUserId: string;
        reason?: string | undefined;
        timeout?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        channelId: string;
        targetUserId: string;
        reason?: string | undefined;
        timeout?: string | undefined;
    };
}, {
    params: {
        channelId: string;
        targetUserId: string;
        reason?: string | undefined;
        timeout?: string | undefined;
    };
}>;
export declare const channelUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        channelId: z.ZodString;
        targetUserId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        channelId: string;
        targetUserId: string;
    }, {
        channelId: string;
        targetUserId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        channelId: string;
        targetUserId: string;
    };
}, {
    params: {
        channelId: string;
        targetUserId: string;
    };
}>;
export declare const activitySchema: z.ZodObject<{
    params: z.ZodObject<{
        activityType: z.ZodEnum<["new_message", "new_channel", "item_found", "item_returned"]>;
    }, "strip", z.ZodTypeAny, {
        activityType: "new_message" | "new_channel" | "item_found" | "item_returned";
    }, {
        activityType: "new_message" | "new_channel" | "item_found" | "item_returned";
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        activityType: "new_message" | "new_channel" | "item_found" | "item_returned";
    };
}, {
    params: {
        activityType: "new_message" | "new_channel" | "item_found" | "item_returned";
    };
}>;
//# sourceMappingURL=stream.schema.d.ts.map