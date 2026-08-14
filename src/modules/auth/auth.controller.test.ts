import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authServiceMocks = vi.hoisted(() => ({
  register: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("./auth.service", () => ({
  AuthService: class {
    register = authServiceMocks.register;
    verifyOtp = authServiceMocks.verifyOtp;
  },
}));

import { AuthController } from "./auth.controller";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response;
}

describe("AuthController registration flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts registration without forwarding a phone number", async () => {
    authServiceMocks.register.mockResolvedValue({
      message: "OTP code has been sent to your email.",
      email: "user@example.com",
      otpExpiresIn: 900,
    });
    const controller = new AuthController();
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await controller.register(
      {
        body: {
          displayName: "Nguyen Van An",
          email: "user@example.com",
          password: "Password123",
        },
      } as Request,
      response,
      next
    );

    expect(authServiceMocks.register).toHaveBeenCalledWith({
      displayName: "Nguyen Van An",
      email: "user@example.com",
      password: "Password123",
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "OTP code has been sent to your email.",
        data: {
          email: "user@example.com",
          otp_expires_in: 900,
        },
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns the required token contract after OTP verification", async () => {
    const tokenData = {
      access_token: "access-token",
      expire_in: 86400,
      refresh_token: "refresh-token",
      refresh_token_expire_in: 2592000,
      auth_type: "Bearer Token",
    };
    authServiceMocks.verifyOtp.mockResolvedValue(tokenData);
    const controller = new AuthController();
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await controller.verifyOtp(
      { body: { email: "user@example.com", code: "123456" } } as Request,
      response,
      next
    );

    expect(authServiceMocks.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      code: "123456",
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: 200,
      success: true,
      message: "OK",
      data: tokenData,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
