"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const env_1 = require("../config/env");
/**
 * Simple Logger
 * Có thể thay bằng Winston hoặc Pino cho production
 */
class Logger {
    getTimestamp() {
        return new Date().toISOString();
    }
    info(message, ...args) {
        console.log(`[${this.getTimestamp()}] [INFO]`, message, ...args);
    }
    error(message, error) {
        console.error(`[${this.getTimestamp()}] [ERROR]`, message, error);
    }
    warn(message, ...args) {
        console.warn(`[${this.getTimestamp()}] [WARN]`, message, ...args);
    }
    debug(message, ...args) {
        if (env_1.isDevelopment) {
            console.debug(`[${this.getTimestamp()}] [DEBUG]`, message, ...args);
        }
    }
    success(message, ...args) {
        console.log(`[${this.getTimestamp()}] [SUCCESS]`, message, ...args);
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map