import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { logger } from "./libs/logger";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { rateLimit } from "./middlewares/rate-limit.middleware";
import { ENV } from "./config/env";

/**
 * Express Application Setup
 */

const app: Express = express();
app.set("trust proxy", ENV.TRUST_PROXY_HOPS);

// Security & Basic Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ENV.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve static files (assets, images, etc.)
app.use("/public", express.static("public"));

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  })
);

// Application Routes
app.use(routes);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
