import authRoutes from "../src/modules/auth/auth.routes";
import uploadRoutes from "../src/modules/upload/upload.routes";
import streamRoutes from "../src/modules/stream/stream.routes";
import mapRoutes from "../src/modules/map/map.routes";
import homeRoutes from "../src/modules/home/home.routes";
import reportRoutes from "../src/modules/report/report.routes";
import foundReportRoutes from "../src/modules/found-report/found-report.routes";
import radarRoutes from "../src/modules/radar/radar.routes";
import returnRoutes from "../src/modules/return/return.routes";
import guestRoutes from "../src/modules/guest/guest.routes";
import aiRoutes from "../src/modules/ai/ai.routes";
import itemRoutes from "../src/modules/item/item.routes";
import notificationRoutes from "../src/modules/notification/notification.routes";
import userDeviceRoutes from "../src/modules/notification/user-device.routes";

interface RouteDef {
  module: string;
  prefix: string;
  method: string;
  path: string;
}

function getRoutesFromRouter(mod: string, prefix: string, router: any): RouteDef[] {
  const routes: RouteDef[] = [];
  if (!router || !router.stack) return routes;
  for (const layer of router.stack) {
    if (layer.route) {
      const p = (prefix + (layer.route.path === "/" ? "" : layer.route.path)).replace(/\/+/g, "/");
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
      for (const method of methods) {
        routes.push({ module: mod, prefix, method, path: p });
      }
    }
  }
  return routes;
}

const allBackendRoutes: RouteDef[] = [
  { module: "health", prefix: "/", method: "GET", path: "/" },
  { module: "health", prefix: "/", method: "GET", path: "/health/live" },
  { module: "health", prefix: "/", method: "GET", path: "/health/ready" },
  { module: "payment", prefix: "/v1/payments", method: "POST", path: "/v1/payments/vnpay/webhook" },
  ...getRoutesFromRouter("auth", "/api/auth", authRoutes),
  ...getRoutesFromRouter("upload", "/api/upload", uploadRoutes),
  ...getRoutesFromRouter("stream", "/api/stream", streamRoutes),
  ...getRoutesFromRouter("map", "/api/map", mapRoutes),
  ...getRoutesFromRouter("home", "/api/home", homeRoutes),
  ...getRoutesFromRouter("report", "/api/reports", reportRoutes),
  ...getRoutesFromRouter("found-report", "/api/found-reports", foundReportRoutes),
  ...getRoutesFromRouter("radar", "/api/radar", radarRoutes),
  ...getRoutesFromRouter("return", "/api/returns", returnRoutes),
  ...getRoutesFromRouter("guest", "/api/guest", guestRoutes),
  ...getRoutesFromRouter("ai", "/api/ai", aiRoutes),
  ...getRoutesFromRouter("item", "/api", itemRoutes),
  ...getRoutesFromRouter("notification", "/v1/notifications", notificationRoutes),
  ...getRoutesFromRouter("user-device", "/v1/user-devices", userDeviceRoutes),
];

console.log(`Unique backend routes extracted: ${allBackendRoutes.length}`);
allBackendRoutes.forEach((r) => console.log(`${r.method.padEnd(6)} ${r.path} (${r.module})`));
