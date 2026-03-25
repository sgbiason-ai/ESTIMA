// src/hooks/useAppAuth.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useAppAuth = () => {
  const [user, setUser]           = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setCompanyId(null);
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      try {
        // Lecture du profil utilisateur dans /users/{uid}
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCompanyId(data.companyId || null);
          setIsAdmin(data.isAdmin === true);
        } else {
          // Utilisateur authentifié mais pas encore assigné à une entreprise
          console.warn('Profil utilisateur introuvable dans Firestore (/users/' + currentUser.uid + ')');
          setCompanyId(null);
          setIsAdmin(false);
        }
      } catch (e) {
        console.error('Erreur lecture profil utilisateur :', e);
        setCompanyId(null);
        setIsAdmin(false);
      }

      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur déconnexion :', error);
    }
  };

  return { user, companyId, isAdmin, authLoading, handleLogout };
};