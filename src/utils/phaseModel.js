// src/utils/phaseModel.js
//
// Modèle « phases par affaire » — fonctions PURES (aucune dépendance React/Firebase),
// testées via phaseModel.test.js.
//
// Une affaire possède sa propre liste de phases, définie à la création et éditable
// ensuite : project.phases = [{ id, code, label }]. La phase courante est référencée
// par son id stable (project.phase), insensible au renommage du code.
//
// Rétrocompatibilité : les projets sans project.phases retombent sur la liste
// standard ESQ·AVP·PRO·DCE·EXE, et project.phase peut encore être un code texte
// (ancien format) — les helpers le résolvent indifféremment par id ou par code.

import { generateId } from './helpers';

// ─── Phases standard (modèle pré-rempli à la création) ───────────────
// code = identifiant court (sert à l'indice GED : DCE-A) ; label = libellé complet.
export const DEFAULT_PHASE_DEFS = [
  { code: 'ESQ', label: 'Esquisse' },
  { code: 'AVP', label: 'Avant-Projet' },
  { code: 'PRO', label: 'Projet' },
  { code: 'DCE', label: 'Consultation des Entreprises' },
  { code: 'EXE', label: 'Exécution' },
];

// ─── Palette : couleurs fixes pour les codes connus, rotation sinon ──
const KNOWN_PHASE_COLORS = {
  ESQ: 'purple', AVP: 'amber', PRO: 'blue', DCE: 'emerald', 'DCE+': 'teal', EXE: 'red',
};
const ROTATION_COLORS = ['blue', 'amber', 'violet', 'emerald', 'rose', 'cyan', 'teal', 'indigo'];

// Styles Tailwind par nom de couleur (badges / pastilles / frise).
export const COLOR_STYLES = {
  purple:  { bg: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  amber:   { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  blue:    { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  teal:    { bg: 'bg-teal-500',    light: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  red:     { bg: 'bg-red-500',     light: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  violet:  { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  rose:    { bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  cyan:    { bg: 'bg-cyan-500',    light: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  indigo:  { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  slate:   { bg: 'bg-slate-400',   light: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
};

// Couleur d'une phase : code connu → couleur dédiée, sinon rotation par index.
export const phaseColorFor = (code, index = 0) =>
  KNOWN_PHASE_COLORS[code] || ROTATION_COLORS[index % ROTATION_COLORS.length];

export const styleForColor = (color) => COLOR_STYLES[color] || COLOR_STYLES.slate;

// ─── Construction / normalisation de la liste de phases ──────────────
// Crée une liste de phases {id, code, label} à partir de définitions {code, label}.
export const buildPhases = (defs = DEFAULT_PHASE_DEFS) =>
  (defs || []).map((d) => ({
    id: d.id || `phase_${generateId()}`,
    code: String(d.code || '').trim().toUpperCase(),
    label: String(d.label || d.code || '').trim(),
  }));

// Liste de phases d'un projet, avec repli sur le standard (rétrocompat).
export const getProjectPhases = (project) => {
  if (Array.isArray(project?.phases) && project.phases.length > 0) {
    return project.phases;
  }
  return buildPhases(DEFAULT_PHASE_DEFS);
};

// Résout la phase courante d'un projet (par id stable, ou par code en ancien format).
// Retourne l'objet phase {id, code, label} ou la première phase par défaut.
export const getCurrentPhase = (project) => {
  const phases = getProjectPhases(project);
  const ref = project?.phase;
  if (ref) {
    const byId = phases.find((p) => p.id === ref);
    if (byId) return byId;
    const byCode = phases.find((p) => p.code === String(ref).toUpperCase());
    if (byCode) return byCode;
  }
  return phases[0] || null;
};

// Code court de la phase courante (ESQ, AVP, DCE…), pour pastilles/badges PDF.
// Résout project.phase (id stable OU ancien code) → code lisible. Repli 'DCE'.
export const getCurrentPhaseCode = (project) =>
  getCurrentPhase(project)?.code || 'DCE';

// Index de la phase courante dans la liste (−1 si introuvable).
export const getCurrentPhaseIndex = (project) => {
  const phases = getProjectPhases(project);
  const current = getCurrentPhase(project);
  return current ? phases.findIndex((p) => p.id === current.id) : -1;
};

// Phase suivante suggérée (linéaire souple) — null si déjà à la dernière.
export const getNextPhase = (project) => {
  const phases = getProjectPhases(project);
  const idx = getCurrentPhaseIndex(project);
  if (idx < 0 || idx >= phases.length - 1) return null;
  return phases[idx + 1];
};

// Style d'une phase par son code, en tenant compte de sa position dans la liste.
export const getPhaseStyleFromList = (phases, code) => {
  const idx = (phases || []).findIndex((p) => p.code === code);
  return styleForColor(phaseColorFor(code, idx >= 0 ? idx : 0));
};

// ─── Édition de la liste de phases ───────────────────────────────────
// Indique si une phase peut être supprimée : interdit si des versions figées
// (archives) référencent son code — les archives sont immuables.
export const canRemovePhase = (phase, archives = []) =>
  !(archives || []).some((a) => a.phase === phase.code);

// Validation d'une liste de phases avant enregistrement.
// Retourne { ok, error } — codes non vides, uniques.
export const validatePhases = (phases) => {
  const list = phases || [];
  if (list.length === 0) return { ok: false, error: 'Au moins une phase est requise.' };
  const codes = list.map((p) => String(p.code || '').trim().toUpperCase());
  if (codes.some((c) => !c)) return { ok: false, error: 'Chaque phase doit avoir un code.' };
  const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupes.length > 0) return { ok: false, error: `Code de phase en double : ${dupes[0]}.` };
  return { ok: true, error: null };
};
