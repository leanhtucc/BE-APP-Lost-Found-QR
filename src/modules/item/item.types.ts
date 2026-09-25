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

export interface CaptureLocation {
  latitude: number;
  longitude: number;
  address?: string | null;
  accuracyMeters?: number | null;
  capturedAt?: Date | string | null;
}

export interface CreateItemDTO {
  name: string;
  category: ItemCategory;
  description?: string;
  imagePublicUrl?: string;
  hasInsurance?: boolean;
  details?: any; // JSONB
  captureLocation?: CaptureLocation | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  lastSeenLocation?: string | null;
  locationGeoHash?: string | null;
}

export interface UpdateItemDTO {
  name?: string;
  category?: ItemCategory;
  description?: string;
  status?: "SAFE" | "LOST" | "FOUND" | "RESOLVED";
  lostMessage?: string;
  lostAddress?: string;
  imagePublicUrl?: string;
  hasInsurance?: boolean;
  details?: any; // JSONB
  captureLocation?: CaptureLocation | null;
  captureLatitude?: number | null;
  captureLongitude?: number | null;
  captureAddress?: string | null;
  captureAccuracyMeters?: number | null;
  capturedAt?: Date | string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  lastSeenLocation?: string | null;
}

export interface UpdateItemStatusDTO {
  status: "SAFE" | "LOST";
  lostMessage?: string;
  lostAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface ItemResponse {
  id: string;
  itemId: string;
  publicItemId: string;
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  status: string;
  lostMessage?: string;
  lostAddress?: string;
  lostLat?: number;
  lostLng?: number;
  latitude?: number;
  longitude?: number;
  lastSeenLocation?: string;
  qrCodeId: string;
  imagePublicUrl?: string;
  details?: any;
  hasInsurance: boolean;
  captureLatitude?: number | null;
  captureLongitude?: number | null;
  captureAddress?: string | null;
  captureAccuracyMeters?: number | null;
  capturedAt?: Date | null;
  captureLocation?: CaptureLocation | null;
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
  status?: "SAFE" | "LOST" | "FOUND" | "RESOLVED" | "ALL";
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
  status?: "SAFE" | "LOST" | "FOUND" | "RESOLVED" | "ALL";
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

// Selection Summary (box "Chi tiết lựa chọn" – Guardian Radar)
export interface SelectionSummaryResponse {
  id: string;
  name: string;
  category: string;
  image_url?: string;
  display_text: {
    /** Màu + dung lượng (VD: "Titan Đen - 256GB") */
    primary: string;
    /** Mô tả AI (ốp lưng, vết xước, sticker...) */
    secondary: string;
    /** Serial đã mask (VD: "48A9...XL0"), null nếu chưa có */
    serial_number: string | null;
  };
  status_badges: {
    has_insurance: boolean;
    label: string;
    color_theme: "SUCCESS" | "STANDARD" | "NONE";
  };
  /** Danh sách tag ngắn từ AI (VD: ["Titan Đen", "Ốp lưng xanh"]) */
  ai_visual_tags: string[];
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

export interface PublicItemResponse {
  id: string;
  publicItemId: string;
  name: string;
  category: string;
  status: string;
  description?: string | null;
  lostMessage?: string | null;
  lostAddress?: string | null;
  lostLat?: number | null;
  lostLng?: number | null;
  imagePublicUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner?: {
    displayName: string;
    avatar?: string | null;
    joinedDate: string;
  };
  message?: string;
}

