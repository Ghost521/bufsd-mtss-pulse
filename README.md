<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy BUFSD MTSS Pulse (TanStack Start)

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js 22+

1. Install dependencies:
   `npm install`
2. Add your Gemini key to `.env.local`:
   `GEMINI_API_KEY=your_key_here`
3. Configure Convex persistence in `.env.local`:
   - `CONVEX_USE_BACKEND=true`
   - `CONVEX_CLOUD_URL=https://calculating-rook-861.convex.cloud`
   - `CONVEX_ACTIONS_URL=https://calculating-rook-861.convex.site`
4. Configure WorkOS auth in `.env.local` (optional but recommended for production auth):
   - `WORKOS_API_KEY=...`
   - `WORKOS_CLIENT_ID=...`
   - `WORKOS_COOKIE_PASSWORD=...`
   - `WORKOS_PROVIDER=authkit` (or your provider)
   - `WORKOS_CONNECTION_ID=...` (optional)
   - `APP_BASE_URL=http://localhost:3000`
   - `WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback`
   - `WORKOS_PROVISION_AUTO_CREATE=true`
   - `WORKOS_PROVISION_DEFAULT_ROLE=teacher`
   - `WORKOS_PROVISION_DEFAULT_SCOPE_TYPE=school`
   - `WORKOS_PROVISION_DEFAULT_SCOPE_ID=sch-ne`
   - `MTSS_ALLOW_IMPERSONATION=false`
   - `TENANT_AUTH_STORE_KEY=__tenant_auth__`
   - If `WORKOS_PROVISION_AUTO_CREATE=false`, WorkOS user email must already match a local tenant user email.
   - If using WorkOS demo mode across multiple origins, you can leave `WORKOS_REDIRECT_URI` unset and the app will derive it from the incoming request origin for `/api/auth/login`.
5. Deploy Convex functions (first time and when schema/functions change):
   - `npm run convex:dev` (local dev + codegen)
   - `npm run convex:deploy` (publish to cloud)
6. Run the app:
   `npm run dev`

TanStack Start now serves both UI routes and API routes in one process.
Dev server is pinned to `http://localhost:3000` (`strictPort` enabled). If port `3000` is busy, stop the other process first and rerun.

## Migration Notes

- App framework: TanStack Start
- Routing: TanStack Router file-based routes under `src/routes`
- Query state: TanStack Query
- Table UI: TanStack Table (see `/roster-table`)
- API routes: Start server routes (including `/api/ai/*`)
- Optimistic updates: `/roster-table` now supports optimistic create/update/delete with automatic rollback on failure.
- Multi-tenant + RBAC foundation: org/district/school context and server-enforced role checks are now active on student and AI APIs.
- Tenant auth state persistence: org/district/school/users/memberships/groups/invites are now loaded from persisted storage (Convex-backed when enabled) instead of static in-memory constants.
- Persistence: Convex-backed audit persistence with automatic memory fallback if Convex functions are unavailable.

## Student API (Compatibility Layer)

- `GET /api/students?scope=master|class`
- `POST /api/students` (creates master roster student)
- `PATCH /api/students?id=<studentId>` (updates master roster student)
- `DELETE /api/students?id=<studentId>` (deletes master roster student)

All student API operations now enforce active tenant context and field-level RBAC server-side.

## Tenant + Session API

- `GET /api/health`: returns health plus current session, effective roles, contexts, available users, and persistence diagnostics.
- `POST /api/health`: updates active context and sets session cookies.
- `GET /api/auth/login`: redirects to WorkOS hosted auth.
- `GET /api/auth/callback`: WorkOS OAuth callback.
- `GET /api/auth/logout`: clears local cookies and logs out of WorkOS session.
- When WorkOS is enabled, user switching is disabled by default (`MTSS_ALLOW_IMPERSONATION=false`) and identity is mapped from WorkOS user email.
- JIT provisioning: if no local user mapping exists, app can auto-provision a local user and default membership (`WORKOS_PROVISION_*` vars), prioritizing pending invite scope when available.
  - Request body example:
    - `{ "userId": "u-principal-ne" }`
    - `{ "context": { "organizationId": "org-bufsd", "districtId": "dist-bufsd", "schoolId": "sch-ne" } }`

Use the top navigation controls to sign in/out and change active tenant context in the running app.

## Phase 3 (Convex)

- Convex schema: `convex/schema.ts`
- Convex functions: `convex/phase3.ts`
- Backing functions used:
  - `phase3:getTenantCollection`
  - `phase3:setTenantCollection`
  - `phase3:appendAuditEntry`
  - `phase3:countAuditEntries`

## Quality Checks

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`
