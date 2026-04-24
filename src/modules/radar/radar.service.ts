import { reportService } from "../report/report.service";
import { RadarSimulateParams, RadarSimulateResponse } from "./radar.types";

export class RadarService {
  /**
   * Count how many active users are within `radius` metres of a coordinate.
   * Delegates to the shared helper in reportService to avoid duplicating SQL.
   */
  async simulate(params: RadarSimulateParams): Promise<RadarSimulateResponse> {
    const { lat, lng, radius } = params;

    const activeUsersCount = await reportService.countNearbyActiveUsers(
      lat,
      lng,
      radius
    );

    return {
      active_users_count: activeUsersCount,
      recommended_radius: radius,
      estimated_duration_hours: 24, // default suggestion shown on UI
    };
  }
}

export const radarService = new RadarService();
