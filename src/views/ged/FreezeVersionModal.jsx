// src/views/ged/FreezeVersionModal.jsx
// Modal de gel d'une version : choix de la phase + métadonnées d'émission
// (objet, destinataire, statut, note). Produit l'indice lettre suivant (aperçu).
//
// Deux modes :
//   - 'freeze'      : gel libre, la phase est choisie parmi celles de l'affaire.
//   - 'transition'  : clôture de la phase courante puis passage à la suivante ;
//                     la phase gelée est verrouillée sur la phase courante.

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, Lock, Send, FileEdit, ArrowRight } from 'lucide-react';
import { getPhaseStyleFromList, phaseColorFor, styleForColor } from '../../utils/phaseModel';

// Aperçu de l'indice lettre suivant pour un code de phase donné.
const nextLetterFor = (archives, code) => {
  const existing = (archives || []).filter((a) => a.phase === code);
  const nextIndex = existing.length === 0 ? 1 : Math.max(...existing.map((a) => a.index || 0)) + 1;
  let n = nextIndex;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const FreezeVersionModal = ({
  show, onClose, onConfirm, archives, projectName, busy,
  phases = [], defaultPhaseCode = 'DCE',
  mode = 'freeze', nextPhase = null,
}) => {
  const isTransition = mode === 'transition';
  const [phaseCode, setPhaseCode] = useState(defaultPhaseCode);
  const [subject, setSubject] = useState('');
  const [recipient, setRecipient] = useState('');
  const [status, setStatus] = useState('emis');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (show) {
      setPhaseCode(defaultPhaseCode || 'DCE');
      setSubject('');
      setRecipient('');
      setStatus('emis');
      setNote('');
    }
  }, [show, defaultPhaseCode]);

  const nextLabel = useMemo(() => `${phaseCode}-${nextLetterFor(archives, phaseCode)}`, [archives, phaseCode]);
  const s = getPhaseStyleFromList(phases, phaseCode);
  const nextStyle = nextPhase ? styleForColor(phaseColorFor(nextPhase.code, 99)) : null;

  if (!show) return null;

  const handleConfirm = () => onConfirm({ phase: phaseCode, subject, recipient, status, note });

  return (
    <div className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-900 rounded-xl"><Lock size={18} className="text-white" /></div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">{isTransition ? 'Clôturer la phase' : 'Figer une version'}</h2>
              <p className="text-[11px] text-slate-400">{projectName || 'Projet'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">

          {/* Bandeau transition */}
          {isTransition && nextPhase && (
            <div className="flex items-center justify-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <span className={`text-[12px] font-bold px-2 py-1 rounded-lg border ${s.light} ${s.text} ${s.border}`}>{phaseCode}</span>
              <ArrowRight size={16} className="text-slate-400" />
              <span className={`text-[12px] font-bold px-2 py-1 rounded-lg border ${nextStyle.light} ${nextStyle.text} ${nextStyle.border}`}>{nextPhase.code}</span>
              <span className="text-[11px] text-slate-500">{nextPhase.label}</span>
            </div>
          )}

          {/* Phase (sélection libre uniquement en mode freeze) */}
          {!isTransition && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">Phase</label>
              <div className="flex flex-wrap gap-1.5">
                {phases.map((p) => {
                  const ps = getPhaseStyleFromList(phases, p.code);
                  const active = phaseCode === p.code;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPhaseCode(p.code)}
                      title={p.label}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${active ? `${ps.light} ${ps.text} ${ps.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    >
                      {p.code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            Indice attribué :
            <span className={`font-bold px-2 py-0.5 rounded-lg border ${s.light} ${s.text} ${s.border}`}>{nextLabel}</span>
          </div>

          {/* Objet */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">Objet du document <span className="font-normal text-slate-400 normal-case">(facultatif)</span></label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="ex : Estimation pour validation MOA"
              className="w-full px-3 py-2 text-[13px] bg-gray-100 border border-gray-200/60 rounded-xl focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
          </div>

          {/* Destinataire */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">Destinataire <span className="font-normal text-slate-400 normal-case">(facultatif)</span></label>
            <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
              placeholder="ex : Mairie de Lyon — M. Dupont"
              className="w-full px-3 py-2 text-[13px] bg-gray-100 border border-gray-200/60 rounded-xl focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
          </div>

          {/* Statut */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStatus('emis')}
                className={`flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-xl border transition-colors ${status === 'emis' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                <Send size={14} /> Émis au client
              </button>
              <button onClick={() => setStatus('brouillon')}
                className={`flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-xl border transition-colors ${status === 'brouillon' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                <FileEdit size={14} /> Brouillon interne
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">Note <span className="font-normal text-slate-400 normal-case">(facultatif)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Commentaire interne sur cette version…"
              className="w-full px-3 py-2 text-[13px] bg-gray-100 border border-gray-200/60 rounded-xl focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none" />
          </div>

          <p className="text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
            {isTransition
              ? <>La version <strong>{nextLabel}</strong> est figée, puis l'affaire passe en phase <strong>{nextPhase?.code}</strong>. Le projet de travail reste modifiable.</>
              : <>Une copie <strong>immuable</strong> et horodatée sera créée. Le projet de travail reste librement modifiable.</>}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
          <button onClick={handleConfirm} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[12px] font-bold rounded-xl hover:bg-gray-700 transition-colors active:scale-95 disabled:opacity-50">
            <Lock size={14} /> {busy ? 'Traitement…' : (isTransition ? `Figer « ${nextLabel} » & avancer` : `Figer « ${nextLabel} »`)}
          </button>
        </div>
      </div>
    </div>
  );
};

FreezeVersionModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  archives: PropTypes.array,
  projectName: PropTypes.string,
  busy: PropTypes.bool,
  phases: PropTypes.array,
  defaultPhaseCode: PropTypes.string,
  mode: PropTypes.oneOf(['freeze', 'transition']),
  nextPhase: PropTypes.object,
};

export default FreezeVersionModal;
