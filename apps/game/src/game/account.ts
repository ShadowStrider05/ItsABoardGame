import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import type { AccountProfile } from "./types";

const localProfileKey = "itsaboardgame.local.profile";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
};

function readFirebaseConfig(): FirebaseConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined
  };
}

async function initAnalyticsIfSupported(): Promise<void> {
  const app = getApps()[0];
  if (!app) {
    return;
  }

  const supported = await isSupported();
  if (supported) {
    getAnalytics(app);
  }
}

export function loadCachedProfile(): AccountProfile | null {
  const raw = localStorage.getItem(localProfileKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AccountProfile;
  } catch {
    return null;
  }
}

export async function bootstrapProfile(displayName: string): Promise<AccountProfile> {
  const config = readFirebaseConfig();

  if (config) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
    void initAnalyticsIfSupported();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const credentials = await signInAnonymously(auth);
    const profile: AccountProfile = {
      id: credentials.user.uid,
      displayName,
      provider: "firebase"
    };

    await setDoc(
      doc(db, "profiles", profile.id),
      {
        displayName,
        provider: "firebase",
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    localStorage.setItem(localProfileKey, JSON.stringify(profile));
    return profile;
  }

  const fallbackProfile: AccountProfile = {
    id: `local-${Math.random().toString(16).slice(2, 10)}`,
    displayName,
    provider: "local"
  };

  localStorage.setItem(localProfileKey, JSON.stringify(fallbackProfile));
  return fallbackProfile;
}