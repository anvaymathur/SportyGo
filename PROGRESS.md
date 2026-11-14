# SportyGo progress tracker

Living document. Update it at the end of every work session: what was done, what is in flight,
what is next. Store paperwork that happens outside the code lives in
[SportyGo/docs/STORE_SUBMISSION.md](SportyGo/docs/STORE_SUBMISSION.md).

Last updated: 2026-11-14

## Targets

| # | Target | Status | What "done" means |
|---|--------|--------|-------------------|
| T1 | Data is protected | Code done, **owner rollout pending** | Every Firestore request carries a Firebase identity; rules restrict reads and writes per user, group and role |
| T2 | Publishable on the App Store | Blocked on T1 rollout + store paperwork | Production EAS build passes review: privacy policy, account deletion, Sign in with Apple if social login is on, demo account, privacy labels |
| T3 | Publishable on Google Play | Blocked on T1 rollout + store paperwork | Production AAB targets the current API level; data-safety form, delete-account URL, content rating filled in |
| T4 | Good user flow | In progress | A new user can sign up, join or create a group, RSVP to an event, and record a match without dead ends, with consistent navigation and clear empty/loading/error states |
| T5 | Consistent, polished UI | In progress | One colour system (no hard-coded greys/blacks), one header/back pattern, one button style, readable contrast everywhere |
| T6 | v1 feature set complete | In progress (3 of 6) | Edit event ✅, join by code ✅, phone formatting ✅, match-event link, privacy levels, payment tracking, push notifications |
| T7 | Maintainable | In progress | Type-clean, tests green, lint warnings near zero, no dead code or stale branches |

## Owner action items (nothing here can be done from the code)

1. **Roll out Firestore security** by following the six steps in
   [SportyGo/docs/FIREBASE_AUTH_SETUP.md](SportyGo/docs/FIREBASE_AUTH_SETUP.md): turn on Firebase
   Authentication, create a service-account key, create the Auth0 Action, verify on a dev build,
   ship the build, then `npm run deploy:rules:auth`. Until step 6 the data is still open.
2. **Test on real devices.** Nothing merged this session has been run on a phone: check login,
   Join with code, Edit Event (native date pickers), the new Home screen and tab bar colours.
3. **Logo asset** for #50 (app icon / adaptive icon / splash).
4. Store paperwork in `docs/STORE_SUBMISSION.md` (demo account, privacy labels, Sign in with Apple
   check, `firebase deploy --only hosting` for the privacy and delete-account pages).
5. Decide on Pendo: it is configured but never initialised. Remove it, or turn it on and declare
   it in the privacy policy and store forms.

## Workflow

- Branch from `dev-main`, open a PR into `dev-main`, squash-merge. `production-main` is promoted
  from `dev-main` by the owner at release time (it is currently behind `dev-main`).
- Issues do not auto-close from PRs into `dev-main` (it is not the default branch); close them
  by hand with a link to the PR.
- Before every PR, from `SportyGo/`: `npx tsc --noEmit`, `npx jest`, and `npm run test:rules` when
  rules or service functions change. On Windows the emulator's Java process can outlive the run
  and hold port 8080; end it before the next run.

## State of `dev-main` (2026-11-14)

- `tsc`: clean. `jest`: 19 suites / 173 tests. Rules tests: 36. `expo lint`: 0 errors, 42 warnings
  (was 58).
- Expo SDK 54, React Native 0.81, Tamagui, Auth0 login, Firestore (web SDK), Firebase Auth
  (custom token).

## Decisions

- **No Firebase Blaze plan** (owner, 2026-11-14), so no Cloud Functions. The Auth0 to Firebase
  sign-in exchange is done by an Auth0 post-login Action that mints a Firebase custom token and
  puts it in the ID token; the app signs in to Firebase with it. Free on both sides.
- **v1 must include** push notifications (#39, #20), payment tracking (#56) and meaningful group
  privacy levels (#17) (owner, 2026-11-14).
- **Post-launch:** payment providers (#55), best-of-n games (#57), friends (#24), location API
  (#14), linked accounts (#30, #34).
- Phone numbers stay stored as 10 digits (temporary-player matching depends on it) and are only
  formatted for display.
- Edit Event changes details only, not who is invited, and is closed once the event starts.
- Sign out lives on the Profile tab only (removed from the Home header).

## Open GitHub issues

| Issue | Title | Status |
|-------|-------|--------|
| #43 | Match score must attach an event | **Next.** Needs an `eventId` on matches (types, both rules files, Add/Edit Score) |
| #54 | White selector on create group | Next: replace the native wheel pickers on Create Group / Group Settings with themed option buttons, then close |
| #17 | Privacy levels mean something | To do (v1). Needs a decision on what each level allows, then a public-group browse/join screen and rule changes |
| #56 | Log payment sent / not sent | To do (v1). Per-attendee paid flag on events, organiser marks received |
| #39, #20 | In-app / score-approval notifications | To do (v1). Needs `expo-notifications`, APNs/FCM credentials and a new native build; without a backend, sends go from the client through Expo's push service |
| #50 | Fix app logo | Waiting on a logo asset from the owner |
| #55, #57, #24, #14, #30, #34 | Payments, best-of-n, friends, location, linked accounts | Post-launch |

Closed this session: #12, #28, #31, #33, #35, #42, #46 (already fixed in code), #41, #52, #53
(PR #69), #37 (PR #70).

## Other problems found (not in GitHub issues)

Fixed this session:

- Firestore accepted anonymous requests (code and rules ready, rollout pending; see T1).
- Invite screen called `Alert` and navigation during render when signed out; had no back button.
- Dashboard fetched match history twice on load; a tie showed as "W" but did not count as a win;
  scores were shown team 1 first rather than the player's score first.
- "Previous invite links" showed NaN uses for older unlimited invites and a "Created" time that
  was really the expiry.
- Muted text, `$color8` text and the success / warning / danger colours failed WCAG AA contrast
  on the cream background; tab bar ignored the theme.

Still open:

- Matches store no event or group reference, and the "Tournament/Event" text typed in Add Score is
  never saved (fix with #43).
- 22 hard-coded colours (`gray`, `white`, `#666`, ...) and 17 hard-coded status hexes remain in
  screens, mostly Add Members, Add Score and View Score; several screens build their own header
  instead of using `ScreenHeader`.
- Profile and group photos are stored as Base64 inside Firestore documents (up to ~1 MB each),
  which makes every list read heavy. Move to Firebase Storage after the T1 rollout.
- Per-user rules have known limits (any signed-in user can read by ID; joining is not tied to an
  invite; matches and temporary players are editable by any signed-in user). Closing these needs
  server-side code, which needs either Blaze or another host.
- `addScore.tsx`, `viewScore.tsx` and `editScore.tsx` are 1,000+ lines each and share a lot of
  player-picking logic; worth splitting before adding #43.
- 42 lint warnings, mostly unused imports and hook dependency arrays.
- Many stale local and remote branches from merged PRs (`AM-*`, `*-ANM`, `IOS-Anvay`, ...). Not
  deleted: confirm none hold unmerged work first.

## Work log

### 2026-11-14

- Surveyed the codebase and all 24 open issues; created this tracker (PR #67).
- **Security (PR #68):** Firebase sign-in from an Auth0-minted custom token, per-user Firestore
  rules (`firestore.auth.rules`) with emulator tests that run the real service functions as
  different users, Auth0 Action script, six-step rollout guide. Safe to merge: nothing changes
  until the owner deploys.
- **Small issues (PR #69):** Join with code (#53), invite list fixes (#52), phone formatting
  (#41), Groups tab loading/empty/error states, invite screen rewrite.
- **Edit Event (PR #70, #37):** organiser can edit event details until it starts.
- **UI foundation (PR #71):** contrast-checked colours, themed tab bar with outline/filled icons,
  Home screen rewrite (record card, next events open directly, consistent results).

## Resume here

Branch from `dev-main`. Suggested order:

1. **#43** match-event link, together with splitting the shared player-picker logic out of the
   score screens.
2. **#54 + colour sweep:** option buttons instead of wheel pickers; replace the remaining
   hard-coded colours; move every screen onto `ScreenHeader`.
3. **#56** payment tracking (small data change on events; add to both rules files).
4. **#17** privacy levels: ask the owner what "open / invite only / private" should each allow
   before building.
5. **#39 / #20** notifications: needs the owner to set up push credentials first.
