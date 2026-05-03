// src/views/AdminView.jsx — EstimaStyle (Apple light)
import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import {
  Building2, UserPlus, Trash2, RefreshCw,
  ChevronDown, ChevronRight, Copy, Check,
  HelpCircle, TrendingUp, BarChart2, Plus, ShieldCheck,
} from 'lucide-react';
import { confirm } from '../utils/globalUI';

import DeleteCompanyModal from './admin/DeleteCompanyModal';
import HelpPanel from '../components/help/HelpPanel';
import FirebaseSimulatorModal from './admin/FirebaseSimulatorModal';
import FirebaseStatsPanel from './admin/FirebaseStatsPanel';
import PermissionsMatrix from './admin/PermissionsMatrix';
import { isSuperAdmin } from '../config/superAdmin';

const slugify = (str) =>
  str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 30);

const BASE_TABS = [
  { id: 'companies', label: 'Entreprises',        icon: Building2 },
  { id: 'new',       label: 'Nouvelle entreprise', icon: Plus },
  { id: 'capacity',  label: 'Capacités',           icon: BarChart2 },
];

const SUPER_ADMIN_TAB = { id: 'permissions', label: 'Permissions', icon: ShieldCheck };

const AdminView = ({ currentUserEmail }) => {
  const isSuper = isSuperAdmin(currentUserEmail);
  const TABS = isSuper ? [...BASE_TABS, SUPER_ADMIN_TAB] : BASE_TABS;
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
  const [activeTab, setActiveTab]   = useState('companies');

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async (opts = {}) => {
    if (!opts.silent) setLoading(true);
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
      if (!opts.silent) setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    const id = slugify(newCompanyName) + '_' + generateId().substring(0, 6);
    const company = { id, name: newCompanyName.trim(), createdAt: new Date().toISOString(), createdBy: currentUserEmail };
    try {
      await setDoc(doc(db, 'companies', id), company);
      setCompanies(prev => [...prev, company]);
      setNewCompanyName('');
      showFeedback('success', `Entreprise "${company.name}" créée.`);
    } catch {
      showFeedback('error', "Impossible de créer l'entreprise.");
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
      showFeedback('success', `Entreprise "${company.name}" supprimée.`);
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
      showFeedback('success', `Utilisateur assigné à "${companyId}".`);
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
      showFeedback('success', 'Accès retiré.');
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
    <div className="flex-1 flex flex-col h-full bg-[#f5f5f7] overflow-auto p-6 gap-4"
      >

      {companyToDelete && (
        <DeleteCompanyModal
          company={companyToDelete}
          membersCount={users.filter(u => u.companyId === companyToDelete.id).length}
          onConfirm={handleDeleteCompany}
          onCancel={() => setCompanyToDelete(null)}
        />
      )}
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="admin" />
      {showSimulator && <FirebaseSimulatorModal companies={companies} onClose={() => setShowSimulator(false)} />}

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Administration</h1>
          <p className="text-gray-400 text-xs mt-1">Gestion des entreprises clientes et des accès</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200/60 text-gray-600 rounded-xl text-xs font-medium transition-all">
            <HelpCircle size={14} /> Guide
          </button>
          <button onClick={() => setShowSimulator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200/60 text-gray-600 rounded-xl text-xs font-medium transition-all">
            <TrendingUp size={14} /> Simulateur
          </button>
          <button onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-medium transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-medium border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
            : 'bg-red-50 border-red-200/60 text-red-600'
        }`}>{feedback.msg}</div>
      )}

      {/* Onglets — segmented control */}
      <div className="flex items-center gap-0.5 bg-gray-100 border border-gray-200/60 rounded-xl p-0.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}>
              <Icon size={14} />
              {tab.label}
              {tab.id === 'companies' && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                  {companies.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── TAB : Entreprises ──────────────────────────────────────────── */}
      {activeTab === 'companies' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-gray-200/60 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-gray-900">Entreprises ({companies.length})</h2>
              <p className="text-gray-400 text-xs">Cliquez sur une entreprise pour voir ses membres</p>
            </div>

            {companies.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucune entreprise créée.</div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
                {companies.map(company => {
                  const members = users.filter(u => u.companyId === company.id);
                  const isExpanded = expandedId === company.id;
                  const isDeleting = deletingId === company.id;
                  return (
                    <div key={company.id}>
                      <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : company.id)}>
                        {isExpanded
                          ? <ChevronDown size={16} className="text-blue-500 shrink-0" />
                          : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                        <Building2 size={16} className="text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{company.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gray-400 text-xs font-mono truncate">{company.id}</span>
                            <button onClick={e => { e.stopPropagation(); copyToClipboard(company.id, company.id); }}
                              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0" title="Copier l'ID">
                              {copiedId === company.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-lg shrink-0 font-medium ${members.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          {members.length} membre{members.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={e => { e.stopPropagation(); setCompanyToDelete(company); }}
                          disabled={isDeleting} title="Supprimer cette entreprise"
                          className="ml-1 p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 shrink-0">
                          {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="bg-gray-50/80 border-t border-gray-100">
                          {members.length === 0 ? (
                            <p className="text-gray-400 text-xs py-4 px-8">Aucun utilisateur assigné.</p>
                          ) : (
                            <div className="px-5 py-3">
                              <div className="grid gap-2">
                                {members.map(u => (
                                  <div key={u.uid} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200/60 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-mono text-gray-600 truncate">{u.uid}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">
                                        Assigné le {u.assignedAt ? new Date(u.assignedAt).toLocaleDateString('fr-FR') : '—'}
                                      </p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${u.isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                      {u.isAdmin ? 'Admin' : 'Utilisateur'}
                                    </span>
                                    <button onClick={() => handleRemoveUser(u.uid)}
                                      className="p-1.5 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0" title="Retirer l'accès">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB : Nouvelle entreprise ─────────────────────────────────── */}
      {activeTab === 'new' && (
        <div className="flex flex-col gap-6">
          {/* Créer entreprise */}
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} className="text-blue-500" />
              <h2 className="text-sm font-bold text-gray-900">Créer une entreprise</h2>
            </div>
            <p className="text-gray-400 text-xs mb-4">Crée l'espace de données du client</p>
            <div className="flex gap-3">
              <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateCompany()}
                placeholder="Nom de l'entreprise cliente"
                className="flex-1 bg-gray-50 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
              <button onClick={handleCreateCompany} disabled={!newCompanyName.trim()}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-xl transition-all">
                Créer
              </button>
            </div>
          </div>

          {/* Assigner utilisateur */}
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus size={18} className="text-violet-500" />
              <h2 className="text-sm font-bold text-gray-900">Assigner un utilisateur</h2>
            </div>
            <p className="text-gray-400 text-xs mb-4">L'UID vient de Firebase Console → Authentication</p>
            <div className="space-y-3">
              <input value={assignForm.uid} onChange={e => setAssignForm(f => ({ ...f, uid: e.target.value }))}
                placeholder="UID Firebase (ex: abc123xyz...)"
                className="w-full bg-gray-50 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all font-mono" />
              <select value={assignForm.companyId} onChange={e => setAssignForm(f => ({ ...f, companyId: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all">
                <option value="">— Choisir une entreprise —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
              </select>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-gray-500 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={assignForm.isAdmin}
                    onChange={e => setAssignForm(f => ({ ...f, isAdmin: e.target.checked }))}
                    className="accent-blue-500 rounded" />
                  Compte administrateur
                </label>
                <button onClick={handleAssignUser} disabled={!assignForm.uid.trim() || !assignForm.companyId}
                  className="ml-auto px-5 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-xl transition-all">
                  Assigner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB : Capacités ───────────────────────────────────────────── */}
      {activeTab === 'capacity' && (
        <FirebaseStatsPanel companies={companies} users={users} />
      )}

      {/* ─── TAB : Permissions (super-admin uniquement) ─────────────────── */}
      {activeTab === 'permissions' && isSuper && (
        <PermissionsMatrix
          companies={companies}
          users={users}
          onRefresh={loadData}
          showFeedback={showFeedback}
        />
      )}
    </div>
  );
};

export default AdminView;
