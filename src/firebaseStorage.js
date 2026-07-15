// src/firebaseStorage.js
// Firebase Storage isolé de firebase.js : n'est importé que par les modules
// lazy qui en ont besoin (photos CRC, visites de site), pas au démarrage.
import { getStorage } from "firebase/storage";
import { app } from "./firebase";

export const storage = getStorage(app);
