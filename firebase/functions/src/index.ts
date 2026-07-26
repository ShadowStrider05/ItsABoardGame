import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

type TurnInput = {
  position: number;
};

type ProfileInput = {
  displayName: string;
};

type SettingsInput = {
  mode: "pass_and_play" | "ranked" | "friends";
  mapId: "place_of_disper";
  playerCount: number;
  lapCount: number;
  startingPoints: number;
};

type QueueInput = {
  region?: string;
};

export const bootstrapProfile = onCall<ProfileInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required to bootstrap profile.");
  }

  const displayName = request.data.displayName?.trim();
  if (!displayName || displayName.length > 24) {
    throw new HttpsError("invalid-argument", "Display name must be 1-24 characters.");
  }

  const profileRef = db.collection("profiles").doc(request.auth.uid);
  await profileRef.set(
    {
      displayName,
      provider: "firebase",
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return {
    profileId: request.auth.uid,
    displayName,
    provider: "firebase"
  };
});

export const saveMatchSettings = onCall<SettingsInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required to save match settings.");
  }

  const { lapCount, playerCount, startingPoints, mode, mapId } = request.data;
  if (lapCount < 1 || lapCount > 30 || playerCount < 2 || playerCount > 6) {
    throw new HttpsError("invalid-argument", "Settings are outside allowed MVP ranges.");
  }

  const settingsRef = db
    .collection("profiles")
    .doc(request.auth.uid)
    .collection("settings")
    .doc("match_defaults");

  await settingsRef.set(
    {
      mode,
      mapId,
      playerCount,
      lapCount,
      startingPoints,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return {
    ok: true
  };
});

export const enqueueRankedMatch = onCall<QueueInput>(async (_request) => {
  throw new HttpsError(
    "failed-precondition",
    "Ranked multiplayer is not enabled in this build. Use Pass and Play for MVP sessions."
  );
});

export const createFriendsLobby = onCall<QueueInput>(async (_request) => {
  throw new HttpsError(
    "failed-precondition",
    "Play With Friends is not enabled in this build. Use Pass and Play for MVP sessions."
  );
});

export const validateTurn = onCall<TurnInput>((request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required for online turns.");
  }

  if (!Number.isInteger(request.data.position) || request.data.position < 0 || request.data.position > 8) {
    throw new HttpsError("invalid-argument", "Position must be an integer from 0 to 8.");
  }

  return {
    accepted: true,
    normalizedPosition: request.data.position
  };
});
