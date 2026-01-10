import { Request, Response, NextFunction } from "express";
import { ItemsService } from "./items.service";
import { ResponseUtil } from "../../utils/response";

/**
 * Items Controller
 * Handle HTTP requests
 */

const itemsService = new ItemsService();

export class ItemsController {
  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, category, description, lostMessage } = req.body;
      const userId = req.user!.id;

      const item = await itemsService.createItem({
        ownerId: userId,
        name,
        category,
        description,
        lostMessage,
      });

      return ResponseUtil.created(res, item, "Item created successfully");
    } catch (error) {
      next(error);
    }
  }

  async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { token } = req.query;

      const item = await itemsService.getItemByItemId(
        itemId,
        token as string
      );

      return ResponseUtil.success(res, item);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { status, lostMessage } = req.body;
      const userId = req.user!.id;

      const updated = await itemsService.updateItemStatus(itemId, userId, {
        status,
        lostMessage,
      });

      return ResponseUtil.success(res, updated, "Status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items - Lấy danh sách món đồ của user
  async getMyItems(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const items = await itemsService.getItemsByOwner(userId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const userId = req.user!.id;

      await itemsService.deleteItem(itemId, userId);

      return ResponseUtil.success(res, null, "Item deleted successfully");
    } catch (error) {
      next(error