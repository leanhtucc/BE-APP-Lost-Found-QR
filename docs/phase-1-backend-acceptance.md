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

Runtime acceptance ngày 2026-09-26 được chạy hoàn toàn trên database local; production Supabase không bị migrate, seed hoặc mutate.

- **Database requirement:** PostgreSQL + PostGIS. Migration đầu tiên chạy `CREATE EXTENSION IF NOT EXISTS postgis` và tạo `geography(Point,4326)`, do đó plain PostgreSQL không đủ.
- **Local runtime:** PostgreSQL 14.24 + PostGIS 3.2 trong Ubuntu WSL, bind `localhost:5433`, database `lostfound_dev`. Acceptance WSL dùng local admin role `postgres` cho migration/runtime; credential chỉ nằm trong `.env.development.local` đã được Git ignore.
- **Docker workflow:** thêm `docker-compose.dev.yml` dùng `postgis/postgis:16-3.4`, named volume và healthcheck; không thay `docker-compose.yml` production. Máy acceptance không có Docker CLI/service nên runtime thực tế dùng WSL.
- **Environment:** `.env.development.local` (Git ignored), `NODE_ENV=development`, `DOTENV_CONFIG_PATH=.env.development.local`; `.env` production không bị overwrite.
- **Backend:** boot thành công tại `http://localhost:3001`; `/health/live` trả HTTP 200; Prisma connect thành công; Firebase/SMTP được tắt khi không có local credential.

### Migration chain

Fresh local database không có schema/extension dựng sẵn đã apply sạch đủ 8 migration hiện có; migration đầu tự tạo PostGIS. `prisma migrate status` sau deploy trả `Database schema is up to date`, bao gồm ba migration chưa được apply trên production:

- `20260909220000_item_capture_location`
- `20260925000000_phase4_found_claim_return_source`
- `20260926000000_backend_owned_fcm_notifications`

Không tạo migration mới và không apply migration nào lên production.

### Seed 0

`npm run seed:phase1:empty` PASS. Script chỉ xóa item của hai fixture user; không reset database. HTTP thật xác minh:

- Login fixture: 200.
- My Items: 200, `total=0`, `items=[]`.
- Home lost feed với location hợp lệ: 200, `cards=[]`, `pins=[]`.
- My Items không token: 401.
- Item Detail không tồn tại: 404.
- Home có `lat` không hợp lệ: 400.

### Seed 20 và HTTP runtime

`npm run seed:phase1` PASS. Owner fixture có đúng 20 item; một item thuộc fixture owner khác chỉ dùng để xác minh ownership.

| Gate            | Kết quả | Evidence                                                                                                      |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Local DB        | PASS    | PostgreSQL/PostGIS reachable tại `localhost:5433/lostfound_dev`.                                              |
| Migration chain | PASS    | 8/8 migration applied; schema up to date.                                                                     |
| Seed 0          | PASS    | My Items/Home empty qua HTTP thật.                                                                            |
| Seed 20         | PASS    | Owner có đúng 20 item, đủ `SAFE/LOST/FOUND/RESOLVED`.                                                         |
| Home            | PASS    | 5 LOST cards; guest và authenticated request đều 200; authenticated cards có `isOwn=true`; có image nullable. |
| My Items        | PASS    | `total=20`, nullable images=7, mixed categories/statuses.                                                     |
| Item Detail     | PASS    | Owner đọc được item ở cả 4 status; missing trả 404; item owner khác trả 403.                                  |
| Pagination      | PASS    | Page 1=10, page 2=10, 20 ID unique, không duplicate; page/limit sai trả 400.                                  |
| Errors          | PASS    | HTTP thật: 400/401/403/404; 500 được kiểm tra an toàn ở middleware test.                                      |

## Validation Results

Chạy lại trong working tree hiện tại (2026-09-26), không dùng kết quả cũ:

- **Build/typecheck:** `npm run typecheck` PASS; `npm run build` PASS.
- **Prisma:** `prisma generate` PASS; `prisma validate` PASS; `prisma migrate status` PASS trên local DB.
- **Related tests:** `vitest run src/modules/item src/modules/home` PASS — 7 files, 47 tests.
- **Full suite:** PASS — 23 files PASS, 1 skipped; 161 tests PASS, 11 skipped. Middleware error contract chạy riêng cũng PASS — 2/2 tests.
- **git diff --check:** PASS.
- Repo không có script lint. `format:check` toàn repo vẫn có các cảnh báo baseline đã ghi ở mục H; các file mới/sửa được kiểm tra riêng bằng Prettier.

## Remaining scope

- Production vẫn còn ba migration pending theo audit trước; không xử lý trong Phase 1 và không được suy ra từ local PASS rằng production đã up to date.
- Docker workflow đã được cấu hình nhưng chưa chạy trên máy này vì Docker CLI/service không được cài; WSL PostgreSQL/PostGIS là runtime local đã được xác minh.
- Các hạng mục Phase 2+ ở mục I vẫn deferred.

## Kết luận

```
BACKEND CODE ACCEPTANCE: PASS
LOCAL DATABASE ACCEPTANCE: PASS
RUNTIME API ACCEPTANCE: PASS
BACKEND PHASE 1: PASS
```

Phase 1 đạt pass gate trên PostgreSQL/PostGIS local đã xác minh: migration chain sạch, backend boot, seed 0/20, Home/My Items/Item Detail/pagination/error contracts qua HTTP thật và toàn bộ validation tự động đều PASS. Không commit, push hoặc mutate production.
