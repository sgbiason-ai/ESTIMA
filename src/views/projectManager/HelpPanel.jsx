import React, { useState } from 'react';
import {
  X, BookOpen, ArrowRight, Lightbulb,
  Upload, Cloud, Layers, FileJson,
  Save, Clock, PlusCircle, Copy, Folder, Trash2, CheckCircle2,
} from 'lucide-react';

const TABS = [
  { id: 'sauvegarder', label: 'Sauvegarder',    icon: Upload },
  { id: 'restaurer',   label: 'Restaurer',       icon: Cloud },
  { id: 'organiser',   label: 'Organiser',       icon: Layers },
  { id: 'exporter',    label: 'Export / Import', icon: FileJson },
];

const HelpPanel = ({ onClose }) => {
  const [tab, setTab] = useState('sauvegarder');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BookOpen size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-slate-100 font-semibold text-lg">Guide — Gestion Projet</h2>
              <p className="text-slate-400 text-sm">Tout ce qu'il faut savoir pour gérer tes projets</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 p-4 border-b border-slate-800 shrink-0 overflow-x-auto bg-slate-900">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                }`}>
                <Icon size={16} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6 bg-slate-900">

          {tab === 'sauvegarder' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">Tu as <strong className="text-white">3 façons</strong> de sauvegarder ton projet, chacune avec un rôle différent.</p>
              {[
                { color: 'emerald', Icon: Upload, title: 'CLOUD SAVE — Sauvegarde principale', badge: 'Recommandé',
                  desc: 'Sauvegarde tout sur Firebase : chapitres, quantités, formules, cases CCTP/RC cochées, analyse des prix.',
                  steps: ['Clique le gros bouton vert "CLOUD SAVE" dans la colonne du milieu', 'Une animation confirme la sauvegarde', 'Le projet est accessible depuis n\'importe quel ordinateur'],
                  tip: 'Sauvegarde à chaque fin de session ou après une modification importante.' },
                { color: 'blue', Icon: Save, title: 'EXPORT JSON — Sauvegarde hors-ligne', badge: 'Archivage',
                  desc: 'Télécharge un fichier .json sur ton disque dur. Utile pour archiver ou transférer un projet.',
                  steps: ['Clique "EXPORT JSON" dans la colonne du milieu', 'Un fichier PROJET_NOM.json est téléchargé', 'Garde ce fichier en lieu sûr (clé USB, email...)'],
                  tip: 'Fais un export JSON avant chaque grosse modification — c\'est ton filet de sécurité.' },
                { color: 'slate', Icon: Clock, title: 'Cache Local — Historique rapide', badge: 'Automatique',
                  desc: 'Enregistrement automatique dans le navigateur à chaque ouverture de projet.',
                  steps: ['Aucune action requise — c\'est automatique', 'Visible dans la colonne de droite, onglet "Local"', 'Disparaît si tu vides le cache du navigateur'],
                  tip: 'Ne pas compter dessus comme sauvegarde principale.' },
              ].map(item => (
                <div key={item.title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${item.color}-500/10 border border-${item.color}-500/20`}>
                      <item.Icon size={18} className={`text-${item.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-slate-100 font-semibold text-sm">{item.title}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${item.color}-500/10 text-${item.color}-400 border border-${item.color}-500/20`}>{item.badge}</span>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">{item.desc}</p>
                    </div>
                  </div>
                  <div className="space-y-2 ml-14 mb-4">
                    {item.steps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <ArrowRight size={14} className="text-slate-500 mt-0.5 shrink-0" /><span>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="ml-14 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                    <p className="text-amber-400 text-xs flex items-center gap-2"><Lightbulb size={14} /> <strong>Astuce :</strong> {item.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'restaurer' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">Pour reprendre un projet existant, utilise la <strong className="text-white">colonne de droite</strong>.</p>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <p className="text-slate-100 font-semibold text-sm mb-4 flex items-center gap-2"><Cloud size={16} className="text-emerald-400" /> Depuis le Cloud</p>
                <div className="space-y-2 text-sm text-slate-300">
                  {['Assure-toi d\'être sur l\'onglet "Cloud" dans la colonne de droite',
                    'Tu vois la liste de tous tes projets sauvegardés',
                    'Le projet actif est marqué "EN COURS"',
                    'Clique sur un projet pour l\'ouvrir',
                    'Si la liste est vide, clique sur l\'icône de rafraîchissement'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2"><ArrowRight size={14} className="text-slate-500 mt-0.5 shrink-0" /><span>{s}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <p className="text-slate-100 font-semibold text-sm mb-4 flex items-center gap-2"><FileJson size={16} className="text-purple-400" /> Depuis un fichier JSON</p>
                <div className="space-y-2 text-sm text-slate-300">
                  {['Clique sur "Charger JSON" dans la colonne du milieu',
                    'Sélectionne ton fichier .json',
                    'Confirme l\'ouverture → tout est restauré automatiquement',
                    'Cases CCTP/RC, analyse des prix et config BPU sont aussi restaurés'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2"><ArrowRight size={14} className="text-slate-500 mt-0.5 shrink-0" /><span>{s}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
                <p className="text-emerald-400 font-semibold text-sm mb-2">💡 Changer d'ordinateur ?</p>
                <p className="text-slate-300 text-sm leading-relaxed">Assure-toi d'avoir fait un <strong className="text-white">Cloud Save</strong> sur l'ancien PC. Sur le nouveau, ouvre l'app → onglet "Cloud" → clique sur ton projet. C'est tout.</p>
              </div>
            </div>
          )}

          {tab === 'organiser' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">Quelques outils pour gérer plusieurs projets efficacement.</p>
              {[
                { Icon: PlusCircle, title: 'Créer un nouveau projet',
                  desc: 'Clique sur "Nouveau" en haut à droite. Un projet vide est créé avec un chapitre par défaut.',
                  warn: 'Le projet en cours n\'est pas perdu — il reste sauvegardé sur le Cloud.' },
                { Icon: Copy, title: 'Dupliquer un projet',
                  desc: 'Clique sur "Dupliquer" dans la carte session. Utile pour créer une variante sans toucher à l\'original.',
                  warn: 'Le clone est créé localement — pense à faire un Cloud Save après.' },
                { Icon: Folder, title: 'Organiser en dossiers',
                  desc: 'Dans l\'onglet Cloud, utilise le panneau de gauche pour créer des dossiers et sous-dossiers. Survole une affaire puis clique l\'icône 📁 pour la déplacer.',
                  warn: 'Les dossiers sont partagés entre tous les membres de ta société.' },
                { Icon: Trash2, title: 'Supprimer un projet du Cloud',
                  desc: 'Dans la liste Cloud à droite, survole un projet → icône corbeille apparaît → clique pour supprimer.',
                  warn: 'La suppression est définitive. Fais un Export JSON avant si tu veux garder une archive.' },
              ].map(item => (
                <div key={item.title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                      <item.Icon size={18} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-slate-100 font-semibold text-sm mb-1">{item.title}</p>
                      <p className="text-slate-400 text-sm leading-relaxed mb-3">{item.desc}</p>
                      <p className="text-amber-400 text-xs font-medium">⚠️ {item.warn}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'exporter' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">Le fichier JSON est une <strong className="text-white">copie complète</strong> de ton projet — utilisable sans internet.</p>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/50">
                  <p className="text-slate-100 font-semibold text-sm">Contenu du fichier JSON exporté</p>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {[
                    { label: 'Chapitres & items',     desc: 'Tous les postes, quantités et formules' },
                    { label: 'Cases CCTP cochées',    desc: 'Sélections et états d\'expansion' },
                    { label: 'Cases RC cochées',      desc: 'Sélections et états d\'expansion' },
                    { label: 'Analyse des prix',      desc: 'Toutes les lignes de décomposition' },
                    { label: 'Config numérotation',   desc: 'Mode auto/manuel du BPU' },
                    { label: '% frais client',        desc: 'Taux appliqué aux calculs' },
                    { label: 'Infos fiche projet',    desc: 'Client, lieu, dates, tranches...' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-4 px-5 py-3">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-slate-200 text-sm font-medium">{row.label}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{row.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <p className="text-slate-100 font-semibold text-sm mb-3">Importer un fichier JSON</p>
                <div className="space-y-2 text-sm text-slate-300">
                  {['Clique sur "Charger JSON" dans la colonne de gauche',
                    'Sélectionne le fichier .json',
                    'Confirme l\'ouverture → tout est restauré automatiquement'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2"><ArrowRight size={14} className="text-slate-500 mt-0.5 shrink-0" /><span>{s}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default HelpPanel;
