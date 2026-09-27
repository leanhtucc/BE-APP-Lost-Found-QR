# Phase 2 Backend Architecture

## Auth Contract

- Canonical login endpoint: `POST /api/auth/login`.
- Canonical refresh endpoint: `POST /api/auth/refresh`. Auth routes are not mounted under the legacy `/v1` base.
- Protected endpoints accept `Authorization: Bearer <accessToken>`.
- Access tokens are local JWTs signed with `JWT_SECRET`; the configured default TTL is `1d` (`JWT_EXPIRES_IN`). The authentication middleware also accepts the supported Supabase access-token path, then resolves the local user and checks account/token state.
- Refresh tokens are local JWTs signed with the separate `JWT_REFRESH_SECRET`; the configured default TTL is `30d` (`JWT_REFRESH_EXPIRES_IN`).
- Successful login and refresh use the standard success envelope. `data` is `{ accessToken, refreshToken, user }`.
- Registration starts an email OTP flow and does not return login tokens. OTP verification retains its existing snake-case token response for compatibility.
- `POST /api/auth/logout` is protected. It increments the user's `tokenVersion`, updates `tokenValidAfter`, writes a `LOGOUT` audit record, and therefore revokes all access and refresh tokens issued with the previous version.

TTL values above are defaults, not constants. A deployment may override them through the named environment variables.

## Refresh Token Contract

Request:

```json
{ "refreshToken": "<jwt>" }
```

Success is HTTP 200 with the standard envelope and a new access/refresh pair. The implementation is stateless: issuing the returned refresh token does not consume or persist the submitted token. This is token renewal, not one-time refresh-token rotation.

Deterministic cases:

| Case                                              | Result                                                 |
| ------------------------------------------------- | ------------------------------------------------------ |
| Valid token, active user, matching `tokenVersion` | 200 and a new token pair                               |
| Expired token                                     | 401 `REFRESH_TOKEN_EXPIRED`                            |
| Malformed/wrongly signed token                    | 401 `INVALID_REFRESH_TOKEN`                            |
| Token from an older `tokenVersion`                | 401 `REFRESH_TOKEN_REVOKED`                            |
| Deleted, missing, or deletion-scheduled user      | 401 `UNAUTHORIZED`; account existence is not disclosed |
| Reuse of the same still-valid token               | Accepted until expiry or version revocation            |
| Parallel calls using the same still-valid token   | Both may succeed                                       |
| Logout/password change/account deletion           | Existing local JWTs fail after `tokenVersion` changes  |

Mobile may use a single refresh queue to avoid duplicate work, but it must not assume that the server consumes a refresh token. A 401 refresh error is terminal for that submitted credential; clear the local session instead of recursively refreshing.

## Error Contract

The backward-compatible error envelope is:

```json
{
  "status": 401,
  "success": false,
  "message": "Unauthorized",
  "error": { "code": "UNAUTHORIZED" },
  "timestamp": "ISO-8601"
}
```

`status`, `success`, `message`, and `timestamp` remain top-level. `error.code` is always machine-readable for errors produced by the shared response/error middleware. Validation may also include `error.fields`; future safe structured context may use `error.details`.

Default mappings are 400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 429 `RATE_LIMITED`, and 500 `INTERNAL_ERROR`. `VALIDATION_ERROR` is used by request validation. Domain-specific codes such as `ITEM_NOT_FOUND` and `ITEM_FORBIDDEN` are preserved. `RATE_LIMITED` is the existing project spelling and is retained instead of introducing a breaking `RATE_LIMIT` rename.

Unexpected errors return a generic 500 response. Stack traces, exception messages, Prisma details, JWT verification details, credentials, and secrets are never returned. Prisma unique and missing-record failures are safely mapped to 409 and 404; other Prisma failures are generic 500 errors.

## Identifier Contract

Unless stated otherwise, identifier values are opaque strings and clients must not infer a format.

| Identifier                             | Meaning and storage                                      | Stability / uniqueness / nullability                                                                                 | Exposure and client use                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Item.id` / owner DTO `id`             | Prisma `Item` primary key, CUID; internal relational key | Stable, unique, non-null                                                                                             | Exposed to authenticated owners for compatibility and accepted by owner item paths. Safe as an opaque authorized navigation key; do not display or place in a future QR payload. |
| `Item.itemId` / DTO `itemId`           | Public item identifier                                   | Stable, unique, non-null                                                                                             | Preferred item identity for mobile state/navigation. Owner DTO also returns `publicItemId` as an exact compatibility alias. Not the QR-specific identifier.                      |
| `Item.qrCodeId` / DTO `qrCodeId`       | QR-facing lookup identifier                              | Unique, non-null; stable during normal lifecycle. Account deletion intentionally replaces it with a tombstone value. | Safe to expose and use for QR lookup/navigation, not useful as display text. Current scan path is `/api/scan/:qrCodeId`.                                                         |
| Public item DTO `id`                   | Legacy alias of `qrCodeId`                               | Same as `qrCodeId`                                                                                                   | Kept for compatibility. New consumers should read explicit `qrCodeId`; Phase 2 adds that field without removing `id`.                                                            |
| `publicId`                             | No Prisma or API field exists                            | N/A                                                                                                                  | Do not send or expect it. `publicItemId` is only an alias of `itemId`.                                                                                                           |
| `FoundReport.id` / `foundReportId`     | Primary key for a finder-created found report            | CUID, unique, non-null on the report; foreign keys may be nullable                                                   | Safe in scoped/authenticated found-report and return navigation. It is distinct from Guardian `reportId`.                                                                        |
| `reportId`                             | In payment/return models, references Guardian `Post.id`  | String; non-null for payment, nullable on `ReturnSession`                                                            | Safe only in the relevant authorized workflow. Treat as an opaque Guardian report key, never as an item key.                                                                     |
| `channelId`                            | Unique interaction/channel handle on `ReturnSession`     | Unique, non-null, stable for the session                                                                             | Used in return/stream APIs and navigation; not an item identifier or display value. Current found-report flow generates `return_<sessionId>`.                                    |
| `ReturnSession.id` / `returnSessionId` | Return-session primary key and relation alias            | CUID, unique and non-null on the session; nullable/unique on `FoundReportClaim`                                      | Safe in authorized return navigation. Do not substitute `channelId`; they have different semantics.                                                                              |

Two legacy special cases are not generalized identifiers:

- Home/found-report cards synthesize `itemId: "found:<FoundReport.id>"`. This is a typed feed key, not an `Item.id` or `Item.itemId`.
- Guardian eligible-item responses retain `item_id` as the internal `Item.id` and `qr_code_id` as `Item.qrCodeId`. This is compatibility output and should not define new code.

## Item DTO Contract

Owner item responses are serialized explicitly as `ItemResponse`; controllers do not return raw Prisma `Item` objects. They include `id`, `itemId`, `publicItemId` (alias of `itemId`), and `qrCodeId`. They deliberately exclude `securityToken`, `securityPin`, and `qrCodeUrl`.

Public item responses are a reduced serializer. `id` remains a legacy alias of `qrCodeId`; the explicit `qrCodeId` and `publicItemId` fields remove ambiguity. They omit `ownerId`, private registered/capture location, `securityToken`, `securityPin`, and `qrCodeUrl`. Owner identity remains anonymized.

`GET /api/items/:identifier` remains owner-authenticated and accepts internal `id`, `itemId`, or `qrCodeId` for backward compatibility. No route was renamed and no QR payload was changed in Phase 2.

## Environment Strategy

- Local development uses ignored `.env.development.local`, copied from `.env.development.example`, and the Phase 1 PostgreSQL/PostGIS service on loopback.
- `src/config/env.ts` validates required database/JWT settings at startup. Missing or invalid required values fail fast.
- In `development` and `test`, startup blocks non-loopback `DATABASE_URL` or `DIRECT_URL` by default. A deliberately verified remote non-production database requires `ALLOW_REMOTE_NON_PRODUCTION_DATABASE=true`.
- The Phase 1 acceptance seed uses the same guard and remains disabled when `NODE_ENV=production`.
- Production database selection is unchanged. Phase 2 does not connect to, migrate, or mutate production.
- Real `.env` and local override files remain ignored. Only placeholder examples are tracked; secrets must never be committed.

The opt-in permits a remote target; it does not prove that target is safe. Operators must verify the project/database before setting it. Phase 4's stricter declared test-versus-production comparison remains in place for its manual workflow.

## API Base Convention

`API_PREFIX` defaults to `/api` and is the canonical mobile API base. Auth, upload, stream, map, home, reports, found reports, radar, returns, AI, and item routes are mounted there. Mobile should use `/api` as its single source of truth.

`/v1` is a partial legacy compatibility mount for selected modules. There is no `/api/v1` mount, and auth is not available at `/v1/auth`. Phase 2 does not bulk-version or rename routes.

## Known Legacy Compatibility

- Success and error envelopes keep their existing top-level fields.
- OTP verification keeps snake-case token names while login/refresh use camelCase.
- Public item `id` means `qrCodeId`; explicit `qrCodeId` is now also returned.
- Owner detail paths continue accepting all three historical item identifiers.
- `/v1` remains partial and must not be treated as the canonical complete API.
- Refresh-token reuse remains allowed because refresh state is not persisted.

## Deferred to Phase 3

QR resolver design, QR payload changes, guest finder sessions, scanner/deep-link routing, real chat, return-session redesign, payment redesign, and radar lifecycle changes are explicitly deferred. One-time refresh rotation would require a persisted session/token-family design and is also not introduced here.
