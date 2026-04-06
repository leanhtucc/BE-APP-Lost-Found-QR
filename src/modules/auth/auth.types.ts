/**
 * Auth Module Types
 */

export interface RegisterDTO {
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
  phoneNumber: string; // Đã bắt buộc cho app FindBack
}

export interface RegisterResponse {
  message: string;
  email: string;
  accessToken?: string; // Available in dev mode
  refreshToken?: string; // Available in dev mode
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

// Stats object for user profile
export interface UserStats {
  trust_score: number;
  items_lost: number;
  items_returned: number;
}

// Privacy settings structure - compatible with Prisma Json type
export type PrivacySettings = {
  showPhone?: boolean;
  showEmail?: boolean;
  [key: string]: boolean | undefined;
};

export interface UserResponse {
  member_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  stats: UserStats;
  address: string | null;
  bio: string | null;
  stream_token: string;
  privacy_settings: PrivacySettings;
  created_at: Date;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface UpdateProfileDTO {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  pushToken?: string;
  bio?: string;
  addressCity?: string;
  privacySettings?: PrivacySettings;
}

export interface VerifyOtpDTO {
  phoneNumber: string;
  code: string;
}

export interface VerifyOtpResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface ResendOtpDTO {
  phoneNumber: string;
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
