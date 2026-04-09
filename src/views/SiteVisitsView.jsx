// src/views/SiteVisitsView.jsx
// Vue desktop — sidebar liste | observations gauche | carte droite + plein écran + export + suppression.

import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { collection, getDocs, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MapPin, RefreshCw, Camera, MessageSquare, Navigation, Ruler, Trash2, FileDown, Maximize2, X } from 'lucide-react';
import { stripHtml } from '../utils/formatObsText';
import { confirm } from '../utils/globalUI';

const GpsMapView = lazy(() => import('../components/mobile/GpsMapView'));

export default function SiteVisitsView({ companyId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [fullVisit, setFullVisit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [highlightedObs, setHighlightedObs] = useState(null);
  const [splitPct, setSplitPct] = useState(50); // % du panneau gauche
  const [draggingSplit, setDraggingSplit] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'companies', companyId, 'site_visits'));
      const list = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, nom: data.nom || '(Sans nom)', lieu: data.lieu || '', date: data.date || '', client: data.client || '', obsCount: (data.observations || []).length, lastSaved: data.lastSaved || '' };
      }).sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));
      setVisits(list);
      if (list.length > 0 && !selectedId) loadDetail(list[0].id);
    } catch (e) { console.error('Erreur chargement visites:', e); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const loadDetail = useCallback(async (visitId) => {
    setSelectedId(visitId);
    setDetailLoading(true);
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
      setFullVisit(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    } catch { setFullVisit(null); }
    finally { setDetailLoading(false); }
  }, [companyId]);

  const handleDelete = useCallback(async (visitId, visitNom) => {
    const ok = await confirm(`Supprimer la visite "${visitNom}" et toutes ses données ?`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'site_visits', visitId));
      setVisits(prev => prev.filter(v => v.id !== visitId));
      if (selectedId === visitId) { setSelectedId(null); setFullVisit(null); }
    } catch (e) { console.error('Erreur suppression:', e); }
  }, [companyId, selectedId]);

  const handleExportPdf = useCallback(async () => {
    if (!fullVisit) return;
    try {
      const { generateSiteVisitPdf } = await import('../utils/pdfSiteVisitGenerator');
      await generateSiteVisitPdf(fullVisit);
    } catch (e) { console.error('Erreur export PDF:', e); }
  }, [fullVisit]);

  const tracking = fullVisit?.gpsTracking || {};
  const coordinates = tracking.coordinates || [];
  const observations = fullVisit?.observations || [];

  const photoMarkers = useMemo(() => {
    const markers = [];
    observations.forEach(obs => {
      (obs.images || []).forEach(img => {
        if (typeof img === 'object' && img.lat != null && img.lng != null) markers.push({ lat: img.lat, lng: img.lng, src: img.src });
      });
    });
    return markers;
  }, [observations]);

  // Marqueurs observations numérotés (position = première photo géolocalisée)
  const obsMarkers = useMemo(() => {
    return observations.map((obs, idx) => {
      let lat = null, lng = null;
      for (const img of (obs.images || [])) {
        if (typeof img === 'object' && img.lat != null) { lat = img.lat; lng = img.lng; break; }
      }
      // Fallback : position dans le tracé GPS proportionnelle à l'index
      if (lat == null && coordinates.length > 0) {
        const pos = Math.min(Math.floor((idx / Math.max(observations.length, 1)) * coordinates.length), coordinates.length - 1);
        lat = coordinates[pos].lat;
        lng = coordinates[pos].lng;
      }
      if (lat == null) return null;
      return { lat, lng, number: idx + 1, text: stripHtml(obs.text || '').slice(0, 100) };
    }).filter(Boolean);
  }, [observations, coordinates]);

  const hasMap = coordinates.length > 0 || photoMarkers.length > 0 || obsMarkers.length > 0;

  // Scroll vers l'observation quand on clique sur une pastille carte
  useEffect(() => {
    if (highlightedObs) {
      const el = document.getElementById(`obs-${highlightedObs}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedObs]);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

  return (
    <div className="flex h-full bg-[#f5f5f7]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      {/* ── Sidebar liste ── */}
      <div className="w-64 shrink-0 border-r border-gray-200/60 bg-white/80 backdrop-blur-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visites</span>
          <button onClick={fetchVisits} className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading && <div className="text-center py-8 text-gray-400 text-xs">Chargement…</div>}
          {visits.map(v => (
            <div key={v.id} className={`group flex items-center rounded-xl mb-1 transition-all ${selectedId === v.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <button onClick={() => loadDetail(v.id)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                <div className={`text-xs font-semibold truncate ${selectedId === v.id ? 'text-blue-700' : 'text-gray-600'}`}>{v.nom}</div>
                {v.lieu && <div className="text-[10px] text-gray-400 truncate mt-0.5">{v.lieu}</div>}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                  <span>{v.obsCount} obs.</span>
                  {v.date && <span>{fmtDate(v.date)}</span>}
                </div>
              </button>
              <button onClick={() => handleDelete(v.id, v.nom)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all mr-1 shrink-0"
                title="Supprimer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!loading && visits.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs">Aucune visite.<br />Créez-en depuis le mobile.</div>
          )}
        </div>
      </div>

      {/* ── Contenu principal : split vertical ── */}
      {detailLoading && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Chargement…
        </div>
      )}

      {!detailLoading && !fullVisit && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <MapPin size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Sélectionnez une visite</p>
        </div>
      )}

      {!detailLoading && fullVisit && (
        <div className="flex-1 flex min-h-0 relative"
          onMouseMove={draggingSplit ? (e) => {
            const container = e.currentTarget;
            const rect = container.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitPct(Math.max(25, Math.min(75, pct)));
          } : undefined}
          onMouseUp={() => setDraggingSplit(false)}
          onMouseLeave={() => setDraggingSplit(false)}
        >

          {/* ── Gauche : infos + observations ── */}
          <div className="flex flex-col border-r border-gray-200/60 overflow-hidden" style={{ width: `${splitPct}%` }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200/60 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{fullVisit.nom || 'Visite sans nom'}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {fullVisit.lieu && <span>📍 {fullVisit.lieu}</span>}
                    {fullVisit.client && <span>👤 {fullVisit.client}</span>}
                    {fullVisit.date && <span>📅 {fmtDate(fullVisit.date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-800 transition active:scale-[0.97]">
                    <FileDown size={13} /> PDF
                  </button>
                  <button onClick={() => handleDelete(fullVisit.id, fullVisit.nom)}
                    className="p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-2 mt-3">
                {coordinates.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                    <Navigation size={10} className="text-blue-500" /> {coordinates.length} pts
                  </div>
                )}
                {tracking.distance > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                    <Ruler size={10} className="text-emerald-500" /> {fmtDist(tracking.distance)}
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                  <Camera size={10} className="text-blue-500" /> {photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700">
                  <MessageSquare size={10} className="text-amber-500" /> {observations.length} obs.
                </div>
              </div>
            </div>

            {/* Observations scrollables */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {observations.map((obs, idx) => {
                const images = obs.images || [];
                const obsNum = idx + 1;
                const isHighlighted = highlightedObs === obsNum;
                return (
                  <div key={obs.id} id={`obs-${obsNum}`}
                    className={`rounded-xl border p-4 transition-all duration-200 ${isHighlighted ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-200' : 'bg-white border-gray-200/60'}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => setHighlightedObs(isHighlighted ? null : obsNum)}
                        className={`shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${isHighlighted ? 'bg-orange-500' : 'bg-blue-600'}`}>
                        {obsNum}
                      </button>
                      <div className="flex-1 min-w-0">
                    {obs.text && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{stripHtml(obs.text)}</p>}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {images.map((img, idx) => {
                          const imgSrc = typeof img === 'string' ? img : img.src;
                          const hasGps = typeof img === 'object' && img.lat != null;
                          return (
                            <div key={idx} className="flex flex-col items-center">
                              <img src={imgSrc} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" loading="lazy" />
                              {hasGps && (
                                <a href={`https://www.google.com/maps?q=${img.lat},${img.lng}`} target="_blank" rel="noreferrer"
                                  className="text-[9px] italic text-blue-500 hover:underline mt-0.5">Localisation</a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {obs.date && <div className="text-[10px] text-gray-400 mt-2">{fmtDate(obs.date)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {observations.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Aucune observation</p>}
            </div>
          </div>

          {/* ── Divider draggable ── */}
          <div
            className={`w-1.5 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-blue-100 transition-colors ${draggingSplit ? 'bg-blue-200' : 'bg-gray-100'}`}
            onMouseDown={() => setDraggingSplit(true)}
          >
            <div className={`w-0.5 h-8 rounded-full transition-colors ${draggingSplit ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-400'}`} />
          </div>

          {/* ── Droite : carte satellite ── */}
          <div className="flex flex-col min-h-0" style={{ width: `${100 - splitPct}%` }}>
            {hasMap && !fullscreenMap ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                  <span className="text-xs font-bold text-gray-900">Carte terrain</span>
                  <button onClick={() => setFullscreenMap(true)}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition active:scale-[0.95]" title="Plein écran">
                    <Maximize2 size={14} className="text-gray-600" />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Chargement carte…</div>}>
                    <GpsMapView coordinates={coordinates} photoMarkers={photoMarkers} obsMarkers={obsMarkers} height="100%" highlightedObs={highlightedObs} onSelectObs={setHighlightedObs} />
                  </Suspense>
                </div>
              </>
            ) : !hasMap ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MapPin size={40} className="mb-3 opacity-30" />
                <p className="text-xs">Aucune donnée terrain</p>
                <p className="text-[10px] text-gray-300 mt-1">Utilisez le mobile pour enregistrer un tracé GPS</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                <Maximize2 size={32} className="mb-2 opacity-30" />
                <p className="text-xs">Carte en plein écran</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Carte plein écran ── */}
      {fullscreenMap && hasMap && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
            <span className="text-sm font-bold text-gray-900">{fullVisit?.nom || 'Carte terrain'}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{coordinates.length} pts · {photoMarkers.length} photos</span>
              <button onClick={() => setFullscreenMap(false)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition active:scale-[0.95]">
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Chargement…</div>}>
              <GpsMapView coordinates={coordinates} photoMarkers={photoMarkers} obsMarkers={obsMarkers} height="100%" highlightedObs={highlightedObs} onSelectObs={setHighlightedObs} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
