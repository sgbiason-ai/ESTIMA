import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  RefreshCw, ChevronDown, ChevronRight, ExternalLink,
  Building2, User, BarChart2, Database, FileStack,
  AlertCircle, Zap, HardDrive
} from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────────

const QUOTA_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;
const WARN_THRESHOLD  = 0.60;
const DANGER_THRESHOLD = 0.85;

// `perUser: true` → sous-collection stockée sous companies/{id}/users/{uid}/…
// (agrégée sur tous les utilisateurs de l'entreprise lors de l'analyse).
const COL_META = {
  projects:           { label: 'Projets',       color: '#059669', icon: '📁' },
  bpu:                { label: 'BPU',           color: '#2563eb', icon: '📋' },
  categories:         { label: 'Catégories',    color: '#7c3aed', icon: '🏷️' },
  units:              { label: 'Unités',        color: '#ea580c', icon: '📐' },
  resources:          { label: 'Ressources',    color: '#db2777', icon: '🎨' },
  crr:                { label: 'CRC',           color: '#0d9488', icon: '📝' },
  devisMoe:           { label: 'Devis MOE',     color: '#ca8a04', icon: '💰' },
  fichesMarche:       { label: 'Fiches Marché', color: '#a21caf', icon: '📄' },
  folders:            { label: 'Dossiers',      color: '#64748b', icon: '📂' },
  presence:           { label: 'Présence',      color: '#0891b2', icon: '🟢' },
  site_visits:        { label: 'Visites',       color: '#16a34a', icon: '📍' },
  expenseNotes:       { label: 'Notes frais',   color: '#e11d48', icon: '🧾', perUser: true },
  vehicles:           { label: 'Véhicules',     color: '#9333ea', icon: '🚗', perUser: true },
  expenseLocations:   { label: 'Lieux',         color: '#0284c7', icon: '🗺️', perUser: true },
  expenseYearSettings:{ label: 'Régl. frais',   color: '#65a30d', icon: '🗓️', perUser: true },
  expenseSettings:    { label: 'Régl. global',  color: '#737373', icon: '🛠️' },
};

const estimateBytes = (data) => {
  try { return new Blob([JSON.stringify(data)]).size; } catch { return 0; }
};

const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
};

const BarMini = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-gray-200 w-full">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────

const FirebaseStatsPanel = ({ companies, users }) => {
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [sortBy, setSortBy]     = useState('size');
  const [sortDir, setSortDir]   = useState(-1);
  const [expanded, setExpanded] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        companies.map(async (company) => {
          const companyUsers = users.filter(u => u.companyId === company.id);
          const colStats = {};
          let totalBytes = estimateBytes({ id: company.id, name: company.name });
          await Promise.all(Object.entries(COL_META).map(async ([colName, meta]) => {
            try {
              let count = 0, bytes = 0;
              if (meta.perUser) {
                // Sous-collection par utilisateur → agréger sur tous les membres.
                await Promise.all(companyUsers.map(async (u) => {
                  const snap = await getDocs(collection(db, 'companies', company.id, 'users', u.uid, colName));
                  count += snap.size;
                  snap.docs.forEach(d => { bytes += estimateBytes(d.data()); });
                }));
              } else {
                const snap = await getDocs(collection(db, 'companies', company.id, colName));
                count = snap.size;
                snap.docs.forEach(d => { bytes += estimateBytes(d.data()); });
              }
              colStats[colName] = { count, bytes };
              totalBytes += bytes;
            } catch {
              colStats[colName] = { count: 0, bytes: 0 };
            }
          }));
          return { company, colStats, totalBytes, memberCount: companyUsers.length };
        })
      );
      setStats(results);
    } catch (e) {
      setError('Erreur lors du chargement des statistiques : ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sorted = stats ? [...stats].sort((a, b) => {
    if (sortBy === 'name') return sortDir * a.company.name.localeCompare(b.company.name, 'fr');
    if (sortBy === 'size') return sortDir * (a.totalBytes - b.totalBytes);
    return sortDir * ((a.colStats[sortBy]?.count ?? 0) - (b.colStats[sortBy]?.count ?? 0));
  }) : [];

  const globalBytes = stats ? stats.reduce((a, b) => a + b.totalBytes, 0) : 0;
  const globalDocs  = stats ? stats.reduce((a, b) => Object.values(b.colStats).reduce((s, c) => s + c.count, 0) + a, 0) : 0;
  const maxBytes    = stats ? Math.max(...stats.map(s => s.totalBytes), 1) : 1;

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => -d);
    else { setSortBy(col); setSortDir(-1); }
  };

  return (
    <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50">
            <BarChart2 size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Occupation Firebase</p>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">Estimation par sérialisation JSON · Données en temps réel</p>
          </div>
        </div>
        <button onClick={loadStats} disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            stats ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'
          } ${loading ? 'cursor-not-allowed opacity-60' : ''}`}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyse en cours...' : stats ? 'Actualiser' : 'Analyser Firebase'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 my-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200/60 text-red-600 text-xs font-medium">
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {!stats && !loading && !error && (
        <div className="py-12 text-center">
          <Database size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Lance l'analyse pour voir l'occupation Firebase</p>
          <p className="text-[10px] text-gray-400 font-mono mt-1">Interroge toutes les sous-collections (incl. notes de frais par utilisateur)</p>
        </div>
      )}

      {/* Stats content */}
      {stats && (
        <>
          {/* KPI Cards */}
          {(() => {
            const globalQuotaPct = globalBytes / QUOTA_LIMIT_BYTES;
            const globalQuotaColor = globalQuotaPct > DANGER_THRESHOLD ? '#ef4444' : globalQuotaPct > WARN_THRESHOLD ? '#f59e0b' : '#10b981';
            const kpis = [
              { label: 'Entreprises',     value: companies.length,                   icon: Building2, color: '#10b981', sub: 'clients actifs' },
              { label: 'Documents total', value: globalDocs.toLocaleString('fr-FR'), icon: FileStack,  color: '#3b82f6', sub: 'docs Firestore' },
              { label: 'Utilisateurs',    value: users.length,                       icon: User,       color: '#f97316', sub: 'comptes assignés' },
            ];
            return (
              <>
                <div className="grid border-b border-gray-200/60" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr) 2fr` }}>
                  {kpis.map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                      <div key={i} className="px-4 py-4 border-r border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                            <Icon size={14} style={{ color: kpi.color }} />
                          </div>
                          <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">{kpi.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">{kpi.sub}</p>
                      </div>
                    );
                  })}

                  {/* Quota card */}
                  <div className="px-5 py-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${globalQuotaColor}15` }}>
                          <HardDrive size={14} style={{ color: globalQuotaColor }} />
                        </div>
                        <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">Quota Firestore · Spark</span>
                      </div>
                      <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg" style={{ background: `${globalQuotaColor}15`, color: globalQuotaColor }}>
                        {(globalQuotaPct * 100).toFixed(2)} %
                      </span>
                    </div>

                    <div className="mb-2">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden relative">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, globalQuotaPct * 100)}%`, background: globalQuotaColor }} />
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{fmtSize(globalBytes)}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">utilisés sur 1 GiB</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-400 font-mono">{fmtSize(QUOTA_LIMIT_BYTES - globalBytes)}</p>
                        <p className="text-[9px] text-gray-300 font-mono mt-0.5">restants</p>
                      </div>
                    </div>
                  </div>
                </div>

                {globalQuotaPct > WARN_THRESHOLD && (
                  <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2" style={{ background: `${globalQuotaColor}08` }}>
                    <AlertCircle size={12} style={{ color: globalQuotaColor }} />
                    <p className="text-xs font-medium" style={{ color: globalQuotaColor }}>
                      {globalQuotaPct > DANGER_THRESHOLD
                        ? 'Quota critique — Passez en plan Blaze pour éviter les blocages.'
                        : 'Quota élevé — Surveillez votre consommation.'}
                    </p>
                    <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer"
                      className="ml-auto flex items-center gap-1 text-[10px] font-bold" style={{ color: globalQuotaColor }}>
                      Console <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </>
            );
          })()}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200/60 bg-gray-50">
                  <th onClick={() => toggleSort('name')}
                    className={`cursor-pointer select-none text-[9px] font-bold uppercase tracking-widest px-5 py-2.5 text-left ${sortBy === 'name' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} style={{ minWidth: 180 }}>
                    Entreprise {sortBy === 'name' ? (sortDir > 0 ? '↑' : '↓') : ''}
                  </th>
                  {Object.entries(COL_META).map(([col, m]) => (
                    <th key={col} onClick={() => toggleSort(col)}
                      className={`cursor-pointer select-none text-[9px] font-bold uppercase tracking-widest px-2 py-2.5 text-center ${sortBy === col ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} style={{ minWidth: 72 }}>
                      {m.label} {sortBy === col ? (sortDir > 0 ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th onClick={() => toggleSort('size')}
                    className={`cursor-pointer select-none text-[9px] font-bold uppercase tracking-widest px-5 py-2.5 text-left ${sortBy === 'size' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} style={{ minWidth: 140 }}>
                    Taille estimée {sortBy === 'size' ? (sortDir > 0 ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ company, colStats, totalBytes, memberCount }) => {
                  const quotaPct = totalBytes / QUOTA_LIMIT_BYTES;
                  const barColor = quotaPct > DANGER_THRESHOLD ? '#ef4444' : quotaPct > WARN_THRESHOLD ? '#f59e0b' : '#10b981';
                  const isExp = expanded === company.id;

                  return (
                    <React.Fragment key={company.id}>
                      <tr
                        onClick={() => setExpanded(isExp ? null : company.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${isExp ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isExp ? <ChevronDown size={13} className="text-blue-500 shrink-0" /> : <ChevronRight size={13} className="text-gray-300 shrink-0" />}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                              <p className="text-[9px] text-gray-400 font-mono mt-0.5">
                                {memberCount} utilisateur{memberCount !== 1 ? 's' : ''} · créé {company.createdAt ? new Date(company.createdAt).toLocaleDateString('fr-FR') : '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {Object.keys(COL_META).map(col => {
                          const c = colStats[col] || { count: 0 };
                          const m = COL_META[col];
                          return (
                            <td key={col} className="text-center px-2 py-3">
                              <span className="inline-block min-w-[28px] px-2 py-0.5 rounded-lg text-xs font-bold font-mono"
                                style={{
                                  background: c.count > 0 ? `${m.color}12` : 'transparent',
                                  color: c.count > 0 ? m.color : '#d1d5db',
                                }}>
                                {c.count > 0 ? c.count : '—'}
                              </span>
                            </td>
                          );
                        })}

                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-700 font-mono">{fmtSize(totalBytes)}</span>
                                {quotaPct > WARN_THRESHOLD && (
                                  <span className="text-[9px] font-bold font-mono" style={{ color: barColor }}>{(quotaPct * 100).toFixed(0)}%</span>
                                )}
                              </div>
                              <BarMini value={totalBytes} max={maxBytes} color={barColor} />
                            </div>
                            {quotaPct > WARN_THRESHOLD && <AlertCircle size={12} style={{ color: barColor }} className="shrink-0" />}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          {isExp && <Zap size={11} className="text-emerald-500" />}
                        </td>
                      </tr>

                      {isExp && (
                        <tr className="border-b border-gray-200/60">
                          <td colSpan={Object.keys(COL_META).length + 3} className="px-5 pb-4 pt-2 bg-gray-50/80" style={{ paddingLeft: 52 }}>
                            <div className="grid grid-cols-5 gap-2 pt-2">
                              {Object.entries(COL_META).map(([col, m]) => {
                                const cs = colStats[col] || { count: 0, bytes: 0 };
                                return (
                                  <div key={col} className="p-3 rounded-xl border" style={{
                                    background: cs.count > 0 ? `${m.color}08` : '#f9fafb',
                                    borderColor: cs.count > 0 ? `${m.color}25` : '#e5e7eb',
                                  }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="text-sm">{m.icon}</span>
                                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cs.count > 0 ? m.color : '#9ca3af' }}>
                                        {m.label}
                                      </span>
                                      {m.perUser && (
                                        <span className="ml-auto text-[8px] text-gray-400 font-mono normal-case tracking-normal" title="Agrégé sur tous les utilisateurs">/ user</span>
                                      )}
                                    </div>
                                    <p className="text-xl font-bold" style={{ color: cs.count > 0 ? '#111827' : '#d1d5db' }}>{cs.count}</p>
                                    <p className="text-[9px] text-gray-400 font-mono mt-0.5">{fmtSize(cs.bytes)}</p>
                                    <div className="mt-2">
                                      <BarMini value={cs.bytes} max={totalBytes || 1} color={m.color} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t border-gray-200/60 bg-gray-50">
                  <td className="px-5 py-3 text-xs font-bold text-gray-500 font-mono uppercase tracking-wider">
                    TOTAL ({companies.length})
                  </td>
                  {Object.keys(COL_META).map(col => {
                    const total = stats.reduce((s, r) => s + (r.colStats[col]?.count ?? 0), 0);
                    return (
                      <td key={col} className="text-center px-2 py-3 text-xs font-bold text-gray-500 font-mono">{total}</td>
                    );
                  })}
                  <td className="px-5 py-3 text-xs font-bold text-gray-700 font-mono">{fmtSize(globalBytes)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Légende */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 flex-wrap">
            <span className="text-[9px] text-gray-400 font-mono">Barre par entreprise : relative au max · Quota global : 1 GiB Spark</span>
            {[
              { color: '#10b981', label: 'Normal' },
              { color: '#f59e0b', label: `Attention > ${WARN_THRESHOLD * 100}%` },
              { color: '#ef4444', label: `Critique > ${DANGER_THRESHOLD * 100}%` },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-1 rounded-full" style={{ background: l.color }} />
                <span className="text-[9px] text-gray-400 font-mono">{l.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FirebaseStatsPanel;
