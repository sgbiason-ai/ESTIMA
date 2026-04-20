// src/components/mobile/PdfReaderView.jsx
// Lecteur PDF mobile — URL ou fichier local, affichage iframe

import React, { useState, useRef, useCallback } from 'react';
import Icon from './Icon';
import { usePdfFavorites } from '../../hooks/usePdfFavorites';
import PdfFavoriteEditModal from './PdfFavoriteEditModal';

const RECENT_KEY = 'estima_pdf_recent';
const MAX_RECENT = 5;
const DEFAULT_SHAREPOINT_URL = 'https://papyrusbe.sharepoint.com/:f:/s/Papyrus1/IgCJGPDa78XofbqubIcIBY2TAXZ0Ph8WNW8G5H2-Mj0SVWs?e=9CDM3b';

function getRecentUrls() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function addRecentUrl(url, name) {
  const recent = getRecentUrls().filter(r => r.url !== url);
  recent.unshift({ url, name: name || url.split('/').pop() || 'PDF', date: new Date().toISOString() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function PdfReaderView({ onToast, userId }) {
  const [pdfSrc, setPdfSrc] = useState(null);
  const [recentUrls, setRecentUrls] = useState(getRecentUrls);
  const [favModal, setFavModal] = useState(null); // null | { mode, initial }
  const fileRef = useRef(null);
  const blobRef = useRef(null);

  const { favorites, addFavorite, updateFavorite, removeFavorite, moveFavorite, isFavorite, toggleFavorite } = usePdfFavorites(userId);

  const openUrl = useCallback((url) => {
    if (!url.trim()) return;
    // Nettoyage ancien blob
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
    setPdfSrc(url.trim());
    addRecentUrl(url.trim());
    setRecentUrls(getRecentUrls());
  }, []);

  const openFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobRef.current = blobUrl;
    setPdfSrc(blobUrl);
    onToast?.(file.name);
  }, [onToast]);

  const handleClose = () => {
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
    setPdfSrc(null);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentUrls([]);
  };

  // ── Mode viewer (plein écran) ──
  if (pdfSrc) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shrink-0">
          <button onClick={handleClose}
            className="flex items-center gap-1.5 text-[13px] font-medium text-blue-600 active:opacity-60">
            <Icon name="back" size={16} color="#2563eb" />
            Retour
          </button>
          <div className="flex items-center gap-2">
            {userId && pdfSrc && !pdfSrc.startsWith('blob:') && (
              <button
                onClick={() => {
                  if (isFavorite(pdfSrc)) {
                    const fav = favorites.find(f => f.url === pdfSrc);
                    if (fav) removeFavorite(fav.id);
                    onToast?.('Retiré des favoris');
                  } else {
                    setFavModal({ mode: 'add', initial: { url: pdfSrc, name: '' } });
                  }
                }}
                className="p-1.5 rounded-xl active:bg-amber-50"
                aria-label={isFavorite(pdfSrc) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Icon name={isFavorite(pdfSrc) ? 'starFilled' : 'star'} size={18} color={isFavorite(pdfSrc) ? '#f59e0b' : '#6b7280'} />
              </button>
            )}
            <button onClick={() => window.open(pdfSrc, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-[12px] font-bold text-gray-700 active:bg-gray-200">
              <Icon name="share" size={14} color="#374151" />
              Ouvrir externe
            </button>
          </div>
        </div>
        {/* iframe PDF */}
        <iframe
          src={pdfSrc}
          className="flex-1 w-full border-none"
          title="Lecteur PDF"
        />

        {/* Modale ajout favori (depuis toolbar iframe) */}
        {favModal && (
          <PdfFavoriteEditModal
            initial={favModal.mode === 'edit' ? favModal.initial : favModal.initial}
            onSave={(payload) => {
              if (favModal.mode === 'edit') {
                updateFavorite(favModal.initial.id, payload);
              } else {
                addFavorite(payload.name, payload.url || favModal.initial?.url);
              }
            }}
            onClose={() => setFavModal(null)}
          />
        )}
      </div>
    );
  }

  // ── Mode sélection ──
  return (
    <div className="px-4 py-3 bg-[#f5f5f7] min-h-full">
      <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={openFile} />

      {/* SharePoint — lien par défaut */}
      <button
        onClick={() => window.open(DEFAULT_SHAREPOINT_URL, '_blank')}
        className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 mb-3 active:bg-gray-50 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Icon name="folder" size={20} color="#2563eb" />
        </div>
        <div className="text-left flex-1">
          <div className="text-[15px] font-bold text-gray-900">SharePoint PROD</div>
          <div className="text-xs text-gray-700 mt-0.5">Accéder aux plans et documents partagés</div>
        </div>
        <Icon name="chevron" size={16} color="#9ca3af" />
      </button>

      {/* Fichier local */}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 mb-3 active:bg-gray-50 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Icon name="file" size={20} color="#d97706" />
        </div>
        <div className="text-left flex-1">
          <div className="text-[15px] font-bold text-gray-900">Fichier local</div>
          <div className="text-xs text-gray-700 mt-0.5">Sélectionner un PDF depuis votre appareil</div>
        </div>
        <Icon name="chevron" size={16} color="#9ca3af" />
      </button>

      {/* Favoris */}
      {userId && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Favoris</span>
            <button
              onClick={() => setFavModal({ mode: 'add', initial: null })}
              className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold active:opacity-60"
            >
              <Icon name="plus" size={12} color="#2563eb" />
              Ajouter
            </button>
          </div>
          {favorites.length === 0 ? (
            <p className="text-[12px] text-gray-500 py-2">
              Aucun favori. Étoilez une URL récente ou ajoutez-en une manuellement.
            </p>
          ) : (
            favorites.map((fav, idx) => (
              <div
                key={fav.id}
                className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0"
              >
                <button
                  onClick={() => openUrl(fav.url)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Icon name="starFilled" size={16} color="#f59e0b" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-gray-900 truncate">{fav.name}</div>
                    <div className="text-[11px] text-gray-600 truncate">{fav.url}</div>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => moveFavorite(fav.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg active:bg-gray-100 disabled:opacity-30"
                    aria-label="Monter"
                  >
                    <Icon name="arrowUp" size={14} color="#6b7280" />
                  </button>
                  <button
                    onClick={() => moveFavorite(fav.id, 'down')}
                    disabled={idx === favorites.length - 1}
                    className="p-1.5 rounded-lg active:bg-gray-100 disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    <Icon name="arrowDown" size={14} color="#6b7280" />
                  </button>
                  <button
                    onClick={() => setFavModal({ mode: 'edit', initial: fav })}
                    className="p-1.5 rounded-lg active:bg-gray-100"
                    aria-label="Renommer"
                  >
                    <Icon name="edit" size={14} color="#2563eb" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer le favori « ${fav.name} » ?`)) removeFavorite(fav.id);
                    }}
                    className="p-1.5 rounded-lg active:bg-red-50"
                    aria-label="Supprimer"
                  >
                    <Icon name="trash" size={14} color="#ef4444" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Récents */}
      {recentUrls.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Récents</span>
            <button onClick={clearRecent} className="text-[11px] text-red-500 font-medium active:opacity-60">
              Effacer
            </button>
          </div>
          {recentUrls.map((item, i) => {
            const fav = isFavorite(item.url);
            return (
              <div
                key={i}
                className="flex items-center gap-2 py-3 border-b border-gray-100 last:border-0"
              >
                <button
                  onClick={() => openUrl(item.url)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Icon name="file" size={16} color="#dc2626" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-gray-900 truncate">{item.name}</div>
                    <div className="text-[11px] text-gray-600 truncate">{item.url}</div>
                  </div>
                </button>
                {userId && (
                  <button
                    onClick={() => toggleFavorite(item.url, item.name)}
                    className="p-1.5 rounded-lg active:bg-amber-50 shrink-0"
                    aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Icon name={fav ? 'starFilled' : 'star'} size={18} color={fav ? '#f59e0b' : '#9ca3af'} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty hint */}
      {recentUrls.length === 0 && favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <Icon name="file" size={24} color="#9ca3af" />
          </div>
          <p className="text-sm text-gray-600 max-w-[240px] leading-relaxed">
            Ouvrez SharePoint ou sélectionnez un fichier PDF local.
          </p>
        </div>
      )}

      {/* Modale ajout / renommage favori */}
      {favModal && (
        <PdfFavoriteEditModal
          initial={favModal.mode === 'edit' ? favModal.initial : null}
          onSave={(payload) => {
            if (favModal.mode === 'edit') {
              updateFavorite(favModal.initial.id, payload);
            } else {
              addFavorite(payload.name, payload.url);
            }
          }}
          onClose={() => setFavModal(null)}
        />
      )}
    </div>
  );
}
