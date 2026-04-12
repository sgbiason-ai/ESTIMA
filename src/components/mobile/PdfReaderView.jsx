// src/components/mobile/PdfReaderView.jsx
// Lecteur PDF mobile — URL ou fichier local, affichage iframe

import React, { useState, useRef, useCallback } from 'react';
import Icon from './Icon';

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

export default function PdfReaderView({ onToast }) {
  const [pdfSrc, setPdfSrc] = useState(null);
  const [recentUrls, setRecentUrls] = useState(getRecentUrls);
  const fileRef = useRef(null);
  const blobRef = useRef(null);

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
          <button onClick={() => window.open(pdfSrc, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-[12px] font-bold text-gray-700 active:bg-gray-200">
            <Icon name="share" size={14} color="#374151" />
            Ouvrir externe
          </button>
        </div>
        {/* iframe PDF */}
        <iframe
          src={pdfSrc}
          className="flex-1 w-full border-none"
          title="Lecteur PDF"
        />
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

      {/* Récents */}
      {recentUrls.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Récents</span>
            <button onClick={clearRecent} className="text-[11px] text-red-500 font-medium active:opacity-60">
              Effacer
            </button>
          </div>
          {recentUrls.map((item, i) => (
            <button
              key={i}
              onClick={() => openUrl(item.url)}
              className="flex items-center gap-3 w-full py-3 border-b border-gray-100 last:border-0 text-left active:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Icon name="file" size={16} color="#dc2626" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900 truncate">{item.name}</div>
                <div className="text-[11px] text-gray-600 truncate">{item.url}</div>
              </div>
              <Icon name="chevron" size={14} color="#9ca3af" />
            </button>
          ))}
        </div>
      )}

      {/* Empty hint */}
      {recentUrls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <Icon name="file" size={24} color="#9ca3af" />
          </div>
          <p className="text-sm text-gray-600 max-w-[240px] leading-relaxed">
            Ouvrez SharePoint ou sélectionnez un fichier PDF local.
          </p>
        </div>
      )}
    </div>
  );
}
