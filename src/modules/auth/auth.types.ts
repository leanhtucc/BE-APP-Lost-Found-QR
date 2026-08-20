/**
 * Auth Module Types
 */

export interface RegisterDTO {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
  otpExpiresIn: number;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface VerifyOtpDTO {
  email: string;
  code: string;
}

export interface ResendOtpDTO {
  email: string;
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

export interface UserStats {
  trust_score: number;
  items_lost: number;
  items_returned: number;
}

export type PrivacySettings = {
  showPhone?: boolean;
  showEmail?: boolean;
  [key: string]: boolean | undefined;
};

export interface UserResponse {
  id: string;
  memberId: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  photoURL: string | null;
  address: string | null;
  bio: string | null;
  isVerified: boolean;
  trustScore: number;
  totalReturned: number;
  itemsLost: number;
  createdAt: string;

  // Backward compatibility aliases
  member_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  stats: UserStats;
  stream_token: string;
  privacy_settings: PrivacySettings;
  created_at: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface VerifyOtpResponse {
  access_token: string;
  expire_in: number;
  refresh_token: string;
  refresh_token_expire_in: number;
  auth_type: string;
  user: UserResponse;
}

export interface UpdateProfileDTO {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  pushToken?: string;
  bio?: string;
  addressCity?: string;
  address?: string;
  privacySettings?: object;
}

export interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
  isNewUser: boolean;
}
