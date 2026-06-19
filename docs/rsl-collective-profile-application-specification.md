# RSL Collective Profile Application Specification

## 1. Objective

Build an implementation plan and supervise the implementation of a standalone dashboard web application, using Codex, that extends the RSL Collective website at `https://rslcollective.org`.

The dashboard lets a publisher company representative join for free, log in, and create or edit the publisher profile for the company they represent.

The product is a focused authenticated SPA. It is separate from the public RSL Collective website.

The public RSL Collective website links users into the dashboard application through two buttons:

```html
<a href="https://dashboard.rslcollective.org/register">Join for free</a>
<a href="https://dashboard.rslcollective.org/login">Login</a>
```

The public website does not implement authentication logic, does not construct WorkOS/AuthKit URLs, and does not include WorkOS parameters in static links.

The dashboard application complements the RSL Collective public website and should share minimal styling, including the RSL Collective name/logo and a simple brand-aligned Mantine palette.

Use agentic coding practices that keep Codex focused on this specification. The goal is to move quickly for a single-developer workflow while still producing a reliable application with sound operational practices, uptime, and a clean path for deployment.

## 2. Product Scope

Phase one includes only:

1. WorkOS AuthKit registration/login.
2. Dashboard `/register` route that starts the AuthKit sign-up flow.
3. Dashboard `/login` route that starts the AuthKit sign-in flow.
4. Auth callback handling.
5. Local session creation.
6. Root redirect behavior.
7. Authenticated dashboard shell.
8. Account Information view.
9. Company Profile view.
10. Create/edit one company profile.
11. D1 schema for users, companies, and sessions.
12. Validation and basic tests.

## 3. Explicit Non-Goals

Do not implement:

* custom password handling
* custom email verification
* custom password reset
* multi-company membership
* WorkOS Organizations
* full onboarding workflow
* public marketing site
* Markdown content system
* documentation pages
* a custom design system

## 4. Primary User Flows

### 4.1 Join for free

A new user visits the public RSL Collective website at:

```txt
https://rslcollective.org
```

and clicks:

```html
<a href="https://dashboard.rslcollective.org/register">Join for free</a>
```

The dashboard application receives the user at:

```txt
https://dashboard.rslcollective.org/register
```

That route generates a WorkOS/AuthKit authorization URL server-side and redirects the browser to the hosted AuthKit UI, requesting the sign-up screen where supported.

After authentication, WorkOS redirects the user back to:

```txt
https://dashboard.rslcollective.org/auth/callback
```

The application validates the callback, creates or updates the local user, creates a local session, sets the HTTP-only session cookie, and redirects the user to:

```txt
/dashboard
```

If the authenticated user has no company profile, the dashboard opens directly on the empty Company Profile view.

### 4.2 Login

A returning user visits the public RSL Collective website at:

```txt
https://rslcollective.org
```

and clicks:

```html
<a href="https://dashboard.rslcollective.org/login">Login</a>
```

The dashboard application receives the user at:

```txt
https://dashboard.rslcollective.org/login
```

That route generates a WorkOS/AuthKit authorization URL server-side and redirects the browser to the hosted AuthKit UI, requesting the sign-in screen where supported.

After authentication, WorkOS redirects the user back to:

```txt
https://dashboard.rslcollective.org/auth/callback
```

The application validates the callback, creates or updates the local user, creates a local session, sets the HTTP-only session cookie, and redirects the user to:

```txt
/dashboard
```

If the user already has a company profile, the dashboard loads the existing Account Information and Company Profile views.

### 4.3 Direct visit to root

If a user visits:

```txt
https://dashboard.rslcollective.org/
```

the application does not show a separate public landing page.

Root behavior:

* If the user has a valid authenticated session, redirect to `/dashboard`.
* If the user does not have a valid authenticated session, redirect to `/login`.

### 4.4 Create company profile

An authenticated user with no company profile fills out the company profile form and saves it.

The application creates the company record and associates the authenticated user with that company as `owner`.

A new user cannot proceed into any later onboarding or licensing workflow in phase one. The only required post-registration action is creating or editing the company profile.

### 4.5 Edit company profile

An authenticated user with an existing company profile edits the company profile and saves changes.

The application updates the company associated with the authenticated user.

## 5. Technology Stack

Use the following stack:

* React 19
* React DOM
* React Router DOM v7
* TanStack React Query v5
* Mantine v8
* Lucide React
* Vite
* Cloudflare Workers
* Wrangler
* Hono
* Zod v4
* TypeScript
* Vitest
* Testing Library
* jsdom
* pnpm

### 5.1 Vinxi

Do not include Vinxi by default.

Use plain Vite for the SPA and Hono for the Worker unless there is a concrete reason to add Vinxi. Vinxi may be reconsidered only if the team needs a full-stack app composition layer already proven in another internal application.

## 6. Application Architecture

Use a single repo with a browser SPA and a Worker API.

A single Cloudflare Worker should serve both:

1. The SPA assets.
2. The Hono API/auth routes.

Recommended structure:

```txt
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    theme.ts

  pages/
    DashboardPage.tsx

  components/
    layout/
      DashboardShell.tsx

    dashboard/
      AccountTab.tsx
      CompanyProfileTab.tsx

    forms/
      CompanyProfileForm.tsx

  api/
    client.ts
    session.ts
    company.ts

  schemas/
    company.ts

worker/
  index.ts

  routes/
    auth.ts
    session.ts
    company.ts

  lib/
    db.ts
    session.ts
    workos.ts
    csrf.ts
    responses.ts
    assets.ts
    time.ts
    ids.ts

migrations/
  0001_core.sql

public/
  favicon.svg

tests/
```

There is no separate public marketing landing page in the dashboard app. The dashboard root redirects based on authentication state.

## 7. Routing

### 7.1 Browser routes

Handled by React Router after the SPA is loaded:

```txt
/dashboard
```

Optional nested dashboard routes if useful:

```txt
/dashboard/account
/dashboard/profile
```

### 7.2 Worker/auth routes

Handled by Hono:

```txt
GET  /
GET  /register
GET  /login
GET  /auth/callback
POST /logout
```

Root route behavior:

```txt
GET /
```

* If authenticated, redirect to `/dashboard`.
* If unauthenticated, redirect to `/login`.

### 7.3 API routes

Handled by Hono:

```txt
GET /api/session
GET /api/company
PUT /api/company
```

### 7.4 Cloudflare Worker-first routing

Workers Assets must be configured so server routes invoke the Worker before SPA asset fallback.

Configure SPA asset fallback for browser routes, but force the Worker to run first for:

```txt
/
/register
/login
/auth/*
/logout
/api/*
```

Recommended Wrangler assets configuration:

```jsonc
{
  "assets": {
    "directory": "./dist/",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS",
    "run_worker_first": [
      "/",
      "/register",
      "/login",
      "/auth/*",
      "/logout",
      "/api/*"
    ]
  }
}
```

`/dashboard` and nested dashboard routes should be served by the SPA fallback.

Auth routes, API routes, logout, and root must invoke the Worker first. The WorkOS callback route must not be swallowed by the SPA fallback.

## 8. WorkOS/AuthKit

Use WorkOS AuthKit hosted authentication.

Production configuration:

```txt
AuthKit domain: WorkOS default hosted AuthKit for initial production deploy
Email sender: WorkOS default email sender for initial production deploy
Dashboard/app domain: dashboard.rslcollective.org
Callback URL: https://dashboard.rslcollective.org/auth/callback
Sign-in endpoint: https://dashboard.rslcollective.org/login
Sign-out redirect: https://dashboard.rslcollective.org/login
App homepage: https://dashboard.rslcollective.org/
```

Local callback:

```txt
http://localhost:8787/auth/callback
```

Local auth testing should use Wrangler and the Worker dev server at:

```txt
http://localhost:8787
```

Vite-only dev may be used for UI-only work, but WorkOS callback testing requires the Worker.

Auth rules:

* WorkOS handles registration/login.
* WorkOS handles password reset.
* WorkOS handles email verification.
* Do not store passwords.
* Do not implement custom email delivery.
* Do not expose WorkOS secrets to the browser.
* The application may use WorkOS/AuthKit parameters such as screen hints, if supported, to land users on the registration screen from `/register` and the login screen from `/login`.

### 8.1 WorkOS custom domain and email domain

The first production deploy uses WorkOS default hosted AuthKit and the default WorkOS email sender.

`login.rslcollective.org` may be configured later as an optional WorkOS AuthKit custom domain for branding.

The email sender `no-reply@mail.rslcollective.org` may be configured later as an optional custom WorkOS email sender/domain for branding.

If those optional custom domains are added later and DNS is managed in Cloudflare, their WorkOS CNAME records must be DNS-only, not proxied.

### 8.2 Worker runtime and SDK compatibility

Use the current `@workos-inc/node` package version with Worker/edge runtime support.

If the selected WorkOS SDK version requires Node compatibility, enable `nodejs_compat` in Wrangler and verify all of the following before implementing application logic:

```txt
pnpm check
pnpm build
pnpm test
wrangler dev
```

Do not use stale Express-only or Node-server-only AuthKit examples.

### 8.3 `GET /register`

Starts the WorkOS/AuthKit hosted authentication flow for a new user.

Implementation:

* Generate a WorkOS authorization URL server-side.
* Use `provider: "authkit"`.
* Use `screen_hint: "sign-up"` where supported.
* Include the configured callback URL.
* Include a signed or otherwise validated `state` value.
* Redirect the browser to the generated WorkOS/AuthKit URL.

### 8.4 `GET /login`

Starts the WorkOS/AuthKit hosted authentication flow for a returning user.

Implementation:

* Generate a WorkOS authorization URL server-side.
* Use `provider: "authkit"`.
* Use `screen_hint: "sign-in"` where supported.
* Include the configured callback URL.
* Include a signed or otherwise validated `state` value.
* Redirect the browser to the generated WorkOS/AuthKit URL.

### 8.5 Auth state

The `state` value must include:

* nonce
* issue timestamp
* intended flow, either `register` or `login`
* optional `returnTo`

The state must be either:

1. HMAC-signed with `SESSION_SECRET`, or
2. stored server-side with a short expiration.

The callback must reject missing, expired, malformed, unsigned, tampered, or mismatched state.

Do not accept arbitrary `returnTo` URLs. If `returnTo` is implemented, it must be a same-origin relative path.

### 8.6 `GET /auth/callback`

Handles the WorkOS/AuthKit callback.

Implementation:

* Validate the returned `state`.
* Exchange the authorization code.
* Create or update the local user row.
* Create a D1-backed local session.
* Set the HTTP-only session cookie.
* Redirect to `/dashboard`.

### 8.7 `POST /logout`

Logs the user out.

Implementation:

* Require a valid same-origin `Origin` header in production.
* Invalidate the D1 session.
* Clear the HTTP-only session cookie.
* Obtain the WorkOS logout URL where available.
* Redirect through WorkOS logout.
* If WorkOS logout is not available in local development, fall back to redirecting to `/login`.

`GET /logout` should not be implemented in phase one.

## 9. WorkOS Organizations

Phase one does not use WorkOS Organizations.

WorkOS is used only for user authentication. The RSL Collective D1 database is the source of truth for:

* company profiles
* `users.company_id`
* user role
* session state

WorkOS Organizations may be evaluated later for invitations, enterprise SSO, team membership, or more advanced B2B account administration.

## 10. Session Model

Use server-side sessions backed by D1.

Browser cookie:

```txt
__Host-rsl_dashboard_session
```

Production cookie flags:

```txt
HttpOnly
Secure
SameSite=Lax
Path=/
```

The cookie must not set a `Domain` attribute.

Session duration:

```txt
30-day rolling session
```

Rules:

* Store only a random high-entropy opaque session token in the browser.
* Hash the token before storing it in D1.
* Never store the raw session token in D1.
* Store only an HMAC-SHA-256 or SHA-256 hash of the token in D1.
* Sessions expire after 30 days.
* Authenticated activity may refresh the rolling expiration.
* Expired sessions must be rejected.
* Sign-out invalidates the session in D1 and clears the cookie.
* Mutating requests must require a matching `Origin` header in production.
* Do not rely on `SameSite=Lax` as the only CSRF defense.

## 11. CSRF and Origin Policy

Use deterministic same-origin protection for phase one.

All mutating requests must require `Origin` to match `DASHBOARD_BASE_URL`.

Affected routes:

```txt
POST /logout
PUT /api/company
```

Production behavior:

* Reject missing `Origin`.
* Reject mismatched `Origin`.
* Accept only the configured dashboard origin.

Development behavior:

* Allow `http://localhost:8787`.
* Allow other explicitly configured local origins only if needed for development.

A separate CSRF token mechanism may be added later, but phase one should not implement multiple partial CSRF systems.

## 12. User and Company Model

The company is the core entity.

Users exist only to manage one company profile.

Rules:

* A user can belong to only one company.
* A company may eventually have multiple users.
* Store the company association directly on `users.company_id`.
* Do not create a `company_members` table in phase one.
* Store the user’s role directly on `users.role`.
* Phase one uses only the `owner` role in UI and authorization logic.
* The first authenticated user who creates a company becomes `owner`.
* If a user already has `company_id`, they cannot create another company.
* All company reads and writes derive the company from the authenticated user’s `users.company_id`.
* Never trust a client-provided company ID.
* Creating a company and attaching it to the authenticated user must be atomic.

## 13. D1 Schema

Phase-one tables:

* `companies`
* `users`
* `sessions`

Baseline migration:

```sql
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT,
  company_type TEXT,
  primary_contact_name TEXT NOT NULL,
  primary_contact_email TEXT NOT NULL,
  billing_contact_email TEXT,
  country TEXT NOT NULL,
  region TEXT,
  city TEXT,
  postal_code TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  workos_user_id TEXT NOT NULL UNIQUE,
  company_id TEXT,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_users_company_id ON users(company_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 13.1 Atomic company creation

The first `PUT /api/company` for a user with no company must create the company and attach it to the user in one D1 batch or equivalent atomic operation.

The implementation must not leave an unattached company if user attachment fails.

## 14. Company Profile Fields

Required fields:

* legal company name
* primary contact name
* primary contact email
* country

Optional fields:

* display name
* company type
* billing contact email
* state/region
* city
* postal code
* business address line 1
* business address line 2
* company description

Do not include:

* `publisher_url`
* website enrollment fields
* domain fields
* robots.txt fields
* RSL declaration fields
* payment fields
* reporting fields
* AI company exclusion fields

### 14.1 Company type values

`company_type` should be a select list with these values:

```txt
Publisher
Platform
Media company
Rights holder
Association
Other
```

### 14.2 Country format

Store `country` as an uppercase ISO 3166-1 alpha-2 code.

The UI may render human-readable country names, but the API stores the code.

Examples:

```txt
US
GB
DE
FR
JP
```

## 15. API Behavior

### 15.1 API response conventions

All API responses should be JSON.

Error response shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid company profile.",
    "fields": {
      "primaryContactEmail": "Enter a valid email address."
    }
  }
}
```

Use stable error codes.

Recommended codes:

```txt
unauthenticated
validation_error
forbidden
not_found
conflict
server_error
```

### 15.2 `GET /api/session`

Returns current session state.

Unauthenticated response:

Status:

```txt
200
```

Body:

```json
{
  "authenticated": false
}
```

Authenticated response:

Status:

```txt
200
```

Body:

```json
{
  "authenticated": true,
  "user": {
    "email": "user@example.com",
    "firstName": "First",
    "lastName": "Last",
    "role": "owner",
    "hasCompany": true
  }
}
```

### 15.3 `GET /api/company`

Requires authentication.

If unauthenticated:

Status:

```txt
401
```

Body:

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Authentication required."
  }
}
```

If authenticated user has no company:

Status:

```txt
200
```

Body:

```json
{
  "company": null
}
```

If authenticated user has a company:

Status:

```txt
200
```

Body:

```json
{
  "company": {
    "legalName": "Example Media Inc.",
    "displayName": "Example Media",
    "companyType": "Publisher",
    "primaryContactName": "Jane Publisher",
    "primaryContactEmail": "jane@example.com",
    "billingContactEmail": null,
    "country": "US",
    "region": "CA",
    "city": "Los Angeles",
    "postalCode": "90001",
    "addressLine1": "123 Main Street",
    "addressLine2": null,
    "description": "Example publisher profile.",
    "status": "draft",
    "createdAt": "2026-06-11T00:00:00.000Z",
    "updatedAt": "2026-06-11T00:00:00.000Z"
  }
}
```

The response must include all editable company fields needed to hydrate the form.

### 15.4 `PUT /api/company`

Requires authentication.

Behavior:

* Validate request body with Zod.
* Require matching `Origin` in production.
* If `users.company_id` is `NULL`, create a company and attach user as `owner`.
* If `users.company_id` exists, update that company.
* Reject client-supplied `company_id`.
* Reject client-supplied `role`.
* Reject client-supplied `status`.
* Reject client-supplied privileged fields.
* Reject unsupported `company_type` values.
* Never accept a client-provided company ID as the target of a read or write.

Status behavior:

```txt
401 if unauthenticated
400 for validation errors
201 when creating the first company
200 when updating an existing company
409 only for impossible state or race conditions
```

Create response:

```json
{
  "company": {
    "legalName": "Example Media Inc.",
    "displayName": "Example Media",
    "companyType": "Publisher",
    "primaryContactName": "Jane Publisher",
    "primaryContactEmail": "jane@example.com",
    "billingContactEmail": null,
    "country": "US",
    "region": "CA",
    "city": "Los Angeles",
    "postalCode": "90001",
    "addressLine1": "123 Main Street",
    "addressLine2": null,
    "description": "Example publisher profile.",
    "status": "draft",
    "createdAt": "2026-06-11T00:00:00.000Z",
    "updatedAt": "2026-06-11T00:00:00.000Z"
  }
}
```

## 16. Validation

Use Zod v4 for server validation.

Rules:

* trim strings
* convert empty optional strings to `null`
* validate email fields
* enforce length limits
* reject unknown fields
* reject client-supplied `company_id`
* reject client-supplied `role`
* reject client-supplied `status`
* require legal company name
* require primary contact name
* require primary contact email
* require country
* normalize country to uppercase ISO 3166-1 alpha-2
* validate `company_type` against the allowed select-list values when provided

Client-side validation can reuse the schema, but server validation is authoritative.

Suggested length limits:

```txt
legalName: 2 to 200
displayName: 0 to 200
companyType: allowed enum only
primaryContactName: 2 to 200
primaryContactEmail: valid email, max 254
billingContactEmail: valid email, max 254
country: exactly 2 after normalization
region: 0 to 100
city: 0 to 100
postalCode: 0 to 40
addressLine1: 0 to 200
addressLine2: 0 to 200
description: 0 to 2000
```

## 17. Data Fetching

Use TanStack React Query v5.

Queries:

* `useSessionQuery`
* `useCompanyQuery`

Mutations:

* `useSaveCompanyMutation`
* `useSignOutMutation`, if sign-out is implemented via fetch rather than form POST

Rules:

* dashboard loads session first
* unauthenticated users redirect or show sign-in prompt
* company query runs only when authenticated
* save mutation invalidates company/session queries as needed
* after first company creation, session query should be invalidated so `hasCompany` updates
* API errors should map cleanly into Mantine form errors or notifications

## 18. Dashboard UI

Use React and Mantine for the authenticated dashboard.

Dashboard shell:

* top bar
* RSL Collective name/logo
* signed-in user email
* sign-out button
* two tabs:
  1. Account Information
  2. Company Profile

For a new authenticated user with no company profile:

* open the Company Profile tab automatically
* show a short empty-state message explaining that the user needs to create the company profile

### 18.1 Account Information tab

Display:

* email
* name, if available
* company role
* whether a company profile exists
* sign-out button

Do not show WorkOS IDs in normal UI unless placed behind a diagnostics/debug-only section.

### 18.2 Company Profile tab

Fields:

* legal company name
* display name
* company type
* primary contact name
* primary contact email
* billing contact email
* country
* state/region
* city
* postal code
* business address line 1
* business address line 2
* company description

The form should support:

* loading existing company data
* creating a first company profile
* editing an existing company profile
* showing validation errors
* showing save success
* disabling submit while saving
* preserving user input when server validation fails

## 19. Mantine UI Theme

Use Mantine v8 for the SPA and dashboard UI.

The application should use a simple Mantine theme adjustment so the SPA feels visually aligned with the RSL Collective public UX.

This is a simple palette and polish adjustment, not a redesign.

Requirements:

* Keep the default Mantine component structure.
* Do not restructure the dashboard template.
* Do not create a custom design system.
* Do not over-customize component variants.
* Use one RSL-aligned primary color.
* Use a restrained neutral background.
* Use professional, clean border radius and spacing.
* Keep forms, tabs, buttons, notifications, and layout components as standard Mantine patterns.
* Do not attempt to recreate the full public-site template inside the dashboard.
* Do not introduce Tailwind into the dashboard.

Preferred direction:

* set Mantine `primaryColor` to an RSL-aligned blue or blue-purple value
* keep neutral grays close to Mantine defaults
* use subtle page background
* use standard Mantine `AppShell`, `Tabs`, `Paper`, `TextInput`, `Select`, `Textarea`, `Button`, `Notification`, and form components

The goal is for the dashboard to feel consistent with the RSL Collective brand while staying simple and app-like.

## 20. Cloudflare/Wrangler

Use Cloudflare Workers and Wrangler.

Recommended Worker entry:

```txt
worker/index.ts
```

Recommended D1 binding:

```txt
DB
```

Recommended D1 database name:

```txt
rsl-collective-dashboard
```

Use the Cloudflare account that controls `rslcollective.org` DNS.

Wrangler should support:

* local dev
* local D1 migrations
* remote D1 migrations
* production secrets
* deployment
* Worker-first routing for auth/API routes
* SPA fallback for `/dashboard`

Suggested scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "check": "tsc --noEmit",
    "worker:dev": "wrangler dev --config wrangler.jsonc",
    "worker:deploy": "wrangler deploy --config wrangler.production.jsonc",
    "db:migrate:local": "wrangler d1 migrations apply rsl-collective-dashboard --local --config wrangler.jsonc",
    "db:migrate:remote": "wrangler d1 migrations apply rsl-collective-dashboard --remote --config wrangler.production.jsonc"
  }
}
```

### 20.1 Wrangler configuration requirements

Wrangler must configure:

* Worker entry point
* D1 binding `DB`
* static assets directory
* SPA fallback
* `run_worker_first` for auth/API/root routes
* production route for `dashboard.rslcollective.org`

Representative configuration:

```jsonc
{
  "main": "worker/index.ts",
  "compatibility_date": "2026-06-11",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": [
      "/",
      "/register",
      "/login",
      "/auth/*",
      "/logout",
      "/api/*"
    ]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "rsl-collective-dashboard",
      "database_id": "<set-in-real-wrangler-config>"
    }
  ]
}
```

Only include `nodejs_compat` if required by the selected dependencies. If not required, omit it.

## 21. Environment Variables and Secrets

Required local/production values:

```txt
WORKOS_CLIENT_ID
WORKOS_API_KEY
WORKOS_REDIRECT_URI
SESSION_SECRET
DASHBOARD_BASE_URL
ENVIRONMENT
```

D1 binding:

```txt
DB
```

Do not expose secrets through Vite client environment variables.

Only browser-safe values may use `VITE_` prefixes.

Production examples:

```txt
WORKOS_REDIRECT_URI=https://dashboard.rslcollective.org/auth/callback
DASHBOARD_BASE_URL=https://dashboard.rslcollective.org
ENVIRONMENT=production
```

Local examples:

```txt
WORKOS_REDIRECT_URI=http://localhost:8787/auth/callback
DASHBOARD_BASE_URL=http://localhost:8787
```

## 22. QA

Automated checks:

```txt
pnpm check
pnpm build
pnpm test
```

Targeted tests:

* company Zod schema
* invalid company payloads
* empty optional strings normalize to null
* country normalizes to uppercase ISO 3166-1 alpha-2
* client-supplied `company_id` rejected
* client-supplied `role` rejected
* client-supplied `status` rejected
* unsupported `company_type` rejected
* session token hashing
* raw session token is never stored in D1
* expired sessions rejected
* missing production `Origin` rejected for mutating requests
* mismatched production `Origin` rejected for mutating requests
* unauthenticated `/api/company` fails
* authenticated user with no company receives `company: null`
* first `PUT /api/company` creates company and attaches user
* first company creation and user attachment are atomic
* later `PUT /api/company` updates company
* `/` redirects to `/login` when unauthenticated
* `/` redirects to `/dashboard` when authenticated
* `/register` redirects to AuthKit sign-up flow
* `/login` redirects to AuthKit sign-in flow
* `/auth/callback` rejects invalid state
* `/auth/callback` rejects expired state
* `/auth/callback` creates or updates local user
* `/auth/callback` creates local session
* `POST /logout` invalidates local session
* `POST /logout` clears cookie
* dashboard renders Account and Company Profile tabs
* new user with no company opens Company Profile tab
* company profile validation errors render
* save success state renders

Manual tests:

1. Visit `https://rslcollective.org`.
2. Click **Join for free**.
3. Confirm the browser goes to `https://dashboard.rslcollective.org/register`.
4. Confirm `/register` starts the AuthKit sign-up flow.
5. Complete AuthKit.
6. Land on `/dashboard`.
7. Confirm the Company Profile tab opens for a new user with no company.
8. Create company profile.
9. Refresh and confirm profile persists.
10. Sign out.
11. Confirm local session is invalidated.
12. Visit `https://rslcollective.org`.
13. Click **Login**.
14. Confirm the browser goes to `https://dashboard.rslcollective.org/login`.
15. Confirm `/login` starts the AuthKit sign-in flow.
16. Confirm the same profile loads after login.
17. Confirm user cannot create a second company.
18. Confirm unauthenticated `/api/company` fails.
19. Confirm direct visit to `https://dashboard.rslcollective.org/` redirects to `/dashboard` when authenticated.
20. Confirm direct visit to `https://dashboard.rslcollective.org/` redirects to `/login` when unauthenticated.
21. Confirm direct visit to `/dashboard` loads the SPA.
22. Confirm WorkOS callback route is handled by the Worker, not by SPA fallback.

## 23. Implementation Sequence

1. Create clean SPA app scaffold.
2. Add Mantine provider and simple RSL-aligned theme.
3. Add dashboard shell and dashboard skeleton.
4. Add React Router routes for `/dashboard`.
5. Add Hono Worker app.
6. Configure Workers Assets SPA fallback and Worker-first routing.
7. Add root redirect behavior.
8. Add placeholder `/register`, `/login`, `/auth/callback`, `/logout`, `/api/session`, and `/api/company` routes.
9. Add D1 schema and DB helpers.
10. Add session helper functions.
11. Add Origin validation for mutating requests.
12. Add WorkOS/AuthKit authorization URL generation.
13. Add signed or server-validated AuthKit state.
14. Add WorkOS/AuthKit callback handling.
15. Add local user create/update logic.
16. Add local session creation and cookie handling.
17. Add sign-out behavior.
18. Add `/api/session`.
19. Add company Zod schema.
20. Add `/api/company`.
21. Add atomic first-company creation and user attachment.
22. Add dashboard React Query hooks.
23. Add Account Information tab.
24. Add Company Profile form.
25. Add validation and error rendering.
26. Add tests.
27. Add Cloudflare/Wrangler production setup notes.
28. Run `pnpm check`, `pnpm build`, and `pnpm test`.
29. Run `wrangler dev` and complete local AuthKit callback testing.
30. Deploy to Cloudflare Workers.

## 24. Codex Guardrails

Codex must not expand scope beyond this document.

Before implementing any feature, Codex should check whether the feature appears in:

* Product Scope
* Primary User Flows
* Routing
* API Behavior
* Implementation Sequence

If a feature appears only in Explicit Non-Goals, Codex must not implement it.

Codex should prefer:

* small commits
* typed interfaces
* server-side validation
* narrow helpers
* simple Worker routes
* standard Mantine components
* explicit tests for auth/session/company behavior

Codex should avoid:

* inventing onboarding flows
* adding WorkOS Organizations
* adding company membership tables
* adding Vinxi
* exposing WorkOS secrets to the browser
* relying on client-supplied company identifiers
* bypassing Worker-first routing for auth/API routes
