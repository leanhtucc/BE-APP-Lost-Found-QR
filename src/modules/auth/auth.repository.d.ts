import { User } from "@prisma/client";
/**
 * Auth Repository
 * Data access layer for users
 */
export declare class AuthRepository {
    createUser(data: {
        uid: string;
        email: string;
        password: string;
        displayName: string;
        photoURL?: string;
        verificationCode?: string;
        verificationCodeExpiry?: Date;
        isVerified?: boolean;
    }): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        photoURL: string | null;
        totalReturned: number;
        isVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findByEmail(email: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findByGoogleId(googleId: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findByUid(uid: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findById(id: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        photoURL: string | null;
        totalReturned: number;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updateUser(id: string, data: Partial<User>): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        photoURL: string | null;
        totalReturned: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    countByEmail(email: string): Promise<number>;
    findByResetToken(token: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updatePassword(id: string, hashedPassword: string): Promise<{
        id: string;
        uid: string;
        displayName: string;
        email: string;
        password: string | null;
        photoURL: string | null;
        pushToken: string | null;
        totalReturned: number;
        isVerified: boolean;
        verificationCode: string | null;
        verificationCodeExpiry: Date | null;
        resetPasswordToken: string | null;
        resetPasswordExpiry: Date | null;
        googleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
//# sourceMappingURL=auth.repository.d.ts.map