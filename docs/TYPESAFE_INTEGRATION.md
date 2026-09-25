# TypeSafe AI Integration

This document describes the TypeSafe AI (Jev) integration for item classification
in the Lost & Found QR backend.

## Overview

TypeSafe AI provides **System One models** that return structured judgments instead
of generated text. The integration uses a **Choice question** to classify items
into the existing project categories based on text descriptions.

This is complementary to the existing **Gemini-based image analysis** at
`POST /api/ai/analyze-item`. The TypeSafe endpoint handles **text-only** classification.

## Architecture

```
Mobile App
    │
    ▼
POST /api/ai/classify-item  ← Auth + Rate Limit + Validation
    │
    ▼
AIController.classifyItem()
    │
    ▼
libs/typesafe.ts             ← TypeSafe SDK Client (server-side only)
    │
    ▼
TypeSafe API (api.typesafe.ai/v1/systemone)
```

## Environment Variables

| Variable            | Required | Default                                      | Description                           |
|---------------------|----------|----------------------------------------------|---------------------------------------|
| `TYPESAFE_API_KEY`  | Yes*     | —                                            | TypeSafe API key (server-only secret) |
| `TYPESAFE_MODEL`    | No       | `jev-latest`                                 | TypeSafe model to use                 |
| `TYPESAFE_API_URL`  | No       | `https://api.typesafe.ai/v1/systemone`       | TypeSafe API endpoint URL             |

\* The endpoint returns `503` if the key is not set. The rest of the app works normally.

### Configuration

1. Get your API key from [console.typesafe.ai](https://console.typesafe.ai)
2. Add it to your `.env` file:
   ```
   TYPESAFE_API_KEY="your-api-key-here"
   TYPESAFE_MODEL="jev-latest"
   TYPESAFE_API_URL="https://api.typesafe.ai/v1/systemone"
   ```
3. **NEVER** expose this key to the mobile app (no `EXPO_PUBLIC_` prefix)
4. The key is validated at startup via Zod in `src/config/env.ts`

## API Endpoint

### `POST /api/ai/classify-item`

Classify a lost/found item description into a category using TypeSafe AI.

**Also available at:** `POST /v1/ai/classify-item`

#### Authentication

Requires a valid Bearer token (same auth as all other endpoints).

#### Rate Limiting

10 requests per minute per user/IP (additional to the global rate limit).

#### Request

```json
{
  "description": "I found a black wallet in the library."
}
```

| Field         | Type   | Required | Constraints                         |
|---------------|--------|----------|-------------------------------------|
| `description` | string | Yes      | 1-1000 characters, trimmed          |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Item classified successfully",
  "data": {
    "category": "wallet",
    "confidence": 0.95,
    "probabilities": {
      "electronics": 0.01,
      "wallet": 0.95,
      "keys": 0.01,
      "bag": 0.00,
      "documents": 0.01,
      "jewelry": 0.00,
      "phone": 0.00,
      "other": 0.02
    },
    "source": "typesafe"
  },
  "timestamp": "2026-09-22T01:30:00.000Z"
}
```

#### Response Fields

| Field           | Type   | Description                                                  |
|-----------------|--------|--------------------------------------------------------------|
| `category`      | string | One of: `electronics`, `wallet`, `keys`, `bag`, `documents`, `jewelry`, `phone`, `other` |
| `confidence`    | number | 0-1, how concentrated the probability is on the top choice   |
| `probabilities` | object | Probability for each category (sums to 1)                    |
| `source`        | string | Always `"typesafe"`, identifies the AI provider              |

#### Error Responses

| Status | Scenario                          | Message                                          |
|--------|-----------------------------------|--------------------------------------------------|
| 400    | Empty or missing description      | "Request data is invalid"                        |
| 401    | No/invalid auth token             | "Unauthorized"                                   |
| 429    | Rate limit exceeded (app or API)  | "Too many requests" / "AI service is busy"       |
| 502    | TypeSafe API error / timeout      | "AI classification service is unavailable"       |
| 503    | API key not configured            | "TypeSafe AI service is not configured"          |

## Testing

### Run TypeSafe tests only

```bash
npx vitest run src/modules/ai/ai.typesafe.test.ts
```

### Run all tests

```bash
npm test
```

### What the tests cover

- ✅ Valid classification with category, confidence, probabilities
- ✅ Empty, missing, and too-long descriptions → 400
- ✅ Missing API key → 503
- ✅ TypeSafe API errors → 502
- ✅ Authentication required → 401
- ✅ Rate limit → 429
- ✅ All 8 categories validated
- ✅ Unexpected categories fall back to "other"
- ✅ Server remains functional after AI failure

### Smoke test with curl

If the API key is configured and the server is running:

```bash
curl -X POST http://localhost:3000/api/ai/classify-item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"description": "I found a black wallet in the library."}'
```

## Mobile Client Integration Guide

The mobile app should call the **backend endpoint**, never TypeSafe directly.

### API Service (TypeScript)

```typescript
// services/ai.service.ts
import { apiClient } from './api-client'; // Your existing HTTP client

export interface ClassificationResult {
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
  source: 'typesafe';
}

export async function classifyItem(description: string): Promise<ClassificationResult> {
  const response = await apiClient.post('/api/ai/classify-item', { description });
  return response.data.data;
}
```

### React Query Hook

```typescript
// hooks/useClassifyItem.ts
import { useMutation } from '@tanstack/react-query';
import { classifyItem, ClassificationResult } from '../services/ai.service';

export function useClassifyItem() {
  return useMutation<ClassificationResult, Error, string>({
    mutationFn: (description: string) => classifyItem(description),
    retry: 1,
  });
}
```

### UI Integration

```tsx
// In your Create/Report Item screen:
const { mutate: classify, data, isPending, error } = useClassifyItem();

// "Suggest category with AI" button
<Button
  title="Suggest category"
  onPress={() => {
    if (description.trim()) {
      classify(description);
    }
  }}
  disabled={isPending || !description.trim()}
/>

// Show suggestion (user accepts or rejects)
{data && (
  <CategorySuggestion
    category={data.category}
    confidence={data.confidence}
    onAccept={() => setCategory(data.category)}
    onReject={() => {/* user picks manually */}}
  />
)}
```

> **Important**: Never auto-submit items based on AI suggestions. Always let
> the user accept or reject the classification.

## Troubleshooting

### "TypeSafe AI service is not configured" (503)

The `TYPESAFE_API_KEY` environment variable is empty or missing. Set it in `.env`.

### "AI service authentication failed" (502)

The API key is invalid or expired. Get a new one from
[console.typesafe.ai](https://console.typesafe.ai).

### "AI service is temporarily busy" (429)

TypeSafe rate limit exceeded. The SDK retries automatically with backoff.
If this persists, check your API plan limits.

### "AI classification service is unavailable" (502)

Network issue, timeout, or TypeSafe service outage. The mobile app should
gracefully fall back to manual category selection.

### Endpoint returns 400 but description looks valid

Check that the description is:
- Not empty after trimming
- Under 1000 characters
- Sent as JSON with `Content-Type: application/json`

## Security Considerations

- The TypeSafe API key is **server-only** — never in mobile code
- No `EXPO_PUBLIC_` prefixed variables for secrets
- `.env` is in `.gitignore`; `.env.example` has empty placeholders
- The API key is never logged (even in error messages)
- Mobile clients cannot send arbitrary TypeSafe payloads
- The backend controls the model, question structure, and categories
- Rate limiting protects both the backend and the TypeSafe API quota
- Authentication is required for all AI endpoints

## Files

| File | Purpose |
|------|---------|
| `src/libs/typesafe.ts` | TypeSafe SDK client and classification logic |
| `src/config/env.ts` | Environment variable validation (TypeSafe section) |
| `src/modules/ai/ai.controller.ts` | `classifyItem` handler |
| `src/modules/ai/ai.routes.ts` | `/classify-item` route with auth + rate limit |
| `src/modules/ai/ai.schema.ts` | `classifyItemSchema` Zod validation |
| `src/modules/ai/ai.types.ts` | `TypeSafeClassificationResult` type |
| `src/modules/ai/ai.typesafe.test.ts` | Unit tests (12 test cases) |
| `.env.example` | TypeSafe section with placeholders |
| `docs/TYPESAFE_INTEGRATION.md` | This documentation |
