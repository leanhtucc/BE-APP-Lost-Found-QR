import { CreateItemDTO, ItemResponse, ListItemsQuery, ListItemsResponse, ScanQRResponse, UpdateItemDTO } from "./item.types";
export declare class ItemService {
    private formatItemResponse;
    createItem(userId: string, data: CreateItemDTO): Promise<ItemResponse>;
    getItem(itemId: string, userId: string): Promise<ItemResponse>;
    scanQRCode(itemId: string): Promise<ScanQRResponse>;
    listItems(userId: string, query: ListItemsQuery): Promise<ListItemsResponse>;
    updateItem(itemId: string, userId: string, data: UpdateItemDTO): Promise<ItemResponse>;
    deleteItem(itemId: string, userId: string): Promise<void>;
    updateStatus(itemId: string, userId: string, status: "safe" | "lost", lostMessage?: string): Promise<ItemResponse>;
}
export declare const itemService: ItemService;
//# sourceMappingURL=item.service.d.ts.map