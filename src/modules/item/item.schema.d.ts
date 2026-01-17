import { z } from "zod";
/**
 * Item Validation Schemas
 * Zod schemas để validate request data
 */
export declare const createItemSchema: z.ZodObject<{
    query: z.ZodObject<{
        name: z.ZodString;
        category: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        imagePublicUrl: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        lastSeenLocation: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        securityPin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: string;
        description?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    }, {
        name: string;
        category: string;
        description?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        name: string;
        category: string;
        description?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    };
}, {
    query: {
        name: string;
        category: string;
        description?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    };
}>;
export declare const updateItemSchema: z.ZodObject<{
    query: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        description: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        status: z.ZodOptional<z.ZodEnum<["safe", "lost"]>>;
        lostMessage: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        imagePublicUrl: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        lastSeenLocation: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>;
        securityPin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
        status?: "lost" | "safe" | undefined;
        lostMessage?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    }, {
        name?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
        status?: "lost" | "safe" | undefined;
        lostMessage?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        name?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
        status?: "lost" | "safe" | undefined;
        lostMessage?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    };
}, {
    query: {
        name?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
        status?: "lost" | "safe" | undefined;
        lostMessage?: string | undefined;
        imagePublicUrl?: string | undefined;
        lastSeenLocation?: string | undefined;
        securityPin?: string | undefined;
    };
}>;
export declare const updateStatusSchema: z.ZodObject<{
    query: z.ZodObject<{
        status: z.ZodEnum<["safe", "lost"]>;
        lostMessage: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        status: "lost" | "safe";
        lostMessage?: string | undefined;
    }, {
        status: "lost" | "safe";
        lostMessage?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        status: "lost" | "safe";
        lostMessage?: string | undefined;
    };
}, {
    query: {
        status: "lost" | "safe";
        lostMessage?: string | undefined;
    };
}>;
export declare const listItemsSchema: z.ZodObject<{
    query: z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<["safe", "lost", "all"]>>;
        category: z.ZodOptional<z.ZodString>;
        page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        category?: string | undefined;
        status?: "lost" | "safe" | "all" | undefined;
    }, {
        limit?: string | undefined;
        category?: string | undefined;
        status?: "lost" | "safe" | "all" | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        category?: string | undefined;
        status?: "lost" | "safe" | "all" | undefined;
    };
}, {
    query: {
        limit?: string | undefined;
        category?: string | undefined;
        status?: "lost" | "safe" | "all" | undefined;
        page?: string | undefined;
    };
}>;
export declare const scanQRSchema: z.ZodObject<{
    params: z.ZodObject<{
        itemId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
    }, {
        itemId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        itemId: string;
    };
}, {
    params: {
        itemId: string;
    };
}>;
export declare const itemIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
//# sourceMappingURL=item.schema.d.ts.map