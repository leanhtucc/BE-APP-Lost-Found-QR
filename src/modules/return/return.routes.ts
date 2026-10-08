import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guestOrUserAuth } from "../../middlewares/guest-auth.middleware";
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

/**
 * @route   POST /v1/returns
 * @desc    Tạo hoặc lấy phiên hoàn trả theo channelId
 */
router.post(
  "/",
  authMiddleware,
  validate(createOrGetSessionSchema),
  returnController.createOrGetSession
);

/**
 * @route   GET /v1/returns/:id
 * @desc    Lấy chi tiết phiên hoàn trả
 */
router.get("/:id", guestOrUserAuth, returnController.getSession);

/** Owner cancels an active guest claim. */
router.post(
  "/:id/claim/reject",
  authMiddleware,
  returnController.rejectGuestClaim
);

/**
 * @route   POST /v1/returns/:id/meetup/propose
 * @desc    Đề xuất điểm hẹn
 */
router.post(
  "/:id/meetup/propose",
  guestOrUserAuth,
  validate(proposeMeetupSchema),
  returnController.proposeMeetup
);

/**
 * @route   POST /v1/returns/:id/meetup/accept
 * @desc    Chấp nhận điểm hẹn
 */
router.post(
  "/:id/meetup/accept",
  guestOrUserAuth,
  returnController.acceptMeetup
);

/**
 * @route   POST /v1/returns/:id/meetup/reject
 * @desc    Từ chối hoặc hủy điểm hẹn
 */
router.post(
  "/:id/meetup/reject",
  guestOrUserAuth,
  returnController.rejectMeetup
);

/**
 * @route   POST /v1/returns/:id/tracking/start
 * @desc    Bắt đầu live tracking
 */
router.post(
  "/:id/tracking/start",
  guestOrUserAuth,
  returnController.startTracking
);

/**
 * @route   POST /v1/returns/:id/tracking/stop
 * @desc    Dừng live tracking
 */
router.post(
  "/:id/tracking/stop",
  guestOrUserAuth,
  returnController.stopTracking
);

/**
 * @route   POST /v1/returns/:id/arrival
 * @desc    Khai báo đã đến điểm hẹn
 */
router.post("/:id/arrival", guestOrUserAuth, returnController.notifyArrival);

router.post("/:id/cancel", guestOrUserAuth, returnController.cancelReturn);

/**
 * @route   POST /v1/returns/:id/handover/init
 * @desc    Khởi tạo bàn giao và sinh mã PIN 6 số bảo mật
 */
router.post(
  "/:id/handover/init",
  guestOrUserAuth,
  returnController.initHandover
);

/**
 * @route   POST /v1/returns/:id/handover/confirm
 * @desc    Xác nhận bàn giao đồ
 */
router.post(
  "/:id/handover/confirm",
  authMiddleware,
  validate(confirmHandoverSchema),
  returnController.confirmHandover
);

/**
 * @route   POST /v1/returns/:id/handover/dispute
 * @desc    Khai báo tranh chấp / sự cố bàn giao
 */
router.post(
  "/:id/handover/dispute",
  authMiddleware,
  validate(disputeHandoverSchema),
  returnController.disputeHandover
);

/**
 * @route   GET /v1/returns/:id/reward
 * @desc    Lấy trạng thái giải ngân phần thưởng
 */
router.get("/:id/reward", guestOrUserAuth, returnController.getRewardStatus);

/**
 * @route   POST /v1/returns/:id/rating
 * @desc    Đánh giá người nhặt đồ (chỉ chủ đồ được gọi)
 */
router.post(
  "/:id/rating",
  authMiddleware,
  validate(submitRatingSchema),
  returnController.submitRating
);

export default router;
