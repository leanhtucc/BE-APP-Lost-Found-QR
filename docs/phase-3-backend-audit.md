# Phase 3 Backend Audit

**Audited:** 2026-10-05  
**Status:** AUDIT COMPLETE — implementation can safely begin with caveats documented below.

---

## A. Current Architecture

### Stack
- **Runtime:** Node.js / Express 5 + TypeScript
- **ORM:** Prisma 7.x → PostgreSQL 16 + PostGIS 3.4
- **Auth:** Local JWT (access + refresh), Supabase token path in middleware
- **Chat:** Stream Chat (server-side SDK)
- **Real-time:** Socket.IO (radar + return session events)
- **Cache:** Redis (return live-location keys, handover PIN cache)
- **Validation:** Zod schemas on all routes

### Layer pattern
```
Route → [authMiddleware | optionalAuth] → validate(schema) → Controller → Service → Repository → Prisma
```

### Route mounts
| Prefix | Module |
|---|---|
| `GET /api/scan/:qrCodeId` | QR resolver (public, no auth) |
| `POST /api/scan/guest-init` | Guest chat init (public, no auth) |
| `GET /api/items/public/:id` / `GET /api/items/:id/public` | Public item (no auth) |
| `GET/POST /api/items/*` | Owner item CRUD (auth required) |
| `POST /api/found-reports/` | Create Found Report (auth required) |
| `POST /api/found-reports/:id/claims` | Create claim (auth required) |
| `POST /api/found-reports/:id/claims/:claimId/accept` | Accept claim → creates ReturnSession + Stream channel |
| `GET /api/stream/token` | Get Stream token (auth required) |
| `POST /api/stream/channels/:itemId/:finderId` | Create return channel (auth required) |
| `POST /api/returns` | Create/get ReturnSession (auth required) |
| `POST /api/returns/:id/handover/init` | Generate PIN (auth, finder-only) |
| `POST /api/returns/:id/handover/confirm` | Verify PIN / confirm (auth) |
| `POST /api/returns/:id/rating` | Submit rating (auth, owner-only) |

---

## B. Existing QR Flow

### Identifier Schema
| Field | Generation | Format | Stability |
|---|---|---|---|
| `Item.qrCodeId` | `nanoid(16)` at create time | 16-char URL-safe | Stable across all status transitions; replaced with tombstone only on account deletion |
| `Item.itemId` | Prisma `@default(cuid())` | CUID | Stable |
| `Item.id` | Prisma `@id @default(cuid())` | CUID | Stable (internal PK) |
| `Item.securityToken` | `nanoid(32)` at create time | 32-char URL-safe | Never exposed via public API |

### QR Resolver: `GET /api/scan/:qrCodeId`
- **Auth:** None required — public endpoint. ✅
- **Lookup:** `ItemRepository.findByQrCodeId(qrCodeId)` — Prisma `findUnique` on the indexed `qrCodeId` unique field.
- **Scan logging:** `QrScan` record created on every scan. ✅
- **Item not found:** 404 `AppError`. ✅
- **Malformed/short IDs:** Zod `min(1)` only — no format enforcement beyond non-empty string. ⚠️ P2
- **Status dispatch:**
  - `SAFE` → returns `action: "info_only"` with message "This item is not reported as lost"
  - `FOUND` → returns `action: "info_only"` with message "The owner is already in contact with a finder"
  - `RESOLVED` → returns `action: "info_only"` with message "This lost-item case has already been resolved"
  - `LOST` → returns `action: "open_chat"` with bounty info if Guardian Post exists

### What QR exposes (SAFE/audit)
Response fields for all statuses: `item_info.id` (= `qrCodeId`), `name`, `category`, `status`, `description`, `image_url`, `owner_info` (anonymized).  
**Does NOT expose:** database `id`, JWT, email, phone, `securityToken`, `securityPin`, private coordinates, `ownerId`. ✅  
**Owner anonymization:** `display_name` = `"Chủ nhân ẩn danh #XXXX"` (4-char prefix of `memberId`/`uid`), `avatar` = `""`, `joined_date` = year only. ✅  
**Stable on status change:** `qrCodeId` is never changed during `SAFE→LOST→FOUND→RESOLVED`. ✅

### QR Generation
- `qrCodeId` generated at item creation (`nanoid(16)`).
- **`qrCodeUrl` field exists in schema but is not set at creation** — it's `String?` and always `null` in practice. The QR URL is expected to be assembled by the mobile client using the `qrCodeId`. This is a P1 gap if the backend is supposed to generate/store the QR image URL.

---

## C. Existing Finder Flow

### Two parallel finder flows exist (important)

#### Flow A — Authenticated Finder via Stream channel creation
- `POST /api/stream/channels/:itemId/:finderId` (auth required)
- Finder must be logged in. Validates `finderId === req.user.id` (prevents impersonation). ✅
- Calls `createLostItemReturnChannel` which:
  1. Resolves item by `id | itemId | qrCodeId`
  2. Verifies item `status === LOST` (concurrent claim protection via `updateMany` + count check)
  3. Creates `ReturnSession` with `channelId = return_<sessionId>`
  4. Upserts both users on Stream
  5. Creates Stream `messaging` channel with owner and finder as members

#### Flow B — Guest Finder via `POST /api/scan/guest-init`
- **Auth:** None — public endpoint. Requires `itemId` (the `qrCodeId`) + `phoneNumber`.
- Guest user lookup/create: finds user by `phoneNumber`, or creates new user with `role: "guest"`, synthetic `uid = guest_XXXXXXXXXX`, synthetic email `guest_XXXXXXXXXX@guest.findback.app`.
- Creates Stream user token and item channel.
- Atomically transitions item `LOST → FOUND` via `updateMany` count check.
- **P0 Gap:** No QR scan recorded in this flow (Flow A goes through `stream.service.ts`, not through `scanQRCode`).
- **P0 Gap:** Guest user creation has no rate-limit beyond the global 100 req/15min. A single phone number can be reused or fabricated; there is no OTP, CAPTCHA, or phone verification step.
- **P0 Gap:** The `phoneNumber` is stored on the guest `User` record. If a valid registered user happens to share the same phone number (normalization not enforced), `findFirst({ where: { phoneNumber } })` returns that real user — potentially giving them a guest Stream token linked to their account, and transitioning the item to `FOUND` on their behalf without their consent.

### QR resolver (public item) requires no auth
- `GET /api/items/public/:id` and `GET /api/items/:id/public` — no auth. ✅
- Returns `PublicItemResponse` — owner info is anonymized. ✅

### Guest session lifecycle
- Guest users are persistent `User` rows with `role: "guest"`.
- No expiration, no cleanup mechanism exists.
- Stream token is issued without expiry control (`createStreamUserToken` uses `client.createToken(userId)` with no TTL claim — defaults to Stream SDK default).
- **P1:** No mechanism to expire or delete guest sessions after the item is returned.

### Rate limiting on public scan endpoints
- Global rate limit: 100 req / 15 min / IP.
- No per-QR code or per-phone-number rate limiting on `guest-init`.
- **P1:** Insufficient for abuse protection on these public endpoints.

---

## D. Existing Found Report Flow

> **Note:** `FoundReport` is the "finder-posts-a-found-item" model (finder advertising a lost-and-found item). This is distinct from the QR scan "Found Report" concept. The schema and service are consistent with this model.

### Create Found Report — `POST /api/found-reports/`
- **Auth:** Required (`authMiddleware`). ✅ Finder must have an account.
- **Schema:** `idempotencyKey` (UUID), `name`, `category`, `description?`, `imagePublicUrl` (URL-validated), `location.{lat, lng, address}` — all required except description.
- **Idempotency:** Prisma `upsert` on `[finderId, idempotencyKey]` unique index — retrying with same key is safe and returns same record. ✅
- **Duplicate protection:** Same finder + same idempotency key → same record. Different finder → new record. No enforcement against near-duplicate geographic reports from same finder with different key.

### Create Claim — `POST /api/found-reports/:id/claims`
- **Auth:** Required. ✅
- **Self-claim prevention:** `finderId === claimantId` check throws 409. ✅
- **Duplicate claim:** Unique index `[foundReportId, claimantId]` + application-level check + P2002 catch. ✅
- **Report availability:** Checks `resolvedAt == null`. ✅
- **Item state transition:** None directly here — transition happens when claim is accepted.
- **Notification:** Finder is notified of new claim via `notificationService`. ✅

### Accept Claim — `POST /api/found-reports/:id/claims/:claimId/accept`
- **Auth:** Required. Verified that caller is the finder (`foundReport.finderId === finderId`). ✅
- **Cross-user authorization:** Enforced — finder can only accept claims on their own reports. ✅
- **Only-one-accepted:** Checks `otherAccepted` before accepting. ✅
- **Atomic transaction:** Creates `ReturnSession`, rejects all other PENDING claims, updates claim status — all in one `$transaction`. ✅
- **ReturnSession creation:** `ownerId = claim.claimantId` (the person claiming ownership), `finderId = finderId` (the person who posted the found report). This is the correct semantic. ✅
- **Stream channel created:** After transaction completes, `createReturnChannel` is called with `sourceType: "FOUND_REPORT"`.
- **Item status:** NOT transitioned on claim accept — `FoundReport` has no link to a specific `Item`. The `FoundReport` is an independent entity.
- **P1 Gap:** When a `FoundReport` claim is accepted, the linked `Item` (if identifiable) is NOT transitioned to `FOUND`. This breaks the flow where a lost item is found via a FoundReport rather than a QR scan.
- **P1 Gap:** `FoundReport` has no `itemId` foreign key. There is no way for the backend to know which `Item` a `FoundReport` is about without the claimant telling it explicitly.

### Reject Claim — `POST /api/found-reports/:id/claims/:claimId/reject`
- **Auth + authorization:** Finder-only check. ✅
- **Status check:** Only rejects `PENDING` claims. ✅
- **Notification:** Claimant is notified. ✅

---

## E. Existing Chat Flow

### Stream Chat Integration
- Backend uses Stream Chat server SDK for all channel operations.
- Client (mobile) uses a user token issued by the backend.

### Token issuance
- `GET /api/stream/token` — auth required. ✅
- Returns `{ token, apiKey, userId }`. Token is a long-lived JWT signed by Stream secret. **No expiry is set on the token** — it defaults to Stream's server-side default (no expiry unless configured in the Stream dashboard). **P1:** Token should have a bounded TTL (e.g., 1 hour) to limit blast radius of token leakage.

### Channel creation flows
| Path | Auth | Creator role enforced? | Members explicit? |
|---|---|---|---|
| `POST /api/stream/channels/:itemId/:finderId` | Auth required, `finderId === req.user.id` | ✅ | ✅ Owner + finder |
| `POST /api/scan/guest-init` | None | N/A (guest) | ✅ Owner + guest |
| `acceptFoundReportClaim` (internal) | Auth (via claim endpoint) | ✅ | ✅ Claimant + finder |

### Channel ID semantics
| Flow | Channel ID format |
|---|---|
| QR scan → guest chat (Flow B) | `item_{qrCodeId}_{guestUserId}` |
| Authenticated finder channel (Flow A) | `return_{sessionId}` (generated `ret_XXXXXXXXXXXXXXXXXX`) |
| Found Report claim channel | `return_{sessionId}` (generated `ret_XXXXXXXXXXXXXXXXXX`) |

- **Channel ID collisions:** The `item_` prefix uses `qrCodeId`, not `itemId`. Since `qrCodeId` is unique per item, and the finder's user ID is appended, this is safe for single-finder scenarios. However, if the same finder scans the same LOST item twice (without the item being claimed first), a second guest user would be created and a new channel would be created.

### Who can access channels
- Stream enforces membership at the SDK level — only channel members can read/write.
- Backend adds members explicitly when creating channels. ✅
- **P1 Gap:** `GET /api/stream/channels` calls `getUserChannels(userId)` which queries Stream for all channels where user is a member. This is correct. However, `closeChannel`, `muteUser`, `banUser` etc. do NOT verify that the caller is a participant or owner of that specific channel — they operate directly on `channelId` from the request params.
  - A logged-in user can `PUT /api/stream/channels/:channelId/close` for any channelId they supply.
  - Backend does call `reportService.completeEscrowFromChannel(userId, channelId)` first which has authorization, but the `closeItemChannel(channelId)` afterward is unconditional.

### Mobile authorization model
- Stream tokens are issued server-side — mobile cannot self-issue. ✅
- Channel membership is set server-side at creation time — mobile cannot add arbitrary participants. ✅
- **P0 Gap:** The `confirmHandoverSchema` accepts a `role` field from the client body (`z.enum(["OWNER", "FINDER"]).optional()`). However, in `confirmHandover`, the role is derived from `assertParticipant(session, userId)` (DB-side), and the client-supplied `role` is never used. The field is harmless but confusing — should be removed. ✅ Role derivation is server-side.

---

## F. Existing Return Flow

### Creation
`POST /api/returns` (auth required)  
Input: `{ channelId, itemId? }`

The service attempts to find an existing session by `channelId`. If none exists, it parses the `channelId` looking for the `item_` prefix convention to extract `itemId` and `finderId`. This is fragile:

- If `channelId = "return_ret_XXXXXXXXXXXXXXXXXX"` (the format used in Flow A/FoundReport), parsing fails gracefully — the session was pre-created by `createLostItemReturnChannel` and will be found on the first lookup. ✅
- If `channelId = "item_{qrCodeId}_{guestUserId}"` (guest Flow B), and no session exists yet, the service attempts to extract `itemId` from the channel name. This will match `qrCodeId` not `Item.id`, but `createOrGetSession` resolves by `OR [{ id: itemId }, { itemId }]` — `qrCodeId` would NOT match. **P1 Gap:** Guest flow (Flow B) creates a Stream channel but does NOT create a `ReturnSession`. If the mobile client tries to call `POST /api/returns` with `channelId = "item_{qrCodeId}_{guestId}"`, the system will fail to create a session because the `qrCodeId` format (`item_<16char>_<userId>`) doesn't contain a resolvable `itemId`.

### Participant authorization
- All return endpoints use `authMiddleware`. ✅
- `assertParticipant(session, userId)` throws 403 if caller is not `ownerId` or `finderId`. ✅
- Session is fetched fresh from DB on each request — not trusting client-side claims. ✅

### State machine
Defined in `VALID_TRANSITIONS` map. Key transitions:
```
CHAT_ACTIVE → MEETUP_PROPOSED → MEETUP_ACCEPTED → TRACKING_ACTIVE → ARRIVAL_PENDING → HANDOVER_PENDING → HANDOVER_CONFIRMED → REWARD_RELEASING → REWARD_PAID → RATING_PENDING → COMPLETED
```
With dispute/cancel branches. State transitions are enforced server-side via `assertValidTransition` and `assertReturnAction`. ✅

### Concurrency protection
- `serverRevision` field + optional `If-Match` header on every mutation. ✅
- `FOR UPDATE` row lock in handover confirmation transaction. ✅

### Location sharing
- Live location stored in Redis: `return:loc:{sessionId}:{userId}`. ✅
- Tracking expiry: 4 hours from `startTracking`. ✅
- Cleared on completion/dispute/cancel. ✅

### Cancellation
- Blocked if `handoverConfirmations.length > 0`. ✅
- Can cancel from `MEETUP_ACCEPTED | TRACKING_ACTIVE | ARRIVAL_PENDING | HANDOVER_PENDING`. ✅

### Completion semantics
Both parties must confirm handover via `confirmHandover`. The backend:
1. Verifies PIN hash (OWNER role) or accepts direct confirmation (FINDER role).
2. On both confirmed: transitions item `FOUND → RESOLVED` (for ITEM source), or marks `FoundReport.resolvedAt` (for FOUND_REPORT source).
3. Closes Stream channel.
4. Updates finder trust score.
5. Transitions session to `RATING_PENDING` (for FOUND_REPORT or when payout is `PAID`), or `HANDOVER_CONFIRMED` (guest finder pending bank link).
6. `COMPLETED` on rating submission.
Backend is the sole authority for `RESOLVED` status. ✅

---

## G. Existing Verification Flow

### PIN/Handover Challenge
- **Generation:** Finder calls `POST /api/returns/:id/handover/init`.
- **Role enforcement:** Only `FINDER` can generate PIN (verified against DB-derived role). ✅
- **PIN generation:** `crypto.randomInt(100000, 1000000)` — cryptographically random 6-digit integer. ✅
- **Storage:** Only `codeHash = SHA256(code:salt)` stored in DB. Raw code is NOT persisted in DB. ✅
- **Redis cache:** Raw code stored in Redis `return:code:{sessionId}` for 300 seconds (for "retrieve code" display to finder). ✅
- **Expiration:** `expiresAt = now + 300s` (5 minutes). Checked before verification. ✅
- **Attempt limit:** `maxAttempts = 5`, `attemptCount` incremented on bad code, checked before verification. ✅
- **Replay prevention:** `consumedAt` set after successful verification. Any second OWNER confirm with a `code` will find `consumedAt != null` and reject. ✅
- **Salt:** `CODE_SALT = "lost_found_handover_salt_2026"` — hardcoded constant. **P1:** Should be from environment variable or rotatable secret.
- **PIN regeneration:** Finder can call `/handover/init` again; `upsert` resets `attemptCount`, `consumedAt`, and generates new code. This is appropriate but could be spammed. **P2:** Rate-limit PIN generation per session.
- **FINDER confirmation:** Finder submits `confirmHandover` without a `code` (role = FINDER, direct confirmation, no code). This is correct — finder already generated the code and gave it to the owner. ✅

### Backend as RESOLVED authority
When both confirmations are recorded, `confirmHandover` atomically:
```
item.status: FOUND → RESOLVED    (updateMany where status=FOUND, count asserted = 1)
post.status: FOUND → COMPLETED   (if reportId exists)
returnSession.status → RATING_PENDING / HANDOVER_CONFIRMED
```
Backend enforces the `FOUND → RESOLVED` transition — mobile cannot bypass. ✅

---

## H. State Machine

### Item Status

```
         ┌─────────────────────────────────────────────────┐
         ▼                                                   │
      [SAFE] ──owner SAFE→LOST──► [LOST] ──QR scan / Stream claim──► [FOUND]
         ▲                           │                              │
         │                           │                              │
    owner SAFE←LOST            (no direct LOST→SAFE                │
    markSafe()                   transition from owner             │
    ALSO accepts:                 unless item returned)             │
    FOUND→SAFE ⚠️                                                   │
    RESOLVED→SAFE ⚠️                                         confirmHandover (both parties)
                                                                     │
                                                                     ▼
                                                                [RESOLVED]
```

**Valid owner-initiated transitions (enforced by `markSafe`):**
- `LOST → SAFE` ✅
- `FOUND → SAFE` ⚠️ **P1 gap** — `markSafe` accepts `FOUND` as source status. This allows an owner to bypass the full return flow and manually mark an in-progress return as SAFE.
- `RESOLVED → SAFE` ⚠️ **P1 gap** — same issue; owner can reset a resolved item to SAFE.

**Valid system-initiated transitions:**
- `SAFE → LOST` (owner, with coordinates required)
- `LOST → FOUND` (QR guest-init or Stream channel creation, atomic updateMany)
- `FOUND → RESOLVED` (both-party confirmed handover, server-side only)

**Forbidden (enforced):**
- Owner cannot directly set `FOUND` or `RESOLVED` via `PATCH /api/items/:id/status` — schema only accepts `SAFE | LOST`. ✅

### ReturnSession Status Machine

```
CHAT_ACTIVE
  ├─► MEETUP_PROPOSED
  │     ├─► MEETUP_ACCEPTED
  │     │     ├─► TRACKING_ACTIVE
  │     │     │     ├─► ARRIVAL_PENDING
  │     │     │     │     ├─► HANDOVER_PENDING
  │     │     │     │     │     ├─► HANDOVER_CONFIRMED ─► REWARD_RELEASING ─► REWARD_PAID ─► RATING_PENDING ─► COMPLETED
  │     │     │     │     │     └─► MEETUP_CANCELLED ─► (CHAT_ACTIVE or MEETUP_PROPOSED)
  │     │     │     │     └─► TRACKING_EXPIRED ─► MEETUP_PROPOSED
  │     │     │     └─► MEETUP_CANCELLED
  │     │     └─► MEETUP_CANCELLED
  │     └─► MEETUP_CANCELLED ─► (CHAT_ACTIVE or MEETUP_PROPOSED)
  └─► HANDOVER_DISPUTED ─► REFUND_PENDING ─► COMPLETED
```
All transitions enforced by `VALID_TRANSITIONS` map + `assertReturnAction` policy. ✅

---

## I. Authorization Matrix

| Action | Owner A | Owner B | Finder A (participant) | Finder B (non-participant) | Guest | Unauthenticated |
|---|---|---|---|---|---|---|
| `GET /api/scan/:qrCodeId` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/items/public/:id` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/items/:id` (own item) | ✅ | ❌ 403 | ❌ 401 | ❌ 401 | ❌ 401 | ❌ 401 |
| `PATCH /api/items/:id/status` (own item) | ✅ | ❌ 403 | ❌ 401 | ❌ 401 | ❌ 401 | ❌ 401 |
| `POST /api/found-reports/` | ✅ | ✅ | ✅ | ✅ | ❌ 401 | ❌ 401 |
| `POST /api/found-reports/:id/claims/:cId/accept` | ✅ (if finder) | ❌ 403 | ✅ (if finder) | ❌ 403 | ❌ 401 | ❌ 401 |
| `GET /api/returns/:id` (participant) | ✅ | ❌ 403 | ✅ | ❌ 403 | ❌ 401 | ❌ 401 |
| `POST /api/returns/:id/handover/init` | ❌ 403 (owner can't) | ❌ 403 | ✅ (finder only) | ❌ 403 | ❌ 401 | ❌ 401 |
| `POST /api/returns/:id/handover/confirm` (owner, with PIN) | ✅ | ❌ 403 | ✅ (direct, no PIN) | ❌ 403 | ❌ 401 | ❌ 401 |
| `POST /api/returns/:id/rating` | ✅ (owner only) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 | ❌ 401 |
| `PUT /api/stream/channels/:channelId/close` | ✅ ⚠️ any channelId | ✅ ⚠️ any channelId | ✅ ⚠️ any channelId | ✅ ⚠️ any channelId | ❌ 401 | ❌ 401 |

---

## J. Security Gaps

### P0 — Blocks core flow

1. **[P0-SEC-1] `guest-init` phone number collision with real user:**  
   `findFirst({ where: { phoneNumber } })` returns any user with that phone. A malicious actor can supply a phone number belonging to a registered user to impersonate them as the "guest finder," obtaining a Stream token for their account and claiming the item on their behalf.  
   **Fix:** Separate guest identity from real users (e.g., only match `role: "guest"` users for phone lookup, or require OTP verification before guest creation).

2. **[P0-SEC-2] `closeChannel` has no participant authorization:**  
   `PUT /api/stream/channels/:channelId/close` runs `reportService.completeEscrowFromChannel(userId, channelId)` (which has authorization) but then calls `closeItemChannel(channelId)` unconditionally. If the escrow check passes for a different reason, or if the channel has no escrow, any authenticated user can freeze any channel they know the ID of.  
   **Fix:** Verify caller is a member of the channel (via `ReturnSession.channelId` lookup) before closing.

3. **[P0-FLOW-1] Guest Flow B creates no `ReturnSession`:**  
   `POST /api/scan/guest-init` creates a Stream channel but no `ReturnSession`. The return flow (`/api/returns`) cannot bootstrap from a guest channel because the `channelId` format `item_{qrCodeId}_{guestUserId}` is not parseable by `createOrGetSession` (it resolves item by `id | itemId` not `qrCodeId` from the channel name). The full return flow (handover, PIN, RESOLVED) is broken for guest finders.  
   **Fix:** Create `ReturnSession` in `initGuestChat` after item is claimed, or teach `createOrGetSession` to handle the `item_` channel prefix by resolving via `qrCodeId`.

### P1 — Important

4. **[P1-SEC-3] Stream token has no TTL:**  
   `createStreamUserToken(userId)` calls `client.createToken(userId)` without an `exp` claim. Tokens are effectively indefinite.  
   **Fix:** Pass `exp` = `Math.floor(Date.now() / 1000) + 3600` (1 hour).

5. **[P1-SM-1] `markSafe` accepts `FOUND` and `RESOLVED` as source:**  
   Owner can call `PATCH /api/items/:id/status` with `{ status: "SAFE" }` on an item that is `FOUND` or `RESOLVED`, bypassing the return flow. The repository accepts `{ in: ["LOST", "FOUND", "RESOLVED"] }` as valid source states.  
   **Fix:** Restrict `markSafe` source to `LOST` only, OR add an additional guard in the service layer to reject `FOUND/RESOLVED → SAFE` via the owner status endpoint.

6. **[P1-FLOW-2] `FoundReport` has no `itemId` link:**  
   When a finder posts a `FoundReport` and an owner claims it, there is no way to transition a specific `Item` to `FOUND`. The `ReturnSession` has `foundReportId` but no `itemId` for found-report-sourced sessions. The handover completion correctly marks `FoundReport.resolvedAt` but cannot mark any `Item` as `RESOLVED`.  
   **Fix:** Add optional `itemId` to `FoundReport` schema and claim flow, OR accept that found-report flow is item-agnostic (valid design choice — must be documented).

7. **[P1-FLOW-3] No per-endpoint rate limiting on public scan/guest-init:**  
   Global 100 req/15min/IP is insufficient. A bot can exhaust an item's claim window or spam guest user creation.  
   **Fix:** Add stricter rate limits per IP on `/api/scan/*` (e.g., 20 req/15min).

8. **[P1-VERIFY-1] Hardcoded `CODE_SALT`:**  
   `const CODE_SALT = "lost_found_handover_salt_2026"` is committed in source. If source is leaked, attacker can precompute codes offline.  
   **Fix:** Move to `ENV.HANDOVER_CODE_SALT` (environment variable, rotatable).

9. **[P1-CHAT-1] `mute`/`ban`/`unflag` moderation endpoints have no ownership check:**  
   `POST /api/stream/channels/:channelId/mute/:targetUserId` etc. require auth but do not verify the caller is a participant of the channel being moderated. Any authenticated user can mute/ban any user in any channel by ID.  
   **Fix:** Verify caller participates in the channel via `ReturnSession.channelId` or Stream membership query.

10. **[P1-QR-1] `qrCodeUrl` is always null:**  
    The `qrCodeUrl` column exists in schema but is never populated. Mobile presumably generates the QR URL itself from `qrCodeId`. If there's an expectation the backend stores it, this must be addressed.

### P2 — Polish/Future

11. **[P2-SEC-4] `scanQRSchema` does not enforce `qrCodeId` format:**  
    Only `z.string().min(1)` — accepts any string. Should enforce the nanoid(16) format or at least a max length.

12. **[P2-SEC-5] QR scan `recordQrScan` records scan even for disabled/safe items:**  
    Currently all scans are recorded regardless of item status. Not a security issue but adds noise.

13. **[P2-GUEST-1] Guest user rows never cleaned up:**  
    Guest users persist indefinitely. Should be scheduled for deletion after a configurable TTL post-resolution.

14. **[P2-SM-2] `HANDOVER_DISPUTED` has no manual resolution path:**  
    Dispute is logged but requires manual admin intervention. No admin API exists yet.

15. **[P2-PIN-1] PIN regeneration is not rate-limited:**  
    Finder can call `/handover/init` unlimited times, generating new PINs and invalidating previous ones. Low priority but should be rate-limited per session.

16. **[P2-STREAM-1] `logActivity` endpoint is a no-op:**  
    `logActivity` in `stream.service.ts` returns a static object without doing anything in Stream. Dead code.

---

## K. Missing Implementation

| ID | Description | Priority |
|---|---|---|
| K1 | `ReturnSession` creation in `guest-init` path | P0 |
| K2 | `createOrGetSession` must handle `item_{qrCodeId}_{userId}` channel format | P0 |
| K3 | Guest phone number collision guard (real user vs. guest user lookup) | P0 |
| K4 | Channel participant check before `closeChannel` | P0 |
| K5 | Stream token TTL / expiry | P1 |
| K6 | Restrict `markSafe` to LOST source only | P1 |
| K7 | Per-endpoint rate limiting on `/api/scan/*` and `guest-init` | P1 |
| K8 | `HANDOVER_CODE_SALT` from environment variable | P1 |
| K9 | Channel membership enforcement on moderation endpoints | P1 |
| K10 | `QrScan` recording in guest-init flow | P2 |
| K11 | Guest user TTL cleanup job | P2 |
| K12 | `qrCodeUrl` generation/storage (if expected) | P2 |

---

## L. Required API Contract Changes

### Non-breaking additions (safe to add)

1. **Return service `createOrGetSession`:** Accept `qrCodeId`-format channel IDs (`item_{qrCodeId}_{finderId}`) by adding `qrCodeId` to the item resolution query.
2. **`guest-init` response:** Add `returnSessionId` to the response payload (after K1 is implemented).
3. **`confirmHandover` schema:** Remove the unused `role` field from `confirmHandoverSchema` — it's confusing and unused.

### Breaking changes (coordination required)

None required for P0 fixes. P1 fixes (Stream token TTL) will require mobile to implement token refresh handling.

---

## M. Recommended Implementation Order

```
Phase 3 Sprint 1 — P0 fixes (core flow)
  1. [K3] Fix guest phone lookup collision guard
  2. [K1] Create ReturnSession in guest-init path
  3. [K2] Teach createOrGetSession to parse item_{qrCodeId}_{userId} channels
  4. [K4] Add channel participant check in closeChannel

Phase 3 Sprint 2 — P1 security
  5. [K5] Add TTL to Stream token generation
  6. [K6] Restrict markSafe to LOST source only
  7. [K8] Externalize HANDOVER_CODE_SALT to env
  8. [K9] Add channel membership check to moderation endpoints
  9. [K7] Add stricter rate limits on /api/scan/* endpoints

Phase 3 Sprint 3 — Integration tests
  10. Write auth boundary tests (see Section N)
  11. Write end-to-end flow tests (QR → RESOLVED)

Phase 3 Sprint 4 — P2 polish
  12. [K10] QR scan recording in guest-init
  13. [K11] Guest user cleanup job
  14. [P2-PIN-1] Rate-limit handover/init per session
```

---

## N. Tests Required

### Authorization boundary tests (must be added before implementation begins)

| Test | Scenario | Expected |
|---|---|---|
| T-AUTH-1 | Owner B reads Owner A's item via GET /api/items/:id | 403 ITEM_FORBIDDEN |
| T-AUTH-2 | Owner B updates Owner A's item status | 403 ITEM_FORBIDDEN |
| T-AUTH-3 | Non-participant reads ReturnSession | 403 FORBIDDEN |
| T-AUTH-4 | Non-participant calls /handover/init | 403 FORBIDDEN |
| T-AUTH-5 | Non-participant calls /handover/confirm | 403 FORBIDDEN |
| T-AUTH-6 | Owner calls /handover/init (finder-only) | 403 FORBIDDEN |
| T-AUTH-7 | Finder calls /rating (owner-only) | 403 FORBIDDEN |
| T-AUTH-8 | User closes a channel they don't participate in | 403 (after K4 fix) |

### Core flow tests

| Test | Scenario |
|---|---|
| T-FLOW-1 | Full QR → guest-init → FOUND → ReturnSession exists |
| T-FLOW-2 | Full authenticated QR scan → Stream channel → ReturnSession |
| T-FLOW-3 | LOST → guest claim (concurrent: two guests race, only one wins) |
| T-FLOW-4 | FoundReport → claim → accept → ReturnSession created |
| T-FLOW-5 | Full handover: init PIN → owner verifies → RESOLVED |
| T-FLOW-6 | Bad PIN → increment attempt → locked at 5 |
| T-FLOW-7 | Expired PIN → 400 HANDOVER_CODE_EXPIRED |
| T-FLOW-8 | Owner markSafe on FOUND item blocked (after K6) |
| T-FLOW-9 | Duplicate guest-init (item already FOUND) → 409 |
| T-FLOW-10 | Rating → COMPLETED |

### State machine tests

| Test | Scenario |
|---|---|
| T-SM-1 | SAFE → LOST (with coordinates) ✅ |
| T-SM-2 | LOST → SAFE (cancel lost) ✅ |
| T-SM-3 | LOST → FOUND (item claim) ✅ |
| T-SM-4 | FOUND → RESOLVED (handover) ✅ |
| T-SM-5 | FOUND → SAFE blocked after K6 |
| T-SM-6 | RESOLVED → SAFE blocked after K6 |
| T-SM-7 | SAFE → LOST missing coordinates → 400 |

---

## O. Explicitly Deferred Work

The following items are NOT in Phase 3 scope and must NOT be implemented:

| Item | Reason for deferral |
|---|---|
| Payment / VNPay / Momo integration | Phase 4+ scope |
| Guardian Post bounty flow | Phase 4+ scope |
| Radar socket architecture changes | Separate phase |
| One-time refresh token rotation | Requires persisted token family; Phase 2 explicitly deferred |
| Admin dispute resolution API | Phase 4+ scope |
| User trust score algorithm redesign | Not blocking core flow |
| `qrCodeUrl` generation/storage | Only if mobile confirms it expects the backend to store this |
| i18n / localization of error messages | Phase 4+ scope |
| Soft-delete for items | Phase 1 explicitly uses hard-delete |
| Production migration deployment | Operator responsibility, not Phase 3 code task |
| `FoundReport` → `Item` linkage redesign | Requires schema migration; evaluate in Phase 4 |

---

## Summary Assessment

| Layer | Status | P0 Issues |
|---|---|---|
| QR identifier schema | ✅ Sound | None |
| QR resolver (auth-free scan) | ✅ Working | None |
| Public item DTO | ✅ Privacy-safe | None |
| Item state machine | ⚠️ Partial | FOUND/RESOLVED → SAFE leak (P1) |
| Guest/Finder flow | ❌ Broken | ReturnSession not created (P0-FLOW-1) |
| Found Report / Claim | ✅ Working | No Item link (P1-FLOW-2) |
| Chat authorization | ⚠️ Partial | closeChannel unguarded (P0-SEC-2) |
| Return session | ✅ Sound | Guest channel parse (P0-FLOW-1) |
| Verification / PIN | ✅ Sound | Hardcoded salt (P1-VERIFY-1) |
| Auth middleware | ✅ Sound | None |
| Security boundaries | ⚠️ Partial | Phone collision (P0-SEC-1), moderation (P1-CHAT-1) |

**P0 count: 4**  
**P1 count: 9**  
**P2 count: 6**

---

```
PHASE 3 BACKEND AUDIT: COMPLETE

Implementation CAN begin with the following condition:

  The four P0 issues (P0-SEC-1, P0-SEC-2, P0-FLOW-1, P0-FLOW-2 merged as K1–K4)
  MUST be resolved before end-to-end flow testing can pass.

  All Phase 1 and Phase 2 endpoints and contracts remain intact.
  No production database was modified.
  No migrations were created.
  No commits were made.

  Recommended start: Phase 3 Sprint 1 (K1–K4 in order).
```
