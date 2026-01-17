import jwt from "jsonwebtoken";
/**
 * JWT Utility Library
 */
interface TokenPayload {
    id: string;
    uid: string;
    email: string;
}
export declare function generateAccessToken(payload: TokenPayload): string;
export declare function generateRefreshToken(payload: TokenPayload): string;
export declare function verifyAccessToken(token: string): TokenPayload;
export declare function verifyRefreshToken(token: string): TokenPayload;
export declare function decodeToken(token: string): string | jwt.JwtPayload | null;
export {};
//# sourceMappingURL=jwt.d.ts.map