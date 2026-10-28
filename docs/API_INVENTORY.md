# AGENT-Broker — Complete API Inventory

This document provides an exhaustive inventory of all API endpoints implemented in the **AGENT-Broker Real Estate Multi-Tenant CRM Backend** (Phases 1 through 7).

Every endpoint documented below reflects the **actual server-side source code** implemented in Express, Mongoose, and Zod.

---

## Architecture & Routing Principles

1. **Routing Aliases**:
   - Every business API route is mounted concurrently at both `/api/v1/*` and `/api/*` via Express routers in `src/routes/index.js`.
   - The behavior, validation, permissions, and response envelopes between `/api/v1/*` and `/api/*` are identical.
2. **Standard API Response Envelopes**:
   - **Success**: `{ success: true, data: <payload>, meta?: <paginationMeta>, timestamp: <ISO8601> }`
   - **Error**: `{ success: false, error: { code: <ERROR_CODE>, message: <string>, details?: <any> }, timestamp: <ISO8601> }`
3. **Tenant Isolation Invariant**:
   - For all tenant-scoped routes (`/api/firm/*`, `/api/colonies/*`, `/api/plots/*`), tenant context is established strictly from the authenticated JWT server-side session (`req.user.firmId`).
   - Platform administrators (`SUPER_ADMIN`, whose `firmId === null`) are strictly rejected with HTTP 403 `FORBIDDEN` from tenant routes.
   - Any client-supplied `firmId` in request headers, URL parameters, query strings, or request bodies is discarded.

---

## Feature Index

1. [Health & Readiness Probes](#1-health--readiness-probes)
2. [Authentication & Session Lifecycle](#2-authentication--session-lifecycle)
3. [Platform Administration (SUPER_ADMIN)](#3-platform-administration-super_admin)
4. [Tenant Firm Operations & Audit Trail](#4-tenant-firm-operations--audit-trail)
5. [Firm User Administration (FIRM_ADMIN)](#5-firm-user-administration-firm_admin)
6. [Colony Management](#6-colony-management)
7. [Plot Management](#7-plot-management)
8. [Private Plot Owner & Source Data](#8-private-plot-owner--source-data)

---

## 1. Health & Readiness Probes

### 1.1 Liveness Probe
- **Method**: `GET`
- **Route**: `/health`
- **Purpose**: Liveness probe returning 200 when the Node.js application process is running.
- **Authentication**: None (Public)
- **Roles / Permissions**: Anyone
- **Tenant Context**: Not required
- **Path Parameters**: None
- **Query Parameters**: None
- **Request Body**: None
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok"
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```
- **Error Statuses**: None under normal operation.
- **Versioned**: Unversioned only (`/health`).

### 1.2 Readiness Probe
- **Method**: `GET`
- **Route**: `/health/ready`
- **Purpose**: Readiness probe checking active database connectivity (`readyState === 1`).
- **Authentication**: None (Public)
- **Roles / Permissions**: Anyone
- **Tenant Context**: Not required
- **Path Parameters**: None
- **Query Parameters**: None
- **Request Body**: None
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "database": "connected"
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```
- **Error Statuses**:
  - `503 SERVICE_UNAVAILABLE`: When MongoDB connection state is not 1 (connected).
    ```json
    {
      "success": false,
      "error": {
        "code": "SERVICE_UNAVAILABLE",
        "message": "Database connection is not ready",
        "details": { "readyState": 0 }
      },
      "timestamp": "2026-10-26T12:00:00.000Z"
    }
    ```
- **Versioned**: Unversioned only (`/health/ready`).

---

## 2. Authentication & Session Lifecycle

Mounted on `/api/v1/auth` and `/api/auth`.

### 2.1 User Login
- **Method**: `POST`
- **Routes**: `/api/v1/auth/login`, `/api/auth/login`
- **Purpose**: Authenticates a user with email and password, returning an access token and refresh token session. Employs Argon2id timing defense against user enumeration.
- **Authentication**: None (Public; protected by `authRateLimiter` 10 req/15min)
- **Tenant Context**: Derived upon authentication
- **Request Body** (`application/json`):
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Validation Rules**:
  - `email`: Valid email format, lowercase normalized, required.
  - `password`: String, min 8, max 128 chars, required.
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "671cb80f2b3e5e4120a10001",
        "email": "user@example.com",
        "role": "FIRM_ADMIN",
        "firmId": "671cb80f2b3e5e4120a10002",
        "firstName": "John",
        "lastName": "Doe",
        "isActive": true,
        "isSuspended": false,
        "permissions": [],
        "lastLoginAt": "2026-10-26T12:00:00.000Z",
        "createdAt": "2026-10-26T10:00:00.000Z",
        "updatedAt": "2026-10-26T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "4a7b9c...",
      "expiresAt": "2026-11-02T12:00:00.000Z"
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Missing or malformed email/password.
  - `401 INVALID_CREDENTIALS`: Incorrect email or password (timing equalized).
  - `403 ACCOUNT_DISABLED`: User is deactivated (`isActive: false`) or suspended (`isSuspended: true`).
  - `429 TOO_MANY_REQUESTS`: Rate limit exceeded.

### 2.2 Refresh Token Rotation
- **Method**: `POST`
- **Routes**: `/api/v1/auth/refresh`, `/api/auth/refresh`
- **Purpose**: Atomically claims an unrevoked, unexpired refresh token, revokes it, and issues a new access token and successor refresh token. Detects replay attacks.
- **Authentication**: None directly required; client presents raw `refreshToken` in body.
- **Request Body**:
  ```json
  {
    "refreshToken": "4a7b9c..."
  }
  ```
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": { /* SafeUser object */ },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "8f3d1e...",
      "expiresAt": "2026-11-02T12:05:00.000Z"
    },
    "timestamp": "2026-10-26T12:05:00.000Z"
  }
  ```
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Missing `refreshToken`.
  - `401 INVALID_TOKEN`: Token not found in database.
  - `401 TOKEN_REVOKED`: Token was previously used or revoked (replay detection).
  - `401 TOKEN_EXPIRED`: Token has passed its `expiresAt` deadline.
  - `403 ACCOUNT_DISABLED`: Associated user account is suspended or deactivated.

### 2.3 User Logout
- **Method**: `POST`
- **Routes**: `/api/v1/auth/logout`, `/api/auth/logout`
- **Purpose**: Revokes the supplied refresh token session. Emits an audit event.
- **Authentication**: None required in headers; accepts `refreshToken` in request body.
- **Request Body**:
  ```json
  {
    "refreshToken": "4a7b9c..."
  }
  ```
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully"
    },
    "timestamp": "2026-10-26T12:10:00.000Z"
  }
  ```
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Missing `refreshToken`.
  - `401 INVALID_TOKEN`: Token does not exist.
  - `401 TOKEN_REVOKED`: Token was already revoked.

### 2.4 Authenticated User Identity (Me)
- **Method**: `GET`
- **Routes**: `/api/v1/auth/me`, `/api/auth/me`
- **Purpose**: Returns the authenticated caller's profile identity as derived from their verified JWT.
- **Authentication**: `requireAuth` (Bearer token in `Authorization` header)
- **Roles**: Any authenticated role (`SUPER_ADMIN`, `FIRM_ADMIN`, `FIRM_STAFF`)
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "671cb80f2b3e5e4120a10001",
      "email": "user@example.com",
      "role": "FIRM_ADMIN",
      "firmId": "671cb80f2b3e5e4120a10002",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "isSuspended": false,
      "permissions": []
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```
- **Error Statuses**:
  - `401 UNAUTHORIZED`: Missing or invalid Bearer token.
  - `401 TOKEN_EXPIRED`: JWT token has expired.

### 2.5 Change Password
- **Method**: `POST`
- **Routes**: `/api/v1/auth/change-password`, `/api/auth/change-password`
- **Purpose**: Authenticated user updates their password. Verifies current password, re-hashes with Argon2id, and invalidates all existing refresh token sessions across all devices.
- **Authentication**: `requireAuth` + `authRateLimiter`
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword456!"
  }
  ```
- **Validation Rules**:
  - `currentPassword`: String, min 8 chars.
  - `newPassword`: String, min 8, max 128 chars.
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Password changed successfully"
    },
    "timestamp": "2026-10-26T12:15:00.000Z"
  }
  ```
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Malformed input.
  - `400 INVALID_CREDENTIALS`: Current password does not match.
  - `401 UNAUTHORIZED`: Unauthenticated.

---

## 3. Platform Administration (SUPER_ADMIN)

Mounted on `/api/v1/platform` and `/api/platform`.  
All endpoints require `requireAuth` and `requirePlatformAdmin` (`req.user.role === 'SUPER_ADMIN'` and `req.user.firmId === null`). Tenant members receive HTTP 403 `FORBIDDEN`.

### 3.1 Provision Firm
- **Method**: `POST`
- **Routes**: `/api/v1/platform/firms`, `/api/platform/firms`
- **Purpose**: Provisions a new tenant firm organization. Can optionally provision the initial `FIRM_ADMIN` in the same operation.
- **Request Body**:
  ```json
  {
    "name": "Apex Real Estate Ltd",
    "slug": "apex-real-estate",
    "contactEmail": "contact@apexrealestate.com",
    "contactPhone": "+91 98765 43210",
    "settings": {
      "allowedVideoProviders": ["youtube", "vimeo"],
      "defaultCurrency": "INR"
    },
    "adminEmail": "admin@apexrealestate.com",
    "adminPassword": "AdminPassword123!",
    "adminFirstName": "Apex",
    "adminLastName": "Admin"
  }
  ```
- **Success Status**: `201 Created`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "firm": {
        "id": "671cb80f2b3e5e4120a10010",
        "name": "Apex Real Estate Ltd",
        "slug": "apex-real-estate",
        "contactEmail": "contact@apexrealestate.com",
        "contactPhone": "+91 98765 43210",
        "isActive": true,
        "isSuspended": false,
        "settings": {
          "allowedVideoProviders": ["youtube", "vimeo"],
          "defaultCurrency": "INR"
        },
        "createdAt": "2026-10-26T12:20:00.000Z"
      },
      "admin": {
        "id": "671cb80f2b3e5e4120a10011",
        "email": "admin@apexrealestate.com",
        "role": "FIRM_ADMIN",
        "firmId": "671cb80f2b3e5e4120a10010",
        "firstName": "Apex",
        "lastName": "Admin",
        "isActive": true,
        "isSuspended": false
      }
    },
    "timestamp": "2026-10-26T12:20:00.000Z"
  }
  ```
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Invalid slug format (must be lowercase alphanumeric separated by hyphens) or missing required fields.
  - `403 FORBIDDEN`: Non-SUPER_ADMIN caller.
  - `409 CONFLICT`: Firm slug or admin email already exists globally.

### 3.2 List Firms
- **Method**: `GET`
- **Routes**: `/api/v1/platform/firms`, `/api/platform/firms`
- **Purpose**: Paginated list of all tenant firms for platform administration.
- **Query Parameters**:
  - `page`: Integer >= 1 (default: 1)
  - `limit`: Integer (default: 20, max: 100)
  - `sortBy`: Whitelisted field (`createdAt`, `name`, `slug`, `isActive`; default: `createdAt`)
  - `sortOrder`: `asc` or `desc` (default: `desc`)
  - `search`: String (searches `name` and `slug`)
  - `isActive`: Boolean (`true` or `false`)
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "671cb80f2b3e5e4120a10010",
        "name": "Apex Real Estate Ltd",
        "slug": "apex-real-estate",
        "isActive": true,
        "isSuspended": false,
        "createdAt": "2026-10-26T12:20:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "timestamp": "2026-10-26T12:20:00.000Z"
  }
  ```

### 3.3 Get Firm by ID
- **Method**: `GET`
- **Routes**: `/api/v1/platform/firms/:firmId`, `/api/platform/firms/:firmId`
- **Path Parameters**: `firmId` (24-char hex ObjectId)
- **Success Status**: `200 OK`
- **Error Statuses**:
  - `404 NOT_FOUND`: If firm ID does not exist.

### 3.4 Suspend Firm
- **Method**: `POST`
- **Routes**: `/api/v1/platform/firms/:firmId/suspend`, `/api/platform/firms/:firmId/suspend`
- **Purpose**: Sets firm `isActive: false` and `isSuspended: true`. Immediately revokes all active refresh-token sessions for all users belonging to this firm.
- **Path Parameters**: `firmId`
- **Success Status**: `200 OK`

### 3.5 Activate Firm
- **Method**: `POST`
- **Routes**: `/api/v1/platform/firms/:firmId/activate`, `/api/platform/firms/:firmId/activate`
- **Purpose**: Re-activates a suspended firm (`isActive: true`, `isSuspended: false`).
- **Path Parameters**: `firmId`
- **Success Status**: `200 OK`

### 3.6 Platform Audit Log Retrieval
- **Method**: `GET`
- **Routes**: `/api/v1/platform/audit`, `/api/platform/audit`
- **Purpose**: Platform-wide audit query interface for `SUPER_ADMIN`.
- **Query Parameters**:
  - `page`, `limit`, `sortBy`, `sortOrder`
  - `eventType`: Validated against `ALL_AUDIT_EVENTS`
  - `actorUserId`: ObjectId
  - `resourceType`: String
  - `resourceId`: String
  - `outcome`: `success` or `failure`
  - `firmId`: Filter by specific tenant firm
  - `platformOnly`: `true` (filters to platform-level events where `firmId === null`)
  - `dateFrom`, `dateTo`: ISO 8601 timestamps
- **Success Status**: `200 OK`

---

## 4. Tenant Firm Operations & Audit Trail

Mounted on `/api/v1/firm` and `/api/firm`.  
All endpoints require `requireAuth` + `requireTenantContext`. `SUPER_ADMIN` is rejected with 403 `FORBIDDEN`.

### 4.1 Get Own Firm Profile
- **Method**: `GET`
- **Routes**: `/api/v1/firm/me`, `/api/firm/me`
- **Purpose**: Retrieves the organization profile for the authenticated user's firm.
- **Allowed Roles**: `FIRM_ADMIN`, `FIRM_STAFF`
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "671cb80f2b3e5e4120a10010",
      "name": "Apex Real Estate Ltd",
      "slug": "apex-real-estate",
      "contactEmail": "contact@apexrealestate.com",
      "contactPhone": "+91 98765 43210",
      "isActive": true,
      "settings": {
        "allowedVideoProviders": ["youtube", "vimeo"],
        "defaultCurrency": "INR"
      }
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```

### 4.2 Query Firm Audit Trail
- **Method**: `GET`
- **Routes**: `/api/v1/firm/audit`, `/api/firm/audit`
- **Purpose**: Retrieves audit logs strictly scoped to the caller's firm (`{ firmId: req.tenant.firmId }`).
- **Required Permission**: `audit:read` (`FIRM_ADMIN` has implicit access; `FIRM_STAFF` requires explicit grant)
- **Query Parameters**:
  - `page`, `limit` (default: 20, max: 100)
  - `sortBy` (`createdAt`, `eventType`, `resourceType`, `outcome`, `action`), `sortOrder`
  - `eventType`, `actorUserId`, `resourceType`, `resourceId`, `outcome`
  - `dateFrom`, `dateTo` (ISO date strings)
- **Success Status**: `200 OK`
- **Error Statuses**:
  - `403 FORBIDDEN`: If staff member lacks `audit:read` permission.

---

## 5. Firm User Administration (FIRM_ADMIN)

Mounted on `/api/v1/firm/users` and `/api/firm/users`.  
Guarded by `requireAuth`, `requireTenantContext`, and `requireRole(ROLES.FIRM_ADMIN)`. Staff members and platform admins are rejected with 403 `FORBIDDEN`.

### 5.1 Create Staff Account
- **Method**: `POST`
- **Routes**: `/api/v1/firm/users`, `/api/firm/users`
- **Purpose**: Creates an active `FIRM_STAFF` account under the administrator's firm with assigned permissions.
- **Request Body**:
  ```json
  {
    "email": "agent.smith@apexrealestate.com",
    "password": "StaffPassword123!",
    "firstName": "Agent",
    "lastName": "Smith",
    "permissions": ["plots:read", "plots:write", "colonies:read"]
  }
  ```
- **Validation Rules**:
  - `email`: Valid email format, globally unique.
  - `password`: String >= 8 chars.
  - `permissions`: Array of valid strings from `ALL_PERMISSIONS`.
- **Success Status**: `201 Created`
- **Error Statuses**:
  - `400 VALIDATION_ERROR`: Invalid fields or unapproved permissions.
  - `409 CONFLICT`: Email address already registered globally.

### 5.2 List Firm Users
- **Method**: `GET`
- **Routes**: `/api/v1/firm/users`, `/api/firm/users`
- **Purpose**: Paginated listing of users strictly within the caller's firm.
- **Query Parameters**:
  - `page`, `limit`, `sortBy`, `sortOrder`
  - `search`: Matches email, firstName, lastName
  - `role`: Filter by `FIRM_ADMIN` or `FIRM_STAFF`
  - `isActive`: Boolean
  - `isSuspended`: Boolean
- **Success Status**: `200 OK`

### 5.3 Get Firm User by ID
- **Method**: `GET`
- **Routes**: `/api/v1/firm/users/:userId`, `/api/firm/users/:userId`
- **Path Parameters**: `userId`
- **Success Status**: `200 OK`
- **Error Statuses**:
  - `404 NOT_FOUND`: If user does not exist or belongs to another firm.

### 5.4 Update Firm User Profile & Permissions
- **Method**: `PATCH`
- **Routes**: `/api/v1/firm/users/:userId`, `/api/firm/users/:userId`
- **Path Parameters**: `userId`
- **Request Body**:
  ```json
  {
    "firstName": "Alexander",
    "lastName": "Smith",
    "permissions": ["plots:read", "plots:write", "private:read"]
  }
  ```
- **Success Status**: `200 OK`

### 5.5 Activate / Deactivate / Suspend Staff
- **Method**: `PATCH`
- **Routes**: `/api/v1/firm/users/:userId/status`, `/api/firm/users/:userId/status`
- **Path Parameters**: `userId`
- **Request Body**:
  ```json
  {
    "isActive": false,
    "isSuspended": true
  }
  ```
- **Success Status**: `200 OK`
- **Business Invariant**: Administrators cannot modify their own active or suspended status (returns 400 `CANNOT_MODIFY_OWN_STATUS`). Setting `isActive: false` or `isSuspended: true` immediately revokes all active refresh-token sessions for the target user.

---

## 6. Colony Management

Mounted on `/api/v1/colonies` and `/api/colonies`.  
Guarded by `requireAuth` + `requireTenantContext`. Scoped strictly to the caller's firm.

### 6.1 Create Colony
- **Method**: `POST`
- **Routes**: `/api/v1/colonies`, `/api/colonies`
- **Required Permission**: `colonies:write`
- **Request Body**:
  ```json
  {
    "name": "Palm Greens Residency",
    "location": "Sector 45, Gurgaon",
    "description": "Premium gated township"
  }
  ```
- **Success Status**: `201 Created`

### 6.2 List Colonies
- **Method**: `GET`
- **Routes**: `/api/v1/colonies`, `/api/colonies`
- **Required Permission**: `colonies:read`
- **Query Parameters**:
  - `page`, `limit`, `sortBy`, `sortOrder`
  - `search`: Searches colony name and location
  - `isActive`: Boolean (default: true)
- **Success Status**: `200 OK`

### 6.3 Get Colony by ID
- **Method**: `GET`
- **Routes**: `/api/v1/colonies/:colonyId`, `/api/colonies/:colonyId`
- **Required Permission**: `colonies:read`
- **Path Parameters**: `colonyId`
- **Success Status**: `200 OK`
- **Error Statuses**:
  - `404 NOT_FOUND`: If colony does not exist or belongs to another firm.

### 6.4 Update Colony
- **Method**: `PATCH`
- **Routes**: `/api/v1/colonies/:colonyId`, `/api/colonies/:colonyId`
- **Required Permission**: `colonies:write`
- **Path Parameters**: `colonyId`
- **Request Body**: Any subset of `{ name, location, description, isActive }`
- **Success Status**: `200 OK`

### 6.5 Deactivate Colony (Soft Delete)
- **Method**: `DELETE`
- **Routes**: `/api/v1/colonies/:colonyId`, `/api/colonies/:colonyId`
- **Required Permission**: `colonies:write`
- **Path Parameters**: `colonyId`
- **Success Status**: `200 OK`
- **Behavior**: Sets `isActive: false` (soft delete).

---

## 7. Plot Management

Mounted on `/api/v1/plots` and `/api/plots`.  
Guarded by `requireAuth` + `requireTenantContext`. Scoped strictly to the caller's firm.

### 7.1 Create Plot
- **Method**: `POST`
- **Routes**: `/api/v1/plots`, `/api/plots`
- **Required Permission**: `plots:write`
- **Request Body**:
  ```json
  {
    "plotRef": "P-101",
    "colonyId": "671cb80f2b3e5e4120a10020",
    "size": 250,
    "sizeUnit": "sqyd",
    "rate": 45000,
    "rateType": "per_unit",
    "currency": "INR",
    "type": "residential",
    "status": "available",
    "description": "Corner plot facing green belt",
    "videoUrl": "https://www.youtube.com/watch?v=example",
    "videoProvider": "youtube"
  }
  ```
- **Validation Rules**:
  - `plotRef` or `plotId`: Required, unique within the colony.
  - `size`: Positive number.
  - `sizeUnit`: Enum (`sqft`, `sqyd`, `sqm`, `marla`, `kanal`, `acre`, `gaj`).
  - `rate`: Non-negative number.
  - `rateType`: Enum (`per_unit`, `total`; default: `total`).
  - `colonyId`: If provided, must exist, be active, and belong to the same firm.
  - `videoUrl` / `videoProvider`: Must be from approved providers (`youtube`, `vimeo`).
- **Success Status**: `201 Created`
- **Privacy Assurance**: The response object contains public plot data only. Private owner and source fields are never included.

### 7.2 List & Filter Plots
- **Method**: `GET`
- **Routes**: `/api/v1/plots`, `/api/plots`
- **Required Permission**: `plots:read`
- **Query Parameters**:
  - `page`, `limit` (max: 100), `sortBy`, `sortOrder`
  - `search`: Searches plotRef and description
  - `colonyId`: Filter by colony
  - `status`: `available`, `reserved`, `sold`, `blocked`
  - `type`: `residential`, `commercial`, `industrial`, `agricultural`, `other`
  - `sizeMin`, `sizeMax`
  - `priceMin`, `priceMax`
  - `rateMin`, `rateMax`
  - `isActive`: Boolean
- **Success Status**: `200 OK`

### 7.3 Get Plot by ID
- **Method**: `GET`
- **Routes**: `/api/v1/plots/:plotId`, `/api/plots/:plotId`
- **Required Permission**: `plots:read`
- **Path Parameters**: `plotId`
- **Success Status**: `200 OK`
- **Error Statuses**:
  - `404 NOT_FOUND`: If plot does not exist or belongs to another firm.

### 7.4 Update Plot
- **Method**: `PATCH`
- **Routes**: `/api/v1/plots/:plotId`, `/api/plots/:plotId`
- **Required Permission**: `plots:write`
- **Path Parameters**: `plotId`
- **Request Body**: Partial update of plot fields.
- **Success Status**: `200 OK`

### 7.5 Deactivate Plot (Soft Delete)
- **Method**: `DELETE`
- **Routes**: `/api/v1/plots/:plotId`, `/api/plots/:plotId`
- **Required Permission**: `plots:delete`
- **Path Parameters**: `plotId`
- **Success Status**: `200 OK`
- **Behavior**: Sets `isActive: false`.

### 7.6 Get Plot WhatsApp Share
- **Method**: `GET`
- **Routes**: `/api/v1/plots/:plotId/share-whatsapp`, `/api/plots/:plotId/share-whatsapp`
- **Required Permission**: `plots:read`
- **Path Parameters**: `plotId`
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "plotId": "653b1... ",
      "plotRef": "PV-101",
      "messageText": "🏡 *PLOT SPECIFICATION & DETAILS* 🏡\n...",
      "whatsappWebUrl": "https://web.whatsapp.com/send?text=...",
      "whatsappApiUrl": "https://api.whatsapp.com/send?text=..."
    },
    "timestamp": "2026-10-28T12:00:00.000Z"
  }
  ```
- **Error Statuses**:
  - `401 UNAUTHORIZED`: Missing or expired JWT.
  - `404 NOT_FOUND`: If plot does not exist or belongs to another firm.

---

## 8. Private Plot Owner & Source Data

Mounted on `/api/v1/plots/:plotId/private` and `/api/plots/:plotId/private`.  
Protected by separate `private:read` and `private:write` permissions. Stored in a distinct `PlotPrivate` database collection with compound `{ plotId, firmId }` fencing. Never returned in public plot responses.

### 8.1 Read Private Plot Data
- **Method**: `GET`
- **Routes**: `/api/v1/plots/:plotId/private`, `/api/plots/:plotId/private`
- **Required Permission**: `private:read` (`FIRM_ADMIN` has implicit access; `FIRM_STAFF` requires explicit grant)
- **Path Parameters**: `plotId`
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "671cb80f2b3e5e4120a10050",
      "plotId": "671cb80f2b3e5e4120a10030",
      "firmId": "671cb80f2b3e5e4120a10010",
      "owner": {
        "name": "Rajesh Kumar",
        "phone": "+91 98111 22233",
        "email": "rajesh.kumar@example.com",
        "address": "House 14, Civil Lines, Jaipur",
        "notes": "Original owner. Willing to negotiate on prompt payment."
      },
      "source": {
        "sourceType": "agent",
        "contactName": "Sunil Sharma",
        "contactPhone": "+91 98222 33344",
        "commission": 1.0,
        "notes": "Direct referral from Jaipur Broker Association"
      },
      "createdAt": "2026-10-26T12:00:00.000Z",
      "updatedAt": "2026-10-26T12:30:00.000Z"
    },
    "timestamp": "2026-10-26T12:30:00.000Z"
  }
  ```
- **Error Statuses**:
  - `403 FORBIDDEN`: If staff member lacks `private:read` permission.
  - `404 NOT_FOUND`: If plot does not exist, belongs to another firm, or has no private record attached.

### 8.2 Upsert Private Plot Data (Full Replace or Create)
- **Method**: `PUT`
- **Routes**: `/api/v1/plots/:plotId/private`, `/api/plots/:plotId/private`
- **Required Permission**: `private:write`
- **Path Parameters**: `plotId`
- **Request Body**:
  ```json
  {
    "owner": {
      "name": "Rajesh Kumar",
      "phone": "+91 98111 22233",
      "email": "rajesh.kumar@example.com",
      "address": "House 14, Civil Lines, Jaipur",
      "notes": "Original allottee."
    },
    "source": {
      "sourceType": "direct",
      "contactName": "Self",
      "commission": 0
    }
  }
  ```
- **Success Status**: `200 OK`

### 8.3 Patch Private Plot Data (Partial Update)
- **Method**: `PATCH`
- **Routes**: `/api/v1/plots/:plotId/private`, `/api/plots/:plotId/private`
- **Required Permission**: `private:write`
- **Path Parameters**: `plotId`
- **Request Body**: Any subset of `owner` and `source` objects.
- **Success Status**: `200 OK`

### 8.4 Delete Private Plot Data
- **Method**: `DELETE`
- **Routes**: `/api/v1/plots/:plotId/private`, `/api/plots/:plotId/private`
- **Required Permission**: `private:write`
- **Path Parameters**: `plotId`
- **Success Status**: `200 OK`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Private data removed successfully"
    },
    "timestamp": "2026-10-26T12:35:00.000Z"
  }
  ```
