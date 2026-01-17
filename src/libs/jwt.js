"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.decodeToken = decodeToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.ENV.JWT_SECRET, {
        expiresIn: env_1.ENV.JWT_EXPIRES_IN,
    });
}
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.ENV.JWT_REFRESH_SECRET, {
        expiresIn: env_1.ENV.JWT_REFRESH_EXPIRES_IN,
    });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_REFRESH_SECRET);
}
function decodeToken(token) {
    return jsonwebtoken_1.default.decode(token);
}
//# sourceMappingURL=jwt.js.map