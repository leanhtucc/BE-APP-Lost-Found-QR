import app from "../src/app";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// Extract all registered routes in express app
interface ExpressRoute {
  method: string;
  path: string;
}

function getExpressRoutes(app: any): ExpressRoute[] {
  const routes: ExpressRoute[] = [];

  function print(path: string[], layer: any) {
    if (layer.route) {
      const routePath = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      const fullPath = [...path, routePath]
        .filter(Boolean)
        .join("")
        .replace(/\/+/g, "/");
      for (const method of methods) {
        routes.push({ method, path: fullPath });
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      let routerPath = "";
      if (layer.regexp && layer.regexp.source) {
        // approximate match from regex
        const source = layer.regexp.source;
        const clean = source
          .replace("^\\", "")
          .replace("\\/?(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace(/\^/g, "")
          .replace(/\(?:\?\:.*?\)/g, "")
          .replace(/\$/g, "");
        routerPath = clean;
      }
      layer.handle.stack.forEach((stackItem: any) => {
        print([...path, routerPath], stackItem);
      });
    }
  }

  app._router.stack.forEach((layer: any) => {
    print([], layer);
  });

  return routes;
}

console.log("Auditing contract...");
