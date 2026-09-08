/**
 * Application Constants
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** Home is a fixed lost-item radar, never a client-defined global search. */
export const HOME_LOST_RADIUS_METERS = 10_000;
export const HOME_LOST_FEED_LIMIT = 100;

export const ITEM_STATUS = {
  SAFE: "safe",
  LOST: "lost",
} as const;

export const ITEM_CATEGORIES = {
  WALLET: "wallet",
  LAPTOP: "laptop",
  PHONE: "phone",
  KEYS: "keys",
  PET: "pet",
  BAG: "bag",
  OTHER: "other",
} as const;

export const AUTH_PROVIDER = {
  EMAIL: "email",
  GOOGLE: "google",
  FACEBOOK: "facebook",
} as const;

export const MESSAGE_TYPE = {
  TEXT: "text",
  IMAGE: "image",
  LOCATION: "location",
} as const;
