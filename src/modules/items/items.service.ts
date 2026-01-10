import { nanoid } from "nanoid";
import { ItemsRepository } from "./items.repository";
import {
  CreateItemDTO,
  UpdateItemStatusDTO,
  ItemResponse,
} from "./items.types";
import { AppError } from "../../middlewares/error.middleware";

/**
 * Items Service
 * Business logic layer
 */

const itemsRepository = new ItemsRepository();

export class ItemsService {
  async createItem(data: CreateItemDTO) {
    const itemId = nanoid(12);
    const securityToken = nanoid(32);
    const qrCodeUrl = `https://myapp.com/item/${itemId}?token=${securityToken}`;

    const item = await itemsRepository.create({
      itemId,
      ownerId: data.ownerId,
      name: data.name,
      category: data.category,
      description: data.description,
      lostMessage: data.lostMessage,
      status: "safe",
      qrCodeUrl,
      securityToken,
    });

    return item;
  }

  async getItemByItemId(
    itemId: string,
    securityToken?: string
  ): Promise<ItemResponse> {
    const item = await itemsRepository.findByItemId(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (securityToken && item.securityToken !== securityToken) {
      throw new AppError("Invalid security token", 403);
    }

    return {
      itemId: item.itemId,
      name: item.name,
      status: item.status,
      lostMessage: item.status === "lost" ? item.lostMessage : null,
      ownerName: item.owner.displayName,
      ownerId: item.owner.id,
      createdAt: item.createdAt,
    };
  }

  async updateItemStatus(
    itemId: string,
    ownerId: string,
    data: UpdateItemStatusDTO
  ) {
    const item = await itemsRepository.findByItemId(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== ownerId) {
      throw new AppError("You are not the owner of this item", 403);
    }

    const updated = await itemsRepository.update(itemId, {
      status: data.status,
      lostMessage: data.status === "lost" ? data.lostMessage : null,
    });

    return updated;
  }

  async getItemsByOwner(ownerId: string) {
    return await itemsRepository.findByOwnerId(ownerId);
  }

  async deleteItem(itemId: string, ownerId: string) {
    const item = await itemsRepository.findByItemId(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== ownerId) {
      throw new AppError("You are not the owner of this item", 403);
    }

    await itemsRepository.delete(itemId);
  }
}
