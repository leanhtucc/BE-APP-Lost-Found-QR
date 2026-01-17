/**
 * Item Types
 * TypeScript interfaces cho Item module
 */
export interface Location {
    lat: number;
    lng: number;
}
export interface CreateItemDTO {
    name: string;
    category: string;
    description?: string;
    imagePublicUrl?: string;
    lastSeenLocation?: string;
    securityPin?: string;
}
export interface UpdateItemDTO {
    name?: string;
    category?: string;
    description?: string;
    status?: "safe" | "lost";
    lostMessage?: string;
    imagePublicUrl?: string;
    lastSeenLocation?: string;
    securityPin?: string;
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
    };
    action: "open_chat" | "info_only";
    message?: string;
}
export interface ListItemsQuery {
    status?: "safe" | "lost" | "all";
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
//# sourceMappingURL=item.types.d.ts.map