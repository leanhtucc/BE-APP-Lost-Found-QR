import { ForgotPasswordDTO, ForgotPasswordResponse, GoogleAuthResponse, LoginDTO, LoginResponse, RegisterDTO, RegisterResponse, ResendVerificationDTO, ResetPasswordDTO, ResetPasswordResponse, UpdateProfileDTO, UserResponse, VerifyEmailDTO, VerifyEmailResponse } from "./auth.types";
export declare class AuthService {
    private formatUserResponse;
    private generateVerificationCode;
    private getCodeExpiry;
    register(data: RegisterDTO): Promise<RegisterResponse>;
    login(data: LoginDTO): Promise<LoginResponse>;
    refreshToken(refreshToken: string): Promise<LoginResponse>;
    getProfile(userId: string): Promise<UserResponse>;
    verifyEmail(data: VerifyEmailDTO): Promise<VerifyEmailResponse>;
    resendVerificationCode(data: ResendVerificationDTO): Promise<{
        message: string;
    }>;
    updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserResponse>;
    deleteAccount(userId: string): Promise<void>;
    getGoogleAuthUrl(): Promise<string>;
    googleAuth(code: string): Promise<GoogleAuthResponse>;
    requestPasswordReset(data: ForgotPasswordDTO): Promise<ForgotPasswordResponse>;
    resetPassword(data: ResetPasswordDTO): Promise<ResetPasswordResponse>;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map