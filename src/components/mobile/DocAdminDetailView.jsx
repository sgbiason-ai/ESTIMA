// src/components/mobile/DocAdminDetailView.jsx
//
// Vue detail d'une fiche marche — lecture seule + exports EXE1/EXE4-6.

import React, { useState, useMemo, useCallback } from 'react';
import Icon from './Icon';
import { dateFr, fmt } from './formatters';
import { setShareMode, canNativeShare } from '../../utils/fileSaver';

// ─── OS type labels ────────────────────────────────────────────────────────
const OS_LABELS = {
  preparation: 'Préparation',
  demarrage: 'Démarrage',
  arret: 'Arrêt',
  reprise: 'Reprise',
};

// ─── Timeline helpers (repris de DocAdminView / FicheRecap) ────────────────
const getOSDate = (os) => {
  const d = os?.dateDemarragePrestations || os?.dateReception;
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

const calculateArretDays = (osList) => {
  const events = osList
    .filter(os => os.typeOS === 'arret' || os.typeOS === 'reprise')
    .map(os => ({ type: os.typeOS, date: getOSDate(os) }))
    .filter(e => e.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  let total = 0;
  const periodes = [];
  let cur = null;
  for (const ev of events) {
    if (ev.type === 'arret' && !cur) cur = ev.date;
    else if (ev.type === 'reprise' && cur) {
      const j = Math.round((ev.date - cur) / 864e5);
      if (j > 0) { total += j; periodes.push({ debut: cur, fin: ev.date, jours: j }); }
      cur = null;
    }
  }
  if (cur) {
    const j = Math.round((Date.now() - cur) / 864e5);
    if (j > 0) { total += j; periodes.push({ debut: cur, fin: null, jours: j, enCours: true }); }
  }
  return { totalArretDays: total, periodes, events };
};

const calcEndDate = (startStr, dur, unit) => {
  if (!startStr || !dur) return null;
  const d = new Date(startStr);
  if (isNaN(d)) return null;
  const n = parseInt(dur, 10);
  if (isNaN(n)) return null;
  const u = (unit || '').toLowerCase();
  if (u.includes('mois')) d.setMonth(d.getMonth() + n);
  else if (u.includes('jour')) d.setDate(d.getDate() + n);
  else if (u.includes('semaine')) d.setDate(d.getDate() + n * 7);
  return d;
};

const extractTimeline = (fiche) => {
  const D = fiche.sectionD || {};
  const osList = Array.isArray(fiche.exe1) ? fiche.exe1 : [];
  const os1 = osList.find(o => String(o.numeroOrdreService) === '1') || osList[0];
  const demarrage = os1?.dateDemarragePrestations || os1?.dateReception || null;
  const arret = calculateArretDays(osList);
  const finTheo = calcEndDate(demarrage, D.dureeExecution, D.uniteDuree);
  const intemp = parseInt(D.joursIntemperies, 10) || 0;
  let finRev = null;
  if (finTheo) {
    finRev = new Date(finTheo);
    finRev.setDate(finRev.getDate() + intemp + arret.totalArretDays);
  }
  return {
    notification: D.dateNotification || null,
    demarrage,
    finTheorique: finTheo,
    finRevisee: finRev,
    arretData: arret,
    osList,
    duree: D.dureeExecution ? `${D.dureeExecution} ${D.uniteDuree || 'mois'}` : null,
    intemperies: intemp,
  };
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const SectionTab = ({ label, active, onClick }) => (
  <button onClick={onClick}
    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
      active ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
    }`}>
    {label}
  </button>
);

const InfoRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-700 font-semibold shrink-0">{label}</span>
      <span className="text-xs text-gray-600 text-right">{value}</span>
    </div>
  );
};

const SectionCard = ({ title, icon, color, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
      <Icon name={icon} size={14} color={color} />
      <span className="text-xs font-bold text-gray-600">{title}</span>
    </div>
    <div className="px-3 py-1.5">
      {children}
    </div>
  </div>
);

// ─── Composant principal ───────────────────────────────────────────────────
export default function DocAdminDetailView({ fiche, branding, onToast, isLandscape }) {
  const [activeTab, setActiveTab] = useState('resume');
  const [exporting, setExporting] = useState(null);

  const { sectionA, sectionB, sectionD } = fiche;
  const lots = sectionD?.lots || [];

  // ── Collecter tous les EXE par entreprise ──
  // Marché alloti : données dans exeParEntreprise[groupeId]
  // Marché seul : données à la racine (fiche.exe1, fiche.reception, fiche.exe10)
  const allExeEntries = useMemo(() => {
    const map = fiche.exeParEntreprise || {};
    const groups = fiche.sectionB?.groupesAttributaires || [];
    const entries = Object.entries(map);

    // Marché alloti avec exeParEntreprise rempli
    if (entries.length > 0) {
      return entries.map(([groupeId, data]) => {
        const group = groups.find((g) => g.groupeId === groupeId);
        const name = group?.entreprise?.nomCommercial ||
          group?.entreprise?.denominationSociale ||
          fiche.sectionB?.mandataire?.nomCommercial ||
          'Entreprise';
        return { groupeId, name, data };
      });
    }

    // Marché seul : EXE stockés à la racine de la fiche
    const rootExe1 = fiche.exe1 || [];
    const rootReception = fiche.reception || {};
    const rootExe10 = fiche.exe10 || {};
    const hasRootData = rootExe1.length > 0 ||
      Object.keys(rootReception).length > 0 ||
      Object.keys(rootExe10).length > 0;

    if (hasRootData) {
      return [{
        groupeId: '_root',
        name: fiche.sectionB?.mandataire?.nomCommercial ||
          fiche.sectionB?.mandataire?.denominationSociale || 'Entreprise',
        data: { exe1: rootExe1, reception: rootReception, exe10: rootExe10 },
      }];
    }

    return [];
  }, [fiche]);

  // ── Export EXE ──
  const handleExport = useCallback(async (type, groupeId, index) => {
    const key = `${type}-${groupeId}-${index ?? ''}`;
    setExporting(key);
    try {
      // Données EXE : soit à la racine (marché seul) soit dans exeParEntreprise
      const exeData = groupeId === '_root'
        ? { exe1: fiche.exe1 || [], reception: fiche.reception || {}, exe10: fiche.exe10 || {} }
        : fiche.exeParEntreprise?.[groupeId];
      if (!exeData) return;

      const virtualFiche = { ...fiche };

      if (type === 'exe1') {
        const osList = exeData.exe1 || [];
        const os = osList[index];
        if (!os) return;
        const { exportExe1Pdf } = await import('../../utils/docAdmin/generateExe1');
        await exportExe1Pdf(virtualFiche, os);
      } else if (type === 'exe4') {
        const { exportExe4Pdf } = await import('../../utils/docAdmin/generateExe4');
        await exportExe4Pdf(virtualFiche, exeData.reception || {});
      } else if (type === 'exe5') {
        const { exportExe5Pdf } = await import('../../utils/docAdmin/generateExe5');
        await exportExe5Pdf(virtualFiche, exeData.reception || {});
      } else if (type === 'exe6') {
        const { exportExe6Pdf } = await import('../../utils/docAdmin/generateExe6');
        await exportExe6Pdf(virtualFiche, exeData.reception || {});
      }

      onToast?.('Document exporté');
    } catch (err) {
      console.error('[DocAdminDetail] Export:', err);
      onToast?.('Erreur export');
    } finally {
      setExporting(null);
    }
  }, [fiche, onToast]);

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Header fiche ──────────────────────────────────────────────── */}
      <div className={`mx-4 bg-white rounded-xl border border-gray-200 ${isLandscape ? 'mt-0.5 mb-1 p-2' : 'mt-2 mb-2 p-3'}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-rose-400">{fiche.nom}</span>
            {sectionD?.referenceMarche && (
              <span className="text-[10px] text-gray-700 ml-2">Réf. {sectionD.referenceMarche}</span>
            )}
          </div>
          {sectionD?.dateNotification && (
            <span className="text-xs text-gray-700 shrink-0">
              Notif. {dateFr(sectionD.dateNotification)}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className={`flex gap-1.5 mx-4 p-1 bg-gray-100 rounded-2xl ${isLandscape ? 'mb-1' : 'mb-2'}`}>
        <SectionTab label="Résumé" active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} />
        <SectionTab label="Frise" active={activeTab === 'frise'} onClick={() => setActiveTab('frise')} />
        <SectionTab label="EXE Docs" active={activeTab === 'exe'} onClick={() => setActiveTab('exe')} />
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* ─── TAB RESUME ─────────────────────────────────────────────── */}
        {activeTab === 'resume' && (
          <div>
            {/* Section A — Pouvoir adjudicateur */}
            <SectionCard title="Pouvoir adjudicateur" icon="building" color="#fb7185">
              <InfoRow label="Désignation" value={sectionA?.designation} />
              <InfoRow label="Adresse" value={[sectionA?.adresse, sectionA?.codePostal, sectionA?.ville].filter(Boolean).join(', ')} />
              <InfoRow label="Représentant" value={sectionA?.representant} />
              <InfoRow label="Qualité" value={sectionA?.qualite} />
              <InfoRow label="Tél" value={sectionA?.telephone} />
              <InfoRow label="Email" value={sectionA?.email} />
            </SectionCard>

            {/* Section B — Titulaire */}
            <SectionCard title="Titulaire du marché" icon="user" color="#60a5fa">
              <InfoRow label="Type" value={sectionB?.type === 'groupement' ? `Groupement ${sectionB.typeGroupement}` : 'Entreprise seule'} />
              <InfoRow label="Mandataire" value={sectionB?.mandataire?.nomCommercial || sectionB?.mandataire?.denominationSociale} />
              <InfoRow label="Ville" value={sectionB?.mandataire?.ville} />
              <InfoRow label="SIRET" value={sectionB?.mandataire?.siret} />
              {(sectionB?.cotraitants || []).map((ct, i) => (
                <InfoRow key={i} label={`Co-traitant ${i + 1}`} value={ct.nomCommercial || ct.denominationSociale} />
              ))}
            </SectionCard>

            {/* Section D — Objet du marché */}
            <SectionCard title="Objet du marché" icon="file" color="#34d399">
              <InfoRow label="Objet" value={sectionD?.objet} />
              <InfoRow label="Référence" value={sectionD?.referenceMarche} />
              <InfoRow label="Notification" value={dateFr(sectionD?.dateNotification)} />
              <InfoRow label="Durée" value={sectionD?.dureeExecution ? `${sectionD.dureeExecution} ${sectionD.uniteDuree || 'mois'}` : ''} />
              <InfoRow label="Lieu d'exécution" value={sectionD?.adresseExecution} />
            </SectionCard>

            {/* Lots */}
            {lots.length > 0 && (
              <SectionCard title={`Lots (${lots.length})`} icon="list" color="#fbbf24">
                {lots.map((lot, i) => (
                  <InfoRow key={i}
                    label={`Lot ${lot.numero || i + 1}`}
                    value={lot.montantHT ? `${lot.montantHT} € HT` : '—'}
                  />
                ))}
              </SectionCard>
            )}
          </div>
        )}

        {/* ─── TAB FRISE CHRONOLOGIQUE ────────────────────────────────── */}
        {activeTab === 'frise' && <TimelineTab fiche={fiche} allExeEntries={allExeEntries} />}

        {/* ─── TAB EXE DOCS ───────────────────────────────────────────── */}
        {activeTab === 'exe' && (
          <div>
            {allExeEntries.length === 0 && (
              <div className="text-center py-10 text-gray-700 text-sm">
                Aucun document EXE renseigné
              </div>
            )}

            {allExeEntries.map(({ groupeId, name, data }) => (
              <div key={groupeId} className="mb-4">
                {/* Entreprise header (si plusieurs) */}
                {allExeEntries.length > 1 && (
                  <div className="text-xs font-bold text-rose-400 mb-2 px-1">{name}</div>
                )}

                {/* EXE1-T — Ordres de Service */}
                <SectionCard title="EXE1-T — Ordres de Service" icon="file" color="#fb7185">
                  {(data.exe1 || []).length === 0 && (
                    <div className="py-2 text-xs text-gray-700">Aucun OS</div>
                  )}
                  {(data.exe1 || []).map((os, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-600">
                          OS n°{os.numeroOrdreService || idx + 1}
                        </div>
                        <div className="text-[11px] text-gray-700">
                          {OS_LABELS[os.typeOS] || os.typeOS}
                          {os.dateDemarragePrestations && ` — ${dateFr(os.dateDemarragePrestations)}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleExport('exe1', groupeId, idx)}
                        disabled={!!exporting}
                        className="shrink-0 w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center active:bg-rose-500/30 transition disabled:opacity-40"
                      >
                        {exporting === `exe1-${groupeId}-${idx}`
                          ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                          : <Icon name="download" size={14} color="#fb7185" />}
                      </button>
                    </div>
                  ))}
                </SectionCard>

                {/* EXE4/5/6 — Réception */}
                <SectionCard title="Réception (EXE4/5/6)" icon="check" color="#34d399">
                  {(!data.reception || Object.keys(data.reception).length === 0) ? (
                    <div className="py-2 text-xs text-gray-700">Non renseigné</div>
                  ) : (
                    <div className="space-y-2">
                      {/* EXE4 — OPR */}
                      <div className="flex items-center justify-between py-1.5">
                        <div>
                          <div className="text-xs font-semibold text-gray-600">EXE4 — OPR</div>
                          <div className="text-[11px] text-gray-700">
                            {data.reception.dateOPR ? `OPR le ${dateFr(data.reception.dateOPR)}` : 'Date non renseignée'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleExport('exe4', groupeId)}
                          disabled={!!exporting}
                          className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center active:bg-emerald-500/30 transition disabled:opacity-40"
                        >
                          {exporting === `exe4-${groupeId}-`
                            ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            : <Icon name="download" size={14} color="#34d399" />}
                        </button>
                      </div>

                      {/* EXE5 — Propositions */}
                      <div className="flex items-center justify-between py-1.5 border-t border-gray-100">
                        <div>
                          <div className="text-xs font-semibold text-gray-600">EXE5 — Propositions MOE</div>
                        </div>
                        <button
                          onClick={() => handleExport('exe5', groupeId)}
                          disabled={!!exporting}
                          className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center active:bg-emerald-500/30 transition disabled:opacity-40"
                        >
                          {exporting === `exe5-${groupeId}-`
                            ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            : <Icon name="download" size={14} color="#34d399" />}
                        </button>
                      </div>

                      {/* EXE6 — Décision */}
                      <div className="flex items-center justify-between py-1.5 border-t border-gray-100">
                        <div>
                          <div className="text-xs font-semibold text-gray-600">EXE6 — Décision de réception</div>
                        </div>
                        <button
                          onClick={() => handleExport('exe6', groupeId)}
                          disabled={!!exporting}
                          className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center active:bg-emerald-500/30 transition disabled:opacity-40"
                        >
                          {exporting === `exe6-${groupeId}-`
                            ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            : <Icon name="download" size={14} color="#34d399" />}
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Statuts autres EXE */}
                <div className="flex gap-2 flex-wrap mb-2">
                  {data.exe10 && Object.keys(data.exe10).length > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/20">
                      EXE10 Avenant ✓
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-white text-gray-600 border-gray-200">
                      EXE10 —
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FRISE CHRONOLOGIQUE MOBILE ────────────────────────────────────────────

function TimelineTab({ fiche, allExeEntries }) {
  // Pour marché alloti : la timeline utilise les données de la première entreprise
  // Pour marché seul : données à la racine
  const ficheForTimeline = useMemo(() => {
    if (Array.isArray(fiche.exe1) && fiche.exe1.length > 0) return fiche;
    // Marché alloti : prendre les EXE de la première entrée
    if (allExeEntries.length > 0 && allExeEntries[0].groupeId !== '_root') {
      return { ...fiche, exe1: allExeEntries[0].data.exe1 || [] };
    }
    return fiche;
  }, [fiche, allExeEntries]);

  const tl = useMemo(() => extractTimeline(ficheForTimeline), [ficheForTimeline]);

  const formatD = (d) => {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const hasDates = tl.notification || tl.demarrage || tl.finTheorique;

  // Barre de progression
  const progress = useMemo(() => {
    if (!tl.demarrage || !tl.finRevisee) return null;
    const start = new Date(tl.demarrage).getTime();
    const end = tl.finRevisee.getTime();
    const now = Date.now();
    if (end <= start) return null;
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }, [tl]);

  if (!hasDates) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-700">
        <Icon name="calendar" size={28} color="#475569" />
        <span className="text-sm mt-3 font-semibold">Planning non défini</span>
        <span className="text-xs mt-1">Renseignez les dates sur la version desktop</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Barre de progression ──────────────────────────────────────── */}
      {progress !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Avancement</span>
            <span className="text-xs font-extrabold text-gray-900">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-white rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Dates clés ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-600">Dates clés</span>
        </div>
        <div className="divide-y divide-white/5">
          {tl.notification && (
            <TimelineRow color="#94a3b8" label="Notification" date={formatD(tl.notification)} />
          )}
          {tl.demarrage && (
            <TimelineRow color="#60a5fa" label="Démarrage travaux" date={formatD(tl.demarrage)} />
          )}
          {tl.duree && (
            <TimelineRow color="#a78bfa" label="Durée prévue" date={tl.duree} />
          )}
          {tl.finTheorique && (
            <TimelineRow color="#34d399" label="Fin théorique" date={formatD(tl.finTheorique)} />
          )}
          {tl.finRevisee && tl.finTheorique &&
            tl.finRevisee.getTime() !== tl.finTheorique.getTime() && (
            <TimelineRow color="#fbbf24" label="Fin révisée" date={formatD(tl.finRevisee)} highlight />
          )}
        </div>
      </div>

      {/* ── Arrêts de chantier ────────────────────────────────────────── */}
      {tl.arretData.periodes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">Arrêts de chantier</span>
            <span className="text-[10px] font-extrabold text-red-400">
              {tl.arretData.totalArretDays} jour{tl.arretData.totalArretDays > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {tl.arretData.periodes.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600">
                    {formatD(p.debut)} → {p.enCours ? 'en cours' : formatD(p.fin)}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-red-400">{p.jours}j</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Intempéries ───────────────────────────────────────────────── */}
      {tl.intemperies > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">Jours intempéries</span>
          <span className="text-xs font-extrabold text-cyan-400">+{tl.intemperies} jour{tl.intemperies > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Liste des OS ��─────────────────────────────────────────────── */}
      {tl.osList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-600">Ordres de Service</span>
          </div>
          <div className="divide-y divide-white/5">
            {tl.osList.map((os, i) => {
              const osDate = getOSDate(os);
              const typeColor = os.typeOS === 'arret' ? '#ef4444' : os.typeOS === 'reprise' ? '#22c55e' : '#60a5fa';
              return (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-600">
                      OS n°{os.numeroOrdreService || i + 1}
                    </span>
                    <span className="text-[11px] text-gray-700 ml-1.5">
                      {OS_LABELS[os.typeOS] || os.typeOS}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-700 shrink-0">{formatD(osDate)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ color, label, date, highlight }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 ${highlight ? 'bg-amber-500/5' : ''}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-gray-600">{label}</span>
      </div>
      <span className={`text-xs font-bold ${highlight ? 'text-amber-400' : 'text-gray-600'}`}>{date}</span>
    </div>
  );
}
