import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { ItemService } from "./item.service";

/**
 * Item Controller
 * Handle Item HTTP requests
 */

const itemService = new ItemService();

export class ItemController {
  // POST /api/items - Tạo item mới
  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const {
        name,
        category,
        description,
        imagePublicUrl,
        lastSeenLocation,
        securityPin,
      } = req.query as any;

      const result = await itemService.createItem(userId, {
        name,
        category,
        description,
        imagePublicUrl,
        lastSeenLocation,
        securityPin,
      });

      return ResponseUtil.created(res, result, "Item created successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items/:id - Lấy thông tin item
  async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const result = await itemService.getItem(id, userId);

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items - Lấy danh sách items của user
  async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { status, category, page, limit } = req.query as any;

      const result = await itemService.listItems(userId, {
        status,
        category,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
      });

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/items/:id - Cập nhật item
  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const {
        name,
        category,
        description,
        status,
        lostMessage,
        imagePublicUrl,
        lastSeenLocation,
        securityPin,
      } = req.query as any;

      const result = await itemService.updateItem(id, userId, {
        name,
        category,
        description,
        status,
        lostMessage,
        imagePublicUrl,
        lastSeenLocation,
        securityPin,
      });

      return ResponseUtil.success(res, result, "Item updated successfully");
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/items/:id - Xóa item
  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await itemService.deleteItem(id, userId);

      return ResponseUtil.success(res, null, "Item deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/items/:id/status - Cập nhật trạng thái item
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { status, lostMessage } = req.query as any;

      const result = await itemService.updateStatus(
        id,
        userId,
        status,
        lostMessage
      );

      return ResponseUtil.success(res, result, "Status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/scan/:itemId - Quét QR code (Public endpoint)
  async scanQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;

      const result = await itemService.scanQRCode(itemId);

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}
