import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findByGoogleId: vi.fn(),
  findByUid: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  revokeTokens: vi.fn(),
}));

const googleOAuthMocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  verifyToken: vi.fn(),
}));

const tempStorageMocks = vi.hoisted(() => ({
  has: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

const emailServiceMocks = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  isConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("./auth.repository", () => ({
  AuthRepository: class {
    findByEmail = repositoryMocks.findByEmail;
    findByGoogleId = repositoryMocks.findByGoogleId;
    findByUid = repositoryMocks.findByUid;
    findById = repositoryMocks.findById;
    createUser = repositoryMocks.createUser;
    updateUser = repositoryMocks.updateUser;
    revokeTokens = repositoryMocks.revokeTokens;
  },
}));

vi.mock("../../libs/google-oauth", () => ({
  googleOAuthService: {
    verifyIdToken: googleOAuthMocks.verifyIdToken,
    verifyToken: googleOAuthMocks.verifyToken,
  },
}));

vi.mock("../../libs/temp-storage", () => ({
  tempStorage: {
    has: tempStorageMocks.has,
    get: tempStorageMocks.get,
    set: tempStorageMocks.set,
    delete: tempStorageMocks.delete,
  },
}));

vi.mock("../../libs/email", () => ({
  emailService: emailServiceMocks,
}));

vi.mock("../../utils/hash", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
  comparePassword: vi.fn().mockImplementation((input, hash) => {
    return Promise.resolve(
      input === "Password123" && hash === "hashed_password"
    );
  }),
}));

import { AuthService } from "./auth.service";
import jwt from "jsonwebtoken";
import { ENV } from "../../config/env";
import { generateRefreshToken } from "../../libs/jwt";

const activeUser = {
  id: "user-123",
  uid: "user_original_uid",
  memberId: "USER_original_uid",
  email: "test@example.com",
  displayName: "Test User",
  password: "hashed_password",
  googleId: null,
  isVerified: true,
  tokenVersion: 3,
  scheduledDeletionAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function refreshTokenFor(user = activeUser): string {
  return generateRefreshToken({
    id: user.id,
    uid: user.uid,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });
}

async function expectRefreshCode(
  promise: Promise<unknown>,
  code: string
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    statusCode: 401,
    code,
  });
}

describe("AuthService refresh-token contract", () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
    repositoryMocks.findById.mockResolvedValue(activeUser);
  });

  it("returns a fresh access/refresh pair for a valid token", async () => {
    const result = await authService.refreshToken(refreshTokenFor());

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user.id).toBe(activeUser.id);
  });

  it("classifies malformed or wrongly signed tokens as invalid", async () => {
    await expectRefreshCode(
      authService.refreshToken("not-a-jwt"),
      "INVALID_REFRESH_TOKEN"
    );
  });

  it("classifies expired tokens separately", async () => {
    const expired = jwt.sign(
      {
        id: activeUser.id,
        uid: activeUser.uid,
        email: activeUser.email,
        tokenVersion: activeUser.tokenVersion,
      },
      ENV.JWT_REFRESH_SECRET,
      { expiresIn: -1 }
    );

    await expectRefreshCode(
      authService.refreshToken(expired),
      "REFRESH_TOKEN_EXPIRED"
    );
  });

  it("rejects a token whose version has been revoked", async () => {
    repositoryMocks.findById.mockResolvedValue({
      ...activeUser,
      tokenVersion: activeUser.tokenVersion + 1,
    });

    await expectRefreshCode(
      authService.refreshToken(refreshTokenFor()),
      "REFRESH_TOKEN_REVOKED"
    );
  });

  it("does not disclose whether the user is deleted or disabled", async () => {
    repositoryMocks.findById.mockResolvedValue(null);

    await expectRefreshCode(
      authService.refreshToken(refreshTokenFor()),
      "UNAUTHORIZED"
    );
  });

  it("documents stateless reuse: the same valid token remains usable", async () => {
    const token = refreshTokenFor();
    const first = await authService.refreshToken(token);
    const second = await authService.refreshToken(token);

    expect(first.accessToken).toEqual(expect.any(String));
    expect(second.accessToken).toEqual(expect.any(String));
    expect(repositoryMocks.findById).toHaveBeenCalledTimes(2);
  });

  it("documents parallel semantics: both valid calls succeed", async () => {
    const token = refreshTokenFor();
    const results = await Promise.all([
      authService.refreshToken(token),
      authService.refreshToken(token),
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((result) => Boolean(result.refreshToken))).toBe(true);
  });

  it("revokes the current token version on logout", async () => {
    repositoryMocks.revokeTokens.mockResolvedValue(activeUser);

    await authService.logout(activeUser.id);

    expect(repositoryMocks.revokeTokens).toHaveBeenCalledWith(activeUser.id);
  });
});

describe("AuthService - Account Linking & Google Login", () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  it("links Google account to existing normally-registered user without creating duplicate", async () => {
    const existingUser = {
      id: "user-123",
      uid: "user_original_uid",
      memberId: "USER_original_uid",
      email: "test@example.com",
      displayName: "Original User",
      password: "hashed_password",
      googleId: null,
      isVerified: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First lookup by Google ID returns null
    repositoryMocks.findByGoogleId.mockResolvedValue(null);
    // Lookup by email finds existing user
    repositoryMocks.findByEmail.mockImplementation((email: string) => {
      if (email === "test@example.com") {
        return Promise.resolve({
          ...existingUser,
          googleId: "google-uid-999",
        });
      }
      return Promise.resolve(null);
    });
    repositoryMocks.updateUser.mockResolvedValue({
      ...existingUser,
      googleId: "google-uid-999",
    });

    googleOAuthMocks.verifyIdToken.mockResolvedValue({
      id: "google-uid-999",
      email: "TEST@EXAMPLE.COM", // Different casing from Google
      verified_email: true,
      name: "Google User",
      picture: "https://photo.jpg",
    });

    const result = await authService.googleAuthWithIdToken("valid-id-token");

    // Must NOT call createUser!
    expect(repositoryMocks.createUser).not.toHaveBeenCalled();
    // Must update user with googleId and link account
    expect(repositoryMocks.updateUser).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        googleId: "google-uid-999",
        isVerified: true,
      })
    );
    expect(result.isNewUser).toBe(false);
    expect(result.user.email).toBe("test@example.com");
    expect(tempStorageMocks.delete).toHaveBeenCalledWith("test@example.com");
  });

  it("allows user to log in with email/password after linking Google account", async () => {
    const linkedUser = {
      id: "user-123",
      uid: "user_original_uid",
      memberId: "USER_original_uid",
      email: "test@example.com",
      displayName: "Original User",
      password: "hashed_password", // Original password preserved!
      googleId: "google-uid-999",
      isVerified: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repositoryMocks.findByEmail.mockResolvedValue(linkedUser);

    const loginResult = await authService.login({
      email: "test@example.com",
      password: "Password123",
    });

    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.user.email).toBe("test@example.com");
  });

  it("allows subsequent Google login using googleId directly", async () => {
    const linkedUser = {
      id: "user-123",
      uid: "user_original_uid",
      memberId: "USER_original_uid",
      email: "test@example.com",
      displayName: "Original User",
      password: "hashed_password",
      googleId: "google-uid-999",
      isVerified: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Direct lookup by googleId finds user
    repositoryMocks.findByGoogleId.mockResolvedValue(linkedUser);

    googleOAuthMocks.verifyIdToken.mockResolvedValue({
      id: "google-uid-999",
      email: "test@example.com",
      verified_email: true,
      name: "Google User",
      picture: "https://photo.jpg",
    });

    const result = await authService.googleAuthWithIdToken("valid-id-token");

    expect(repositoryMocks.findByGoogleId).toHaveBeenCalledWith(
      "google-uid-999"
    );
    expect(repositoryMocks.createUser).not.toHaveBeenCalled();
    expect(result.isNewUser).toBe(false);
  });

  it("gives clear error when user registered with Google tries password login without password", async () => {
    const googleOnlyUser = {
      id: "user-456",
      uid: "user_google_uid",
      email: "googleonly@example.com",
      displayName: "Google User",
      password: "", // No password
      googleId: "google-uid-888",
      isVerified: true,
      tokenVersion: 0,
    };

    repositoryMocks.findByEmail.mockResolvedValue(googleOnlyUser);

    await expect(
      authService.login({
        email: "googleonly@example.com",
        password: "AnyPassword123",
      })
    ).rejects.toThrowError(
      "This account is registered with Google. Please sign in with Google or reset your password to create a password."
    );
  });

  it("allows Google-registered users to request password reset and set a password", async () => {
    const googleOnlyUser = {
      id: "user-456",
      uid: "user_google_uid",
      email: "googleonly@example.com",
      displayName: "Google User",
      password: "", // No password
      googleId: "google-uid-888",
      isVerified: true,
      tokenVersion: 0,
    };

    repositoryMocks.findByEmail.mockResolvedValue(googleOnlyUser);
    repositoryMocks.updateUser.mockResolvedValue(googleOnlyUser);

    const result = await authService.requestPasswordReset({
      email: "googleonly@example.com",
    });

    expect(result.message).toBe(
      "If an account with that email exists, a password reset link has been sent."
    );
    expect(emailServiceMocks.sendPasswordResetEmail).toHaveBeenCalled();
  });
});
