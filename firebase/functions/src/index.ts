import { onCall, HttpsError } from "firebase-functions/v2/https";

type TurnInput = {
  position: number;
};

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
