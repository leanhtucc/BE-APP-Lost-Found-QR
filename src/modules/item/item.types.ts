/**
 * Item Types
 * TypeScript interfaces cho Item module
 */

export interface Location {
  lat: number;
  lng: number;
}

export const ITEM_CATEGORIES = [
  "electronics",
  "wallet",
  "keys",
  "bag",
  "documents",
  "jewelry",
  "phone",
  "other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface CreateItemDTO {
  name: string;
  category: ItemCategory;
  description?: string;
  imagePublicUrl?: string;
  lastSeenLocation?: string; // JSON string của Location
  securityPin?: string;
}

export interface UpdateItemDTO {
  name?: string;
  category?: ItemCategory;
  description?: string;
  status?: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED";
  lostMessage?: string;
  imagePublicUrl?: string;
  lastSeenLocation?: string; // JSON string của Location
  securityPin?: string;
}

export interface UpdateItemStatusDTO {
  status: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED";
  lostMessage?: string;
  latitude?: number;
  longitude?: number;
}

export interface ItemResponse {
  id: string;
  itemId: string;
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  status: string;
  lostMessage?: string;
  qrCodeUrl?: string;
  imagePublicUrl?: string;
  lastSeenLocation?: string;
  securityPin?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnerInfo {
  display_name: string;
  avatar?: string;
  joined_date: string;
}

export interface ScanQRResponse {
  item_info: {
    id: string;
    name: string;
    category: string;
    status: string;
    description?: string;
    lost_message?: string;
    image_url?: string;
    owner_info: OwnerInfo;
    bounty_amount?: number;
    escrow_status?: string;
  };
  action: "open_chat" | "info_only";
  message?: string;
}

export interface ListItemsQuery {
  status?: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED" | "ALL";
  category?: string;
  page?: number;
  limit?: number;
}

export interface ListItemsResponse {
  items: ItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search Items
export interface SearchItemsQuery {
  q: string; // Search keyword
  status?: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED" | "ALL";
  category?: string;
  page?: number;
  limit?: number;
}

export interface SearchItemsResponse {
  items: ItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
}

// Dashboard Summary
export interface DashboardSummary {
  totalItems: number;
  safeItems: number;
  lostItems: number;
  recentItems: ItemResponse[];
  categorySummary: {
    category: string;
    count: number;
  }[];
}
