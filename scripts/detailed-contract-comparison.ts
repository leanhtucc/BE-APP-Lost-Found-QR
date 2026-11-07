import app from "../src/app";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// 1. Get all routes in Express
interface RouteInfo {
  method: string;
  path: string;
}

function extractAllRoutes(app: any): RouteInfo[] {
  const routes: RouteInfo[] = [];

  function parseLayer(layer: any, prefix = "") {
    if (layer.route) {
      const p = (prefix + (layer.route.path === "/" ? "" : layer.route.path)).replace(/\/+/g, "/");
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      for (const m of methods) {
        routes.push({ method: m, path: p });
      }
    } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
      let routerPath = "";
      if (layer.regexp) {
        const str = layer.regexp.toString();
        // Extract literal path prefix from regex like /^\/api\/v1\/?(?=\/|$)/i
        const match = str.match(/^\/\^\\?\/([^\\/?]+(?:\/\\?[^\\/?]+)*)/);
        if (match) {
          routerPath = "/" + match[1].replace(/\\/g, "");
        } else {
          // alternative match for fast_slash or complex regex
          const fastMatch = str.match(/^\/\^((?:\\\/[a-zA-Z0-9_\-]+)+)/);
          if (fastMatch) {
            routerPath = fastMatch[1].replace(/\\/g, "");
          }
        }
      }
      layer.handle.stack.forEach((sub: any) => {
        parseLayer(sub, prefix + routerPath);
      });
    }
  }

  app._router.stack.forEach((l: any) => parseLayer(l));
  return routes;
}

const expressRoutes = extractAllRoutes(app);
// Deduplicate
const uniqueRoutes = Array.from(
  new Set(expressRoutes.map((r) => `${r.method} ${r.path}`))
).map((s) => {
  const [method, path] = s.split(" ");
  return { method, path };
});

console.log(`Total backend routes found: ${uniqueRoutes.length}`);
uniqueRoutes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
uniqueRoutes.forEach((r) => console.log(`${r.method.padEnd(7)} ${r.path}`));
