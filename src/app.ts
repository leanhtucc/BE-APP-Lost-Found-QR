import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { logger } from "./libs/logger";
import routes from "./routes";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware";
import { rateLimit } from "./middlewares/rate-limit.middleware";

/**
 * Express Application Setup
 */

const app: Express = express();

// Security & Basic Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true })); // URL-encoded parser

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
