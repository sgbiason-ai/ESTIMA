import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  RefreshCw, ChevronDown, ChevronRight, ExternalLink,
  Building2, User, BarChart2, Database, FileStack,
  AlertCircle, Zap, HardDrive
} from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────────

const QUOTA_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB
const WARN_THRESHOLD  = 0.60;
const DANGER_THRESHOLD = 0.85;

const COL_META = {
  projects:   { label: 'Projets',      color: '#00dc82', icon: '📁' },
  bpu:        { label: 'BPU',          color: '#60a5fa', icon: '📋' },
  categories: { label: 'Categories',   color: '#a78bfa', icon: '🏷️' },
  units:      { label: 'Unites',       color: '#fb923c', icon: '📐' },
  resources:  { label: 'Ressources',   color: '#f472b6', icon: '🎨' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
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
          const cols = ['projects', 'bpu', 'categories', 'units', 'resources'];
          const colStats = {};
          let totalBytes = estimateBytes({ id: company.id, name: company.name });

          await Promise.all(cols.map(async (colName) => {
            try {
              const snap = await getDocs(collection(db, 'companies', company.id, colName));
              let bytes = 0;
              const docs = snap.docs.map(d => {
                const data = d.data();
                bytes += estimateBytes(data);
                return data;
              });
              colStats[colName] = { count: snap.size, bytes, docs };
              totalBytes += bytes;
            } catch {
              colStats[colName] = { count: 0, bytes: 0, docs: [] };
            }
          }));

          const memberCount = users.filter(u => u.companyId === company.id).length;
          return { company, colStats, totalBytes, memberCount };
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
    let va, vb;
    if (sortBy === 'size')     { va = a.totalBytes; vb = b.totalBytes; }
    else if (sortBy === 'name'){ va = a.company.name; vb = b.company.name; return sortDir * va.localeCompare(vb, 'fr'); }
    else { va = a.colStats[sortBy]?.count ?? 0; vb = b.colStats[sortBy]?.count ?? 0; }
    return sortDir * (va - vb);
  }) : [];

  const globalBytes  = stats ? stats.reduce((a, b) => a + b.totalBytes, 0) : 0;
  const globalDocs   = stats ? stats.reduce((a, b) => Object.values(b.colStats).reduce((s, c) => s + c.count, 0) + a, 0) : 0;
  const maxBytes     = stats ? Math.max(...stats.map(s => s.totalBytes), 1) : 1;

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => -d);
    else { setSortBy(col); setSortDir(-1); }
  };

  const thCls = (col) =>
    `cursor-pointer select-none text-[9px] font-black uppercase tracking-[0.12em] transition-colors px-2 py-2 text-left ${sortBy === col ? 'text-white' : 'hover:text-slate-300'}`;

  return (
    <>
      <style>{`
        .fb-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
        .fb-scroll::-webkit-scrollbar { height: 4px; }
        .fb-scroll::-webkit-scrollbar-track { background: transparent; }
        .fb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .fb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>

      {/* Header panel */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,220,130,0.1)', border: '1px solid rgba(0,220,130,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={15} style={{ color: '#00dc82' }} />
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 800, fontSize: 13, lineHeight: 1 }}>Occupation Firebase</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>
              Estimation par serialisation JSON · Donnees en temps reel
            </p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: stats ? 'rgba(255,255,255,0.05)' : 'rgba(0,220,130,0.1)',
            border: `1px solid ${stats ? 'rgba(255,255,255,0.1)' : 'rgba(0,220,130,0.25)'}`,
            color: stats ? 'rgba(255,255,255,0.55)' : '#00dc82',
            fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyse en cours...' : stats ? 'Actualiser' : 'Analyser Firebase'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'rgba(248,113,113,0.9)', fontSize: 12 }}>
          {'\u26A0'} {error}
        </div>
      )}

      {/* Empty state */}
      {!stats && !loading && !error && (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.15)' }}>
          <Database size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>Lance l'analyse pour voir l'occupation Firebase</p>
          <p style={{ fontSize: 10, marginTop: 4, fontFamily: 'monospace' }}>Interroge toutes les sous-collections de chaque entreprise</p>
        </div>
      )}

      {/* Stats content */}
      {stats && (
        <>
          {/* KPI Cards */}
          {(() => {
            const globalQuotaPct = globalBytes / QUOTA_LIMIT_BYTES;
            const globalQuotaColor = globalQuotaPct > DANGER_THRESHOLD ? '#f87171' : globalQuotaPct > WARN_THRESHOLD ? '#fbbf24' : '#00dc82';
            const kpis = [
              { label: 'Entreprises',     value: companies.length,                   icon: Building2, color: '#00dc82', sub: 'clients actifs' },
              { label: 'Documents total', value: globalDocs.toLocaleString('fr-FR'), icon: FileStack,  color: '#60a5fa', sub: 'docs Firestore' },
              { label: 'Utilisateurs',    value: users.length,                       icon: User,       color: '#fb923c', sub: 'comptes assignes' },
            ];
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr) 2fr`, gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {kpis.map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                      <div key={i} style={{ padding: '14px 16px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={13} style={{ color: kpi.color }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{kpi.label}</span>
                        </div>
                        <p style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1, marginBottom: 2 }}>{kpi.value}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{kpi.sub}</p>
                      </div>
                    );
                  })}

                  {/* Quota card */}
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: `${globalQuotaColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <HardDrive size={13} style={{ color: globalQuotaColor }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          Quota Firestore · Plan Spark
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                        padding: '2px 10px', borderRadius: 6,
                        background: `${globalQuotaColor}15`,
                        border: `1px solid ${globalQuotaColor}30`,
                        color: globalQuotaColor,
                      }}>
                        {(globalQuotaPct * 100).toFixed(2)} %
                      </span>
                    </div>

                    {/* Grande barre de quota */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, globalQuotaPct * 100)}%`,
                          borderRadius: 4,
                          background: `linear-gradient(90deg, ${globalQuotaColor}aa, ${globalQuotaColor})`,
                          transition: 'width 0.8s ease',
                          boxShadow: `0 0 8px ${globalQuotaColor}55`,
                        }} />
                        {[25, 50, 75].map(p => (
                          <div key={p} style={{
                            position: 'absolute', top: 0, bottom: 0, left: `${p}%`,
                            width: 1, background: 'rgba(255,255,255,0.12)',
                          }} />
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <p style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>{fmtSize(globalBytes)}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 2 }}>utilises sur 1 GiB</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{fmtSize(QUOTA_LIMIT_BYTES - globalBytes)}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', marginTop: 1 }}>restants</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alerte quota */}
                {globalQuotaPct > WARN_THRESHOLD && (
                  <div style={{
                    margin: '0', padding: '8px 20px',
                    background: globalQuotaPct > DANGER_THRESHOLD ? 'rgba(248,113,113,0.07)' : 'rgba(251,191,36,0.07)',
                    borderBottom: `1px solid ${globalQuotaColor}25`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <AlertCircle size={12} style={{ color: globalQuotaColor, flexShrink: 0 }} />
                    <p style={{ fontSize: 11, color: globalQuotaColor, fontWeight: 600 }}>
                      {globalQuotaPct > DANGER_THRESHOLD
                        ? '🔴 Quota critique — Passe en plan Blaze (pay-as-you-go) pour eviter les blocages.'
                        : '🟡 Quota eleve — Surveille ta consommation ou anticipe la migration vers Blaze.'}
                    </p>
                    <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer"
                      style={{ marginLeft: 'auto', fontSize: 10, color: globalQuotaColor, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      Firebase Console <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </>
            );
          })()}

          {/* Table */}
          <div style={{ overflowX: 'auto' }} className="fb-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                  <th className={thCls('name')}  onClick={() => toggleSort('name')}   style={{ color: sortBy === 'name' ? 'white' : 'rgba(255,255,255,0.25)', paddingLeft: 20, minWidth: 180 }}>
                    Entreprise {sortBy === 'name' ? (sortDir > 0 ? '\u2191' : '\u2193') : ''}
                  </th>
                  {Object.entries(COL_META).map(([col, m]) => (
                    <th key={col} className={thCls(col)} onClick={() => toggleSort(col)}
                      style={{ color: sortBy === col ? m.color : 'rgba(255,255,255,0.25)', minWidth: 72, textAlign: 'center' }}>
                      {m.label} {sortBy === col ? (sortDir > 0 ? '\u2191' : '\u2193') : ''}
                    </th>
                  ))}
                  <th className={thCls('size')} onClick={() => toggleSort('size')}
                    style={{ color: sortBy === 'size' ? 'white' : 'rgba(255,255,255,0.25)', minWidth: 140, paddingRight: 20 }}>
                    Taille estimee {sortBy === 'size' ? (sortDir > 0 ? '\u2191' : '\u2193') : ''}
                  </th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ company, colStats, totalBytes, memberCount }) => {
                  const quotaPct = totalBytes / QUOTA_LIMIT_BYTES;
                  const barColor = quotaPct > DANGER_THRESHOLD ? '#f87171' : quotaPct > WARN_THRESHOLD ? '#fbbf24' : '#00dc82';
                  const isExp    = expanded === company.id;

                  return (
                    <React.Fragment key={company.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isExp ? 'rgba(0,220,130,0.04)' : undefined,
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                        onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = ''; }}
                        onClick={() => setExpanded(isExp ? null : company.id)}
                      >
                        <td style={{ padding: '10px 8px 10px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isExp
                              ? <ChevronDown size={13} style={{ color: '#00dc82', shrink: 0 }} />
                              : <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.2)', shrink: 0 }} />
                            }
                            <div>
                              <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 13 }}>{company.name}</p>
                              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace', marginTop: 1 }}>
                                {memberCount} utilisateur{memberCount !== 1 ? 's' : ''} · cree {company.createdAt ? new Date(company.createdAt).toLocaleDateString('fr-FR') : '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {Object.keys(COL_META).map(col => {
                          const c = colStats[col] || { count: 0 };
                          const m = COL_META[col];
                          return (
                            <td key={col} style={{ textAlign: 'center', padding: '10px 8px' }}>
                              <span style={{
                                display: 'inline-block',
                                minWidth: 28, padding: '2px 8px', borderRadius: 6,
                                fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                                background: c.count > 0 ? `${m.color}12` : 'transparent',
                                color: c.count > 0 ? m.color : 'rgba(255,255,255,0.15)',
                              }}>
                                {c.count > 0 ? c.count : '—'}
                              </span>
                            </td>
                          );
                        })}

                        <td style={{ padding: '10px 20px 10px 8px', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                                  {fmtSize(totalBytes)}
                                </span>
                                {quotaPct > WARN_THRESHOLD && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: barColor, fontFamily: 'monospace' }}>
                                    {(quotaPct * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <BarMini value={totalBytes} max={maxBytes} color={barColor} />
                            </div>
                            {quotaPct > WARN_THRESHOLD && (
                              <AlertCircle size={12} style={{ color: barColor, flexShrink: 0 }} />
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '10px 12px 10px 4px' }}>
                          <div style={{ opacity: isExp ? 1 : 0, transition: 'opacity 0.15s' }}>
                            <Zap size={11} style={{ color: '#00dc82' }} />
                          </div>
                        </td>
                      </tr>

                      {/* Detail expande */}
                      {isExp && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td colSpan={7} style={{ padding: '0 20px 16px 52px', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                              {Object.entries(COL_META).map(([col, m]) => {
                                const cs = colStats[col] || { count: 0, bytes: 0 };
                                return (
                                  <div key={col} style={{
                                    padding: '10px 12px', borderRadius: 10,
                                    background: cs.count > 0 ? `${m.color}08` : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${cs.count > 0 ? m.color + '22' : 'rgba(255,255,255,0.05)'}`,
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <span style={{ fontSize: 14 }}>{m.icon}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: cs.count > 0 ? m.color : 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {m.label}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: 20, fontWeight: 900, color: cs.count > 0 ? 'white' : 'rgba(255,255,255,0.15)', lineHeight: 1, marginBottom: 2 }}>
                                      {cs.count}
                                    </p>
                                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                                      {fmtSize(cs.bytes)}
                                    </p>
                                    <div style={{ marginTop: 8 }}>
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
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)' }}>
                  <td style={{ padding: '10px 8px 10px 20px', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    TOTAL ({companies.length})
                  </td>
                  {Object.keys(COL_META).map(col => {
                    const total = stats.reduce((s, r) => s + (r.colStats[col]?.count ?? 0), 0);
                    return (
                      <td key={col} style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                        {total}
                      </td>
                    );
                  })}
                  <td style={{ padding: '10px 20px 10px 8px', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                    {fmtSize(globalBytes)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legende quota */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
              Barre par entreprise : relative au max · Quota global : 1 GiB Firestore Spark
            </span>
            {[
              { color: '#00dc82', label: 'Normal' },
              { color: '#fbbf24', label: `Attention > ${WARN_THRESHOLD * 100}% du quota` },
              { color: '#f87171', label: `Critique > ${DANGER_THRESHOLD * 100}% du quota` },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 4, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    </>
  );
};

export default FirebaseStatsPanel;
