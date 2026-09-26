import { NotificationCategory, Prisma } from "../../generated/prisma/client";

export interface NotificationDTO {
  _id: string;
  type: string;
  title: LocalizedNotificationText;
  content: LocalizedNotificationText;
  attachment: string;
  status: "VIEW" | "UN_VIEW";
  user_id: string;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  action: NotificationAction | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationListQuery {
  page: number;
  perPage: number;
  status?: "VIEW" | "UN_VIEW";
}

export interface NotificationListResponse {
  total_unread: number;
  total: number;
  page: number;
  per_page: number;
  items: NotificationDTO[];
}

export interface LocalizedNotificationText {
  vi: string;
  en: string;
}

export type NotificationEntityType =
  "ITEM" | "FOUND_REPORT" | "RETURN_SESSION" | "CHAT";
export type NotificationAction =
  "OPEN_ITEM" | "OPEN_FOUND_REPORT" | "OPEN_CHAT" | "OPEN_RETURN_SESSION";

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
  _id: string;
  platform: "android" | "ios";
  device_id: string;
  device_name: string | null;
  app_version: string | null;
  last_active_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterDeviceInput {
  token: string;
  platform: "android" | "ios";
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

export interface CreateNotificationInput {
  receiverId: string;
  category: NotificationCategory;
  type: string;
  title: LocalizedNotificationText | string;
  content: LocalizedNotificationText | string;
  attachment?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  action?: NotificationAction;
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
  title: LocalizedNotificationText | string;
  content: LocalizedNotificationText | string;
  entityType?: NotificationEntityType;
  entityId?: string;
  action?: NotificationAction;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
}
