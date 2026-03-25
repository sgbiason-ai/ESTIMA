import React from 'react';
import { X, TrendingUp } from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────────

const SPARK_STORAGE_GB  = 1;
const SPARK_READS_DAY   = 50000;
const SPARK_WRITES_DAY  = 20000;

const SIM_PROFILES = {
  light:  { label: 'Legere',    desc: 'Peu de BPU, 2-3 projets simples',     color: '#00dc82', storageMB: 0.6,  docs: 80,  readsPerDay: 120, writesPerDay: 30  },
  medium: { label: 'Moyenne',   desc: 'BPU complet, ~5 projets actifs',       color: '#60a5fa', storageMB: 1.7,  docs: 293, readsPerDay: 350, writesPerDay: 80  },
  heavy:  { label: 'Intensive', desc: 'Gros BPU, 10+ projets, RAO actif',     color: '#f472b6', storageMB: 4.5,  docs: 700, readsPerDay: 900, writesPerDay: 200 },
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

const FirebaseSimulatorModal = ({ onClose }) => {
  const [profile,  setProfile]  = React.useState('medium');
  const [count,    setCount]    = React.useState(5);
  const [overhead, setOverhead] = React.useState(1.35);

  const p = SIM_PROFILES[profile];
  const n = Math.max(1, count);

  const sim = React.useMemo(() => {
    const storageMB   = p.storageMB * overhead * n;
    const storageGB   = storageMB / 1024;
    const storagePct  = (storageGB / SPARK_STORAGE_GB) * 100;
    const maxByStorage = Math.floor((SPARK_STORAGE_GB*1024) / (p.storageMB*overhead));
    const maxByReads   = Math.floor(SPARK_READS_DAY  / p.readsPerDay);
    const maxByWrites  = Math.floor(SPARK_WRITES_DAY / p.writesPerDay);
    const bottleneck   = Math.min(maxByStorage, maxByReads, maxByWrites);
    return {
      storageMB, storageGB, storagePct,
      readsDay:  p.readsPerDay  * n,
      writesDay: p.writesPerDay * n,
      maxByStorage, maxByReads, maxByWrites, bottleneck,
    };
  }, [p, n, overhead]);

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
          .sim-profile { cursor:pointer; transition:all 0.15s; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.02); border-radius:10px; padding:10px 12px; }
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
                Plan Spark · 1 GiB · 50k lectures/j · 20k ecritures/j · Mesure reelle : 1.70 Mo / entreprise
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:8, borderRadius:10, background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', color:'rgba(255,255,255,0.5)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, padding:20 }}>

          {/* COL GAUCHE - Parametres */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Profil */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:14 }}>
              <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', marginBottom:10 }}>
                Profil d'entreprise
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {Object.entries(SIM_PROFILES).map(([key, pr]) => (
                  <div key={key} className="sim-profile" onClick={() => setProfile(key)}
                    style={{ borderColor: profile===key ? pr.color+'50':undefined, background: profile===key ? pr.color+'0d':undefined }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <span style={{ fontWeight:800, fontSize:12, color: profile===key ? pr.color : 'rgba(255,255,255,0.75)' }}>{pr.label}</span>
                        <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', margin:'2px 0 0' }}>{pr.desc}</p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color: profile===key ? pr.color : 'rgba(255,255,255,0.35)' }}>
                          {pr.storageMB} Mo
                        </p>
                        <p style={{ fontFamily:'monospace', fontSize:8, color:'rgba(255,255,255,0.18)' }}>{pr.docs} docs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nb entreprises */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', margin:0 }}>
                  Nb entreprises
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
                Max plan Spark — profil <span style={{ color:p.color }}>{p.label}</span>
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
                    💡 Plan Blaze recommande des 10+ clients
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
            {'\u26A0'} Simulation indicative — Mesure reelle : Papyrus BET = 1.70 Mo / 293 docs.
            Overhead {'\u00D7'}{overhead} applique (index Firestore, metadata, padding).
            Lectures/ecritures estimees selon usage typique BPU + CCTP + projet actif.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseSimulatorModal;
