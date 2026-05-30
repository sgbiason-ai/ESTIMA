// src/hooks/useSupportSession.js
// Assistance écran en direct (WebRTC) — signalisation 100 % Firestore.
//
//  - useScreenShareSession : côté UTILISATEUR (partage son écran, "caller")
//  - useSupportViewer      : côté SUPER-ADMIN (visionne, "callee" + pointeur)
//  - useSupportRequests    : liste temps réel des demandes en cours (bandeau admin)
//
// Schéma : supportSessions/{id} { status, offer, answer, pointer, meta }
//          + sous-collections callerCandidates / calleeCandidates (ICE)

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  collection, doc, addDoc, setDoc, updateDoc, getDoc, onSnapshot,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { RTC_CONFIG } from '../config/webrtc';
import { APP_VERSION } from '../data/changelog';
import { moduleLabel } from '../components/feedback/feedbackConstants';

const COL = 'supportSessions';

// ═══════════════════════════════════════════════════════════════════════════
// UTILISATEUR — partage son écran
// ═══════════════════════════════════════════════════════════════════════════
export const useScreenShareSession = ({ user, companyId, activeModule }) => {
  // idle | requesting | waiting | active | error
  const [status, setStatus]   = useState('idle');
  const [pointer, setPointer] = useState({ x: 0, y: 0, visible: false });
  const [error, setError]     = useState(null);
  const ref = useRef({ pc: null, stream: null, sessionRef: null, unsubs: [] });

  const cleanup = useCallback((nextStatus) => {
    const r = ref.current;
    r.unsubs.forEach((u) => { try { u(); } catch { /* noop */ } });
    r.unsubs = [];
    if (r.stream) { r.stream.getTracks().forEach((t) => t.stop()); r.stream = null; }
    if (r.pc) { try { r.pc.close(); } catch { /* noop */ } r.pc = null; }
    setPointer({ x: 0, y: 0, visible: false });
    if (nextStatus) setStatus(nextStatus);
  }, []);

  const endSession = useCallback(async () => {
    const r = ref.current;
    const sessionRef = r.sessionRef;
    r.sessionRef = null;
    cleanup('idle');
    if (sessionRef) {
      try { await updateDoc(sessionRef, { status: 'ended', endedAt: serverTimestamp() }); }
      catch { /* noop */ }
    }
  }, [cleanup]);

  const requestAssistance = useCallback(async () => {
    setError(null);
    let stream;
    try {
      setStatus('requesting');
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 12 }, audio: false,
      });
    } catch {
      setStatus('idle');
      setError("Partage d'écran refusé ou indisponible.");
      return;
    }

    try {
      const r = ref.current;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      r.pc = pc; r.stream = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // L'utilisateur arrête le partage via l'UI native du navigateur
      stream.getVideoTracks()[0].addEventListener('ended', () => { endSession(); });

      const sessionRef = doc(collection(db, COL));
      r.sessionRef = sessionRef;
      const callerC = collection(sessionRef, 'callerCandidates');
      const calleeC = collection(sessionRef, 'calleeCandidates');

      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(callerC, e.candidate.toJSON()).catch(() => {});
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(sessionRef, {
        status: 'requested',
        userUid:   user?.uid || null,
        userEmail: user?.email || null,
        companyId: companyId || null,
        module:      activeModule || null,
        moduleLabel: moduleLabel(activeModule),
        version:   APP_VERSION,
        createdAt: serverTimestamp(),
        offer: { type: offer.type, sdp: offer.sdp },
        pointer: null,
      });
      setStatus('waiting');

      const unsubSession = onSnapshot(sessionRef, async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.answer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            setStatus('active');
          } catch { /* noop */ }
        }
        if (data.pointer) {
          setPointer({ x: data.pointer.x, y: data.pointer.y, visible: !!data.pointer.visible });
        }
        if (data.status === 'ended') { r.sessionRef = null; cleanup('idle'); }
      });

      const unsubCallee = onSnapshot(calleeC, (snap) => {
        snap.docChanges().forEach((c) => {
          if (c.type === 'added') {
            pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
          }
        });
      });

      r.unsubs.push(unsubSession, unsubCallee);
    } catch {
      setError('Erreur de connexion à l\'assistance.');
      cleanup('idle');
    }
  }, [user, companyId, activeModule, cleanup, endSession]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  return { status, pointer, error, requestAssistance, endSession };
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPER-ADMIN — visionne l'écran partagé
// ═══════════════════════════════════════════════════════════════════════════
export const useSupportViewer = () => {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | active
  const ref = useRef({ pc: null, sessionRef: null, unsubs: [], pointerTs: 0 });

  const leave = useCallback(async (markEnded = true) => {
    const r = ref.current;
    r.unsubs.forEach((u) => { try { u(); } catch { /* noop */ } });
    r.unsubs = [];
    const sessionRef = r.sessionRef;
    r.sessionRef = null;
    if (r.pc) { try { r.pc.close(); } catch { /* noop */ } r.pc = null; }
    setStream(null);
    setStatus('idle');
    if (markEnded && sessionRef) {
      try { await updateDoc(sessionRef, { status: 'ended', endedAt: serverTimestamp() }); }
      catch { /* noop */ }
    }
  }, []);

  const join = useCallback(async (sessionId) => {
    setStatus('connecting');
    try {
      const r = ref.current;
      const sessionRef = doc(db, COL, sessionId);
      r.sessionRef = sessionRef;
      const callerC = collection(sessionRef, 'callerCandidates');
      const calleeC = collection(sessionRef, 'calleeCandidates');

      const pc = new RTCPeerConnection(RTC_CONFIG);
      r.pc = pc;
      const remote = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => remote.addTrack(t));
        setStream(remote);
        setStatus('active');
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(calleeC, e.candidate.toJSON()).catch(() => {});
      };

      const snap = await getDoc(sessionRef);
      const data = snap.data();
      if (!data?.offer) { setStatus('idle'); r.sessionRef = null; return; }

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(sessionRef, {
        answer: { type: answer.type, sdp: answer.sdp },
        status: 'active',
      });

      const unsubCaller = onSnapshot(callerC, (s) => {
        s.docChanges().forEach((c) => {
          if (c.type === 'added') {
            pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
          }
        });
      });
      const unsubSession = onSnapshot(sessionRef, (s) => {
        if (s.data()?.status === 'ended') leave(false);
      });
      r.unsubs.push(unsubCaller, unsubSession);
    } catch {
      setStatus('idle');
      ref.current.sessionRef = null;
    }
  }, [leave]);

  // Envoie la position du pointeur (coords normalisées 0..1), throttlé.
  const sendPointer = useCallback((x, y, visible) => {
    const r = ref.current;
    if (!r.sessionRef) return;
    const now = Date.now();
    if (visible && now - r.pointerTs < 70) return;
    r.pointerTs = now;
    updateDoc(r.sessionRef, { pointer: { x, y, visible } }).catch(() => {});
  }, []);

  useEffect(() => () => { leave(false); }, [leave]);

  return { stream, status, join, leave, sendPointer };
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPER-ADMIN — demandes d'assistance en cours (bandeau)
// ═══════════════════════════════════════════════════════════════════════════
export const useSupportRequests = (enabled) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!enabled) { setSessions([]); return; }
    const q = query(collection(db, COL), where('status', 'in', ['requested', 'active']));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSessions(list);
      },
      () => {}
    );
    return unsub;
  }, [enabled]);

  return sessions;
};
