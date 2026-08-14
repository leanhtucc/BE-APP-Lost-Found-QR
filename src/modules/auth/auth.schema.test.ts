import { describe, expect, it } from "vitest";
import {
  registerSchema,
  resendOtpSchema,
  verifyOtpSchema,
} from "./auth.schema";

describe("auth registration schemas", () => {
  it("accepts an email-only registration and normalizes snake_case fields", () => {
    const parsed = registerSchema.parse({
      body: {
        full_name: "Nguyen Van An",
        email: "  USER@Example.com ",
        password: "Password123",
        password_confirmation: "Password123",
        phoneNumber: "0900000000",
      },
    });

    expect(parsed.body).toEqual({
      displayName: "Nguyen Van An",
      email: "user@example.com",
      password: "Password123",
    });
    expect(parsed.body).not.toHaveProperty("phoneNumber");
  });

  it("also accepts camelCase field aliases", () => {
    const parsed = registerSchema.parse({
      body: {
        fullName: "Nguyen Van An",
        email: "user@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      },
    });

    expect(parsed.body.displayName).toBe("Nguyen Van An");
  });

  it("rejects a mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      body: {
        full_name: "Nguyen Van An",
        email: "user@example.com",
        password: "Password123",
        password_confirmation: "Password456",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Password confirmation does not match"
      );
    }
  });

  it("uses email for OTP verification and resend", () => {
    expect(
      verifyOtpSchema.parse({
        body: { email: "USER@example.com", code: "123456" },
      }).body
    ).toEqual({ email: "user@example.com", code: "123456" });

    expect(
      resendOtpSchema.parse({ body: { email: "USER@example.com" } }).body
    ).toEqual({ email: "user@example.com" });
  });
});
