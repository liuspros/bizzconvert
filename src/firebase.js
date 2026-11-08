import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { FIREBASE, DEMO } from "./config.js";

export const app = DEMO ? null : initializeApp(FIREBASE);
export const db = DEMO ? null : getFirestore(app);
