/**
 * Auth Module Types
 */

export interface RegisterDTO {
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
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

export interface ResendVerificationDTO {
  email: string;
}
