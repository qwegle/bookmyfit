# BookMyFit Error Report and Change Log for Nikhilesh

Date: 2026-05-06
Prepared for: Nikhilesh
Repository reviewed: BookMyFit monorepo

## Review Rule

This document is the tracking file for findings, fixes, and verification. The first review pass only added this report file; later code changes are logged in the Change Log section.

When fixes start, every change should be logged here first with:
- Error found
- File or server area affected
- What was changed
- Verification command or browser test
- Final status

## Current Status Summary

High priority issues found:
- Production database schema is behind backend entity code. The live server showed `column GymEntity.dayPassPrice does not exist`.
- Admin and Wellness domains were started in PM2, but public HTTPS was still serving the AstroCents site because nginx SSL/SNI routing was not fully configured for those subdomains.
- Payment flow has unsafe mock fallback behavior that can activate subscriptions when Cashfree fails.
- Payment webhook accepts requests without signature headers.
- Gym QR scanner/check-in flow can bypass the secure signed QR validation endpoint.
- No production migration system is present, which is why DB schema drift already happened.

Resolved locally during this work:
- Tasklist build type error for `app: 'wellness'`.
- Production portal CORS origins were added to source code.
- Payment mock fallback and unsigned webhook handling were hardened in source code.
- Gym scanner and mobile gym scanner were changed to use signed QR validation.
- Mobile homepage/store UI changes requested by Nikhilesh were started.
- Automated QA tooling now runs: backend ESLint config exists, frontend Next ESLint configs exist, and backend Jest has a Cashfree safety test suite.

### 2026-05-12 Real Data / Demo Data Audit Update

Requested scope: user mobile side, gym side, and admin side after login. OTP/login behavior was not changed because OTP is intentionally using the default production-safe/dev flow for now.

Deployment approach confirmed:
- Changes are made locally first.
- Local builds/type checks must pass.
- Then changes should be committed/pushed and deployed to the live server.
- Direct live-server edits should be avoided except for urgent server config or PM2/nginx/env issues.

Errors and demo/fixed-data issues found and fixed locally:
- Mobile user app no longer injects fallback gyms, spa centres, home-service providers, products, videos, notifications, invoice data, history visits, slot/session data, or subscription detail data when APIs are empty or failing.
- Mobile gym/profile/plans/duration/subscription pages now prefer actual API pricing and subscription data. Missing pricing now blocks checkout instead of silently using hardcoded fallback prices.
- Mobile nearby and multi-gym network screens now show only API gyms and empty/error states when no real gyms are returned.
- Old mobile gym-portal screens no longer show mock dashboard members/check-ins when APIs fail.
- Admin settings no longer saves platform settings in browser localStorage. It now uses backend `/admin/settings`.
- Admin user list now uses real `/users?role=super_admin` filtering, and Add Admin creates a real backend super-admin user with an initial password.
- Admin commission settings no longer use in-memory-only backend state; rates now persist through the `app_config` database table.
- Admin gym, user, and settlement actions no longer update the UI optimistically when the backend rejects the request.
- Admin wellness no longer creates local fake partners/services on failed save and no longer displays default commission values as if they came from the API.
- Gym panel profile/settings/dashboard/report/settlement pages were tightened so API failures show error/empty states instead of fake success or old placeholder values.
- Backend boot seeding is now opt-in with `SEED_ON_BOOT=true` and disabled in production.
- Backend homepage and fraud alert endpoints no longer auto-seed fake homepage/fraud data when tables are empty.
- Backend session slot generation no longer auto-creates default bookable slots when a gym has not configured schedules.

Verification run on 2026-05-12:

| Area | Command | Result |
| --- | --- | --- |
| Backend | `pnpm.cmd --filter backend build` | Passed |
| Admin panel | `pnpm.cmd --filter admin-panel build` | Passed |
| Gym panel | `pnpm.cmd --filter gym-panel build` | Passed |
| Mobile TypeScript | `pnpm.cmd --filter mobile exec tsc --noEmit` | Passed |

Remaining intentional item:
- Cashfree mock mode still exists only behind `CASHFREE_MOCK_MODE=true` and `NODE_ENV !== 'production'`. This is for local/dev testing and should stay disabled on the live server.

## Build and Verification Results

Commands run locally:

| Area | Command | Result |
| --- | --- | --- |
| Repo status | `git status --short` | Dirty with planned local changes and this report |
| Full workspace build | `pnpm.cmd run build` | Passed after Windows sandbox escalation |
| Backend | `pnpm.cmd --filter backend build` | Passed |
| Admin panel | `pnpm.cmd --filter admin-panel build` | Passed |
| Gym panel | `pnpm.cmd --filter gym-panel build` | Passed after Windows sandbox escalation |
| Corporate panel | `pnpm.cmd --filter corporate-panel build` | Passed after Windows sandbox escalation |
| Wellness portal | `pnpm.cmd --filter @bmf/wellness-portal build` | Passed |
| Landing | `pnpm.cmd --filter landing build` | Passed |
| Tasklist | `pnpm.cmd --filter tasklist build` | Passed after local type fix |
| Mobile TypeScript | `pnpm.cmd --filter mobile exec tsc --noEmit` | Passed |
| Workspace lint | `pnpm.cmd -r lint` | Passed with no warnings |
| Backend tests | `pnpm.cmd --filter backend test -- --runInBand` and `pnpm.cmd -r test` | Passed |
| Frontend lint | `pnpm.cmd --filter admin-panel lint`, `landing lint`, `tasklist lint` | Passed with no warnings |

## Documentation Reviewed

Project documents found and reviewed:

| File | What it contains | Notes |
| --- | --- | --- |
| `BookMyFit_LLR (1).docx` | Original low-level requirements | Defines roles, subscriptions, commission engine, access/QR rules, settlement logic, and marketplace scope. |
| `BookMyFit_Project_Plan (1).docx` | Original phase-wise project plan | Defines Phase 1 to Phase 4 roadmap and task breakdown. |
| `plan.md` | 32-week development plan | Mirrors the Word project plan: MVP, multi-gym, marketplace, growth/scale. |
| `requirements.md` | Requirements gap analysis | Lists 20 gaps, 5 technical corrections, 10 recommended additions, and final checklist. |
| `README.local.md` | Documentation index and project overview | Explains all docs and expected team workflow. |
| `README.md` | Current repo overview | Useful but partly stale. It says progress is about 25%, while tasklist now says most tasks are done. |
| `PROJECT_STRUCTURE.md` | Recommended folder structure, env, test, deployment, migrations | Some commands/features are planned but not present, especially migrations. |
| `admin.html` | Admin panel design reference | Shows dashboard, gyms, KYC, subscriptions, corporate, settlements, homepage, store, categories, notifications, settings. |
| `gym.html` | Gym partner panel design reference | Shows dashboard, scanner, sessions, members, profile, plans, amenities, earnings, reports. |
| `corporate.html` | Corporate panel design reference | Shows corporate dashboard, employee management, plans, usage, billing, settings/admin access. |
| `bmf-complete.html` | Complete mobile + role prototype | Covers user app screens, gym partner screens, and admin dashboard prototype. |
| `bmf-v4.html` | Alternative mobile design | Earlier/alternate mobile visual direction. |
| `bmf-guidelines.html` | Design system guidelines | Dark/neon/glassmorphism design rules, typography, CTA, spacing, motion, component rules. |
| `Design reference/*.jpeg` | Visual references | Four image references from WhatsApp exports. |

## Project Plan From The Docs

The original plan is a 32-week roadmap:

| Phase | Time | Target from docs | Current interpretation |
| --- | --- | --- | --- |
| Phase 1 - MVP Foundation | 10 weeks | Auth, gym onboarding, individual subscriptions, QR check-in | Mostly implemented according to tasklist, but production DB/CORS/check-in security need fixes. |
| Phase 2 - Multi-Gym Platform | 8 weeks | Pro/Max plans, elite/pro settlement, gym tiers, ratings, fraud prevention | Marked done in tasklist, but security and settlement APIs need production testing. |
| Phase 3 - Full Marketplace | 8 weeks | PT, wellness, corporate, store, workout videos | Many modules/apps exist, but admin/wellness deployment and payment safety need fixes. |
| Phase 4 - Growth and Scale | 6 weeks | Analytics, slot booking, retention, optimization, launch prep | Several growth items are marked done, but load testing, security testing, app-store release, GDPR, and DB optimization are blocked. |
| Phase 5 - Later design/API polish | Added in tasklist | Mobile redesign, homepage config, portal design updates, nearby/map work | Marked done in tasklist, but tasklist itself currently fails build. |

## What Is Marked Done Till Now

According to `apps/tasklist/lib/tasks.ts`:

| Status | Count |
| --- | ---: |
| Done | 192 |
| Blocked | 6 |
| Total | 198 |

Done by phase:

| Phase | Done | Blocked |
| --- | ---: | ---: |
| Scaffold | 10 | 0 |
| Phase 1 | 83 | 1 |
| Phase 2 | 19 | 0 |
| Phase 3 | 22 | 0 |
| Phase 4 | 31 | 5 |
| Phase 5 | 27 | 0 |

Done by app/area:

| App/Area | Done | Blocked |
| --- | ---: | ---: |
| Backend | 54 | 2 |
| Mobile | 64 | 1 |
| Admin | 37 | 0 |
| Gym | 16 | 0 |
| Corporate | 11 | 0 |
| Wellness | 1 | 0 |
| Shared | 2 | 0 |
| General/No app | 7 | 3 |

Important note:
- The tasklist says almost everything is done, but this does not mean production-ready.
- The actual local checks found build/config/security/deployment problems.
- README says the project is about 25% complete, which conflicts with the tasklist status. This needs documentation cleanup.

## Pending Or Blocked From Tasklist

Blocked items found in `apps/tasklist/lib/tasks.ts`:

| Task | Title | Area |
| --- | --- | --- |
| `T-1.2.10` | Location-based search with PostGIS | Backend |
| `T-4.09` | DB query optimization + read replicas | DevOps |
| `T-4.10` | Load testing with k6, 10k concurrent | QA |
| `T-4.11` | Penetration testing | QA/Security |
| `T-4.13` | App Store + Play Store submission | Mobile |
| `T-4.14` | GDPR compliance audit | Backend/Compliance |

Pending from requirements checklist:
- Final approval for all 4 panels: Admin, Gym, Corporate, Wellness.
- Corporate employee management rules need verified production behavior.
- Gym tier workflow needs tested end-to-end.
- Refund policy needs stakeholder approval.
- Notification matrix needs review.
- Data export formats need confirmation.
- Error codes need standardization.
- Redis key patterns need documentation and verification.
- Database indexes need to be implemented/verified.
- Rate limiting rules need implementation/verification.
- Fraud detection rules need stakeholder approval and testing.
- Settlement dispute process needs implementation or confirmation.
- Gym onboarding flow needs real production testing.
- User profile fields need final signoff.

## Documentation And Code Mismatches

These are not all runtime bugs, but they will create confusion during setup/deployment.

1. README progress mismatch:
   - `README.md` says current progress is about 25%.
   - `apps/tasklist/lib/tasks.ts` says 192 of 198 tasks are done.

2. Admin port mismatch:
   - `README.md` says admin runs on `localhost:3000`.
   - `apps/admin-panel/package.json` dev uses `3004`, but production start uses `3000`.
   - Tasklist says admin moved to port `3004`.

3. Wellness app naming mismatch:
   - `PROJECT_STRUCTURE.md` refers to `wellness-panel`.
   - Actual app folder is `apps/wellness-portal`.

4. Migration docs do not match backend scripts:
   - `PROJECT_STRUCTURE.md` documents migration commands.
   - Backend currently has no working migration pipeline found in review.
   - Production DB already drifted from entity code.

5. Payment provider mismatch:
   - Original docs mention Razorpay in several places.
   - Current code uses Cashfree.
   - Docs and code should be aligned so future developers do not implement the wrong gateway.

6. Deployment mismatch:
   - `PROJECT_STRUCTURE.md` talks about Vercel for web panels.
   - Current server uses PM2 and nginx on the same VPS.
   - Production deployment docs need to match actual server setup.

7. Tech stack mismatch:
   - README says older Expo/React Native stack in places.
   - Current mobile package uses Expo 54 / React Native 0.81.5, while root pnpm overrides force React 18.

8. Design docs versus implemented UI:
   - HTML prototypes are rich design references.
   - Some implemented pages use simplified API-driven screens and may not match the final reference design.

## Confirmed Errors

### 1. Production DB Schema Missing Gym Columns

Status: Confirmed on server logs and DB schema.

Live backend error:
`column GymEntity.dayPassPrice does not exist`

Code expects these columns:
- `backend/src/database/entities/gym.entity.ts:62` - `dayPassPrice`
- `backend/src/database/entities/gym.entity.ts:65` - `sameGymMonthlyPrice`

Server DB `gyms` table output showed older columns like `ratePerDay`, `capacity`, `ownerId`, `kycDocuments`, `kycStatus`, but not the new price columns.

Impact:
- Gym listing/admin pages can fail with 500 errors.
- Gym dashboard/check-in/settlement screens can fail because TypeORM selects all entity columns.

Recommended fix later:
- Add a proper TypeORM migration or a controlled SQL migration for these columns.
- Run it on production.
- Restart backend and retest affected APIs.

### 2. No Production Migration Workflow

Status: Confirmed in code.

Evidence:
- `backend/src/app.module.ts:56`
- `backend/src/app.module.ts:68`

The app uses `synchronize: process.env.NODE_ENV !== 'production'`. This means development can auto-sync schema, but production will not. No migration files were found during review.

Impact:
- Local code can work while production DB breaks.
- Any new entity column can create production 500 errors.

Recommended fix later:
- Add migration scripts.
- Create migrations for current schema differences.
- Make deployment run migrations before restarting PM2.

### 3. Admin and Wellness Domains Serving Wrong Site on HTTPS

Status: Confirmed from server session behavior.

Observed:
- `admin.bookmyfit.in` and `wellness.bookmyfit.in` were added to nginx `sites-available` and symlinked to `sites-enabled`.
- `curl -I http://admin.bookmyfit.in` and `curl -I http://wellness.bookmyfit.in` returned 200.
- Public HTTPS still showed AstroCents content.

Likely cause:
- HTTP config exists, but HTTPS/SSL server blocks for these domains are missing.
- Cloudflare/browser HTTPS hits nginx 443, where the AstroCents SSL/default server block is being selected.

Recommended fix later:
- Compare with working `gym.bookmyfit.in` and `corporate.bookmyfit.in` nginx configs.
- Run certbot/nginx SSL setup for:
  - `admin.bookmyfit.in`
  - `wellness.bookmyfit.in`
- Reload nginx.
- Verify HTTPS title/body routes to the correct Next.js apps.

### 4. Tasklist Build Fails

Status: Fixed locally in Change 001.

Build failure:
`Type '"wellness"' is not assignable to type '"backend" | "mobile" | "admin" | "gym" | "corporate" | "shared" | undefined".`

Evidence:
- `apps/tasklist/lib/tasks.ts:1-4` defines task types.
- `apps/tasklist/lib/tasks.ts:218` uses `app: 'wellness'`.

Impact:
- `pnpm --filter tasklist build` fails.
- Any full workspace build including tasklist may fail.

Fix completed:
- Added `wellness` to the allowed task app type.

Verification:
- `pnpm.cmd --filter tasklist build` passed.
- `pnpm.cmd run build` passed for the full workspace after Windows sandbox escalation.

### 5. Backend Lint Script Is Broken

Status: Fixed locally in Change 008.

Result:
- `pnpm --filter backend lint` failed because `eslint` was not recognized.

Impact:
- Backend lint cannot run in CI or local QA.
- Code quality checks are unreliable.

Original recommended fix:
- Add the missing ESLint dependency/config or remove/update the broken lint script.

Related frontend lint finding fixed in the same change:
- `admin-panel`, `landing`, and `tasklist` have `next lint` scripts, but no ESLint config exists.
- Running those scripts opens the Next.js first-time ESLint setup prompt instead of completing a non-interactive lint check.
- Add shared ESLint config so lint can run in CI and local QA without prompts.

Fix completed:
- Added ESLint dependencies at the workspace root.
- Added backend ESLint config.
- Added Next ESLint configs for admin, landing, and tasklist.
- Fixed admin JSX text escaping errors that blocked lint.

Verification:
- `pnpm.cmd -r lint` passed with no warnings.

### 6. Backend Test Script Finds No Tests

Status: Fixed locally in Change 008.

Result:
- `pnpm --filter backend test -- --runInBand` found no tests.

Impact:
- Backend behavior has no automated regression safety from Jest right now.

Original recommended fix:
- Add focused tests for auth, subscriptions, payments, QR validation, and gym APIs.

Fix completed:
- Added backend Jest config.
- Added Cashfree service tests covering production mock blocking, explicit non-production mock mode, and webhook signature verification.

Verification:
- `pnpm.cmd --filter backend test -- --runInBand` passed.
- `pnpm.cmd -r test` passed.

### 7. Production CORS Origins Missing in Local Repo

Status: Fixed locally in Change 001. Server still needs clean deploy from repo.

Evidence:
- `backend/src/main.ts:9-20`

Original local CORS list only included localhost origins and did not include the production portal domains.

Impact:
- Production portals can fail login/API calls with CORS errors after redeploy from repo.
- Manual server edit can be lost during the next deploy or git pull.

Fix completed:
- Added production domains to source-controlled CORS config.
- Added support for extra origins from `CORS_ORIGINS`.

Verification:
- `pnpm.cmd --filter backend build` passed.

### 8. Cashfree Failure Falls Back to Mock Payment

Status: Fixed locally in Change 002.

Evidence:
- `backend/src/modules/payments/cashfree.service.ts:67-72`
- `backend/src/modules/payments/cashfree.service.ts:85-87`
- `backend/src/modules/subscriptions/subscriptions.module.ts:167-168`

When Cashfree order creation fails, the service returns a mock payment session. Subscription creation then auto-activates when `payment.mock` exists.

Impact:
- A payment gateway outage or bad key can create active subscriptions without real payment.
- Server logs already showed Cashfree authentication failures.

Recommended fix later:
- In production, never return mock payment on Cashfree failure.
- Only allow mock mode when an explicit development/test env flag is enabled.

Fix completed:
- Production Cashfree failures now throw instead of returning mock sessions.
- Mock mode is limited to non-production with `CASHFREE_MOCK_MODE=true`.

### 9. Client Can Override Subscription Price

Status: Fixed locally in Change 002.

Evidence:
- `backend/src/modules/subscriptions/subscriptions.module.ts:103`
- `backend/src/modules/subscriptions/subscriptions.module.ts:120`
- `backend/src/modules/subscriptions/subscriptions.module.ts:128`

`amountOverride` is accepted from request DTO and used directly for `same_gym` and `day_pass`.

Impact:
- A user can potentially manipulate the payable amount from the client.

Recommended fix later:
- Remove client-controlled `amountOverride` from production purchase flow.
- Calculate amount only on server from plan, gym, duration, coupons, and admin config.

Fix completed:
- Same-gym and day-pass pricing now come from server-side plan/gym configuration and defaults.
- Client-controlled `amountOverride` is no longer trusted for these flows.

### 10. Payment Webhook Allows Missing Signature Headers

Status: Fixed locally in Change 002.

Evidence:
- `backend/src/modules/payments/payments.module.ts:83-96`

The webhook verifies signature only when both `signature` and `timestamp` exist. If they are missing, it continues processing.

Impact:
- In production, an unsigned webhook-like request could be accepted.

Recommended fix later:
- Reject payment webhooks when required Cashfree signature headers are missing.
- Keep local/dev bypass behind an explicit env flag only.

Fix completed:
- Production webhooks now reject requests when required Cashfree signature headers are missing.

### 11. Gym Scanner Bypasses Secure QR Validation

Status: Fixed locally in Change 003 for gym-panel and mobile gym scanner paths. The separate Checkins service fallback in item 12 still needs review.

Secure endpoint exists:
- `apps/mobile/lib/api.ts:145-146` calls `/qr/validate`
- `backend/src/modules/qr/qr.service.ts:47` validates signed QR token

But gym scanner paths call direct check-in:
- `apps/gym-panel/app/scanner/page.tsx:154` posts `{ userId }` to `/sessions/checkin`
- `apps/mobile/lib/api.ts:167` posts `{ userId }` to `/sessions/checkin`
- `apps/mobile/app/(gym-portal)/scan.tsx:84` calls `gymStaffApi.checkin(memberId)`
- `backend/src/modules/sessions/sessions.module.ts:889-893` accepts only `userId`

Impact:
- Gym staff can check in a user by ID without validating a fresh signed QR token.
- Duplicate QR, QR expiry, and QR ownership checks can be bypassed.

Recommended fix later:
- Make scanner submit the signed QR token.
- Route scanner through `/api/v1/qr/validate`.
- Remove or restrict `/sessions/checkin` direct userId check-in.

Fix completed:
- Gym panel scanner now submits the signed QR token to `/api/v1/qr/validate`.
- Mobile gym portal scanner now submits the signed QR token to `/api/v1/qr/validate`.
- Direct `/sessions/checkin` is blocked unless `ALLOW_DIRECT_GYM_CHECKIN=true` is explicitly set.

Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter gym-panel build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.

### 12. Checkins Service Allows Optional/Fake QR Token

Status: Confirmed in code.

Evidence:
- `backend/src/modules/checkins/checkins.module.ts:72`
- `backend/src/modules/checkins/checkins.module.ts:118-121`
- `backend/src/modules/checkins/checkins.module.ts:153`

If `qrToken` is not provided, the service creates a fallback token like `QR_${userId}_${gymId}_${Date.now()}`.

Impact:
- The audit record can look successful without proof of a valid QR token.

Recommended fix later:
- Require a valid signed QR token for member check-ins.
- Keep manual check-ins as a separate admin-only action with clear audit reason.

### 13. Default Secrets Are Present

Status: Confirmed in code.

Evidence:
- `backend/src/modules/auth/jwt.strategy.ts:11`
- `backend/src/modules/auth/auth.module.ts:17`
- `backend/src/modules/qr/qr.module.ts:15`
- `backend/src/modules/slots/slots.module.ts:207`
- `backend/src/modules/sessions/sessions.module.ts:928`

Defaults:
- `dev-secret-change-me`
- `qr-hmac-secret-change-me`

Impact:
- If env vars are missing in production, JWT and QR signing secrets become predictable.

Recommended fix later:
- Fail startup in production if required secrets are missing.
- Use strong production secrets in `.env`.

### 14. Seeded Users and Passwords Are Logged

Status: Confirmed in code.

Evidence:
- `backend/src/database/seed.service.ts:40-43`
- `backend/src/database/seed.service.ts:52`

Seeded test accounts include known passwords and the service logs `email / password`.

Impact:
- If seed runs in production, credentials can be exposed through logs.
- Default credentials should not remain active after setup.

Recommended fix later:
- Disable seed-on-boot in production.
- Remove password logging.
- Rotate all default credentials.

### 15. Seeded Corporate Password Is Too Short for Login DTO

Status: Confirmed from server login testing and seed data.

Evidence:
- `backend/src/database/seed.service.ts:43` uses `hr123`
- Login DTO enforces password length, and earlier testing showed HR login rejected because the password is too short.

Impact:
- The seeded corporate account may exist but cannot log in through normal validation.

Recommended fix later:
- Change seed password to at least 6 characters.
- Reset production corporate test user password if needed.

### 16. Landing API Fallback Points to Different Host

Status: Confirmed in code.

Evidence:
- `apps/landing/components/EarlyAccessForm.tsx:4`
- `apps/landing/app/onboard/page.tsx:7-9`

Landing fallback uses:
- `https://api.bookmyfit.in` in `EarlyAccessForm`
- `http://localhost:3003` in onboard page

Observed production backend path uses:
- `https://bookmyfit.in/api/v1/...`

Impact:
- Landing form/onboarding can hit the wrong backend if env vars are missing at build.

Recommended fix later:
- Standardize all production app builds on `NEXT_PUBLIC_API_URL=https://bookmyfit.in`.
- Consider moving API host to one shared env config.

### 17. Admin Production Start Port Differs From Dev Port

Status: Confirmed in code.

Evidence:
- `apps/admin-panel/package.json:6` dev uses port 3004.
- `apps/admin-panel/package.json:8` start uses port 3000.
- `README.md:14` and `README.md:72` still mention admin on localhost 3000.
- `apps/tasklist/lib/tasks.ts:221` says admin was moved to port 3004.

Impact:
- Deployment/nginx can point to the wrong port if people assume dev and production ports match.
- Documentation is inconsistent.

Recommended fix later:
- Decide final admin production port.
- Align package scripts, PM2 command, nginx proxy, and README.

### 18. Mobile React Dependency Mismatch Risk

Status: Confirmed in package files and installed dependency check.

Evidence:
- Root `package.json:37-40` overrides React packages to React 18.
- `apps/mobile/package.json:19-33` declares Expo 54, React Native 0.81.5, and React 19.1.0.
- `apps/mobile/package.json:44` declares `@types/react` 19.1.10.

Impact:
- Mobile can pass TypeScript but still hit runtime/Metro/Expo compatibility issues.
- The repo tasklist already mentions duplicate React/pnpm workarounds.

Recommended fix later:
- Confirm the intended Expo SDK dependency matrix.
- Remove or scope root overrides so web and mobile do not fight each other.

### 19. Production Landing Runs in Dev Mode on Server

Status: Confirmed from PM2 output during server session.

Observed PM2 command:
- `BMF` runs `PORT=5004 npm run dev`

Impact:
- Next.js dev server is not suitable for production.
- It is slower and less stable under real traffic.

Recommended fix later:
- Build landing with production env.
- Run `npm run start` or `pnpm --filter landing start` under PM2.

## UI, Mobile, Homepage, Store, And Feature Issues Added By Nikhilesh

These are frontend/product issues to fix after the critical server, database, login, and payment/QR safety issues.

### 20. App Font Should Be Changed To Poppins

Status: Fixed locally in Change 004 for the Expo mobile app.

Requirement:
- Change the app font to Poppins.
- Match the typography style used in the Feature Gym Shop project.

Affected area:
- Mobile app global typography/theme.
- Possibly web portals if the same brand style should apply everywhere.

Expected result:
- App text should use Poppins consistently.
- Headings, body text, buttons, cards, and inputs should feel consistent.

Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.

### 21. Add Wellness Services Section On Homepage

Status: Fixed locally in Change 005 for the mobile homepage.

Requirement:
- Add a Wellness Services section on the homepage.
- It should be a horizontal slider/carousel.
- Include a `View All` option.

Expected result:
- Users can preview wellness services directly from the homepage.
- `View All` should open the full wellness listing page.

### 22. Add Gym Listing Section After "What Members Say"

Status: Fixed locally in Change 005 for the mobile homepage.

Requirement:
- Add a gym listing section after the `What Members Say` section.
- Use the existing gym card design.
- Include a `View All` option.

Expected result:
- Homepage should show gym cards in a clean horizontal/list section.
- `View All` should route to the full gym listing page.

### 23. Fix Category Section UI

Status: Fixed locally in Change 005 for the mobile homepage.

Current issue:
- Category section has too much height and empty space.
- Text alignment needs improvement.
- Current UI does not feel compact enough for mobile.

Required changes:
- Reduce section height.
- Remove extra empty space.
- Fix text alignment.
- Use compact horizontal chips/tabs.
- Add smooth horizontal scrolling.

Expected result:
- Category area should feel premium, compact, and easy to scan.

### 24. Add Dynamic Category Icons

Status: Fixed locally in Change 005 with default automatic icon mapping.

Requirement:
- Category icons should be dynamic based on category names/types.
- For now, assign default icons automatically from category name/type.

Examples:
- Gym / Workout -> dumbbell/fitness icon.
- Yoga -> yoga/stretch icon.
- Cardio -> running/heart icon.
- Wellness -> spa/leaf icon.
- Store -> shopping bag/cart icon.

Expected result:
- Categories should not look empty or generic.
- Default icon mapping should work even before admin uploads custom icons.

### 25. Add Category Icon Upload/Manage In Admin Panel

Requirement:
- Admin Panel should allow managing category icons.
- Admin should be able to upload or update category icons.

Expected result:
- Admin can control category icon assets without code changes.
- Frontend should display uploaded icon when available, otherwise default mapped icon.

### 26. Membership Plan Cards Should Show Monthly Pricing Only

Current issue:
- Plan cards should not show full billing amount as the main price.

Requirement:
- Membership plan cards should show monthly-equivalent pricing only.
- Actual values should remain dynamic from Admin Panel.
- Example format only:
  - Monthly -> `₹100/month`
  - 3 Months -> `₹90/month` with `Save 10%`
  - 6 Months -> `₹85/month` with `Save 15%`
  - Yearly -> `₹80/month` with `Save 20%`

Expected result:
- Plan cards show clean monthly comparison.
- User understands which plan is cheaper per month.

### 27. Show Total Billing Only During Checkout

Requirement:
- Total billing amount should be shown during checkout/order summary only.

Example format:
- 3 Months -> `₹270 billed every 3 months`
- 6 Months -> `₹510 billed every 6 months`
- Yearly -> `₹960 billed yearly`

Expected result:
- Plan selection stays simple.
- Checkout clearly shows the real payable billing cycle.

### 28. Personal Trainer Duration Should Be Independent

Current issue:
- Trainer duration should not be forced to follow membership duration.

Requirement:
- User should select trainer duration separately from membership duration.
- Allowed trainer durations:
  - 1 Month
  - 3 Months
  - 6 Months
  - 12 Months

Expected result:
- User can buy/select membership and trainer duration independently.

### 29. Gym Amenities UI Needs Modern Icon Cards

Current issue:
- Gym amenities appear as plain text.

Requirement:
- Amenities should display as icon + text inside modern boxes/cards.

Expected result:
- Amenity section looks premium and easier to scan.
- Layout should work on small mobile screens.

### 30. Store Search Bar Should Work Properly

Status: Fixed locally in Change 006 for the mobile Store page.

Current issue:
- Store page needs a proper working search bar.

Requirement:
- Search should filter products by relevant fields such as name, category, brand, or description.

Expected result:
- User can search store products quickly.
- Empty state should appear when no results match.

### 31. Fix Store Page UI/Design Issues

Status: Improved locally in Change 006 for the mobile Store page.

Current issues:
- Alignment issues.
- Spacing issues.
- Padding issues.
- Responsiveness issues.

Expected result:
- Store page should look polished on mobile and responsive layouts.
- Product cards, filters, search, and spacing should be consistent.

### 32. Improve Overall Mobile UI Consistency

Status: Partially improved locally through Changes 004, 005, and 006. More screen-by-screen QA is still recommended.

Requirement:
- Improve consistency across:
  - Buttons
  - Cards
  - Spacing
  - Responsive layout
  - Smooth scrolling

Expected result:
- Mobile app should feel like one premium product, not separate screens with different styles.

### 33. Maintain Premium Modern Dark Fitness Design

Requirement:
- Maintain a premium modern dark-theme fitness app design across the app.

Expected result:
- UI should stay aligned with BookMyFit brand and design references.
- Avoid inconsistent colors, weak spacing, plain cards, and non-premium layouts.

## Server Work Already Done During Session

These changes were guided and executed on the server during troubleshooting. They should still be checked and committed properly if source files changed.

1. Backend CORS production origins were manually edited on the server in `backend/src/main.ts`.
2. Backend was rebuilt with `pnpm --filter backend build`.
3. Backend PM2 process `bmf-backend` was restarted.
4. Admin panel was built with production API URL.
5. Wellness portal was built with production API URL.
6. PM2 processes were started:
   - `bmf-admin`
   - `bmf-wellness`
7. PM2 process list was saved with `pm2 save`.
8. nginx configs for admin and wellness were created in `sites-available`.
9. Symlinks were added to `sites-enabled`.
10. `nginx -t` passed and nginx was reloaded.

Important:
- The local repo now contains source-controlled CORS/domain changes, but they still need to be deployed cleanly to the server.
- HTTPS routing for admin/wellness still needs to be verified and likely fixed with proper SSL server blocks/certbot.

## Known Portal URLs and Test Logins

These are seeded/testing credentials observed in the code and earlier API checks. Rotate before real production use.

| Portal | URL | Login |
| --- | --- | --- |
| Landing | `https://bookmyfit.in` | Public site |
| Backend health | `https://bookmyfit.in/api/v1/health` | No login |
| Admin | `https://admin.bookmyfit.in` | `admin@bookmyfit.in` / `admin123` |
| Gym panel | `https://gym.bookmyfit.in` | `gym@bookmyfit.in` / `gym123` |
| Corporate panel | `https://corporate.bookmyfit.in` | `corporate@bookmyfit.in` / `corporate123` |
| Wellness portal | `https://wellness.bookmyfit.in` | `admin@bookmyfit.in` / `admin123` for testing |

Notes:
- `staff@bookmyfit.in` / `staff123` failed earlier and needs review.
- `hr@techcorp.in` / `hr123` failed because `hr123` is too short for validation.
- Do not store server root passwords in this report.

## Suggested Fix Order

1. Fix production DB schema/migrations for `gyms.dayPassPrice` and `gyms.sameGymMonthlyPrice`.
2. Fix admin/wellness HTTPS nginx/certbot routing so they stop serving AstroCents.
3. Deploy production CORS/domain config from this repo to the server.
4. Run a portal login smoke test on all live domains after deployment.
5. Fix seeded credentials/logging and rotate defaults.
6. Align admin ports and docs.
7. Expand backend test coverage.
8. Review mobile React/Expo dependency version alignment.
9. Complete remaining mobile UI items: admin category icon upload, plan monthly pricing, checkout billing display, trainer duration, amenities cards.
10. Continue blocked roadmap items: PostGIS search, DB indexes, load testing, penetration testing, GDPR, app store submission.

## Step-by-Step Next Process

This is the recommended process before making more feature changes.

### Step 1 - Freeze and Backup

Goal:
- Protect current working production state before changing anything.

Actions:
- Confirm `git status` on server and local.
- Take a database backup.
- Save current nginx configs.
- Save current PM2 process list.
- Add every future fix into the Change Log section of this file before applying it.

Verification:
- Backup file exists.
- PM2 list is saved.
- nginx config test passes.

### Step 2 - Fix Production Database First

Goal:
- Stop backend 500 errors caused by schema drift.

Actions:
- Add missing `gyms` columns properly through a migration.
- Apply migration to production.
- Restart `bmf-backend`.
- Test `/api/v1/gyms`, `/api/v1/gyms/my-gym`, check-in stats, and settlement APIs.

Why first:
- Many portals depend on gym APIs. If DB is broken, UI fixes will still look broken.

### Step 3 - Fix Admin and Wellness HTTPS Routing

Goal:
- Make `admin.bookmyfit.in` and `wellness.bookmyfit.in` serve the correct apps, not AstroCents.

Actions:
- Compare working gym/corporate nginx SSL configs.
- Add correct `listen 443 ssl` server blocks for admin/wellness.
- Run certbot or equivalent SSL setup.
- Reload nginx.
- Verify public HTTPS HTML title/body for both domains.

Verification:
- `https://admin.bookmyfit.in` shows Admin Panel.
- `https://wellness.bookmyfit.in` shows Wellness Portal.
- Neither domain returns AstroCents content.

### Step 4 - Deploy Production Config From Repo

Goal:
- Remove manual-only server drift and make the server match source code.

Actions:
- Deploy the source-controlled production CORS origins or env-driven CORS config.
- Confirm `NEXT_PUBLIC_API_URL=https://bookmyfit.in` for all production builds.
- Align admin/wellness/gym/corporate domain config.

Verification:
- All portals can call backend without CORS errors after a clean build from repo.

### Step 5 - Portal Login Smoke Test

Goal:
- Verify every portal login and dashboard is usable.

Test matrix:
- Admin: `admin@bookmyfit.in`
- Gym: `gym@bookmyfit.in`
- Corporate: `corporate@bookmyfit.in`
- Wellness: test admin/partner account

Actions:
- Login.
- Open dashboard.
- Open one list/API-heavy page.
- Refresh page.
- Logout.

Verification:
- No white page.
- No failed JS chunks.
- No CORS error.
- No 500 API response.

### Step 6 - Fix Payment Safety Before Real Users

Goal:
- Prevent unpaid active subscriptions or fake webhook processing.

Actions:
- Disable Cashfree mock fallback in production.
- Reject missing webhook signatures in production.
- Remove client-controlled `amountOverride`.
- Add payment tests.

Verification:
- Bad Cashfree credentials fail safely.
- Missing webhook signature is rejected.
- Client cannot set payable amount.

### Step 7 - Fix QR Check-In Security

Goal:
- Enforce the LLR rule that every check-in must validate a fresh signed QR token.

Actions:
- Change gym scanner to submit signed QR token.
- Route scanner through `/api/v1/qr/validate`.
- Remove or restrict direct `{ userId }` check-in.
- Keep manual/admin check-in separate with audit reason.

Verification:
- Expired QR fails.
- Duplicate QR fails.
- Wrong-gym QR fails.
- Valid QR succeeds.

### Step 8 - Fix Tasklist and Documentation Accuracy

Goal:
- Make progress tracking trustworthy.

Actions:
- Fix `app: 'wellness'` TypeScript type.
- Update README progress to match current tasklist or mark it stale.
- Update payment docs from Razorpay to Cashfree, or decide gateway.
- Update deployment docs to match PM2/nginx server.
- Update admin port references.

Verification:
- `pnpm --filter tasklist build` passes.
- README setup commands match package scripts.

### Step 9 - Add QA Guardrails

Goal:
- Stop repeat breakages before deployment.

Actions:
- Add more backend tests for auth, gym APIs, payments, QR, subscriptions.
- Add a smoke-test checklist for all portals.
- Add deployment checklist.

Verification:
- Backend build, lint, and tests run.
- All web apps build.
- Mobile TypeScript passes.

### Step 10 - Resume Feature Work

Goal:
- Continue roadmap only after production basics are safe.

Priority after stability:
- PostGIS location search.
- DB indexes and query optimization.
- Load testing with k6.
- Penetration testing.
- GDPR compliance audit.
- App Store and Play Store submission.
- Final UI matching against HTML design references.

## Change Log Template

Use this section when fixes begin.

### Change 001

Date: 2026-05-06
Issue: First stabilization batch before UI work.
Files changed:
- `backend/src/main.ts`
- `backend/src/database/data-source.ts`
- `backend/src/database/migrations/1778000000000-AddGymPricingColumns.ts`
- `apps/tasklist/lib/tasks.ts`
Server commands:
- Not run yet. After deploy, run backend migration on the server before restarting backend.
Planned work:
- Add production CORS origins into source instead of keeping manual-only server changes.
- Add TypeORM data source required by existing migration scripts.
- Add migration for missing `gyms.dayPassPrice` and `gyms.sameGymMonthlyPrice`.
- Fix tasklist TypeScript app type so `app: 'wellness'` builds.
Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter tasklist build` passed.
Status: Completed locally. Production still needs migration run on server before backend restart.

### Change 002

Date: 2026-05-06
Issue: Payment safety hardening.
Files changed:
- `backend/src/modules/payments/cashfree.service.ts`
- `backend/src/modules/payments/payments.module.ts`
- `backend/src/modules/subscriptions/subscriptions.module.ts`
Server commands:
- Not run yet.
Work completed:
- Stop production Cashfree failures from returning mock payment sessions.
- Reject unsigned payment webhooks in production.
- Remove/ignore client-controlled subscription amount override in production.
Verification:
- `pnpm.cmd --filter backend build` passed.
Status: Completed locally.

### Change 003

Date: 2026-05-06
Issue: QR scanner/check-in path can bypass signed QR validation.
Files changed:
- `apps/gym-panel/app/scanner/page.tsx`
- `apps/mobile/app/(gym-portal)/scan.tsx`
- `backend/src/modules/sessions/sessions.module.ts`
Server commands:
- Not run yet.
Work completed:
- Route gym panel scanner through secure QR validation instead of direct `userId` check-in.
- Route mobile gym portal scanner through secure QR validation.
- Block backend direct check-in unless `ALLOW_DIRECT_GYM_CHECKIN=true` is explicitly set.
Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter gym-panel build` passed after Windows sandbox escalation.
Status: Completed locally.

### Change 004

Date: 2026-05-06
Issue: Mobile app font should be changed to Poppins.
Files changed:
- `apps/mobile/package.json`
- `pnpm-lock.yaml`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/theme/brand.ts`
- `apps/mobile/app/(gym-portal)/scan.tsx`
Server commands:
- Not needed.
Work completed:
- Add Expo Poppins font package.
- Load Poppins in the mobile app root layout.
- Update the shared mobile brand font tokens so screens use Poppins consistently.
- Remove old DM Sans and Playfair font dependencies.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
Status: Completed locally.

### Change 005

Date: 2026-05-06
Issue: Mobile homepage needs compact categories, wellness carousel, and post-testimonial gym section.
Files changed:
- `apps/mobile/app/(tabs)/index.tsx`
Server commands:
- Not needed.
Work completed:
- Add Wellness Services horizontal carousel with View All.
- Add gym listing section after What Members Say using existing gym card style.
- Make category section compact with horizontal chips and default dynamic icons.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
Status: Completed locally.

### Change 006

Date: 2026-05-06
Issue: Store page needs working search and UI spacing cleanup.
Files changed:
- `apps/mobile/app/(tabs)/store.tsx`
Server commands:
- Not needed.
Work completed:
- Added working product search by name, brand, category, and description.
- Added clear search action and empty search state.
- Tightened category scroll behavior and product grid spacing.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
Status: Completed locally.

### Change 007

Date: 2026-05-06
Issue: Full local testing pass after stabilization and UI changes.
Files changed:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made during this local test pass.
Testing completed:
- Ran full workspace production build.
- Re-ran mobile TypeScript validation.
- Ran workspace lint and test commands to identify QA tooling gaps.
- Ran individual frontend lint scripts for packages that define lint commands.
Verification:
- `pnpm.cmd run build` passed after Windows sandbox escalation.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd -r lint` failed because backend `eslint` is missing.
- `pnpm.cmd -r test` failed because backend Jest has no test files.
- `pnpm.cmd --filter admin-panel lint`, `pnpm.cmd --filter landing lint`, and `pnpm.cmd --filter tasklist lint` opened the Next.js ESLint setup prompt instead of running checks.
Errors found:
- Backend lint tooling is incomplete.
- Backend automated tests are missing.
- Frontend lint tooling is not configured for non-interactive QA/CI.
- Local browser/runtime login testing was not completed because local backend/database services were not started in this pass.
Status: Completed locally. Build/typecheck health was good; lint/test setup issues were fixed in Change 008. Browser/runtime login testing still needs local services or live-server access.

### Change 008

Date: 2026-05-06
Issue: Fix lint/test tooling errors found in Change 007.
Files changed:
- `package.json`
- `pnpm-lock.yaml`
- `backend/.eslintrc.cjs`
- `backend/jest.config.js`
- `backend/test/cashfree.service.spec.ts`
- `apps/admin-panel/.eslintrc.json`
- `apps/landing/.eslintrc.json`
- `apps/tasklist/.eslintrc.json`
- `apps/admin-panel/app/homepage/page.tsx`
- `apps/admin-panel/app/ratings/page.tsx`
- `apps/admin-panel/app/wellness/page.tsx`
- `apps/admin-panel/app/analytics/page.tsx`
- `apps/admin-panel/app/categories/page.tsx`
- `apps/admin-panel/app/corporate/[id]/employees/page.tsx`
- `apps/admin-panel/app/store/page.tsx`
- `apps/admin-panel/components/AuthGuard.tsx`
- `apps/admin-panel/components/Toast.tsx`
- `backend/src/modules/checkins/checkins.module.ts`
- `backend/src/modules/corporate/corporate.module.ts`
- `backend/src/modules/gyms/gyms.module.ts`
- `backend/src/modules/misc/misc.module.ts`
- `backend/src/modules/sessions/sessions.module.ts`
- `backend/src/modules/subscriptions/subscriptions.module.ts`
- `backend/src/modules/users/users.module.ts`
- `backend/src/modules/wellness/wellness.module.ts`
Server commands:
- Not run. No server changes were made during this local tooling fix.
Work completed:
- Added missing ESLint dependencies to the workspace.
- Added backend ESLint config so `backend lint` runs.
- Added Next ESLint configs so admin, landing, and tasklist lint run without prompts.
- Fixed admin JSX text escaping errors that blocked lint.
- Added backend Jest config.
- Added Cashfree service tests for production payment safety and webhook signature verification.
- Cleaned backend and admin lint warnings.
- Fixed corporate monthly active check-in counting to use the current-month date filter.
- Accepted small ESLint auto-fixes in backend code.
Verification:
- `pnpm.cmd -r lint` passed with no warnings.
- `pnpm.cmd -r test` passed.
- `pnpm.cmd --filter backend test -- --runInBand` passed.
- `pnpm.cmd run build` passed after Windows sandbox escalation.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
Status: Completed locally. QA commands now run cleanly and pass.

### Change 009

Date: 2026-05-06
Issue: Build Android APK for phone testing.
Files changed:
- `apps/mobile/package.json`
- `apps/mobile/index.js`
- `artifacts/BookMyFit-preview.apk`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made during this APK build.
Errors found:
- EAS cloud build is blocked for the current login because the configured EAS project `deab094a-848d-483d-9e83-d7f69adac2da` under owner `qwegle` is not accessible to account `nikhilesh992`.
- Local Android build failed from the OneDrive project path because Windows/CMake hit long native build paths.
- Expo/Metro initially resolved the mobile entry from the monorepo root instead of the mobile app root.
Work completed:
- Built the APK locally from a short temporary folder: `C:\bmf-apk-build`.
- Added `apps/mobile/index.js` as a stable Expo Router entry.
- Updated `apps/mobile/package.json` to use `index.js` as the app entry.
- Patched the temporary generated Android Gradle config so Metro bundles `apps/mobile/index.js`.
- Copied the finished APK into the repo at `artifacts/BookMyFit-preview.apk`.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Local Android `gradlew.bat assembleRelease` passed.
- APK size: `98,453,148` bytes.
- APK SHA256: `DCA0C651842E04B6AB181E6CAF409482E0A0D980F93186AB8AC145C7A9E5FF20`.
Status: Superseded by Change 010 after the first APK crashed on phone startup.

### Change 010

Date: 2026-05-06
Issue: First Android APK installed but crashed immediately on phone startup.
Files changed:
- `artifacts/BookMyFit-preview.apk`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made during this APK crash fix.
Errors found:
- ADB could not capture the phone log because no Android device was connected/listed on this machine.
- The first APK build packaged an incomplete Expo/Metro bundle from the monorepo root. The bad APK bundle only included `947` modules and `26` assets.
- A clean Expo export from the actual mobile app root bundled `1390` modules and the full route/asset set, so the crash was most likely caused by the wrong Gradle/Metro entry root used during the temporary local APK build.
Work completed:
- Rebuilt the APK from the short local build folder with the mobile app root restored.
- Forced the Android bundle task to use `apps/mobile/index.js` as the Expo Router entry while running from the mobile project context.
- Replaced `artifacts/BookMyFit-preview.apk` with the corrected APK.
- Removed the temporary local export folder `apps/mobile/dist-apk-check`.
Verification:
- `pnpm.cmd --filter mobile exec expo export --platform android --output-dir dist-apk-check --clear` passed after Windows sandbox escalation.
- Android `gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks` passed.
- Android `gradlew.bat assembleRelease` passed.
- Corrected APK size: `100,877,755` bytes.
- Corrected APK SHA256: `C6F1F1C7F69966064A5F45F6A42842D2F3336A5F9E4B7537B5B3F1F1845AB4B0`.
Status: Corrected APK is ready for reinstall and phone testing.

### Change 011

Date: 2026-05-06
Issue: Corrected APK from Change 010 still crashed immediately on startup.
Files changed:
- `package.json`
- `pnpm-lock.yaml`
- `artifacts/BookMyFit-preview.apk`
- `artifacts/bookmyfit-fixed-open.png`
- `artifacts/bookmyfit-data-app-crash.txt`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made during this APK crash fix.
Errors found:
- Android crash log showed `com.facebook.react.common.JavascriptException`.
- Exact startup crash: `TypeError: Cannot read property 'S' of undefined`.
- The React Native renderer was reading `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`, but mobile was resolving React `18.3.1`.
- Expo SDK 54 / React Native `0.81.5` requires React `19.1.0`; the root `pnpm.overrides` forced all workspaces, including mobile, to React `18.3.1`.
Work completed:
- Removed the global React/React DOM/type overrides from the root `package.json`.
- Refreshed `pnpm-lock.yaml` with `pnpm install`.
- Verified mobile now resolves React `19.1.0`.
- Rebuilt the Android APK from the short local build folder.
- Replaced `artifacts/BookMyFit-preview.apk` with the newly rebuilt APK.
- Installed and launched the APK on the local Pixel Android emulator.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Android `gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks` passed.
- Android `gradlew.bat assembleRelease` passed.
- Emulator install passed.
- Emulator launch passed; app stayed foreground on `in.bookmyfit.app/.MainActivity`.
- Screenshot captured at `artifacts/bookmyfit-fixed-open.png`.
- Fixed APK size: `100,878,303` bytes.
- Fixed APK SHA256: `019D243E74702AB5BCE3CA4B9EDAA538BCE1B77F253DB31ECFE1F0FE04A21916`.
Status: Completed locally. APK is runnable on the emulator and ready for phone testing.

### Change 012

Date: 2026-05-06
Issue: Latest mobile UI review found several layout and flow problems on the app home, gym detail, and duration screens.
Files changed:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/gym/[id].tsx`
- `apps/mobile/app/duration.tsx`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made for these mobile UI fixes.
Errors found:
- Home page Wellness Services was rendering above Featured Gyms instead of after the Featured Gyms slider.
- Home page Gyms Near You was using the same horizontal slider layout, but it needs a vertical list format.
- Gym detail amenities were still using generic text/check styling instead of meaningful icon cards.
- Duration screen sticky checkout footer could cover scrollable content on small mobile screens.
- Personal Trainer add-on did not auto-match the selected membership duration and did not provide separate trainer duration controls.
Work completed:
- Moved Wellness Services to render immediately after Featured Gyms.
- Rebuilt Gyms Near You as compact vertical list cards with image, rating, location, price/action, and View All.
- Added automatic amenity icon mapping and modern two-column amenity cards on the gym detail screen.
- Kept gym detail categories as compact separate chips so amenity styling does not make category tags bulky.
- Reworked the Choose Duration screen with larger scroll bottom padding, a compact sticky checkout footer, and safer mobile text wrapping.
- Added trainer duration chips for 1, 3, 6, and 12 months.
- Trainer duration now auto-syncs to the selected membership duration first, while still allowing the user to change it separately.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Temporary APK build first failed because `C:\bmf-apk-build\apps\mobile\android` did not have an Android SDK path. Fixed by adding `local.properties` with the local SDK path in the temporary build folder.
- Android `gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks` passed from `C:\bmf-apk-build`.
- Android `gradlew.bat assembleRelease` passed from `C:\bmf-apk-build`.
- New APK copied to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,883,387` bytes.
- New APK SHA256: `3A7604031C8CE0ABF82AD09E0ED4478756918F8E544D531E985A34CE0CFFFCAC`.
- Emulator install passed.
- Emulator launch passed; app stayed foreground on `in.bookmyfit.app/.MainActivity`.
- Screenshot captured at `artifacts/bookmyfit-ui-fixes-open.png`.
Status: Completed locally. New APK is ready for phone testing.

### Change 018

Date: 2026-05-06
Issue: Nikhilesh asked to test the Android APK login flow using the provided phone number and OTP.
Files changed:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
- `artifacts/bookmyfit-login-test-home.png`
- `artifacts/bookmyfit-login-test-log.txt`
- `artifacts/bookmyfit-window-login.xml`
- `artifacts/bookmyfit-window-after-account.xml`
- `artifacts/bookmyfit-window-after-phone.xml`
- `artifacts/bookmyfit-window-after-phone-continue.xml`
- `artifacts/bookmyfit-window-after-phone-hidekeyboard.xml`
- `artifacts/bookmyfit-window-after-otp.xml`
- `artifacts/bookmyfit-window-home-after-login.xml`
- `artifacts/bookmyfit-window-back-dialog.xml`
Server commands:
- Not run. No live server files or PM2 services were changed in this test.
Test steps completed:
- Reinstalled latest local APK `artifacts/BookMyFit-preview.apk` on emulator `emulator-5554`.
- Cleared local emulator app data for a fresh login test.
- Launched `in.bookmyfit.app/.MainActivity`.
- Opened `I already have an account`.
- Entered phone number `9040283338`.
- Continued to OTP screen; app showed `Welcome back, Nikhilesh!`.
- Entered OTP `123456`.
- Allowed Android location permission for the test.
- Confirmed the logged-in Home screen loaded.
- Pressed Android back on Home and confirmed it shows `Exit BookMyFit` with `CANCEL` and `EXIT`, instead of returning to Login.
Verification:
- APK install passed.
- App cold launch passed.
- Login with the provided number and OTP passed.
- Home screen loaded with city, category chips, featured gyms, wellness section, and bottom tabs.
- Back-button exit confirmation passed.
- Saved screenshot: `artifacts/bookmyfit-login-test-home.png`.
- Saved log: `artifacts/bookmyfit-login-test-log.txt`.
- No `FATAL EXCEPTION`, React Native runtime error, or obvious app auth/server failure was found in the captured login-session log scan.
Status: Completed locally. Login is working in the tested APK.

### Change 017

Date: 2026-05-06
Issue: Latest phone screenshots showed subscribed gyms were not marked in listings, users could re-enter subscription purchase for the same gym, Android back navigation could return to login after login, and some pages still had extra top/bottom spacing.
Files changed:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/gyms.tsx`
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/plans.tsx`
- `apps/mobile/app/wellness.tsx`
- `backend/src/modules/subscriptions/subscriptions.module.ts`
- `artifacts/BookMyFit-preview.apk`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No live server files or PM2 services were changed in this pass.
Errors found:
- Active same-gym/day-pass subscriptions were not shown on home `Gyms Near You` or the full gym listing.
- Users could still tap into plan purchase again for a gym they already subscribed to.
- Android hardware back from the logged-in tab app could navigate backward through history and expose login again.
- Opening `/login` while a token already existed did not automatically redirect the user back into the app.
- `Gyms Near You` and `Spa & Recovery` still had more top spacing than needed on Android.
- Search, filter chips, and headers needed tighter mobile sizing to avoid wasting vertical space.
Work completed:
- Loaded active subscriptions on home and the full gym list.
- Marked subscribed gyms with `ACTIVE`, `Subscribed`, or `Multi-gym active` badges.
- Changed subscribed gym CTAs from `View Plans` / `View` to `Book Slot` / `Book`.
- Routed subscribed gym actions to `/slots?gymId=...` instead of the purchase flow.
- Added a guard on the plans screen so same-gym/day-pass plans for an already active gym show `Already Active` and return to the gym instead of checkout.
- Added backend duplicate protection so a user cannot purchase a second active same-gym/day-pass subscription for the same gym once this backend code is deployed.
- Added Android back handling in the tab app: back moves to Home first, then asks before exiting instead of returning to Login.
- Added login-token redirect so authenticated users do not remain on the login screen.
- Tightened Android top spacing, search height, filter chips, and wellness header/hero spacing.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter backend build` passed.
- `git diff --check` passed for the edited mobile/backend files.
- Synced changed files to `C:\bmf-apk-build`.
- Android `gradlew.bat assembleRelease` passed.
- New APK copied to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,894,115` bytes.
- New APK SHA256: `6D5A29D1667C4B648B2DDD3C6A5A940E53269B3E88F6A13244484ECB072483BD`.
- Emulator install passed with `adb install -r`.
- Emulator launch passed with `am start -W`; no `FATAL EXCEPTION` / `AndroidRuntime` crash was found in the app startup log scan.
- Deep-link smoke tests for `bookmyfit://gyms` and `bookmyfit://wellness` delivered to the running app without app crash logs.
Production follow-up required:
- Deploy the backend change and restart `bmf-backend` before duplicate subscription protection works on the live server.
- Deploy the mobile/backend API fixes to production if the live app is still using the older backend bundle.
Status: Completed locally. New APK is ready for phone testing; no live server change was made in this pass.

### Change 016

Date: 2026-05-06
Issue: Latest phone screenshots showed remaining mobile UI problems, broken membership loading, incorrect gym pricing source, wellness buttons/search not working, and the live public gyms API returning `500`.
Files changed:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/gyms.tsx`
- `apps/mobile/app/wellness.tsx`
- `apps/mobile/app/duration.tsx`
- `apps/mobile/app/order.tsx`
- `apps/mobile/app/plans.tsx`
- `apps/mobile/app/gym/[id].tsx`
- `apps/mobile/lib/api.ts`
- `backend/src/modules/subscriptions/subscriptions.module.ts`
- `backend/src/modules/gyms/gyms.module.ts`
- `artifacts/BookMyFit-preview.apk`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No live server files or services were changed in this pass.
Live API checks:
- `GET https://bookmyfit.in/api/v1/subscriptions/plans` passed.
- `GET https://bookmyfit.in/api/v1/wellness/partners?page=1&limit=3` passed.
- `GET https://bookmyfit.in/api/v1/wellness/services/all` passed.
- `GET https://bookmyfit.in/api/v1/gyms?page=1&limit=3` returned `500 Internal server error`.
Errors found:
- Home still showed the trust strip and `What Members Say`; Nikhilesh asked to remove both.
- Featured Gym rank numbers were still inside/over the card instead of outside on the left side.
- `Gyms Near You` search/sort/category chips looked too tall and cramped on mobile.
- Personal Trainer add-on allowed durations longer than the selected membership duration.
- Order creation was not sending selected PT duration to the backend.
- Plan cards used fallback/static prices instead of reading subscription config, selected gym data, and gym plan data.
- Gym detail footer used the lowest total gym plan amount as `/mo`, which is wrong for 3/6/12 month plans.
- Wellness search icon, service type cards, service cards, and `See all` buttons did not trigger useful actions.
- My Memberships and public gym listing can fail on production when the DB has not been migrated for `dayPassPrice` / `sameGymMonthlyPrice`.
Work completed:
- Removed the home trust strip and testimonial section while keeping `Gyms Near You`.
- Moved Featured Gym rank number outside the card, aligned to the left side.
- Tightened `Gyms Near You` search/sort/category chip UI and increased list bottom padding.
- Added wellness search input, service filtering, service type actions, service card navigation, and empty search state.
- Limited PT add-on duration choices to the selected membership duration and auto-syncs PT duration when plan duration changes.
- Sent PT duration and total amount through mobile order API payload.
- Made pass pricing load from `/subscriptions/plans`, selected gym, and `gym-plans/by-gym/:id`.
- Fixed gym detail `Starting from` to calculate lowest monthly price from gym plan duration instead of raw total amount.
- Hardened backend `/subscriptions` gym-name enrichment so it no longer selects full gym entities when only `id/name` are needed.
- Hardened backend gym list/detail and gym-owner lookup queries to avoid selecting missing pricing columns on older production DBs.
- Rebuilt the Android APK.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter backend build` passed.
- Synced changed files to `C:\bmf-apk-build`.
- Android `gradlew.bat assembleRelease` passed.
- New APK copied to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,888,031` bytes.
- New APK SHA256: `59A4235947768CA60001BCA17C85CF69E38BC6C8A2EB82DD42DACB0C2584B662`.
- Emulator install passed with `adb install -r`.
- Emulator launch passed with `am start -W`; no `FATAL EXCEPTION` / `AndroidRuntime` startup crash was found in the recent log scan.
Production follow-up required:
- Deploy the backend changes and restart `bmf-backend`.
- Apply/verify the production DB migration for `gyms.dayPassPrice` and `gyms.sameGymMonthlyPrice`; the code now avoids the crash, but the real pricing fields still need to exist for exact per-gym pricing management.
Status: Completed locally. New APK is ready for phone testing; live server still needs deployment/migration for `/gyms` to stop returning `500`.

### Change 015

Date: 2026-05-06
Issue: Corporate portal login details needed confirmation because `https://corporate.bookmyfit.in/` login did not work for the user.
Files changed:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server files or services were changed.
Checks completed:
- Tested live backend login endpoint `https://bookmyfit.in/api/v1/auth/admin/login`.
- `corporate@bookmyfit.in` / `corporate123` returned `role=corporate_admin` and an access token.
- `hr@techcorp.in` / `hr123` failed with `400 Bad Request`.
Finding:
- Corporate login should use `corporate@bookmyfit.in` / `corporate123`.
- The old seeded/default email shown in the corporate login field, `hr@techcorp.in`, is misleading because its seeded password `hr123` is only 5 characters and fails the current `MinLength(6)` validation.
Status: Confirmed. No code/server change made.

### Change 014

Date: 2026-05-06
Issue: Android system status/navigation bars were overlapping mobile app UI, and Featured Gyms ranking did not match the client's left-side outlined number reference.
Files changed:
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/explore.tsx`
- `apps/mobile/app/(tabs)/bookings.tsx`
- `apps/mobile/app/(tabs)/profile.tsx`
- `apps/mobile/app/(tabs)/store.tsx`
- `apps/mobile/app/(tabs)/subscriptions.tsx`
- `apps/mobile/app/(gym-portal)/_layout.tsx`
- `apps/mobile/app/(gym-portal)/index.tsx`
- `apps/mobile/app/(gym-portal)/scan.tsx`
- `apps/mobile/app/(gym-portal)/members.tsx`
- `apps/mobile/app/(gym-portal)/earnings.tsx`
- `apps/mobile/app/(gym-portal)/kyc.tsx`
- `apps/mobile/app/duration.tsx`
- `apps/mobile/app/gym/[id].tsx`
- `apps/mobile/app/product/[id].tsx`
- `apps/mobile/app/wellness/book-service.tsx`
- `apps/mobile/app/order.tsx`
- `apps/mobile/app/cart.tsx`
- `artifacts/BookMyFit-preview.apk`
- `artifacts/bookmyfit-safearea-rank-check.png`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made for this mobile UI/APK fix.
Errors found:
- Android 3-button/gesture navigation can still overlap UI when fixed footers only use hardcoded bottom padding.
- Main customer tab bar and gym-owner portal tab bar needed stronger Android bottom inset fallback.
- Tab pages had only 40-48px bottom scroll padding, so final content could sit behind the bottom tab menu.
- Fixed purchase/detail footers on gym detail, duration, product detail, wellness booking, order, and cart screens needed safe-area-aware bottom padding.
- Featured Gym cards still used text like `#1`; the client wanted a large outlined rank number on the left side like the provided reference.
Work completed:
- Increased Android bottom safe padding for the main app tab bar and gym-owner portal tab bar.
- Added tab item vertical padding, shadow/elevation, and keyboard hiding for cleaner bottom menu behavior.
- Added larger bottom scroll padding on customer tab pages and gym-owner portal pages.
- Added safe-area bottom padding to fixed CTA/checkout bars on gym detail, duration, product detail, wellness booking, order, and cart.
- Added matching extra scroll spacer where a fixed bottom bar is present, so page content can scroll fully above it.
- Replaced Featured Gyms `#1` text with a large green outlined left-side rank number using `react-native-svg`.
- Rebuilt the test APK and copied it to `artifacts/BookMyFit-preview.apk`.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed locally.
- Copied changed files into `C:\bmf-apk-build`.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed inside the APK build folder.
- Android `gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks` passed.
- Android `gradlew.bat assembleRelease` passed.
- New APK copied to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,885,263` bytes.
- New APK SHA256: `B061ED0ABC20F1B3D3E9C3D1436852785140F42EE3A89AB2F8898F4BA5B70A42`.
- Emulator install passed with `adb install -r`.
- Emulator launch passed; app stayed foreground on `in.bookmyfit.app/.MainActivity`.
- Screenshot captured at `artifacts/bookmyfit-safearea-rank-check.png`.
Status: Completed locally. New APK is ready for phone testing.

### Change 013

Date: 2026-05-06
Issue: My Memberships screen showed demo/cached subscription cards and the new subscription flow sent users to Explore instead of the real gym list.
Files changed:
- `apps/mobile/app/(tabs)/subscriptions.tsx`
- `apps/mobile/app/plans.tsx`
- `apps/mobile/app/order.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run. No server changes were made for this mobile flow fix.
Errors found:
- My Memberships used hardcoded fallback subscriptions when `/subscriptions` failed or returned an empty list.
- The fallback cards made demo memberships appear as if they were real user packages.
- The error banner said live data could not load while still showing sample/cached results.
- Same Gym Pass and One Day Pass require a selected gym, but the no-gym plan flow sent users to the Explore tab instead of the actual gym listing screen.
- Multi Gym Pass does not need a selected gym, but its CTA text said Browse Gyms, which made the flow confusing.
- Order Summary still displayed the PT add-on as one month even when the selected trainer duration was longer.
- Home hero/banner slider was inset with left/right spacing instead of full screen width.
Work completed:
- Removed demo subscription fallback data from My Memberships.
- Added a safer live subscription response normalizer for common API shapes.
- My Memberships now shows only live subscriptions, or a real empty/error state with Retry.
- Added plan/package name display on subscription cards above the gym/network name.
- Changed empty-state Browse Gyms to route to `/gyms`.
- Changed Same Gym Pass and One Day Pass no-gym CTA behavior to go directly to `/gyms`.
- Changed Multi Gym Pass CTA text to Continue because it can proceed without gym selection.
- Updated Order Summary to display PT add-on cost using the selected trainer duration.
- Made the home banner slider full width with no left/right inset.
Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Android `gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks` passed from `C:\bmf-apk-build`.
- Android `gradlew.bat assembleRelease` passed from `C:\bmf-apk-build`.
- New APK copied to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,884,379` bytes.
- New APK SHA256: `DDFC3CA445C8BCD6AE37E48DF1DF93E36717A7B78067325BB3C1BE333A7DF80D`.
- Emulator install passed.
- Emulator launch passed; app stayed foreground on `in.bookmyfit.app/.MainActivity`.
Status: Completed locally. New APK is ready for phone testing.

### Change 019

Date: 2026-05-06
Issue: Spa & Recovery, gym listing, same-gym pass purchase, Passes API, admin actions, and admin menu needed another connection and UI cleanup pass.
Files changed:
- `apps/mobile/app/wellness.tsx`
- `apps/mobile/app/spa-centres.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/gyms.tsx`
- `apps/mobile/app/gym/[id].tsx`
- `apps/mobile/app/plans.tsx`
- `apps/mobile/app/duration.tsx`
- `apps/mobile/app/order.tsx`
- `apps/mobile/lib/api.ts`
- `backend/src/modules/subscriptions/subscriptions.module.ts`
- `backend/src/modules/misc/misc.module.ts`
- `backend/src/modules/wellness/wellness.module.ts`
- `apps/admin-panel/app/categories/page.tsx`
- `apps/admin-panel/app/wellness/page.tsx`
- `apps/admin-panel/components/Shell.tsx`
- `artifacts/BookMyFit-preview.apk`
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
Server commands:
- Not run from local Codex. The backend fix is ready locally, but the live server must pull/build/restart before the live app stops showing the Passes error.
Errors found:
- Spa & Recovery had an unnecessary top search bar.
- Spa & Recovery `See all`, `Spa Centre`, and `Home Service` actions were not connected to real screens.
- No dedicated Spa Centres list screen existed in the mobile route stack.
- Gyms Near You had too much blank vertical space below the category chips.
- Gym Details repeated location/timing information below the Location map even though the same information already existed above.
- Same Gym Pass was still using generic duration pricing instead of gym-managed plans.
- Checkout did not send the selected same-gym `gymPlanId` to the backend.
- Passes/My Memberships could still fail with `Internal server error` against a production database that does not match every newer entity column.
- Admin category and amenity delete/reject actions were mostly local UI actions instead of real API actions.
- Admin wellness partner/service remove and service status actions were mostly local UI actions instead of real API actions.
- Admin sidebar/megamenu styling looked too flat and cramped.
Work completed:
- Removed the Spa & Recovery top search bar.
- Added a new `spa-centres` mobile screen and registered it in the app router.
- Connected Spa & Recovery `See all` and `Spa Centre` actions to the Spa Centres list.
- Connected `Home Service` to the existing Home Services screen.
- Reduced Gyms Near You category chip height/spacing and removed the large blank gap before the list.
- Removed the duplicate Hours & Address section from the Gym Details page.
- Connected Same Gym Pass duration choices to real gym plans when a gym has plans.
- Added `gymPlanId` support through plan selection, duration selection, order summary, and subscription order API calls.
- Kept personal trainer duration constrained to the selected membership duration, so a 3-month pass cannot silently attach a 6-month trainer package.
- Hardened backend subscription reads with safe raw selects for active and admin subscription lists to avoid production schema drift errors.
- Added backend delete/reject endpoints for master categories and amenities.
- Added backend delete/deactivate endpoints for wellness partners and services.
- Updated Admin Panel category, amenity, wellness partner, and wellness service actions to call the backend APIs.
- Refined Admin Panel sidebar/megamenu design with clearer active states, spacing, grouping, and dark premium styling.
- Rebuilt the test APK and copied it to `artifacts/BookMyFit-preview.apk`.
Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- APK copied to `C:\bmf-apk-build`, Android release build passed, and the new APK was copied back to `artifacts/BookMyFit-preview.apk`.
- New APK size: `100,900,087` bytes.
- New APK SHA256: `50585985D2A1B5788AA0168EDDAA9880BABA8A48CA292F2392DF8FA18E39D7EE`.
- Emulator device detected: `emulator-5554`.
- APK install passed with `adb install -r`.
- APK launch passed; no app crash was seen after launch.
- Screenshot captured at `artifacts/bookmyfit-postfix-launch.png`.
- Passes screen was checked after installing the APK. It still shows a live API error because the phone/emulator app is calling the production server, and the production backend has not yet been updated with this local fix.
- Admin Panel compile/type phase passed, but local `next build` prerender failed in this Windows install with a React/styled-jsx runtime mismatch around static error pages. This looks like a local node_modules/build-environment issue, not a TypeScript error from the current admin changes.
Next server step:
- On the live server, first run `cd /var/www/html/bookmyfit && git status`.
- If it is clean and this local fix has been pushed/pulled there, run `pnpm --filter backend build`.
- Then run `pm2 restart bmf-backend`.
- Then check `pm2 logs bmf-backend --lines 80 --nostream`.
Status: Completed locally. APK is ready, but the Passes API fix needs backend deployment on the live server.

### Change 020

Date: 2026-05-11
Issue: Full repo re-audit requested by Nikhilesh, with local database/API verification instead of live API verification.

Files changed:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`

Application code changed:
- None. This was an audit, local DB setup, local API smoke test, and report update only.

Parallel audit:
- 6 subagents were spawned for database/config, backend security, admin panel, gym/corporate/wellness panels, mobile app, and docs/tasklist consistency.
- 4 subagents returned detailed findings.
- 2 subagents did not finish after repeated waits and were closed. Their incomplete work was not used as final evidence.

Local database and local API status:
- Root `.env` was not present.
- `backend/.env` was not present.
- Because no local env file supplied `DATABASE_URL`, the backend can use the local fallback DB config: `localhost:5432`, user `postgres`, database `bookmyfit`.
- Docker was initially reachable only after starting Docker Desktop, and no local containers were running at first.
- `docker compose up -d` was run from the repo and started:
  - `bmf-postgres` on `localhost:5432`
  - `bmf-redis` on `localhost:6379`
- `pg_isready` confirmed the local `bookmyfit` database accepts connections.
- Before backend boot, the local database had no relations.
- After booting the backend in development mode, TypeORM synchronize created 33 local public tables and `SeedService` seeded local demo data.
- The local API was tested only at `http://localhost:3003/api/v1`, not against production.

Local API smoke results:
- `GET /api/v1/health` returned `200`.
- `GET /api/v1/gyms` returned `200`.
- `GET /api/v1/subscriptions/plans` returned `200`.
- `GET /api/v1/homepage/config` returned `200`.
- `GET /api/v1/wellness/partners` returned `200`.
- `GET /api/v1/store/products` returned `200`.
- `GET /api/v1/analytics/summary` returned `401 Unauthorized`, expected because this route requires a super admin token.

Verification commands and results:
- `pnpm.cmd --filter backend build` passed when rerun outside the Windows sandbox. First sandbox run failed with an `EPERM unlink` on `backend/dist`, which was environment permission noise.
- `pnpm.cmd --filter backend test -- --runInBand` passed when rerun outside the Windows sandbox. Result: 1 suite passed, 3 tests passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter admin-panel build` failed. It compiles and generates pages, then fails prerendering `/_error` for `/404` and `/500` with `TypeError: Cannot read properties of null (reading 'useContext')` from `styled-jsx` / React server render.
- `pnpm.cmd --filter gym-panel build` timed out after 5 minutes at the start of `next build`.
- `pnpm.cmd --filter corporate-panel build` and `pnpm.cmd --filter @bmf/wellness-portal build` also timed out during the concurrent build attempt, so they were not counted as passing in this audit.

Errors and risks still open:

1. Hard-coded external database seed script.
   - `backend/bmf-seed.js` contains a hard-coded external Postgres connection string and uses it directly.
   - This bypasses local DB settings and can seed/write to a cloud database by mistake.
   - Do not run this script for local testing as written.
   - Rotate the exposed database credential and rewrite the script to use env/local config only.

2. `DATABASE_URL` can override local DB unintentionally.
   - `backend/src/app.module.ts` and `backend/src/database/data-source.ts` prioritize `DATABASE_URL`.
   - For local testing, `DATABASE_URL` must stay unset, otherwise the backend may connect to live/staging instead of Docker Postgres.
   - In non-production mode, TypeORM `synchronize` can mutate whichever DB is selected.

3. Seed data runs on app boot unless explicitly disabled.
   - `backend/src/database/seed.service.ts` only skips when `SEED_ON_BOOT=false`.
   - `.env.example` does not document `SEED_ON_BOOT`.
   - Production should explicitly set `SEED_ON_BOOT=false`.

4. Migration workflow exists but is incomplete.
   - Current repo has `backend/src/database/migrations/1778000000000-AddGymPricingColumns.ts`.
   - That migration only covers `gyms.dayPassPrice` and `gyms.sameGymMonthlyPrice`.
   - It does not build a fresh production schema from zero.
   - Local development worked because TypeORM synchronize created tables, but production should not rely on synchronize.

5. Production DB schema drift is still a live deployment blocker.
   - Local DB now has the expected synced schema, and local `/gyms` returns `200`.
   - This does not prove the live DB is fixed.
   - The live server still needs the backend deployment plus DB migration/verification for `gyms.dayPassPrice` and `gyms.sameGymMonthlyPrice`.

6. Mobile app still points at live API by default.
   - `apps/mobile/lib/api.ts` hard-codes `API_BASE = 'https://bookmyfit.in'`.
   - `EXPO_PUBLIC_API_URL` and Expo `extra.apiUrl` are not used by that file.
   - This means APK/mobile testing can silently hit production even when local DB/API are available.
   - For local mobile testing, this must be changed to use env/config or a local LAN URL.

7. Mobile Cashfree WebView is sandbox-hardcoded.
   - `apps/mobile/app.config.js` sets `cashfreeBaseUrl` to `https://sandbox.cashfree.com`.
   - `apps/mobile/app/payment-webview.tsx` uses that value.
   - Production order/session settings must be aligned before real payment testing.

8. QR validation is still replayable and not strongly bound to the booked gym/session.
   - Slot booking creates QR data with gym/booking identifiers.
   - `/qr/validate` checks Redis `qr:used:${jti}` only briefly and does not mark `booking_qrs.usedAt`.
   - The QR validation path needs to enforce booking/gym ownership, expiry, one-time use, and durable used state.

9. `/checkins/scan` can still allow manual/forged check-ins.
   - `backend/src/modules/checkins/checkins.module.ts` has `@Roles()` with no role list on `POST /checkins/scan`.
   - The controller accepts supplied user IDs and optional QR token behavior still needs hardening.
   - This remains part of the QR/check-in security fix, even if current mobile scanner uses `/qr/validate`.

10. Subscription pricing still accepts client-controlled amount override.
   - `backend/src/modules/subscriptions/subscriptions.module.ts` still reads `amountOverride`.
   - Mobile sends totals from the client order screen.
   - Backend should calculate final payable amount from server-owned plan/gym/coupon data only.

11. OTP dev behavior can become a production auth bypass.
   - Backend uses fixed OTP behavior and returns `devOtp` when SMS is not configured.
   - Mobile also shows a fixed OTP hint.
   - Production must fail closed when Twilio/SMS config is missing.

12. Admin master-data and ratings endpoints are not protected server-side.
   - `backend/src/modules/misc/misc.module.ts` exposes category, amenity, coupon, notification, video, and rating mutation routes without consistent `JwtAuthGuard` and `RolesGuard`.
   - Client-side admin guards are only UX controls and do not secure these API routes.

13. Admin wellness page can show demo/local data as if it were real.
   - `apps/admin-panel/app/wellness/page.tsx` initializes from hard-coded spa/service arrays.
   - API failures or empty API responses can leave demo data visible.
   - Some create/update failure paths still append `local_*` items and show `Saved locally`.

14. Homepage builder can report success even when save fails.
   - `apps/admin-panel/app/homepage/page.tsx` catches and ignores `/homepage/config` save errors.
   - It still shows a success toast after toggling.
   - If backend sections are not loaded, it may try to save an empty `sections` payload.

15. Admin analytics revenue chart expects the wrong monthly revenue field.
   - Backend returns monthly rows using `revenue`.
   - Admin analytics interface/chart reads `amount`.
   - This can produce incorrect bars/labels when real data exists.

16. Build health is not clean.
   - Backend build and tests pass.
   - Mobile TypeScript passes.
   - Admin production build fails on static error page prerender.
   - Gym panel build timed out in this environment.
   - Corporate and wellness portal builds were not proven clean in this audit.

17. Documentation is stale and contradictory.
   - README still says progress is about 25%, but tasklist shows 192 done, 6 blocked, 198 total.
   - Several docs still mention Razorpay, while current code uses Cashfree.
   - `.env.example` still points frontend API variables at `localhost:3001`; current backend API is `localhost:3003`.
   - `PROJECT_STRUCTURE.md` documents test and seed commands that do not exist or do not match current behavior.

Status:
- Local database exists now and is usable through Docker.
- Local backend API can run against that local DB and core public endpoints pass smoke checks.
- No live API checks were used for this audit pass.
- No production server changes were made.
- Previous pause note is superseded by Change 021 below, where Nikhilesh selected the after-login single-gym subscription flow as the next priority.

## Change 021 - After-login single-gym subscription flow

Date: 2026-05-11

Scope requested:
- Ignore OTP/login for now.
- Focus on app behavior after login.
- If a user buys a single-gym pass, the app must show which gym is subscribed, prevent buying another active pass for that same gym before it ends, and make booking/QR flow work after subscription.

Errors found:
- Mobile subscription state was parsed separately in multiple screens, and date-only `endDate` values could be treated as expired at the start of the day.
- Gym detail could treat an active subscription with empty `gymIds` as valid for every gym, so the wrong gym could appear subscribed.
- Success, gym detail, and subscription detail were sending users to `/qr` before a slot was booked. The QR screen expects a booked slot, so users landed on a broken "no booked session" path.
- Checkout lost the selected `gymName`, so success/order screens could show generic "Selected Gym" instead of the actual gym.
- `/slots` booked with only `slotId`, which could let the backend choose an ambiguous active subscription when the user has more than one.
- Backend purchase blocked duplicate active same-gym/day-pass subscriptions, but activation through verify/mock/webhook/unfreeze could still activate a duplicate pending/frozen pass.

Fixes made:
- Added shared mobile helper `apps/mobile/lib/subscriptionAccess.ts` to normalize subscriptions, handle end-of-day validity, map active gym IDs, and label access as `Subscribed`, `Day pass active`, or `Multi-gym active`.
- Updated gym list and home gym sections to show subscribed/access labels and route active users to slot booking instead of repurchase.
- Updated plans screen to show an active-pass notice for the selected gym and change duplicate same-gym/day-pass CTAs to `Book Slot`.
- Passed `gymName` through duration -> order -> payment webview -> success so the selected gym stays visible after purchase.
- Changed success/subscription detail/gym detail actions to book slots or browse gyms instead of opening QR before a slot exists.
- Updated `/slots` mobile booking to resolve the active subscription for the selected gym and send `subscriptionId` when booking.
- Hardened backend duplicate activation checks in subscription verify, mock activation, unfreeze, and Cashfree webhook activation.
- Improved backend slot booking fallback to select an active subscription valid for the slot gym and reject expired/inactive subscriptions.
- Enriched `GET /subscriptions` rows with `gymId`, `primaryGymId`, `gymName`, and `gym` so mobile can show the subscribed gym cleanly.

Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter backend build` passed.
- `git diff --check` passed with only existing line-ending warnings.

Remaining notes:
- There is still no database-level unique constraint to prevent two concurrent active same-gym passes. The service/webhook guards reduce the bug, but a partial unique index or transaction lock would be the strongest final protection.
- `day_pass` can still be created without a gym ID by backend contract. Mobile routes users through gym selection, but backend product rules should be clarified before enforcing gym-scoped day passes globally.

## Change 022 - Local DB/API portal and subscription smoke verification

Date: 2026-05-11

Scope requested:
- Keep default OTP login behavior.
- Use local database/API instead of live APIs.
- Verify the app after login: same-gym subscription, duplicate blocking, subscribed-gym visibility, multi-gym activation, slot booking, QR validation, and admin/gym/corporate/wellness portal connections.

Errors found:
- Mobile API config was still pinned to the live domain in places, so local debugging could silently hit production instead of `localhost:3003`.
- Portal production env files were still pointed at the live API.
- Next.js portal builds were resolving the root React 19 install, while the Next 14 portal apps need React 18 at build/runtime.
- Wellness profile called `/wellness/:partnerId`, but backend exposed partner records under `/wellness/partners/...`.
- Wellness profile edited fields that do not exist on the current local DB entity, so profile save could appear to work while not persisting useful partner fields.
- Legacy `/slots/:id/book` and QR validation did not fully enforce active/unexpired/gym-scoped subscription access.
- QR expiry checks treated date-only `endDate` values as expired during the final valid day.
- Cashfree mock mode still attempted an external sandbox call before falling back.
- `backend` production start script pointed at `dist/main`, but the Nest build outputs `dist/src/main.js`.
- Seeded corporate login used `hr123`, which cannot pass the current 6-character password validation.

Fixes made:
- Mobile and portal API config now defaults to local `http://localhost:3003`, with mobile supporting `EXPO_PUBLIC_API_URL` / Expo `extra.apiUrl`.
- Added a small React 18 Next runner for the four portal apps and updated portal build/dev/start scripts and webpack aliases.
- Added backend `GET /wellness/partners/:id` and changed wellness profile load/save to use the partner route family.
- Aligned wellness profile fields with the current DB entity: name, city, area, address, serviceType, photos.
- Hardened QR validation and legacy slot booking against inactive, expired, wrong-user, and wrong-gym subscriptions.
- Fixed same-gym session booking so a missing/empty gym list no longer grants access to every gym.
- Made `CASHFREE_MOCK_MODE=true` return local mock orders immediately.
- Fixed `backend` `start:prod` to run `dist/src/main.js`.
- Updated seeded corporate test login to `hr@techcorp.in` / `hr1234`, and the seed repairs the old local hash on boot.

Verification:
- Local Docker DB was present: `bmf-postgres` and `bmf-redis` were running.
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter @bmf/wellness-portal build` passed after the profile route fix.
- Admin, gym, corporate, and wellness portal endpoint smoke checks passed against `http://localhost:3003/api/v1`.
- Default OTP send/verify passed locally using the dev OTP.
- Same-gym purchase activated locally with `CASHFREE_MOCK_MODE=true`.
- Duplicate same-gym purchase for the same active gym was blocked.
- `GET /subscriptions` returned the subscribed gym ID/name for the active pass.
- Same-gym subscription could not book a slot at another gym.
- Same-gym subscription could book a slot at the subscribed gym.
- Gym scanner validated the booking QR.
- Multi-gym purchase activated locally.

Remaining notes:
- The strongest remaining protection for duplicate active same-gym subscriptions is still a DB-level partial unique index or transactional lock.
- `day_pass` backend rules still allow a pass without a gym ID. Mobile uses gym selection, but product rules should confirm whether backend should reject gym-less day passes globally.

## Change 023 - Plan alignment, local-only config, portal/mobile run check

Date: 2026-05-11

Scope requested:
- Re-check all available docs and keep changes aligned to the BookMyFit plan, not personal assumptions.
- Use the local database/API for verification instead of live APIs.
- Keep OTP/default login out of scope except for basic dev-login smoke checks.
- Run/admin-check all portals and mobile web.
- Use agents for parallel review. Five agents were used for docs, mobile readiness, plan alignment, and portal/API audit.

Docs reviewed:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
- `apps/tasklist/lib/tasks.ts`
- `README.md`
- `README.local.md`
- `plan.md`
- `requirements.md`
- `PROJECT_STRUCTURE.md`
- `BookMyFit_Project_Plan (1).docx`
- `BookMyFit_LLR (1).docx`

Plan alignment notes:
- The current working source of truth is this Nikhilesh report plus the tasklist. The older README/project-plan docs still describe useful product rules, but some operational details are stale, especially Razorpay references, old ports, and old progress numbers.
- The core product plan is still consistent: individual/single-gym subscription first, then multi-gym, QR/slot validation, wellness/corporate portals, and admin/gym portal management.
- I reverted the earlier local-host production API direction. Production env files now point back to `https://bookmyfit.in`; local testing is handled through ignored `.env.local` files.

Errors found:
- Local test configuration and production configuration were mixed together, which could make builds or app runs accidentally hit the wrong API.
- Mobile order creation still sent a client-calculated amount override to the backend.
- Coupon/order display logic could treat backend discount amounts like percentages.
- Invoice generation could fetch by subscription ID without user ownership in the query path.
- Generic wellness service routes were too open for partner-level users.
- Partner-scoped wellness routes needed explicit owner checks so one wellness partner cannot manage another partner's bookings/services/earnings.
- Expo web could not start until `react-native-web` was installed.

Fixes made:
- Restored portal production API files to `NEXT_PUBLIC_API_URL=https://bookmyfit.in`.
- Restored static mobile `app.json` API URL to `https://bookmyfit.in`.
- Kept local testing in `.env.local` only:
  - admin/gym/corporate/wellness portals use `NEXT_PUBLIC_API_URL=http://localhost:3003`.
  - mobile uses `EXPO_PUBLIC_API_URL=http://localhost:3003`.
- Updated mobile `app.config.js` so local runs default to `http://localhost:3003`, while production/EAS builds default to `https://bookmyfit.in`.
- Removed mobile `amountOverride` from subscription order creation.
- Backend now calculates subscription amount from server-owned data, applies PT addon, applies coupon rules, and adds GST server-side.
- Invoice generation now scopes by both subscription ID and user ID.
- Wellness generic service mutations are now super-admin only.
- Partner wellness bookings/services/earnings routes now enforce owner access for `wellness_partner` users, with super-admin bypass.
- Added `react-native-web` to the mobile app so Expo web can run for browser/mobile viewport testing.

Verification:
- Local Docker database exists and is being used: `bmf-postgres` is running with database `bookmyfit` and seeded gyms.
- Local Redis exists and responds with `PONG`.
- `DATABASE_URL` and `REDIS_URL` are empty in the shell, so backend defaults resolve to local Docker services.
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `pnpm.cmd --filter admin-panel build` passed.
- `pnpm.cmd --filter gym-panel build` passed after clearing a stuck local `.next` build folder.
- `pnpm.cmd --filter corporate-panel build` passed.
- `pnpm.cmd --filter @bmf/wellness-portal build` passed.
- Full local API smoke against `http://localhost:3003/api/v1` passed for:
  - backend health
  - admin login
  - gym login
  - corporate login
  - default OTP send/verify
  - gym listing
  - admin slot generation
  - same-gym subscription activation
  - duplicate same-gym subscription blocked
  - subscribed gym ID/name returned by `GET /subscriptions`
  - same-gym user blocked from booking another gym
  - same-gym user able to book subscribed gym slot
  - booking QR rejected at wrong gym
  - booking QR accepted by correct gym scanner
  - booking QR replay blocked
  - legacy check-in scanner disabled by default
  - direct session check-in disabled by default
  - multi-gym subscription activation
  - admin/gym/corporate/wellness API connectivity

Running local URLs:
- Backend health: `http://localhost:3003/api/v1/health`
- Admin panel: `http://localhost:3004/login`
- Gym panel: `http://localhost:3001/login`
- Corporate panel: `http://localhost:3002/login`
- Wellness portal: `http://localhost:3005/login`
- Mobile web / Expo: `http://localhost:8081`

Known local credentials:
- Admin: `admin@bookmyfit.in` / `admin123`
- Gym: `gym@bookmyfit.in` / `gym123`
- Corporate: `hr@techcorp.in` / `hr1234`
- Mobile OTP: default dev OTP `123456`

Remaining notes:
- A database-level partial unique index or transactional lock is still the strongest final protection against two concurrent active same-gym subscriptions.
- Backend `day_pass` still allows creation without a gym ID; mobile routes through gym selection, but product should confirm whether the backend must reject gym-less day passes globally.
- Native Android emulator testing is not complete because local Android SDK/ADB/JAVA environment is not ready in this workspace. Expo web is running for browser/mobile viewport checks.
- Expo reports minor expected-version warnings for `expo` and `expo-linking`; this did not block web startup or TypeScript.
- Some older docs still mention Razorpay and old setup details; those docs should be updated separately to match the current Cashfree/local-port architecture.

## Change 024 - Gym profile 500, trainers, break time, KYC, settlements, amenities, plan rules

Date: 2026-05-11

Scope requested:
- Fix the screenshot issue where `PUT /api/v1/gyms/:id` from the gym profile page returned `500 Internal Server Error`.
- Fix trainer creation: success notification appeared but the trainer did not show in the list.
- Change trainer pricing across the app from session-based pricing to monthly pricing.
- Clarify why gym settings had a pricing section and gym menu also had Plans.
- Add gym break time support and prevent users from booking gym workout slots during break time.
- Make KYC forms type-specific, and make admin able to review/approve/reject submitted details.
- Remove/demo-proof settlement buckets and show real subscription-plan revenue data.
- Let admin add amenities and let gyms select approved amenities.
- Clarify gym-owned single-gym packages vs admin/platform-owned multi-gym packages and prevent duplicate package durations.
- Use local DB/local APIs for verification. Six agents were used for parallel review of profile/API, trainers, plans/pricing, operating hours, KYC, settlements/amenities.

Docs checked for plan alignment:
- `NIKHILESH_BOOKMYFIT_ERROR_REPORT.md`
- `README.md`
- `README.local.md`
- `plan.md`
- `requirements.md`
- `PROJECT_STRUCTURE.md`
- `BookMyFit_Project_Plan (1).docx`
- `BookMyFit_LLR (1).docx`

Plan alignment:
- Gym owners manage their own gym profile, operating hours, amenities selection, trainers/PT, and single-gym subscription packages.
- Super admin manages platform master data, KYC review, approvals, commissions, settlements, and platform-owned multi-gym packages.
- Users can buy single-gym subscriptions and multi-gym subscriptions; same-gym active duplicate protection remains required.
- Gym single-gym packages should be limited to one active 1-month, 3-month, 6-month, and 12-month package per gym.

Errors found:
- Gym profile save sent fields such as `description`, `phone`, `email`, and `openingHours` that were not safely mapped to current DB columns, causing the profile save to fail with 500 in the screenshot flow.
- Trainer list expected a plain array, while the backend returned paginated `{ data, total, ... }`, so newly added trainers could be saved but not rendered.
- Trainer pricing was still mixed between session price and monthly price labels/payloads.
- Settings and Plans both exposed pricing, creating confusion between day-pass pricing and recurring gym packages.
- Operating hours had no break-time model, so generated gym workout slots could fall inside lunch/maintenance break periods.
- KYC used generic document fields instead of document-type-specific fields.
- Gym settlement view still used demo-style bucket names/percentages instead of actual same-gym, day-pass, and multi-gym allocation data.
- The local seed DB had no master amenities available for gyms to select.
- Gym plans allowed duplicate active durations, which can create conflicting pricing for the same 1/3/6/12 month package type.
- The running gym panel had a stale Next dev chunk under `.next`, causing a separate local route 500 until the gym panel cache was cleared and restarted.

Fixes made:
- Added missing gym profile DB fields and safe update allowlisting for profile fields, including contact details, pin code, website, open/close time, and break start/end time.
- Updated gym profile UI to load/save the new fields and show break hours in the profile summary.
- Synced gym profile hours into weekly gym schedules so booking rules and profile display stay aligned.
- Added break start/end columns to gym schedules and blocked gym workout slot generation/listing/booking during break time.
- Updated gym schedule UI so each day can have open time, close time, break start, and break end.
- Changed trainer backend and gym/mobile UIs to use monthly pricing: `monthlyPrice`, `monthlyPriceInr`, and monthly booking durations.
- Fixed trainer list parsing so newly added trainers appear immediately from paginated API results.
- Removed same-gym package pricing from Settings and kept Settings focused on day-pass pricing; recurring 1/3/6/12 month gym packages now live under Plans.
- Enforced allowed gym plan durations: 30, 90, 180, and 365 days.
- Blocked duplicate active gym plans for the same duration with `409 Conflict`.
- Added type-specific KYC schemas for business registration, GST, bank details, identity document, gym photos, and trainer certificates.
- Updated gym KYC UI to render the correct fields for the selected KYC type.
- Updated admin KYC UI to show submitted fields/document URLs and review notes.
- Reworked settlements to use real plan-type buckets: same-gym subscriptions, day passes, and multi-gym allocation.
- Added secure master amenity mutation routes for super admin and gym amenity selection through `PUT /gyms/my-gym/amenities`.
- Updated admin navigation label to `Categories & Amenities`.
- Added DB migration for the new profile, break-time, trainer monthly price, KYC, settlement, and amenity requester columns.

Local verification:
- Backend restarted against local Docker DB/Redis on `http://localhost:3003`.
- `GET /api/v1/health` returned `ok`.
- Screenshot profile payload equivalent saved successfully through `PUT /api/v1/gyms/:id`.
- Saved profile returned `breakHours = 13:00 - 14:00` and `pinCode = 400050`.
- Weekly schedule saved break time for all 7 days.
- Generated slots for `2026-05-12` had `0` gym workout slots overlapping `13:00-14:00`.
- Trainer create returned `monthlyPriceInr = 8000`.
- Created trainer appeared in `GET /trainers?gymId=...` paginated list.
- Duplicate active gym plan duration returned `409`.
- KYC bank-details submission accepted with the correct `ifsc` field and moved gym KYC to `in_review`.
- Admin-created master amenity was visible publicly and successfully applied to the gym.
- `GET /settlements/my-gym` returned the new `{ current, history }` shape.
- Gym panel stale `.next` cache was cleared and dev server restarted.
- Local panels reachable:
  - Gym profile: `http://localhost:3001/profile` returned 200.
  - Gym trainers: `http://localhost:3001/trainers` returned 200.
  - Admin KYC: `http://localhost:3004/kyc` returned 200.
  - Mobile web / Expo: `http://localhost:8081` returned 200.
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter gym-panel build` passed.
- `pnpm.cmd --filter admin-panel build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `git diff --check` passed with only existing LF/CRLF warnings.

Product clarification:
- Gym adds only its own single-gym subscription packages from the gym portal.
- Admin/platform should add and manage multi-gym packages because multi-gym pricing, network access, tiers, commissions, and settlement allocation are platform-level rules.
- Users can buy multi-gym subscriptions; backend/mobile support still exists for `multi_gym`.
- Gym cannot add unlimited duplicate 1-month/3-month/6-month/12-month active packages anymore; one active plan per duration is enforced.

Remaining notes:
- Production must run the new migration before deploying these backend changes.
- Service-level duplicate plan protection is implemented; a DB-level unique/partial index would be stronger for concurrent requests.
- KYC still uses URL fields for uploaded documents in this pass. Real file upload/S3 should be wired separately if required.
- Existing already-booked slots that overlap a newly added break are hidden/rejected for new booking/check-in, but booked sessions are not auto-cancelled.

## Change 025 - Local URL white screen / broken page cleanup

Date: 2026-05-11

Scope requested:
- Fix local URLs that opened as white screens, 500 pages, broken pages, or dead links.

Root causes found:
- Next dev servers were left running while production builds wrote into the same `.next` folders, causing missing chunk errors such as `Cannot find module './848.js'`.
- Backend was temporarily not listening on `3003` after a restart, so authenticated portals could sit on loading states or fail API calls.
- Mobile web failed on first restart inside Expo dependency validation with `Body is unusable: Body has already been read`.
- Landing app was not running on `5004`.
- Backend CORS did not include local landing origin `http://localhost:5004`.
- Landing local fallbacks were inconsistent: one component used `https://api.bookmyfit.in`, another used local API, and onboarding pointed gym panel fallback to wellness port `3005`.
- Placeholder pages linked to `http://localhost:3100`, but tasklist was not running.
- Landing and tasklist used direct `next` scripts while other Next 14 apps use the React 18 wrapper to avoid root React 19 resolution issues.
- Admin dev ran on `3004` but production start script used `3000`.

Fixes made:
- Stopped local UI dev servers, cleared only generated caches, and restarted cleanly.
- Added `http://localhost:5004` to backend local CORS origins.
- Added `apps/landing/.env.local` with local API and panel URLs.
- Standardized landing local API fallback to `http://localhost:3003`.
- Fixed landing onboarding gym-panel fallback to `http://localhost:3001`.
- Updated landing and tasklist scripts to use `scripts/next-react18.js`.
- Aligned admin `start` port to `3004`.
- Started tasklist on `http://localhost:3100` so existing Tasklist Tracker links work.
- Started mobile web with `EXPO_NO_DEPENDENCY_VALIDATION=1` to bypass the Expo CLI dependency-doctor crash.

Verified local URLs:
- Backend health: `http://localhost:3003/api/v1/health` returned 200.
- Landing: `http://localhost:5004` returned 200.
- Landing onboarding: `http://localhost:5004/onboard` returned 200.
- Tasklist: `http://localhost:3100` returned 200.
- Gym login: `http://localhost:3001/login` returned 200.
- Gym profile: `http://localhost:3001/profile` returned 200.
- Gym trainers: `http://localhost:3001/trainers` returned 200.
- Corporate login: `http://localhost:3002/login` returned 200.
- Admin login: `http://localhost:3004/login` returned 200.
- Admin KYC: `http://localhost:3004/kyc` returned 200.
- Wellness login: `http://localhost:3005/login` returned 200.
- Mobile web: `http://localhost:8081` returned 200 after Expo finished bundling.

Current local run notes:
- Do not run `next build` for a portal while that same portal's dev server is running, because it can rewrite `.next` and break the live dev server.
- If a protected portal page still looks like only a spinner, open `/login` or clear that portal's localStorage token and login again.

## Change 026 - Mobile web login Continue button / OTP send

Date: 2026-05-11

Scope requested:
- Mobile web login did not continue after entering a phone number and pressing Continue.

Root causes found:
- Backend OTP was healthy: `POST /api/v1/auth/otp/send` returned `success: true` and dev OTP `123456`.
- Mobile API requests called `getToken()` before every request, including `/auth/otp/send`.
- `getToken()` used `expo-secure-store`; on Expo web this can fail before the fetch happens, so OTP send never reaches the backend.
- OTP verification also wrote tokens directly to `expo-secure-store`, so web login could fail after OTP too.
- The phone input used raw text validation, so pasted values like `98765 43210` could leave the Continue button disabled or fail validation.

Fixes made:
- Added a platform storage wrapper in `apps/mobile/lib/api.ts`:
  - native uses `expo-secure-store`;
  - web uses `window.localStorage`;
  - non-window web fallback uses an in-memory map.
- Routed token, refresh token, user, onboarding, and city storage through the wrapper.
- Skipped token lookup for `/auth/*` requests so OTP send/verify cannot be blocked by auth storage.
- Updated OTP screen to use `setTokens()` instead of direct SecureStore writes.
- Normalized phone input to digits only and send only the 10-digit cleaned phone number.
- Added `onSubmitEditing` to the phone input so pressing Enter/done also sends OTP.

Verification:
- `POST /api/v1/auth/otp/send` from `Origin: http://localhost:8081` returned 200 with `Access-Control-Allow-Origin: http://localhost:8081`.
- `http://localhost:8081/login` returned 200.
- Expo web bundled successfully after restart.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.

Testing note:
- If testing from the same computer browser, use `http://localhost:8081/login`.
- If testing from a physical phone browser, `localhost:3003` will not work for API calls because it points to the phone. Start Expo with `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3003` and allow that `http://<LAN-IP>:8081` origin in `CORS_ORIGINS`.

## Change 027 - Production server repo and PM2 audit

Date: 2026-05-12

Scope requested:
- SSH into the authorized BookMyFit server at `157.245.102.208`.
- Check `/var/www/html/bookmyfit`, running services, repo, branch, local/server changes, database locality, and PM2 deploy restart targets.

Findings:
- Server path exists: `/var/www/html/bookmyfit`.
- Server branch is `main` at `a0f690f1dbb33cd8bfa803d8f63988ff3adb561a`.
- Local `HEAD` and local `origin/main` are also `a0f690f1dbb33cd8bfa803d8f63988ff3adb561a`.
- Server remote is a different GitHub repo than local:
  - local: `github.com/nikhilesh121/bookmyfit.git`
  - server: `github.com/qwegle/bookmyfit.git`
- Server remote URL contains an embedded GitHub token and should be rotated/removed after deploy access is cleaned up.
- Server working tree is not clean. It has one production-only edit in `backend/src/main.ts`, adding production CORS origins.
- Local working tree is also not clean. It has many uncommitted changes across backend, mobile, portals, docs, migrations, tests, scripts, and generated artifacts, so there is no committed local change to push yet.

Server services:
- PM2 BookMyFit apps online:
  - `BMF` landing, cwd `/var/www/html/bookmyfit/apps/landing`, command `PORT=5004 npm run dev`.
  - `bmf-backend`, cwd `/var/www/html/bookmyfit/backend`, script `dist/main.js`.
  - `bmf-gym`, cwd `/var/www/html/bookmyfit/apps/gym-panel`, command `npm run start`.
  - `bmf-corp`, cwd `/var/www/html/bookmyfit/apps/corporate-panel`, command `npm run start`.
  - `bmf-admin`, cwd `/var/www/html/bookmyfit/apps/admin-panel`, command `npm run start`.
  - `bmf-wellness`, cwd `/var/www/html/bookmyfit/apps/wellness-portal`, command `npm run start`.
- Listening ports confirmed:
  - `5004` landing, `3003` backend, `3001` gym, `3002` corporate, `3000` admin, `3005` wellness.
- Nginx routes:
  - `bookmyfit.in` and `www.bookmyfit.in` route `/api/` to `3003` and `/` to `5004`.
  - `gym.bookmyfit.in` routes `/api/` to `3003` and `/` to `3001`.
  - `corporate.bookmyfit.in` routes `/api/` to `3003` and `/` to `3002`.
  - `admin.bookmyfit.in` routes `/` to `3000`.
  - `wellness.bookmyfit.in` routes `/` to `3005`.
- Nginx syntax check passed.

Database/server data path:
- PostgreSQL is installed and listening locally on `127.0.0.1:5432`.
- Redis is installed and listening locally on `127.0.0.1:6379`.
- MongoDB is also installed and listening locally on `127.0.0.1:27017`.
- Backend env points to local Postgres and Redis:
  - `DB_HOST=localhost`
  - `DB_PORT=5432`
  - `DB_DATABASE=bookmyfit`
  - `REDIS_HOST=localhost`
  - `REDIS_PORT=6379`

Verification:
- `git pull --ff-only` on the server returned `Already up to date`.
- `https://bookmyfit.in/api/v1/health` returned `{"status":"ok","service":"bookmyfit-api"}`.
- Public page checks returned HTTP 200 for main, gym, admin, corporate, and wellness domains.
- Recent PM2 logs for landing/backend were clean in the checked tail.
- Recent panel logs for gym/admin/corporate/wellness include Next.js Server Action errors such as `Failed to find Server Action`, usually caused by stale client/server build mismatch or old action requests after deployment.

Deploy decision:
- No PM2 restart was performed in this audit because the server pull did not bring in any new commit.
- Current restart targets after the next successful deploy are:
  - backend changes: build backend, then `pm2 restart bmf-backend`.
  - landing changes: build landing, then `pm2 restart BMF`.
  - gym/admin/corporate/wellness changes: build the affected portal(s), then restart `bmf-gym`, `bmf-admin`, `bmf-corp`, and/or `bmf-wellness`.
- For a broad monorepo deploy touching shared dependencies, backend, and portals, restart all BookMyFit PM2 apps: `BMF`, `bmf-backend`, `bmf-gym`, `bmf-corp`, `bmf-admin`, `bmf-wellness`.

Remaining action before production deploy:
- Commit the intended local changes only, excluding generated artifacts and local-only env files.
- Decide whether server should pull from `nikhilesh121/bookmyfit` or local should push to `qwegle/bookmyfit`; both sides currently point to different remotes.
- Preserve or source-control the production CORS domain list so the server-only `backend/src/main.ts` change is not lost.

## Change 028 - Mobile extra bottom whitespace cleanup

Date: 2026-05-12

Scope requested:
- Remove odd extra scroll space and blank bottom areas from the mobile app pages, blogs/sections, user side, gym side, and subscription/purchase flows.

Findings:
- Main tab screens and gym portal tab screens were still reserving `paddingBottom: 132` even though the bottom tab bar already has its own measured height.
- Some pages also added manual spacer views after already applying bottom padding, creating duplicated blank scroll tails.
- Fixed-action screens had oversized footer clearance, especially duration selection, order summary, product detail, gym detail, wellness booking, and cart.

Changes made locally:
- Reduced repeated tab-screen bottom padding to compact page padding on home, explore, store, bookings, profile, subscriptions, and gym portal tabs.
- Reduced duplicate manual spacer views in home, explore, KYC, earnings, wellness, multi-gym network, and order pages.
- Tightened fixed-footer clearance on duration selection, order summary, product detail, gym detail, wellness service booking, cart, and gym listing.
- Kept enough safe-area clearance for sticky CTAs and payment/action bars so content still scrolls above the footer.

Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- `git diff --check -- apps/mobile/app` passed with only existing LF/CRLF conversion warnings.

## Change 029 - Local backend, database, mobile web smoke check

Date: 2026-05-12

Scope requested:
- Check locally first before live deployment.
- Confirm local database/API usage and mobile web accessibility.

Local database:
- Docker Desktop was started.
- Local containers are available:
  - `bmf-postgres` on port `5432`.
  - `bmf-redis` on port `6379`.
- Local Postgres database `bookmyfit` contains 33 public tables.
- Local row counts at verification time:
  - `gyms`: 13
  - `users`: 16
  - `subscriptions`: 16
  - `gym_plans`: 2

Local app/API configuration:
- Mobile development config resolves API base to `http://localhost:3003` via `apps/mobile/app.config.js`.
- Portals default to `http://localhost:3003` through `NEXT_PUBLIC_API_URL` fallback.
- `apps/mobile/app.json` still contains production `extra.apiUrl`, but Expo uses `app.config.js` during development.

Verification:
- `pnpm.cmd --filter backend build` passed.
- Local backend started from `backend/dist/src/main.js`.
- `GET http://localhost:3003/api/v1/health` returned 200 with service `bookmyfit-api`.
- Expo web must be started with `--offline` in this sandbox because Expo dependency validation tries to call the online Expo API.
- Local mobile web routes returned 200:
  - `/login`
  - `/`
  - `/gyms`
  - `/plans`
  - `/wellness`
  - `/multi-gym-network`
  - `/cart`
- Local API routes returned 200:
  - `/api/v1/gyms?limit=5`
  - `/api/v1/subscriptions/plans`
  - `/api/v1/homepage/config`
  - `/api/v1/wellness/services/all`
  - `/api/v1/master/amenities`
- `POST /api/v1/auth/otp/send` from origin `http://localhost:8081` returned 200 with `Access-Control-Allow-Origin: http://localhost:8081` and dev OTP `123456`.

Testing note:
- Long-running dev servers are cleaned up by the Codex command sandbox after each command, so they were smoke-tested inside one command rather than left running.
- For manual local browser testing, run backend and Expo mobile web in user terminals:
  - `pnpm.cmd --filter backend start:dev`
  - `pnpm.cmd --filter mobile exec expo start --web --offline --port 8081`

## Change 030 - Gym timing display and amenities approval flow

Date: 2026-05-13

Scope requested:
- Show gym profile open/close times in the same human-readable AM/PM format users expect, not raw 24-hour values like `14:00`.
- Confirm admin-side amenity creation and gym-request approval/rejection flow.
- Keep local testing on the local Postgres/Redis services before live deployment.

Changes made locally:
- Gym profile preview now formats `HH:mm` values as AM/PM labels, for example `14:00` displays as `2:00 PM`.
- Mobile gym detail opening hours and break hours now format backend `HH:mm` ranges as AM/PM labels.
- Admin Categories & Amenities now loads the protected admin full amenity list from `/master/amenities/all`.
- Public `/master/amenities` stays limited to approved active amenities, even if `includeAll=true` is passed.
- Gym amenity requests are now attached to the logged-in gym owner/account on the backend instead of trusting a submitted `gymId`.
- Gym Amenities page now reloads the logged-in gym's pending amenity requests from `/master/amenities/my-requests`, so pending requests do not disappear after refresh.
- If a gym requests an amenity that already exists, the gym panel tells them it is already available instead of showing a false pending request.
- Admin can approve amenity requests with `/master/amenities/:id/approve` and reject/remove them with `DELETE /master/amenities/:id`.

Product decision:
- Admin should approve/reject amenity requests. Gyms should request new amenities and select only approved active amenities. Giving a gym approval rights over its own master-data request would make the global amenity list unsafe and inconsistent.

Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter gym-panel build` passed.
- `pnpm.cmd --filter admin-panel build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Local Docker services confirmed:
  - `bmf-postgres` on `localhost:5432`.
  - `bmf-redis` on `localhost:6379`.
- Local amenities API smoke passed:
  - Public `GET /api/v1/master/amenities?includeAll=true` returned 200 but only the public approved list.
  - Unauthenticated `GET /api/v1/master/amenities/all` returned 401.
  - Admin-authenticated `GET /api/v1/master/amenities/all` returned data.
  - Gym-authenticated amenity request created a pending request with the logged-in gym id.
  - Gym-authenticated `GET /api/v1/master/amenities/my-requests` returned the pending request.
  - Admin reject changed the test request with affected count `1`.

Local URLs confirmed responding:
- Backend health: `http://localhost:3003/api/v1/health`
- API docs: `http://localhost:3003/api/docs`
- Gym panel: `http://localhost:3001`
- Admin panel: `http://localhost:3004`
- Corporate panel: `http://localhost:3002`
- Wellness portal: `http://localhost:3005`
- Landing/user web: `http://localhost:5004`
- Mobile web: `http://localhost:8081`

## Change 031 - Default listing images and gym-owned subscription plans

Date: 2026-05-13

Scope requested:
- Do not show blank gym cards, gym subscription cards, wellness partner cards, or wellness service cards when the API record has no image.
- Same Gym subscriptions must use the selected gym's own active plans only.
- If a gym has no active subscription plan configured, do not show or sell a generic default Same Gym plan.

Findings:
- Local Postgres has 13 gyms.
- Local `gym_plans` currently has 2 rows, and both rows are inactive in the local database.
- Backend gym records use `coverPhoto` and `photos`, while several mobile screens were still reading only `coverImage`, `images`, or `img`.
- Mobile plan selection was falling back from gym plans to legacy `sameGymMonthlyPrice` and then to generic `/subscriptions/plans.same_gym.basePrice`.
- Backend Same Gym purchase still accepted checkout without `gymPlanId` and priced it from legacy gym pricing/default values.

Changes made locally:
- Added shared mobile image fallback helpers for default gym, wellness partner, wellness service, and homepage hero images.
- Updated mobile gym list, gym detail, multi-gym network, subscriptions, subscription detail, home featured gym, wellness, spa centre, and home service screens to use real API image aliases first and default images second.
- Backend gym normalization now exposes `coverImage/images` aliases from `coverPhoto/photos` so mobile and portal callers receive consistent image fields.
- Gym profile updates now accept `coverImage/images` aliases and store them as `coverPhoto/photos`.
- Approved KYC gym photos now sync into public `coverPhoto/photos` when the gym is approved.
- Mobile Same Gym plan selection now uses only active `gym_plans` for that gym.
- If the selected gym has no active plans, the Same Gym card shows `Not set` / `Not Available` and explains that the gym has not configured plans yet.
- Duration selection no longer creates synthetic 1/3/6/12 month Same Gym options unless real gym plans were passed in.
- Backend Same Gym purchase now requires an active `gymPlanId`; checkout without one returns `400`.
- Subscription list responses now include gym image aliases and gym plan labels when available.
- Multi-gym network responses now normalize gym image aliases too.

Product decision:
- Gyms decide and manage their own Same Gym membership plans in the gym portal Plans page.
- Admin/platform pricing remains appropriate for Multi Gym and default day-pass fallback only.
- A gym with no active Same Gym plans should not be sold as a Same Gym subscription until the gym activates at least one plan.

Verification:
- `pnpm.cmd --filter backend build` passed.
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Updated local backend health returned 200 at `http://localhost:3003/api/v1/health`.
- `GET /api/v1/subscriptions/plans` now returns `same_gym.basePrice = null` and `requiresGymPlan = true`.
- `GET /api/v1/gym-plans/by-gym/8b7af325-ef23-4c1d-b984-4ef40e329593` returned an empty active plan list because the local plan rows are inactive.
- Mobile web routes `/gyms` and `/plans?gymId=8b7af325-ef23-4c1d-b984-4ef40e329593&gymName=BookMyFit%20Demo%20Gym` returned 200.
- Local DB check confirmed `gyms = 13`.
- Local DB check confirmed `gym_plans = 2`, both inactive in the table output.

## Change 032 - Mobile web scroll, home gym list, slider, and image fallbacks

Date: 2026-05-13

Scope requested:
- Fix mobile web pages scrolling into blank space outside the app frame.
- Restore the home page bottom gym list.
- Fix homepage/wellness slider sizing in mobile web responsive mode.
- Do not show blank wellness/product imagery when API image fields are missing.
- Improve the wellness "View Services" button layout.

Findings:
- React Native Web had no global `html/body/#root` viewport guard, so oversized background effects could expand the browser document and create blank scroll space.
- `AuroraBackground` used fixed module-load dimensions and did not clip overflow, so decorative blobs could leak outside the app shell on web resize/mobile emulation.
- The home `GymListingSection` still existed but was no longer rendered.
- Product screens used different image field orders and sometimes passed an undefined image source.
- Wellness partner/service list screens did not share the same image alias order.

Changes made locally:
- Added a web-only root style guard in mobile `_layout.tsx` to keep browser/body scroll inside the app viewport.
- Made `AuroraBackground` responsive with `useWindowDimensions()` and clipped its overflow.
- Reduced the login screen's flexible blank spacer so the CTA no longer creates a large empty scroll region.
- Restored the home page bottom "Gyms Near You" list using real `/gyms?limit=6` API data, with homepage featured gyms only as an API-empty fallback.
- Made the home and wellness hero sliders use current viewport width, `getItemLayout`, and scroll failure recovery.
- Added shared product, wellness partner, and wellness service image resolvers.
- Updated home products, store products, product detail, cart, wellness, spa centres, home services, and wellness detail screens to use the shared image fallbacks.
- Restyled wellness provider "View Services" buttons to a smaller consistent pill and updated spa/home service cards to use the same action label.

Verification:
- `pnpm.cmd --filter mobile exec tsc --noEmit` passed.
- Local mobile routes returned 200:
  - `http://localhost:8081`
  - `http://localhost:8081/login`
  - `http://localhost:8081/wellness`
- Local backend health returned 200 at `http://localhost:3003/api/v1/health`.
- Local API smoke confirmed:
  - `GET /api/v1/homepage/config` returned 6 sections.
  - `GET /api/v1/gyms?limit=6` returned 6 gyms.
  - `GET /api/v1/wellness/services/all` returned 25 services.
  - `GET /api/v1/store/products` returned 6 products.

## Change 033 - Live deployment of local fixes

Date: 2026-05-13

Scope requested:
- Update the live server with the latest tested local fixes.

Deployment notes:
- Live server path verified: `/var/www/html/bookmyfit`.
- Local and live repos were both on commit `0897c3fff56ee38c3061bc74b511de49db6aaa2a`.
- Live repo remote still differs from local, so the tested local changes were deployed to the server as a verified patch rather than by `git pull`.
- New mobile helper file `apps/mobile/lib/imageFallbacks.ts` was copied to the live repo.

Live build and restart:
- Built on the live server:
  - `backend`
  - `gym-panel`
  - `admin-panel`
  - `corporate-panel`
  - `@bmf/wellness-portal`
  - `mobile` TypeScript check
- Restarted and saved PM2 apps:
  - `BMF`
  - `bmf-backend`
  - `bmf-gym`
  - `bmf-corp`
  - `bmf-admin`
  - `bmf-wellness`

Live verification:
- Public routes returned 200:
  - `https://bookmyfit.in/api/v1/health`
  - `https://bookmyfit.in`
  - `https://gym.bookmyfit.in/login`
  - `https://admin.bookmyfit.in/login`
  - `https://corporate.bookmyfit.in/login`
  - `https://wellness.bookmyfit.in/login`
- Live API routes returned 200:
  - `https://bookmyfit.in/api/v1/homepage/config`
  - `https://bookmyfit.in/api/v1/gyms?limit=6`
  - `https://bookmyfit.in/api/v1/wellness/services/all`
  - `https://bookmyfit.in/api/v1/store/products`
  - `https://bookmyfit.in/api/v1/subscriptions/plans`
- `nginx -t` passed.
- Backend PM2 logs showed a clean NestJS boot.
- Old gym/admin Next.js error-log entries were timestamped before this deploy and were not fresh post-restart errors.
