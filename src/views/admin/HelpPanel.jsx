import React, { useState } from 'react';
import {
  UserPlus, Trash2, X, ExternalLink, Shield, BookOpen,
  CheckCircle2, ArrowRight
} from 'lucide-react';

const HelpPanel = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('nouveau_client');

  const sections = [
    { id: 'nouveau_client', label: 'Ajouter un client',   icon: UserPlus },
    { id: 'supprimer',      label: 'Supprimer un client', icon: Trash2 },
    { id: 'isolation',      label: 'Ce qui est isolé',    icon: Shield },
    { id: 'firebase',       label: 'Firebase Console',    icon: ExternalLink },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f1e2a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BookOpen size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg">Guide Administrateur</h2>
              <p className="text-slate-500 text-xs">Tout ce qu'il faut savoir pour gérer tes clients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-white/10 shrink-0 overflow-x-auto">
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}>
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── AJOUTER UN CLIENT ── */}
          {activeSection === 'nouveau_client' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Pour onboarder un nouveau client, suis ces <strong className="text-white">5 étapes dans l'ordre</strong>.
                Ça prend environ <strong className="text-emerald-400">3 minutes</strong>.
              </p>

              {[
                {
                  num: '1', color: 'blue',
                  title: 'Créer son compte Firebase',
                  sub: 'Sur le site Firebase Console',
                  link: 'https://console.firebase.google.com',
                  steps: [
                    'Va dans ton projet Firebase → menu gauche → Authentication',
                    'Clique "Ajouter un utilisateur" en haut à droite',
                    'Entre son email + un mot de passe temporaire (ex: ChangeMe2024!)',
                    'Clique "Ajouter un utilisateur"',
                  ]
                },
                {
                  num: '2', color: 'amber',
                  title: "Copier son UID",
                  sub: "L'identifiant unique de l'utilisateur",
                  steps: [
                    'Toujours dans Authentication, il apparaît dans la liste',
                    'Colonne "User UID" → c\'est une longue suite de lettres et chiffres',
                    'Clique dessus pour le copier',
                  ],
                  code: 'ex : XyZ9abc123KLmnop456QRstu789'
                },
                {
                  num: '3', color: 'emerald',
                  title: 'Créer son entreprise ici',
                  sub: 'Dans la section "Nouvelle entreprise" ci-dessus',
                  steps: [
                    "Tape le nom de l'entreprise dans le champ en haut de cette page",
                    'Clique "Créer" → un ID unique est généré automatiquement',
                    "L'entreprise apparaît dans la liste en bas",
                  ]
                },
                {
                  num: '4', color: 'purple',
                  title: "Assigner l'utilisateur à l'entreprise",
                  sub: 'Dans la section "Assigner un utilisateur" ci-dessus',
                  steps: [
                    "Colle l'UID copié à l'étape 2 dans le champ UID",
                    "Choisis l'entreprise dans le menu déroulant",
                    'Coche "Compte administrateur" seulement si ce client gère ses propres collègues',
                    'Clique "Assigner"',
                  ]
                },
                {
                  num: '5', color: 'slate',
                  title: 'Envoyer les identifiants au client',
                  sub: 'Par email',
                  steps: [
                    "Envoie-lui l'URL de l'application",
                    'Son email et son mot de passe temporaire',
                    'Dis-lui de changer son mot de passe via "Mot de passe oublié" sur la page de connexion',
                  ]
                },
              ].map(step => (
                <div key={step.num} className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full bg-${step.color}-500/20 border border-${step.color}-500/30 flex items-center justify-center shrink-0`}>
                      <span className={`text-${step.color}-400 font-black text-sm`}>{step.num}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">{step.title}</p>
                      <p className="text-slate-500 text-xs">{step.sub}</p>
                    </div>
                    {step.link && (
                      <a href={step.link} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        Ouvrir <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400 ml-11">
                    {step.steps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-slate-600 mt-0.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: s.replace(/"([^"]+)"/g, '<strong class="text-white">"$1"</strong>') }} />
                      </div>
                    ))}
                    {step.code && (
                      <div className="mt-2 bg-slate-900 rounded-lg px-3 py-2 font-mono text-[11px] text-emerald-400">{step.code}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Résumé visuel */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-emerald-400 font-black text-xs uppercase tracking-wider mb-3">✅ Résumé en un coup d'œil</p>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {[
                    { label: 'Firebase Auth → créer', color: 'blue' },
                    { label: 'Copier UID', color: 'amber' },
                    { label: 'Créer entreprise', color: 'emerald' },
                    { label: 'Assigner', color: 'purple' },
                    { label: 'Envoyer email', color: 'slate' },
                  ].map((item, i, arr) => (
                    <React.Fragment key={item.label}>
                      <span className={`bg-${item.color}-500/20 text-${item.color}-300 px-2 py-1 rounded-lg font-bold`}>
                        {item.label}
                      </span>
                      {i < arr.length - 1 && <ArrowRight size={12} className="text-slate-600" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SUPPRIMER UN CLIENT ── */}
          {activeSection === 'supprimer' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                La suppression d'une entreprise efface <strong className="text-red-400">toutes ses données définitivement</strong>.
                Elle est protégée par une confirmation obligatoire.
              </p>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-white font-bold text-sm">Comment supprimer une entreprise</p>
                <div className="space-y-2 text-xs text-slate-400">
                  {[
                    'Dans la liste des entreprises en bas de cette page, clique sur l\'icône 🗑️ corbeille rouge à droite de l\'entreprise',
                    'Une fenêtre s\'ouvre avec la liste de tout ce qui sera supprimé',
                    'Tape exactement le nom de l\'entreprise pour confirmer',
                    'Clique "Supprimer définitivement"',
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ArrowRight size={12} className="text-slate-600 mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <p className="text-white font-bold text-sm mb-3">Ce qui est supprimé automatiquement</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['Articles BPU', 'Catégories', 'Unités', 'Projets', 'CCTP maître', 'RC maître', 'Charte graphique', 'Accès membres'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-red-300">
                      <Trash2 size={11} className="text-red-500/60 shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-400 font-bold text-xs mb-1">⚠️ Important</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  La suppression <strong className="text-white">ne supprime pas le compte Firebase Auth</strong> de l'utilisateur.
                  Si tu veux aussi supprimer son accès, va dans <strong className="text-white">Firebase Console → Authentication</strong> et supprime-le manuellement.
                </p>
              </div>
            </div>
          )}

          {/* ── CE QUI EST ISOLÉ ── */}
          {activeSection === 'isolation' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Chaque entreprise a son propre espace fermé dans Firebase.
                Un client ne peut <strong className="text-white">jamais voir les données d'un autre client</strong>.
              </p>
              <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-white font-bold text-sm">Données isolées par entreprise</p>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    { label: 'Articles BPU',       desc: 'Base de prix propre à chaque client' },
                    { label: 'Catégories',          desc: 'Organisation de la bibliothèque' },
                    { label: 'Unités',              desc: 'Unités de mesure personnalisées' },
                    { label: 'Projets',             desc: 'Tous les projets et leurs chiffres' },
                    { label: 'CCTP maître',         desc: 'Clauses techniques personnalisées' },
                    { label: 'RC maître',           desc: 'Règlement de consultation' },
                    { label: 'Charte graphique',    desc: 'Logo, couleurs, coordonnées' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-white text-xs font-bold">{row.label}</p>
                        <p className="text-slate-500 text-xs">{row.desc}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Isolé</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <p className="text-white font-bold text-sm mb-3">Structure dans Firebase</p>
                <pre className="text-xs text-slate-400 font-mono leading-relaxed overflow-x-auto">{`companies/
├── entreprise_A/
│   ├── bpu/         ← articles de A
│   ├── projects/    ← projets de A
│   └── resources/   ← CCTP, RC, branding de A
│
└── entreprise_B/
    ├── bpu/         ← articles de B (séparés)
    ├── projects/    ← projets de B (séparés)
    └── resources/   ← CCTP, RC, branding de B`}</pre>
              </div>
            </div>
          )}

          {/* ── FIREBASE CONSOLE ── */}
          {activeSection === 'firebase' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Firebase Console est le tableau de bord de Google où sont stockées toutes les données.
                Tu en as besoin principalement pour <strong className="text-white">créer les comptes utilisateurs</strong>.
              </p>
              <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer"
                className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 hover:bg-blue-500/20 transition-colors group">
                <ExternalLink size={20} className="text-blue-400 shrink-0" />
                <div>
                  <p className="text-white font-bold text-sm">Ouvrir Firebase Console</p>
                  <p className="text-slate-500 text-xs">console.firebase.google.com</p>
                </div>
                <ArrowRight size={16} className="text-blue-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="space-y-3">
                <p className="text-white font-bold text-sm">Les sections utiles</p>
                {[
                  { icon: 'User', color: 'blue', title: 'Authentication', desc: 'Pour créer, voir et supprimer les comptes utilisateurs. C\'est ici que tu trouves les UID.' },
                  { icon: 'Building2', color: 'emerald', title: 'Firestore Database', desc: 'Pour voir toutes les données stockées. Tu peux naviguer dans les données de chaque entreprise via la collection companies.' },
                  { icon: 'Shield', color: 'amber', title: 'Firestore → Règles', desc: 'Les règles de sécurité qui isolent les données entre entreprises. Ne pas modifier sans savoir ce que tu fais.' },
                ].map(item => (
                  <div key={item.title} className="bg-black/30 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded bg-${item.color}-500/20 shrink-0 mt-0.5`} />
                      <div>
                        <p className="text-white font-bold text-xs">{item.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-emerald-400 font-bold text-xs mb-1">💡 Astuce</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Tu n'as besoin d'aller sur Firebase Console <strong className="text-white">que pour créer les comptes</strong> (étape 1).
                  Tout le reste se fait directement ici dans l'app.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;
