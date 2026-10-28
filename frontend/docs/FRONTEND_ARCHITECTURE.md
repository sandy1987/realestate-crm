# AGENT-Broker — Frontend Architecture & Technical Documentation

## 1. Overview & Stack

The AGENT-Broker frontend is a multi-tenant Real Estate CRM built with modern web standards:
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5 (Strict Mode enabled)
- **Styling**: Tailwind CSS v4
- **Iconography**: `lucide-react`
- **Utilities**: `clsx` and `tailwind-merge` for deterministic class composition
- **Testing**: Vitest for typed API client and utility regression testing

---

## 2. Directory Structure

```
frontend/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout with responsive AppShell wrapper
│   ├── globals.css                   # Tailwind v4 directives & root design tokens
│   ├── page.tsx                      # Polished operations dashboard
│   ├── colonies/page.tsx             # Colonies management placeholder (Phase FE-3)
│   ├── plots/page.tsx                # Plots inventory placeholder (Phase FE-3 & FE-4)
│   ├── firm/page.tsx                 # Firm administration placeholder (Phase FE-5)
│   ├── audit/page.tsx                # Compliance audit trail placeholder (Phase FE-6)
│   └── settings/page.tsx             # User & regional preferences placeholder (Phase FE-7)
├── components/
│   ├── layout/                       # Application shell and responsive navigation
│   │   ├── AppShell.tsx              # Responsive container managing mobile drawer state
│   │   ├── Sidebar.tsx               # Persistent desktop sidebar & mobile slide-out drawer
│   │   ├── Header.tsx                # Top header bar with breadcrumbs & user context
│   │   └── Breadcrumbs.tsx           # Dynamic segment-based path navigation
│   ├── ui/                           # Reusable UI primitives
│   │   ├── Button.tsx                # Multi-variant, accessible button with loading states
│   │   ├── Input.tsx                 # Form inputs with helper text, errors, & icon slots
│   │   ├── Card.tsx                  # Structured content cards (Header, Title, Body, Footer)
│   │   ├── Table.tsx                 # Responsive tabular data container with styled rows
│   │   ├── Dialog.tsx                # Accessible modal dialog with backdrop & keyboard traps
│   │   ├── Badge.tsx                 # Status indicator chips with dot indicators
│   │   ├── Loading.tsx               # Spinners and Skeleton animated placeholders
│   │   └── EmptyState.tsx            # Standardized empty inventory placeholders
│   └── shared/                       # Domain-specific reusable components
│       ├── MetricCard.tsx            # Dashboard KPI card with sample-data indicator
│       ├── StatusBadge.tsx           # Real estate status formatter (Plot, Colony, Firm, User)
│       └── PlaceholderPage.tsx       # Standardized view for upcoming implementation phases
├── lib/
│   ├── api/                          # Centralized Typed API Client
│   │   ├── client.ts                 # Fetch wrapper with timeouts, JSON parsing, & envelope unwrapping
│   │   └── errors.ts                 # ApiClientError class with error normalization
│   ├── config/
│   │   └── env.ts                    # Validated client-side environment configuration
│   └── utils/
│       ├── cn.ts                     # Class name merger (clsx + twMerge)
│       └── formatters.ts             # Currency (INR), area units (sqyd, sqft), and date formatters
├── types/                            # Shared TypeScript contracts matching backend schemas
│   ├── api.ts                        # Standard envelope (ApiResponse<T>, PaginationMeta)
│   ├── auth.ts                       # LoginResponse, RefreshTokenResponse, AuthSession
│   ├── user.ts                       # UserRole, UserPermission, UserSummary, FirmUser
│   ├── firm.ts                       # FirmSummary, FirmStatus
│   ├── colony.ts                     # Colony, ColonyStatus, CreateColonyInput
│   ├── plot.ts                       # Plot, PlotStatus, PlotDimensions (Public only; no private data)
│   ├── audit.ts                      # AuditLogEntry, AuditActor
│   └── index.ts                      # Barrel export of all type definitions
├── tests/                            # Frontend unit and smoke tests
│   ├── apiClient.test.ts             # API client, envelope unwrapping, & error handling tests
│   └── formatters.test.ts            # Formatting utility and class merging tests
├── .env.example                      # Safe development environment template
├── package.json                      # Scripts: dev, build, start, lint, typecheck, test
└── tsconfig.json                     # Strict TypeScript configuration with @/* path aliases
```

---

## 3. Visual Foundation & Design Tokens

- **Palette**: Restrained, professional slate palette (`bg-slate-50`, `text-slate-900`, `border-slate-200`) designed specifically for high-density enterprise CRM data.
- **Micro-Interactions**: Hover transitions, focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500`), smooth slide-in mobile drawers, and subtle scrollbars.
- **Sample Data Integrity**: In accordance with specification requirements, all mock metrics and demo inventory are strictly labeled with visible `Sample Data` badges to avoid misleading users.

---

## 4. Centralized Typed API Client

### Environment Configuration
The client reads `NEXT_PUBLIC_API_BASE_URL` from [lib/config/env.ts](file:///c:/Users/DESKTOP-32/Desktop/AGENT-Broker/frontend/lib/config/env.ts).
- Default: `http://localhost:5000/api`
- Strips any trailing slashes automatically.
- Prevents double-slash concatenation (e.g. `client.get('/plots')` properly calls `http://localhost:5000/api/plots`).

### Standard Response Envelope Handling
The backend wraps all success responses in:
```typescript
{
  success: true,
  data: T,
  meta?: PaginationMeta,
  timestamp?: string
}
```
The client unwraps the payload and returns `{ data: T, meta?: PaginationMeta, status: number }`.

### Error Normalization
If the server returns a non-2xx response:
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details?: [ ... ]
  }
}
```
The client normalizes this into an instance of `ApiClientError`:
- `error.status`: HTTP status code (e.g., 400, 401, 403, 404, 500)
- `error.code`: Backend error code string
- `error.message`: Human-readable message
- `error.details`: Array of validation error details
- `error.isNetworkError`: Flag for client-side connection failures

---

## 5. Security Invariants

1. **Client Isolation**: No backend database credentials, JWT secrets, or server-only environment variables are imported or exposed.
2. **Private Plot Data Protection**: The public `Plot` type in `types/plot.ts` strictly excludes seller/owner contact information, honoring the backend's `PlotPrivate` physical and logical separation.
3. **No Unauthenticated Business CRUD**: Feature screens for plots, colonies, firm admin, and audit logs are structured as placeholders pending authentication integration in Phase FE-2.
