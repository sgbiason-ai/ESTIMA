import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, query, serverTimestamp, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

export function useSiteVisitShareNotifications(userId) {
  const [unreadIds, setUnreadIds] = useState([]);

  useEffect(() => {
    if (!userId) { setUnreadIds([]); return undefined; }
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const unreadQuery = query(notificationsRef, where('readAt', '==', null));
    return onSnapshot(
      unreadQuery,
      snap => setUnreadIds(snap.docs
        .filter(item => item.data().type === 'site_visit_share')
        .map(item => item.id)),
      () => setUnreadIds([]),
    );
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId || unreadIds.length === 0) return;
    const ids = [...unreadIds];
    setUnreadIds([]);
    const batch = writeBatch(db);
    ids.forEach(id => batch.update(doc(db, 'users', userId, 'notifications', id), {
      readAt: serverTimestamp(),
    }));
    try {
      await batch.commit();
    } catch (error) {
      setUnreadIds(ids);
      throw error;
    }
  }, [userId, unreadIds]);

  return { count: unreadIds.length, markAllRead };
}
