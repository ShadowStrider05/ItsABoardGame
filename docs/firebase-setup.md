# Firebase Setup (No Project Yet)

This repo is already wired to run without Firebase by falling back to local profiles.
When you are ready, connect a real Firebase project using these steps.

## 1. Create a Firebase Project

1. Go to Firebase Console and create a new project.
2. Add a Web App and copy the client config values.
3. Enable Authentication -> Anonymous provider.
4. Create Firestore database in test mode first, then apply repo rules.

## 2. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

## 3. Bind this repo to your project

1. Copy `firebase/.firebaserc.example` to `firebase/.firebaserc`.
2. Replace `your-firebase-project-id` with your real project ID.

## 4. Configure game client env vars

1. Copy `apps/game/.env.example` to `apps/game/.env.local`.
2. Fill in the `VITE_FIREBASE_*` values from the Firebase Web App config.

## 5. Deploy backend and rules

Run from the repo root:

```bash
cd firebase
firebase deploy --only firestore:rules,functions
```

## 6. Optional local emulator workflow

If you want to test rules/functions without touching production:

```bash
cd firebase
firebase emulators:start --only firestore,functions,auth
```

## Notes

- Without env vars, the app uses local fallback profiles and still works for Pass and Play.
- Ranked and Play With Friends are intentionally disabled in this build.
- Cloud Functions include explicit stubs that return "not enabled" for online modes.
