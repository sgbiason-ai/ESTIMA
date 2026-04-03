import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Building, HardHat, FileText, CheckCircle, AlertCircle, CloudSnow, Loader, Pause, Play, Euro, Activity, Flag } from 'lucide-react';

// ─── Utilitaire de calcul de date ───────────────────────────────────────────
const calculateEndDate = (startDateStr, duration, unit) => {
  if (!startDateStr || !duration) return null;
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return null;

  const amount = parseInt(duration, 10);
  if (isNaN(amount)) return null;

  if ((unit || '').toLowerCase().includes('mois')) {
    date.setMonth(date.getMonth() + amount);
  } else if ((unit || '').toLowerCase().includes('jour')) {
    date.setDate(date.getDate() + amount);
  }
  return date;
};

// ─── Calcul des jours d'arrêt à partir des OS ──────────────────────────────
const getOSDate = (os) => {
  const d = os?.dateDemarragePrestations || os?.dateReception;
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

const calculateArretDays = (osList) => {
  // Trier les OS arrêt/reprise par date
  const events = osList
    .filter(os => os.typeOS === 'arret' || os.typeOS === 'reprise')
    .map(os => ({ type: os.typeOS, date: getOSDate(os), numero: os.numeroOrdreService }))
    .filter(e => e.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalArretDays = 0;
  const periodes = []; // { debut, fin, jours }
  let currentArret = null;

  for (const event of events) {
    if (event.type === 'arret' && !currentArret) {
      currentArret = event.date;
    } else if (event.type === 'reprise' && currentArret) {
      const jours = Math.round((event.date.getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
      if (jours > 0) {
        totalArretDays += jours;
        periodes.push({ debut: new Date(currentArret), fin: new Date(event.date), jours });
      }
      currentArret = null;
    }
  }

  // Si un arrêt est en cours (pas de reprise), on compte jusqu'à aujourd'hui
  if (currentArret) {
    const now = new Date();
    const jours = Math.round((now.getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
    if (jours > 0) {
      totalArretDays += jours;
      periodes.push({ debut: new Date(currentArret), fin: null, jours, enCours: true });
    }
  }

  return { totalArretDays, periodes, events };
};

const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
};

// ─── Composant Frise Chronologique ──────────────────────────────────────────
const Timeline = ({ dates, arretEvents, arretPeriodes }) => {
  const { notification, demarrage, finTheorique, finRevisee } = dates;

  const start = notification ? new Date(notification) : (demarrage ? new Date(demarrage) : new Date());
  const end = finRevisee || finTheorique || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const totalDuration = end.getTime() - start.getTime();

  const getPosition = (date) => {
    if (!date || totalDuration <= 0) return 0;
    const d = new Date(date);
    const ratio = (d.getTime() - start.getTime()) / totalDuration;
    return Math.max(0, Math.min(100, ratio * 100));
  };

  let points = [
    { label: 'Notification', date: notification, pos: getPosition(notification), colorBg: 'bg-slate-500', colorText: 'text-gray-500' },
    { label: 'Démarrage', date: demarrage, pos: getPosition(demarrage), colorBg: 'bg-blue-500', colorText: 'text-blue-500' },
    { label: 'Fin Théorique', date: finTheorique, pos: getPosition(finTheorique), colorBg: 'bg-emerald-500', colorText: 'text-emerald-500' },
    { label: 'Fin Révisée', date: finRevisee, pos: getPosition(finRevisee), colorBg: 'bg-amber-500', colorText: 'text-amber-500' },
  ].filter(p => p.date);

  // Fusionner les points de fin s'ils sont le même jour
  if (finTheorique && finRevisee && finTheorique.getTime() === finRevisee.getTime()) {
    points = points.filter(p => p.label !== 'Fin Théorique');
    const rev = points.find(p => p.label === 'Fin Révisée');
    if (rev) { rev.label = 'Fin Prévue'; rev.colorBg = 'bg-emerald-500'; rev.colorText = 'text-emerald-500'; }
  }

  const osPoints = (arretEvents || []).map(e => ({
    label: e.type === 'arret' ? 'Arrêt' : 'Reprise',
    date: e.date,
    pos: getPosition(e.date),
    colorBg: e.type === 'arret' ? 'bg-red-500' : 'bg-green-500',
    colorText: e.type === 'arret' ? 'text-red-500' : 'text-green-500',
  }));

  const arretZones = (arretPeriodes || []).map(p => {
    const left = getPosition(p.debut);
    const right = p.fin ? getPosition(p.fin) : getPosition(new Date());
    return { left, width: Math.max(0, right - left) };
  }).filter(z => z.width > 0);

  if (!notification && !demarrage && !finTheorique) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-2xl bg-gray-50 border border-gray-200 border-dashed text-gray-500">
        <Clock size={24} className="mb-2 opacity-50" />
        <span className="text-[10px] uppercase font-bold tracking-widest">Planning non défini</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-40 select-none px-12">
      {/* Barre de fond */}
      <div className="absolute top-1/2 left-8 right-8 h-2 -translate-y-1/2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        {/* Progression jusqu'à aujourd'hui */}
        <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-600/30 to-blue-400/30" style={{ width: `${getPosition(new Date())}%` }} />
        
        {/* Zones d'arrêt */}
        {arretZones.map((z, i) => (
          <div key={i} className="absolute top-0 bottom-0 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ left: `${z.left}%`, width: `${z.width}%` }} />
        ))}
      </div>

      {/* Marqueurs Principaux (Haut) */}
      {points.map((pt, i) => (
        <div key={i} className="absolute top-[20px] flex flex-col items-center group" style={{ left: `calc(2rem + ${pt.pos} * calc(100% - 4rem) / 100)`, transform: 'translateX(-50%)' }}>
          <span className={`text-[10px] font-black uppercase tracking-wider mb-0.5 transition-colors ${pt.colorText}`}>{pt.label}</span>
          <span className="text-[10px] text-gray-500 font-bold mb-2 group-hover:text-gray-800 transition-colors">{formatDate(pt.date)}</span>
          <div className="w-px h-6 bg-gray-400 group-hover:bg-gray-500 transition-colors" />
          <div className={`w-3.5 h-3.5 rounded-full border-[3px] border-white ${pt.colorBg} relative z-10 shadow-sm group-hover:scale-125 transition-transform`} />
        </div>
      ))}

      {/* Marqueurs OS (Bas) */}
      {osPoints.map((pt, i) => (
        <div key={`os-${i}`} className="absolute bottom-[20px] flex flex-col items-center group" style={{ left: `calc(2rem + ${pt.pos} * calc(100% - 4rem) / 100)`, transform: 'translateX(-50%)' }}>
          <div className={`w-2.5 h-2.5 rounded-full border-2 border-white ${pt.colorBg} relative z-10 group-hover:scale-125 transition-transform`} />
          <div className="w-px h-6 bg-gray-400 mt-1 group-hover:bg-gray-500 transition-colors" />
          <span className="text-[9px] text-gray-500 font-bold mt-2 group-hover:text-gray-800 transition-colors">{formatDate(pt.date)}</span>
          <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${pt.colorText}`}>{pt.label}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Helper : extraire les données de frise d'une fiche (ou virtualFiche) ──
const extractTimelineData = (fiche, D) => {
  const osList = Array.isArray(fiche.exe1) ? fiche.exe1 : (fiche.exe1 ? [fiche.exe1] : []);
  const osDemarrage = osList.find(os => String(os.numeroOrdreService) === '1') || osList[0];
  const dateDemarrage = osDemarrage?.dateDemarragePrestations || osDemarrage?.dateReception || null;
  const arretData = calculateArretDays(osList);
  const dateFinTheorique = calculateEndDate(dateDemarrage, D.dureeExecution, D.uniteDuree);
  let totalOSHT = 0;
  osList.forEach(os => {
    (os.prestations || []).forEach(p => {
      totalOSHT += (parseFloat(p.quantite) || 0) * (parseFloat(p.prixUnitaire) || 0);
    });
  });
  return { osList, osDemarrage, dateDemarrage, arretData, dateFinTheorique, totalOSHT };
};

// ─── Mini-frise pour la vue d'ensemble comparative ─────────────────────────
const MiniTimeline = ({ label, sublabel, dates, color = 'blue' }) => {
  const { notification, demarrage, finTheorique, finRevisee } = dates;
  const start = notification ? new Date(notification) : (demarrage ? new Date(demarrage) : new Date());
  const end = finRevisee || finTheorique || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const totalDuration = end.getTime() - start.getTime();
  const getPos = (date) => {
    if (!date || totalDuration <= 0) return 0;
    return Math.max(0, Math.min(100, ((new Date(date).getTime() - start.getTime()) / totalDuration) * 100));
  };

  const colorMap = {
    blue: { bg: 'bg-blue-500', light: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/20' },
    emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-500/20', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500', light: 'bg-amber-500/20', text: 'text-amber-500', border: 'border-amber-500/20' },
    purple: { bg: 'bg-purple-500', light: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/20' },
    cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-500/20', text: 'text-cyan-500', border: 'border-cyan-500/20' },
    red: { bg: 'bg-red-500', light: 'bg-red-500/20', text: 'text-red-500', border: 'border-red-500/20' },
  };
  const c = colorMap[color] || colorMap.blue;

  const hasDates = demarrage || finTheorique;

  return (
    <div className={`flex items-center gap-4 p-3 rounded-xl border ${c.border} ${c.light}`}>
      <div className="w-40 shrink-0">
        <span className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>{label}</span>
        {sublabel && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{sublabel}</p>}
      </div>
      {hasDates ? (
        <div className="flex-1 relative h-5">
          <div className="absolute inset-y-0 left-0 right-0 bg-gray-200 rounded-full overflow-hidden">
            {demarrage && finTheorique && (
              <div className={`absolute top-0 bottom-0 ${c.bg} opacity-40 rounded-full`}
                style={{ left: `${getPos(demarrage)}%`, width: `${Math.max(1, getPos(finRevisee || finTheorique) - getPos(demarrage))}%` }} />
            )}
          </div>
          {demarrage && <div className={`absolute top-0 w-2.5 h-5 rounded-full ${c.bg}`} style={{ left: `${getPos(demarrage)}%`, transform: 'translateX(-50%)' }} title={`Démarrage: ${formatDate(demarrage)}`} />}
          {finTheorique && <div className="absolute top-0 w-2.5 h-5 rounded-full bg-emerald-500" style={{ left: `${getPos(finTheorique)}%`, transform: 'translateX(-50%)' }} title={`Fin: ${formatDate(finRevisee || finTheorique)}`} />}
        </div>
      ) : (
        <div className="flex-1 text-[9px] text-gray-400 italic">Pas de dates définies</div>
      )}
      <div className="w-24 shrink-0 text-right">
        <span className="text-[9px] text-gray-500">{demarrage ? formatDate(demarrage) : '—'}</span>
        <span className="text-[9px] text-gray-400 mx-1">→</span>
        <span className="text-[9px] text-gray-500">{finTheorique ? formatDate(finRevisee || finTheorique) : '—'}</span>
      </div>
    </div>
  );
};

// ─── Composant ──────────────────────────────────────────────────────────────
export default function FicheRecap({ fiche, ficheMere, isAlloti, activeGroupeId, groupesAttributaires = [], lots = [], onSave, isSaving }) {
  if (!fiche) return null;

  const D = fiche.sectionD || {};
  const DMere = ficheMere?.sectionD || D;

  // Extraction des données de frise pour la fiche active (ou virtualFiche en alloti)
  const { osList, dateDemarrage, arretData, dateFinTheorique, totalOSHT } = useMemo(
    () => extractTimelineData(fiche, D),
    [fiche, D]
  );

  // Gestion des jours d'intempéries
  const [joursIntemperies, setJoursIntemperies] = useState(D.joursIntemperies || '');

  const handleIntemperiesChange = (e) => {
    setJoursIntemperies(e.target.value);
  };

  const handleIntemperiesBlur = () => {
    if (onSave) {
      const numValue = parseInt(joursIntemperies, 10) || 0;
      if (numValue !== (D.joursIntemperies || 0)) {
        onSave({ ...fiche, sectionD: { ...(fiche.sectionD || {}), joursIntemperies: numValue } });
      }
    }
  };

  const intemperiesValue = parseInt(joursIntemperies, 10) || 0;
  const totalJoursDecalage = intemperiesValue + arretData.totalArretDays;
  const dateFinRevisee = dateFinTheorique ? new Date(dateFinTheorique) : null;
  if (dateFinRevisee) dateFinRevisee.setDate(dateFinRevisee.getDate() + totalJoursDecalage);

  // Données de frise pour toutes les entreprises (vue d'ensemble)
  const allEntrepriseTimelines = useMemo(() => {
    if (!isAlloti || !ficheMere) return [];
    const colors = ['blue', 'emerald', 'amber', 'purple', 'cyan', 'red'];
    return groupesAttributaires.map((groupe, idx) => {
      const exeData = ficheMere.exeParEntreprise?.[groupe.groupeId] || {};
      const virtualExe = { exe1: exeData.exe1 || [] };
      const tData = extractTimelineData(virtualExe, DMere);
      const lotsLabels = (groupe.lotIndices || [])
        .map((i) => lots[i] ? `Lot ${lots[i].numero || i + 1}` : null)
        .filter(Boolean).join(', ');
      return {
        groupeId: groupe.groupeId,
        label: groupe.entreprise?.nomCommercial || '(Entreprise)',
        sublabel: lotsLabels,
        color: colors[idx % colors.length],
        dates: {
          notification: DMere.dateNotification,
          demarrage: tData.dateDemarrage,
          finTheorique: tData.dateFinTheorique,
          finRevisee: null, // Simplifié pour la vue d'ensemble
        },
        isActive: groupe.groupeId === activeGroupeId,
      };
    });
  }, [isAlloti, ficheMere, groupesAttributaires, lots, DMere, activeGroupeId]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      
      {/* ── HEADER & STATS ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-6 rounded-3xl bg-white border border-gray-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 border border-purple-500/20 shadow-inner">
            <FileText size={28} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">{fiche.nom || 'Marché sans nom'}</h2>
            <p className="text-xs text-gray-500 mt-1.5 max-w-xl leading-relaxed line-clamp-2" title={D.objet}>{D.objet || 'Objet non défini'}</p>
            {isAlloti && fiche.sectionB?.mandataire?.nomCommercial && (
              <p className="text-[10px] font-bold text-blue-500 mt-1">
                {fiche.sectionB.mandataire.nomCommercial} — {(D.lots || []).map(l => `Lot ${l.numero || '?'}`).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 relative z-10 shrink-0">
          <div className="flex flex-col px-5 py-3 rounded-2xl bg-gray-100 border border-gray-200 min-w-[140px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5"><Euro size={12}/> Montant (HT)</span>
            <span className="text-lg font-black text-emerald-500">{totalOSHT > 0 ? totalOSHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '-'}</span>
          </div>
          <div className="flex flex-col px-5 py-3 rounded-2xl bg-gray-100 border border-gray-200 min-w-[140px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5"><FileText size={12}/> Ordres de Service</span>
            <span className="text-lg font-black text-gray-800 flex items-baseline gap-2">
              {osList.length} 
              {!dateDemarrage && <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">En attente OS1</span>}
            </span>
          </div>
        </div>
      </div>

      {/* ── FRISE CHRONOLOGIQUE ── */}
      <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xl">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Frise d'exécution
          </h3>
          {totalJoursDecalage > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-full">
              <AlertCircle size={12} /> +{totalJoursDecalage} jours de décalage
            </div>
          )}
        </div>
        <Timeline
          dates={{
            notification: D.dateNotification,
            demarrage: dateDemarrage,
            finTheorique: dateFinTheorique,
            finRevisee: dateFinRevisee,
          }}
          arretEvents={arretData.events}
          arretPeriodes={arretData.periodes}
        />
      </div>

      {/* ── DETAILS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNE GAUCHE : DÉTAIL PLANNING */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
            <Calendar size={12} /> Paramètres de Délai
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-gray-200 flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Durée initiale</span>
              <span className="text-sm font-black text-gray-800">{D.dureeExecution ? `${D.dureeExecution} ${D.uniteDuree || 'mois'}` : '—'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-gray-200 flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1"><Pause size={10} className="text-red-400"/> Jours d'arrêt cumulés</span>
              <span className="text-sm font-black text-red-400">{arretData.totalArretDays} jours</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-200">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CloudSnow size={12} className="text-blue-400"/> Intempéries validées
              </span>
              <span className="text-xs text-gray-500">À imputer sur le délai global</span>
            </div>
            <div className="flex items-center gap-3">
              {isSaving && <Loader size={14} className="animate-spin text-purple-400" />}
              <div className="relative">
                <input type="number" value={joursIntemperies} onChange={handleIntemperiesChange} onBlur={handleIntemperiesBlur} disabled={isSaving} placeholder="0" className="w-24 px-3 py-2 rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-800 text-center font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">j</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : INTERVENANTS */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
            <Building size={12} /> Équipe Projet
          </h3>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center gap-4 hover:bg-gray-100 transition-colors">
              <div className="p-2.5 rounded-xl bg-gray-200 border border-gray-300 shrink-0">
                <Building size={16} className="text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Maître d'Ouvrage</p>
                <p className="text-xs font-bold text-gray-700 truncate">{fiche.sectionA?.designation || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 hover:bg-emerald-500/10 transition-colors">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                <HardHat size={16} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">Titulaire</p>
                <p className="text-xs font-bold text-gray-700 truncate">{fiche.sectionB?.mandataire?.nomCommercial || fiche.sectionB?.mandataire?.denominationSociale || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-4 hover:bg-amber-500/10 transition-colors">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                <Flag size={16} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mb-0.5">Maître d'Œuvre</p>
                <p className="text-xs font-bold text-gray-700 truncate">{fiche.sectionC?.nomCommercial || fiche.sectionC?.denominationSociale || 'Non renseigné'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── VUE D'ENSEMBLE COMPARATIVE (marchés allotis) ── */}
      {isAlloti && allEntrepriseTimelines.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xl">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 mb-4">
            <Activity size={14} className="text-purple-400" /> Vue d'ensemble — Toutes les entreprises
          </h3>
          <div className="space-y-2">
            {allEntrepriseTimelines.map((ent) => (
              <MiniTimeline
                key={ent.groupeId}
                label={ent.label}
                sublabel={ent.sublabel}
                dates={ent.dates}
                color={ent.isActive ? ent.color : 'blue'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}