# AGENT-Broker — Real Estate Multi-Tenant CRM Backend

A high-performance, multi-tenant real estate CRM backend built with Node.js 20+, Express, MongoDB Atlas with Mongoose, and JavaScript ES Modules.

Features strict tenant isolation, Argon2id authentication, atomic refresh-token rotation, colony and plot inventory management, private owner/source privacy separation, granular RBAC, and structured audit logging.

---

## Architecture & Technology Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB Atlas with Mongoose
- **Validation**: Zod schema validation
- **Authentication**: JWT access tokens + Argon2id password hashing + atomic refresh token sessions
- **Logging**: Pino structured HTTP and application logging
- **Security**: Helmet security headers, CORS origin whitelisting, global & auth rate limiting
- **Testing**: Vitest, Supertest, MongoDB Memory Server

---

## API Documentation & Explorer

Interactive documentation and technical guides are available:

- **Swagger UI Interactive Explorer**: [`http://localhost:5000/api/docs`](http://localhost:5000/api/docs)
- **OpenAPI 3.1 JSON Specification**: [`http://localhost:5000/api/docs/json`](http://localhost:5000/api/docs/json)
- **OpenAPI 3.1 YAML Document**: [`docs/openapi.yaml`](docs/openapi.yaml)

### Comprehensive Integration Guides:
1. **[API Inventory (`docs/API_INVENTORY.md`)](docs/API_INVENTORY.md)**: Exhaustive catalog of every endpoint, method, route alias, body schema, query parameter, and status code.
2. **[Authentication & Token Lifecycle (`docs/AUTHENTICATION_FLOW.md`)](docs/AUTHENTICATION_FLOW.md)**: Login, token rotation, atomic concurrency guarantees, replay detection, and logout workflows.
3. **[Role & Permission Matrix (`docs/ROLE_PERMISSION_MATRIX.md`)](docs/ROLE_PERMISSION_MATRIX.md)**: Platform vs. tenant route guards, role boundaries (`SUPER_ADMIN`, `FIRM_ADMIN`, `FIRM_STAFF`), and granular permissions.
4. **[Frontend Integration Guide (`docs/FRONTEND_INTEGRATION_GUIDE.md`)](docs/FRONTEND_INTEGRATION_GUIDE.md)**: Step-by-step Axios/Fetch integration flows with real-world payloads.
5. **[API Conventions & Error Standards (`docs/API_CONVENTIONS.md`)](docs/API_CONVENTIONS.md)**: Standard success/error envelopes, error code mapping, pagination, and video URL validation.

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure required variables:
- `PORT`: Server port (default: `5000`)
- `NODE_ENV`: `development` | `production` | `test`
- `MONGODB_URI`: MongoDB connection string
- `JWT_ACCESS_SECRET`: Secret key (min 32 characters)
- `JWT_REFRESH_SECRET`: Secret key (min 32 characters)
- `JWT_ACCESS_EXPIRY`: e.g. `15m`
- `JWT_REFRESH_EXPIRY`: e.g. `7d`
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowed origins or `*`

### 3. Installation & Running
```bash
# Install dependencies
npm install

# Start development server with file watch
npm run dev

# Start production server
npm start
```

### 4. Running Automated Tests
Tests execute against an isolated in-memory MongoDB server:
```bash
# Run complete test suite (Unit, Integration, Security, Documentation)
npm test

# Run tests in watch mode
npm run test:watch
```

---

## Frontend Application

The Next.js 16 frontend is located in the [`frontend/`](frontend) directory:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

For frontend testing and quality checks:
```bash
npm run typecheck  # TypeScript compiler check
npm run lint       # ESLint check
npm test           # Vitest unit test suite
npm run build      # Next.js production build
```

