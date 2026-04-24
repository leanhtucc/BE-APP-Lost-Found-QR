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

      if (!id) {
        return ResponseUtil.badRequest(res, "Item ID is required");
      }

      const result = await itemService.getItem(id, userId);

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items/my-vault - Lấy danh sách đồ ở trạng thái an toàn
  async getVaultItems(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await itemService.listItems(userId, {
        status: "SAFE",
        page: 1,
        limit: 100,
      });
      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items/eligible-for-report - Màn hình 1 Guardian
  async getEligibleForReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await itemService.getEligibleItemsForReport(userId);
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

      if (!id) {
        return ResponseUtil.badRequest(res, "Item ID is required");
      }

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

      if (!id) {
        return ResponseUtil.badRequest(res, "Item ID is required");
      }

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
      const { status, lostMessage, latitude, longitude } = req.query as any;

      if (!id) {
        return ResponseUtil.badRequest(res, "Item ID is required");
      }

      const result = await itemService.updateStatus(
        id,
        userId,
        status,
        lostMessage,
        {
          latitude:
            latitude !== undefined && latitude !== ""
              ? Number(latitude)
              : undefined,
          longitude:
            longitude !== undefined && longitude !== ""
              ? Number(longitude)
              : undefined,
        }
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

      if (!itemId) {
        return ResponseUtil.badRequest(res, "Item ID is required");
      }

      const result = await itemService.scanQRCode(itemId);

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/scan/guest-init - Khởi tạo chat ẩn danh (Guest Flow B+)
  async initGuestChat(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId, phoneNumber, lat, lng } = req.body;

      if (!itemId || !phoneNumber) {
        return ResponseUtil.badRequest(res, "Item ID and Phone Number are required");
      }

      const result = await itemService.initGuestChat(itemId, phoneNumber, lat, lng);
      return ResponseUtil.success(res, result, "Guest session created successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items/search - Tìm kiếm items
  async searchItems(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { q, status, category, page, limit } = req.query as any;

      const result = await itemService.searchItems(userId, {
        q,
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

  // GET /api/items/summary - Lấy thống kê dashboard
  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;

      const result = await itemService.getDashboardSummary(userId);

      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/items/categories - Lấy danh sách categories
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = itemService.getCategories();
      return ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}
