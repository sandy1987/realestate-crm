# API Conventions & Error Standards

This document establishes the uniform API standards, response envelopes, error mapping, validation rules, and protocol conventions implemented across all endpoints of the **AGENT-Broker Real Estate Multi-Tenant CRM Backend**.

---

## 1. Response Envelopes

Every response emitted by the backend conforms to a predictable, standardized JSON envelope.

### 1.1 Success Response (`sendSuccess`)
All successful HTTP responses (`200 OK`, `201 Created`) use the following structure:

```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "meta": { ... },       // Optional: included on paginated list endpoints
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

- `success`: Always boolean `true`.
- `data`: Can be an object (for single-item endpoints) or an array (for listing endpoints).
- `meta`: Populated whenever an endpoint returns a paginated list.

### 1.2 Error Response (`sendError`)
All client errors (`4xx`) and server errors (`5xx`) use the following structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of what went wrong",
    "details": [ ... ] | { ... } // Optional: field-specific validation errors or metadata
  },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

- `success`: Always boolean `false`.
- `error.code`: A machine-readable, uppercase string identifier (e.g. `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`).
- `error.message`: A safe, descriptive message for user-facing diagnosis.
- `error.details`: Array or object providing contextual diagnostic information (e.g., specific form fields failing validation).

---

## 2. Standard Error Codes & HTTP Status Mapping

The centralized `errorHandler` (`src/middleware/errorHandler.middleware.js`) consistently maps errors to appropriate status codes:

| HTTP Status | Error Code (`error.code`) | Trigger / Scenario |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Request body or query parameters failed Zod schema validation. `details` contains array of `{ field, message }`. |
| `400 Bad Request` | `INVALID_JSON` | Malformed JSON syntax in request body. |
| `400 Bad Request` | `INVALID_IDENTIFIER` | Malformed MongoDB ObjectId string (e.g. invalid hex length). |
| `400 Bad Request` | `INVALID_CREDENTIALS` | Incorrect current password provided on `/change-password`. |
| `400 Bad Request` | `CANNOT_MODIFY_OWN_STATUS` | Firm administrator attempted to deactivate or suspend their own account. |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or invalid `Authorization: Bearer <token>` header, or invalid JWT signature. |
| `401 Unauthorized` | `TOKEN_EXPIRED` | Access token or refresh token has expired past its validity window. |
| `401 Unauthorized` | `TOKEN_REVOKED` | Refresh token was previously revoked or used (replay attack prevention). |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Incorrect email or password on `/login`. |
| `403 Forbidden` | `FORBIDDEN` | Missing required granular permission (e.g. `private:read`, `plots:write`), or `SUPER_ADMIN` attempting tenant route. |
| `403 Forbidden` | `ACCOUNT_DISABLED` | User or firm account is suspended (`isSuspended: true`) or deactivated (`isActive: false`). |
| `403 Forbidden` | `PLATFORM_ADMIN_REQUIRED` | Tenant user attempting to access platform-level routes (`/api/platform/*`). |
| `404 Not Found` | `NOT_FOUND` | Unmatched route, non-existent resource ID, or resource belonging to another firm (cross-tenant fence). |
| `409 Conflict` | `CONFLICT` | Uniqueness violation (e.g. email already exists, firm slug already taken, duplicate plotRef in colony). |
| `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` | Request body exceeds the 10kb parser limit. |
| `429 Too Many Requests` | `TOO_MANY_REQUESTS` | Rate limiter threshold exceeded. |
| `500 Internal Error` | `INTERNAL_ERROR` | Unhandled server exception. In production, raw stack traces are masked. |
| `503 Service Unavailable`| `SERVICE_UNAVAILABLE` | Database readiness check failed (`readyState !== 1`). |

---

## 3. Validation Errors Format (`VALIDATION_ERROR`)

When Zod validation middleware fails, it returns HTTP 400 with `details` listing every invalid field:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "rate",
        "message": "Rate is required"
      },
      {
        "field": "sizeUnit",
        "message": "Invalid size unit. Must be one of: sqft, sqyd, sqm, marla, kanal, acre, gaj"
      }
    ]
  },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

---

## 4. Pagination & Sorting Conventions

Listing endpoints (`/api/plots`, `/api/colonies`, `/api/firm/users`, `/api/platform/firms`, `/api/firm/audit`, `/api/platform/audit`) implement uniform pagination:

### Query Parameters:
- **`page`**: 1-based page index (Integer >= 1; default: `1`).
- **`limit`**: Number of items per page (Integer; default: `20`, maximum hard cap: `100`). Requesting `limit > 100` is automatically clamped to 100 to prevent denial-of-service.
- **`sortBy`**: Field to sort by. Whitelisted per resource. Unrecognized sort fields fall back safely to `createdAt`.
- **`sortOrder`**: `asc` or `desc` (default: `desc`).

### Pagination Metadata Object (`meta`):
```json
{
  "page": 1,
  "limit": 20,
  "total": 45,
  "totalPages": 3,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

---

## 5. Data Representations & Standards

### 5.1 MongoDB ObjectId
- Formatted as 24-character hexadecimal strings (e.g. `671cb80f2b3e5e4120a10001`).
- Responses always transform `_id` to `id` and omit `__v`.

### 5.2 Timestamps & Dates
- All dates and timestamps are formatted in ISO 8601 UTC strings: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g. `2026-10-26T12:00:00.000Z`).

### 5.3 Currency & Numbers
- Real estate currency defaults to `INR` (Indian Rupees).
- Rates and prices are represented as standard decimal numbers.

### 5.4 Video URL & Provider Standards
- Approved video providers are `youtube` and `vimeo`.
- Valid video URLs must match approved provider domain patterns (`youtube.com`, `youtu.be`, `vimeo.com`).

---

## 6. Rate Limiting Rules

- **Global Limiter**: In production and development modes, a global limiter allows up to 100 requests per 15 minutes per IP.
- **Authentication Limiter (`authRateLimiter`)**: Sensitive endpoints (`/login`, `/refresh`, `/change-password`) are restricted to **10 requests per 15 minutes** per IP to defend against brute-force credential stuffing.
- Exceeding limits returns HTTP 429 `TOO_MANY_REQUESTS`.
