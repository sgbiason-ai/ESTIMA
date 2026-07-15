# CLAUDE.md — EstimaVRD

**V3.1** · Juil. 2026 · app `v3.5.9` · Samuel & Claude · min-tokens

## ⚡ Règles d'Or
1. **Questions d'abord** (`AskUserQuestion`, 3-4 options) avant tout code, surtout UX/design. Décider tôt > refaire.
2. **Jamais commit sans demander** — récap d'abord. Exclure `.claude/settings.local.json` + `.pptx` (`git reset HEAD -- ".claude/settings.local.json" "*.pptx"`).
3. **Jamais deploy sans demander** — `firebase deploy --only hosting`. Règles Firestore : `--only firestore:rules` **séparément** (drift → `permission-denied` employés, faux « Erreur réseau »).
4. **Éditer dans `C:\Projet\Estima\`** — jamais un worktree (le `npm run dev` du user y tourne, `.env.local` absent ailleurs).
5. **Français** partout (code métier, git, com).
6. **Court** : bullets, snippets ≤20 lignes, zéro politesse.
7. **Changelog ≠ version** : enrichir `changelog.js` par défaut ; **ne jamais bumper `APP_VERSION` (`appVersion.js`) sans demande explicite**. Les changes s'accumulent sous l'entrée courante.
8. **Tenir ce fichier à jour + l'améliorer** à chaque feature/refactor (modules, backlog, pièges) — réflexe, sans qu'on le demande.

## Stack
React 18 + Vite · Tailwind (Apple light, **pas de dark mode**) · Firebase (Auth/Firestore/Hosting) · exports jsPDF/ExcelJS/html2canvas (lazy) · Sentry + ErrorBoundary `inline` par module · PWA SW manuel · Vitest. Vues modulaires `src/views/{module}/`, hooks Firestore, branding `masterBranding`, typo PDF fixe (H1 14/H2 12/H3 11/body 10pt).

## Design System & Tablette
→ **`docs/design-system.md`** (palette, composants Tailwind, EstimaMobileStyle, breakpoints, split-view, caméra, Galaxy Tab). **Lire avant tout travail UI.**

## Firestore
```
projects/{id}/ → metadata·estimation·branding (docs) · bpu/ · analysis/data (auto) · rao/data (manuel)
                 · cctp|rc|ccap/data · takeoff/data (assoc. métré DXF par fichier) · ged/ · crc/{id}/history/ · admin-docs/ · history/
users/{id}/    → metadata·preferences
```
Ownership `user_id==auth.uid`, isolation multi-tenant (jamais croiser `projectId`), `history/` read-only.

## Pièges prod (récurrents)
| Piège | Solution |
|---|---|
| Règles Firestore en retard (deploy hosting-only) → `permission-denied` faux « Erreur réseau » | `firebase deploy --only firestore:rules` séparément |
| jsPDF WinAnsi : `−ΔΩ√` → `"”` (Helvetica = CP1252) | texte rendu WinAnsi-safe (`-` pas `−`) |
| IDs doc `__x__` réservés → `setDoc` rejette | préfixer `_cfg_` |
| ExportModal ↔ GED : option = no-op silencieux | répercuter dans `gedExport.exportArchive` |
| Build hors repo sans `.env.local` → prod down | copier `.env.local`, vérifier `grep -c AIza dist/assets/index-*.js` |
| Prix RAO faux (nego/à valoir) | lire via `getEffectiveOffers`, jamais `c.offers` |
| Excel `&8` collé à un chiffre → pied géant | écrire TAILLE puis POLICE `&8&"Aptos"` |
| Doc >1 Mo (photos base64) | subcollections (migration Storage TODO) |
| Vite cache path après refactor | relancer `npm run dev` |
| Tab S10 FE force « site desktop » | `useDeviceMode` (touch+width) + override |

## Modules
| Module | Statut | Note · Stockage |
|---|---|---|
| Estimation | Prod | num. hiérarchique, arborescence, PSE=delta · `estimation` |
| Bibliothèque/BPU | Prod | prix, bases externes, unités Simple/Expert · `bpu/`+`database/` |
| RAO & Analyse des offres | Prod | dépouillement + Rapport + Tableau prix, sous-critères, groupements, OAB · `analysis/data`+`rao/data` |
| Documents CCTP/RC/CCAP | Prod | moteur `docContent.js` (sections `{{#var}}`, art.12 auto `{{derogations}}`, notes ⚑ stripées export), save/projet `useProjectDocStore` · `{moduleKey}/data` |
| GED | Prod | documents émis, `gedExport` · `ged/` |
| CRC | Prod | obs, participants groupes/sous-groupes/labels, exports PDF+Word · `crc/` |
| Docs Admin | WIP | templates, role-check · `admin-docs/` |
| Notes de Frais · Estim. Rapide · MOE Devis | Prod | Firestore |
| Visites de Site | Prod | GPS, photos base64, Tesla plein écran · `siteVisits/` |
| RGPD/Legal · Branding | Prod | `masterBranding` |
| ESTIMA TP | Prod | produit entreprise TP (Phases 1→3, v3.5.8) · `estimaTp/` |
| Métré DXF | POC | `dxf-viewer` (Three.js/WebGL), lecture locale, présentations AutoCAD, isolation calques, clic-pour-isoler + survol (picking par **projection écran** — le raycaster de lignes ne marche pas ici, cf. mémoire ; croix ✕ pour tout réafficher ; vue Modèle), longueurs/surfaces/comptages → articles projet · `src/components/takeoff/` |
| PWA Mobile | Prod | offline, 7+ modules · SW |

## Commandes
`npm run dev` (5173, autoPort) · `build` · `preview` · `lint` · `test` · `firebase deploy --only hosting` (prod) · `--only firestore:rules` (règles). `.env.local` (VITE_FIREBASE_*, VITE_SENTRY_DSN) jamais commité.

## Fichiers clés
```
src/views/{estimaTp,ged,expenseNotes,estimRapide,devisMoe,crc,rao,bpu,projectManager,siteVisits,database,branding,admin}/
src/components/takeoff/        Métré DXF (POC) : DxfTakeoffModal · DxfViewerPanel (rendu+picking) · DxfMappingPanel (calques→articles) · dxfLayoutRendering.js (viewports présentation)
src/data/appVersion.js         APP_VERSION (chemin critique — jamais importer changelog.js)
src/data/changelog.js          historique (~160 Ko, lazy only)
src/utils/analysisCompute.js   source unique scoring f1-f9 + OAB Double Moyenne
src/hooks/usePriceAnalysis.js  analysis/data (auto-save) · useRao.js · useDeviceMode.js
src/App.jsx                    sidebar nav + routing + FAB switch-mobile
```
Nommage : Components PascalCase · fn camelCase · const UPPER_SNAKE · Firestore snake_case.

## Changelog — règle
User-visible (feature/refonte/bug visible/module) → 1 ligne dans `highlights[]` de l'entrée courante `changelog.js`. ❌ Pas pour refactor/typo/CSS mineur. `APP_VERSION` (`appVersion.js`) : **jamais bumper sans « bump/release » explicite** ; pas de nouvelle entrée `CHANGELOG` tant que non bumpée.

## Pre-push
lint · imports Vite · rules multi-tenant (déployées séparément si modifiées) · branding config · ErrorBoundary vues critiques · pas de `console.log`/secret · build OK · responsive desktop+mobile · git FR · commit sans `settings.local.json`/`.pptx` · changelog si user-visible.

## Workflow, agents, erreurs
- **Rollback** : branch → commits FR → `build && preview` → vérifs → test e2e → `git reset --hard HEAD~1` si KO → deploy après validation.
- **Refactor proposé si** : duplication 2+ · fichier >300 lignes · path Vite risqué · re-renders/prop drilling · même bug 2× · hardcodes/TODO.
- **Triggers silencieux** (analyse → synthèse, 0 interruption) : `@analyze {module}` · `@refactor-proposal {file}` · `@audit {scope}` · `@doc-gen` · `@test-gen`.
- **Agents** : Explore/general-purpose (recherche), refactor-split, audit-security, generate-tests, debug-trace. **Jamais d'isolation worktree.**
- **Erreurs** : `Sentry.captureException` + ErrorBoundary `inline` ; try-catch `permission-denied` ; feedback UI (toast/modal).

## Backlog
**Livré récent** : ESTIMA TP (v3.5.8) · DQE prix uniques (v3.5.9) · Docs CCTP/RC/CCAP save/projet · RAO source unique · bundle −49 % · CRC sous-groupes + Word.
**TODO** : RAO export PDF sous-critères/groupements · CRC form→Firestore→PDF + test `useCrrManager` · admin-docs templates+role · photos base64→Storage · Firestore rules (custom claim, validation tailles) · perf (`React.memo(PriceCell)`, virtualisation `AnalysisTable`, TTL `history/`) · ESLint `only-export-components` · migration xlsx→ExcelJS.
**Vulnérabilités npm (audit --force, à traiter isolément)** : jsPDF 2→4 (risque élevé, cœur des exports PDF) · Vite 5→8/esbuild (risque build/PWA) · react-quill (le "fix" 0.0.2 est un downgrade cassé, ne pas appliquer) · ExcelJS (le "fix" 3.4.0 est une régression vs 4.4.0 actuel, ne pas appliquer) · xlsx sans fix dispo (rejoint migration xlsx→ExcelJS ci-dessus). 16 vulnérabilités non-breaking déjà corrigées 2026-07-15 (`npm audit fix`, commit 37c05ec).

## Versions app
3.5.9 DQE prix uniques · 3.5.8 ESTIMA TP + terrain · 3.4.0 CCAP · 3.3.0 PSE + num. hiérarchique · 3.0.0 BPU aperçu/PDF calés Word.

---
**Maj ce fichier avec chaque feature. 🚀**
