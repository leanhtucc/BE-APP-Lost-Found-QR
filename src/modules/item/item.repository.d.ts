import { CreateItemDTO, UpdateItemDTO } from "./item.types";
/**
 * Item Repository
 * Database access layer cho Item
 */
export declare class ItemRepository {
    createItem(data: CreateItemDTO & {
        ownerId: string;
        itemId: string;
        securityToken: string;
        qrCodeUrl: string;
    }): Promise<{
        owner: {
            id: string;
            uid: string;
            displayName: string;
            email: string;
            photoURL: string | null;
            createdAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }>;
    findById(id: string): Promise<({
        owner: {
            id: string;
            uid: string;
            displayName: string;
            email: string;
            photoURL: string | null;
            createdAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }) | null>;
    findByItemId(itemId: string): Promise<({
        owner: {
            id: string;
            uid: string;
            displayName: string;
            email: string;
            photoURL: string | null;
            createdAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }) | null>;
    findBySecurityToken(securityToken: string): Promise<({
        owner: {
            id: string;
            uid: string;
            displayName: string;
            email: string;
            photoURL: string | null;
            createdAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }) | null>;
    findByOwnerId(ownerId: string, options: {
        status?: string;
        category?: string;
        skip: number;
        take: number;
    }): Promise<{
        items: ({
            owner: {
                id: string;
                uid: string;
                displayName: string;
                email: string;
                photoURL: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            itemId: string;
            category: string;
            description: string | null;
            status: string;
            lostMessage: string | null;
            qrCodeUrl: string | null;
            imagePublicUrl: string | null;
            lastSeenLocation: string | null;
            securityPin: string | null;
            securityToken: string;
            ownerId: string;
        })[];
        total: number;
    }>;
    updateItem(id: string, data: UpdateItemDTO): Promise<{
        owner: {
            id: string;
            uid: string;
            displayName: string;
            email: string;
            photoURL: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }>;
    deleteItem(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        itemId: string;
        category: string;
        description: string | null;
        status: string;
        lostMessage: string | null;
        qrCodeUrl: string | null;
        imagePublicUrl: string | null;
        lastSeenLocation: string | null;
        securityPin: string | null;
        securityToken: string;
        ownerId: string;
    }>;
    countByOwnerId(ownerId: string): Promise<number>;
    isOwner(itemId: string, ownerId: string): Promise<boolean>;
}
//# sourceMappingURL=item.repository.d.ts.map