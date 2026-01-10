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
