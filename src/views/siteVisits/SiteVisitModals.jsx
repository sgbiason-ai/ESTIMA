// src/views/siteVisits/SiteVisitModals.jsx
// Modales de la vue Visites de Site — edition infos visite + edition observation.

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, MessageSquare, X, Pencil, ImagePlus, Camera, Info } from 'lucide-react';
import { uploadSiteVisitImage, deleteSiteVisitImage } from '../../utils/siteVisitImageStorage';

// ─── Modale edition infos visite ────────────────────────────────────────────

export function VisitInfoModal({ isOpen, onClose, visit, onSave }) {
  const [form, setForm] = useState({ nom: '', lieu: '', client: '', date: '' });
  useEffect(() => {
    if (isOpen && visit) setForm({ nom: visit.nom || '', lieu: visit.lieu || '', client: visit.client || '', date: visit.date || '' });
  }, [isOpen, visit?.id]);
  if (!isOpen) return null;

  const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200/60 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400";
  const labelCls = "flex items-center gap-1.5 text-[11px] text-gray-500 font-medium mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50"><Info size={18} className="text-blue-600" /></div>
            <h3 className="text-sm font-bold text-gray-900">Informations de la visite</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}><MapPin size={11} /> Nom de la visite</label>
            <input type="text" value={form.nom} onChange={(e) => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Visite chantier RD45" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Navigation size={11} /> Lieu</label>
            <input type="text" value={form.lieu} onChange={(e) => setForm(p => ({ ...p, lieu: e.target.value }))} placeholder="Ex: Commune d'Aiguefonde (81)" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><MessageSquare size={11} /> Client</label>
            <input type="text" value={form.client} onChange={(e) => setForm(p => ({ ...p, client: e.target.value }))} placeholder="Ex: Mairie de..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition">Annuler</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition active:scale-[0.97]">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modale edition observation ─────────────────────────────────────────────

// Cle stable d'une image (path Storage, sinon src/base64)
const imgKey = (img) => (typeof img === 'object' && img ? (img.path || img.src) : img);

export function ObsEditModal({ isOpen, onClose, obs, onSave, companyId, visitId }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const originalRef = useRef([]);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (isOpen && obs) {
      setText(obs.text || '');
      setImages(obs.images || []);
      originalRef.current = obs.images || [];
    }
  }, [isOpen, obs?.id]);

  const handleAddImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    if (files.length === 0) return;
    if (!companyId || !visitId || !obs?.id) {
      console.error('[Visite] Upload photo impossible : contexte manquant');
      return;
    }
    setUploading(true);
    try {
      // Upload vers Storage → le document ne stocke qu'une URL (jamais de base64).
      const uploaded = await Promise.all(
        files.map(f => uploadSiteVisitImage(f, { companyId, visitId, obsId: obs.id }))
      );
      setImages(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error('[Visite] Erreur upload photo:', err);
    } finally {
      setUploading(false);
    }
  };

  // Retrait local uniquement : la suppression Storage est differee a
  // l'enregistrement (sinon « Annuler » apres retrait perdrait la photo).
  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Enregistrer : supprimer de Storage les images retirees (presentes a
  // l'ouverture mais plus dans la liste finale).
  const handleSave = () => {
    const finalKeys = new Set(images.map(imgKey));
    originalRef.current
      .filter(img => !finalKeys.has(imgKey(img)))
      .forEach(img => deleteSiteVisitImage(img));
    onSave(text, images);
    onClose();
  };

  // Annuler : supprimer de Storage les images ajoutees cette session (pas
  // dans l'original) pour ne pas laisser d'orphelins.
  const handleCancel = () => {
    const originalKeys = new Set(originalRef.current.map(imgKey));
    images
      .filter(img => !originalKeys.has(imgKey(img)))
      .forEach(img => deleteSiteVisitImage(img));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center" onMouseDown={handleCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50"><Pencil size={18} className="text-amber-600" /></div>
            <h3 className="text-sm font-bold text-gray-900">Modifier l'observation</h3>
          </div>
          <button onClick={handleCancel} className="p-1.5 hover:bg-gray-100 rounded-xl transition"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[120px] p-3 rounded-xl text-sm resize-y outline-none bg-gray-50 text-gray-900 border border-gray-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Note ou observation..." autoFocus />

          {/* Photos */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img, idx) => {
                const imgSrc = typeof img === 'string' ? img : img.src;
                return (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                    <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <button onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ajouter photo : fichier + camera */}
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition">
              <ImagePlus size={16} />
              Ajouter une image
            </button>
            <button onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-medium text-blue-700 transition"
              title="Prendre une photo avec l'appareil (tablette/mobile)">
              <Camera size={16} />
              Prendre une photo
            </button>
          </div>
          {uploading && <p className="text-[11px] text-blue-600 text-center">Téléversement des photos…</p>}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddImages} />
        </div>
        <div className="px-6 py-4 border-t border-gray-200/60 flex justify-end gap-2">
          <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition">Annuler</button>
          <button onClick={handleSave} disabled={uploading} className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
