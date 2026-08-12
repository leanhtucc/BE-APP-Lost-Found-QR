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

export interface CreateNotificationInput {
  receiverId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
  emitRealtime?: boolean;
  sendPush?: boolean;
  pushPriority?: "normal" | "high";
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
}
