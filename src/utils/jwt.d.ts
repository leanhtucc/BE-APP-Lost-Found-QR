import jwt from "jsonwebtoken";
export declare function generateToken(payload: {
    id: string;
    uid: string;
    email: string;
}): string;
export declare function verifyToken(token: string): string | jwt.JwtPayload;
//# sourceMappingURL=jwt.d.ts.map