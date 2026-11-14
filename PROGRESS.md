# SportyGo progress tracker

Living document. Update it at the end of every work session: what was done, what is in flight,
what is next. Store paperwork that happens outside the code lives in
[SportyGo/docs/STORE_SUBMISSION.md](SportyGo/docs/STORE_SUBMISSION.md).

Last updated: 2026-11-14

## Targets

| # | Target | Status | What "done" means |
|---|--------|--------|-------------------|
| T1 | Data is protected | In progress | Every Firestore request carries a Firebase identity; rules restrict reads and writes per user, group and role |
| T2 | Publishable on the App Store | Blocked on T1 + store paperwork | Production EAS build passes review: privacy policy, account deletion, Sign in with Apple if social login is on, demo account, privacy labels |
| T3 | Publishable on Google Play | Blocked on T1 + store paperwork | Production AAB targets the current API level; data-safety form, delete-account URL, content rating filled in |
| T4 | Good user flow | In progress | A new user can sign up, join or create a group, RSVP to an event, and record a match without dead ends, with consistent navigation and clear empty/loading/error states |
| T5 | Consistent, polished UI | Not started | One colour system (no hard-coded greys/blacks), one header/back pattern, one button style, readable contrast everywhere |
| T6 | v1 feature set complete | In progress | Edit event, join by code, match-event link, privacy levels, payment tracking, push notifications |
| T7 | Maintainable | In progress | Type-clean, tests green, lint warnings near zero, no dead code or stale branches |

## Workflow

- Branch from `dev-main`, open a PR into `dev-main`, squash-merge. `production-main` is promoted
  from `dev-main` by the owner at release time.
- Before every PR: `npx tsc --noEmit`, `npx jest`, and `npm run test:rules` when rules change
  (all run from `SportyGo/`).

## Baseline (2026-11-14, `dev-main` @ dbb14a6)

- `tsc`: clean. `jest`: 14 suites / 136 tests passing. `expo lint`: 0 errors, 58 warnings.
- Expo SDK 54, React Native 0.81, Tamagui, Auth0 login, Firestore (web SDK).

## Decisions

- **No Firebase Blaze plan** (owner, 2026-11-14). So no Cloud Functions. The Auth0 to Firebase
  sign-in exchange is done by an Auth0 post-login Action that mints a Firebase custom token and
  puts it in the ID token; the app signs in to Firebase with it. Free on both sides.
- **v1 must include** push notifications (#39, #20), payment tracking (#56) and meaningful group
  privacy levels (#17) (owner, 2026-11-14).
- **Post-launch:** payment providers (#55), best-of-n games (#57), friends (#24), location API
  (#14), linked accounts (#30, #34).

## Open GitHub issues

| Issue | Title | Status |
|-------|-------|--------|
| #37 | Edit Event | To do |
| #53 | Join group from invite code | To do |
| #43 | Match score must attach an event | To do |
| #54 | White selector on create group | To do |
| #52 | Invalid date / max uses on previous invite links | To verify, then fix |
| #41 | Check + format phone number | To do |
| #50 | Fix app logo | Needs a logo asset from the owner |
| #17 | Privacy levels mean something | To do (v1) |
| #56 | Log payment sent / not sent | To do (v1) |
| #39, #20 | In-app / score-approval notifications | To do (v1) |
| #55, #57, #24, #14, #30, #34 | Payments, best-of-n, friends, location, linked accounts | Post-launch |

Closed as already fixed in code (2026-11-14): #12, #28, #31, #33, #35, #42, #46.

## Other problems found (not in GitHub issues)

- **Security (T1):** `request.auth` is always null; Firestore rules only check data shape.
- Matches store no event or group reference, and the "Tournament/Event" text typed in Add Score is
  never saved.
- Dashboard fetches match history twice on mount; ties show as "W" in the list but do not count as
  wins in the win rate.
- Invite screen calls `Alert` and `router.replace` during render when signed out.
- Hard-coded colours (`gray`, `black`, `white`, `#000`) bypass the theme in several screens; tab
  bar is unthemed.
- Profile photos are stored as Base64 inside Firestore documents (up to ~1 MB each), which makes
  every list read heavy. Moving them to Storage needs T1 first.
- Auth0 client ID, Pendo key and Firebase config are committed in source. They are public client
  identifiers, not secrets, but the Pendo SDK is configured and never initialised: remove it or
  turn it on and declare it in the privacy policy.
- 58 lint warnings, mostly unused imports and hook dependency arrays.
- Many stale local and remote branches from merged PRs.

## Work log

### 2026-11-14

- Surveyed the codebase and all 24 open issues; created this tracker.

## Resume here

See the newest work-log entry and the first "To do" rows above.
