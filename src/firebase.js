// src/firebase.js
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Votre configuration (celle que vous m'avez envoyée)
const firebaseConfig = {
  apiKey: "AIzaSyDby1BlayoezgzZ31qsB4881ryg66_YYBI",
  authDomain: "estimavrd-app.firebaseapp.com",
  projectId: "estimavrd-app",
  storageBucket: "estimavrd-app.firebasestorage.app",
  messagingSenderId: "738719651607",
  appId: "1:738719651607:web:c2d9102e0edf7714058952"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const auth = getAuth(app);

export { db };