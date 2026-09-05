# Đặc tả Tích hợp: Public Lost Feed & Luồng Bảo vệ Món đồ (Mobile & Backend)

Tài liệu này hướng dẫn chi tiết về luồng hoạt động, API endpoints, và cách thức hiển thị cho ứng dụng Mobile (LostAndFoundQR) sau khi hoàn tất nâng cấp:
1. **Dữ liệu Đồ Đã Mất trên Trang chủ (Public Home Lost Feed)**: Hiển thị công khai mà không bắt buộc đăng nhập (Guest Mode). Mỗi món đồ hiển thị đầy đủ thông tin chủ sở hữu riêng.
2. **Kho Đồ Của Tôi (My Items)**: Chỉ hiển thị khi người dùng đã đăng nhập.
3. **Luồng Đăng ký Bảo vệ Món đồ Riêng (Item Registration & Protection Flow)**: Người dùng đăng ký món đồ với tọa độ đã biết, mặc định ở trạng thái SAFE (An toàn).
4. **Luồng Chuyển Trạng thái Báo mất (SAFE -> LOST)**: Đẩy món đồ lên Radar công khai, phát thông báo thời gian thực tới những người xung quanh.

---

## 1. Dữ liệu Đồ Đã Mất trên Trang chủ (Public Home Feed)

### 1.1. Hành vi Khách (Chưa đăng nhập / Guest Mode)
- Khi mở ứng dụng lần đầu mà chưa đăng nhập, trang chủ lập tức tải và hiển thị danh sách đồ thất lạc công khai xung quanh kèm ghim vị trí (Map Pins) mà **không báo lỗi 401** và **không điều hướng sang màn hình Login**.
- Toàn bộ các món đồ hiển thị đều có:
  - isOwn = false (vì là khách).
  - Thông tin chủ sở hữu riêng: ownerDisplayName, ownerPhotoURL.
  - myLostCount = 0, 
earbyCount = [tổng số đồ mất xung quanh].

### 1.2. Hành vi Đã đăng nhập (Authenticated Mode)
- Khi người dùng đã đăng nhập, Mobile đính kèm header Authorization: Bearer <accessToken>.
- Backend tự động nhận diện danh tính:
  - Đồ của chính người dùng được gắn cờ isOwn = true và đưa lên đầu danh sách.
  - myLostCount = [số đồ thất lạc của người dùng].
  - Đồ của người khác có isOwn = false kèm thông tin chủ sở hữu của từng món đồ.

### 1.3. Endpoint API
- **Endpoint**: GET /v1/home/lost-feed hoặc GET /api/home/lost-feed
- **Authentication**: Optional (Hỗ trợ cả Guest và Authenticated).
- **Query Parameters**:
  - lat *(number, tùy chọn)*: Vĩ độ hiện tại của người dùng ([-90, 90]).
  - lng *(number, tùy chọn)*: Kinh độ hiện tại của người dùng ([-180, 180]).
  - adius *(number, tùy chọn, mặc định 5000m)*: Bán kính quét Radar.

#### Request Example (Guest):
`http
GET /v1/home/lost-feed?lat=21.028511&lng=105.854444&radius=5000 HTTP/1.1
Host: api.findback.vn
`

#### Request Example (User đã đăng nhập):
`http
GET /v1/home/lost-feed?lat=21.028511&lng=105.854444&radius=5000 HTTP/1.1
Host: api.findback.vn
Authorization: Bearer eyJhbGciOi...
`

#### Response Example:
`json
{
  "success": true,
  "message": "Lost feed fetched successfully",
  "data": {
    "myLostCount": 1,
    "nearbyCount": 4,
    "cards": [
      {
        "itemId": "cm0a1b2c3d4e",
        "name": "Ví da Montblanc",
        "category": "wallet",
        "imagePublicUrl": "https://supabase.co/.../wallet.jpg",
        "lostMessage": "Rơi tại khu vực sảnh tòa Landmark 81, có giấy tờ quan trọng",
        "distanceMeters": 350,
        "distanceLabel": "350m",
        "lostLat": 10.7951,
        "lostLng": 106.7218,
        "address": "Landmark 81, Bình Thạnh, TP.HCM",
        "isOwn": false,
        "ownerDisplayName": "Nguyễn Văn A",
        "ownerPhotoURL": "https://avatar.url/a.jpg",
        "reportedAt": "2026-09-05T12:30:00.000Z"
      }
    ],
    "pins": [
      {
        "itemId": "cm0a1b2c3d4e",
        "lat": 10.7951,
        "lng": 106.7218,
        "isOwn": false
      }
    ],
    "user": {
      "id": "usr_998877"
    }
  }
}
`

---

## 2. Luồng Đăng ký & Bảo vệ Món đồ Riêng (Item Protection Flow)

Mỗi người dùng có một kho đồ cá nhân (My Items). Khi đăng ký một món đồ để bảo vệ:
1. Món đồ được lưu với thông tin mô tả, danh mục, và **tọa độ đã biết** (vị trí nhà riêng, văn phòng, nơi cất giữ).
2. Trạng thái khởi tạo mặc định luôn là **SAFE (An toàn)**.
3. Hệ thống tính toán sẵn mã địa lý locationGeoHash độ phân giải 6 ký tự để phục vụ tìm kiếm nhanh khi cần.

### 2.1. API Tạo Món đồ Bảo vệ
- **Endpoint**: POST /api/items hoặc POST /v1/items
- **Authentication**: Bắt buộc (Bearer token).
- **Content-Type**: pplication/json

#### Request Body:
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
|---|---|---|---|
| 
ame | string (1 - 100 ký tự) | **Có** | Tên món đồ (VD: "Laptop ThinkPad X1") |
| category | string | **Có** | Danh mục: electronics, wallet, keys, phone, ag, documents, jewelry, other |
| description | string | Không | Đặc điểm nhận dạng (màu sắc, vết xước,...) |
| latitude | 
umber | Không | Vĩ độ nơi cất giữ an toàn ([-90, 90]) |
| longitude | 
umber | Không | Kinh độ nơi cất giữ an toàn ([-180, 180]) |
| ddress | string | Không | Địa chỉ / Nơi cất giữ |
| imagePublicUrl | string | Không | URL hình ảnh món đồ |

#### Request Example:
`json
POST /api/items HTTP/1.1
Host: api.findback.vn
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "name": "Chùm chìa khóa căn hộ",
  "category": "keys",
  "description": "Móc khóa hình phi hành gia màu xanh, có 3 chìa và thẻ từ",
  "latitude": 21.028511,
  "longitude": 105.854444,
  "address": "Nhà riêng - 123 Cầu Giấy, Hà Nội"
}
`

#### Response Example:
`json
{
  "success": true,
  "message": "Item created successfully",
  "data": {
    "id": "cm0xyz987654",
    "ownerId": "usr_998877",
    "name": "Chùm chìa khóa căn hộ",
    "category": "keys",
    "description": "Móc khóa hình phi hành gia màu xanh, có 3 chìa và thẻ từ",
    "status": "SAFE",
    "latitude": 21.028511,
    "longitude": 105.854444,
    "lastSeenLocation": "Nhà riêng - 123 Cầu Giấy, Hà Nội",
    "qrCodeId": "ab12cd34ef56",
    "createdAt": "2026-09-05T14:00:00.000Z",
    "updatedAt": "2026-09-05T14:00:00.000Z"
  }
}
`

---

## 3. Luồng Báo Mất & Đẩy Thông Báo Radar (SAFE -> LOST)

Khi món đồ bị thất lạc:
1. Người dùng bấm "Báo mất" trên chi tiết món đồ hoặc màn hình Báo mất.
2. Trạng thái chuyển từ SAFE sang LOST.
3. Nếu người dùng không nhập tọa độ mới lúc báo mất, backend tự động lấy tọa độ đã đăng ký lúc tạo đồ (latitude, longitude).
4. **Broadcast thời gian thực qua WebSocket Radar**:
   - Backend phát sự kiện lost_item_radar qua Socket.io tới phòng adar:zone:{geohash}.
   - Tất cả người dùng trong khu vực nhận được thông báo về món đồ vừa mất.
5. Món đồ lập tức xuất hiện trên **Trang chủ (Home Feed)** của cả người dùng khách và cộng đồng xung quanh.

### 3.1. API Cập nhật trạng thái Báo mất
- **Endpoint**: PATCH /api/items/:id/status hoặc PATCH /v1/items/:id/status
- **Authentication**: Bắt buộc (Bearer token).
- **Content-Type**: pplication/json

#### Request Body:
`json
{
  "status": "LOST",
  "lostMessage": "Đánh rơi vào khoảng 15:30 gần cổng ga Cát Linh, ai thấy xin liên hệ!",
  "lostAddress": "Ga Cát Linh, Đống Đa, Hà Nội",
  "latitude": 21.0298,
  "longitude": 105.8273
}
`

---

## 4. Bảng tổng hợp các thay đổi trên Mobile App (LostAndFoundQR)

| File | Thay đổi chính |
|---|---|
| services/radar/api.ts | Triển khai etchWithOptionalAuth. Cho phép getHomeLostFeed gọi API không cần token khi là khách (không văng lỗi session expired), nhưng vẫn đính kèm token nếu đã đăng nhập. |
| 	ypes/item.ts | Mở rộng CreateItemParams và UpdateItemParams với latitude, longitude, ddress. |
| services/items/api.ts | Sửa createItem và updateItem để gửi payload qua JSON Body chuẩn xác thay vì qua Query Parameters. |
| contexts/ItemsContext.tsx | Thêm phương thức ddItem(params: CreateItemParams) vào Context để thêm món đồ mới và cập nhật thống kê ngay lập tức. |
| screens/myItems/components/AddItemModal.tsx | Tạo mới Modal Đăng ký Bảo vệ Món đồ với: Tên, Danh mục, Đặc điểm, Tọa độ GPS (nút Lấy vị trí hiện tại qua expo-location), Địa chỉ an toàn, và nhãn giải thích trạng thái mặc định SAFE. |
| screens/myItems/index.tsx | Tích hợp AddItemModal, thay thế Alert tạm thời bằng quy trình đăng ký thực tế. |
| screens/item-detail/index.tsx | Cho phép chuyển trạng thái SAFE <-> LOST. Khi báo mất, backend tự động lấy tọa độ đã đăng ký nếu không có tọa độ mới. |
