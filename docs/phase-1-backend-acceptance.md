# Phase 1 Backend Acceptance

## A. Endpoints thực tế

Backend là Express 5 + TypeScript + Prisma/PostgreSQL, theo luồng Route → Middleware → Controller → Service → Repository. Các item route được mount dưới cả `/api` (giá trị mặc định của `API_PREFIX`) và `/v1`.

| Màn hình    | Method/path                                         | Auth            | Hành vi thực tế                                                                                                                                                                                           |
| ----------- | --------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home        | `GET /api/home/lost-feed` hoặc `/v1/home/lost-feed` | Optional        | Bắt buộc `lat`, `lng`; `radius` mặc định và tối đa 10.000 m; `category` optional; chỉ trả Item `LOST` có PostGIS location, gần nhất trước; snapshot tối đa theo `HOME_LOST_FEED_LIMIT`; không pagination. |
| My Items    | `GET /api/items` hoặc `/v1/items`                   | Bearer bắt buộc | Chỉ lấy `ownerId` từ access token; filter `status`, `category`; pagination `page`/`limit` (1–100); sort `createdAt desc`; empty là HTTP 200 với `items: []`.                                              |
| Item Detail | `GET /api/items/:id` hoặc `/v1/items/:id`           | Bearer bắt buộc | Resolve theo `id`, `itemId` hoặc `qrCodeId`; owner-only; 404 nếu không tồn tại và 403 nếu thuộc user khác. Item hiện được hard-delete nên item đã xóa trả 404.                                            |

Home response giữ wrapper hiện tại:

```json
{
  "success": true,
  "data": {
    "user": null,
    "lostFeed": {
      "pins": [],
      "cards": [],
      "myLostCount": 0,
      "nearbyCount": 0
    }
  }
}
```

Không có item, item không có location, hoặc item nằm ngoài radius đều tạo feed rỗng; không trả 404. Item không có ảnh vẫn có card với `imagePublicUrl: null`. Item `LOST` thiếu canonical PostGIS location không được đưa vào feed.

## B. Item Status Contract

Enum thật trong Prisma là `ItemStatus = SAFE | LOST | FOUND | RESOLVED`.

| Status     | Ý nghĩa                                      | Transition thực tế                                                                     | Khuyến nghị mobile                                       |
| ---------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `SAFE`     | Item đang được chủ sở hữu giữ an toàn        | Owner: `SAFE → LOST`, cần tọa độ                                                       | “An toàn”, cho phép bật Lost Mode.                       |
| `LOST`     | Đang thất lạc và có thể xuất hiện trên Radar | Owner: `LOST → SAFE`; finder claim: `LOST → FOUND`                                     | “Báo mất”, cho phép cập nhật lost message/tắt Lost Mode. |
| `FOUND`    | Finder đã claim, đang trong quy trình trả đồ | Return flow: `FOUND → RESOLVED`; repository hiện cũng chấp nhận owner request `→ SAFE` | Backend-managed; mobile không nên hiện toggle thủ công.  |
| `RESOLVED` | Quy trình trả đồ hoàn tất                    | Repository hiện chấp nhận owner request `→ SAFE`                                       | “Đã hoàn trả”; mobile không nên hiện toggle thủ công.    |

`PENDING_PAYMENT`, `ACTIVE`, `PAYMENT_FAILED`, `CANCELLED`, `EXPIRED`, `COMPLETED` là `GuardianReportStatus`, không phải Item status. `PENDING/PAID/FAILED/...` là Payment status. Mobile không được tính `PENDING_PAYMENT` là Item `LOST`.

Việc repository cho phép `FOUND/RESOLVED → SAFE` rộng hơn UI hiện tại là technical debt của state machine và không được thay đổi trong Phase 1.

## C. Identifier Contract

| Field          | Vai trò                                   | Public/stable         | Cách dùng                                                                              |
| -------------- | ----------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `id`           | Prisma primary key nội bộ của `Item`      | Stable nhưng internal | Owner API và relation DB; dùng navigation nội bộ được nhưng không hiển thị trên UI/QR. |
| `itemId`       | Unique public item identifier             | Public, stable        | Home card/pin, public detail navigation; response alias `publicItemId`.                |
| `publicItemId` | Alias response của `itemId`               | Public, stable        | Presentation/navigation khi cần mã public.                                             |
| `qrCodeId`     | Unique identifier được QR scanner resolve | Public cho QR, stable | Payload QR và `/scan/:itemId`; không thay architecture trong Phase 1.                  |
| `reportId`     | Primary key của Guardian `Post`/report    | Không phải Item ID    | Payment/report/return flow; không đưa vào QR item.                                     |

`findByIdentifier` chấp nhận cả ba item identifier để tương thích, nhưng mobile không nên hiển thị raw `id`.

## D. Response Contract

Home card có `itemId`, `name`, `category`, `imagePublicUrl|null`, `lostMessage|null`, `distanceMeters`, `distanceLabel`, `lostLat/lostLng`, `address|null`, `isOwn`, owner display fields và `reportedAt`. Pin có `itemId`, tọa độ và `isOwn`.

My Items trả `{ items, total, page, limit, totalPages }`. Mỗi item có `id`, `itemId/publicItemId`, `qrCodeId`, owner ID, name, category, description, `ItemStatus`, ảnh nullable, lost/capture location, lost message và timestamps.

Item Detail dùng cùng `ItemResponse`, vì vậy không cần endpoint mới. `imagePublicUrl`, description, lost fields và capture fields đều nullable/optional.

Response thành công dùng `{ status, success, message, data, timestamp }`. Validation và error handler Phase 1 đã được đồng bộ thêm top-level numeric `status`; payload/các field cũ vẫn giữ nguyên.

## E. Test Data

Script development-only:

```bash
npm run seed:phase1
```

Tạo user:

- Email: `phase1.owner@example.test`
- Password: `Phase1Test!234`
- 20 item trộn đều `SAFE/LOST/FOUND/RESOLVED`
- Có ảnh/null image, title/description/location/lost message dài và category thật.

Reset user về kịch bản 0 item:

```bash
npm run seed:phase1 -- --empty
```

Script từ chối chạy khi `NODE_ENV=production` và chỉ xóa item của user fixture, không reset toàn database. Việc chạy seed lên database cụ thể chưa được thực hiện tự động trong audit này.

## F. Error Cases

| Case | Cách tái hiện                                                             | Expected                                                                             |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 401  | Gọi My Items/Item Detail không có Bearer token hoặc token hết hạn         | HTTP 401, `success:false`.                                                           |
| 403  | User A gọi detail bằng identifier của item User B                         | HTTP 403, code `ITEM_FORBIDDEN`.                                                     |
| 404  | Gọi detail bằng identifier không tồn tại/đã bị xóa                        | HTTP 404, code `ITEM_NOT_FOUND`.                                                     |
| 500  | Trong test environment mock repository/Prisma throw lỗi không-operational | HTTP 500, code `INTERNAL_ERROR`; không tạo production endpoint để phát sinh lỗi giả. |

Home tọa độ/radius/category sai trả validation error 400. Radius lớn hợp lệ được cap server-side ở 10 km.

## G. Code Changes

- `src/modules/item/item.controller.ts`: dùng query đã được validation/transform thay vì đọc lại raw Express query.
- `src/modules/item/item.schema.ts`: normalize status và giới hạn pagination hợp lệ.
- `src/modules/item/item.schema.test.ts`: test normalization và invalid pagination.
- `src/middlewares/error.middleware.ts`: thống nhất top-level HTTP `status` cho coded/500 errors.
- `prisma/seed-phase1.ts`, `package.json`: fixture Phase 1 development-only, gồm 0/20 item scenarios.
- File này: contract và acceptance evidence.

## H. Test Results

- `npm run typecheck`: PASS.
- `npm run build`: PASS (Prisma Client generated, TypeScript build và copy templates hoàn tất).
- `npx prisma validate`: PASS.
- Vitest Home/Item: PASS — 7 files, 47 tests.
- `git diff --check`: PASS. `npm run format:check` vẫn báo 19 file baseline ngoài các file Phase 1 đã sửa; không auto-format lan sang module ngoài scope.
- Backend device/database endpoint runtime: UNVERIFIED; audit không khởi động server hoặc mutate database fixture.

## I. Issues deferred

- QR resolver/QR architecture.
- Guest finder flow.
- Auth token refresh architecture.
- Real chat.
- Return flow/state-machine cleanup.
- Payment.
- Radar lifecycle/socket architecture.
- Security hardening.
- Làm chặt transition `FOUND/RESOLVED → SAFE` cần phase state-machine riêng.

## J. Runtime Database Acceptance

Audit runtime lần này KHÔNG chạy được vì môi trường chỉ có database production, không có dev/test DB đã xác minh.

- **Database:** PostgreSQL trên Supabase pooler (`aws-0-ap-south-1.pooler.supabase.com`, db `postgres`, schema `public`). Credentials không log.
- **Environment:** `NODE_ENV=production` trong `.env` — KHÔNG phải development/test DB. `.env.docker` trỏ `db:5432/backend_db` nhưng `docker-compose.yml` không định nghĩa service `db` (chỉ có service `backend` đọc `.env` production), nên không có local dev/test DB dùng ngay được.
- **Prisma connectivity:** `npx prisma migrate status` kết nối được (read-only). Tuy nhiên 3 migration CHƯA áp: `20260909220000_item_capture_location`, `20260925000000_phase4_found_claim_return_source`, `20260926000000_backend_owned_fcm_notifications` → schema DB đang lệch so với `prisma/schema.prisma`.
- **Backend startup:** KHÔNG khởi động. Boot với config hiện tại sẽ chạy vào production DB, ngoài scope và không an toàn.
- **Seed 0 items:** KHÔNG chạy. `seed-phase1.ts` tự chặn khi `NODE_ENV=production` (`assertDevelopmentEnvironment`), và prompt cấm seed/mutate production.
- **Seed 20 items:** KHÔNG chạy (cùng lý do).
- **Home / My Items / Item Detail / 401 / 403 / 404 / Pagination runtime:** UNVERIFIED — không có dev DB để chạy acceptance thực; các case này chỉ được phủ ở tầng unit/integration test mock Prisma (mục H), chưa qua HTTP + DB thật.

Không thực hiện hành động destructive nào (không `migrate deploy`, không `migrate reset`, không seed) theo đúng safety rule của prompt (STOP destructive actions khi DB không xác minh được là dev/test).

## Validation Results

Chạy lại trong working tree hiện tại (2026-09-26), không dùng kết quả cũ:

- **Build/typecheck:** `npm run typecheck` (`tsc --noEmit`) PASS — re-run lần này. `npm run build` PASS theo audit trước (mục H); không re-run trong lần này vì typecheck đã bao phủ TypeScript và không có thay đổi build config mới.
- **Prisma:** `npx prisma validate` PASS — re-run lần này.
- **Tests:** `npx vitest run src/modules/item src/modules/home` PASS — 7 files, 47 tests, re-run lần này.
- **git diff --check:** PASS theo audit trước; không có thay đổi whitespace mới trong lần này.

## Unverified

- Runtime database/API acceptance toàn bộ (startup, seed 0/20, Home, My Items, Item Detail, pagination, error 401/403/404/500 qua HTTP + PostGIS thật) — không có dev/test DB.
- Trạng thái schema thực tế sau khi áp 3 migration đang pending.
- `npm run build` trong lần chạy này (chỉ typecheck được re-run).

## Kết luận

```
BACKEND CODE ACCEPTANCE: PASS
DATABASE ACCEPTANCE: UNVERIFIED
BACKEND PHASE 1: PARTIAL
```

Code contract, validation, fixture và automated tests (typecheck + prisma validate + 47 Home/Item test) đạt và đã được re-run trong tree hiện tại. Runtime database/API acceptance không thể chạy an toàn vì môi trường chỉ có production DB (`NODE_ENV=production`) và không có dev/test DB đã xác minh; do đó không ghi PASS tuyệt đối.
