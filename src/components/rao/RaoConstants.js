// src/components/rao/RaoConstants.js

import { FileText, ScrollText, CheckSquare, Brain, MessageSquare, BarChart2 } from 'lucide-react';

// Étapes du workflow RAO — ordre canonique du processus. Source unique pour le
// stepper du ribbon (RaoView), le panneau d'orientation (TabDepouillement) et
// le bandeau « Prochaine étape » (NextStepHint).
// Deux phases : 'avant' (offres initiales) et 'apres' (offres négociées).
// Les étapes 'apres' sont grisées tant que la négociation n'est pas engagée
// (rao.negoEngaged, prix négociés existants ou notation basculée « après négo »).
export const RAO_STEPS = [
  { id: 'consultation',  num: 1, label: 'Consultation',  icon: FileText,      phase: 'avant', hint: 'Critères de jugement et pondérations' },
  { id: 'depouillement', num: 2, label: 'Dépouillement', icon: ScrollText,    phase: 'avant', hint: 'Ouverture des plis et import des offres' },
  { id: 'admin',         num: 3, label: 'Administratif', icon: CheckSquare,   phase: 'avant', hint: 'Pièces et régularité des candidatures' },
  { id: 'technique',     num: 4, label: 'Technique',     icon: Brain,         phase: 'avant', hint: 'Notation des critères techniques' },
  { id: 'recap',         num: 5, label: 'Récap',         icon: BarChart2,     phase: 'avant', hint: 'Classement avant négociation' },
  { id: 'negociation',       num: 6,  label: 'Négociation',   icon: MessageSquare, phase: 'apres', hint: 'Courriers et échanges avec les entreprises', optional: true },
  { id: 'depouillementNego', num: 7,  label: 'Dépouillement', icon: ScrollText,    phase: 'apres', hint: 'Import des offres finales et PV après négo' },
  { id: 'adminNego',         num: 8,  label: 'Administratif', icon: CheckSquare,   phase: 'apres', hint: 'Statuts après négociation et régularisations' },
  { id: 'techniqueNego',     num: 9,  label: 'Technique',     icon: Brain,         phase: 'apres', hint: 'Notes ajustées sur les offres finales' },
  { id: 'recapNego',         num: 10, label: 'Récap final',   icon: BarChart2,     phase: 'apres', hint: 'Classement final et export du rapport' },
];

export const CONCLUSION_OPTIONS = [
  { value: 'reguliere',    label: 'Offre régulière',    color: 'emerald' },
  { value: 'irreguliere',  label: 'Offre irrégulière',  color: 'red' },
  { value: 'inacceptable', label: 'Offre inacceptable', color: 'red' },
  { value: 'inappropriee', label: 'Offre inappropriée', color: 'orange' },
];

// Statuts d'offre « non réguliers » (CCP L2152-2 et s.). Source unique consommée par
// l'analyse technique (UI desktop/mobile + PDF §8) et le calcul de complétion :
// ces offres sont écartées de l'analyse technique.
export const NON_REGULAR_STATUSES = ['irreguliere', 'inacceptable', 'inappropriee'];

export const COMPANY_UI_COLORS = [
  { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-500/20' },
  { border: 'border-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', ring: 'ring-violet-500/20' },
  { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-500/20' },
  { border: 'border-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', ring: 'ring-rose-500/20' },
  { border: 'border-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500', ring: 'ring-cyan-500/20' },
  { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
];

export const FORMULA_LABELS_CONSULT = {
  f1: 'F1 — Pmin / P',
  f2: 'F2 — (Pmin/P)²',
  f3: 'F3 — (Pmin/P)³',
  f4: 'F4 — 1 − (P−Pmin)/Pmin',
  f5: 'F5 — 1 − (P−Pmin)/Pmoy',
  f6: 'F6 — mixte √/²',
  f7: 'F7 — linéaire Pmin→Pmax',
  f8: 'F8 — N·Pmoy/(Pmoy+P)',
  f9: 'F9 — 2·Pmin/(Pmin+P)',
};