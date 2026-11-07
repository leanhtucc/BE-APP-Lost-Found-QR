import app from "../src/app";

interface RouteInfo {
  method: string;
  path: string;
}

function getRoutes(stack: any[], prefix = ""): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const middleware of stack) {
    if (middleware.route) {
      // It's a route
      const path = prefix + (middleware.route.path === "/" ? "" : middleware.route.path);
      for (const method of Object.keys(middleware.route.methods)) {
        routes.push({
          method: method.toUpperCase(),
          path: path || "/",
        });
      }
    } else if (middleware.name === "router" && middleware.handle.stack) {
      // It's a sub-router
      let subPrefix = prefix;
      if (middleware.regexp) {
        const match = middleware.regexp.source
          .replace("^\\", "")
          .replace("\\/?(?=\\(\\?:\$|\\/\\?))", "")
          .replace("(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace("^", "")
          .replace("(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace(/\/\?$/, "");
        
        // Cleaner regex to path string
        const cleanPath = middleware.regexp
          .toString()
          .replace("/^\\", "")
          .replace("\\/?(?=\\/|$)/i", "")
          .replace(/\\\//g, "/")
          .replace(/^\/\^/, "")
          .replace(/\/\?\(?=\\\/\|\$\)\/i$/, "")
          .replace(/\/\?$/, "");
      }
      routes.push(...getRoutes(middleware.handle.stack, subPrefix));
    }
  }

  return routes;
}

// Let's print out the route stack
console.log("Extracting routes...");
