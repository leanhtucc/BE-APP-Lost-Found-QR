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
  protectedItems: number;
  safeItems: number;
  lostItems: number;
  activeLostReports: number;
  completedReturns: number;
  qrScans: number;
}

export interface ProfilePreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  proximityEnabled: boolean;
  notificationRadiusMeters: number;
  language: "vi" | "en";
}

export interface TrustProfile {
  score: number;
  level: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  isVerified: boolean;
  completedReturns: number;
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
  authProvider: "password" | "google" | "firebase_phone" | "apple";
  emailVerified: boolean;
  isVerified: boolean;
  trustScore: number;
  totalReturned: number;
  itemsLost: number;
  createdAt: string;
  updatedAt: string;
  trust: TrustProfile;
  preferences: ProfilePreferences;

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
  photoURL?: string | null;
  phoneNumber?: string | null;
  pushToken?: string;
  bio?: string | null;
  addressCity?: string | null;
  address?: string | null;
  privacySettings?: object;
}

export interface ProfileStatistics {
  protectedItems: number;
  safeItems: number;
  lostItems: number;
  activeLostReports: number;
  completedReturns: number;
  qrScans: number;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface ConfirmAccountDeletionDTO {
  otpCode: string;
  confirmation: "DELETE";
}

export interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
  isNewUser: boolean;
}
