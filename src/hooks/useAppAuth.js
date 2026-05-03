// src/hooks/useAppAuth.js
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useAppAuth = () => {
  const [user, setUser]           = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  // userModules : array d'IDs de modules autorisés. null = pas de restriction
  // (fallback comportement legacy basé sur isAdmin + access).
  const [userModules, setUserModules] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const hadUserRef = useRef(false);
  const logoutTimerRef = useRef(null);
  const intentionalLogoutRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Annuler tout timer de déconnexion en attente
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }

      if (!currentUser) {
        const doLogout = () => {
          setUser(null);
          setCompanyId(null);
          setIsAdmin(false);
          setUserModules(null);
          setAuthLoading(false);
          hadUserRef.current = false;
          intentionalLogoutRef.current = false;
        };

        // Grace period : si on avait un user et que le logout n'est pas intentionnel,
        // attendre 3s pour le token refresh (scénario Tesla écran off/on)
        if (hadUserRef.current && !intentionalLogoutRef.current) {
          logoutTimerRef.current = setTimeout(doLogout, 3000);
        } else {
          doLogout();
        }
        return;
      }

      hadUserRef.current = true;

      try {
        // Lecture du profil utilisateur dans /users/{uid}
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCompanyId(data.companyId || null);
          setIsAdmin(data.isAdmin === true);
          setUserModules(Array.isArray(data.modules) ? data.modules : null);
        } else {
          // Utilisateur authentifié mais pas encore assigné à une entreprise
          console.warn('Profil utilisateur introuvable dans Firestore (/users/' + currentUser.uid + ')');
          setCompanyId(null);
          setIsAdmin(false);
          setUserModules(null);
        }
      } catch (e) {
        console.error('Erreur lecture profil utilisateur :', e);
        setCompanyId(null);
        setIsAdmin(false);
        setUserModules(null);
      }

      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const handleLogout = async () => {
    intentionalLogoutRef.current = true;
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur déconnexion :', error);
      intentionalLogoutRef.current = false;
    }
  };

  return { user, companyId, isAdmin, userModules, authLoading, handleLogout };
};