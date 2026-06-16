// src/hooks/useAppAuth.js
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useAppAuth = () => {
  const [user, setUser]           = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  // userModules : array d'IDs de modules autorisés. null = pas de restriction
  // (fallback comportement legacy basé sur isAdmin + access).
  const [userModules, setUserModules] = useState(null);
  // userMobileModules : array d'IDs de modules MOBILE autorisés (champ
  // `mobileModules` du doc user). null = pas de restriction explicite côté
  // mobile (défaut : tout autoriser, sous réserve du desktopGate).
  const [userMobileModules, setUserMobileModules] = useState(null);
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
          setUserMobileModules(null);
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
          setUserMobileModules(Array.isArray(data.mobileModules) ? data.mobileModules : null);

          // Self-heal : renseigne email/nom dans le profil pour que le module
          // Administration affiche « qui est qui » au lieu de l'UID brut. L'user
          // écrit son PROPRE doc sans toucher isAdmin → autorisé par les règles.
          // Best-effort, non bloquant.
          const freshEmail = currentUser.email || null;
          const freshName = currentUser.displayName || null;
          const patch = {};
          if (freshEmail && data.email !== freshEmail) patch.email = freshEmail;
          if (freshName && data.displayName !== freshName) patch.displayName = freshName;
          if (Object.keys(patch).length) {
            updateDoc(doc(db, 'users', currentUser.uid), patch).catch(() => { /* non bloquant */ });
          }
        } else {
          // Utilisateur authentifié mais pas encore assigné à une entreprise
          console.warn('Profil utilisateur introuvable dans Firestore (/users/' + currentUser.uid + ')');
          setCompanyId(null);
          setIsAdmin(false);
          setUserModules(null);
          setUserMobileModules(null);
        }
      } catch (e) {
        console.error('Erreur lecture profil utilisateur :', e);
        setCompanyId(null);
        setIsAdmin(false);
        setUserModules(null);
        setUserMobileModules(null);
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

  return { user, companyId, isAdmin, userModules, userMobileModules, authLoading, handleLogout };
};