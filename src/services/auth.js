import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase.js";
import { ensureUserProfile, claimInvites } from "./db.js";

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await ensureUserProfile(user);
        await claimInvites(user);
      } catch (e) {
        console.error("Post-login setup failed", e);
      }
    }
    callback(user);
  });
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
