"use strict";
/**
 * Application Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_TYPE = exports.AUTH_PROVIDER = exports.ITEM_CATEGORIES = exports.ITEM_STATUS = exports.HTTP_STATUS = void 0;
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
};
exports.ITEM_STATUS = {
    SAFE: "safe",
    LOST: "lost",
};
exports.ITEM_CATEGORIES = {
    WALLET: "wallet",
    LAPTOP: "laptop",
    PHONE: "phone",
    KEYS: "keys",
    PET: "pet",
    BAG: "bag",
    OTHER: "other",
};
exports.AUTH_PROVIDER = {
    EMAIL: "email",
    GOOGLE: "google",
    FACEBOOK: "facebook",
};
exports.MESSAGE_TYPE = {
    TEXT: "text",
    IMAGE: "image",
    LOCATION: "location",
};
//# sourceMappingURL=constants.js.map