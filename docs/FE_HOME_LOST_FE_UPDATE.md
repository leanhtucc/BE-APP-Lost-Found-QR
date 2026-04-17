# FE Integration Update - Home Lost Feed

Tài liệu này mô tả chính xác hành vi backend hiện tại cho API Home Lost Feed để FE cập nhật và tránh lỗi parse/validation.

## 1) Endpoint và mục tiêu

- Endpoint: `GET /api/home/lost-feed`
- Auth: bắt buộc `Bearer token`
- Mục tiêu update:
  - Giảm lỗi `Validation failed` khi query gửi giá trị null-like.
  - Hỗ trợ dữ liệu legacy (tọa độ cũ).
  - Lọc khoảng cách theo radius thực tế khi có vị trí.

## 2) Query contract mới (đã normalize)

Backend hiện chấp nhận các kiểu giá trị cho `lat`, `lng`, `radius`:

- `number`
- `string`
- `null`
- `undefined`

Các giá trị sau được coi như không truyền (bị normalize thành `undefined`):

- `null`
- `undefined`
- chuỗi rỗng `""`
- chuỗi `"null"`
- chuỗi `"undefined"`
- chuỗi `"nan"`

Ràng buộc:

- `lat`: trong khoảng [-90, 90]
- `lng`: trong khoảng [-180, 180]
- `radius`: >= 1
- Nếu giá trị không parse được số hợp lệ -> backend trả `400 Validation failed`

## 3) Hành vi dữ liệu theo có/không có location

### Trường hợp FE không gửi location (hoặc bị normalize thành undefined)

- Backend vẫn trả:
  - danh sách đồ mất của chính user (`isOwn = true`)
  - và đồ của user khác (`isOwn = false`) theo `updatedAt` mới nhất
- `distanceMeters` và `distanceLabel` có thể là `null`

### Trường hợp FE gửi đủ location (`lat` + `lng`)

- Backend tính khoảng cách Haversine.
- Chỉ giữ item khác chủ có `distanceMeters <= radius`.
- Nếu trong bán kính không có item nào, backend fallback sang danh sách LOST gần nhất (ngoài radius) để tránh màn hình rỗng.
- Mặc định radius hiệu lực trong repository là `5000` khi radius không hợp lệ.
- Nearby cards được sort theo khoảng cách tăng dần.

## 4) Status filter đã tương thích legacy

Backend lọc trạng thái bằng `UPPER(status) = 'LOST'`.

Điều này cho phép dữ liệu cũ dùng `lost/safe` (chữ thường) vẫn được đọc đúng.

## 5) Fallback tọa độ legacy (thứ tự ưu tiên)

Khi build card/pin, backend lấy tọa độ theo thứ tự:

1. `lostLat/lostLng`
2. `latitude/longitude`
3. parse JSON từ `lastSeenLocation` (shape: `{ lat, lng }`)

Nếu không lấy được tọa độ hợp lệ -> item không tạo pin map.

## 6) Response shape FE cần bám

Payload thực tế:

- `data.user`: thông tin user hiện tại.
- `data.lostFeed.cards`: danh sách card.
- `data.lostFeed.pins`: danh sách pin map.
- `data.lostFeed.myLostCount`
- `data.lostFeed.nearbyCount`

Các trường nullable trong card FE cần xử lý an toàn:

- `imagePublicUrl: string | null`
- `lostMessage: string | null`
- `distanceMeters: number | null`
- `distanceLabel: string | null`
- `lostLat: number | null`
- `lostLng: number | null`
- `address: string | null`
- `ownerPhotoURL: string | null`

## 7) Checklist FE để hết lỗi

1. Trước khi gọi API, chỉ gửi `lat/lng/radius` khi là số hữu hạn.
2. Không gửi chuỗi "undefined" hoặc "null" thủ công.
3. Nếu chưa có GPS, gọi endpoint không kèm `lat/lng`.
4. UI card/map phải chịu được tất cả trường nullable.
5. Không tự suy luận tọa độ từ field cũ ở FE nữa; dùng trực tiếp `cards` + `pins` backend trả về.
6. Badge hoặc count dùng `myLostCount` và `nearbyCount` từ backend.

## 8) Ví dụ request FE khuyến nghị

### Có vị trí

`GET /api/home/lost-feed?lat=10.7769&lng=106.7009&radius=5000`

### Không có vị trí

`GET /api/home/lost-feed`

## 9) Lưu ý thực tế

Controller hiện đang default `radius = 50000` khi thiếu query radius, nhưng repository có lớp bảo vệ radius hiệu lực riêng. FE nên luôn truyền `radius` rõ ràng theo nhu cầu UX để tránh khác biệt kỳ vọng.

Khi backend đang trả fallback ngoài radius, FE có thể hiển thị thêm badge như `Ngoài phạm vi` bằng cách so sánh `distanceMeters > selectedRadius` (nếu UX cần).

---

Nếu FE cần, BE có thể cung cấp thêm 1 endpoint debug tạm thời để trả lý do item bị loại (out-of-radius/no-coordinate) nhằm tăng tốc QA.
