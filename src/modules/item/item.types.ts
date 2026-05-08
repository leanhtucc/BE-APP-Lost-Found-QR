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
  hasInsurance?: boolean;
  details?: any; // JSONB
}

export interface UpdateItemDTO {
  name?: string;
  category?: ItemCategory;
  description?: string;
  status?: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED";
  lostMessage?: string;
  imagePublicUrl?: string;
  hasInsurance?: boolean;
  details?: any; // JSONB
}

export interface UpdateItemStatusDTO {
  status: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED";
  lostMessage?: string;
  latitude?: number;
  longitude?: number;
}

export interface ItemResponse {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  status: string;
  lostMessage?: string;
  qrCodeId: string;
  imagePublicUrl?: string;
  details?: any;
  hasInsurance: boolean;
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
