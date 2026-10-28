# Frontend Integration Guide

This guide provides concrete, step-by-step integration sequences for frontend developers connecting web or mobile applications to the **AGENT-Broker Real Estate Multi-Tenant CRM Backend**.

All HTTP examples and JSON payloads are derived from verified server-side Zod validation schemas and Mongoose models.

---

## Architecture Conventions & Best Practices

1. **Base URL**:
   - Production / Staging: `https://api.yourdomain.com/api` (or `/api/v1`)
   - Local Development: `http://localhost:5000/api`
2. **Standard Headers**:
   ```http
   Content-Type: application/json
   Accept: application/json
   Authorization: Bearer <accessToken>
   ```
3. **Token Storage Recommendation**:
   - **Access Token**: Store in application memory (e.g. React/Vue context or Pinia/Redux store). Never store access tokens in `localStorage`.
   - **Refresh Token**: Store securely in memory or in an `HttpOnly` secure cookie if supported by reverse proxy; if stored in web storage, ensure aggressive XSS sanitization and wipe immediately upon logout or authorization failure.

---

## Flow A: Authentication & Token Refresh

### 1. User Login
Send user credentials to `/api/auth/login`.

**Request**:
```http
POST /api/auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "agent.smith@apexrealestate.com",
  "password": "StrongPassword123!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671cb80f2b3e5e4120a10001",
      "email": "agent.smith@apexrealestate.com",
      "role": "FIRM_STAFF",
      "firmId": "671cb80f2b3e5e4120a10010",
      "firstName": "Agent",
      "lastName": "Smith",
      "isActive": true,
      "isSuspended": false,
      "permissions": ["plots:read", "plots:write", "colonies:read"]
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f3d1e4c7a2b9012345678abcdef...",
    "expiresAt": "2026-11-02T12:00:00.000Z"
  },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

### 2. Token Refresh Strategy (Axios Interceptor Example)
The backend enforces **single-use refresh token rotation with atomic claiming**. If two requests try to refresh the same token concurrently, one will succeed and the other will receive `TOKEN_REVOKED`.

Therefore, the frontend **must queue concurrent 401s** and execute a single refresh operation:

```typescript
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = getStoredRefreshToken();
        const res = await axios.post('/api/auth/refresh', {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = res.data.data;
        saveTokens(accessToken, newRefreshToken);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearTokensAndRedirectToLogin();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### 3. User Logout
Always call `/api/auth/logout` before clearing tokens in client state:
```http
POST /api/auth/logout HTTP/1.1
Content-Type: application/json

{
  "refreshToken": "8f3d1e4c7a2b9012345678abcdef..."
}
```

---

## Flow B: Platform Administration (`SUPER_ADMIN`)

*Accessible only by accounts with `role: "SUPER_ADMIN"` and `firmId: null`.*

### 1. Provision a New Firm
```http
POST /api/platform/firms HTTP/1.1
Authorization: Bearer <superAdminAccessToken>
Content-Type: application/json

{
  "name": "Zenith Realty Group",
  "slug": "zenith-realty-group",
  "contactEmail": "info@zenithrealty.com",
  "contactPhone": "+91 99887 76655",
  "settings": {
    "allowedVideoProviders": ["youtube", "vimeo"],
    "defaultCurrency": "INR"
  },
  "adminEmail": "principal@zenithrealty.com",
  "adminPassword": "TemporaryPassword123!",
  "adminFirstName": "Zenith",
  "adminLastName": "Principal"
}
```

### 2. Suspend an Errant Firm
Immediately revokes sessions for all staff of that firm:
```http
POST /api/platform/firms/671cb80f2b3e5e4120a10010/suspend HTTP/1.1
Authorization: Bearer <superAdminAccessToken>
```

---

## Flow C: Firm User Administration (`FIRM_ADMIN`)

*Firm administrators manage staff strictly inside their own firm.*

### 1. Create a Staff User
Assign specific permissions from the approved permission catalogue:
```http
POST /api/firm/users HTTP/1.1
Authorization: Bearer <firmAdminAccessToken>
Content-Type: application/json

{
  "email": "field.agent@apexrealestate.com",
  "password": "AgentPassword123!",
  "firstName": "Ravi",
  "lastName": "Verma",
  "permissions": [
    "plots:read",
    "plots:write",
    "colonies:read"
  ]
}
```

### 2. Grant Private Data Access Permission
To authorize a trusted staff member to view confidential plot owner information:
```http
PATCH /api/firm/users/671cb80f2b3e5e4120a10001 HTTP/1.1
Authorization: Bearer <firmAdminAccessToken>
Content-Type: application/json

{
  "permissions": [
    "plots:read",
    "plots:write",
    "colonies:read",
    "private:read"
  ]
}
```

### 3. Deactivate a Staff Member
Immediately revokes their refresh-token sessions and rejects subsequent API calls:
```http
PATCH /api/firm/users/671cb80f2b3e5e4120a10001/status HTTP/1.1
Authorization: Bearer <firmAdminAccessToken>
Content-Type: application/json

{
  "isActive": false,
  "isSuspended": true
}
```

---

## Flow D: Colony Management

*Colonies organize plots into townships, sectors, or project areas.*

### 1. Create a Colony
```http
POST /api/colonies HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Emerald Heights Phase 2",
  "location": "Bani Park, Jaipur",
  "description": "High-end residential enclave"
}
```

### 2. Search & List Colonies
```http
GET /api/colonies?search=Emerald&page=1&limit=10 HTTP/1.1
Authorization: Bearer <token>
```

---

## Flow E: Plot Management

### 1. Plot Field Conventions:
- **`sizeUnit`**: Supported values are `sqft`, `sqyd` (square yards/gaj), `sqm`, `marla`, `kanal`, `acre`, and `gaj`.
- **`rateType`**:
  - `total`: `rate` represents the total plot price.
  - `per_unit`: `rate` represents the price per unit (e.g., ₹45,000 per sqyd). The calculated `price` attribute is automatically derived as `size * rate`.
- **`currency`**: Default is `INR` (Indian Rupees).
- **`videoUrl`**: Approved video URLs from `youtube` or `vimeo`.

### 2. Create a Plot
```http
POST /api/plots HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "plotRef": "E-104",
  "colonyId": "671cb80f2b3e5e4120a10020",
  "size": 200,
  "sizeUnit": "sqyd",
  "rate": 50000,
  "rateType": "per_unit",
  "currency": "INR",
  "type": "residential",
  "status": "available",
  "description": "East-facing plot adjacent to park",
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "videoProvider": "youtube"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "671cb80f2b3e5e4120a10030",
    "firmId": "671cb80f2b3e5e4120a10010",
    "plotRef": "E-104",
    "colonyId": "671cb80f2b3e5e4120a10020",
    "size": 200,
    "sizeUnit": "sqyd",
    "rate": 50000,
    "rateType": "per_unit",
    "price": 10000000,
    "currency": "INR",
    "type": "residential",
    "status": "available",
    "isActive": true,
    "video": {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "provider": "youtube"
    },
    "createdAt": "2026-10-26T12:00:00.000Z"
  },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

*Note: The response never contains owner names or private contact numbers.*

---

## Flow F: Private Plot Owner / Source Data

*Restricted strictly to users with `private:read` or `private:write` permissions.*

### 1. View Private Information
```http
GET /api/plots/671cb80f2b3e5e4120a10030/private HTTP/1.1
Authorization: Bearer <tokenWithPrivateReadPermission>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "671cb80f2b3e5e4120a10050",
    "plotId": "671cb80f2b3e5e4120a10030",
    "firmId": "671cb80f2b3e5e4120a10010",
    "owner": {
      "name": "Mahesh Chandra",
      "phone": "+91 98290 11223",
      "email": "mahesh.c@example.com",
      "address": "B-42, Tilak Nagar, Jaipur",
      "notes": "Title deed verified with Sub-Registrar office"
    },
    "source": {
      "sourceType": "agent",
      "contactName": "Deepak Mehta",
      "contactPhone": "+91 94140 55667",
      "commission": 1.0,
      "notes": "Key contact for site visits"
    },
    "createdAt": "2026-10-26T12:00:00.000Z",
    "updatedAt": "2026-10-26T12:00:00.000Z"
  },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

### 2. Frontend Security & Privacy Guidance:
- **UI Masking**: If a user does not have `private:read` permission in their `user.permissions` array, do not display the "Owner Details" tab or card.
- **Handling 403 Forbidden**: If the backend returns 403 `FORBIDDEN`, gracefully inform the user that their account role does not have authorization to view seller contact details.
- **No Client Caching**: Never persist private owner information into unencrypted local caches or browser storage.

---

## Flow G: Querying Audit Logs

Retrieve security events and business transactions scoped to your firm:
```http
GET /api/firm/audit?eventType=plot.created&page=1&limit=20 HTTP/1.1
Authorization: Bearer <firmAdminToken>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "671cb80f2b3e5e4120a10060",
      "eventType": "plot.created",
      "actorUserId": "671cb80f2b3e5e4120a10001",
      "actorRole": "FIRM_ADMIN",
      "firmId": "671cb80f2b3e5e4120a10010",
      "resourceType": "plot",
      "resourceId": "671cb80f2b3e5e4120a10030",
      "action": "create",
      "outcome": "success",
      "metadata": {
        "plotRef": "E-104",
        "size": 200,
        "sizeUnit": "sqyd"
      },
      "createdAt": "2026-10-26T12:00:00.000Z"
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
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```
