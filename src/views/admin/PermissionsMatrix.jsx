// src/views/admin/PermissionsMatrix.jsx
// Grille users x modules — permet au super-admin de cocher/décocher
// individuellement les modules auxquels chaque utilisateur a accès.
//
// Persistance Firestore : champ `modules` (array de module IDs) sur le doc
// /users/{uid}. Si le champ n'existe pas, l'utilisateur conserve l'accès
// par défaut (tout ce que isAdmin + module.access lui permettent).
import React, { useState, useMemo } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  CheckCircle2, Circle, RotateCcw, CheckSquare, Square,
  Users, AlertCircle, Loader2,
} from 'lucide-react';
import { ASSIGNABLE_MODULES, ASSIGNABLE_MODULE_IDS } from '../../config/superAdmin';

/**
 * Renvoie la liste des modules auxquels un user a accès aujourd'hui.
 * - Si user.modules est défini → c'est cette liste qui fait foi.
 * - Sinon → fallback "tout autorisé" pour les modules non admin_only,
 *           + les admin_only seulement si user.isAdmin.
 */
const computeEffectiveModules = (user) => {
  if (Array.isArray(user.modules)) return user.modules;
  // Fallback legacy
  return ASSIGNABLE_MODULES
    .filter(m => true) // tous les modules assignables sont accessibles par défaut
    .map(m => m.id);
};

const PermissionsMatrix = ({ companies, users, onRefresh, showFeedback }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [savingUid, setSavingUid] = useState(null);
  const [pendingModuleKey, setPendingModuleKey] = useState(null); // `${uid}:${modId}`

  // Filtre les users selon l'entreprise sélectionnée (vide = toutes)
  const filteredUsers = useMemo(() => {
    if (!selectedCompanyId) return users;
    return users.filter(u => u.companyId === selectedCompanyId);
  }, [users, selectedCompanyId]);

  // Groupes de modules pour structurer le tableau (3 sections du Hub)
  const moduleGroups = useMemo(() => {
    const groups = {};
    ASSIGNABLE_MODULES.forEach(m => {
      if (!groups[m.group]) groups[m.group] = [];
      groups[m.group].push(m);
    });
    return groups;
  }, []);

  /** Toggle d'un module pour un user — persistance immédiate */
  const handleToggleModule = async (user, modId) => {
    const current = computeEffectiveModules(user);
    const isOn = current.includes(modId);
    const next = isOn
      ? current.filter(id => id !== modId)
      : [...current, modId];

    setPendingModuleKey(`${user.uid}:${modId}`);
    try {
      await updateDoc(doc(db, 'users', user.uid), { modules: next });
      onRefresh && onRefresh({ silent: true });
    } catch (e) {
      console.error('Toggle module failed', e);
      showFeedback && showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setPendingModuleKey(null);
    }
  };

  /** Tout cocher pour un user (= tous les modules assignables) */
  const handleSelectAll = async (user) => {
    setSavingUid(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { modules: [...ASSIGNABLE_MODULE_IDS] });
      onRefresh && onRefresh({ silent: true });
    } catch (e) {
      showFeedback && showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setSavingUid(null);
    }
  };

  /** Tout décocher pour un user (=  aucun module accessible) */
  const handleSelectNone = async (user) => {
    setSavingUid(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { modules: [] });
      onRefresh && onRefresh({ silent: true });
    } catch (e) {
      showFeedback && showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setSavingUid(null);
    }
  };

  /** Reset = supprime le champ modules → retour comportement par défaut */
  const handleReset = async (user) => {
    setSavingUid(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { modules: deleteField() });
      onRefresh && onRefresh({ silent: true });
    } catch (e) {
      showFeedback && showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête + filtre entreprise */}
      <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={18} className="text-blue-500" />
          <h2 className="text-sm font-bold text-gray-900">Permissions par module</h2>
        </div>
        <p className="text-gray-400 text-xs mb-4">
          Cochez/décochez pour autoriser ou masquer un module dans le Hub de chaque utilisateur.
          Le module « Administration » est contrôlé séparément par le statut Admin.
        </p>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500 shrink-0">Entreprise :</label>
          <select
            value={selectedCompanyId}
            onChange={e => setSelectedCompanyId(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
          >
            <option value="">— Toutes les entreprises —</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 shrink-0">
            {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-emerald-500" /> Accès autorisé
        </span>
        <span className="flex items-center gap-1.5">
          <Circle size={14} className="text-gray-300" /> Masqué du Hub
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle size={14} className="text-amber-500" /> Configuration par défaut (aucun champ <code className="text-[10px] bg-gray-100 px-1 rounded">modules</code>)
        </span>
      </div>

      {/* Tableau */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-2xl p-10 text-center text-gray-400 text-sm">
          Aucun utilisateur dans cette entreprise.
        </div>
      ) : (
        <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[280px]">
                    Utilisateur
                  </th>
                  {Object.entries(moduleGroups).map(([groupName, mods]) => (
                    <th key={groupName} colSpan={mods.length}
                      className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l border-gray-200/60">
                      {groupName}
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-gray-700 border-l border-gray-200/60 min-w-[180px]">
                    Actions rapides
                  </th>
                </tr>
                <tr className="bg-white border-b border-gray-200/60">
                  <th className="sticky left-0 bg-white z-10"></th>
                  {ASSIGNABLE_MODULES.map(mod => (
                    <th key={mod.id}
                      className="px-2 py-3 text-[10px] font-medium text-gray-600 text-center border-l border-gray-100"
                      style={{ minWidth: '90px', maxWidth: '110px' }}
                      title={mod.label}>
                      <div className="leading-tight">{mod.label}</div>
                    </th>
                  ))}
                  <th className="border-l border-gray-200/60"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(user => {
                  const effective = computeEffectiveModules(user);
                  const usingDefault = !Array.isArray(user.modules);
                  const isSaving = savingUid === user.uid;
                  const company = companies.find(c => c.id === user.companyId);

                  return (
                    <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors">
                      {/* Colonne user (sticky) */}
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-700 truncate max-w-[180px]" title={user.uid}>
                                {user.uid}
                              </span>
                              {user.isAdmin && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-100 text-amber-700">
                                  Admin
                                </span>
                              )}
                              {usingDefault && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200" title="Aucun champ modules — tout est autorisé par défaut">
                                  Défaut
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                              {company ? company.name : '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cellules modules */}
                      {ASSIGNABLE_MODULES.map(mod => {
                        const isOn = effective.includes(mod.id);
                        const isPending = pendingModuleKey === `${user.uid}:${mod.id}`;
                        return (
                          <td key={mod.id} className="text-center border-l border-gray-100">
                            <button
                              onClick={() => handleToggleModule(user, mod.id)}
                              disabled={isPending || isSaving}
                              className={`p-2 rounded-lg transition-all ${
                                isPending || isSaving ? 'opacity-40 cursor-wait' : 'hover:bg-gray-100 active:scale-90'
                              }`}
                              title={`${isOn ? 'Retirer' : 'Donner'} l'accès à "${mod.label}"`}
                            >
                              {isPending ? (
                                <Loader2 size={18} className="text-blue-400 animate-spin" />
                              ) : isOn ? (
                                <CheckCircle2 size={18} className="text-emerald-500" />
                              ) : (
                                <Circle size={18} className="text-gray-300" />
                              )}
                            </button>
                          </td>
                        );
                      })}

                      {/* Actions rapides */}
                      <td className="px-3 py-3 border-l border-gray-100">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSelectAll(user)}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-30"
                            title="Tout cocher"
                          >
                            <CheckSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleSelectNone(user)}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
                            title="Tout décocher"
                          >
                            <Square size={14} />
                          </button>
                          <button
                            onClick={() => handleReset(user)}
                            disabled={isSaving || usingDefault}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-all disabled:opacity-30"
                            title="Réinitialiser (= comportement par défaut)"
                          >
                            <RotateCcw size={14} />
                          </button>
                          {isSaving && <Loader2 size={14} className="text-blue-400 animate-spin ml-1" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsMatrix;
