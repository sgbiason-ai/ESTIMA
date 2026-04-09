// src/components/mobile/SiteVisitDetailView.jsx
// Vue détail d'une visite de site — observations + terrain.

import React, { useState, useCallback, useMemo } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { stripHtml } from '../../utils/formatObsText';
import ImageViewerModal from './ImageViewerModal';
import SiteVisitObsEditSheet from './SiteVisitObsEditSheet';
import GpsTrackingSection from './GpsTrackingSection';

// ─── Sous-composants ───────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition ${
        active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
      }`}>
      {label}
    </button>
  );
}

function ObsCard({ obs, number, onTap, onDelete, onViewImage }) {
  const text = stripHtml(obs.text || '');
  const images = obs.images || [];
  const [swipeX, setSwipeX] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const showDelete = swipeX < -60;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Bouton supprimer (révélé par swipe gauche) */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl"
        onClick={() => onDelete?.(obs.id)}>
        <Icon name="trash" size={18} color="#fff" />
      </div>

      <div
        className="relative bg-white border border-gray-200 p-3 active:bg-gray-50 cursor-pointer rounded-xl"
        style={{ transform: `translateX(${Math.min(0, Math.max(-80, swipeX))}px)`, transition: touchStart ? 'none' : 'transform 0.25s ease' }}
        onClick={() => { if (Math.abs(swipeX) < 10) onTap(obs); else setSwipeX(0); }}
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchMove={e => { if (touchStart != null) setSwipeX(e.touches[0].clientX - touchStart); }}
        onTouchEnd={() => { setTouchStart(null); if (swipeX > -60) setSwipeX(0); }}
      >
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{number}</span>
        <div className="flex-1 min-w-0">
      {text && (
        <p className="text-[13px] text-gray-700 leading-relaxed line-clamp-4 whitespace-pre-line">{text}</p>
      )}
      {!text && images.length === 0 && (
        <p className="text-[13px] text-gray-400 italic">Observation vide — appuyez pour éditer</p>
      )}
      {images.length > 0 && (
        <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
          {images.slice(0, 4).map((img, idx) => {
            const imgSrc = typeof img === 'string' ? img : img.src;
            const hasGps = typeof img === 'object' && img.lat != null;
            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0"
                  onClick={() => onViewImage?.(imgSrc)}>
                  <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                {hasGps && (
                  <a href={`https://www.google.com/maps?q=${img.lat},${img.lng}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[8px] italic text-blue-500 mt-0.5">
                    Loc.
                  </a>
                )}
              </div>
            );
          })}
          {images.length > 4 && (
            <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-600">+{images.length - 4}</span>
            </div>
          )}
        </div>
      )}
      {obs.date && <div className="text-[10px] text-gray-400 mt-2">{dateFr(obs.date)}</div>}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────

export default function SiteVisitDetailView({ visit, onSave, onToast, isLandscape }) {
  const [activeSection, setActiveSection] = useState('observations');
  const [editingObs, setEditingObs] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [localVisit, setLocalVisit] = useState(visit);

  // ── Manager simplifié (imite l'interface de useCrrManager pour GpsTrackingSection) ──
  const manager = useMemo(() => ({
    updateMeetingField: (field, value) => {
      setLocalVisit(prev => {
        const updated = { ...prev, [field]: value };
        onSave(updated.id, updated);
        return updated;
      });
    },
  }), [onSave]);

  // ── Observations CRUD ──
  const addObservation = useCallback(() => {
    const newObs = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      text: '',
      images: [],
      date: new Date().toISOString().split('T')[0],
    };
    setLocalVisit(prev => {
      const updated = { ...prev, observations: [...(prev.observations || []), newObs] };
      onSave(updated.id, updated);
      return updated;
    });
    setEditingObs(newObs);
  }, [onSave]);

  const updateObservation = useCallback((obsId, patch) => {
    setLocalVisit(prev => {
      const updated = {
        ...prev,
        observations: (prev.observations || []).map(o => o.id === obsId ? { ...o, ...patch } : o),
      };
      onSave(updated.id, updated);
      return updated;
    });
  }, [onSave]);

  const deleteObservation = useCallback((obsId) => {
    setLocalVisit(prev => {
      const updated = {
        ...prev,
        observations: (prev.observations || []).filter(o => o.id !== obsId),
      };
      onSave(updated.id, updated);
      return updated;
    });
  }, [onSave]);

  const updateInfo = useCallback((patch) => {
    setLocalVisit(prev => {
      const updated = { ...prev, ...patch };
      onSave(updated.id, updated);
      return updated;
    });
  }, [onSave]);

  const observations = localVisit.observations || [];

  // ── Export PDF ──
  const handleExportPdf = useCallback(async () => {
    try {
      const { generateSiteVisitPdf } = await import('../../utils/pdfSiteVisitGenerator');
      await generateSiteVisitPdf(localVisit);
      onToast?.('PDF téléchargé');
    } catch (err) {
      console.error('Export PDF visite:', err);
      onToast?.('Erreur export PDF');
    }
  }, [localVisit, onToast]);

  // Fake meeting object pour GpsTrackingSection
  const fakeMeeting = useMemo(() => ({
    ...localVisit,
    gpsTracking: localVisit.gpsTracking || { coordinates: [], startTime: null, endTime: null, distance: 0 },
  }), [localVisit]);

  // ObsMarkers numérotés pour la carte
  const obsMarkersForMap = useMemo(() => {
    const coords = localVisit.gpsTracking?.coordinates || [];
    return observations.map((obs, idx) => {
      let lat = null, lng = null;
      for (const img of (obs.images || [])) {
        if (typeof img === 'object' && img.lat != null) { lat = img.lat; lng = img.lng; break; }
      }
      if (lat == null && coords.length > 0) {
        const pos = Math.min(Math.floor((idx / Math.max(observations.length, 1)) * coords.length), coords.length - 1);
        lat = coords[pos]?.lat; lng = coords[pos]?.lng;
      }
      if (lat == null) return null;
      return { lat, lng, number: idx + 1, text: stripHtml(obs.text || '').slice(0, 80) };
    }).filter(Boolean);
  }, [observations, localVisit.gpsTracking]);

  return (
    <div className="flex flex-col h-full">

      {/* ── Header info visite ── */}
      <div className={`mx-4 bg-white rounded-xl border border-gray-200 ${isLandscape ? 'mt-1 mb-1 p-2' : 'mt-2 mb-2 p-3'}`}>
        {editingInfo ? (
          <div className="space-y-2">
            <input value={localVisit.nom || ''} onChange={e => updateInfo({ nom: e.target.value })}
              placeholder="Nom du site" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input value={localVisit.lieu || ''} onChange={e => updateInfo({ lieu: e.target.value })}
              placeholder="Lieu / adresse" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input value={localVisit.client || ''} onChange={e => updateInfo({ client: e.target.value })}
              placeholder="Client / contact" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            <input type="date" value={localVisit.date || ''} onChange={e => updateInfo({ date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 focus:outline-none focus:border-blue-400" />
            <button onClick={() => setEditingInfo(false)} className="w-full py-2 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition">
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between" onClick={() => setEditingInfo(true)}>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-gray-900 truncate">{localVisit.nom || 'Visite sans nom'}</div>
              <div className="flex items-center gap-2 mt-0.5 text-[12px] text-gray-500">
                {localVisit.lieu && <span>{localVisit.lieu}</span>}
                {localVisit.client && (<><span className="text-gray-300">·</span><span>{localVisit.client}</span></>)}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-gray-400">{dateFr(localVisit.date)}</span>
              <button onClick={handleExportPdf} className="p-1.5 rounded-lg bg-red-50 active:bg-red-100 transition">
                <Icon name="download" size={14} color="#ef4444" />
              </button>
              <Icon name="edit" size={14} color="#9ca3af" />
            </div>
          </div>
        )}
      </div>

      {/* ── Section toggle ── */}
      <div className={`flex gap-1 mx-4 p-1 bg-gray-100 rounded-2xl ${isLandscape ? 'mb-1' : 'mb-2'}`}>
        <SectionTab label="Observations" active={activeSection === 'observations'} onClick={() => setActiveSection('observations')} />
        <SectionTab label="Terrain" active={activeSection === 'terrain'} onClick={() => setActiveSection('terrain')} />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* Éditeur plein zone si une obs est en édition */}
        {editingObs ? (
          <SiteVisitObsEditSheet
            obs={editingObs}
            onUpdate={updateObservation}
            onDelete={deleteObservation}
            onClose={() => setEditingObs(null)}
            onViewImage={setViewingImage}
            inline
          />
        ) : activeSection === 'observations' && (
          <div className="space-y-2">
            {observations.map((obs, idx) => (
              <ObsCard key={obs.id} obs={obs} number={idx + 1} onTap={setEditingObs} onDelete={deleteObservation} onViewImage={setViewingImage} />
            ))}

            <button onClick={addObservation}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.97] transition mt-2">
              <Icon name="plus" size={14} color="#fff" />
              Ajouter une observation
            </button>

            {observations.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[13px] text-gray-400">Aucune observation</p>
                <p className="text-[11px] text-gray-300 mt-1">Appuyez sur le bouton ci-dessus pour commencer</p>
              </div>
            )}
          </div>
        )}

        {/* Terrain toujours monté (GPS en arrière-plan), masqué si pas actif ou si éditeur ouvert */}
        <div style={{ display: activeSection === 'terrain' && !editingObs ? 'block' : 'none' }}>
          <GpsTrackingSection
            meeting={fakeMeeting}
            manager={manager}
            obsByCategory={{}}
            onToast={onToast}
            externalObsMarkers={obsMarkersForMap}
          />
        </div>
      </div>

      {/* ── Modals ── */}
      {viewingImage && <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />}

      {/* Éditeur maintenant inline dans le content ci-dessus */}
    </div>
  );
}
