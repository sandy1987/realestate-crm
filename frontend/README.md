# AGENT-Broker — Frontend Application

Next.js 16 App Router frontend for the **AGENT-Broker Real Estate Multi-Tenant CRM**.

## Prerequisites

- Node.js 20+
- npm 10+
- Running AGENT-Broker backend (typically at `http://localhost:5000`)

---

## Local Development Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   *Edit `.env.local` if your backend runs on a port other than 5000.*

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server with hot-reloading |
| `npm run build` | Builds the optimized production bundle |
| `npm run start` | Runs the built production server |
| `npm run lint` | Runs ESLint 9 checks across all TypeScript files |
| `npm run typecheck` | Validates TypeScript types across the codebase (`tsc --noEmit`) |
| `npm test` | Runs the Vitest automated unit test suite |

---

## Architecture

See [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) for full architectural documentation, design token specifications, and typed API client integration details.
