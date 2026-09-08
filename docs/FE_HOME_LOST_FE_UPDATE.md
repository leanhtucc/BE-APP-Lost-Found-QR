# FE Integration Update - Home Lost Radar

## 1. Endpoint

```http
GET /api/home/lost-feed?lat=<latitude>&lng=<longitude>&radius=<metres>
GET /v1/home/lost-feed?lat=<latitude>&lng=<longitude>&radius=<metres>
```

Authentication is optional. A valid Bearer token enables `isOwn` and the
current-user summary; guests receive the same public LOST dataset with every
card marked `isOwn=false`.

## 2. Fixed business rule

Home is a lost-item radar, not a global feed:

```text
visible = Item.status == LOST
       && distance(currentLocation, Item.location) <= effectiveRadius
       && effectiveRadius <= 10000 metres
```

`SAFE`, Item `FOUND`, Item `RESOLVED`, standalone `FoundReport` records and
LOST items without a canonical location are never returned.

The owner is not an exclusion condition. An authenticated user's own LOST item
is returned when it is inside the effective radius.

## 3. Query contract

| Parameter | Required | Validation | Behavior |
|---|---:|---|---|
| `lat` | Yes | finite, `-90..90` | Missing/invalid returns HTTP 400 |
| `lng` | Yes | finite, `-180..180` | Missing/invalid returns HTTP 400 |
| `radius` | No | positive finite number | Defaults to 10000; values above 10000 are capped to 10000 |

Calling the endpoint without GPS never returns a country-wide feed.

## 4. Response contract

The existing wrapper is preserved:

```json
{
  "success": true,
  "data": {
    "user": null,
    "lostFeed": {
      "cards": [],
      "pins": [],
      "myLostCount": 0,
      "nearbyCount": 0
    }
  }
}
```

- `cards` and `pins` are generated from the same PostGIS rows and have matching
  item IDs and order.
- `distanceMeters` is a raw integer; `distanceLabel` is kept for backwards
  compatibility.
- `myLostCount` is the authenticated user's total number of LOST Items across
  the system, independent of the current radius.
- `nearbyCount` is the number of returned LOST cards owned by other users. For
  a guest it equals `cards.length`.
- Results are sorted by exact distance ascending, then lost-location timestamp
  descending.

## 5. Realtime

Listen for:

- `radar:new-lost-item`: add a card/pin only for a server-matched subscription.
- `radar:lost-item-removed`: remove the card and pin with the supplied `itemId`.

Radar subscriptions are capped server-side at 10000 metres.

## 6. Error example

```json
{
  "success": false,
  "message": "Request data is invalid",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "lat": "lat is required"
    }
  }
}
```
