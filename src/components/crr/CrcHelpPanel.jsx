// src/components/crr/CrcHelpPanel.jsx
//
// Panneau d'aide modal pour le module Compte Rendu de Reunion.

import React, { useState } from 'react';
import {
  X, BookOpen, Users, ClipboardList, FileDown, Lightbulb,
  Calendar, Plus, Copy, ArrowLeftRight, Trash2, Eye, Edit3,
  Building2, ListTree, Mail, ImagePlus, Compass,
} from 'lucide-react';

const TABS = [
  { id: 'reunions',     label: 'Reunions',     icon: Calendar },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'observations', label: 'Observations', icon: ClipboardList },
  { id: 'exports',      label: 'Exports',      icon: FileDown },
  { id: 'astuces',      label: 'Astuces',      icon: Lightbulb },
];

const Step = ({ number, color, title, children }) => (
  <div className="flex gap-3 mb-3">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${color}`}>
      {number}
    </div>
    <div>
      <div className="text-sm font-bold text-white/90 mb-0.5">{title}</div>
      <div className="text-xs text-white/60 leading-relaxed">{children}</div>
    </div>
  </div>
);

const Kbd = ({ children }) => (
  <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-mono text-white/80">{children}</kbd>
);

const Badge = ({ bg, text, children }) => (
  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${bg} ${text}`}>{children}</span>
);

const TabReunions = () => (
  <div>
    <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
      <Calendar size={18} /> Gestion des reunions
    </h3>
    <Step number={1} color="bg-blue-500" title="Creer un chantier">
      Utilisez le menu deroulant <strong className="text-white/80">Chantier</strong> dans le ruban pour creer ou selectionner un chantier. Chaque chantier contient ses propres reunions, participants et categories.
    </Step>
    <Step number={2} color="bg-emerald-500" title="Creer une reunion">
      Cliquez sur <strong className="text-white/80">Nouveau CR</strong> pour creer une reunion vierge. Le numero est attribue automatiquement.
    </Step>
    <Step number={3} color="bg-amber-500" title="Dupliquer une reunion">
      <strong className="text-white/80">Dupliquer CR</strong> copie la reunion courante avec report automatique des observations non resolues (carry-forward). Ideal pour les reunions periodiques.
    </Step>
    <Step number={4} color="bg-purple-500" title="Audit entre reunions">
      <strong className="text-white/80">Audit CR</strong> compare la reunion courante avec la precedente pour identifier les changements de statut des observations.
    </Step>
    <Step number={5} color="bg-rose-500" title="Navigation">
      Naviguez entre les reunions via la liste laterale gauche. Le numero et la date sont affiches, ainsi qu'un indicateur du nombre d'observations ouvertes.
    </Step>

    <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <div className="text-xs font-bold text-amber-400 mb-1">Conseil</div>
      <div className="text-[11px] text-white/60">
        Pensez a renseigner la date et le lieu de la <strong className="text-white/80">prochaine reunion</strong> dans l'en-tete. Ces informations apparaissent en evidence dans les exports.
      </div>
    </div>
  </div>
);

const TabParticipants = () => (
  <div>
    <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
      <Users size={18} /> Gestion des participants
    </h3>
    <Step number={1} color="bg-blue-500" title="Groupes participants">
      Les participants sont organises par groupes (MOA, MOE, SPS, Entreprises...). Chaque groupe a une <strong className="text-white/80">pastille coloree</strong> unique dans les exports.
    </Step>
    <Step number={2} color="bg-emerald-500" title="Ajouter des contacts">
      Ouvrez le panneau <strong className="text-white/80">Participants</strong> du ruban. Ajoutez des contacts manuellement ou importez depuis un fichier Excel.
    </Step>
    <Step number={3} color="bg-amber-500" title="Presence et diffusion">
      Pour chaque contact, cliquez sur le toggle de presence pour cycler entre les statuts :
      <div className="flex gap-2 mt-2 flex-wrap">
        <Badge bg="bg-emerald-900/50" text="text-emerald-400">P = Present</Badge>
        <Badge bg="bg-amber-900/50" text="text-amber-400">E = Excuse</Badge>
        <Badge bg="bg-slate-700/50" text="text-slate-400">A = Absent</Badge>
        <Badge bg="bg-purple-900/50" text="text-purple-400">NC = Non convoque</Badge>
      </div>
    </Step>
    <Step number={4} color="bg-purple-500" title="CPR et Diffusion">
      <strong className="text-white/80">CPR</strong> = le contact recoit le compte rendu.{' '}
      <strong className="text-white/80">Diffusion</strong> = le contact est en copie de diffusion.
    </Step>
    <Step number={5} color="bg-rose-500" title="Bibliotheque de contacts">
      La bibliotheque (onglet droit du panneau Participants) sauvegarde vos contacts frequents. Glissez-deposez ou importez depuis Excel pour reutiliser entre chantiers.
    </Step>
  </div>
);

const TabObservations = () => (
  <div>
    <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
      <ClipboardList size={18} /> Observations et suivi
    </h3>
    <Step number={1} color="bg-blue-500" title="Ajouter une observation">
      Cliquez sur <strong className="text-white/80">+ Observation</strong> en bas de chaque categorie. Renseignez l'emetteur, le texte, et attribuez un responsable.
    </Step>
    <Step number={2} color="bg-emerald-500" title="Statuts">
      Chaque observation a un statut cliquable :
      <div className="flex gap-2 mt-2 flex-wrap">
        <Badge bg="bg-amber-900/50" text="text-amber-400">Ouvert</Badge>
        <Badge bg="bg-blue-900/50" text="text-blue-400">En cours</Badge>
        <Badge bg="bg-emerald-900/50" text="text-emerald-400">FAIT</Badge>
      </div>
    </Step>
    <Step number={3} color="bg-amber-500" title="Photos jointes">
      Ajoutez des photos aux observations via le bouton <strong className="text-white/80">Photo</strong>. Les images sont incluses dans les exports PDF et Word.
    </Step>
    <Step number={4} color="bg-purple-500" title="Categories">
      Les observations sont classees par categories (Administratif, Planning, Travaux...). Gerez-les via <strong className="text-white/80">Categories</strong> dans le ruban.
    </Step>
    <Step number={5} color="bg-rose-500" title="Carry-forward">
      Lors de la duplication d'une reunion, les observations <strong className="text-white/80">non resolues</strong> (Ouvert, En cours) sont automatiquement reportees dans le nouveau CR avec la mention du numero d'origine.
    </Step>
  </div>
);

const TabExports = () => (
  <div>
    <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
      <FileDown size={18} /> Exports et partage
    </h3>
    <Step number={1} color="bg-blue-500" title="Export PDF">
      Genere un document PDF professionnel avec en-tete, participants, observations et pied de page. Ideal pour archivage officiel.
    </Step>
    <Step number={2} color="bg-emerald-500" title="Export Word">
      Genere un fichier .doc ouvert dans Word. Utile pour modifier le contenu avant envoi ou pour archivage modifiable.
    </Step>
    <Step number={3} color="bg-amber-500" title="Envoi par email">
      Ouvre votre client mail avec les destinataires CPR pre-remplis et le CR en piece jointe. Les contacts marques <strong className="text-white/80">CPR</strong> recoivent automatiquement le mail.
    </Step>
    <Step number={4} color="bg-purple-500" title="Mode apercu">
      Basculez en mode <strong className="text-white/80">Apercu</strong> pour visualiser le rendu final avant export. L'apercu reproduit fidelement le PDF.
    </Step>

    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
      <div className="text-xs font-bold text-blue-400 mb-1">Legende des colonnes</div>
      <div className="text-[11px] text-white/60 space-y-1">
        <div><strong className="text-white/80">P</strong> = Present &nbsp; <strong className="text-white/80">E</strong> = Excuse &nbsp; <strong className="text-white/80">A</strong> = Absent &nbsp; <strong className="text-white/80">NC</strong> = Non convoque</div>
        <div><strong className="text-white/80">C</strong> = CPR (destinataire du CR) &nbsp; <strong className="text-white/80">D</strong> = Diffusion</div>
      </div>
    </div>
  </div>
);

const TabAstuces = () => (
  <div>
    <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
      <Lightbulb size={18} /> Astuces et raccourcis
    </h3>

    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-bold text-emerald-400 mb-2">Correcteur orthographique</div>
        <div className="text-[11px] text-white/60">
          Les champs texte (observations, noms, labels) integrent le correcteur orthographique du navigateur. Les mots mal orthographies sont <strong className="text-white/80">soulignes en rouge</strong>. Faites un <strong className="text-white/80">clic droit</strong> pour voir les suggestions.
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-bold text-emerald-400 mb-2">Glisser-deposer</div>
        <div className="text-[11px] text-white/60">
          Reorganisez les groupes participants et les contacts par glisser-deposer. Dans la bibliotheque, glissez un contact vers un groupe pour l'ajouter.
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-bold text-emerald-400 mb-2">Import Excel</div>
        <div className="text-[11px] text-white/60">
          Importez vos listes de participants depuis un fichier Excel (.xlsx). Le fichier doit contenir les colonnes : <strong className="text-white/80">Nom, Email, Telephone</strong> (optionnel).
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-bold text-emerald-400 mb-2">Toggles rapides</div>
        <div className="text-[11px] text-white/60">
          Cliquez sur les boutons de presence pour cycler : <strong className="text-white/80">P → E → A → NC → P</strong>. Meme principe pour les statuts d'observations : <strong className="text-white/80">Ouvert → En cours → FAIT → Ouvert</strong>.
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-bold text-emerald-400 mb-2">Sauvegarde automatique</div>
        <div className="text-[11px] text-white/60">
          Toutes les modifications sont sauvegardees automatiquement dans le cloud (Firestore). Pas besoin de bouton "Enregistrer".
        </div>
      </div>
    </div>
  </div>
);

const TAB_CONTENT = {
  reunions: TabReunions,
  participants: TabParticipants,
  observations: TabObservations,
  exports: TabExports,
  astuces: TabAstuces,
};

const CrcHelpPanel = ({ onClose, onStartTour }) => {
  const [activeTab, setActiveTab] = useState('reunions');
  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div
        className="bg-[#0f1e2a] rounded-2xl shadow-2xl w-[680px] max-h-[85vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <BookOpen size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Aide — Compte Rendu</h2>
              <p className="text-[10px] text-white/40">Guide complet du module CRC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onStartTour && (
              <button
                onClick={() => { onClose(); onStartTour(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
              >
                <Compass size={14} />
                Tour guide
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white/10 text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Content />
        </div>
      </div>
    </div>
  );
};

export default CrcHelpPanel;
