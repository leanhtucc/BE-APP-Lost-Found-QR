/**
 * Items Module Types
 */

export interface CreateItemDTO {
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  lostMessage?: string;
}

export interface UpdateItemStatusDTO {
  status: "safe" | "lost";
  lostMessage?: string;
}

export interface ItemResponse {
  itemId: string;
  name: string;
  status: string;
  lostMessage: string | null;
  ownerName: string;
  ownerId: string;
  createdAt: Date;
}
