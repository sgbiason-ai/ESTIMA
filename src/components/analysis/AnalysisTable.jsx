import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Trash2, ChevronRight, AlertTriangle, Info, HelpCircle, TrendingDown, TrendingUp, GitBranch, Plus } from 'lucide-react';
import { formatPrice, normalizeUnitSymbol } from '../../utils/helpers';
import { COMPANY_STYLES } from '../../utils/analysisConstants';
import { computeOABThreshold as calculateOABThreshold, computePriceReference, getEffectiveOffers, getEffectiveVariantOffers, getEffectiveVariantNewItems, getCompanyRabaisPct, getEffectiveConclusion } from '../../utils/analysisCompute';
import OabDetailModal from './OabDetailModal';
import { useNumericDraft } from './useNumericDraft';

// --- SOUS-COMPOSANT : Cellule de Prix ---
// anomaly: { type: 'low' | 'high', z, mean, deltaPct, n } | null
// nego: { initialPu } | null — prix modifié en phase après négociation
// Saisie tamponnée (useNumericDraft) : commit au blur/Entrée, Échap annule.
const PriceCell = ({ value, onChange, style, anomaly, nego = null }) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);
  const draftProps = useNumericDraft({
    value,
    onCommit: onChange,
    onDone: () => setIsEditing(false),
  });

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  let cellClass = style.bg;
  if (anomaly?.type === 'low') {
    cellClass = "bg-amber-100 text-amber-900 border-amber-300 font-bold ring-1 ring-inset ring-amber-300";
  } else if (anomaly?.type === 'high') {
    cellClass = "bg-orange-100 text-orange-900 border-orange-300 font-bold ring-1 ring-inset ring-orange-300";
  } else if (style.isHeatmap) {
    cellClass = style.bg;
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        {...draftProps}
        className="w-full bg-white border border-blue-400 rounded px-1 text-right text-[11px] font-bold text-slate-800 outline-none p-0 tabular-nums tracking-tight shadow-md z-50 relative"
        placeholder="0,00"
      />
    );
  }

  let tooltip = "Cliquer pour modifier";
  if (anomaly) {
    const sign = anomaly.deltaPct > 0 ? '+' : '';
    const label = anomaly.type === 'low' ? 'Anormalement bas' : 'Anormalement haut';
    tooltip = `${label}\nMediane marche: ${formatPrice(anomaly.median)}\nEcart: ${sign}${anomaly.deltaPct.toFixed(0)}%\nBase sur ${anomaly.n} offres`;
  }
  if (nego) {
    tooltip = `Prix négocié\nInitial : ${formatPrice(nego.initialPu)}${anomaly ? '\n' + tooltip : ''}`;
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`w-full h-full min-h-[18px] flex items-center justify-end cursor-text group/cell rounded-sm px-1 transition-all relative ${cellClass}`}
      title={tooltip}
    >
      {anomaly?.type === 'low' && <TrendingDown size={10} className="text-amber-700 absolute left-0.5" />}
      {anomaly?.type === 'high' && <TrendingUp size={10} className="text-orange-700 absolute left-0.5" />}
      {nego && !anomaly && <span className="absolute left-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      <span className={`text-[11px] tabular-nums tracking-tight ${anomaly ? 'font-black' : 'font-medium'} ${!value ? 'text-slate-300 font-normal' : ''}`}>
        {value ? formatPrice(value) : '-'}
      </span>
    </div>
  );
};

// --- SOUS-COMPOSANT : Rabais commercial négo (%) ---
// Composant à part entière (et non un <input> inline dans le .map des colonnes)
// pour pouvoir porter le tampon de saisie useNumericDraft.
const NegoRabaisInput = ({ value, onCommit }) => {
  const draftProps = useNumericDraft({ value: value ?? null, onCommit });
  return (
    <input
      type="text"
      {...draftProps}
      placeholder="0"
      className="w-11 bg-white/15 border border-white/30 rounded px-1 text-right text-[10px] font-bold text-white outline-none focus:ring-1 ring-white/50 tabular-nums placeholder:text-white/40"
      title="Rabais commercial en % consenti sur le Total HT (déduit du montant noté)"
    />
  );
};

// Algorithme OAB (Double Moyenne) : importé depuis analysisCompute (source unique),
// aliasé en calculateOABThreshold pour les sites d'appel existants.

// --- DETECTION ANOMALIE PRIX PAR ARTICLE (mediane + % d'ecart) ---
// Compare chaque prix a la mediane des offres pour cet article. Robuste aux
// petits echantillons (4-6 entreprises) et aux outliers (pas de masking comme
// avec un Z-score classique). Seuil : |ecart a la mediane| > 50%.
// Min 4 offres valides + mediane non nulle.
const calculatePriceMedian = (prices) => {
  const valid = prices.filter(p => p > 0);
  if (valid.length < 4) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  if (median === 0) return null;
  return { median, n: valid.length };
};

const ANOMALY_THRESHOLD = 0.5; // 50% d'ecart a la mediane

const detectPriceAnomaly = (price, stats) => {
  if (!stats || price <= 0) return null;
  const deltaPct = (price - stats.median) / stats.median;
  if (Math.abs(deltaPct) < ANOMALY_THRESHOLD) return null;
  return {
    type: deltaPct < 0 ? 'low' : 'high',
    deltaPct: deltaPct * 100,
    median: stats.median,
    n: stats.n,
  };
};

// --- ALGORITHME HEATMAP ---
const getHeatmapColor = (value, reference) => {
  if (!value || !reference) return '';
  const delta = (value - reference) / reference;
  if (delta > 0.50) return 'bg-red-400 text-white';
  if (delta > 0.25) return 'bg-red-300 text-slate-900';
  if (delta > 0.10) return 'bg-red-200 text-slate-900';
  if (delta > 0.00) return 'bg-red-100 text-slate-900';
  if (delta < -0.50) return 'bg-emerald-400 text-white';
  if (delta < -0.25) return 'bg-emerald-300 text-slate-900';
  if (delta < -0.10) return 'bg-emerald-200 text-slate-900';
  if (delta < 0) return 'bg-emerald-100 text-slate-900';
  return 'bg-slate-50 text-slate-600';
};

/**
 * Reconstitue l'arborescence des sous-chapitres à partir du `groupPath` porté
 * par chaque article (computeChaptersData aplatit l'arbre pour les exports).
 * L'ordre du DQE est préservé : un groupe est inséré à la position de son
 * premier article, donc un article posé directement sous le chapitre après un
 * sous-chapitre reste bien après lui.
 *
 * Noeud : { id, title, entries: [{kind:'item'|'group', ...}], allItems }
 * `allItems` = tous les articles descendants (sous-totaux) ; `entries` = le
 * contenu direct, dans l'ordre.
 */
const buildGroupTree = (items) => {
  const makeNode = (id, title) => ({ id, title, entries: [], byId: new Map(), allItems: [] });
  const root = makeNode(null, '');
  items.forEach(item => {
    let node = root;
    root.allItems.push(item);
    (item.groupPath || []).forEach(seg => {
      let child = node.byId.get(seg.id);
      if (!child) {
        child = makeNode(seg.id, seg.title);
        node.byId.set(seg.id, child);
        node.entries.push({ kind: 'group', node: child });
      }
      child.allItems.push(item);
      node = child;
    });
    node.entries.push({ kind: 'item', item });
  });
  return root;
};

const AnalysisTable = ({
  chaptersData, companies, stats, updateCompanyOffer, renameCompany, removeCompany, project, scoringConfig,
  analysisMode, averagesHorsOAB = {}, negoActive = false, updateCompanyNegoRabais = null,
  updateVariantOffer = null, updateVariantNewItemPrice = null,
  refMap = new Map(),
}) => {

  // COMPANY_STYLES : couleur par entreprise (cycle si plus d'entreprises que de styles).
  // Pour chaque couleur, on définit aussi une version "variant" plus claire
  // (même teinte, moins saturée) pour conserver le lien visuel entre base et variante.
  const COMPANY_STYLES = [
    { name: 'Blue',
      header: 'bg-blue-900',    subHeader: 'bg-blue-800',    bg: 'bg-blue-50/30',    border: 'border-blue-100', input: 'focus:ring-blue-500',
      variantHeader: 'bg-blue-500',    variantSubHeader: 'bg-blue-400',    variantBg: 'bg-blue-50/70',    variantBorder: 'border-blue-200',    variantScoreBg: 'bg-blue-50', variantScoreText: 'text-blue-900' },
    { name: 'Emerald',
      header: 'bg-emerald-900', subHeader: 'bg-emerald-800', bg: 'bg-emerald-50/30', border: 'border-emerald-100', input: 'focus:ring-emerald-500',
      variantHeader: 'bg-emerald-500', variantSubHeader: 'bg-emerald-400', variantBg: 'bg-emerald-50/70', variantBorder: 'border-emerald-200', variantScoreBg: 'bg-emerald-50', variantScoreText: 'text-emerald-900' },
    { name: 'Amber',
      header: 'bg-amber-700',   subHeader: 'bg-amber-600',   bg: 'bg-amber-50/30',   border: 'border-amber-100', input: 'focus:ring-amber-500',
      variantHeader: 'bg-amber-400',   variantSubHeader: 'bg-amber-300',   variantBg: 'bg-amber-50/70',   variantBorder: 'border-amber-200',   variantScoreBg: 'bg-amber-50', variantScoreText: 'text-amber-900' },
    { name: 'Purple',
      header: 'bg-purple-900',  subHeader: 'bg-purple-800',  bg: 'bg-purple-50/30',  border: 'border-purple-100', input: 'focus:ring-purple-500',
      variantHeader: 'bg-purple-500',  variantSubHeader: 'bg-purple-400',  variantBg: 'bg-purple-50/70',  variantBorder: 'border-purple-200',  variantScoreBg: 'bg-purple-50', variantScoreText: 'text-purple-900' },
    { name: 'Rose',
      header: 'bg-rose-900',    subHeader: 'bg-rose-800',    bg: 'bg-rose-50/30',    border: 'border-rose-100', input: 'focus:ring-rose-500',
      variantHeader: 'bg-rose-500',    variantSubHeader: 'bg-rose-400',    variantBg: 'bg-rose-50/70',    variantBorder: 'border-rose-200',    variantScoreBg: 'bg-rose-50', variantScoreText: 'text-rose-900' },
    { name: 'Cyan',
      header: 'bg-cyan-900',    subHeader: 'bg-cyan-800',    bg: 'bg-cyan-50/30',    border: 'border-cyan-100', input: 'focus:ring-cyan-500',
      variantHeader: 'bg-cyan-500',    variantSubHeader: 'bg-cyan-400',    variantBg: 'bg-cyan-50/70',    variantBorder: 'border-cyan-200',    variantScoreBg: 'bg-cyan-50', variantScoreText: 'text-cyan-900' },
  ];

  const COL_WIDTHS = {
    DESIGNATION: '260px', UNIT: '35px', QTY: '55px', EST_PU: '85px', EST_TOTAL: '95px',
    PU: '85px', TOTAL: '95px', PERCENT: '45px',
    QTY_VAR: '55px',   // colonne supplémentaire "Qté variante"
  };

  // Positions sticky pour les colonnes figées (estimation MOE)
  const STICKY = {
    DESIG:     { position: 'sticky', left: 0, zIndex: 10 },
    UNIT:      { position: 'sticky', left: 260, zIndex: 10 },
    QTY:       { position: 'sticky', left: 295, zIndex: 10 },
    EST_PU:    { position: 'sticky', left: 350, zIndex: 10 },
    EST_TOTAL: { position: 'sticky', left: 435, zIndex: 10 },
    // Colonnes avec z-index plus élevé pour le header/footer
    H_DESIG:     { position: 'sticky', left: 0, zIndex: 30 },
    H_UNIT:      { position: 'sticky', left: 260, zIndex: 30 },
    H_QTY:       { position: 'sticky', left: 295, zIndex: 30 },
    H_EST_PU:    { position: 'sticky', left: 350, zIndex: 30 },
    H_EST_TOTAL: { position: 'sticky', left: 435, zIndex: 30 },
  };

  // Numérotation des articles : reçue en prop (refMap de useProjectCalculations,
  // via buildRefMap) — la MÊME que le DQE exporté et les exports PDF/Excel.
  // Ne JAMAIS reconstruire un compteur local « P.n par article » ici : le
  // registre de prix uniques ne consomme un numéro que sur un prix nouveau, un
  // compteur naïf diverge donc dès le premier prix répété et le tableau affiche
  // des numéros qui ne correspondent plus au DQE de l'affaire.

  const renderDelta = (current, reference) => {
    if (!reference || reference === 0 || !current || current === 0) return <span className="text-slate-300">-</span>;
    const delta = ((current - reference) / reference) * 100;
    const isOver = delta > 0;
    if (Math.abs(delta) < 0.1) return <span className="text-slate-300">=</span>;
    return (
      <div className={`font-black text-[9px] ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
        {isOver ? '+' : ''}{delta.toFixed(0)}%
      </div>
    );
  };

  // ─── STATUTS RAO — statut admin par entreprise (irrégulière / inacceptable / inappropriée) ─
  // Source : project.rao.companies[name].admin.conclusion
  // Les statuts non-régulière → exclue de la notation + grisée
  const NON_REGULAR_STATUSES = ['irreguliere', 'inacceptable', 'inappropriee'];
  const getCompanyIrregular = (company) => {
    // Phase après négo : régularisation prise en compte (conclusionNego).
    const conclusion = getEffectiveConclusion(
      project?.rao?.companies?.[company.name]?.admin,
      negoActive ? 'nego' : 'initial'
    );
    return conclusion && NON_REGULAR_STATUSES.includes(conclusion);
  };

  // ─── VARIANTES — chaque entreprise génère N+1 colonnes (1 base + N variantes) ─
  // displayColumns : tableau de { key, companyId, companyIndex, kind: 'base'|'variant',
  //                               variantId, variantLabel, offers, quantities, removedIds, newItems, irregular }
  const displayColumns = useMemo(() => {
    const cols = [];
    companies.forEach((c, ci) => {
      // Le statut admin.conclusion s'applique UNIQUEMENT à l'offre de base.
      // Chaque variante est une offre indépendante (CCP R2151-8) — elle peut être
      // régulière même si la base ne l'est pas (et inversement).
      const baseIrregular = getCompanyIrregular(c);
      // Statut effectif (après négo = régularisation prise en compte) pour le badge.
      const baseIrregularLabel = getEffectiveConclusion(
        project?.rao?.companies?.[c.name]?.admin,
        negoActive ? 'nego' : 'initial'
      );

      // Colonne base — en phase « après négo », les prix négociés se substituent
      // article par article (initialOffers conservé pour le marqueur visuel).
      cols.push({
        key: `${c.id}_base`,
        companyId: c.id,
        companyIndex: ci,
        kind: 'base',
        variantId: null,
        variantLabel: null,
        offers: getEffectiveOffers(c, negoActive ? 'nego' : 'initial'),
        initialOffers: c.offers || {},
        rabaisPct: negoActive ? getCompanyRabaisPct(c, 'nego') : 0,
        quantities: {},
        removedIds: new Set(),
        newItems: [],
        irregular: baseIrregular,
        irregularLabel: baseIrregularLabel,
      });
      // Colonnes variantes — statut indépendant (par défaut régulière)
      (c.variants || []).forEach((v, vi) => {
        // Possibilité future : lire v.adminConclusion pour statut par variante
        const variantConclusion = v.adminConclusion || null;
        const variantIrregular = variantConclusion && NON_REGULAR_STATUSES.includes(variantConclusion);
        cols.push({
          key: `${c.id}_${v.id}`,
          companyId: c.id,
          companyIndex: ci,
          variantIndex: vi,
          kind: 'variant',
          variantId: v.id,
          variantLabel: v.label || `Variante ${vi + 1}`,
          offers: getEffectiveVariantOffers(c, v, negoActive ? 'nego' : 'initial'),
          initialOffers: { ...(c.offers || {}), ...(v.offers || {}) },
          quantities: v.quantities || {},
          removedIds: new Set((v.removedItems || []).map(it => it.itemId)),
          newItems: getEffectiveVariantNewItems(v, negoActive ? 'nego' : 'initial'),
          irregular: variantIrregular,
          irregularLabel: variantConclusion,
        });
      });
    });
    return cols;
  }, [companies, project?.rao?.companies, negoActive]);

  // Largeur sub-colonnes par "displayColumn" : 3 pour base, 4 pour variante (Qté var en plus)
  const subColsCount = (col) => (col.kind === 'variant' ? 4 : 3);

  // Sous-totaux d'un lot d'articles (chapitre ou sous-chapitre) : même règle
  // partout — quantité de la variante si elle en impose une, articles supprimés
  // par la variante exclus.
  const groupEstTotal = (list) => list.reduce((acc, i) => acc + (i.activeQty * i.price), 0);
  const groupTotalsPerColumn = (list) => displayColumns.map(col => list.reduce((acc, i) => {
    if (col.removedIds.has(i.id)) return acc;
    const pu  = Number(col.offers[i.id] || 0);
    const qty = col.quantities[i.id] != null ? Number(col.quantities[i.id]) : i.activeQty;
    return acc + qty * pu;
  }, 0));


  // Total recalculé par displayColumn (utilisé pour totaux footer + scoring)
  const columnTotals = useMemo(() => {
    const totals = {};
    displayColumns.forEach(col => {
      let total = 0;
      chaptersData.forEach(chap => {
        if (chap.isOption) return;
        chap.items.forEach(item => {
          if (col.removedIds.has(item.id)) return;
          const pu = Number(col.offers[item.id] || 0);
          const qty = col.quantities[item.id] != null ? Number(col.quantities[item.id]) : Number(item.activeQty || 0);
          total += pu * qty;
        });
      });
      (col.newItems || []).forEach(it => {
        total += Number(it.lineTotal || (it.qty * it.price) || 0);
      });
      // Rabais commercial (phase négo) : déduit du Total HT de la colonne base.
      if (col.rabaisPct > 0) total *= (1 - col.rabaisPct / 100);
      totals[col.key] = Math.round(total * 100) / 100;
    });
    return totals;
  }, [displayColumns, chaptersData]);

  // Agrégation des articles hors DQE par (ref + désignation) — filtre les qté à 0
  const aggregatedNewItems = useMemo(() => {
    const map = new Map();
    displayColumns.forEach(col => {
      if (col.kind !== 'variant') return;
      (col.newItems || []).forEach(it => {
        const qty = Number(it.qty || 0);
        if (qty === 0) return; // filtrer les articles à qté nulle
        const key = `${(it.ref || '').toLowerCase()}|${(it.designation || '').toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            ref: it.ref || '',
            designation: it.designation || '',
            unit: it.unit || '',
            perColumn: {},
          });
        }
        map.get(key).perColumn[col.key] = {
          qty,
          price: Number(it.price || 0),
          total: Number(it.lineTotal || (qty * it.price) || 0),
          priceInitial: it.priceInitial != null ? Number(it.priceInitial) : null,
          itemId: it.id,
        };
      });
    });
    return [...map.values()];
  }, [displayColumns]);

  const hasAnyNewItems = aggregatedNewItems.length > 0;

  // --- CALCULS GLOBAUX POUR LE PIED DE PAGE ---
  // Réintégration CCP : toutes les offres concourent (régulières ET irrégulières)
  // pour la fourchette Pmin/Pmoy/Pmax (computePriceReference — source unique).
  // Note : l'OAB reste un repère d'analyse propre à ce tableau (heatmap / mode OAB),
  // il n'intervient pas dans le calcul de la note prix.
  const totalsList = displayColumns
    .map(col => columnTotals[col.key] || 0)
    .filter(t => t > 0);
  const { Pmin, Pmoy, Pmax } = computePriceReference(totalsList);

  // Scores par colonne (base + chaque variante) — toutes les offres sont notées ;
  // les irrégulières restent signalées (badge) mais reçoivent une note.
  const columnScores = useMemo(() => {
    if (totalsList.length === 0) return {};
    const N = Number(scoringConfig?.maxScore || 40);
    const mode = scoringConfig?.mode || 'f1';
    const scores = {};
    displayColumns.forEach(col => {
      const P = columnTotals[col.key] || 0;
      if (P <= 0) { scores[col.key] = 0; return; }
      let s = 0;
      switch (mode) {
        case 'f1': s = N * (Pmin / P); break;
        case 'f2': s = N * Math.pow(Pmin / P, 2); break;
        case 'f3': s = N * Math.pow(Pmin / P, 3); break;
        case 'f4': s = N * (1 - (P - Pmin) / Pmin); break;
        case 'f5': s = N * (1 - (P - Pmin) / Pmoy); break;
        case 'f6': s = P <= Pmoy ? N * Math.sqrt(Pmin / P) : N * Math.pow(Pmin / P, 2); break;
        case 'f7': s = Pmax === Pmin ? N : N * (1 - (P - Pmin) / (Pmax - Pmin)); break;
        case 'f8': s = (N * Pmoy) / (Pmoy + P); break;
        case 'f9': s = N * ((2 * Pmin) / (Pmin + P)); break;
        default:   s = 0;
      }
      scores[col.key] = Math.max(0, Math.min(N, s));
    });
    return scores;
  }, [displayColumns, columnTotals, Pmin, Pmoy, Pmax, scoringConfig, totalsList.length]);

  // 2. Calcul du Seuil OAB GLOBAL (sur les totaux des colonnes)
  const globalOABThreshold = useMemo(() => calculateOABThreshold(totalsList), [totalsList]);

  const [oabDetailCompanyId, setOabDetailCompanyId] = useState(null);

  // ─── Repli des chapitres ────────────────────────────────────────────────
  // Sur un DQE de 200+ articles, on commence par comparer les sous-totaux de
  // chapitre (le total du chapitre reste visible) et on ne déplie que les
  // chapitres en écart. Set d'ids repliés.
  const [collapsedChapters, setCollapsedChapters] = useState(() => new Set());
  const allChapterIds = chaptersData.map(c => c.id);
  const allCollapsed = allChapterIds.length > 0 && allChapterIds.every(id => collapsedChapters.has(id));
  // Le même Set porte aussi les sous-chapitres repliés : le compteur ne doit
  // décompter que les chapitres racine.
  const collapsedRootCount = allChapterIds.filter(id => collapsedChapters.has(id)).length;
  const toggleChapter = (id) => setCollapsedChapters(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllChapters = () => setCollapsedChapters(allCollapsed ? new Set() : new Set(allChapterIds));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Barre de contrôle du tableau : repli global des chapitres */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[10px] font-medium text-slate-400">
          {chaptersData.length} chapitre{chaptersData.length > 1 ? 's' : ''}
          {collapsedRootCount > 0 ? ` · ${collapsedRootCount} replié${collapsedRootCount > 1 ? 's' : ''}` : ''}
        </span>
        <button
          type="button"
          onClick={toggleAllChapters}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
        >
          <ChevronRight size={12} className={`transition-transform ${allCollapsed ? '' : 'rotate-90'}`} />
          {allCollapsed ? 'Tout déplier' : 'Tout replier'}
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="border-collapse text-left table-fixed w-full">
          <colgroup>
            <col style={{ width: COL_WIDTHS.DESIGNATION, minWidth: COL_WIDTHS.DESIGNATION }} />
            <col style={{ width: COL_WIDTHS.UNIT, minWidth: COL_WIDTHS.UNIT }} />
            <col style={{ width: COL_WIDTHS.QTY, minWidth: COL_WIDTHS.QTY }} />
            <col style={{ width: COL_WIDTHS.EST_PU, minWidth: COL_WIDTHS.EST_PU }} />
            <col style={{ width: COL_WIDTHS.EST_TOTAL, minWidth: COL_WIDTHS.EST_TOTAL }} />
            {displayColumns.map(col => (
              <React.Fragment key={`col-group-${col.key}`}>
                {col.kind === 'variant' && (
                  <col style={{ width: COL_WIDTHS.QTY_VAR, minWidth: COL_WIDTHS.QTY_VAR }} />
                )}
                <col style={{ width: COL_WIDTHS.PU, minWidth: COL_WIDTHS.PU }} />
                <col style={{ width: COL_WIDTHS.TOTAL, minWidth: COL_WIDTHS.TOTAL }} />
                <col style={{ width: COL_WIDTHS.PERCENT, minWidth: COL_WIDTHS.PERCENT }} />
              </React.Fragment>
            ))}
          </colgroup>

          <thead className="sticky top-0 z-20 shadow-md">
            <tr className="bg-slate-900 text-white">
              <th style={STICKY.H_DESIG} className="px-2 py-1 text-[11px] font-bold uppercase border-r border-slate-700 align-middle tracking-tight bg-slate-900" rowSpan={2}>Désignation</th>
              <th style={STICKY.H_UNIT} className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 text-center align-middle bg-slate-900" rowSpan={2}>U</th>
              <th style={STICKY.H_QTY} className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 text-center align-middle bg-slate-900" rowSpan={2}>Qté</th>
              <th style={STICKY.H_EST_PU} className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 bg-slate-800 text-center align-middle" colSpan={2}>Estimation</th>
              {displayColumns.map(col => {
                const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                const company = companies[col.companyIndex];
                const isFirstColOfCompany = col.kind === 'base';
                const irregularBadge = col.irregular ? (col.irregularLabel || 'IRRÉGULIÈRE').toUpperCase() : null;
                return (
                  <th
                    key={col.key}
                    colSpan={subColsCount(col)}
                    className={`px-1 py-1 border-r border-slate-700 ${
                      col.irregular
                        ? 'bg-slate-500'
                        : col.kind === 'variant' ? style.variantHeader : style.header
                    } relative group align-middle ${col.irregular ? 'opacity-70' : ''}`}
                  >
                    <div className="flex flex-col items-stretch gap-0.5">
                      {isFirstColOfCompany ? (
                        <div className="flex items-center justify-between gap-1">
                          <input
                            value={company.name}
                            onChange={(e) => renameCompany(company.id, e.target.value)}
                            className="bg-transparent border-none focus:ring-1 ring-white/30 rounded px-1 text-white text-[10px] font-bold uppercase outline-none text-center w-full truncate"
                          />
                          <button onClick={() => removeCompany(company.id)} className="text-red-300 hover:text-red-100 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1"><Trash2 size={10} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 px-1 text-white text-[10px] font-bold uppercase truncate" title={col.variantLabel}>
                          <GitBranch size={9} />
                          <span className="truncate">{company.name} · V{col.variantIndex + 1}</span>
                        </div>
                      )}
                      <div className={`text-[9px] uppercase text-center font-semibold tracking-wider ${
                        col.irregular ? 'text-red-200' :
                        col.kind === 'variant' ? 'text-white/90' : 'text-white/70'
                      }`}>
                        {irregularBadge ? (
                          <span className="px-1 py-0.5 bg-red-600 text-white rounded font-black animate-pulse" title="Offre exclue de la notation">
                            ⚠ {irregularBadge}
                          </span>
                        ) : col.kind === 'variant'
                          ? <span title={col.variantLabel}>Variante {col.variantLabel ? `· ${col.variantLabel.slice(0, 20)}` : ''}</span>
                          : 'Base'}
                      </div>
                      {/* Rabais commercial (%) sur le Total HT — phase après négo uniquement */}
                      {negoActive && col.kind === 'base' && updateCompanyNegoRabais && (
                        <div className="flex items-center justify-center gap-1 text-[9px] text-white/90 font-semibold">
                          <span className="uppercase tracking-wider">Rabais</span>
                          <NegoRabaisInput
                            value={company.negoRabaisPct}
                            onCommit={(v) => updateCompanyNegoRabais(company.id, v)}
                          />
                          <span>%</span>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-slate-800 text-slate-300 border-b border-slate-600">
              <th style={STICKY.H_EST_PU} className="py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-slate-400 bg-slate-800">P.U.</th>
              <th style={STICKY.H_EST_TOTAL} className="py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white bg-slate-700/50">Total</th>
              {displayColumns.map(col => {
                const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                const subBg = col.irregular
                  ? 'bg-slate-600'
                  : col.kind === 'variant' ? style.variantSubHeader : style.subHeader;
                const opacityCls = col.irregular ? 'opacity-70' : '';
                return (
                  <React.Fragment key={`sub-header-${col.key}`}>
                    {col.kind === 'variant' && (
                      <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-amber-300 ${subBg} ${opacityCls}`} title="Quantité variante">Qté var</th>
                    )}
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white/70 ${subBg} ${opacityCls}`}>P.U.</th>
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white ${subBg} brightness-110 ${opacityCls}`}>Total</th>
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white/70 ${subBg} ${opacityCls}`}>%</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-slate-100">
            {chaptersData.map((chapter) => {
              const chapEstTotal           = groupEstTotal(chapter.items);
              const chapterTotalsPerColumn = groupTotalsPerColumn(chapter.items);
              const chapterOABThreshold = (analysisMode === 'oab') ? calculateOABThreshold(chapterTotalsPerColumn) : 0;

              const isCollapsed = collapsedChapters.has(chapter.id);
              const groupTree = buildGroupTree(chapter.items);

              // Ligne d'article : identique quelle que soit sa profondeur.
              const renderItemRow = (item) => {
                    const itemPrices = displayColumns.map(col => col.offers[item.id] || 0);
                    const medianStats = (analysisMode === 'oab') ? calculatePriceMedian(itemPrices) : null;

                    return (
                      <tr key={item.id} className="hover:bg-slate-100 transition-colors group">
                        <td style={STICKY.DESIG} className="px-2 py-1 border-r border-slate-100 align-middle bg-white">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded border border-slate-200 shrink-0 tabular-nums">{refMap.get(item.id)}</span>
                            <span className="text-[11px] font-semibold text-slate-700 uppercase truncate" title={item.designation}>{item.designation}</span>
                          </div>
                        </td>
                        <td style={STICKY.UNIT} className="px-1 py-1 text-center border-r border-slate-100 text-[10px] font-semibold text-slate-500 bg-white">{normalizeUnitSymbol(item.unit)}</td>
                        <td style={STICKY.QTY} className="px-1 py-1 text-center border-r border-slate-100 text-[11px] font-medium text-slate-800 bg-slate-50 tabular-nums">{item.activeQty}</td>
                        <td style={STICKY.EST_PU} className="px-1 py-1 text-right border-r border-slate-100 align-middle bg-white">
                          <div className="text-[11px] text-slate-500 tabular-nums tracking-tight font-medium">{formatPrice(item.price)}</div>
                          {averagesHorsOAB[item.id] && (
                            <div className="text-[9px] font-bold text-violet-600 tabular-nums mt-0.5" title={`Moyenne hors OAB (${averagesHorsOAB[item.id].count}/${averagesHorsOAB[item.id].total} offres)`}>
                              ⌀ {formatPrice(averagesHorsOAB[item.id].avg)}
                            </div>
                          )}
                        </td>
                        <td style={STICKY.EST_TOTAL} className="px-1 py-1 text-right border-r border-slate-200 text-[11px] font-bold text-slate-700 bg-slate-50 tabular-nums tracking-tight shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{formatPrice(item.price * item.activeQty)}</td>

                        {displayColumns.map(col => {
                          const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                          const isVariant = col.kind === 'variant';
                          const isRemoved = col.removedIds.has(item.id);
                          const variantQty = col.quantities[item.id];
                          const activeQty = variantQty != null ? Number(variantQty) : item.activeQty;
                          const pu = isRemoved ? 0 : Number(col.offers[item.id] || 0);
                          const lineTotal = isRemoved ? 0 : (activeQty * pu);
                          const lineEst = item.activeQty * item.price;

                          let cellBg = isVariant ? style.variantBg : style.bg;
                          let anomaly = null;

                          if (col.irregular) {
                            // Offre irrégulière : grisée, pas d'anomalie ni heatmap
                            cellBg = 'bg-slate-100';
                          } else if (isRemoved) {
                            cellBg = 'bg-slate-100';
                          } else if (analysisMode === 'heatmap' && pu > 0) {
                            cellBg = getHeatmapColor(pu, item.price);
                            style.isHeatmap = true;
                          } else if (analysisMode === 'oab' && pu > 0) {
                            anomaly = detectPriceAnomaly(pu, medianStats);
                          }

                          const totalCellClass =
                            col.irregular            ? 'bg-slate-100 text-slate-400' :
                            isRemoved                ? 'bg-slate-100 text-slate-400 line-through' :
                            anomaly?.type === 'low'  ? 'bg-amber-100 text-amber-900 font-black' :
                            anomaly?.type === 'high' ? 'bg-orange-100 text-orange-900 font-black' :
                            cellBg + ' font-bold text-slate-700';

                          const borderCls = isVariant ? style.variantBorder : style.border;
                          // Grisage transversal des colonnes irrégulières
                          const irregularOpacity = col.irregular ? 'opacity-60' : '';

                          return (
                            <React.Fragment key={`${col.key}-${item.id}`}>
                              {/* Colonne Qté variante (uniquement pour les variantes) */}
                              {isVariant && (
                                <td className={`px-1 py-1 text-center border-r ${borderCls} text-[11px] tabular-nums ${irregularOpacity} ${
                                  col.irregular ? 'bg-slate-100 text-slate-400' :
                                  isRemoved ? 'bg-slate-100 text-slate-400 line-through' :
                                  (variantQty != null && Number(variantQty) !== item.activeQty)
                                    ? 'bg-amber-50 text-amber-800 font-bold'
                                    : `${style.variantBg} text-slate-600`
                                }`}>
                                  {isRemoved ? '—' : activeQty}
                                </td>
                              )}
                              <td className={`px-0.5 py-1 border-r ${borderCls} ${anomaly ? '' : cellBg} transition-colors duration-300 relative ${irregularOpacity}`}>
                                {isRemoved ? (
                                  <div className="text-[10px] text-slate-400 italic text-center">supprimé</div>
                                ) : isVariant ? (
                                  <PriceCell
                                    value={pu}
                                    onChange={(val) => updateVariantOffer?.(col.companyId, col.variantId, item.id, val)}
                                    style={{...style, bg: cellBg}}
                                    anomaly={anomaly}
                                    nego={negoActive && Number(col.initialOffers?.[item.id] || 0) !== pu
                                      ? { initialPu: Number(col.initialOffers?.[item.id] || 0) }
                                      : null}
                                  />
                                ) : (
                                  <PriceCell
                                    value={pu}
                                    onChange={(val) => updateCompanyOffer(col.companyId, item.id, val)}
                                    style={{...style, bg: cellBg}}
                                    anomaly={anomaly}
                                    nego={negoActive && Number(col.initialOffers?.[item.id] || 0) !== pu
                                      ? { initialPu: Number(col.initialOffers?.[item.id] || 0) }
                                      : null}
                                  />
                                )}
                              </td>
                              <td className={`px-1 py-1 text-right border-r ${borderCls} ${totalCellClass} text-[11px] tabular-nums tracking-tight transition-colors duration-300 ${irregularOpacity}`}>
                                {isRemoved ? <span>—</span> : (lineTotal !== 0 ? formatPrice(lineTotal) : <span className="text-slate-400">-</span>)}
                              </td>
                              <td className={`px-0.5 py-1 text-center border-r border-slate-200 ${cellBg} transition-colors duration-300 ${irregularOpacity}`}>
                                {isRemoved ? <span className="text-slate-300">-</span> : renderDelta(lineTotal, lineEst)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
              };

              // Contenu d'un chapitre / sous-chapitre : articles et sous-groupes
              // dans l'ordre du DQE, chaque sous-groupe avec son entête repliable
              // et son sous-total. Récursif : profondeur non bornée.
              const renderEntries = (node, depth) => node.entries.map(entry => {
                if (entry.kind === 'item') return renderItemRow(entry.item);

                const g          = entry.node;
                const gCollapsed = collapsedChapters.has(g.id);
                const gEstTotal  = groupEstTotal(g.allItems);
                const gTotals    = groupTotalsPerColumn(g.allItems);
                const nb         = g.allItems.length;

                return (
                  <React.Fragment key={`grp-${g.id}`}>
                    <tr
                      className="bg-slate-50 border-y border-slate-100 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                      onClick={() => toggleChapter(g.id)}
                      title={gCollapsed ? 'Déplier le sous-chapitre' : 'Replier le sous-chapitre'}
                    >
                      <td colSpan={5} style={STICKY.DESIG} className="px-2 py-1 bg-slate-50">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: 10 + depth * 14 }}>
                          <span className="w-0.5 self-stretch bg-slate-300 rounded shrink-0" />
                          <ChevronRight size={12} className={`text-slate-400 shrink-0 transition-transform ${gCollapsed ? '' : 'rotate-90'}`} />
                          <span className="text-[10px] font-bold uppercase text-slate-600 truncate">{g.title}</span>
                          {gCollapsed && (
                            <span className="text-[9px] font-bold text-slate-400 normal-case shrink-0">({nb} article{nb > 1 ? 's' : ''} replié{nb > 1 ? 's' : ''})</span>
                          )}
                        </div>
                      </td>
                      {displayColumns.map(col => (
                        <td key={`sub-${g.id}-${col.key}`} colSpan={subColsCount(col)} className="bg-slate-50" />
                      ))}
                    </tr>

                    {!gCollapsed && renderEntries(g, depth + 1)}

                    {/* Sous-total : visible même replié, c'est la valeur qu'on compare */}
                    <tr className="border-b border-slate-100">
                      <td colSpan={4} style={STICKY.DESIG} className="px-2 py-0.5 text-right text-[9px] font-bold uppercase text-slate-400 tracking-tight border-r border-slate-200 bg-slate-50">Total {g.title}</td>
                      <td style={STICKY.EST_TOTAL} className="px-1 py-0.5 text-right border-r border-slate-200 text-[10px] font-bold text-slate-600 bg-slate-100/70 tabular-nums shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{formatPrice(gEstTotal)}</td>
                      {displayColumns.map((col, ci) => {
                        const style     = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                        const isVariant = col.kind === 'variant';
                        const cellBg    = col.irregular ? 'bg-slate-100' : style.bg;
                        const borderCls = isVariant ? style.variantBorder : style.border;
                        const irregularOpacity = col.irregular ? 'opacity-60' : '';

                        return (
                          <React.Fragment key={`total-sub-${g.id}-${col.key}`}>
                            {isVariant && <td className={`border-r ${borderCls} ${col.irregular ? 'bg-slate-100' : style.variantBg} ${irregularOpacity}`} />}
                            <td className={`border-r ${borderCls} ${cellBg} ${irregularOpacity}`} />
                            <td className={`px-1 py-0.5 text-right border-r ${borderCls} ${cellBg} text-[10px] font-bold text-slate-600 tabular-nums ${irregularOpacity}`}>
                              {formatPrice(gTotals[ci])}
                            </td>
                            <td className={`px-0.5 py-0.5 text-center border-r border-slate-200 ${cellBg} ${irregularOpacity}`}>
                              {renderDelta(gTotals[ci], gEstTotal)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              });

              return (
                <React.Fragment key={chapter.id}>
                  <tr
                    className="bg-slate-50 border-y border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => toggleChapter(chapter.id)}
                    title={isCollapsed ? 'Déplier le chapitre' : 'Replier le chapitre'}
                  >
                    <td colSpan={5} style={STICKY.DESIG} className="px-2 py-1.5 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <ChevronRight size={14} className={`text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                        <span className="text-[11px] font-bold uppercase text-slate-800 truncate">{chapter.title}</span>
                        {isCollapsed && (
                          <span className="text-[9px] font-bold text-slate-400 normal-case">({chapter.items.length} article{chapter.items.length > 1 ? 's' : ''} replié{chapter.items.length > 1 ? 's' : ''})</span>
                        )}
                      </div>
                    </td>
                    {displayColumns.map(col => (
                      <td key={`chap-${col.key}`} colSpan={subColsCount(col)} className="bg-slate-50" />
                    ))}
                  </tr>

                  {!isCollapsed && renderEntries(groupTree, 0)}

                  <tr className="bg-slate-100 border-t border-slate-200 border-b">
                    <td colSpan={4} style={STICKY.DESIG} className="px-2 py-1 text-right text-[10px] font-bold uppercase text-slate-500 tracking-tight border-r border-slate-200 bg-slate-100">Total {chapter.title}</td>
                    <td style={STICKY.EST_TOTAL} className="px-1 py-1 text-right border-r border-slate-200 text-[11px] font-black text-slate-700 bg-slate-200/50 tabular-nums shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{formatPrice(chapEstTotal)}</td>
                    {displayColumns.map((col, ci) => {
                      const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                      const isVariant = col.kind === 'variant';
                      const chapCompTotal = chapterTotalsPerColumn[ci];
                      
                      let cellBg = style.bg;
                      let isChapOAB = false;

                      if (col.irregular) {
                        cellBg = 'bg-slate-100';
                      } else if (analysisMode === 'heatmap' && chapCompTotal > 0) {
                        cellBg = getHeatmapColor(chapCompTotal, chapEstTotal);
                      } else if (analysisMode === 'oab' && chapCompTotal > 0) {
                         isChapOAB = chapCompTotal < chapterOABThreshold;
                      }

                      const borderCls = isVariant ? style.variantBorder : style.border;
                      const irregularOpacity = col.irregular ? 'opacity-60' : '';

                      return (
                        <React.Fragment key={`total-chap-${col.key}`}>
                          {/* Cellule Qté var pour les variantes */}
                          {isVariant && <td className={`border-r ${borderCls} ${col.irregular ? 'bg-slate-100' : style.variantBg} ${irregularOpacity}`}></td>}
                          <td className={`border-r ${borderCls} ${isChapOAB ? 'bg-amber-100' : cellBg} ${irregularOpacity}`}></td>
                          <td className={`px-1 py-1 text-right border-r ${borderCls} text-[11px] tabular-nums ${irregularOpacity} ${
                            col.irregular ? 'bg-slate-100 text-slate-400' :
                            isChapOAB ? 'bg-amber-100 text-amber-900 font-black ring-1 ring-inset ring-amber-300' :
                            `${cellBg} font-black text-slate-800`
                          }`}>
                            <div className="flex items-center justify-end gap-1">
                              {isChapOAB && !col.irregular && <AlertTriangle size={10} className="text-amber-600" />}
                              {formatPrice(chapCompTotal)}
                            </div>
                          </td>
                          <td className={`px-0.5 py-1 text-center border-r border-slate-300 ${cellBg} ${irregularOpacity}`}>
                            {renderDelta(chapCompTotal, chapEstTotal)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          {/* --- ARTICLES HORS DQE (ajoutés par des variantes) --- */}
          {hasAnyNewItems && (
            <tbody className="bg-emerald-50/40 border-y-2 border-emerald-200">
              <tr className="bg-emerald-100 border-y border-emerald-200">
                <td colSpan={5} style={STICKY.DESIG} className="px-2 py-1.5 bg-emerald-100">
                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-emerald-700" />
                    <span className="text-[11px] font-bold uppercase text-emerald-900 tracking-tight">
                      Articles hors DQE (ajoutés par variantes)
                    </span>
                  </div>
                </td>
                {displayColumns.map(col => (
                  <td key={`hdr-new-${col.key}`} colSpan={subColsCount(col)} className="bg-emerald-100" />
                ))}
              </tr>

              {/* Lignes : articles hors DQE agrégés (qté > 0 uniquement) */}
              {aggregatedNewItems.map((row, ri) => (
                  <tr key={`new-${ri}`} className="hover:bg-emerald-50 transition-colors">
                    <td style={STICKY.DESIG} className="px-2 py-1 border-r border-emerald-100 align-middle bg-emerald-50/40">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-200 shrink-0 tabular-nums">
                          {row.ref || '+'}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-900 uppercase truncate" title={row.designation}>
                          {row.designation}
                        </span>
                      </div>
                    </td>
                    <td style={STICKY.UNIT} className="px-1 py-1 text-center border-r border-emerald-100 text-[10px] font-semibold text-emerald-700 bg-emerald-50/40">
                      {normalizeUnitSymbol(row.unit)}
                    </td>
                    <td style={STICKY.QTY} className="px-1 py-1 text-center border-r border-emerald-100 text-[11px] text-emerald-700 bg-emerald-50/40 tabular-nums">
                      —
                    </td>
                    <td style={STICKY.EST_PU} colSpan={2} className="px-1 py-1 text-right border-r border-emerald-200 text-[10px] italic text-emerald-600 bg-emerald-50/40 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Hors estimation MOE
                    </td>
                    {displayColumns.map(col => {
                      const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                      const isVariant = col.kind === 'variant';
                      const borderCls = isVariant ? style.variantBorder : style.border;
                      const cell = row.perColumn[col.key];

                      // Pour les colonnes BASE : pas d'article hors DQE — cellules grisées
                      if (!isVariant) {
                        return (
                          <React.Fragment key={`new-${ri}-${col.key}`}>
                            <td className={`px-0.5 py-1 border-r ${borderCls} bg-slate-50/50 text-center text-slate-300 text-[10px]`}>—</td>
                            <td className={`px-1 py-1 text-right border-r ${borderCls} bg-slate-50/50 text-slate-300 text-[10px]`}>—</td>
                            <td className={`px-0.5 py-1 text-center border-r border-slate-200 bg-slate-50/50`}></td>
                          </React.Fragment>
                        );
                      }
                      // Variante avec article hors DQE
                      if (cell) {
                        const isNego = cell.priceInitial != null && cell.priceInitial !== cell.price;
                        return (
                          <React.Fragment key={`new-${ri}-${col.key}`}>
                            <td className={`px-1 py-1 text-center border-r ${borderCls} bg-emerald-100 text-[11px] font-bold text-emerald-800 tabular-nums`}>
                              {cell.qty}
                            </td>
                            <td className={`px-0.5 py-1 border-r ${borderCls} bg-emerald-50 relative`}>
                              <PriceCell
                                value={cell.price}
                                onChange={(val) => updateVariantNewItemPrice?.(col.companyId, col.variantId, cell.itemId, val)}
                                style={{ bg: 'bg-emerald-50' }}
                                nego={isNego ? { initialPu: cell.priceInitial } : null}
                              />
                            </td>
                            <td className={`px-1 py-1 text-right border-r ${borderCls} bg-emerald-100 text-[11px] font-black text-emerald-800 tabular-nums`}>
                              {formatPrice(cell.total)}
                            </td>
                            <td className={`px-0.5 py-1 text-center border-r border-slate-200 bg-emerald-50`}>
                              <span className="text-[9px] font-bold text-emerald-700">+</span>
                            </td>
                          </React.Fragment>
                        );
                      }
                      // Variante sans cet article hors DQE
                      return (
                        <React.Fragment key={`new-${ri}-${col.key}`}>
                          <td className={`px-1 py-1 text-center border-r ${borderCls} bg-slate-50/50 text-slate-300 text-[10px]`}>—</td>
                          <td className={`px-0.5 py-1 border-r ${borderCls} bg-slate-50/50 text-center text-slate-300 text-[10px]`}>—</td>
                          <td className={`px-1 py-1 text-right border-r ${borderCls} bg-slate-50/50 text-slate-300 text-[10px]`}>—</td>
                          <td className={`px-0.5 py-1 text-center border-r border-slate-200 bg-slate-50/50`}></td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
              ))}
            </tbody>
          )}

          {/* --- PIED DE TABLEAU --- */}
          <tfoot className="sticky bottom-0 z-20 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.15)]">
            <tr className="bg-slate-900 text-white">
              <td colSpan={4} style={STICKY.H_DESIG} className="px-2 py-2 text-right text-[11px] font-black uppercase border-r border-slate-700 bg-slate-900">
                <div className="flex items-center justify-end gap-2">
                  <span>Total Général HT</span>
                  {/* AFFICHAGE DU SEUIL OAB GLOBAL */}
                  {analysisMode === 'oab' && globalOABThreshold > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 rounded text-[9px] text-amber-300 lowercase font-mono">
                      <Info size={10} />
                      seuil oab: {formatPrice(globalOABThreshold)}
                    </div>
                  )}
                </div>
              </td>
              <td style={STICKY.H_EST_TOTAL} className="px-1 py-2 text-right border-r border-slate-700 text-xs font-black bg-slate-800 text-white tabular-nums shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">{formatPrice(stats.totalEstimation)}</td>
              {displayColumns.map(col => {
                const total = columnTotals[col.key] || 0;
                const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                const isVariant = col.kind === 'variant';
                const bgCls = col.irregular
                  ? 'bg-slate-600'
                  : isVariant ? style.variantHeader : style.header;
                const opacityCls = col.irregular ? 'opacity-60' : '';

                const isGlobalOAB = !col.irregular && (analysisMode === 'oab') && total > 0 && total < globalOABThreshold;

                return (
                  <React.Fragment key={`footer-${col.key}`}>
                    {/* Cellule Qté var pour les variantes */}
                    {isVariant && <td className={`border-r border-slate-800 ${bgCls} opacity-80 ${opacityCls}`}></td>}
                    <td className={`border-r border-slate-800 ${bgCls} opacity-80 ${opacityCls}`}></td>
                    <td className={`px-1 py-2 text-right border-r border-slate-800 text-xs tabular-nums ${bgCls} ${opacityCls} ${isGlobalOAB ? 'bg-amber-500 text-white font-black ring-2 ring-inset ring-amber-300 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]' : 'font-black text-white'}`}>
                       <div className="flex items-center justify-end gap-1">
                          {isGlobalOAB && <AlertTriangle size={12} className="text-white animate-pulse" />}
                          {col.irregular ? (
                            <span title="Offre irrégulière — classée sous réserve de régularisation (CCP R2152-2)">{formatPrice(total)}</span>
                          ) : formatPrice(total)}
                          {analysisMode === 'oab' && total > 0 && !isVariant && !col.irregular && (
                            <button
                              onClick={() => setOabDetailCompanyId(col.companyId)}
                              className={`ml-0.5 p-0.5 rounded hover:bg-white/20 transition-colors ${isGlobalOAB ? 'text-white' : 'text-white/50 hover:text-white'}`}
                              title="Détail du calcul OAB"
                            >
                              <HelpCircle size={12} />
                            </button>
                          )}
                        </div>
                        {col.rabaisPct > 0 && (
                          <div className="text-[8px] font-bold text-emerald-300 text-right tracking-wide" title="Total HT net après rabais commercial">
                            dont rabais −{col.rabaisPct}%
                          </div>
                        )}
                    </td>
                    <td className={`px-0.5 py-2 text-center border-r border-slate-800 bg-slate-900 ${opacityCls}`}>
                      {renderDelta(total, stats.totalEstimation)}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            <tr className="bg-amber-100 text-amber-900 border-t-2 border-slate-900">
              <td colSpan={4} style={STICKY.H_DESIG} className="px-2 py-2 text-right border-r border-amber-200 bg-amber-100">
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black uppercase tracking-tight">Note Prix / {scoringConfig?.maxScore || 40}</span>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-amber-700 mt-0.5 opacity-80">
                     <span title="Offre la moins disante">p-min: <b>{formatPrice(Pmin)}</b></span>
                     <span className="opacity-30">|</span>
                     <span title="Moyenne des offres">moy: <b>{formatPrice(Pmoy)}</b></span>
                  </div>
                </div>
              </td>
              <td style={STICKY.H_EST_TOTAL} className="px-1 py-2 bg-amber-200 border-r border-amber-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"></td>
              
              {displayColumns.map(col => {
                const score = columnScores[col.key];
                const total = columnTotals[col.key] || 0;
                const isVariant = col.kind === 'variant';
                const style = COMPANY_STYLES[col.companyIndex % COMPANY_STYLES.length];
                const tooltipText = col.irregular
                  ? `Offre ${(col.irregularLabel || 'Non régulière').toUpperCase()}\nNotée et classée SOUS RÉSERVE de régularisation (CCP R2152-2)\nFormule: ${scoringConfig.mode.toUpperCase()} — P: ${formatPrice(total)} — Pmin: ${formatPrice(Pmin)}`
                  : `Formule: ${scoringConfig.mode.toUpperCase()}\nP (Offre): ${formatPrice(total)}${col.rabaisPct > 0 ? `\nRabais commercial: −${col.rabaisPct}% (P = total net)` : ''}\nPmin (Bas): ${formatPrice(Pmin)}\nMoyenne: ${formatPrice(Pmoy)}\nNote Max: ${scoringConfig.maxScore}${isVariant ? '\n— Variante : ' + (col.variantLabel || '') : ''}`;
                const isMin = total > 0 && total === Pmin;

                return (
                  <React.Fragment key={`score-${col.key}`}>
                    <td colSpan={subColsCount(col)} className={`px-1 py-2 text-center border-r text-sm font-black tabular-nums relative group cursor-help transition-colors ${
                      col.irregular ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      isVariant ? `${style.variantScoreBg} ${style.variantScoreText} hover:brightness-95 border-amber-200` :
                      'text-amber-900 hover:bg-amber-200 border-amber-200'
                    } ${isMin ? 'ring-2 ring-inset ring-emerald-400' : ''}`}>
                      {score != null ? score.toFixed(2) : '0.00'}
                      {col.irregular && <div className="text-[8px] font-bold text-rose-600 uppercase tracking-wider">Sous réserve</div>}
                      {isMin && !col.irregular && <div className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider">Moins-disant</div>}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-pre-line font-normal text-left border border-slate-600">
                        <div className="font-bold border-b border-slate-600 pb-1 mb-1 text-center text-amber-400">Détail du calcul</div>
                        {tooltipText}
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {oabDetailCompanyId && (
        <OabDetailModal
          companies={companies}
          companiesTotals={stats.companiesTotals}
          targetCompanyId={oabDetailCompanyId}
          onClose={() => setOabDetailCompanyId(null)}
        />
      )}
    </div>
  );
};

export default AnalysisTable;