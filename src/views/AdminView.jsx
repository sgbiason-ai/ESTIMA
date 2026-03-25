// src/views/AdminView.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import { migrateResourcesToCompany } from '../utils/migrateResources';
import {
  Building2, UserPlus, Trash2, RefreshCw,
  ChevronDown, ChevronRight, Copy, Check,
  HelpCircle, TrendingUp
} from 'lucide-react';
import { confirm } from '../utils/globalUI';

// ─── Sous-composants extraits ────────────────────────────────────────────────
import DeleteCompanyModal from './admin/DeleteCompanyModal';
import HelpPanel from './admin/HelpPanel';
import FirebaseSimulatorModal from './admin/FirebaseSimulatorModal';
import FirebaseStatsPanel from './admin/FirebaseStatsPanel';

const slugify = (str) =>
  str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 30);

// ─── Composant principal ──────────────────────────────────────────────────────

const AdminView = ({ currentUserEmail }) => {
  const [companies, setCompanies]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [showHelp, setShowHelp]     = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [assignForm, setAssignForm] = useState({ uid: '', companyId: '', isAdmin: false });
  const [feedback, setFeedback]     = useState(null);
  const [copiedId, setCopiedId]     = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [migrating, setMigrating]         = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [compSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'users')),
      ]);
      setCompanies(compSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) {
      showFeedback('error', 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleMigrateResources = async (dryRun = false) => {
    if (companies.length === 0) { showFeedback('error', 'Chargez les entreprises.'); return; }
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await migrateResourcesToCompany(companies.map(c => c.id), { dryRun });
      setMigrateResult(result);
      showFeedback(result.errors.length === 0 ? 'success' : 'error',
        result.errors.length === 0
          ? `Migration ${dryRun ? '(simulation) ' : ''}OK — ${result.success.length} entreprise(s)`
          : `${result.errors.length} erreur(s) — voir console`
      );
    } catch (e) {
      showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    const id = slugify(newCompanyName) + '_' + generateId().substring(0, 6);
    const company = { id, name: newCompanyName.trim(), createdAt: new Date().toISOString(), createdBy: currentUserEmail };
    try {
      await setDoc(doc(db, 'companies', id), company);
      setCompanies(prev => [...prev, company]);
      setNewCompanyName('');
      showFeedback('success', `Entreprise "${company.name}" creee.`);
    } catch {
      showFeedback('error', "Impossible de creer l'entreprise.");
    }
  };

  const handleDeleteCompany = async () => {
    const company = companyToDelete;
    setCompanyToDelete(null);
    setDeletingId(company.id);
    try {
      for (const colName of ['bpu', 'categories', 'units', 'projects', 'resources']) {
        const snap = await getDocs(collection(db, 'companies', company.id, colName));
        for (let i = 0; i < snap.docs.length; i += 20) {
          await Promise.all(snap.docs.slice(i, i + 20).map(d => deleteDoc(d.ref)));
        }
      }
      await deleteDoc(doc(db, 'companies', company.id));
      const members = users.filter(u => u.companyId === company.id);
      await Promise.all(members.map(u => deleteDoc(doc(db, 'users', u.uid))));
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      setUsers(prev => prev.filter(u => u.companyId !== company.id));
      if (expandedId === company.id) setExpandedId(null);
      showFeedback('success', `Entreprise "${company.name}" supprimee.`);
    } catch (e) {
      showFeedback('error', `Erreur : ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssignUser = async () => {
    const { uid, companyId, isAdmin } = assignForm;
    if (!uid.trim() || !companyId) { showFeedback('error', 'UID et entreprise requis.'); return; }
    try {
      await setDoc(doc(db, 'users', uid.trim()), {
        companyId, isAdmin: !!isAdmin,
        assignedAt: new Date().toISOString(), assignedBy: currentUserEmail,
      }, { merge: true });
      setAssignForm({ uid: '', companyId: '', isAdmin: false });
      await loadData();
      showFeedback('success', `Utilisateur assigne a "${companyId}".`);
    } catch {
      showFeedback('error', "Impossible d'assigner l'utilisateur.");
    }
  };

  const handleRemoveUser = async (uid) => {
    const ok = await confirm("Retirer l'accès de cet utilisateur ?", { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(prev => prev.filter(u => u.uid !== uid));
      showFeedback('success', 'Acces retire.');
    } catch {
      showFeedback('error', 'Erreur lors de la suppression.');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07111a] overflow-auto p-6 gap-6">

      {companyToDelete && (
        <DeleteCompanyModal
          company={companyToDelete}
          membersCount={users.filter(u => u.companyId === companyToDelete.id).length}
          onConfirm={handleDeleteCompany}
          onCancel={() => setCompanyToDelete(null)}
        />
      )}

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showSimulator && <FirebaseSimulatorModal onClose={() => setShowSimulator(false)} />}

      {/* En-tete */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">Administration</h1>
          <p className="text-slate-500 text-xs mt-1">Gestion des entreprises clientes et des acces</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-colors">
            <HelpCircle size={14} />
            Guide
          </button>
          <button onClick={() => setShowSimulator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-colors">
            <TrendingUp size={14} />
            Simulateur
          </button>
          <button onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold border ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>{feedback.msg}</div>
      )}

      {/* Stats Firebase */}
      <FirebaseStatsPanel companies={companies} users={users} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Creer entreprise */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={18} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Nouvelle entreprise</h2>
            <span className="ml-auto text-[10px] text-slate-600 font-bold">ETAPE 3</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">Cree l'espace de donnees du client</p>
          <div className="flex gap-3">
            <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCompany()}
              placeholder="Nom de l'entreprise cliente"
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors" />
            <button onClick={handleCreateCompany} disabled={!newCompanyName.trim()}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs rounded-xl transition-colors">
              Creer
            </button>
          </div>
        </div>

        {/* Assigner utilisateur */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={18} className="text-blue-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Assigner un utilisateur</h2>
            <span className="ml-auto text-[10px] text-slate-600 font-bold">ETAPE 4</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">L'UID vient de Firebase Console → Authentication</p>
          <div className="space-y-3">
            <input value={assignForm.uid} onChange={e => setAssignForm(f => ({ ...f, uid: e.target.value }))}
              placeholder="UID Firebase (ex: abc123xyz...)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors font-mono" />
            <select value={assignForm.companyId} onChange={e => setAssignForm(f => ({ ...f, companyId: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors">
              <option value="">— Choisir une entreprise —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-slate-400 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={assignForm.isAdmin}
                  onChange={e => setAssignForm(f => ({ ...f, isAdmin: e.target.checked }))}
                  className="accent-emerald-500" />
                Compte administrateur
              </label>
              <button onClick={handleAssignUser} disabled={!assignForm.uid.trim() || !assignForm.companyId}
                className="ml-auto px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition-colors">
                Assigner
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Liste entreprises */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Entreprises ({companies.length})</h2>
          <p className="text-slate-600 text-xs">Clique sur une entreprise pour voir ses membres</p>
        </div>

        {companies.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-600 text-sm">Aucune entreprise creee.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {companies.map(company => {
              const members    = users.filter(u => u.companyId === company.id);
              const isExpanded = expandedId === company.id;
              const isDeleting = deletingId === company.id;
              return (
                <div key={company.id}>
                  <div className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : company.id)}>
                    {isExpanded ? <ChevronDown size={16} className="text-slate-500 shrink-0" /> : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
                    <Building2 size={16} className="text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{company.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-slate-500 text-xs font-mono">{company.id}</span>
                        <button onClick={e => { e.stopPropagation(); copyToClipboard(company.id, company.id); }}
                          className="text-slate-600 hover:text-slate-400 transition-colors" title="Copier l'ID">
                          {copiedId === company.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs bg-slate-800 px-2 py-1 rounded-lg">
                      {members.length} membre{members.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={e => { e.stopPropagation(); setCompanyToDelete(company); }}
                      disabled={isDeleting} title="Supprimer cette entreprise"
                      className="ml-2 p-2 rounded-lg text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30">
                      {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-black/20 border-t border-white/5 px-8 py-3">
                      {members.length === 0 ? (
                        <p className="text-slate-600 text-xs py-2">Aucun utilisateur assigne.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-600 uppercase tracking-wider">
                              <th className="text-left py-2 font-bold">UID</th>
                              <th className="text-left py-2 font-bold">Role</th>
                              <th className="text-left py-2 font-bold">Assigne le</th>
                              <th className="py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {members.map(u => (
                              <tr key={u.uid} className="text-slate-400">
                                <td className="py-2 font-mono text-[11px] text-slate-300">{u.uid}</td>
                                <td className="py-2">
                                  <span className={`px-2 py-0.5 rounded-md font-bold ${u.isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                    {u.isAdmin ? 'Admin' : 'Utilisateur'}
                                  </span>
                                </td>
                                <td className="py-2">{u.assignedAt ? new Date(u.assignedAt).toLocaleDateString('fr-FR') : '—'}</td>
                                <td className="py-2 text-right">
                                  <button onClick={() => handleRemoveUser(u.uid)}
                                    className="text-red-500/50 hover:text-red-400 transition-colors" title="Retirer l'acces">
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Migration ressources */}
      <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider">Migration des ressources</h2>
            <p className="text-slate-500 text-xs mt-1">
              Copie CCTP, RC et branding globaux vers chaque entreprise. A executer une seule fois.
            </p>
          </div>
        </div>
        <div className="px-5 py-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleMigrateResources(true)}
              disabled={migrating}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {migrating ? '...' : '🔍 Simuler (dry run)'}
            </button>
            <button
              onClick={async () => { const ok = await confirm(`Migrer vers ${companies.length} entreprise(s) ?`, { danger: true }); if (ok) handleMigrateResources(false); }}
              disabled={migrating || companies.length === 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {migrating ? 'En cours...' : '🚀 Lancer la migration'}
            </button>
          </div>
          {migrateResult && (
            <div className="bg-slate-800 rounded-xl p-4 text-xs font-mono space-y-1">
              <p className="text-emerald-400">✅ {migrateResult.success.length} succes : {migrateResult.success.join(', ')}</p>
              {migrateResult.errors.length > 0 && (
                <p className="text-red-400">❌ Erreurs : {migrateResult.errors.join(', ')}</p>
              )}
              <p className="text-slate-500 mt-2">
                Apres verification dans la console Firebase, supprimez manuellement
                resources/master_cctp, resources/master_rc et resources/branding.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AdminView;
