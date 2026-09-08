# Public Lost Feed & Item Protection Contract

## 1. Home Lost Radar

Home remains available to guests and authenticated users through:

```http
GET /api/home/lost-feed?lat=21.028511&lng=105.854444&radius=10000
GET /v1/home/lost-feed?lat=21.028511&lng=105.854444&radius=10000
```

`lat` and `lng` are required. `radius` is optional, defaults to 10000 metres,
and is capped server-side at 10000 metres.

Only Item rows satisfying both conditions are returned:

1. `status = LOST`.
2. The PostGIS lost location is within the effective radius.

Owner identity does not filter the dataset. An authenticated user's own nearby
LOST Item is returned with `isOwn=true`; own SAFE Items are never returned.
Standalone FoundReport records and Item statuses SAFE, FOUND and RESOLVED are
not part of this endpoint.

The response keeps the existing shape:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user-id",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "lostFeed": {
      "cards": [],
      "pins": [],
      "myLostCount": 1,
      "nearbyCount": 0
    }
  }
}
```

Cards and pins correspond one-to-one and are sorted nearest-first. The raw
distance is returned as `distanceMeters`.

## 2. Register a protected Item

```http
POST /api/items
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "Chùm chìa khóa căn hộ",
  "category": "keys",
  "description": "Móc khóa phi hành gia màu xanh",
  "latitude": 21.028511,
  "longitude": 105.854444,
  "address": "123 Cầu Giấy, Hà Nội"
}
```

The Item is always created as SAFE. Its stored coordinates may be used as a
fallback when the owner reports it lost, but a SAFE Item is not public on Home.

## 3. Report lost or return to safe

```http
PATCH /api/items/:id/status
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "status": "LOST",
  "lostMessage": "Đánh rơi gần ga Cát Linh",
  "lostAddress": "Ga Cát Linh, Hà Nội",
  "latitude": 21.0298,
  "longitude": 105.8273
}
```

Only the owner can call this transition. The server writes status, scalar
coordinates, geohash and the PostGIS point atomically, then emits
`radar:new-lost-item` to matching subscribers.

To cancel the lost state:

```json
{ "status": "SAFE" }
```

The Item and any open Guardian payment/escrow state are updated in one
transaction. Nearby clients receive `radar:lost-item-removed` after commit.
