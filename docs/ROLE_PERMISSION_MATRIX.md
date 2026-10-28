# Role & Permission Matrix

This document defines the Role-Based Access Control (RBAC) and permission boundaries implemented in the **AGENT-Broker Real Estate Multi-Tenant CRM Backend**.

---

## 1. System Roles

The system recognizes three strictly segregated roles (`src/constants/roles.js`):

| Role Identifier | Context | Scope | Invariants |
|---|---|---|---|
| `SUPER_ADMIN` | Platform Level | Global (all firms) | Must have `firmId === null`. Prohibited from accessing tenant routes (`/api/firm/*`, `/api/colonies/*`, `/api/plots/*`). |
| `FIRM_ADMIN` | Tenant Level | Specific firm | Must have a valid non-null `firmId`. Sits at the root of a firm organization. Implicitly holds all staff permissions. |
| `FIRM_STAFF` | Tenant Level | Specific firm | Must have a valid non-null `firmId`. Permissions are explicitly granted via the `permissions` array on their user document. |

---

## 2. Platform Routes vs. Tenant Routes

A central security pillar of the architecture is the **strict architectural separation** between platform endpoints and tenant endpoints:

```
Platform Route Guard:
requireAuth + requirePlatformAdmin
(Allows only SUPER_ADMIN with firmId === null; Tenant users receive 403 FORBIDDEN)

Tenant Route Guard:
requireAuth + requireTenantContext
(Allows only FIRM_ADMIN and FIRM_STAFF; SUPER_ADMIN receives 403 FORBIDDEN)
```

### Critical Security Rule:
**Tenant identity is never determined by client parameters.**
A client cannot supply a `firmId` in headers, query strings, or body payloads to switch tenant context. The tenant context (`req.tenant.firmId`) is derived exclusively from the authenticated user record in MongoDB matching the verified JWT session.

---

## 3. Permission Catalogue (`PERMS`)

The granular permission strings for `FIRM_STAFF` are defined in `src/constants/permissions.js`:

| Permission String | Description | Default Grant for Staff |
|---|---|---|
| `plots:read` | View plots, search, and list public plot records | Denied (Explicit grant required) |
| `plots:write` | Create and update plots | Denied (Explicit grant required) |
| `plots:delete` | Soft delete / deactivate plots | Denied (Explicit grant required) |
| `plots:export` | Reserved for plot data export workflows | Denied (Explicit grant required) |
| `colonies:read` | View, search, and list colony records | Denied (Explicit grant required) |
| `colonies:write` | Create, update, and deactivate colonies | Denied (Explicit grant required) |
| `private:read` | Read confidential owner & referrer/source details | **Denied (Explicit grant required; HIGH PRIVILEGE)** |
| `private:write` | Create, update, and delete private owner details | **Denied (Explicit grant required; HIGH PRIVILEGE)** |
| `audit:read` | Query firm audit trail | **Denied (Explicit grant required; HIGH PRIVILEGE)** |

*Note: `FIRM_ADMIN` holds all of the above permissions implicitly by virtue of their role. Staff members only possess the permissions explicitly included in their `user.permissions` array.*

---

## 4. Comprehensive Feature & Route Permission Matrix

| Endpoint Route | HTTP Method | SUPER_ADMIN | FIRM_ADMIN | FIRM_STAFF | Required Permission / Rule |
|---|---|:---:|:---:|:---:|---|
| **Health Probes** | | | | | |
| `/health` | `GET` | ✅ | ✅ | ✅ | Public |
| `/health/ready` | `GET` | ✅ | ✅ | ✅ | Public (DB health check) |
| **Authentication** | | | | | |
| `/api/auth/login` | `POST` | ✅ | ✅ | ✅ | Public (Rate limited) |
| `/api/auth/refresh` | `POST` | ✅ | ✅ | ✅ | Public (With valid refresh token) |
| `/api/auth/logout` | `POST` | ✅ | ✅ | ✅ | Public (With valid refresh token) |
| `/api/auth/me` | `GET` | ✅ | ✅ | ✅ | `requireAuth` |
| `/api/auth/change-password` | `POST` | ✅ | ✅ | ✅ | `requireAuth` |
| **Platform Administration** | | | | | |
| `/api/platform/firms` | `POST` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| `/api/platform/firms` | `GET` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| `/api/platform/firms/:id` | `GET` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| `/api/platform/firms/:id/suspend` | `POST` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| `/api/platform/firms/:id/activate` | `POST` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| `/api/platform/audit` | `GET` | ✅ | ❌ (403) | ❌ (403) | `SUPER_ADMIN` only |
| **Tenant Firm Operations** | | | | | |
| `/api/firm/me` | `GET` | ❌ (403) | ✅ | ✅ | Any member of active firm |
| `/api/firm/audit` | `GET` | ❌ (403) | ✅ | 🔒 | `audit:read` (Staff requires explicit grant) |
| **Firm User Administration** | | | | | |
| `/api/firm/users` | `POST` | ❌ (403) | ✅ | ❌ (403) | `FIRM_ADMIN` only |
| `/api/firm/users` | `GET` | ❌ (403) | ✅ | ❌ (403) | `FIRM_ADMIN` only |
| `/api/firm/users/:id` | `GET` | ❌ (403) | ✅ | ❌ (403) | `FIRM_ADMIN` only |
| `/api/firm/users/:id` | `PATCH` | ❌ (403) | ✅ | ❌ (403) | `FIRM_ADMIN` only |
| `/api/firm/users/:id/status` | `PATCH` | ❌ (403) | ✅ | ❌ (403) | `FIRM_ADMIN` only (Cannot modify self) |
| **Colony Management** | | | | | |
| `/api/colonies` | `POST` | ❌ (403) | ✅ | 🔒 | `colonies:write` |
| `/api/colonies` | `GET` | ❌ (403) | ✅ | 🔒 | `colonies:read` |
| `/api/colonies/:id` | `GET` | ❌ (403) | ✅ | 🔒 | `colonies:read` |
| `/api/colonies/:id` | `PATCH` | ❌ (403) | ✅ | 🔒 | `colonies:write` |
| `/api/colonies/:id` | `DELETE` | ❌ (403) | ✅ | 🔒 | `colonies:write` |
| **Plot Management** | | | | | |
| `/api/plots` | `POST` | ❌ (403) | ✅ | 🔒 | `plots:write` |
| `/api/plots` | `GET` | ❌ (403) | ✅ | 🔒 | `plots:read` |
| `/api/plots/:id` | `GET` | ❌ (403) | ✅ | 🔒 | `plots:read` |
| `/api/plots/:id` | `PATCH` | ❌ (403) | ✅ | 🔒 | `plots:write` |
| `/api/plots/:id` | `DELETE` | ❌ (403) | ✅ | 🔒 | `plots:delete` |
| **Private Plot Data** | | | | | |
| `/api/plots/:id/private` | `GET` | ❌ (403) | ✅ | 🔒 | `private:read` |
| `/api/plots/:id/private` | `PUT` | ❌ (403) | ✅ | 🔒 | `private:write` |
| `/api/plots/:id/private` | `PATCH` | ❌ (403) | ✅ | 🔒 | `private:write` |
| `/api/plots/:id/private` | `DELETE` | ❌ (403) | ✅ | 🔒 | `private:write` |

**Legend:**
- ✅ : Full access
- ❌ (403) : Denied by role or tenant isolation guard
- 🔒 : Permitted only if the granular permission is present in staff user's `permissions` array
