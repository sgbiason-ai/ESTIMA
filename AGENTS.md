# AGENTS.md – EstimaVRD Workflow & Agents

**V2.5** | Juin 2026 | Samuel & Codex | Économe tokens

---

## ⚡ Règles d'Or (à lire en PREMIER)

1. **Toujours poser des questions avant de coder** — utiliser `AskUserQuestion` pour affiner la demande, surtout sur les choix UX/design (breakpoints, layout, composant). Ne pas deviner.
2. **JAMAIS commit sans demander** explicitement l'accord utilisateur. Présenter le diff/récap, attendre le feu vert.
3. **JAMAIS deploy sans demander** explicitement. Commande : `firebase deploy --only hosting` (pas de `npm run deploy`).
4. **Français par défaut** — code métier, messages git, communication.
5. **Court et direct** — bullets > paragraphes, snippets 10-20 lignes max, pas de politesses superflues.
6. **Changelog à jour** — si changement visible utilisateur : bump `APP_VERSION` + ligne dans `src/data/changelog.js`.

---

## 1. Principes Core

| Principe | Détail |
|----------|--------|
| **Incrémental** | Petites itérations, tests rapides, déploi progressif |
| **Pragmatique** | Pas d'over-engineering, solutions simples d'abord |
| **Français** | Code métier, docs, messages git |
| **Traçabilité** | Audit trail (Firestore history/), Sentry errors, git logs |
| **Questions d'abord** | Clarifier avant de coder (AskUserQuestion) |
| **Deploy contrôlé** | Demander systématiquement avant commit/deploy |

---

## 2. Stack & Architecture

```
Frontend:    React 18 + Vite | Tailwind (fond clair Apple-style)
Backend:     Firebase (Auth, Firestore, Hosting)
Exports:     jsPDF, ExcelJS, html2canvas
Monitoring:  Sentry + ErrorBoundary
PWA:         Service Worker manual, icons 30x, offline
Tests:       Vitest (business logic)
Code Split:  Dynamic (jsPDF, ExcelJS, html2canvas)
```

**Patterns clés**: Modular views (`src/views/{module}/`), custom hooks Firestore, audit via `history/` subcoll, multi-tenant isolation, branding centralisé (`masterBranding`), typo PDF fixe (H1 14pt, H2 12pt, H3 11pt, body 10pt).

---

## 2a. Design System — Apple-style Light

### Philosophie
Minimalisme Apple : fond clair, beaucoup de blanc, ombres douces, coins très arrondis, typographie SF Pro. Pas de dark mode, pas de glow, pas de neon.

### Palette globale

| Élément | Valeur |
|---------|--------|
| **Fond page** | `bg-[#f5f5f7]` (gris Apple) |
| **Cartes** | `bg-white` ou gradient pastel léger (`from-{color}-50 to-white`) |
| **Bordures** | `border-gray-200/60` (subtiles) |
| **Texte principal** | `text-gray-900` |
| **Texte secondaire** | `text-gray-400` / `text-gray-500` |
| **Accent principal** | Gradient `from-blue-600 to-indigo-600` (greeting, liens) |
| **Accent teal** | `from-teal-500 via-cyan-500 to-teal-400` (nom utilisateur hub) |
| **Succès** | `text-emerald-600`, `bg-emerald-50` |
| **Danger** | `text-red-500`, `hover:bg-red-50` |
| **Font** | `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif` |

### Composants récurrents

| Composant | Style Tailwind |
|-----------|---------------|
| **Header/Toolbar** | `bg-white/80 backdrop-blur-xl border-b border-gray-200/60` |
| **Carte Bento** | `rounded-[20px]` ou `rounded-2xl`, `border`, `p-5`, `hover:shadow-lg hover:-translate-y-0.5` |
| **Badge/Tag** | `px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase` |
| **Bouton pill** | `rounded-xl`, `hover:bg-gray-100` |
| **Segmented control** | `bg-gray-100 p-0.5 rounded-xl` → enfant actif `bg-white shadow-sm` |
| **Input** | `bg-gray-100 border-gray-200/60 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100` |
| **Footer** | `text-[10px] text-gray-400`, centré, `bg-transparent` ou `bg-white/60` |
| **Modal** | `rounded-3xl shadow-2xl max-w-lg`, overlay `bg-black/20 backdrop-blur-sm` |

### Couleurs par thème (Hub Bento Box)

Le hub utilise 3 rangées de cartes avec des traitements visuels différents :

| Rangée | Usage | Style carte |
|--------|-------|-------------|
| **Row 1** | Projet & Estimation | Cartes blanches, icônes grises, badges gris-argent |
| **Row 2** | Outils & Administration | Cartes dark copper (`from-amber-950/90`), icônes amber, badges cuivrés |
| **Row 3** | Paramètres & Compte | Cartes dark amethyst (`from-violet-950/90`), icônes violet, badges violets |

### Couleurs par dossier (Gestion de Projets)

Palette rotative définie dans `src/views/projectManager/folderColors.js` :
- 6 couleurs : **blue, amber, violet, emerald, rose, cyan**
- Chaque dossier reçoit une couleur par index (rotation)
- Les tuiles projets héritent de la couleur de leur dossier (fond, bordure, bande latérale, badge)
- Projets sans dossier → couleur neutre grise
- Classes bien tranchées : `bg-{color}-50`, `border-{color}-300`, bande `w-1.5 bg-{color}-500`

### Règles de design

1. **Jamais de dark mode** sauf sur les cartes Row 2/3 du hub (copper/amethyst glass)
2. **Coins arrondis** : `rounded-2xl` minimum pour les cartes, `rounded-xl` pour boutons/inputs
3. **Ombres** : uniquement au hover (`hover:shadow-lg`), jamais au repos (sauf header blur)
4. **Hover** : `hover:-translate-y-0.5` sur les cartes, `active:scale-[0.97]` sur mobile
5. **Transitions** : `duration-200` pour les interactions, `duration-700` pour les animations d'entrée
6. **Icônes** : Lucide React, `strokeWidth={1.5}`, taille 16-22px selon contexte
7. **Espacement** : `gap-4` entre cartes, `px-6 py-5` padding intérieur cartes
8. **Pas de glow/neon/drop-shadow coloré** sur le design light

### EstimaMobileStyle — Variante mobile haute lisibilité

Le mobile hérite d'EstimaStyle avec des ajustements pour l'usage extérieur (chantier, plein soleil) :

| Règle | Détail |
|-------|--------|
| **Contraste fort** | Texte principal `text-gray-900`, secondaire `text-gray-700` minimum (jamais `gray-300/400`) |
| **Fond** | `bg-[#f5f5f7]` global, cartes `bg-white border-gray-200` (bordures bien visibles) |
| **Header** | `bg-white/70 backdrop-blur-xl border-gray-200/50`, texte `text-gray-900` |
| **Onglets actifs** | `bg-gray-900 text-white shadow-sm rounded-xl` (noir, impossible à rater) |
| **Onglets inactifs** | `bg-gray-100 text-gray-600` (gris moyen, pas clair) |
| **Container onglets** | `bg-gray-100 rounded-2xl p-1` (segmented control Apple) |
| **Icônes fonctionnelles** | Fond opaque (`bg-blue-50`, `bg-amber-50`, `bg-rose-100`), pas de `/10` |
| **Prix et montants** | `text-gray-900 font-bold` ou `text-blue-600 font-bold` |
| **Badges** | Fond opaque (`bg-indigo-100 text-indigo-700`), pas de transparence |
| **Toast** | `bg-gray-900 text-white rounded-2xl` |
| **Prose (HTML)** | Texte `#6b7280`, strong `#374151`, titres `#111827`, bordures `#e5e7eb` |

**Fichiers** : `src/components/mobile/` (21 fichiers), styles partagés dans `MobileStyles.jsx`

---

## 2a-bis. Support Tablette (Galaxy Tab S10 FE & autres)

### Détection device
Hook `useDeviceMode()` → `{ isPhone, isTablet, isDesktop, device, layoutMode, forceLayout }`
- Détecte tablette **même en mode "site desktop"** (UA sans Android/Mobile)
- Phone : UA phone OU (touch + width < 768)
- Tablet : UA tablet (iPad, Android non-Mobile) OU (touch + 768 ≤ width ≤ 1366)
- Desktop : tout le reste
- `layoutMode = 'mobile' | 'desktop'` consommé par `App.jsx`
- Override utilisateur persisté dans `localStorage.estima_force_layout`

### Container mobile adaptatif (`MobileApp.jsx`)
| Device | Portrait | Paysage |
|--------|----------|---------|
| Phone | `max-w-md` (448px) | `w-full` |
| **Tablette** | **`max-w-2xl`** (672px) centré | **`max-w-6xl`** (1152px) centré |

### Hub mobile sur tablette
- Phone : `grid-cols-2` (inchangé)
- **Tablette portrait** : `grid-cols-2` (container élargi donc cartes plus grandes)
- **Tablette paysage** : `grid-cols-3`

### Split-view (tablette paysage uniquement)
- Liste à gauche (360px fixe) + détail à droite (flex-1)
- Composant réutilisable `SplitView` défini en haut de `MobileApp.jsx`
- Modules concernés : **Projets, CRC, MOE, Visites de Site, Documents Admin**
- Empty state si aucune sélection (icône + label "Sélectionnez X à gauche")
- `ProjectsList` accepte `selectedId` pour highlight bleu de la ligne active

### Bascule mobile ↔ desktop (tablette uniquement)
- **Bouton 🖥️** (Monitor) dans header `MobileHubView` → passer en desktop
- **Bouton 📱** (Smartphone) flottant en bas à droite (desktop) → passer en mobile (injecté via `useEffect` dans App.jsx)
- Jamais affichés sur phone (useless) ni desktop PC

### Capture caméra (tablette/mobile, mode desktop)
Pattern : deux inputs cachés côte à côte — un avec `capture="environment"`, l'autre sans.
```jsx
<input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
<input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddImages} />
```
- `capture="environment"` ouvre l'app photo directement sur tablette/mobile, fallback file picker sur desktop
- Compression auto via `utils/imageCompressor`
- Utilisé dans :
  - `CrrObservations.jsx` (CRC desktop) : boutons "Photo" + "Caméra"
  - `SiteVisitsView.jsx` ObsEditModal : boutons "Ajouter une image" + "Prendre une photo"

### Breakpoints Tailwind utilisés
| Breakpoint | Width | Usage EstimaVRD |
|------------|-------|-----------------|
| `md` | 768px+ | Tablette portrait (grille 2 cols hub desktop) |
| `lg` | 1024px+ | PC classique (grille 3 cols hub desktop, cartes flex-1) |
| `xl` | 1280px+ | Grand écran (ribbon CRC single-line, colonnes observation pleine largeur) |

### Ribbon CRC responsive
- **< xl (1280px)** : `flex-wrap` → 2 lignes si nécessaire, dividers masqués (`hidden xl:block`)
- **xl+** : `flex-nowrap` + `overflow-x-auto`, dividers visibles

### Tableau observations CRC responsive (`CrrObservations.jsx`)
Colonnes réduites sous xl pour laisser plus de place au texte :
- Émetteur : `w-14` → `xl:w-24`
- Date obs/action : `w-[105px]` → `xl:w-32`
- PAR : `w-14` → `xl:w-28`
- Header grid : `grid-cols-[24px_60px_110px_1fr_200px_24px] xl:grid-cols-[30px_100px_120px_1fr_280px_30px]`

---

## 2b. Commandes npm Essentielles

| Commande | Rôle |
|----------|------|
| `npm run dev` | Démarrer dev server Vite (http://localhost:5173) |
| `npm run build` | Build production (dist/) |
| `npm run preview` | Prévisualiser build prod localement |
| `npm run lint` | ESLint (code quality) |
| `npm run test` | Vitest (unit tests) |
| `firebase deploy --only hosting` | **Deploy prod** (pas de script npm, commande directe) |
| `firebase deploy` | Deploy complet (hosting + rules) — à utiliser rarement |

---

## 2c. Firestore Schema (Collections)

```
projects/                           # Collection projets
  {projectId}/
    ├── metadata (doc)              # Nom, client, dates
    ├── estimation (doc)            # JSON save/open
    ├── branding (doc)              # masterBranding custom
    ├── bpu/                        # Subcollection BPU
    │   └── {bpuId} (doc)
    ├── analysis/                   # Subcollection Analyse Prix (RAO)
    │   └── data (doc)              # {companies, scoringConfig, lastSaved}
    ├── rao/                        # Subcollection Rapport RAO
    │   └── data (doc)              # {rao: {consultation, criteria, companies...}, lastSaved}
    ├── crc/                        # Subcollection CRC (WIP)
    │   └── {crcId} (doc)
    │       └── history/ (subcoll)  # Audit trail
    ├── admin-docs/                 # Subcollection Admin (WIP)
    │   └── {docId} (doc)
    └── history/                    # Audit trail global

users/                              # Collection users
  {userId}/
    ├── metadata (doc)              # Nom, email, role
    └── preferences (doc)           # Theme, langue, etc.
```

**Rules essentielles:**
- Ownership check: `match /projects/{projectId} { allow if user_id == auth.uid }`
- Multi-tenant isolation: Jamais croiser projectId entre users
- History subcoll: Read-only, créée automatiquement

---

## 2d. Variables Environnement

```bash
# .env.local (NE PAS committer)

# Firebase
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx

# Sentry
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx

# App
VITE_APP_ENV=development     # development | production
VITE_APP_VERSION=2.0.0
```

**À .gitignore :** `.env.local`, `.env.*.local`

---

## 2e. Problèmes Connus & Solutions

| Problème | Symptôme | Solution |
|----------|----------|----------|
| **Vite import cache** | Erreur path après refactor | `npm run dev` redémarrer (ou kill + relancer) |
| **Service Worker stale** | Vieille version en prod | Clear cache browser ou force update SW |
| **Firestore timeout** | Document > 1MB | Splitter en subcollections |
| **Firebase quota** | "Permission denied" en prod | Vérifier rules + user ownership |
| **jsPDF font reset** | Police change après page break | Déjà fixé (voir `pdfGenerator.js`) |
| **ExcelJS memory** | Crash sur gros export | Lazy-load + stream si possible |
| **CORS PWA** | Fail partage natif | shareInterceptor.js gère, vérifier manifest |
| **Branding not applied** | Styles vieux | Hard refresh (Cmd+Shift+R) ou clear cache |
| **Tab S10 FE en desktop** | Tablette force "site desktop" (UA sans Android) → bascule inattendue | `useDeviceMode` détecte via touch + width, override possible via bouton flottant |
| **Preview server mort** | `preview_list` renvoie vide après long run | Relancer `npm run dev` si besoin de preview MCP |
| **Ribbon CRC déborde tablette** | Scroll horizontal moche en portrait | Déjà géré : `flex-wrap xl:flex-nowrap` + dividers responsive |

---

## 3. Modules EstimaVRD

| Module | Statut | Rôle | Stockage | Notes |
|--------|--------|------|----------|-------|
| **Estimation** | Prod | Devis projet VRD | Firestore docs | JSON save/open |
| **BPU Manager** | Prod | Gestion BPU + prix | Firestore subcoll | Exporte Excel, PDF |
| **RAO & Analyse** | Prod | Analyse offres + rapport | Firestore subcoll dédiées | `analysis/data` + `rao/data` |
| **CCTP/RC** | Prod | Marché + RC export | PDF generators | `pdfCctpRcGenerator.js` |
| **Branding** | Prod | Identité visuelle | `masterBranding` | Modal 4-onglets |
| **Compte Rendu Chantier** | WIP | Observations chantier | CRC collection | Carry-forward incomplètes |
| **Document Admin** | WIP | Docs administratives | Admin-docs collection | Templates, role-restricted |
| **PWA Mobile** | Prod | App mobile offline | Service Worker | 7 modules dont RAO |

---

## 4. Utilisation des Agents

### Pattern Agents = Délégation de Tâches

**Quand utiliser un agent:**
- Tâche répétitive ou multi-étape (refactor, tests, docs)
- Besoin de chercher/analyser du code (repo scan, patterns)
- Génération de boilerplate (composants, utils, hooks)
- Debugging systématique (logs, stack traces, audit)

**Formulation agent efficace** (court + contexte):
```
@agent refactor-module
Décompose src/views/bpu/BpuExportView.jsx en structure modulaire.
Sauvegarde dans src/views/bpu/{subdir}/ avec imports corrigés.
Vérifier paths Vite après refactor.
```

### Types d'Agents Courants

| Agent | Usage | Input |
|-------|-------|-------|
| **search-patterns** | Trouver tous les usages d'une func | "trouver `generatePDF` dans views/" |
| **refactor-split** | Décomposer composant monolithique | Fichier + structure cible |
| **audit-security** | Vérifier Firestore rules, secrets | Module path |
| **generate-tests** | Vitest pour logique métier | Fonction exportée |
| **debug-trace** | Analyser erreur + propose fix | Stack trace + contexte |
| **docs-auto** | JSDoc + README pour module | Dossier source |

**Prompt agent = concis + détails tech essentiels**.

---

## 5. Workflow Rollback

1. **Branch isolée**: `git branch feature/nom`
2. **Commit logiques**: Messages clairs (français)
3. **Build local**: `npm run build && npm run preview`
4. **Vérifications**: Linter, console errors, Firestore rules, branding, responsive
5. **Test feature**: End-to-end (pas juste "c'compile")
6. **Rollback rapide**: `git reset --hard HEAD~1` si issues
7. **Deploy progressif**: Preview → prod après validation

---

## 6. Demande Optimale

```
[FEATURE|BUG|REFACTOR] Titre court

**Contexte**: Où + pourquoi (métier)
**Attendu**: Étapes utilisateur ou résultat technique
**Tech**: Fichiers impliqués, erreur si dispo, screenshot
**Constraints**: Time-box? Dépendances? Restrictions?

Exemple:
[FEATURE] Carry-forward CRC incomplets
Superviseurs chantier → observer observations non finalisées.
1. Créer CRC "Semaine 2" 2. Charger obs précédentes → voir status != 'résolu'
Firestore query obs.where(status != 'résolu') + UI form.
Time-box: 45 min.
```

---

## 7. Communication Efficace

| ✅ Faire | ❌ Éviter |
|----------|----------|
| Snippets 10-20 lignes | "Ça marche pas" |
| Stack trace + ligne | "Regarde le code" |
| "Utilisateur veut X car Y" | Demandes floues |
| Limitations Firestore mentionnées | Recharger conversation entière |
| Questions précises | Vague "aide-moi" |
| Tableaux & bullets | Paragraphes longs |
| "Build OK, voici diff, on deploy ?" | Deploy direct sans demander |
| AskUserQuestion pour UX/design | Deviner les breakpoints/couleurs |

### Préférences utilisateur confirmées

- **Questions d'abord** : avant tout changement d'UX ou refactor, utiliser `AskUserQuestion` avec 3-4 options pour affiner. Le user préfère décider tôt que voir un code à refaire.
- **Validation avant commit/deploy** : présenter un récap structuré (bullets + tableau) du diff, demander "on commit / on deploy ?", attendre le feu vert.
- **Pragmatique** : solutions simples d'abord. Éviter les refactors larges sauf demande explicite.
- **Itérations courtes** : préfère 5 petits commits clairs à 1 gros commit monolithique.

---

## 8. Checklist Pre-Push

- [ ] Linter passe (`npm run lint`)
- [ ] Imports résolus (Vite)
- [ ] Firestore rules OK (multi-tenant)
- [ ] Branding utilisé (fonts, colors depuis config)
- [ ] Components mémoïzés si listesfirebase deploy
- [ ] ErrorBoundary sur vues critiques
- [ ] Pas de `console.log()`, secrets
- [ ] Build OK (0 warnings)
- [ ] Desktop + mobile responsive
- [ ] Git messages français clairs
- [ ] **Changelog mis à jour** (`src/data/changelog.js`) — voir règle ci-dessous

### Règle Changelog Automatique

**Quand mettre à jour ?** → Si l'utilisateur peut **voir ou ressentir** la différence.
- ✅ Nouvelle feature, refonte visuelle, correction de bug visible, nouveau module
- ❌ Refactor interne, fix typo code, ajustement CSS mineur, nettoyage imports, MAJ dépendances

**Comment ?** Codex DOIT :
1. **Bumper `APP_VERSION`** dans `src/data/changelog.js` (patch pour fix, minor pour feature)
2. **Ajouter le highlight** en une ligne concise dans `highlights[]` de l'entrée courante
3. **Ne pas créer de nouvelle entrée** si la version est déjà en cours — enrichir l'existante

**Fichier** : `src/data/changelog.js`

---

## 9. Structure & Conventions

```
src/views/{module}/           # Modular = views/bpu/, views/projectManager/, etc.
src/views/RaoView.jsx         # Rapport RAO (5 onglets, sauvegarde Firestore manuelle)
src/components/               # Partagés: Branding, ErrorBoundary, etc.
src/components/analysis/      # Analyse financière: Table, Toolbar, OabDetailModal
src/components/rao/           # RAO: RaoUI, RaoConstants, tabs/ (Consultation, Admin, Technique, Négo, Récap)
src/components/mobile/        # Mobile: 7 modules dont RAOView (4 onglets consultation)
src/hooks/usePriceAnalysis.js # Analyse prix — Firestore dédié (analysis/data), auto-save debounced
src/hooks/useRao.js           # RAO — critères, sous-critères, groupements, notation technique
src/hooks/useDeviceMode.js    # Device detection (phone/tablet/desktop) + toggle layout
src/hooks/useIsMobile.js      # Legacy — préférer useDeviceMode
src/hooks/useOrientation.js   # Portrait/paysage pour MobileApp
src/utils/imageCompressor.js  # Compression auto images (camera + upload)
src/utils/pdf/               # PDF generators (jsPDF)
src/utils/hooks/             # Custom Firestore hooks
src/App.jsx                  # Sidebar nav + routing + FAB switch-to-mobile (tablette)
```

**Nommage**: Components `PascalCase`, fonctions `camelCase`, constantes `UPPER_SNAKE`, Firestore `snake_case`.

---

## 10. Gestion Erreurs

- **Sentry**: `Sentry.captureException()` + ErrorBoundary views principales
- **Firestore**: Try-catch `permission-denied` (multi-tenant), Sentry tagging
- **UI**: Feedback utilisateur clair (toast, modal) + logs serveur

---

## 11. Sessions Types

| Type | Durée | Périmètre |
|------|-------|-----------|
| **Rapide** | < 1h | 1 bug fix ou petite feature |
| **Feature** | 2-4h | Nouvelle feature complète + tests |
| **Architecture** | 4h+ | Refactor majeur, Firestore rules, docs |

---

## 12. Backlog Actif

- [x] RAO: Sauvegarde Firestore dédiée (analysis/data + rao/data)
- [x] RAO: Import Excel multi-onglets + fallback ref
- [x] RAO: Sous-critères avec pondération hiérarchique
- [x] RAO: Groupement d'entreprises (admin par membre)
- [x] RAO: OAB détail (modale calcul Double Moyenne)
- [x] RAO: Vue mobile 4 onglets + module hub
- [x] RAO: Volets figés analyse financière (sticky left)
- [x] **Support tablette Galaxy Tab S10 FE** (useDeviceMode, container adaptatif, split-view)
- [x] **Bascule mobile ↔ desktop** avec bouton flottant sur tablette
- [x] **Hub mobile multi-colonnes** sur tablette (2 portrait / 3 paysage)
- [x] **Split-view liste+détail** Projets / CRC / MOE / Visites / Docs Admin en paysage tablette
- [x] **Hub desktop responsive** (2 cols md, 3 cols lg, hauteurs naturelles sous lg)
- [x] **Caméra tablette** sur CRC + Visites de Site (capture="environment")
- [x] **CRC participants** repliés par défaut + toggle "tout déplier/tout replier"
- [x] **Ribbon CRC multi-lignes** sous xl (flex-wrap tablette portrait)
- [x] **Table observations CRC** responsive (colonnes compactées sous xl)
- [x] **Audit 2026-06 — Perf bundle** : helper preload Vite isolé, vendor-pdf/leaflet/quill hors chemin critique (**-49 %** chargement initial)
- [x] **Audit 2026-06 — Bugs hooks** : 5 hooks conditionnels corrigés (FicheRecap, ExeReceptionForm, CrcDetailView) → `rules-of-hooks` à 0
- [x] **Audit 2026-06 — RAO source unique** : scoring f1-f9 + OAB Double Moyenne centralisés dans `analysisCompute` (`scoreOffer` / `computeOABThreshold`), mobile aligné sur desktop (clamp `[0,N]`), +25 tests
- [x] **Audit 2026-06 — Résilience** : `ErrorBoundary` variant `inline` par module (helper `Lazy`) → crash de vue isolé
- [x] **Audit 2026-06 — Fix env** : `firebase.js` ne lit plus `window` à l'import (suite verte, +21 tests débloqués)
- [ ] RAO: Export PDF avec sous-critères et groupements
- [ ] CRC: form → Firestore → PDF complet
- [ ] Admin-docs: templates éditables + role check
- [~] Vitest business logic : **RAO/OAB couverts** (`analysisCompute.test.js`) ; CRC carry-forward (`useCrrManager`) encore à tester
- [ ] Lighthouse audit + optimisation
- [ ] Split-view autres modules (MOE subView, BPU subView si pertinent)
- [ ] Export PDF RAO avec sous-critères et groupements
- [ ] **Audit — Firestore rules** : super-admin par custom claim (vs email en dur), wildcard `{document=**}` en read-only, validation des tailles, ownership intra-tenant
- [ ] **Audit — Perf** : `React.memo(PriceCell)` + virtualisation `AnalysisTable` ; `useFeedback` `limit(100)` ; PWA precache `globIgnores` ; TTL collection `history/`
- [ ] **Audit — ESLint** : 23 erreurs `only-export-components` à nettoyer
- [ ] **Audit — xlsx** : migration ExcelJS reportée (arbitrage perte `.xls`) ; 2 vulns critiques restantes (impact client-side faible)
- [ ] **Audit — Test flaky** : assertion wall-clock `stressTest <200ms` à fiabiliser

---

## 13. Auto-amélioration du Workflow

**Cycle 4-étapes intégré** (Workflow + Refactoring):

```
1. CLARIFIER
   - Identifie friction / inefficacité / duplication code
   - Décris le problème précisément
   
2. PROPOSER
   - Je propose solution (feature improvement ou refactor)
   - Montre impact (tokens, temps, clarté, maintenabilité)
   
3. VALIDER
   - Tu approuves ou ajuste
   - On finalise ensemble
   
4. CODER
   - Implémentation + test
   - Mise à jour AGENTS.md (V2.1, V2.2, etc.)
```

### Refactoring Proactif

**Je propose refactoring quand :**
- **Code duplication** : même logique répétée 2+ fois
- **Composants monolithiques** : fichier > 300 lignes (split?)
- **Import paths** : risque d'erreur Vite après future modif
- **Performance** : re-renders inutiles, props drilling, lazy-load candidate
- **Erreur patterns** : même bug corrigé 2x → pattern manquant
- **Technical debt** : hardcodes, TODO laissés, patterns incohérents

**Format proposition refactor :**
```
🔧 REFACTOR PROPOSE

Fichier: src/views/bpu/BpuExportView.jsx (420 lignes)

Problème: 
- Trop gros, mélange form + export + state management
- 3 custom hooks imbriquées (lisibilité ↓)
- Duplication logique avec ProjectManagerView

Proposition:
- Split en: BpuForm.jsx, BpuExportPanel.jsx, useBpuData.js
- Réutilise logique commune via shared hook
- Réduit de 420 → 150 lignes par composant

Impact:
- Temps: 1.5h refactor + test
- Maintenabilité: +40% (modules indépendants)
- Réutilisabilité: CRC/Admin-docs peuvent réutiliser hooks

Validation nécessaire? (oui/non/ajuste)
```

### Travail Préparatoire Silencieux (@analyze, @refactor-proposal, @audit, @doc-gen)

Je fais **analyse + réflexion complète** → te présente **synthèse + propositions finales** (0 interrupt).

**Processus silencieux:**
```
TOI: "@analyze BpuExportView"

MOI (silencieusement):
  ✓ Scan code + dépendances
  ✓ Détecte duplication, monolithe, perf
  ✓ Pense archi optimale
  ✓ Prépare exemples
  ✓ Évalue time-box
  
→ Présentation structurée:
  📋 État actuel (problèmes)
  🎯 Proposition archi (avec schéma)
  📝 Exemple code
  🧪 Plan tests (si dispo)
  ⏱️ Time-box estimé
  
TOI: Valide/ajuste → MOI: Code
```

**Triggers disponibles:**

| Trigger | Usage | Output |
|---------|-------|--------|
| `@analyze {module}` | Audit complet code | Problèmes + recommandations |
| `@refactor-proposal {file}` | Archi optimale | Refactor plan + code exemple |
| `@audit {scope}` | Security + perf + debt | Rapport structuré |
| `@doc-gen {composant}` | JSDoc + README | Docs complètes |
| `@test-gen {fonction}` | Vitest cases | Tests paramétrés |

**Avantages:**
- ✅ Tu codes en parallèle (0 idle time)
- ✅ Synthèse prête (validation rapide)
- ✅ Réflexion profonde (pas de pseudo-pensée)
- ✅ Format standard (facile à valider/ajuster)

**Exemple réel:**
```
TOI: "@audit Firestore rules + EstimaVRD"

MOI:
  Rapport d'Audit Security/Perf
  
  🔴 CRITIQUES:
  - /projects/{projectId}/bpu accessible sans ownership check
  - history/ collection peut exploser (paginate?)
  
  🟡 DEBT:
  - Duplication logique useProjectData vs useBpuData
  - 3 custom hooks imbriquées → prop drilling
  
  💡 PERF:
  - Lazy-load jsPDF/ExcelJS (déjà fait ✓)
  - CRC form: useMemo sur observers list
  
  ⏱️ Time-box priorités: 2h (rules) + 3h (refactor hooks)
  
TOI: "Fix rules en priorité, refactor en sprint suivant"
MOI: Code rules + tests
```

---

## 14. FAQ Rapide

| Q | A |
|---|---|
| **Nouvelle vue ?** | Dossier `src/views/mon-module/`, composant principal, intégration Sidebar + App.jsx routing |
| **Erreurs import Vite ?** | Redémarre dev server, vérifie paths relatifs |
| **Persistance Firestore ?** | Définis subcollection, custom hook `useMonFeature()`, gestion erreur + Sentry |
| **Branding system ?** | Importe `masterBranding`, accède `branding.fonts.h1`, PDF generators déjà intégrés |
| **Multi-tenant ?** | Firestore rules vérifient ownership, pas de cross-tenant queries |
| **Données RAO ?** | Document dédié `projects/{id}/analysis/data` (auto-save) + `projects/{id}/rao/data` (save manuel bouton) |
| **Import Excel RAO ?** | Multi-onglets (tranches), fallback par n° ref (P.01...), `usePriceAnalysis.js` |
| **Sous-critères RAO ?** | `criteria[].subCriteria[]` avec `{id, label, description, weight}`, pondération parent = Σ |
| **Groupement entreprises ?** | `admin.isGroupement` + `admin.groupementMembers[]` par entreprise, pièces admin par membre |
| **Vue mobile RAO ?** | `src/components/mobile/RAOView.jsx` — charge depuis Firestore dédié, 4 onglets |
| **Détection tablette ?** | `useDeviceMode()` retourne `{ isTablet, layoutMode, forceLayout }`. Tab S10 FE détectée même en "site desktop" |
| **Forcer vue desktop sur tablette ?** | Bouton 🖥️ dans header hub mobile, ou `localStorage.setItem('estima_force_layout', 'desktop')` |
| **Ajouter capture caméra ?** | Input caché `type="file" accept="image/*" capture="environment"`. Voir CrrObservations.jsx pour pattern |
| **Split-view sur tablette ?** | Composant `SplitView` dans MobileApp.jsx. Activé quand `isTablet && isLandscape` |
| **Breakpoint tablette portrait ?** | 768-1023px → ciblé via `md:` (768+) et `max-lg:` (< 1024). `xl:` (1280+) pour PC |
| **Preview MCP ?** | `preview_list` pour voir serveurs, `preview_eval('window.location.reload()')` pour refresh |

---

## Versioning & Amélioration Continue

| V | Date | Changes |
|---|------|---------|
| 2.5 | Juin 2026 | **Audit complet** (6 commits) : perf bundle −49 % (preload Vite isolé), 5 bugs hooks conditionnels corrigés, fix `firebase.js` lecture `window` à l'import, **RAO source unique** (scoring f1-f9 + OAB Double Moyenne dans `analysisCompute`, mobile aligné desktop, +25 tests), **ErrorBoundary par module** (variant `inline`). Backlog audit ajouté (§12) : Firestore rules, perf AnalysisTable, ESLint, xlsx |
| 2.4 | Avril 2026 | **Support tablette Galaxy Tab S10 FE** : useDeviceMode, container adaptatif, split-view listes, hub multi-colonnes, caméra tablette (CRC + Visites), ribbon responsive, table observations compactée, toggle déplier/replier participants. **Règles d'Or** : questions d'abord, demander avant commit/deploy |
| 2.3 | Avril 2026 | **Module RAO complet** : sauvegarde Firestore dédiée, sous-critères, groupements, OAB détail, volets figés, vue mobile RAO 4 onglets, hub mobile 2x3, import Excel multi-onglets + fallback ref, export/import JSON |
| 2.2 | Avril 2026 | **Changelog intégré** + règle auto-update AGENTS.md |
| 2.1 | Avril 2026 | **Refonte visuelle** Bento Box Apple, météo, couleurs dossiers, design light |
| 2.0+ | Avril 2026 | Auto-amélioration cycle + Refactoring Proactif |
| 2.0 | Avril 2026 | Couverture complète EstimaVRD, agents, économe tokens |
| 1.0 | Avril 2026 | Initial (CRC + Admin-docs) |

### Versions `APP_VERSION` récentes (voir `src/data/changelog.js`)
| Version | Apport |
|---------|--------|
| 2.4.7 | Ribbon CRC multi-lignes sous xl (flex-wrap tablette/laptop) |
| 2.4.6 | CRC : toggle "tout déplier / tout replier" participants |
| 2.4.5 | CRC : groupes participants repliés par défaut |
| 2.4.4 | Caméra tablette sur CRC + Visites de Site (capture="environment") |
| 2.4.3 | Fix chevauchement hub desktop sur tablette portrait |
| 2.4.2 | Tablette : hub multi-colonnes + split-view listes |
| 2.4.1 | Support tablette Samsung Galaxy Tab S10 FE (useDeviceMode, toggle) |

**Chaque session peut trigger une V2.1, V2.2, etc.** via cycle amélioration, refactor, ou mode silencieux.

---

**Update ce fichier en même temps que les features ! 🚀**
