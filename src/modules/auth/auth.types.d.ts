/**
 * Auth Module Types
 */
export interface RegisterDTO {
    email: string;
    password: string;
    displayName: string;
    photoURL?: string;
}
export interface RegisterResponse {
    message: string;
    email: string;
    accessToken?: string;
    refreshToken?: string;
}
export interface LoginDTO {
    email: string;
    password: string;
}
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
}
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: UserResponse;
}
export interface UserResponse {
    id: string;
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    totalReturned: number;
    createdAt: Date;
}
export interface RefreshTokenDTO {
    refreshToken: string;
}
export interface UpdateProfileDTO {
    displayName?: string;
    photoURL?: string;
    pushToken?: string;
}
export interface VerifyEmailDTO {
    email: string;
    code: string;
}
export interface VerifyEmailResponse {
    message: string;
    accessToken: string;
    refreshToken: string;
}
export interface ResendVerificationDTO {
    email: string;
}
export interface GoogleAuthDTO {
    code: string;
}
export interface GoogleAuthResponse {
    accessToken: string;
    refreshToken: string;
    user: UserResponse;
    isNewUser: boolean;
}
export interface ForgotPasswordDTO {
    email: string;
}
export interface ForgotPasswordResponse {
    message: string;
}
export interface ResetPasswordDTO {
    token: string;
    newPassword: string;
}
export interface ResetPasswordResponse {
    message: string;
}
//# sourceMappingURL=auth.types.d.ts.map