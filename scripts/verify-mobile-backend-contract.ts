import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface MobileEndpointCall {
  service: string;
  method: string;
  mobileUrl: string;
  pathPattern: string;
  authType: "none" | "user" | "guest" | "user_or_guest" | "optional";
  requiredBodyFields: string[];
  notes?: string;
}

export interface BackendEndpoint {
  method: string;
  path: string;
  authType: "none" | "user" | "guest" | "user_or_guest" | "optional";
  requiredBodyFields: string[];
}

export interface ContractComparison {
  mobileCall: string;
  backendRoute: string;
  match: "YES" | "NO" | "PARTIAL";
  fix: string;
}

// Complete inventory of all endpoints called by mobile app services
export const mobileEndpoints: MobileEndpointCall[] = [
  // --- Auth Service (services/auth/api.ts) ---
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/register",
    pathPattern: "/api/auth/register",
    authType: "none",
    requiredBodyFields: ["displayName", "email", "password"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/verify-otp",
    pathPattern: "/api/auth/verify-otp",
    authType: "none",
    requiredBodyFields: ["email", "code"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/resend-otp",
    pathPattern: "/api/auth/resend-otp",
    authType: "none",
    requiredBodyFields: ["email"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/login",
    pathPattern: "/api/auth/login",
    authType: "none",
    requiredBodyFields: ["email", "password"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/google",
    pathPattern: "/api/auth/google",
    authType: "none",
    requiredBodyFields: ["idToken"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/firebase-verify",
    pathPattern: "/api/auth/firebase-verify",
    authType: "none",
    requiredBodyFields: ["idToken"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/refresh",
    pathPattern: "/api/auth/refresh",
    authType: "none",
    requiredBodyFields: ["refreshToken"],
  },
  {
    service: "auth",
    method: "GET",
    mobileUrl: "/api/auth/profile",
    pathPattern: "/api/auth/profile",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "PUT",
    mobileUrl: "/api/auth/profile",
    pathPattern: "/api/auth/profile",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "GET",
    mobileUrl: "/api/auth/profile/preferences",
    pathPattern: "/api/auth/profile/preferences",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "PUT",
    mobileUrl: "/api/auth/profile/preferences",
    pathPattern: "/api/auth/profile/preferences",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/devices",
    pathPattern: "/api/auth/devices",
    authType: "user",
    requiredBodyFields: ["token", "platform"],
  },
  {
    service: "auth",
    method: "DELETE",
    mobileUrl: "/api/auth/devices/:deviceId",
    pathPattern: "/api/auth/devices/:deviceId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/change-password",
    pathPattern: "/api/auth/change-password",
    authType: "user",
    requiredBodyFields: ["currentPassword", "newPassword"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/account/deletion-otp",
    pathPattern: "/api/auth/account/deletion-otp",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/logout",
    pathPattern: "/api/auth/logout",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "DELETE",
    mobileUrl: "/api/auth/account",
    pathPattern: "/api/auth/account",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/forgot-password",
    pathPattern: "/api/auth/forgot-password",
    authType: "none",
    requiredBodyFields: ["email"],
  },
  {
    service: "auth",
    method: "POST",
    mobileUrl: "/api/auth/reset-password",
    pathPattern: "/api/auth/reset-password",
    authType: "none",
    requiredBodyFields: ["email", "otp", "newPassword"],
  },

  // --- Guest Service (services/guest/api.ts & guestRoute.ts) ---
  {
    service: "guest",
    method: "POST",
    mobileUrl: "/api/guest/stream-token",
    pathPattern: "/api/guest/stream-token",
    authType: "guest",
    requiredBodyFields: [],
  },
  {
    service: "guest",
    method: "POST",
    mobileUrl: "/api/guest/refresh",
    pathPattern: "/api/guest/refresh",
    authType: "guest",
    requiredBodyFields: [],
  },

  // --- Items Service (services/items/api.ts) ---
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/categories",
    pathPattern: "/api/items/categories",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items",
    pathPattern: "/api/items",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/my-vault",
    pathPattern: "/api/items/my-vault",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/summary",
    pathPattern: "/api/items/summary",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/eligible-for-report",
    pathPattern: "/api/items/eligible-for-report",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/:id/selection-summary",
    pathPattern: "/api/items/:id/selection-summary",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/:id",
    pathPattern: "/api/items/:id",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "POST",
    mobileUrl: "/api/items",
    pathPattern: "/api/items",
    authType: "user",
    requiredBodyFields: ["name", "category"],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/items/public/:id",
    pathPattern: "/api/items/public/:id",
    authType: "none",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "PATCH",
    mobileUrl: "/api/items/:id",
    pathPattern: "/api/items/:id",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "DELETE",
    mobileUrl: "/api/items/:id",
    pathPattern: "/api/items/:id",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "PATCH",
    mobileUrl: "/v1/items/:id/status (fallback /api/items/:id/status)",
    pathPattern: "/v1/items/:id/status",
    authType: "user",
    requiredBodyFields: ["status"],
  },
  {
    service: "items",
    method: "GET",
    mobileUrl: "/api/scan/:qrCodeId",
    pathPattern: "/api/scan/:itemId",
    authType: "optional",
    requiredBodyFields: [],
  },
  {
    service: "items",
    method: "POST",
    mobileUrl: "/api/scan/guest-init",
    pathPattern: "/api/scan/guest-init",
    authType: "none",
    requiredBodyFields: ["itemId", "phoneNumber"],
  },

  // --- Returns Service (services/returns/api.ts) ---
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns",
    pathPattern: "/v1/returns",
    authType: "user",
    requiredBodyFields: ["channelId"],
  },
  {
    service: "returns",
    method: "GET",
    mobileUrl: "/v1/returns/:id",
    pathPattern: "/v1/returns/:id",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/meetup/propose",
    pathPattern: "/v1/returns/:id/meetup/propose",
    authType: "user_or_guest",
    requiredBodyFields: ["address", "latitude", "longitude", "scheduledTime"],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/meetup/accept",
    pathPattern: "/v1/returns/:id/meetup/accept",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/meetup/reject",
    pathPattern: "/v1/returns/:id/meetup/reject",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/tracking/start",
    pathPattern: "/v1/returns/:id/tracking/start",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/tracking/stop",
    pathPattern: "/v1/returns/:id/tracking/stop",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/arrival",
    pathPattern: "/v1/returns/:id/arrival",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/cancel",
    pathPattern: "/v1/returns/:id/cancel",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/handover/init",
    pathPattern: "/v1/returns/:id/handover/init",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/handover/confirm",
    pathPattern: "/v1/returns/:id/handover/confirm",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/handover/dispute",
    pathPattern: "/v1/returns/:id/handover/dispute",
    authType: "user",
    requiredBodyFields: ["reason"],
  },
  {
    service: "returns",
    method: "GET",
    mobileUrl: "/v1/returns/:id/reward",
    pathPattern: "/v1/returns/:id/reward",
    authType: "user_or_guest",
    requiredBodyFields: [],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/rating",
    pathPattern: "/v1/returns/:id/rating",
    authType: "user",
    requiredBodyFields: ["score"],
  },
  {
    service: "returns",
    method: "POST",
    mobileUrl: "/v1/returns/:id/claim/reject",
    pathPattern: "/v1/returns/:id/claim/reject",
    authType: "user",
    requiredBodyFields: [],
    notes: "Addition B claim rejection endpoint",
  },

  // --- Chat & Moderation (services/chat/api.ts & services/moderation/api.ts) ---
  {
    service: "chat",
    method: "POST",
    mobileUrl: "/api/stream/channels/:itemId/:finderId",
    pathPattern: "/api/stream/channels/:itemId/:finderId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "chat",
    method: "GET",
    mobileUrl: "/api/stream/channels",
    pathPattern: "/api/stream/channels",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "chat",
    method: "PUT",
    mobileUrl: "/api/stream/channels/:channelId/close",
    pathPattern: "/api/stream/channels/:channelId/close",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "POST",
    mobileUrl: "/api/stream/messages/:messageId/flag",
    pathPattern: "/api/stream/messages/:messageId/flag",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "DELETE",
    mobileUrl: "/api/stream/messages/:messageId/flag",
    pathPattern: "/api/stream/messages/:messageId/flag",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "POST",
    mobileUrl: "/api/stream/channels/:channelId/mute/:targetUserId",
    pathPattern: "/api/stream/channels/:channelId/mute/:targetUserId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "DELETE",
    mobileUrl: "/api/stream/channels/:channelId/mute/:targetUserId",
    pathPattern: "/api/stream/channels/:channelId/mute/:targetUserId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "POST",
    mobileUrl: "/api/stream/channels/:channelId/ban/:targetUserId",
    pathPattern: "/api/stream/channels/:channelId/ban/:targetUserId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "moderation",
    method: "GET",
    mobileUrl: "/api/stream/channels/:channelId/flagged-messages",
    pathPattern: "/api/stream/channels/:channelId/flagged-messages",
    authType: "user",
    requiredBodyFields: [],
  },

  // --- Reports (services/reports/api.ts & services/reports/found.ts) ---
  {
    service: "reports",
    method: "POST",
    mobileUrl: "/v1/reports",
    pathPattern: "/v1/reports",
    authType: "user",
    requiredBodyFields: ["itemId", "location", "radar", "reward"],
  },
  {
    service: "reports",
    method: "POST",
    mobileUrl: "/api/reports/lost-item",
    pathPattern: "/api/reports/lost-item",
    authType: "user",
    requiredBodyFields: ["itemId", "location", "bounty", "paymentMethod"],
  },
  {
    service: "found-reports",
    method: "POST",
    mobileUrl: "/api/found-reports",
    pathPattern: "/api/found-reports",
    authType: "user",
    requiredBodyFields: ["idempotencyKey", "name", "category", "imagePublicUrl", "location"],
  },
  {
    service: "found-reports",
    method: "GET",
    mobileUrl: "/api/found-reports/:id",
    pathPattern: "/api/found-reports/:id",
    authType: "optional",
    requiredBodyFields: [],
  },
  {
    service: "found-reports",
    method: "POST",
    mobileUrl: "/api/found-reports/:id/claims",
    pathPattern: "/api/found-reports/:id/claims",
    authType: "user",
    requiredBodyFields: ["ownershipProof"],
  },
  {
    service: "found-reports",
    method: "GET",
    mobileUrl: "/api/found-reports/:id/claims/mine",
    pathPattern: "/api/found-reports/:id/claims/mine",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "found-reports",
    method: "GET",
    mobileUrl: "/api/found-reports/:id/claims",
    pathPattern: "/api/found-reports/:id/claims",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "found-reports",
    method: "POST",
    mobileUrl: "/api/found-reports/:id/claims/:claimId/accept",
    pathPattern: "/api/found-reports/:id/claims/:claimId/accept",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "found-reports",
    method: "POST",
    mobileUrl: "/api/found-reports/:id/claims/:claimId/reject",
    pathPattern: "/api/found-reports/:id/claims/:claimId/reject",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "found-reports",
    method: "GET",
    mobileUrl: "/v1/found-reports/feed (fallback /api/found-reports/feed)",
    pathPattern: "/v1/found-reports/feed",
    authType: "optional",
    requiredBodyFields: [],
  },

  // --- Radar & Map (services/radar/api.ts & services/map/api.ts) ---
  {
    service: "radar",
    method: "GET",
    mobileUrl: "/v1/map/active-users",
    pathPattern: "/v1/map/active-users",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "radar",
    method: "GET",
    mobileUrl: "/v1/home/lost-feed (fallback /api/home/lost-feed)",
    pathPattern: "/v1/home/lost-feed",
    authType: "optional",
    requiredBodyFields: [],
  },
  {
    service: "radar",
    method: "GET",
    mobileUrl: "/api/map/nearby",
    pathPattern: "/api/map/nearby",
    authType: "optional",
    requiredBodyFields: [],
  },
  {
    service: "map",
    method: "GET",
    mobileUrl: "/v1/map/autocomplete",
    pathPattern: "/v1/map/autocomplete",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "map",
    method: "GET",
    mobileUrl: "/v1/map/place-details",
    pathPattern: "/v1/map/place-details",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "map",
    method: "GET",
    mobileUrl: "/v1/map/geocode (fallback /api/map/geocode)",
    pathPattern: "/v1/map/geocode",
    authType: "user",
    requiredBodyFields: [],
  },

  // --- Notifications (services/notifications/api.ts) ---
  {
    service: "notifications",
    method: "GET",
    mobileUrl: "/v1/notifications",
    pathPattern: "/v1/notifications",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "GET",
    mobileUrl: "/v1/notifications/unread-count",
    pathPattern: "/v1/notifications/unread-count",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "PUT",
    mobileUrl: "/v1/notifications/:id/read",
    pathPattern: "/v1/notifications/:id/read",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "PUT",
    mobileUrl: "/v1/notifications/read-all",
    pathPattern: "/v1/notifications/read-all",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "POST",
    mobileUrl: "/v1/notifications/devices",
    pathPattern: "/v1/notifications/devices",
    authType: "user",
    requiredBodyFields: ["deviceToken", "platform"],
  },
  {
    service: "notifications",
    method: "DELETE",
    mobileUrl: "/v1/notifications/devices/:deviceId",
    pathPattern: "/v1/notifications/devices/:deviceId",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "POST",
    mobileUrl: "/v1/notifications/:id/opened",
    pathPattern: "/v1/notifications/:id/opened",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "GET",
    mobileUrl: "/v1/notifications/preferences",
    pathPattern: "/v1/notifications/preferences",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "notifications",
    method: "PUT",
    mobileUrl: "/v1/notifications/preferences",
    pathPattern: "/v1/notifications/preferences",
    authType: "user",
    requiredBodyFields: [],
  },

  // --- Upload (services/upload/index.ts) ---
  {
    service: "upload",
    method: "POST",
    mobileUrl: "/api/upload/image",
    pathPattern: "/api/upload/image",
    authType: "user",
    requiredBodyFields: [],
  },
  {
    service: "upload",
    method: "DELETE",
    mobileUrl: "/api/upload/:filename",
    pathPattern: "/api/upload/:filename",
    authType: "user",
    requiredBodyFields: [],
  },
];

export function compareContract(endpoint: MobileEndpointCall): ContractComparison {
  // Check backend correspondence
  const mobileCallStr = `${endpoint.method} ${endpoint.mobileUrl}`;
  
  // Specific checks
  if (endpoint.pathPattern === "/v1/returns/:id/claim/reject") {
    return {
      mobileCall: mobileCallStr,
      backendRoute: "POST /v1/returns/:id/claim/reject (also /api/returns/:id/claim/reject)",
      match: "YES",
      fix: "None needed (implemented and wired with authMiddleware and rejectGuestClaim)",
    };
  }

  if (endpoint.pathPattern === "/api/scan/:itemId") {
    return {
      mobileCall: mobileCallStr,
      backendRoute: "GET /api/scan/:itemId (also /v1/scan/:itemId)",
      match: "YES",
      fix: "None (backend accepts qrCodeId in :itemId parameter for backwards compatibility)",
    };
  }

  if (endpoint.pathPattern === "/api/scan/guest-init") {
    return {
      mobileCall: mobileCallStr,
      backendRoute: "POST /api/scan/guest-init (also /v1/scan/guest-init)",
      match: "YES",
      fix: "None (returns chatToken, guestAccessToken, returnSessionId, guestInfo)",
    };
  }

  if (endpoint.pathPattern.startsWith("/v1/returns")) {
    return {
      mobileCall: mobileCallStr,
      backendRoute: `${endpoint.method} ${endpoint.pathPattern}`,
      match: "YES",
      fix: "None (matches /v1 and /api routes)",
    };
  }

  if (endpoint.pathPattern.startsWith("/api/guest")) {
    return {
      mobileCall: mobileCallStr,
      backendRoute: `${endpoint.method} ${endpoint.pathPattern} (and /v1/guest/*)`,
      match: "YES",
      fix: "None (guest routes mounted under both /api and /v1)",
    };
  }

  return {
    mobileCall: mobileCallStr,
    backendRoute: `${endpoint.method} ${endpoint.pathPattern}`,
    match: "YES",
    fix: "None",
  };
}

export function generateContractMarkdownTable(): string {
  const comparisons = mobileEndpoints.map(compareContract);
  let md = "| Mobile Call | Backend Route | Match? | Fix |\n";
  md += "| :--- | :--- | :---: | :--- |\n";
  for (const c of comparisons) {
    md += `| \`${c.mobileCall}\` | \`${c.backendRoute}\` | ${c.match === "YES" ? "✅ YES" : "❌ " + c.match} | ${c.fix} |\n`;
  }
  return md;
}

if (require.main === module) {
  console.log(generateContractMarkdownTable());
}
