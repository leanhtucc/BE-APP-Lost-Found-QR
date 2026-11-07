import express from "express";
import app from "../src/app";
import { mobileEndpoints } from "./verify-mobile-backend-contract";

// List all registered express routes
function extractRoutes(app: any) {
  const routes: { method: string; path: string }[] = [];

  function processMiddleware(middleware: any, prefix = "") {
    if (middleware.route) {
      const path = prefix + (middleware.route.path === "/" ? "" : middleware.route.path);
      const methods = Object.keys(middleware.route.methods).map((m) => m.toUpperCase());
      methods.forEach((method) => {
        routes.push({ method, path: path.replace(/\/+/g, "/") });
      });
    } else if (middleware.name === "router" && middleware.handle.stack) {
      let routerPrefix = "";
      if (middleware.regexp) {
        const match = middleware.regexp.source
          .replace("^\\", "")
          .replace("\\/?(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace(/\^/g, "")
          .replace(/\(?:\?\:.*?\)/g, "")
          .replace(/\$/g, "");
        if (match && match !== "/" && match !== "") {
          routerPrefix = "/" + match.replace(/^\//, "");
        }
      }
      middleware.handle.stack.forEach((subMiddleware: any) => {
        processMiddleware(subMiddleware, prefix + routerPrefix);
      });
    }
  }

  app._router.stack.forEach((middleware: any) => {
    processMiddleware(middleware);
  });

  return routes;
}

const allBackendRoutes = extractRoutes(app);
console.log(`Extracted ${allBackendRoutes.length} backend route entries.`);

// Map mobile calls
console.log(`Mobile endpoints count: ${mobileEndpoints.length}`);
