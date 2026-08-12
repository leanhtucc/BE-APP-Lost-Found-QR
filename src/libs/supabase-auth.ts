import { createContextClient, verifyCredentials } from "@supabase/server/core";
import { ENV } from "../config/env";
import { prisma } from "./prisma";
import { decodeToken, type TokenPayload, verifyAccessToken } from "./jwt";

const userIdentitySelect = {
  id: true,
  uid: true,
  email: true,
} as const;

export class SupabaseAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAuthenticationError";
  }
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    ENV.SUPABASE_URL && ENV.SUPABASE_PUBLISHABLE_KEY && ENV.SUPABASE_JWKS_URL
  );
}

export function isSupabaseAccessToken(token: string): boolean {
  const decoded = decodeToken(token);

  if (!decoded || typeof decoded === "string") {
    return false;
  }

  const expectedIssuer = ENV.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1";
  return decoded.iss === expectedIssuer;
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

async function verifySupabaseAccessToken(
  token: string,
  provisionUser: boolean
): Promise<TokenPayload | null> {
  if (!isSupabaseAuthConfigured()) {
    throw new SupabaseAuthenticationError(
      "Supabase Auth is not configured on this server"
    );
  }

  const { data: auth, error } = await verifyCredentials(
    { token, apikey: null },
    { auth: "user" }
  );

  if (error || !auth.userClaims) {
    throw new SupabaseAuthenticationError(
      error?.message || "Invalid Supabase access token"
    );
  }

  const claims = auth.userClaims;
  let localUser = await prisma.user.findUnique({
    where: { uid: claims.id },
    select: userIdentitySelect,
  });

  if (!localUser && !provisionUser) {
    return null;
  }

  if (!localUser) {
    const email = claims.email?.trim().toLowerCase();
    if (!email) {
      throw new SupabaseAuthenticationError(
        "Supabase user must have an email before a local profile can be created"
      );
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailOwner) {
      throw new SupabaseAuthenticationError(
        "This email already belongs to a local account and must be linked explicitly"
      );
    }

    const supabase = createContextClient({ auth: { token } });
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user || userData.user.id !== claims.id) {
      throw new SupabaseAuthenticationError(
        "Unable to confirm the Supabase user profile"
      );
    }

    const displayName =
      readMetadataString(claims.userMetadata, [
        "display_name",
        "full_name",
        "name",
        "user_name",
      ]) || email.split("@")[0]!;
    const photoURL = readMetadataString(claims.userMetadata, [
      "avatar_url",
      "picture",
    ]);

    localUser = await prisma.user.create({
      data: {
        uid: claims.id,
        email,
        displayName,
        photoURL,
        isVerified: Boolean(
          userData.user.email_confirmed_at || userData.user.phone_confirmed_at
        ),
      },
      select: userIdentitySelect,
    });
  }

  return localUser;
}

export async function authenticateAccessToken(
  token: string,
  provisionUser = true
): Promise<TokenPayload | null> {
  if (isSupabaseAccessToken(token)) {
    return verifySupabaseAccessToken(token, provisionUser);
  }

  return verifyAccessToken(token);
}
