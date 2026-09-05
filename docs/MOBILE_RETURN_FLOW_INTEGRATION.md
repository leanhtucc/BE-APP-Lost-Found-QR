# Hướng Dẫn Tích Hợp & Điều Chỉnh Mobile App (Return Flow)

> **Mục tiêu**: Hướng dẫn đội ngũ phát triển Mobile App (`LostAndFoundQR`) kết nối trực tiếp với Backend module `/v1/returns` đã hoàn thiện, loại bỏ toàn bộ dữ liệu mock nguy hiểm, vá các lỗ hổng P0 về bảo mật/danh tính và kích hoạt Live Tracking thời gian thực.

---

## 1. Tổng quan các thay đổi Backend đã triển khai

Backend hiện đã cung cấp đầy đủ 12 REST API endpoints và Socket room cho luồng hoàn trả:

| Chức năng | Endpoint | Phương thức | Header / Ghi chú |
|---|---|---|---|
| Tạo / Lấy phiên | `/v1/returns` | `POST` | Body: `{ channelId, itemId? }` |
| Chi tiết phiên | `/v1/returns/:id` | `GET` | Tự động trả về role và chi tiết đối tác |
| Đề xuất điểm hẹn | `/v1/returns/:id/meetup/propose` | `POST` | `If-Match: <rev>`, Body: `{ address, latitude, longitude, scheduledTime, notes? }` |
| Chấp nhận điểm hẹn | `/v1/returns/:id/meetup/accept` | `POST` | `If-Match: <rev>`, **Chỉ đối tác được chấp nhận** |
| Từ chối / Hủy hẹn | `/v1/returns/:id/meetup/reject` | `POST` | `If-Match: <rev>` |
| Bắt đầu tracking | `/v1/returns/:id/tracking/start` | `POST` | Kích hoạt phiên live tracking |
| Dừng tracking | `/v1/returns/:id/tracking/stop` | `POST` | Xóa cache vị trí trên Redis |
| Khai báo đã đến | `/v1/returns/:id/arrival` | `POST` | Tự động chuyển `HANDOVER_PENDING` khi cả hai đã đến |
| Khởi tạo bàn giao | `/v1/returns/:id/handover/init` | `POST` | **Sinh mã ngẫu nhiên 6 số** (CSPRNG), TTL 5 phút, max 5 lần thử |
| Xác nhận bàn giao | `/v1/returns/:id/handover/confirm` | `POST` | Body: `{ code?, idempotencyKey }`. Thực hiện giao dịch nguyên tử khi cả hai xác nhận |
| Khiếu nại / Sự cố | `/v1/returns/:id/handover/dispute` | `POST` | Body: `{ reason }`. Dừng ngay lập tức quy trình giải ngân |
| Kiểm tra giải ngân | `/v1/returns/:id/reward` | `GET` | Trả về trạng thái `PROCESSING`, `PAID`, hoặc `ACTION_REQUIRED` |
| Đánh giá Finder | `/v1/returns/:id/rating` | `POST` | **Chỉ Chủ đồ (Owner) được đánh giá**, duy nhất 1 lần |

---

## 2. Ba vấn đề Blocker P0 Mobile bắt buộc phải sửa

### 🚨 Blocker 1: Vô hiệu hóa Fallback Mock trong Production & Xử lý Error Code

#### Hiện trạng nguy hiểm trong [services/returns/api.ts](file:///C:/Users/Microsoft/Documents/LostAndFoundQR/services/returns/api.ts):
Mỗi khi API trả về mã lỗi (`400`, `401`, `403`, `409`, `500`), code hiện tại đều `catch` hoặc bỏ qua `response.ok` và âm thầm gọi `createMockSession()` hoặc cập nhật state giả lập trong RAM:
- Mã bàn giao mặc định bị gán cứng là `852963`.
- Bấm xác nhận thì tiền tự chuyển thành `PAID` với mã giao dịch giả `TXN-...`.
- Đánh giá giả tự chuyển session thành `COMPLETED`.
- Người dùng tưởng đã xong việc nhưng server chưa hề ghi nhận gì!

#### Giải pháp điều chỉnh:
1. **Kiểm tra môi trường**: Chỉ cho phép mock khi `__DEV__` là `true` VÀ có cờ cấu hình `USE_MOCK_RETURNS === true`. Trong production (`!__DEV__`), tuyệt đối ném lỗi để UI hiển thị thông báo lỗi.
2. **Ném lỗi chi tiết từ Server**: Khi `!response.ok`, parse JSON lỗi và ném ra Error chứa `code`:
   ```ts
   interface ApiErrorResponse {
     success: false;
     message?: string;
     error?: { code: string; detail?: string };
   }
   ```
3. **Hiển thị Toast/Alert theo mã lỗi nghiệp vụ của BE**:
   - `INVALID_RETURN_TRANSITION` (409): Không thể thực hiện hành động ở trạng thái hiện tại (ví dụ: chưa chấp nhận hẹn mà đòi bàn giao).
   - `REVISION_CONFLICT` (409): Dữ liệu trên máy đã cũ do bên kia vừa bấm trước. App cần gọi `refreshSession()` để cập nhật lại giao diện.
   - `HANDOVER_CODE_EXPIRED` (400): Mã 6 số đã hết hạn sau 5 phút. Thông báo người dùng bấm "Lấy mã mới".
   - `HANDOVER_CODE_LOCKED` (400): Nhập sai quá 5 lần. Mã bị khóa để chống dò quét.
   - `INVALID_HANDOVER_CODE` (400): Sai mã xác thực.
   - `ONLY_OWNER_CAN_RATE` (403): Finder không được phép tự đánh giá bản thân.
   - `ALREADY_RATED` (409): Phiên này đã được đánh giá rồi.

---

### 🚨 Blocker 2: Loại bỏ Identity & Role khỏi Client Payload

#### Hiện trạng trong Mobile:
- Mobile đang truyền `role` lên `confirmHandover({ role, ... })`.
- Mobile đang truyền `disputedBy` lên `disputeHandover({ disputedBy, ... })`.
- Mobile đang truyền `userId` vào socket payload `return:update-location`.

#### Lý do & Cách sửa:
- **Server không tin client**: BE đã cấu hình bảo mật lấy danh tính từ Bearer Token JWT (`req.user.id`).
- Backend tự so sánh `userId` với `ownerId` và `finderId` trong cơ sở dữ liệu để xác định vai trò.
- **Sửa đổi trong Mobile**:
  - `confirmHandover`: Chỉ gửi `{ code?: string, idempotencyKey: string }`.
  - `disputeHandover`: Chỉ gửi `{ reason: string }`.
  - Socket `return:update-location`: Chỉ gửi `{ sessionId: string, location: LiveLocation }`.

---

### 🚨 Blocker 3: Kích hoạt phát Live Location thực sự lên Socket

#### Hiện trạng:
Trong [hooks/useLiveTracking.ts](file:///C:/Users/Microsoft/Documents/LostAndFoundQR/hooks/useLiveTracking.ts:125), khi `Location.watchPositionAsync` có tọa độ mới, hàm callback chỉ gọi:
```ts
setMyLocation(liveLoc);
```
Nó **chỉ lưu vào Zustand local**, chưa hề gọi Socket để phát tọa độ sang cho bên kia!

Trong khi đó, ở [hooks/useReturnSession.ts](file:///C:/Users/Microsoft/Documents/LostAndFoundQR/hooks/useReturnSession.ts:171), có một `useEffect` cố gắng lắng nghe `myLocation` để emit, nhưng socket instance nằm riêng rẽ trong `useRef` nội bộ của hook, dễ bị lỡ nhịp kết nối hoặc không emit được khi chuyển màn hình.

#### Giải pháp đồng bộ Live Map:
1. Đưa hàm `emitLocation(location: LiveLocation)` vào Store hoặc tạo singleton Socket Manager cho Return Flow.
2. Ngay trong `Location.watchPositionAsync` của `useLiveTracking`: gọi hàm phát vị trí lên socket.
3. Khi đối tác phát tọa độ, listener `return:location-updated` sẽ cập nhật `partnerLocation` trên bản đồ theo thời gian thực (1 update / 2–4s).

---

## 3. Chi tiết mã nguồn cần cập nhật trên Mobile (`LostAndFoundQR`)

### 1. Cập nhật `services/returns/api.ts`

Thay thế cơ chế silent-fallback bằng cơ chế xử lý lỗi chuẩn mực:

```typescript
// Trong services/returns/api.ts

const USE_MOCK_FALLBACK = __DEV__ && false; // Đặt false để ép dùng API Backend thật

const handleResponse = async <T>(response: Response): Promise<T> => {
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorCode = json?.error?.code || 'UNKNOWN_ERROR';
    const message = json?.message || `Yêu cầu thất bại (${response.status})`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = errorCode;
    error.status = response.status;
    throw error;
  }

  return json.data;
};

// Áp dụng cho từng API call:
export const returnApi = {
  async getSession(sessionId: string): Promise<ReturnSession> {
    try {
      const url = buildV1Url('returns', sessionId);
      const response = await fetchWithAuth(url, { method: 'GET' });
      return await handleResponse<ReturnSession>(response);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        console.warn('[ReturnAPI] Dev fallback getSession:', err);
        return inMemorySessions[sessionId] || createMockSession(sessionId);
      }
      throw err;
    }
  },

  async confirmHandover(
    sessionId: string,
    request: ConfirmHandoverRequest,
    revision?: number
  ): Promise<ReturnSession> {
    const headers: Record<string, string> = {};
    if (revision != null) {
      headers['If-Match'] = String(revision);
    }

    const url = buildV1Url('returns', sessionId, 'handover', 'confirm');
    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: request.code,
        idempotencyKey: request.idempotencyKey,
      }), // Bỏ field 'role'
    });

    return await handleResponse<ReturnSession>(response);
  },

  async disputeHandover(
    sessionId: string,
    request: DisputeHandoverRequest
  ): Promise<ReturnSession> {
    const url = buildV1Url('returns', sessionId, 'handover', 'dispute');
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({
        reason: request.reason,
      }), // Bỏ field 'disputedBy'
    });

    return await handleResponse<ReturnSession>(response);
  },

  async initHandover(sessionId: string): Promise<HandoverDetails> {
    const url = buildV1Url('returns', sessionId, 'handover', 'init');
    const response = await fetchWithAuth(url, { method: 'POST' });
    return await handleResponse<HandoverDetails>(response);
  },

  async submitRating(
    sessionId: string,
    request: SubmitRatingRequest
  ): Promise<ReturnSession> {
    const url = buildV1Url('returns', sessionId, 'rating');
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return await handleResponse<ReturnSession>(response);
  },
};
```

---

### 2. Cập nhật `hooks/useLiveTracking.ts` để phát Location lên Socket

Đảm bảo khi GPS có tọa độ mới, mobile gửi ngay sự kiện `return:update-location`:

```typescript
// Trong hooks/useLiveTracking.ts
import { emitReturnLocation } from '@/services/returns/socketManager'; // hoặc qua socket instance

// Bên trong Location.watchPositionAsync callback:
locationSubscriptionRef.current = await Location.watchPositionAsync(
  {
    accuracy: Location.Accuracy.High,
    timeInterval: 3000,
    distanceInterval: 5,
  },
  newLocation => {
    const liveLoc: LiveLocation = {
      latitude: newLocation.coords.latitude,
      longitude: newLocation.coords.longitude,
      accuracy: newLocation.coords.accuracy,
      heading: newLocation.coords.heading,
      speed: newLocation.coords.speed,
      capturedAt: new Date().toISOString(),
    };

    // 1. Cập nhật Zustand local
    setMyLocation(liveLoc);
    setGpsState(
      newLocation.coords.accuracy && newLocation.coords.accuracy > 50 ? 'weak' : 'ready'
    );

    // 2. Phát lên Backend Socket
    if (sessionId) {
      emitReturnLocation(sessionId, liveLoc);
    }
  }
);
```

---

### 3. Cập nhật màn hình Handover: Mã PIN động thay vì `852963`

Trong màn hình [screens/return-flow/handover-confirm/index.tsx](file:///C:/Users/Microsoft/Documents/LostAndFoundQR/screens/return-flow/handover-confirm):

1. Khi màn hình mount, gọi `initHandover(sessionId)`:
   - Server sẽ sinh mã 6 số thực sự và trả về:
     ```json
     {
       "code": "492817",
       "qrPayload": "handover://return_123?code=492817"
     }
     ```
   - Hiển thị đúng mã `492817` và tạo mã QR từ `qrPayload`.
2. Phía người nhận nhập 6 chữ số:
   - Nếu nhập sai: Hiển thị lỗi "Mã xác nhận không chính xác".
   - Nếu quá 5 lần: Hiển thị lỗi "Mã đã bị khóa do nhập sai quá nhiều lần. Vui lòng bấm 'Lấy mã mới'".
   - Có nút "Tạo mã mới" để gọi lại `initHandover` nếu mã quá hạn 5 phút.

---

### 4. Xử lý Trạng thái Giải ngân cho Người nhặt là Guest

Trong màn hình `RewardStatusScreen`:
- Nếu `session.reward.status === 'ACTION_REQUIRED'`:
  - Hiển thị banner màu cam: **"Cần liên kết tài khoản ngân hàng"**.
  - Giải thích: *"Bạn đang sử dụng tài khoản chưa xác minh. Vui lòng liên kết số điện thoại và tài khoản ngân hàng để nhận tiền thưởng."*
  - Cung cấp nút bấm: `[Liên kết tài khoản ngay]`.

---

## 4. Checklist Kiểm thử Chéo (FE & BE)

Sau khi chỉnh sửa xong Mobile, tiến hành kiểm thử theo kịch bản:

- [ ] **Tạo phiên**: Quét QR hoặc mở màn hình chat, kiểm tra xem `POST /v1/returns` có tạo được session thật trong Postgres không.
- [ ] **Đề xuất điểm hẹn**: Finder đề xuất điểm hẹn -> Owner nhận được socket `return:session-updated` và push notification.
- [ ] **Chấp nhận hẹn**: Owner chấp nhận -> Trạng thái đổi thành `MEETUP_ACCEPTED`. Thử để Finder tự accept xem server có trả lỗi 400 không (chống tự accept).
- [ ] **Live Tracking**: Bật màn hình bản đồ trên 2 máy điện thoại (hoặc 1 máy thật + 1 simulator) -> Vị trí của đối tác di chuyển mượt mà trên bản đồ.
- [ ] **Báo đã đến**: Máy 1 bấm "Tôi đã đến" -> Máy 2 thấy đối tác đã đến (`ARRIVAL_PENDING`). Máy 2 bấm "Tôi đã đến" -> Cả hai tự động chuyển sang `HANDOVER_PENDING`.
- [ ] **Bàn giao**:
  - Máy Chủ đồ bấm "Tạo mã bàn giao" -> Nhận mã 6 số ngẫu nhiên (không phải `852963`).
  - Thử nhập sai mã 5 lần -> Kiểm tra thông báo mã bị khóa.
  - Bấm tạo lại mã mới -> Nhập đúng mã trên máy Người nhặt -> Hai bên đồng thời nhảy sang màn hình Giải ngân thưởng (`REWARD_PAID`).
- [ ] **Kiểm tra Item**: Kiểm tra trên Database hoặc ứng dụng xem Item đã đổi sang `RESOLVED` và kênh chat đã bị đóng băng (`frozen: true`) chưa.
- [ ] **Đánh giá**: Chủ đồ gửi đánh giá 5 sao kèm nhận xét -> Phiên chuyển sang `COMPLETED`, trustScore của người nhặt tăng lên. Thử lấy máy người nhặt gọi API đánh giá xem có bị chặn 403 không.

---

*Tài liệu này được biên soạn tương thích hoàn toàn với Backend v1 của dự án Lost & Found QR.*
