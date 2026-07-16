import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Check, Search, Share2, X } from 'lucide-react';
import { db } from '../../firebase';

export default function SiteVisitShareModal({ isOpen, onClose, visit, companyId, currentUser, onSave }) {
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setSelected(new Set((visit?.sharedWith || []).map(member => member.uid)));
    setSaveError('');
    setLoading(true);
    setLoadError(false);
    getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)))
      .then(snap => setMembers(snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(member => member.uid !== currentUser?.uid)))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [isOpen, companyId, currentUser?.uid, visit?.id, visit?.sharedWith]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter(member => `${member.displayName || ''} ${member.email || ''}`.toLowerCase().includes(term));
  }, [members, search]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(members.filter(member => selected.has(member.uid)));
      onClose();
    } catch (error) {
      console.error('[SiteVisit] Erreur partage :', error);
      setSaveError("Le partage n'a pas pu être enregistré. Réessayez dans quelques instants.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-200/60 overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Share2 size={19} /></div>
            <div><h2 className="font-bold text-gray-900">Partager la visite</h2><p className="text-xs text-gray-500">Accès interne en lecture seule</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200/60 rounded-xl px-3 mb-4">
            <Search size={15} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un collaborateur"
              className="w-full bg-transparent py-2.5 text-sm outline-none text-gray-900 placeholder:text-gray-500" />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading && <p className="text-center text-sm text-gray-500 py-8">Chargement…</p>}
            {!loading && loadError && <p className="text-center text-sm text-red-500 py-8">Impossible de charger l'annuaire interne.</p>}
            {!loading && filteredMembers.map(member => {
              const active = selected.has(member.uid);
              return (
                <button key={member.uid} onClick={() => setSelected(prev => {
                  const next = new Set(prev); active ? next.delete(member.uid) : next.add(member.uid); return next;
                })} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${active ? 'bg-blue-50 border border-blue-200' : 'border border-transparent hover:bg-gray-50'}`}>
                  <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                    {(member.displayName || member.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-gray-900 truncate">{member.displayName || member.email}</div>{member.displayName && <div className="text-xs text-gray-500 truncate">{member.email}</div>}</div>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'border border-gray-300'}`}>{active && <Check size={14} />}</div>
                </button>
              );
            })}
            {!loading && filteredMembers.length === 0 && <p className="text-center text-sm text-gray-500 py-8">Aucun collaborateur trouvé.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          {saveError && <p role="alert" className="mr-auto self-center text-xs font-medium text-red-600">{saveError}</p>}
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">{saving ? 'Enregistrement…' : `Partager (${selected.size})`}</button>
        </div>
      </div>
    </div>
  );
}
