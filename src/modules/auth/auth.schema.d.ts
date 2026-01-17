import { z } from "zod";
export declare const registerSchema: z.ZodObject<{
    query: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        displayName: z.ZodString;
        photoURL: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strip", z.ZodTypeAny, {
        displayName: string;
        email: string;
        password: string;
        photoURL?: string | undefined;
    }, {
        displayName: string;
        email: string;
        password: string;
        photoURL?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        displayName: string;
        email: string;
        password: string;
        photoURL?: string | undefined;
    };
}, {
    query: {
        displayName: string;
        email: string;
        password: string;
        photoURL?: string | undefined;
    };
}>;
export declare const loginSchema: z.ZodObject<{
    query: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
    }, {
        email: string;
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        email: string;
        password: string;
    };
}, {
    query: {
        email: string;
        password: string;
    };
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    query: z.ZodObject<{
        refreshToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refreshToken: string;
    }, {
        refreshToken: string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        refreshToken: string;
    };
}, {
    query: {
        refreshToken: string;
    };
}>;
export declare const updateProfileSchema: z.ZodObject<{
    query: z.ZodObject<{
        displayName: z.ZodOptional<z.ZodString>;
        photoURL: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strip", z.ZodTypeAny, {
        displayName?: string | undefined;
        photoURL?: string | undefined;
    }, {
        displayName?: string | undefined;
        photoURL?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        displayName?: string | undefined;
        photoURL?: string | undefined;
    };
}, {
    query: {
        displayName?: string | undefined;
        photoURL?: string | undefined;
    };
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    query: z.ZodObject<{
        email: z.ZodString;
        code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        code: string;
    }, {
        email: string;
        code: string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        email: string;
        code: string;
    };
}, {
    query: {
        email: string;
        code: string;
    };
}>;
export declare const resendVerificationSchema: z.ZodObject<{
    query: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        email: string;
    };
}, {
    query: {
        email: string;
    };
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
        newPassword: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
        newPassword: string;
    }, {
        token: string;
        newPassword: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        token: string;
        newPassword: string;
    };
}, {
    body: {
        token: string;
        newPassword: string;
    };
}>;
//# sourceMappingURL=auth.schema.d.ts.map