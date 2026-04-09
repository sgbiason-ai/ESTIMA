// src/views/SiteVisitsView.jsx
// Vue desktop des visites de site — lecture seule avec carte terrain.

import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { MapPin, RefreshCw, Camera, MessageSquare, Navigation, Clock, Ruler, ChevronRight } from 'lucide-react';
import { stripHtml } from '../utils/formatObsText';

const GpsMapView = lazy(() => import('../components/mobile/GpsMapView'));

export default function SiteVisitsView({ companyId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [fullVisit, setFullVisit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

  return (
    <div className="flex h-full bg-[#f5f5f7]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      {/* Sidebar — liste des visites */}
      <div className="w-72 shrink-0 border-r border-gray-200/60 bg-white/80 backdrop-blur-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visites de site</span>
          <button onClick={fetchVisits} className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading && <div className="text-center py-8 text-gray-400 text-xs">Chargement…</div>}
          {visits.map(v => (
            <button key={v.id} onClick={() => loadDetail(v.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all ${
                selectedId === v.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <div className="text-xs font-semibold truncate">{v.nom}</div>
              {v.lieu && <div className="text-[10px] text-gray-400 truncate mt-0.5">{v.lieu}</div>}
              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                <span>{v.obsCount} obs.</span>
                {v.date && <span>{fmtDate(v.date)}</span>}
              </div>
            </button>
          ))}
          {!loading && visits.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs">Aucune visite. Créez-en une depuis le mobile.</div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-6">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{fullVisit.nom || 'Visite sans nom'}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                {fullVisit.lieu && <span>📍 {fullVisit.lieu}</span>}
                {fullVisit.client && <span>👤 {fullVisit.client}</span>}
                {fullVisit.date && <span>📅 {fmtDate(fullVisit.date)}</span>}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3 mb-6">
              {coordinates.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
                  <Navigation size={14} className="text-blue-500" />
                  <span className="text-xs font-bold text-gray-900">{coordinates.length} pts</span>
                </div>
              )}
              {tracking.distance > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
                  <Ruler size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-900">{fmtDist(tracking.distance)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
                <Camera size={14} className="text-blue-500" />
                <span className="text-xs font-bold text-gray-900">{photoMarkers.length} photo{photoMarkers.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200/60">
                <MessageSquare size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-gray-900">{observations.length} obs.</span>
              </div>
            </div>

            {/* Carte */}
            {(coordinates.length > 0 || photoMarkers.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden mb-6" style={{ height: '400px' }}>
                <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Chargement carte…</div>}>
                  <GpsMapView coordinates={coordinates} photoMarkers={photoMarkers} obsMarkers={[]} height="100%" />
                </Suspense>
              </div>
            )}

            {/* Observations */}
            <h3 className="text-sm font-bold text-gray-900 mb-3">Observations ({observations.length})</h3>
            <div className="space-y-3">
              {observations.map(obs => {
                const images = obs.images || [];
                return (
                  <div key={obs.id} className="bg-white rounded-xl border border-gray-200/60 p-4">
                    {obs.text && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{stripHtml(obs.text)}</p>}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {images.map((img, idx) => {
                          const imgSrc = typeof img === 'string' ? img : img.src;
                          const hasGps = typeof img === 'object' && img.lat != null;
                          return (
                            <div key={idx} className="flex flex-col items-center">
                              <img src={imgSrc} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200" loading="lazy" />
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
                );
              })}
              {observations.length === 0 && <p className="text-sm text-gray-400">Aucune observation</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
