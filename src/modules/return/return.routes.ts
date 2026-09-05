import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { returnController } from "./return.controller";
import {
  confirmHandoverSchema,
  createOrGetSessionSchema,
  disputeHandoverSchema,
  proposeMeetupSchema,
  submitRatingSchema,
} from "./return.schema";

const router = Router();

// Tất cả endpoints đều yêu cầu authenticated token
router.use(authMiddleware);

/**
 * @route   POST /v1/returns
 * @desc    Tạo hoặc lấy phiên hoàn trả theo channelId
 */
router.post(
  "/",
  validate(createOrGetSessionSchema),
  returnController.createOrGetSession
);

/**
 * @route   GET /v1/returns/:id
 * @desc    Lấy chi tiết phiên hoàn trả
 */
router.get("/:id", returnController.getSession);

/**
 * @route   POST /v1/returns/:id/meetup/propose
 * @desc    Đề xuất điểm hẹn
 */
router.post(
  "/:id/meetup/propose",
  validate(proposeMeetupSchema),
  returnController.proposeMeetup
);

/**
 * @route   POST /v1/returns/:id/meetup/accept
 * @desc    Chấp nhận điểm hẹn
 */
router.post("/:id/meetup/accept", returnController.acceptMeetup);

/**
 * @route   POST /v1/returns/:id/meetup/reject
 * @desc    Từ chối hoặc hủy điểm hẹn
 */
router.post("/:id/meetup/reject", returnController.rejectMeetup);

/**
 * @route   POST /v1/returns/:id/tracking/start
 * @desc    Bắt đầu live tracking
 */
router.post("/:id/tracking/start", returnController.startTracking);

/**
 * @route   POST /v1/returns/:id/tracking/stop
 * @desc    Dừng live tracking
 */
router.post("/:id/tracking/stop", returnController.stopTracking);

/**
 * @route   POST /v1/returns/:id/arrival
 * @desc    Khai báo đã đến điểm hẹn
 */
router.post("/:id/arrival", returnController.notifyArrival);

/**
 * @route   POST /v1/returns/:id/handover/init
 * @desc    Khởi tạo bàn giao và sinh mã PIN 6 số bảo mật
 */
router.post("/:id/handover/init", returnController.initHandover);

/**
 * @route   POST /v1/returns/:id/handover/confirm
 * @desc    Xác nhận bàn giao đồ
 */
router.post(
  "/:id/handover/confirm",
  validate(confirmHandoverSchema),
  returnController.confirmHandover
);

/**
 * @route   POST /v1/returns/:id/handover/dispute
 * @desc    Khai báo tranh chấp / sự cố bàn giao
 */
router.post(
  "/:id/handover/dispute",
  validate(disputeHandoverSchema),
  returnController.disputeHandover
);

/**
 * @route   GET /v1/returns/:id/reward
 * @desc    Lấy trạng thái giải ngân phần thưởng
 */
router.get("/:id/reward", returnController.getRewardStatus);

/**
 * @route   POST /v1/returns/:id/rating
 * @desc    Đánh giá người nhặt đồ (chỉ chủ đồ được gọi)
 */
router.post(
  "/:id/rating",
  validate(submitRatingSchema),
  returnController.submitRating
);

export default router;
