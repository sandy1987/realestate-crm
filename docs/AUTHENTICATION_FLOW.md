# Authentication & Token Lifecycle Guide

This document details the authentication and session lifecycle implemented in the **AGENT-Broker Real Estate Multi-Tenant CRM Backend**.

It describes the exact token mechanics, Argon2id security guarantees, atomic rotation concurrency rules, replay-attack prevention, and best practices for frontend client integration.

---

## 1. Overview & Security Architecture

The authentication system employs dual-token session management:
1. **Access Token (Short-Lived JWT)**:
   - **Lifespan**: 15 minutes (`JWT_ACCESS_EXPIRY`, default `15m`).
   - **Signing Algorithm**: HMAC-SHA256 (`HS256`) signed with `JWT_ACCESS_SECRET`.
   - **Payload**:
     ```json
     {
       "sub": "671cb80f2b3e5e4120a10001",
       "role": "FIRM_ADMIN",
       "firmId": "671cb80f2b3e5e4120a10002",
       "iat": 1730000000,
       "exp": 1730000900
     }
     ```
   - **Storage Recommendation**: Store in client-side memory (JavaScript module state / React state). **Never store long-lived tokens in unencrypted localStorage or accessible cookies vulnerable to XSS.**
2. **Refresh Token (Opaque, High-Entropy Crypto Token)**:
   - **Lifespan**: 7 days (`JWT_REFRESH_EXPIRY`, default `7d`).
   - **Generation**: 32-byte cryptographically secure random bytes generated via `crypto.randomBytes(32).toString('hex')`.
   - **Database Persistence**: Stored in MongoDB collection `RefreshToken` as a **SHA-256 hash** (`tokenHash`). Raw tokens are never stored at rest.
   - **Rotation**: Strictly single-use with atomic database claiming.

---

## 2. Authentication Lifecycle Step-by-Step

### Step 1: User Login (`POST /api/auth/login`)
- **Action**: Client sends `{ email, password }`.
- **Server Verification**:
  1. Normalizes `email` to lowercase.
  2. Queries `User` collection. If user is not found, server executes a dummy Argon2id hash verification to ensure execution time is constant, preventing timing-based email enumeration.
  3. Verifies account status: if `isActive === false` or `isSuspended === true`, halts immediately with HTTP 403 `ACCOUNT_DISABLED`.
  4. Verifies password using Argon2id (`user.verifyPassword(password)`).
  5. Updates `user.lastLoginAt = new Date()`.
  6. Issues a new access token and creates an unrevoked `RefreshToken` session document.
  7. Emits an audit event (`auth.login.success` or `auth.login.failure`).
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "671cb80f2b3e5e4120a10001",
        "email": "agent@firm.com",
        "role": "FIRM_STAFF",
        "firmId": "671cb80f2b3e5e4120a10002",
        "firstName": "Sarah",
        "lastName": "Connor",
        "isActive": true,
        "isSuspended": false,
        "permissions": ["plots:read", "plots:write"],
        "lastLoginAt": "2026-10-26T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "7c9e1f4a8b2d...",
      "expiresAt": "2026-11-02T12:00:00.000Z"
    },
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
  ```

---

### Step 2: Accessing Protected Endpoints
- **Header**: `Authorization: Bearer <accessToken>`
- **Validation**:
  - `requireAuth` middleware verifies JWT signature and expiry.
  - Slices `sub` (user ID), queries `User.findById(sub)`.
  - Ensures user still exists, `isActive === true`, and `isSuspended === false`.
  - Attaches `req.user` to Express request.
- **Failures**:
  - Missing header / malformed token -> HTTP 401 `UNAUTHORIZED`.
  - Expired token -> HTTP 401 `TOKEN_EXPIRED`.
  - Account disabled after token issuance -> HTTP 403 `ACCOUNT_DISABLED`.

---

### Step 3: Refresh Token Rotation (`POST /api/auth/refresh`)
- **Action**: Client sends `{ refreshToken }`.
- **Atomic Concurrency Handling**:
  - Rotation is executed as an **atomic conditional single-document update**:
    ```javascript
    const claimedToken = await RefreshToken.findOneAndUpdate(
      {
        tokenHash,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      },
      {
        $set: { isRevoked: true }
      },
      { new: true }
    );
    ```
  - **Single Winner Guarantee**: Exactly one request can match `isRevoked: false` and claim the token.
  - **Losing Concurrent Requests**: Any concurrent request presenting the same token will fail the condition.
  - **Replay-Attack Detection**: If the token hash exists but `isRevoked: true`, the server detects token replay and rejects with HTTP 401 `TOKEN_REVOKED`.
- **Success Response**: Issues a new access token and a successor refresh token.

#### Frontend Implication & Coordination:
Because an old refresh token is invalidated the moment it is rotated, **frontend applications must coordinate refresh requests**:
- If multiple API calls fail simultaneously with HTTP 401, the frontend must queue subsequent refresh requests and wait for the in-flight refresh promise to resolve.
- If a refresh request fails with `TOKEN_REVOKED` or `TOKEN_EXPIRED`, the frontend must immediately wipe stored tokens and redirect to the login screen.

---

### Step 4: User Logout (`POST /api/auth/logout`)
- **Action**: Client sends `{ refreshToken }`.
- **Server Action**:
  - Computes `tokenHash = hashToken(refreshToken)`.
  - Sets `isRevoked: true` on the refresh token session document.
  - Records an `auth.logout` audit event.
- **Response**: HTTP 200 `{ success: true, data: { message: "Logged out successfully" } }`.

---

### Step 5: Password Change (`POST /api/auth/change-password`)
- **Action**: Authenticated user calls endpoint with `{ currentPassword, newPassword }`.
- **Server Action**:
  - Verifies `currentPassword` against stored Argon2id hash.
  - Hashes `newPassword` with Argon2id and saves the user.
  - **Global Session Invalidation**: Invokes `revokeAllUserTokens(userId)` which sets `isRevoked: true` on **all active refresh token documents** for that user.
  - Emits `auth.password.changed` audit event.
- **Frontend Action**: Prompt user to log in again with the newly configured password.

---

### Step 6: Account Suspension & Deactivation
- When a firm is suspended by `SUPER_ADMIN` or staff is deactivated/suspended by `FIRM_ADMIN`:
  1. The target user document has `isActive: false` or `isSuspended: true`.
  2. All active refresh-token sessions are immediately revoked via `revokeAllUserTokens`.
  3. Any subsequent API request (even with an unexpired access token) is rejected by `requireAuth` with HTTP 403 `ACCOUNT_DISABLED`.
