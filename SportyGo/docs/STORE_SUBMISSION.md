# App Store and Google Play submission checklist

What still has to happen outside the code before submitting SportyGo. The app itself now has the
store-required features (in-app account deletion, privacy policy link, support contact,
report/leave/remove/delete for groups, no unused permissions, iOS privacy manifest).

## 1. Deploy the website pages

The privacy policy, account deletion page and the fixed invite page live in `public/` and are
served by Firebase Hosting. Deploy them so the URLs below work:

```bash
firebase deploy --only hosting
```

- Privacy policy: https://sportygo-sparkpro.web.app/privacy
- Account deletion: https://sportygo-sparkpro.web.app/delete-account

Have someone review `public/privacy.html` before publishing; it describes what the app collects
today. If you turn on Pendo (or any analytics) later, update the policy and the store forms below.

## 2. Close the server-side security gap (high priority)

Until this is done, Firestore sees every request as anonymous and anyone who extracts the
Firebase config from the app could read or change all data. The app-side code, an Auth0 Action
script and per-user Firestore rules are in the repository; follow the six steps in
[FIREBASE_AUTH_SETUP.md](FIREBASE_AUTH_SETUP.md) (Auth0 dashboard + Firebase console, no paid
plan needed) before public launch.

## 3. Auth0

- **Sign in with Apple:** if Auth0 Universal Login offers any social login (Google, Facebook, ...),
  Apple guideline 4.8 requires Sign in with Apple as well. Check Auth0 > Authentication > Social.
- **Deleting the login itself:** in-app deletion removes all SportyGo data, but the Auth0 user
  record stays. Delete it from the Auth0 dashboard when someone emails a deletion request, or add a
  backend step (Auth0 Management API) to remove it automatically.
- Create a **demo account** for app reviewers (see below).

## 4. App Store Connect

- **App Review Information:** demo account email/password, and a note that invite links open at
  `https://sportygo-sparkpro.web.app/groups/<code>`.
- **Privacy Policy URL:** https://sportygo-sparkpro.web.app/privacy
- **Support URL:** https://sportygo-sparkpro.web.app (or a support page) and contact
  contactus@sparkpro.ca.
- **App Privacy (nutrition label)**: data is *linked to the user*, *not used for tracking*:
  - Contact Info: Name, Email Address, Phone Number (optional)
  - User Content: Photos (profile/group photos), Other User Content (groups, events, match results)
  - Identifiers: User ID
  - Other Data: date of birth (age check)
  - Purpose for all: App Functionality
- **Age rating:** answer the questionnaire; the app blocks users under 13.
- **Export compliance:** already answered in the build (`ITSAppUsesNonExemptEncryption: false`).
- Screenshots: iPhone only (the app is now iPhone-only, so no iPad screenshots are needed).

## 5. Google Play Console

- **Privacy policy:** https://sportygo-sparkpro.web.app/privacy
- **Data safety:** collects Name, Email, Phone (optional), Photos, Other user-generated content,
  Date of birth, User IDs; all for App functionality; encrypted in transit; not shared with third
  parties for their own use; users can request deletion.
- **Delete account URL:** https://sportygo-sparkpro.web.app/delete-account
- **Content rating** questionnaire, **target audience** 13+.
- **App access:** provide the same demo account as for Apple.

## 6. Build and submit

```bash
eas build --platform all --profile production
```

```bash
eas submit --platform ios --profile production
```
