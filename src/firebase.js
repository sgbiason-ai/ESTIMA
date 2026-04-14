// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuration Firebase via variables d'environnement
// Voir .env.example pour le format attendu
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialisation
const app = initializeApp(firebaseConfig);

// Détection navigateur Tesla ou contexte sans IndexedDB fiable
// UA Tesla Model 3 : "Mozilla/5.0 (X11; Linux x86_64) ... Chrome/140 ... Safari/537.36" (pas de "Tesla" dedans)
const ua = navigator.userAgent || '';
const isTeslaBrowser = /Tesla/i.test(ua)
  || new URLSearchParams(window.location.search).get('tesla') === '1'
  || (/X11; Linux x86_64/.test(ua) && /Chrome\/\d/.test(ua)
      && !/Ubuntu|Fedora|Debian|SUSE|Mint|Arch|CrOS|Android/.test(ua));

// Firestore : mémoire pour Tesla (pas d'IndexedDB fiable), persistant sinon
const db = initializeFirestore(app, {
  localCache: isTeslaBrowser
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
export { db };