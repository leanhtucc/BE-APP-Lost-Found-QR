import { NotificationCategory, Prisma } from "../../generated/prisma/client";

export interface NotificationDTO {
  id: string;
  receiver_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  content: string;
  metadata: Prisma.JsonValue | null;
  is_read: boolean;
  dedupe_key?: string | null;
  delivery_status?: string;
  opened_at?: string | null;
  created_at: string;
}

export interface NotificationListQuery {
  category?: NotificationCategory;
  page: number;
  limit: number;
}

export interface NotificationListResponse {
  data: NotificationDTO[];
  total_unread: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export interface MarkAllReadResponse {
  updated_count: number;
}

export interface NotificationPreferenceDTO {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  proximity_enabled: boolean;
  notification_radius_meters: number;
  language: "vi" | "en";
  important_enabled: boolean;
  transaction_enabled: boolean;
  item_enabled: boolean;
  social_enabled: boolean;
  daily_digest_enabled: boolean;
  nearby_alerts_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  daily_digest_time: string;
  nearby_radius: number;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferenceInput {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  proximityEnabled?: boolean;
  notificationRadiusMeters?: number;
  language?: "vi" | "en";
  importantEnabled?: boolean;
  transactionEnabled?: boolean;
  itemEnabled?: boolean;
  socialEnabled?: boolean;
  dailyDigestEnabled?: boolean;
  nearbyAlertsEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
  timezone?: string;
  dailyDigestTime?: string;
  nearbyRadius?: number;
}

export interface UserDeviceDTO {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  device_id: string;
  last_active_at: string;
  is_active: boolean;
  created_at: string;
}

export interface RegisterDeviceInput {
  token: string;
  platform?: "android" | "ios" | "web";
  deviceId: string;
  appVersion?: string;
}

export interface CreateNotificationInput {
  receiverId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
  collapseKey?: string;
  emitRealtime?: boolean;
  sendPush?: boolean;
  pushPriority?: "normal" | "high";
  tag?: string;
}

export interface EscrowLockedNotificationInput {
  receiverId: string;
  amount: number;
  transactionId: string;
  postId: string;
}

export interface MoneyNotificationInput {
  receiverId: string;
  amount: number;
  transactionId: string;
  status: "refunded" | "released";
  postId?: string;
}

export interface MatchFoundNotificationInput {
  receiverId: string;
  distanceMeters: number;
  postId: string;
  itemName: string;
}

export interface ProximityNotificationInput {
  receiverId: string;
  distanceMeters: number;
  postId?: string;
}

export interface NewChatNotificationInput {
  receiverId: string;
  senderAvatar?: string;
  roomId: string;
  messagePreview: string;
  itemId?: string;
}

export interface StatusUpdateNotificationInput {
  receiverId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
}
