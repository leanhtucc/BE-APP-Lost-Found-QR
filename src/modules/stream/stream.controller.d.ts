import { NextFunction, Request, Response } from "express";
export declare class StreamChatController {
    /**
     * GET /api/stream/token
     * Lấy Stream Chat token cho user hiện tại
     * Frontend sẽ dùng token này để connect vào Stream Chat
     */
    getToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /api/stream/channels/:itemId/:finderId
     * Tạo channel mới cho cuộc hội thoại về món đồ
     * Params: itemId, finderId
     */
    createChannel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/stream/channels
     * Lấy danh sách channel của user (Inbox)
     */
    getChannels: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /api/stream/channels/:channelId/close
     * Đóng channel khi đã trả đồ xong
     */
    closeChannel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * ====================
     * MODERATION ENDPOINTS
     * ====================
     */
    /**
     * POST /api/stream/messages/:messageId/flag
     * Flag một message không phù hợp
     */
    flagMessageEndpoint: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /api/stream/messages/:messageId/flag
     * Unflag một message
     */
    unflagMessageEndpoint: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /api/stream/channels/:channelId/mute/:targetUserId
     * Mute một user trong channel
     */
    muteUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /api/stream/channels/:channelId/mute/:targetUserId
     * Unmute một user trong channel
     */
    unmuteUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /api/stream/channels/:channelId/ban/:targetUserId
     * Ban một user khỏi channel
     */
    banUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /api/stream/channels/:channelId/ban/:targetUserId
     * Unban một user khỏi channel
     */
    unbanUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/stream/channels/:channelId/flagged-messages
     * Lấy danh sách messages bị flag trong channel
     */
    getFlaggedMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * ====================
     * NOTIFICATION ENDPOINTS
     * ====================
     */
    /**
     * GET /api/stream/notifications
     * Lấy danh sách notifications của user
     */
    getNotifications: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /api/stream/notifications/mark-read
     * Đánh dấu tất cả notifications đã đọc
     */
    markNotificationsRead: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /api/stream/activity
     * Log user activity
     */
    logActivityEndpoint: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=stream.controller.d.ts.map