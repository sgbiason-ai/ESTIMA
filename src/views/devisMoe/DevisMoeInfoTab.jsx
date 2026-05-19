// src/views/devisMoe/DevisMoeInfoTab.jsx
// Onglet Informations — identification, client, type MOE, entreprises
import React from 'react';
import { Trash2, User, Crown, Users, UserPlus } from 'lucide-react';
import { createEmptyCotraitant, COTRAITANT_COLORS, getCategoriesForAssignee } from '../../hooks/useDevisMoe';
import { isNestedTemps } from '../../utils/devisMoeCalculations';
import { Card, iCls } from './devisMoeHelpers';

export default function DevisMoeInfoTab({ draft, onChange }) {
  const set = (path, val) => {
    const [k1, k2] = path.split('.');
    if (!k2) return onChange({ ...draft, [k1]: val });
    onChange({ ...draft, [k1]: { ...draft[k1], [k2]: val } });
  };

  const moeType = draft.moeType || 'seul';
  const cotraitants = draft.cotraitants || [];

  const setMoeType = (newType) => {
    const updates = { ...draft, moeType: newType };
    const catIds = (draft.categories || []).map(c => c.id);
    if (newType === 'seul' && cotraitants.length > 0) {
      updates.cotraitants = [];
      updates.lots = (draft.lots || []).map(l => ({ ...l, assigneA: 'mandataire' }));
    }
    if (newType === 'cotraitant' && moeType !== 'cotraitant') {
      updates.cotraitants = [];
      updates.lots = (draft.lots || []).map(l => ({ ...l, assigneA: l.assigneA === 'mandataire' ? 'mandataire' : 'notreEntreprise' }));
      // Migration temps passé : flat → nested avec clés mandataire + notreEntreprise
      updates.taches = (draft.taches || []).map(t => {
        if (!isNestedTemps(t.temps, catIds)) {
          return { ...t, temps: { mandataire: { ...(t.temps || {}) }, notreEntreprise: {} } };
        }
        // Déjà nested (depuis mode mandataire) : ajouter clé notreEntreprise si absente
        return { ...t, temps: { ...t.temps, notreEntreprise: t.temps?.notreEntreprise || {} } };
      });
      // Initialiser categoriesParMembre pour les deux membres
      const baseCats = (draft.categories || []).map(c => ({ ...c }));
      updates.categoriesParMembre = {
        ...(draft.categoriesParMembre || {}),
        mandataire: draft.categoriesParMembre?.mandataire || baseCats,
        notreEntreprise: draft.categoriesParMembre?.notreEntreprise || baseCats.map(c => ({ ...c })),
      };
    }
    if ((moeType === 'cotraitant') && newType !== 'cotraitant') {
      updates.mandataire = { ...(draft.notreEntreprise || draft.mandataire) };
    }
    // Migration temps passé : flat → nested quand on passe en mandataire
    if (newType === 'mandataire' && moeType !== 'mandataire') {
      const tachesBase = updates.taches || draft.taches || [];
      updates.taches = tachesBase.map(t => {
        if (!isNestedTemps(t.temps, catIds)) {
          return { ...t, temps: { mandataire: { ...(t.temps || {}) } } };
        }
        // Déjà nested (depuis cotraitant) : nettoyer clé notreEntreprise
        const { notreEntreprise: _, ...rest } = t.temps || {};
        return { ...t, temps: rest };
      });
      // Initialiser categoriesParMembre avec les catégories globales pour le mandataire
      if (!draft.categoriesParMembre?.mandataire) {
        updates.categoriesParMembre = { ...(updates.categoriesParMembre || draft.categoriesParMembre || {}), mandataire: (draft.categories || []).map(c => ({ ...c })) };
      }
    }
    // Migration temps passé : nested → flat quand on quitte mandataire ou cotraitant vers seul
    if (newType === 'seul') {
      const tachesBase = updates.taches || draft.taches || [];
      updates.taches = tachesBase.map(t => {
        if (isNestedTemps(t.temps, catIds)) {
          // Garder les données notreEntreprise (heures de l'utilisateur) si depuis cotraitant, sinon mandataire
          const src = moeType === 'cotraitant' ? (t.temps?.notreEntreprise || t.temps?.mandataire || {}) : (t.temps?.mandataire || {});
          return { ...t, temps: { ...src } };
        }
        return t;
      });
    }
    onChange(updates);
  };

  const addCotraitant = () => {
    if (cotraitants.length >= 3) return;
    const newCot = createEmptyCotraitant();
    const catIds = (draft.categories || []).map(c => c.id);
    // Ajouter la clé du nouveau cotraitant dans chaque tâche existante (format nested)
    const updatedTaches = (draft.taches || []).map(t => {
      if (isNestedTemps(t.temps, catIds)) {
        return { ...t, temps: { ...t.temps, [newCot.id]: {} } };
      }
      return t;
    });
    // Copier les catégories du mandataire comme base pour le nouveau co-traitant
    const mandCats = getCategoriesForAssignee(draft, 'mandataire');
    const newCatsParMembre = { ...(draft.categoriesParMembre || {}), [newCot.id]: mandCats.map(c => ({ ...c })) };
    onChange({ ...draft, cotraitants: [...cotraitants, newCot], taches: updatedTaches, categoriesParMembre: newCatsParMembre });
  };

  const removeCotraitant = (id) => {
    const catIds = (draft.categories || []).map(c => c.id);
    // Retirer la clé du cotraitant de chaque tâche
    const updatedTaches = (draft.taches || []).map(t => {
      if (isNestedTemps(t.temps, catIds) && t.temps[id]) {
        const { [id]: _, ...rest } = t.temps;
        return { ...t, temps: rest };
      }
      return t;
    });
    // Retirer les catégories du cotraitant
    const { [id]: _removedCats, ...restCatsParMembre } = (draft.categoriesParMembre || {});
    onChange({
      ...draft,
      cotraitants: cotraitants.filter(c => c.id !== id),
      lots: (draft.lots || []).map(l => l.assigneA === id ? { ...l, assigneA: 'mandataire' } : l),
      taches: updatedTaches,
      categoriesParMembre: restCatsParMembre,
    });
  };

  const updateCotraitant = (id, field, val) => {
    onChange({ ...draft, cotraitants: cotraitants.map(c => c.id === id ? { ...c, [field]: val } : c) });
  };

  const EntrepriseCard = ({ title, data, dataKey, badge, accent }) => (
    <Card title={title} accent={accent}>
      {badge && <div className="mb-3">{badge}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Raison sociale</label>
          <input className={iCls} value={data?.nom || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, nom: e.target.value } })} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">SIRET</label>
          <input className={iCls} value={data?.siret || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, siret: e.target.value } })} />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
          <textarea className={`${iCls} resize-none`} rows={2} value={data?.adresse || ''} onChange={e => onChange({ ...draft, [dataKey]: { ...data, adresse: e.target.value } })} />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      {/* ── Row 1 : Identification + Maître d'ouvrage (2 colonnes lg+) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Identification">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Intitulé du devis *</label>
              <input className={iCls} value={draft.nom || ''} onChange={e => set('nom', e.target.value)} placeholder="Ex: Devis MOE — Route Principale" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">N° Devis</label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-text">
                {draft.numero || '—'}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Date</label>
              <input type="date" className={iCls} value={draft.dateDevis || ''} onChange={e => set('dateDevis', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">TVA (%)</label>
              <input type="number" className={iCls} value={draft.tva ?? 20} onChange={e => set('tva', e.target.value)} min="0" max="100" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Montant travaux HT (€)</label>
              <input type="number" className={iCls} value={draft.montantTravauxGlobal || ''} onChange={e => set('montantTravauxGlobal', e.target.value)} min="0" placeholder="500 000" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Objet de la mission</label>
              <textarea className={`${iCls} resize-none`} rows={2} value={draft.objet || ''} onChange={e => set('objet', e.target.value)} placeholder="Décrire la mission de maîtrise d'œuvre…" />
            </div>
          </div>
        </Card>

        <Card title="Maître d'ouvrage">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Désignation</label>
              <input className={iCls} value={draft.client?.designation || ''} onChange={e => set('client.designation', e.target.value)} placeholder="Nom de la collectivité / maître d'ouvrage" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
              <input className={iCls} value={draft.client?.adresse || ''} onChange={e => set('client.adresse', e.target.value)} placeholder="Adresse" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Code postal</label>
              <input className={iCls} value={draft.client?.codePostal || ''} onChange={e => set('client.codePostal', e.target.value)} placeholder="00000" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Ville</label>
              <input className={iCls} value={draft.client?.ville || ''} onChange={e => set('client.ville', e.target.value)} placeholder="Ville" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Contact</label>
              <input className={iCls} value={draft.client?.contact || ''} onChange={e => set('client.contact', e.target.value)} placeholder="Nom du contact" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2 : Type de MOE (pleine largeur) ────────────────────────────── */}
      <Card title="Type de maîtrise d'œuvre" accent="bg-violet-400">
        <div className="flex gap-3">
          {[
            { v: 'seul',        Icon: User,  label: 'Seul',        desc: 'Vous êtes le seul maître d\'œuvre' },
            { v: 'mandataire',  Icon: Crown, label: 'Mandataire',  desc: 'Vous dirigez un groupement de MOE' },
            { v: 'cotraitant',  Icon: Users, label: 'Co-traitant', desc: 'Vous êtes co-traitant dans un groupement' },
          ].map(({ v, Icon, label, desc }) => (
            <button key={v} onClick={() => setMoeType(v)}
              className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all duration-200 cursor-default ${
                moeType === v
                  ? 'bg-indigo-50/80 border-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)]'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm'
              }`}>
              <div className={`p-2 rounded-lg shrink-0 transition-transform duration-200 ${moeType === v ? 'bg-indigo-100 text-indigo-600 scale-110' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={14} />
              </div>
              <div>
                <p className={`text-xs font-semibold ${moeType === v ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Row 3 : Entreprises selon moeType ─────────────────────────────────── */}
      {moeType === 'seul' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <EntrepriseCard title="MOE — Mandataire" data={draft.mandataire} dataKey="mandataire" />
        </div>
      )}

      {moeType === 'mandataire' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          <EntrepriseCard title="MOE — Mandataire du groupement" data={draft.mandataire} dataKey="mandataire" accent="bg-amber-400" />

          <Card title="Co-traitants" accent="bg-blue-400">
            <div className="space-y-4">
              {cotraitants.map((cot, idx) => {
                const color = COTRAITANT_COLORS[idx] || COTRAITANT_COLORS[0];
                return (
                  <div key={cot.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${color.text}`}>
                        Co-traitant {idx + 1}
                      </span>
                      <div className="flex-1 h-px bg-slate-200 ml-2" />
                      <button onClick={() => removeCotraitant(cot.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-400/60 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-default">
                        <Trash2 size={11} /> Retirer
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Raison sociale</label>
                        <input className={iCls} value={cot.nom || ''} onChange={e => updateCotraitant(cot.id, 'nom', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">SIRET</label>
                        <input className={iCls} value={cot.siret || ''} onChange={e => updateCotraitant(cot.id, 'siret', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Adresse</label>
                        <textarea className={`${iCls} resize-none`} rows={2} value={cot.adresse || ''} onChange={e => updateCotraitant(cot.id, 'adresse', e.target.value)} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {cotraitants.length < 3 && (
                <button onClick={addCotraitant}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-400/60 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-default">
                  <UserPlus size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Ajouter un co-traitant ({cotraitants.length}/3)
                  </span>
                </button>
              )}

              {cotraitants.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-wider">Groupement :</span>
                  <span className="text-[10px] text-slate-500">
                    {draft.mandataire?.nom || '(mandataire)'}{' '}
                    {cotraitants.map((c, i) => `+ ${c.nom || `(co-traitant ${i + 1})`}`).join(' ')}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {moeType === 'cotraitant' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          <EntrepriseCard title="Mandataire du groupement" data={draft.mandataire} dataKey="mandataire" accent="bg-amber-400" />
          <EntrepriseCard title="Notre entreprise (co-traitant)" data={draft.notreEntreprise} dataKey="notreEntreprise" accent="bg-blue-400" />
        </div>
      )}
    </div>
  );
}
