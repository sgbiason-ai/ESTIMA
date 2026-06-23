import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, TrendingUp, RefreshCw } from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────────

const SPARK_STORAGE_GB  = 1;
const SPARK_READS_DAY   = 50000;
const SPARK_WRITES_DAY  = 20000;

// Collections au niveau entreprise (companies/{id}/{col})
const COMPANY_COLLECTIONS = [
  'projects', 'bpu', 'categories', 'units', 'resources', 'crr', 'devisMoe',
  'fichesMarche', 'folders', 'presence', 'site_visits', 'expenseSettings',
  'tpStudies', 'tpResources',
];
// Sous-collections par utilisateur (companies/{id}/users/{uid}/{col}) — notes de frais
const USER_COLLECTIONS = ['expenseNotes', 'vehicles', 'expenseLocations', 'expenseYearSettings'];
const TOTAL_COLLECTIONS = COMPANY_COLLECTIONS.length + USER_COLLECTIONS.length;

const estimateBytes = (data) => {
  try { return new Blob([JSON.stringify(data)]).size; } catch { return 0; }
};

const simFmtMB  = (mb) => mb >= 1024 ? `${(mb/1024).toFixed(2)} Go` : `${mb.toFixed(1)} Mo`;
const simFmtNum = (n)  => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

// ─── Sous-composants ─────────────────────────────────────────────────────────

const SimGauge = ({ pct, color, size = 110 }) => {
  const r = (size/2) - 9;
  const circ = 2 * Math.PI * r;
  const strokeColor = pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : color;
  const dash = Math.min(pct/100,1) * circ * 0.75;
  return (
    <svg width={size} height={size*0.82} viewBox={`0 0 ${size} ${size}`} style={{ overflow:'visible' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7}
        strokeDasharray={`${circ*0.75} ${circ}`} strokeDashoffset={-(circ*0.125)} strokeLinecap="round"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={strokeColor} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-(circ*0.125)} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 0.6s ease, stroke 0.3s' }}
        filter={`drop-shadow(0 0 5px ${strokeColor}88)`}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fill="white"
        fontSize={pct>=100?13:16} fontWeight={900} fontFamily="'DM Mono',monospace">
        {pct>=100 ? 'PLEIN' : `${Math.round(pct)}%`}
      </text>
    </svg>
  );
};

const SimBar = ({ label, used, max, color, unit='' }) => {
  const pct = Math.min(100,(used/max)*100);
  const bc  = pct>85?'#f87171':pct>60?'#fbbf24':color;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
        <span style={{ color:'rgba(255,255,255,0.5)', fontWeight:600 }}>{label}</span>
        <span style={{ fontFamily:'monospace', fontSize:10 }}>
          <span style={{ color:bc, fontWeight:700 }}>{simFmtNum(Math.round(used))}{unit}</span>
          <span style={{ color:'rgba(255,255,255,0.2)' }}> / {simFmtNum(max)}{unit}</span>
        </span>
      </div>
      <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.06)' }}>
        <div style={{ height:'100%', borderRadius:3, width:`${pct}%`,
          background:`linear-gradient(90deg,${bc}99,${bc})`,
          boxShadow:`0 0 6px ${bc}44`, transition:'width 0.6s ease,background 0.3s' }}/>
      </div>
    </div>
  );
};

// ─── Modale principale ───────────────────────────────────────────────────────

const FirebaseSimulatorModal = ({ companies, users = [], onClose }) => {
  const [count,    setCount]    = useState(companies.length || 5);
  const [overhead, setOverhead] = useState(1.35);
  const [realData, setRealData] = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Fetch real stats from Firebase on mount
  const fetchRealStats = async () => {
    if (!companies || companies.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        companies.map(async (company) => {
          let totalBytes = estimateBytes({ id: company.id, name: company.name });
          let totalDocs = 0;
          const companyUsers = users.filter(u => u.companyId === company.id);

          await Promise.all([
            // Collections au niveau entreprise
            ...COMPANY_COLLECTIONS.map(async (colName) => {
              try {
                const snap = await getDocs(collection(db, 'companies', company.id, colName));
                totalDocs += snap.size;
                snap.docs.forEach(d => { totalBytes += estimateBytes(d.data()); });
              } catch { /* skip */ }
            }),
            // Sous-collections par utilisateur (notes de frais) — agrégées sur tous les membres
            ...USER_COLLECTIONS.map(async (colName) => {
              await Promise.all(companyUsers.map(async (u) => {
                try {
                  const snap = await getDocs(collection(db, 'companies', company.id, 'users', u.uid, colName));
                  totalDocs += snap.size;
                  snap.docs.forEach(d => { totalBytes += estimateBytes(d.data()); });
                } catch { /* skip */ }
              }));
            }),
          ]);

          return { id: company.id, name: company.name, totalBytes, totalDocs };
        })
      );

      const totalBytes = results.reduce((s, r) => s + r.totalBytes, 0);
      const totalDocs  = results.reduce((s, r) => s + r.totalDocs, 0);
      const avgBytes   = results.length > 0 ? totalBytes / results.length : 0;
      const avgDocs    = results.length > 0 ? totalDocs / results.length : 0;
      const avgMB      = avgBytes / (1024 * 1024);

      // Heuristique lectures/ecritures par jour :
      // - Modules classiques (estimation, BPU) : ~1.2 lectures, ~0.3 ecritures par doc
      // - Module CRC : plus intensif (WYSIWYG, autosave, images base64) : +50% lectures, +80% ecritures
      const avgReadsPerDay  = Math.round(avgDocs * 1.5);
      const avgWritesPerDay = Math.round(avgDocs * 0.5);

      setRealData({
        companyCount: results.length,
        totalBytes, totalDocs,
        avgMB, avgDocs,
        avgReadsPerDay, avgWritesPerDay,
        perCompany: results,
      });
    } catch (e) {
      console.error('Erreur chargement stats simulateur:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRealStats(); }, []);

  const avgMB         = realData?.avgMB ?? 1.7;
  const avgDocs       = realData?.avgDocs ?? 293;
  const avgReadsDay   = realData?.avgReadsPerDay ?? 350;
  const avgWritesDay  = realData?.avgWritesPerDay ?? 80;

  const n = Math.max(1, count);

  const sim = useMemo(() => {
    const storageMB   = avgMB * overhead * n;
    const storageGB   = storageMB / 1024;
    const storagePct  = (storageGB / SPARK_STORAGE_GB) * 100;
    const maxByStorage = Math.floor((SPARK_STORAGE_GB*1024) / (avgMB*overhead));
    const maxByReads   = Math.floor(SPARK_READS_DAY  / avgReadsDay);
    const maxByWrites  = Math.floor(SPARK_WRITES_DAY / avgWritesDay);
    const bottleneck   = Math.min(maxByStorage, maxByReads, maxByWrites);
    return {
      storageMB, storageGB, storagePct,
      readsDay:  avgReadsDay  * n,
      writesDay: avgWritesDay * n,
      maxByStorage, maxByReads, maxByWrites, bottleneck,
    };
  }, [avgMB, avgReadsDay, avgWritesDay, n, overhead]);

  const statusColor = sim.storagePct > 85 ? '#f87171' : sim.storagePct > 60 ? '#fbbf24' : '#00dc82';
  const statusLabel = sim.storagePct > 85 ? '🔴 Critique' : sim.storagePct > 60 ? '🟡 Attention' : '🟢 Confortable';
  const limitant    = sim.bottleneck === sim.maxByStorage ? 'stockage 1 GiB'
                    : sim.bottleneck === sim.maxByReads   ? '50k lectures/jour'
                    : '20k ecritures/jour';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', padding:16 }}>
      <div style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20,
        width:'100%', maxWidth:820, maxHeight:'90vh', overflow:'auto',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)', fontFamily:"'Outfit',sans-serif", color:'#c9cdd6' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
          .sim-range { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; background:rgba(255,255,255,0.1); outline:none; cursor:pointer; width:100%; }
          .sim-range::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#00dc82; box-shadow:0 0 6px #00dc8266; cursor:pointer; }
          .sim-scroll::-webkit-scrollbar { width:4px; } .sim-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:2px; }
        `}</style>

        {/* Header modale */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(0,220,130,0.1)',
              border:'1px solid rgba(0,220,130,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingUp size={15} style={{ color:'#00dc82' }} />
            </div>
            <div>
              <p style={{ color:'white', fontWeight:800, fontSize:14, lineHeight:1 }}>Simulateur de capacite</p>
              <p style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginTop:2, fontFamily:'monospace' }}>
                Plan Spark · 1 GiB · 50k lectures/j · 20k ecritures/j
                {realData && ` · Mesure reelle : ${avgMB.toFixed(2)} Mo / ${Math.round(avgDocs)} docs par entreprise`}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={fetchRealStats} disabled={loading}
              style={{ padding:8, borderRadius:10, background:'rgba(0,220,130,0.08)',
                border:'1px solid rgba(0,220,130,0.2)', cursor: loading ? 'not-allowed' : 'pointer',
                color:'#00dc82', display:'flex', alignItems:'center', justifyContent:'center' }}
              title="Actualiser les donnees reelles">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} style={{ padding:8, borderRadius:10, background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', color:'rgba(255,255,255,0.5)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, padding:20 }}>

          {/* COL GAUCHE - Parametres */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Donnees reelles */}
            <div style={{ background:'rgba(0,220,130,0.04)', border:'1px solid rgba(0,220,130,0.15)', borderRadius:12, padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(0,220,130,0.6)', margin:0 }}>
                  Donnees reelles (moyenne / entreprise)
                </p>
                {loading && <RefreshCw size={11} className="animate-spin" style={{ color:'#00dc82' }} />}
              </div>
              {realData ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Stockage', value:`${avgMB.toFixed(2)} Mo`, color:'#00dc82' },
                    { label:'Documents', value:`${Math.round(avgDocs)}`, color:'#60a5fa' },
                    { label:'Lect. estimees/j', value:simFmtNum(avgReadsDay), color:'#a78bfa' },
                    { label:'Ecrit. estimees/j', value:simFmtNum(avgWritesDay), color:'#f472b6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding:'8px 10px', borderRadius:8,
                      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize:8, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{label}</p>
                      <p style={{ fontFamily:'monospace', fontSize:14, fontWeight:900, color, lineHeight:1 }}>{value}</p>
                    </div>
                  ))}
                  <div style={{ gridColumn:'span 2', padding:'6px 10px', borderRadius:6,
                    background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ fontSize:8, color:'rgba(255,255,255,0.25)', fontFamily:'monospace' }}>
                      Base sur {realData.companyCount} entreprise(s) · Total : {simFmtMB(realData.totalBytes / (1024*1024))} · {realData.totalDocs} docs
                    </p>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textAlign:'center', padding:'12px 0' }}>
                  {loading ? 'Chargement des donnees Firebase...' : 'Aucune donnee disponible'}
                </p>
              )}
            </div>

            {/* Nb entreprises */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', margin:0 }}>
                  Nb entreprises (projection)
                </p>
                <span style={{ fontFamily:'monospace', fontSize:26, fontWeight:900, color:'white', lineHeight:1 }}>{n}</span>
              </div>
              <input type="range" min={1} max={200} value={count} className="sim-range"
                style={{ accentColor:'#00dc82' }} onChange={e => setCount(Number(e.target.value))} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                {[1,25,50,100,150,200].map(v => (
                  <span key={v} style={{ fontFamily:'monospace', fontSize:8, color:'rgba(255,255,255,0.2)', cursor:'pointer' }}
                    onClick={() => setCount(v)}>{v}</span>
                ))}
              </div>
            </div>

            {/* Overhead */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', margin:0 }}>
                    Overhead Firestore
                  </p>
                  <p style={{ fontSize:8, color:'rgba(255,255,255,0.18)', marginTop:2, fontFamily:'monospace' }}>index + metadata</p>
                </div>
                <span style={{ fontFamily:'monospace', fontSize:16, fontWeight:900, color:'#60a5fa' }}>{'\u00D7'}{overhead}</span>
              </div>
              <input type="range" min={1} max={3} step={0.05} value={overhead} className="sim-range"
                style={{ accentColor:'#60a5fa' }} onChange={e => setOverhead(Number(e.target.value))} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                {[['\u00D71.0',1,'JSON pur'],['\u00D71.35',1.35,'Realiste'],['\u00D72.0',2,'Conserv.'],['\u00D73.0',3,'Pessim.']].map(([l,v,s]) => (
                  <div key={v} style={{ textAlign:'center', cursor:'pointer' }} onClick={() => setOverhead(v)}>
                    <p style={{ fontFamily:'monospace', fontSize:8, color: overhead===v ? '#60a5fa':'rgba(255,255,255,0.2)', fontWeight: overhead===v?700:400 }}>{l}</p>
                    <p style={{ fontSize:7, color:'rgba(255,255,255,0.13)' }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COL DROITE - Resultats */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Jauge */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12,
              padding:'16px 14px 12px', display:'flex', flexDirection:'column', alignItems:'center' }}>
              <SimGauge pct={sim.storagePct} color={statusColor} size={110} />
              <p style={{ fontSize:14, fontWeight:900, color:statusColor, marginTop:6 }}>{statusLabel}</p>
              <p style={{ fontFamily:'monospace', fontSize:10, color:'rgba(255,255,255,0.28)', marginTop:2 }}>
                {simFmtMB(sim.storageMB)} sur 1 GiB
              </p>
            </div>

            {/* Barres limites */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:14 }}>
              <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', marginBottom:12 }}>
                Consommation estimee / jour
              </p>
              <SimBar label="Stockage" used={sim.storageGB*1024} max={SPARK_STORAGE_GB*1024} color="#00dc82" unit=" Mo"/>
              <SimBar label="Lectures" used={sim.readsDay}       max={SPARK_READS_DAY}         color="#60a5fa"/>
              <SimBar label="Ecritures" used={sim.writesDay}     max={SPARK_WRITES_DAY}        color="#a78bfa"/>
            </div>

            {/* Capacite max */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${statusColor}22`, borderRadius:12, padding:14 }}>
              <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', marginBottom:12 }}>
                Max plan Spark — <span style={{ color:'#00dc82' }}>donnees reelles</span>
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, marginBottom:14 }}>
                {[
                  { label:'Stockage',  value:sim.maxByStorage, color:'#00dc82' },
                  { label:'Lectures',  value:sim.maxByReads,   color:'#60a5fa' },
                  { label:'Ecritures', value:sim.maxByWrites,  color:'#a78bfa' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign:'center', padding:'8px 6px', borderRadius:8,
                    background: value===sim.bottleneck ? `${color}12` : 'rgba(255,255,255,0.02)',
                    border:`1px solid ${value===sim.bottleneck ? color+'30' : 'rgba(255,255,255,0.05)'}` }}>
                    <p style={{ fontFamily:'monospace', fontSize:20, fontWeight:900,
                      color: value===sim.bottleneck ? color : 'rgba(255,255,255,0.5)', lineHeight:1 }}>{value}</p>
                    <p style={{ fontSize:8, color:'rgba(255,255,255,0.28)', marginTop:4 }}>{label}</p>
                    {value===sim.bottleneck && (
                      <p style={{ fontSize:7, color, marginTop:2, fontWeight:700 }}>{'\u2190'} goulot</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Verdict */}
              <div style={{ padding:'10px 12px', borderRadius:9, background:`${statusColor}0e`, border:`1px solid ${statusColor}22` }}>
                <p style={{ fontSize:12, fontWeight:800, color:'white', marginBottom:2 }}>
                  Capacite max :{' '}
                  <span style={{ color:statusColor, fontSize:20, fontWeight:900 }}>{sim.bottleneck}</span>{' '}
                  entreprises
                </p>
                <p style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'monospace' }}>
                  Goulot : {limitant}
                </p>
              </div>

              {sim.bottleneck < 20 && (
                <div style={{ marginTop:9, padding:'8px 12px', borderRadius:8,
                  background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)' }}>
                  <p style={{ fontSize:10, color:'#fbbf24', fontWeight:700 }}>
                    Plan Blaze recommande des 10+ clients
                  </p>
                  <p style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:2 }}>
                    ~0.18$/Go · Premier GiB gratuit · Pas de plafond
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'10px 20px 14px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontFamily:'monospace', fontSize:8, color:'rgba(255,255,255,0.15)' }}>
            {'\u26A0'} Simulation basee sur les donnees reelles Firebase ({TOTAL_COLLECTIONS} collections : Projets, BPU, CRC, Devis MOE, Fiches Marche, Ressources, Dossiers, Visites de site, Etudes TP, Ressources TP, Notes de frais, etc. — notes de frais agregees par utilisateur) — Moyenne : {avgMB.toFixed(2)} Mo / {Math.round(avgDocs)} docs par entreprise.
            Overhead {'\u00D7'}{overhead} applique (index Firestore, metadata, padding).
            Heuristiques ajustees pour les modules intensifs (CRC, Visites : autosave, WYSIWYG, images).
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseSimulatorModal;
