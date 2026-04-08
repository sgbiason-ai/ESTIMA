// src/components/mobile/MoeDetailView.jsx
//
// Vue détail d'un devis MOE mobile — lecture seule.
// Affiche : info devis, onglets infos, honoraires par phase, récapitulatif.

import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { dateFr } from './formatters';
import { formatPrice } from '../../utils/helpers';
import { PHASES_LOI_MOP, getCategoriesForAssignee, buildCategoriesMap } from '../../hooks/useDevisMoe';
import {
  pct, honPhasePct, honPhaseTemps, fmt, fmtE,
  isNestedTemps, getAssigneeKeys, getAssigneeName,
  tacheTotalBudget, grandTotalByAssignee, calcHonByAssignee,
} from '../../utils/devisMoeCalculations';

// ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────

export default function MoeDetailView({ devis }) {
  const [activeTab, setActiveTab] = useState('recap'); // 'infos' | 'phases' | 'recap'

  const cats = devis.categories || [];
  const lots = devis.lots || [];
  const taches = devis.taches || [];
  const isPct = devis.methode === 'pourcentage';
  const activePhases = (devis.phases || PHASES_LOI_MOP).filter(p => p.actif);
  const moeType = devis.moeType || 'seul';
  const isGrp = moeType !== 'seul' && (moeType === 'mandataire' ? (devis.cotraitants || []).length > 0 : true);

  return (
    <div className="flex flex-col h-full">

      {/* ── Devis header ──────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-0.5">Devis MOE</div>
        <div className="text-base font-bold text-gray-900">{devis.nom || '(Sans nom)'}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-700">
          {devis.reference && <span>Réf. {devis.reference}</span>}
          {devis.dateDevis && <span>{dateFr(devis.dateDevis)}</span>}
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
            {isPct ? 'Pourcentage' : 'Temps passé'}
          </span>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mx-4 mb-2 p-1 bg-gray-100 rounded-2xl">
        <TabBtn label="Récap" active={activeTab === 'recap'} onClick={() => setActiveTab('recap')} />
        <TabBtn label="Phases" active={activeTab === 'phases'} onClick={() => setActiveTab('phases')} />
        <TabBtn label="Infos" active={activeTab === 'infos'} onClick={() => setActiveTab('infos')} />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === 'recap' && (
          <RecapTab devis={devis} cats={cats} lots={lots} taches={taches} isPct={isPct}
            activePhases={activePhases} moeType={moeType} isGrp={isGrp} />
        )}
        {activeTab === 'phases' && (
          <PhasesTab devis={devis} cats={cats} lots={lots} taches={taches} isPct={isPct}
            activePhases={activePhases} />
        )}
        {activeTab === 'infos' && (
          <InfosTab devis={devis} isGrp={isGrp} />
        )}
      </div>
    </div>
  );
}

// ─── SOUS-COMPOSANTS ────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition ${
        active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
      }`}>
      {label}
    </button>
  );
}

// ─── ONGLET RÉCAP ───────────────────────────────────────────────────────────

function RecapTab({ devis, cats, lots, taches, isPct, activePhases, moeType, isGrp }) {
  const recapAssigneeKeys = moeType === 'mandataire' && (devis.cotraitants || []).length > 0 ? getAssigneeKeys(devis) : null;
  const recapCatsMap = moeType === 'mandataire' ? buildCategoriesMap(devis) : null;

  const phasesSummary = useMemo(() => {
    if (!isPct && taches.length > 0) {
      return activePhases.map(phase => {
        const phaseTaches = taches.filter(t => t.phaseId === phase.id);
        const total = recapAssigneeKeys
          ? phaseTaches.reduce((s, t) => s + tacheTotalBudget(t, recapCatsMap || cats, recapAssigneeKeys), 0)
          : phaseTaches.reduce((s, t) => s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);
        return { ...phase, total };
      });
    }
    return activePhases.map(phase => ({
      ...phase,
      total: lots.reduce((s, lot) => s + (isPct
        ? honPhasePct(pct(lot, devis.tauxHonorairesGlobal), lot.repartitionPhases, phase.id)
        : honPhaseTemps(lot, phase.id, cats)
      ), 0),
    }));
  }, [devis, lots, taches, isPct, cats, activePhases, recapAssigneeKeys]); // eslint-disable-line

  const totalHonHT = phasesSummary.reduce((s, p) => s + p.total, 0);
  const marge = parseFloat(devis.marge) || 0;
  const montantMarge = totalHonHT * marge / 100;
  const honAvecMarge = totalHonHT + montantMarge;
  const tva = parseFloat(devis.tva) || 20;
  const montantTVA = honAvecMarge * tva / 100;

  const honByAssignee = useMemo(() => isGrp && isPct ? calcHonByAssignee(devis) : null, [devis, isGrp, isPct]);
  const honByAssigneeTemps = useMemo(() => isGrp && !isPct && recapAssigneeKeys ? grandTotalByAssignee(taches, recapCatsMap || cats, recapAssigneeKeys) : null, [devis, isGrp, isPct, taches, cats, recapAssigneeKeys, recapCatsMap]); // eslint-disable-line

  return (
    <div className="space-y-3">

      {/* Montant principal */}
      <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center">
        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide mb-1">Honoraires TTC</div>
        <div className="text-2xl font-black text-indigo-300">{fmtE(honAvecMarge + montantTVA)}</div>
        <div className="flex justify-center gap-4 mt-2 text-[11px] text-gray-600">
          <span>HT : {fmtE(totalHonHT)}</span>
          {marge > 0 && <span>Marge {marge}% : +{fmtE(montantMarge)}</span>}
          <span>TVA {tva}% : {fmtE(montantTVA)}</span>
        </div>
      </div>

      {/* Phases summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-700">Par phase</span>
        </div>
        {phasesSummary.map(phase => (
          <div key={phase.id} className="flex items-center justify-between px-3 py-2 border-t border-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{phase.code}</span>
              <span className="text-xs text-gray-600 truncate max-w-[160px]">{phase.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">{fmtE(phase.total)}</span>
              <span className="text-[10px] text-gray-700">
                {totalHonHT > 0 ? `${fmt(phase.total / totalHonHT * 100)}%` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Groupement */}
      {isGrp && (honByAssignee || honByAssigneeTemps) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-700">Par membre</span>
          </div>
          {isPct && honByAssignee && Object.entries(honByAssignee).map(([key, data]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2 border-t border-white/[0.03]">
              <span className="text-xs font-semibold text-gray-600">{getAssigneeName(key, devis)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">{fmtE(data.totalHonHT)}</span>
                <span className="text-[10px] text-gray-700">
                  {totalHonHT > 0 ? `${fmt(data.totalHonHT / totalHonHT * 100)}%` : '—'}
                </span>
              </div>
            </div>
          ))}
          {!isPct && honByAssigneeTemps && recapAssigneeKeys && recapAssigneeKeys.map(aKey => (
            <div key={aKey} className="flex items-center justify-between px-3 py-2 border-t border-white/[0.03]">
              <span className="text-xs font-semibold text-gray-600">{getAssigneeName(aKey, devis)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">{fmtE(honByAssigneeTemps[aKey] || 0)}</span>
                <span className="text-[10px] text-gray-700">
                  {totalHonHT > 0 ? `${fmt((honByAssigneeTemps[aKey] || 0) / totalHonHT * 100)}%` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Synthèse financière */}
      <div className="space-y-2">
        <Row label="Honoraires HT" value={fmtE(totalHonHT)} />
        {marge > 0 && <Row label={`Marge ${marge}%`} value={`+ ${fmtE(montantMarge)}`} accent="text-blue-600" />}
        {marge > 0 && <Row label="HT avec marge" value={fmtE(honAvecMarge)} />}
        <Row label={`TVA ${tva}%`} value={fmtE(montantTVA)} />
        <div className="flex justify-between items-center px-3 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-sm font-bold text-indigo-300">Total TTC</span>
          <span className="text-lg font-black text-indigo-300">{fmtE(honAvecMarge + montantTVA)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-white border border-gray-200">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-sm font-bold ${accent || 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

// ─── ONGLET PHASES (lots / tâches) ──────────────────────────────────────────

function PhasesTab({ devis, cats, lots, taches, isPct, activePhases }) {
  const [expandedPhases, setExpandedPhases] = useState(() => new Set(activePhases.map(p => p.id)));

  const togglePhase = (id) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isPct && lots.length > 0) {
    return <LotsView devis={devis} lots={lots} cats={cats} isPct={isPct} activePhases={activePhases} />;
  }

  if (!isPct && taches.length > 0) {
    return (
      <div className="space-y-2">
        {activePhases.map(phase => {
          const phaseTaches = taches.filter(t => t.phaseId === phase.id);
          if (phaseTaches.length === 0) return null;
          const expanded = expandedPhases.has(phase.id);
          const phaseTotal = phaseTaches.reduce((s, t) =>
            s + cats.reduce((s2, c) => s2 + (parseFloat(t.temps?.[c.id]) || 0) * (parseFloat(c.tauxHoraire) || 0), 0), 0);

          return (
            <div key={phase.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => togglePhase(phase.id)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{phase.code}</span>
                  <span className="text-sm font-bold text-gray-900">{phase.label}</span>
                  <span className="text-[10px] text-gray-700 font-bold bg-white px-1.5 py-0.5 rounded">{phaseTaches.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">{fmtE(phaseTotal)}</span>
                  <Chevron expanded={expanded} />
                </div>
              </button>
              {expanded && phaseTaches.map(t => (
                <div key={t.id} className="px-3 py-2 border-t border-gray-100">
                  <div className="text-xs text-gray-600">{t.label || '(Sans libellé)'}</div>
                  <div className="flex gap-3 mt-1">
                    {cats.map(c => {
                      const h = parseFloat(t.temps?.[c.id]) || 0;
                      if (h === 0) return null;
                      return (
                        <span key={c.id} className="text-[10px] text-gray-700">
                          {c.label} : <span className="font-semibold text-gray-600">{h}h</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return <div className="text-center py-8 text-gray-700 text-sm">Aucune donnée.</div>;
}

function LotsView({ devis, lots, cats, isPct, activePhases }) {
  const [expandedLots, setExpandedLots] = useState(() => new Set());

  const toggleLot = (id) => {
    setExpandedLots(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {lots.map((lot, i) => {
        const honLot = isPct ? pct(lot, devis.tauxHonorairesGlobal) : activePhases.reduce((s, ph) => s + honPhaseTemps(lot, ph.id, cats), 0);
        const expanded = expandedLots.has(lot.id);

        return (
          <div key={lot.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => toggleLot(lot.id)}
              className="flex items-center justify-between w-full px-3 py-2.5 text-left">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] font-bold text-gray-700">#{i + 1}</span>
                <span className="text-sm font-bold text-gray-900 truncate">{lot.designation || '(Sans désignation)'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-600">{fmtE(honLot)}</span>
                <Chevron expanded={expanded} />
              </div>
            </button>
            {expanded && (
              <div className="px-3 py-2 border-t border-gray-100 space-y-1">
                <div className="text-[11px] text-gray-700">
                  Travaux HT : <span className="font-semibold text-gray-600">{fmtE(parseFloat(lot.montantTravauxHT) || 0)}</span>
                </div>
                {activePhases.map(ph => {
                  const phHon = isPct
                    ? honPhasePct(honLot, lot.repartitionPhases, ph.id)
                    : honPhaseTemps(lot, ph.id, cats);
                  if (phHon === 0) return null;
                  return (
                    <div key={ph.id} className="flex justify-between text-[11px]">
                      <span className="text-gray-700">{ph.code}</span>
                      <span className="text-gray-600 font-semibold">{fmtE(phHon)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ONGLET INFOS ───────────────────────────────────────────────────────────

function InfosTab({ devis, isGrp }) {
  const client = devis.client || {};
  const moeType = devis.moeType || 'seul';
  const mandataire = devis.mandataire || {};
  const cotraitants = devis.cotraitants || [];

  const moeTypeLabel = {
    seul: 'MOE seul',
    mandataire: 'Mandataire (groupement)',
    cotraitant: 'Co-traitant',
  };

  return (
    <div className="space-y-3">

      {/* Identification */}
      <InfoSection title="Identification">
        <InfoRow label="Nom" value={devis.nom} />
        <InfoRow label="Référence" value={devis.reference} />
        <InfoRow label="Date" value={dateFr(devis.dateDevis)} />
        <InfoRow label="Objet" value={devis.objet} />
        <InfoRow label="Type MOE" value={moeTypeLabel[moeType] || moeType} />
        <InfoRow label="Méthode" value={devis.methode === 'temps_passe' ? 'Temps passé' : 'Pourcentage'} />
        {devis.methode === 'pourcentage' && (
          <InfoRow label="Taux honoraires" value={`${devis.tauxHonorairesGlobal || 0} %`} />
        )}
        {(parseFloat(devis.marge) || 0) > 0 && (
          <InfoRow label="Marge" value={`${devis.marge} %`} />
        )}
        <InfoRow label="TVA" value={`${devis.tva || 20} %`} />
      </InfoSection>

      {/* Client */}
      {client.designation && (
        <InfoSection title="Client">
          <InfoRow label="Désignation" value={client.designation} />
          {client.adresse && <InfoRow label="Adresse" value={client.adresse} />}
          {(client.codePostal || client.ville) && (
            <InfoRow label="Ville" value={`${client.codePostal || ''} ${client.ville || ''}`.trim()} />
          )}
          {client.contact && <InfoRow label="Contact" value={client.contact} />}
        </InfoSection>
      )}

      {/* Mandataire / groupement */}
      {isGrp && mandataire.nom && (
        <InfoSection title="Mandataire">
          <InfoRow label="Nom" value={mandataire.nom} />
          {mandataire.siret && <InfoRow label="SIRET" value={mandataire.siret} />}
          {mandataire.adresse && <InfoRow label="Adresse" value={mandataire.adresse} />}
        </InfoSection>
      )}

      {/* Cotraitants */}
      {cotraitants.length > 0 && cotraitants.map((cot, i) => (
        <InfoSection key={cot.id} title={`Co-traitant ${i + 1}`}>
          <InfoRow label="Nom" value={cot.nom} />
          {cot.siret && <InfoRow label="SIRET" value={cot.siret} />}
          {cot.email && <InfoRow label="Email" value={cot.email} />}
        </InfoSection>
      ))}

      {/* Catégories */}
      {(devis.categories || []).length > 0 && (
        <InfoSection title="Catégories professionnelles">
          {devis.categories.map(c => (
            <InfoRow key={c.id} label={c.label} value={`${c.tauxHoraire} €/h`} />
          ))}
        </InfoSection>
      )}

      {/* Phases actives */}
      <InfoSection title="Phases actives">
        {(devis.phases || PHASES_LOI_MOP).filter(p => p.actif).map(p => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.03] first:border-0">
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{p.code}</span>
            <span className="text-xs text-gray-600">{p.label}</span>
          </div>
        ))}
      </InfoSection>
    </div>
  );
}

function InfoSection({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center px-3 py-2 border-t border-white/[0.03] first:border-0">
      <span className="text-[11px] text-gray-700 font-medium">{label}</span>
      <span className="text-xs text-gray-600 font-semibold text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function Chevron({ expanded }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
