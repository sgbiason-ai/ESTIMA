import React, { useState, useEffect } from 'react';
import { FileText, FileSpreadsheet, X, Check, Eye, Download, ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { toast } from '../../utils/globalUI';

// Étape 1 : Options d'export
const OptionsStep = ({ isPdf, hasTranches, tranches, includeCover, setIncludeCover, includeSummary, setIncludeSummary, includePM, setIncludePM, selectedExports, handleToggleExport, onClose, onGenerate, isGenerating }) => {
  const allOptions = [{ id: 'global', name: 'Global' }, ...(tranches || [])];
  const canGenerate = !hasTranches || selectedExports.length > 0;

  return (
    <>
      {/* Body */}
      <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>

        {/* Page de garde */}
        {isPdf && (
          <OptionRow
            checked={includeCover}
            onChange={setIncludeCover}
            color="emerald"
            label="Page de garde"
            desc="Inclure la page de couverture"
          />
        )}

        {/* Sélection des tranches */}
        {hasTranches && (
          <div className="rounded-lg border border-white/8 overflow-hidden">
            <div className="px-3 py-2 bg-white/3 border-b border-white/8 text-[9px] font-bold text-white/40 uppercase tracking-widest">
              Données à exporter
            </div>
            <div className="p-2 space-y-1 max-h-36 overflow-y-auto">
              {allOptions.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => handleToggleExport(opt.id)}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/4 cursor-pointer transition-colors"
                >
                  <Checkbox checked={selectedExports.includes(opt.id)} color="sky" />
                  <span className={`text-sm font-medium ${selectedExports.includes(opt.id) ? 'text-white/90' : 'text-white/40'}`}>
                    {opt.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Récapitulatif financier */}
        {selectedExports.length > 0 && (
          <OptionRow
            checked={includeSummary}
            onChange={setIncludeSummary}
            color="indigo"
            label="Récapitulatif financier"
            desc="Tableau de synthèse par chapitre"
          />
        )}

        {/* Prix pour mémoire */}
        <OptionRow
          checked={includePM}
          onChange={setIncludePM}
          color="amber"
          label="Afficher les prix pour mémoire"
          desc="Lignes avec quantité à 0 (PM)"
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all"
        >
          Annuler
        </button>

        {isPdf ? (
          <button
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-white rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 16px rgba(239,68,68,0.25)' }}
          >
            {isGenerating
              ? <><Loader2 size={13} className="animate-spin" /> Génération...</>
              : <><Eye size={13} /> Prévisualiser</>
            }
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-white rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 16px rgba(16,185,129,0.25)' }}
          >
            {isGenerating
              ? <><Loader2 size={13} className="animate-spin" /> Génération...</>
              : <><FileSpreadsheet size={13} /> Générer le document</>
            }
          </button>
        )}
      </div>
    </>
  );
};

// Étape 2 : Prévisualisation PDF
const PreviewStep = ({ blobUrl, suggestedName, onBack, onSave }) => {
  const [zoom, setZoom] = useState(100);

  return (
    <>
      {/* Toolbar preview */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={13} /> Retour
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[10px] font-bold text-white/40 w-12 text-center tabular-nums">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all ml-1"
            title="Réinitialiser le zoom"
          >
            <RotateCw size={11} />
          </button>
        </div>

        <span className="text-[10px] text-white/30 font-medium truncate max-w-[160px]">{suggestedName}</span>
      </div>

      {/* Iframe PDF */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: '#0d1117', minHeight: 0 }}
      >
        <div
          className="mx-auto transition-all duration-200 origin-top"
          style={{
            width: `${zoom}%`,
            minWidth: '300px',
          }}
        >
          <iframe
            src={blobUrl}
            className="w-full"
            style={{ height: 'calc(100vh - 110px)', border: 'none', display: 'block' }}
            title="Prévisualisation PDF"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all"
        >
          Modifier les options
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-widest text-white rounded-lg transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 16px rgba(239,68,68,0.25)' }}
        >
          <Download size={13} /> Sauvegarder
        </button>
      </div>
    </>
  );
};

// ── Sous-composants ─────────────────────────────────────────────────────────

const Checkbox = ({ checked, color }) => {
  const colors = {
    emerald: 'bg-emerald-500 border-emerald-500',
    indigo:  'bg-indigo-500  border-indigo-500',
    amber:   'bg-amber-500   border-amber-500',
    sky:     'bg-sky-500     border-sky-500',
  };
  return (
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${checked ? colors[color] : 'bg-white/5 border-white/15'}`}>
      {checked && <Check size={9} className="text-white" strokeWidth={3} />}
    </div>
  );
};

const OptionRow = ({ checked, onChange, color, label, desc }) => {
  const borders = {
    emerald: 'border-emerald-500/40 bg-emerald-500/8',
    indigo:  'border-indigo-500/40  bg-indigo-500/8',
    amber:   'border-amber-500/40   bg-amber-500/8',
  };
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        checked ? borders[color] : 'border-white/8 hover:border-white/15 hover:bg-white/3'
      }`}
    >
      <Checkbox checked={checked} color={color} />
      <div>
        <div className={`text-sm font-bold ${checked ? 'text-white/90' : 'text-white/50'}`}>{label}</div>
        {desc && <div className={`text-[10px] mt-0.5 ${checked ? 'text-white/40' : 'text-white/25'}`}>{desc}</div>}
      </div>
    </div>
  );
};

// ── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

const ExportModal = ({
  isOpen, onClose, onConfirm,
  type, format, hasTranches, tranches, activeTrancheId,
  onPreviewPdf,  // (options) => Promise<{ blobUrl, suggestedName, blob }>
}) => {
  const [includeCover, setIncludeCover]   = useState(true);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includePM, setIncludePM]         = useState(true);
  const [selectedExports, setSelectedExports] = useState([]);

  const [step, setStep]             = useState('options'); // 'options' | 'preview'
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData]   = useState(null);  // { blobUrl, suggestedName, blob }

  const isPdf = format === 'pdf';

  useEffect(() => {
    if (isOpen) {
      setSelectedExports([activeTrancheId || 'global']);
      setIncludeSummary(false);
      setIncludeCover(true);
      setIncludePM(true);
      setStep('options');
      setPreviewData(null);
    }
  }, [isOpen, activeTrancheId]);

  // Libérer les blob URLs à la fermeture
  useEffect(() => {
    if (!isOpen && previewData?.blobUrl) {
      URL.revokeObjectURL(previewData.blobUrl);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOptions = { includeCover, selectedExports, includeSummary, includePM };

  const handleToggleExport = (id) => {
    setSelectedExports(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (isPdf && onPreviewPdf) {
      setIsGenerating(true);
      try {
        const result = await onPreviewPdf(currentOptions);
        if (result) {
          setPreviewData(result);
          setStep('preview');
        }
      } catch (err) {
        console.error('Erreur prévisualisation PDF:', err);
        toast?.('Erreur lors de la génération du PDF — voir console', 'error');
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Excel : confirme directement
      onConfirm(currentOptions);
    }
  };

  const handleSave = async () => {
    // Déclenche la sauvegarde avec le blob déjà généré
    onConfirm({ ...currentOptions, _previewBlob: previewData?.blob, _suggestedName: previewData?.suggestedName });
    onClose();
  };

  const handleBack = () => {
    if (previewData?.blobUrl) URL.revokeObjectURL(previewData.blobUrl);
    setPreviewData(null);
    setStep('options');
  };

  const Icon = isPdf ? FileText : FileSpreadsheet;
  const title = isPdf ? 'Export PDF' : 'Export Excel';
  const isPreview = step === 'preview';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: isPreview ? 'none' : 'blur(8px)', padding: isPreview ? '0' : '16px' }}>
      <div
        className="flex flex-col rounded-xl overflow-hidden shadow-2xl transition-all duration-300"
        style={{
          background: 'linear-gradient(180deg, rgba(12,20,30,0.99) 0%, rgba(8,15,22,0.99) 100%)',
          border: isPreview ? 'none' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6)',
          width: isPreview ? '100vw' : '380px',
          maxHeight: isPreview ? '100vh' : '92vh',
          height: isPreview ? '100vh' : 'auto',
          borderRadius: isPreview ? '0' : undefined,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPdf ? 'bg-red-500/12 text-red-400' : 'bg-emerald-500/12 text-emerald-400'}`}>
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white/90">{title}</h3>
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mt-0.5">
                {type}{isPreview ? ' — Prévisualisation' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Contenu selon l'étape */}
        {step === 'options' ? (
          <OptionsStep
            isPdf={isPdf}
            type={type}
            hasTranches={hasTranches}
            tranches={tranches}
            includeCover={includeCover}
            setIncludeCover={setIncludeCover}
            includeSummary={includeSummary}
            setIncludeSummary={setIncludeSummary}
            includePM={includePM}
            setIncludePM={setIncludePM}
            selectedExports={selectedExports}
            handleToggleExport={handleToggleExport}
            onClose={onClose}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        ) : (
          <PreviewStep
            blobUrl={previewData?.blobUrl}
            suggestedName={previewData?.suggestedName}
            onBack={handleBack}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
};

export default ExportModal;