// src/views/ged/GedVersionViewer.jsx
// Visualiseur LÉGER en lecture seule d'une version figée.
// Affiche le contenu du snapshot (chapitres → articles) sans aucune logique
// d'édition. Volontairement minimal et autonome (pas de dépendance à ProjectView).

import React, { useMemo, useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, FileText, Table2, Lock, ChevronDown } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';
import { toast } from '../../utils/globalUI';
import { computeQtyMaps } from '../../utils/projectCalculations';
import { getPhaseStyle, formatDateLong } from './gedConstants';
import { previewArchivePdf, exportArchive } from './gedExport';
import ExportModal from '../../components/modals/ExportModal';

// Aplatit l'arbre en liste d'articles (pour computeQtyMaps).
const flattenItems = (chapters) => {
  const items = [];
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'item') items.push(n);
      else if (n.children) walk(n.children);
    });
  };
  walk(chapters || []);
  return items;
};

const GedVersionViewer = ({ archive, onBack, branding = null }) => {
  const snapshot = archive?.projectSnapshot;
  const style = getPhaseStyle(archive?.phase);

  const tranches = useMemo(() => snapshot?.tranches || [], [snapshot]);
  const hasTranches = tranches.length > 0;

  // Tranche affichée dans le tableau ('global' = somme de toutes les tranches).
  const [selectedTranche, setSelectedTranche] = useState('global');

  // Quantités résolues par tranche (mêmes calculs que l'export — source de vérité).
  const qtyMaps = useMemo(() => {
    const items = flattenItems(snapshot?.chapters);
    const clientPercent = Number(snapshot?.clientPercent ?? 10);
    const { studyQtyMaps } = computeQtyMaps(items, hasTranches, tranches, clientPercent);
    return studyQtyMaps;
  }, [snapshot, hasTranches, tranches]);

  const activeQtyMap = qtyMaps[selectedTranche] || qtyMaps.global || {};
  const qtyOf = (item) => Number(activeQtyMap[item.id] || 0);

  // Total HT d'un chapitre selon la tranche sélectionnée (options exclues).
  const chapterTotal = (node) => {
    let total = 0;
    const walk = (nodes) => {
      (nodes || []).forEach((n) => {
        if (n.type === 'item' && !n.isOption) total += qtyOf(n) * (Number(n.price) || 0);
        if (n.children) walk(n.children);
      });
    };
    walk(node.children);
    return total;
  };

  // KPIs globaux selon la tranche sélectionnée.
  const kpis = useMemo(() => {
    const items = flattenItems(snapshot?.chapters);
    let totalHT = 0;
    items.forEach((it) => { if (!it.isOption) totalHT += qtyOf(it) * (Number(it.price) || 0); });
    return { totalHT, itemCount: items.filter((i) => !i.isOption).length };
  }, [snapshot, activeQtyMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportModal, setExportModal] = useState({ show: false, format: 'pdf', type: 'ESTIMATION' });
  const menuRef = useRef(null);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const openExport = (format, type) => {
    setMenuOpen(false);
    setExportModal({ show: true, format, type });
  };

  const handlePreviewPdf = async (opts) => {
    try {
      return await previewArchivePdf(snapshot, { ...opts, type: exportModal.type }, branding);
    } catch (e) {
      toast.error('Erreur aperçu PDF : ' + e.message);
      return null;
    }
  };

  const handleConfirmExport = async (opts) => {
    setExportModal((prev) => ({ ...prev, show: false }));
    try {
      await exportArchive(snapshot, exportModal.format, { ...opts, type: exportModal.type }, branding);
      toast.success('Export généré');
    } catch (e) {
      toast.error('Erreur export : ' + e.message);
    }
  };

  const EXPORT_ACTIONS = [
    { format: 'pdf', type: 'DQE', label: 'PDF — DQE', icon: FileText, color: 'text-red-500' },
    { format: 'pdf', type: 'ESTIMATION', label: 'PDF — Estimation', icon: FileText, color: 'text-red-500' },
    { format: 'excel', type: 'DQE', label: 'Excel — DQE', icon: Table2, color: 'text-emerald-600' },
    { format: 'excel', type: 'ESTIMATION', label: 'Excel — Estimation', icon: Table2, color: 'text-emerald-600' },
  ];

  // Grille de colonnes commune en-tête / lignes : N° · Désignation · Unité · Qté · PU · Total
  const GRID = 'grid grid-cols-[70px_1fr_60px_80px_90px_110px] gap-3';

  // Rendu récursif d'un nœud (chapitre ou article).
  const renderNode = (node, depth = 0) => {
    if (node.type === 'item') {
      const qty = qtyOf(node);
      const amount = qty * (Number(node.price) || 0);
      return (
        <div
          key={node.id}
          className={`${GRID} px-3 py-1.5 text-[11px] border-b border-slate-50 hover:bg-slate-50/60 ${node.isOption ? 'opacity-60 italic' : ''}`}
        >
          <span className="font-mono text-slate-400 truncate">{node.bpuNum || '—'}</span>
          <span className="text-slate-700 truncate" style={{ paddingLeft: `${depth * 14}px` }} title={node.designation}>
            {node.designation || '—'}
          </span>
          <span className="text-center text-slate-500">{node.unit || '—'}</span>
          <span className="text-right font-mono text-slate-600">{qty}</span>
          <span className="text-right font-mono text-slate-500">{formatPrice(node.price)}</span>
          <span className="text-right font-mono font-semibold text-slate-700">{formatPrice(amount)}</span>
        </div>
      );
    }
    // Chapitre / sous-chapitre
    const total = chapterTotal(node);
    return (
      <div key={node.id} className="mb-1.5">
        <div
          className={`${GRID} items-center px-3 py-2 bg-slate-100 rounded-lg`}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <span className="col-span-5 text-[11px] font-bold uppercase tracking-wide text-slate-700 truncate">
            {node.title || 'Sans titre'}
            {node.isOption && <span className="ml-2 text-[9px] font-normal text-amber-600">(option)</span>}
          </span>
          <span className="text-right text-[11px] font-mono font-bold text-slate-600">{formatPrice(total)}</span>
        </div>
        <div className="mt-1">
          {(node.children || []).map((child) => renderNode(child, depth + 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f7]">
      {/* En-tête */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors text-xs font-medium"
          >
            <ArrowLeft size={15} /> Retour
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <span className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border ${style.light} ${style.text} ${style.border}`}>
            {archive?.label}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
            <Lock size={12} /> Version figée — lecture seule
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-gray-400">{formatDateLong(archive?.createdAt)}</span>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded-xl hover:bg-gray-700 transition-colors active:scale-95"
              >
                Exporter <ChevronDown size={13} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50">
                  {EXPORT_ACTIONS.map((a) => (
                    <button
                      key={`${a.format}-${a.type}`}
                      onClick={() => openExport(a.format, a.type)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <a.icon size={14} className={a.color} />
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Métadonnées d'émission */}
        {(archive?.subject || archive?.recipient || archive?.note) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 pl-[88px] text-[11px] text-gray-500">
            {archive.subject && <span><span className="text-gray-400">Objet :</span> <span className="font-medium text-gray-700">{archive.subject}</span></span>}
            {archive.recipient && <span><span className="text-gray-400">Destinataire :</span> <span className="font-medium text-gray-700">{archive.recipient}</span></span>}
            {archive.note && <span className="italic text-gray-400">« {archive.note} »</span>}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-3 gap-4 max-w-3xl">
        <Kpi label={`Total HT${selectedTranche !== 'global' ? ' (tranche)' : ''}`} value={formatPrice(kpis.totalHT)} mono />
        <Kpi label="Articles" value={kpis.itemCount} mono />
        <Kpi label="Chapitres" value={(snapshot?.chapters || []).length} mono />
      </div>

      {/* Sélecteur de tranche */}
      {hasTranches && (
        <div className="shrink-0 px-6 pb-3 flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1">Tranche</span>
          <div className="flex flex-wrap gap-1 bg-gray-100 p-0.5 rounded-xl">
            <TrancheTab label="Global" active={selectedTranche === 'global'} onClick={() => setSelectedTranche('global')} />
            {tranches.map((t) => (
              <TrancheTab key={t.id} label={t.name || t.id} active={selectedTranche === t.id} onClick={() => setSelectedTranche(t.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          {/* En-tête colonnes */}
          <div className={`${GRID} px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 mb-2`}>
            <span>N°</span>
            <span>Désignation</span>
            <span className="text-center">Unité</span>
            <span className="text-right">Qté</span>
            <span className="text-right">PU HT</span>
            <span className="text-right">Total HT</span>
          </div>
          {(snapshot?.chapters || []).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-[12px]">Aucun contenu dans cette version</div>
          ) : (
            (snapshot.chapters).map((chap) => renderNode(chap, 0))
          )}
        </div>
      </div>

      {/* Modal d'export (réutilise l'UX de l'export projet) */}
      <ExportModal
        isOpen={exportModal.show}
        onClose={() => setExportModal((prev) => ({ ...prev, show: false }))}
        onConfirm={handleConfirmExport}
        onPreviewPdf={handlePreviewPdf}
        format={exportModal.format}
        type={exportModal.type}
        hasTranches={hasTranches}
        tranches={tranches}
        activeTrancheId={tranches[0]?.id || 'global'}
      />
    </div>
  );
};

const Kpi = ({ label, value, mono }) => (
  <div className="bg-white rounded-2xl p-4 border border-gray-200/60">
    <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-[18px] font-bold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

Kpi.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), mono: PropTypes.bool };

const TrancheTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
  >
    {label}
  </button>
);

TrancheTab.propTypes = { label: PropTypes.string, active: PropTypes.bool, onClick: PropTypes.func };

GedVersionViewer.propTypes = {
  archive: PropTypes.object,
  onBack: PropTypes.func.isRequired,
  branding: PropTypes.object,
};

export default GedVersionViewer;
