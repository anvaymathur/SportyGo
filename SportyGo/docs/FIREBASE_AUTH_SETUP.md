# Securing Firestore: Auth0 login to Firebase identity

People log in with Auth0, but Firestore security rules only understand Firebase identities.
Until the steps below are done, Firestore sees every request as anonymous and the deployed rules
(`firestore.rules`) can only check the shape of the data, not who is asking.

The fix needs no Firebase Blaze plan and no extra server:

1. An **Auth0 post-login Action** mints a Firebase custom token for the person logging in and puts
   it in their Auth0 ID token.
2. The **app** signs in to Firebase with that token (`utils/firebaseSession.ts`). Firestore then
   sees `request.auth.uid` = the Auth0 user ID, the same ID already used for `users/{id}`,
   `OwnerId`, `MemberIds`, `CreatorID` and so on. No data migration is needed.
3. **Per-user rules** (`firestore.auth.rules`) replace the current ones.

The app side is already in the code and is harmless until the Action exists: with no token in
the ID token it carries on exactly as before.

## Rollout order (do not skip ahead)

Deploying the per-user rules before people have a build that signs in to Firebase locks them out.

### Step 1: Turn on Firebase Authentication

Firebase console > Build > Authentication > **Get started**. No sign-in provider needs to be
enabled; custom tokens work without one. This is free on the Spark plan.

### Step 2: Create a service-account key

Firebase console > Project settings > Service accounts > **Generate new private key**. A JSON file
downloads. You need two values from it: `client_email` and `private_key`.

Treat this file like a password: it grants admin access to the Firebase project. Do not commit it
or put it in the app. After copying the two values into Auth0, delete the file.

### Step 3: Create the Auth0 Action

Auth0 dashboard > Actions > Library > **Create Action** > Build from scratch.

- Name: `Firebase sign-in token`, Trigger: **Login / Post Login**, Runtime: the recommended Node.
- Paste the contents of [`docs/auth0/firebase-token-action.js`](auth0/firebase-token-action.js).
- Dependencies (box icon): add `jsonwebtoken`.
- Secrets (key icon): the simplest option is one secret, `FIREBASE_SERVICE_ACCOUNT`, holding the
  **entire** contents of the key file from step 2. Alternatively add `FIREBASE_CLIENT_EMAIL` and
  `FIREBASE_PRIVATE_KEY` (the `client_email` and `private_key` values). The key is accepted with
  or without quotes, and however the secret box handles its line breaks.
- **Deploy**, then Actions > Triggers > post-login: drag the Action into the flow and **Apply**.

Also check Applications > SportyGo > Settings > Advanced > Grant Types: **Refresh Token** must be
ticked (the app now requests `offline_access` so it can renew the Firebase token silently).

### Step 4: Verify

No new build is needed for steps 1 to 3: they are server-side, and any build that includes the
Firebase sign-in code (PR #68 onwards) picks them up. But the token is only added to an ID token
issued **after** the Action is in the Login flow, so you must **log out and back in**.

1. **Test the Action on its own.** In the Action editor, click **Test** (play icon) and **Run**.
   The result should list a custom claim `https://sportygo.ca/firebase_token` with a long value.
   If the console shows `Firebase token skipped: secrets are not set` or `Firebase token failed: ...`,
   fix the secrets (see below) and **Deploy** again.
2. **Check it is in the flow.** Actions > Triggers > post-login: the Action must sit between Start
   and Complete, and you must have clicked **Apply**.
3. **Log out and back in** on the app (Profile > Sign out), with the Metro terminal open. You
   should see one of:
   - `Firebase sign-in OK for auth0|...`: working. Firebase console > Authentication > Users now
     lists that UID (refresh the page).
   - `Firebase sign-in skipped: the Auth0 ID token has no Firebase token`: the Action did not run
     for this login (not in the flow, not deployed, or you did not log in again).
   - `Firebase sign-in failed ... auth/invalid-custom-token`: the token was made with the wrong key
     or email. Re-copy both secrets from the same service-account JSON.
   - `... auth/configuration-not-found`: Authentication was never started (step 1).
   - `... requests-to-this-api ... are-blocked`: the Firebase API key is restricted. Google Cloud
     console > APIs & Services > Credentials > the key > allow **Identity Toolkit API**.
4. **Auth0 > Monitoring > Logs:** open the latest *Success Login* entry; its Action details show
   whether the Action ran and anything it logged.

If **Test** logs `Firebase token skipped: ...`, the message says which secret is wrong. Usually
it is the `private_key_id` pasted instead of `private_key`, or only part of the key. Each time you
change the code or a secret, click **Deploy** again; Test runs the saved draft, logins use the
deployed version.

A JavaScript-only change like this one can also reach installed preview/production builds through
`eas update` without a new build (same app version).

### Step 5: Ship the build, wait for testers to update

Release this version to all testers / the stores. Anyone still on an older build keeps working
because the old rules are still deployed.

### Step 6: Deploy the per-user rules

Once everyone is on the new build:

```bash
npm run deploy:rules:auth
```

From then on signed-out requests are refused. Someone whose stored login predates the Action is
sent back to the login screen once; logging in again fixes it.

To roll back to the previous rules at any time:

```bash
npm run deploy:rules
```

After a week without problems, make it permanent: replace the contents of `firestore.rules` with
`firestore.auth.rules`, delete `firestore.auth.rules` and `firebase.auth.json`, and remove the
older rules test file.

## What the per-user rules enforce

- Nothing can be read or written without being signed in.
- A profile can only be created, edited or deleted by its own user.
- A group is created by its owner, edited by its owner or admins, deleted by its owner. Anyone
  else can only add or remove themselves as a member.
- Invite links are created and deleted by the group's owner or admins.
- An event is created under your own ID and deleted only by its creator.
- You can only cast, change or remove your own vote.

Known limits, which need server-side code to close (for a later release):

- Any signed-in user can read profiles, groups, events and matches if they know or guess the ID.
- Joining a group is not tied to holding a valid invite.
- Matches and temporary players can be edited by any signed-in user.

## Testing

```bash
npm run test:rules
```

runs the app's real service functions against the Firestore emulator under both rule sets
(`rules-tests/`). On Windows the emulator's Java process can outlive the run and keep port 8080
busy; end it from Task Manager if the next run says the port is taken.
