export interface RadarSimulateParams {
  lat: number;
  lng: number;
  radius: number; // metres
}

export interface RadarSimulateResponse {
  active_users_count: number;
  recommended_radius: number;    // metres
  estimated_duration_hours: number;
}
