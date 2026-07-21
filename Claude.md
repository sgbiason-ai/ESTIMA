# CLAUDE.md — EstimaVRD

**V3.1** · Juil. 2026 · app `v3.11.1` · Samuel & Claude · min-tokens

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
| `storage.rules` avec `firestore.get()` → `storage/unauthorized`, photos « prises mais invisibles » (cross-service casse l'upload) | jamais de `firestore.get()` en règle Storage : `auth+size+content-type` ; ownership côté Firestore/app ; `firebase deploy --only storage` (piège récurrent 3×) |
| jsPDF WinAnsi : `−ΔΩ√` → `"”` (Helvetica = CP1252) | texte rendu WinAnsi-safe (`-` pas `−`) |
| IDs doc `__x__` réservés → `setDoc` rejette | préfixer `_cfg_` |
| ExportModal ↔ GED : option = no-op silencieux | répercuter dans `gedExport.exportArchive` |
| Build hors repo sans `.env.local` → prod down | copier `.env.local`, vérifier `grep -c AIza dist/assets/index-*.js` |
| Prix RAO faux (nego/à valoir) | lire via `getEffectiveOffers`, jamais `c.offers` |
| Excel `&8` collé à un chiffre → pied géant | écrire TAILLE puis POLICE `&8&"Aptos"` |
| Doc >1 Mo (anciennes photos base64) | photos CRC+visites déjà sur Storage ; reste à ré-optimiser les vieilles base64 (bouton comme CRC) |
| Vite cache path après refactor | relancer `npm run dev` |
| Tab S10 FE force « site desktop » | `useDeviceMode` (touch+width) + override |
| CSP `connect-src` sans `blob:` → worker DXF `fetch(blob:)` bloqué (« violates CSP », DXF ne charge pas) | header dans `firebase.json` ; `blob:` requis pour le worker |
| Changement de **header** (CSP…) invisible aux clients PWA : SW Workbox re-précache `index.html` sur la révision du **corps**, pas des headers → ancien header figé | navigations en **NetworkFirst** (`html-shell`, `navigateFallback: undefined`, `fetchOptions: cache no-store`) + shell HTML (`/`, `/index.html`) en no-store dans `firebase.json`. Nécessite rebuild+deploy hosting |
| CSP d'un **worker** = headers de **SA** réponse HTTP (pas du document) ; assets servis `immutable` 1 an → un changement de CSP n'atteint **jamais** un worker au hash inchangé (cache HTTP client, pas de 304, le 304 Firebase omet le CSP de toute façon) | incrémenter `self.__DXF_WORKER_REV` dans `dxfTakeoff.worker.js` (code effectif — un commentaire est strippé par le minifier → hash inchangé) → nouveau hash → URL neuve |
| `firebase.json` headers : la **dernière** règle matchante gagne (même clé) ; `**/*.js` immutable écrasait le no-store de `/sw.js`+`/startup-failsafe.js` | règles spécifiques (no-store) **après** la règle générale immutable |
| `storage` n'est plus exporté par `firebase.js` (isolé dans `firebaseStorage.js`, bc83d19) → `(await import('../firebase')).storage` = `undefined` **silencieux** → getBlob KO, photos absentes des PDF visites/CRC | importer `../firebaseStorage` ; attention aux imports dynamiques oubliés lors d'un split de module |
| `resource-exhausted: Write stream exhausted maximum allowed queued writes` + « maximum backoff delay » : cache **persistant multi-onglets** (`persistentMultipleTabManager`) → un SEUL onglet détient le bail du flux d'écriture ; une fenêtre oubliée (souvent la **PWA installée**) le garde sans l'utiliser → les écritures des autres s'empilent jusqu'à 100. Pendant ce temps le SDK applique tout **localement** : l'UI affiche « enregistré » alors que **rien ne part au serveur** | fermer **toutes** les fenêtres EstimaVRD (onglets + fenêtre PWA), en rouvrir une seule. Vérifier ce qui est réellement en base via une **fenêtre privée** (profil vierge = file vide = vraie vue serveur). Ne pas conclure au réseau : ce n'est PAS un problème de long-polling (piste explorée à tort 2026-07-21) |
| `await Promise.all(...).sort()` : `await` porte sur **toute** l'expression → `.sort` appelé sur la Promise → `TypeError`, `catch`, liste vide. Piège classique en passant un `map` sync en `async` (le `.sort` chaîné marchait sur le tableau) | parenthéser le résultat : `(await Promise.all(...)).sort(...)` — CRC mobile invisible 4 j (2e83bb7 → fix) |
| Renommage propagé par **valeur** (`renameBadgeNameInTree`, supprimée) : tout nœud au même code renommé ensemble → collision garantie sur les valeurs par défaut (« Sous-groupe » → `SOUSG` partout) | toute mise à jour d'arbre cible par **id**, jamais par correspondance de valeur |
| Hook exposant `error` mais consommateur qui ne le destructure pas → **échec silencieux** indistinguable d'une liste vide (« Aucun élément ») ; diagnostic à l'aveugle | consommer `error` et l'afficher (bandeau + « Réessayer ») ; état vide ≠ état d'erreur |
| SW CacheFirst photos Storage : un `<img>` no-cors dépose une réponse **opaque** (status 0) que le `fetch()` cors de l'export PDF reçoit avec `ok=false` → photo ignorée en silence (prod PWA only, dev OK) | retry avec URL modifiée `?swbust=` pour bypasser le cache SW (pdfSiteVisitGenerator, pdfCrrGenerator, crcArchive) |
| **Effet d'amorçage rejoué → saisie écrasée toutes les ~25 s** : un `useEffect` de seeding (`setDrafts(props)`) gardé seulement par `if (!open) return` se rejoue à chaque render du parent si une dep est un **littéral d'objet non mémoïsé** (`useRao.js:75` `consultation`). Le parent rend **sans action utilisateur** : battement `usePresence` (`HEARTBEAT_MS = 25_000`) → `useCoEditors` `setEditors(nouveau tableau)` sans test d'égalité → re-render de `App`. Marche **même seul** (`serverTimestamp()` mute le doc + snapshot local immédiat). Symptôme trompeur : « ça annule régulièrement ce que j'écris », champ **gardant le focus**, sans corrélation avec la frappe → oriente à tort vers l'input, Firestore ou le réseau | amorcer **à l'ouverture seulement** : deps `[open]` + `eslint-disable-next-line react-hooks/exhaustive-deps` (DepouillementModal + DepouillementNegoModal). Ne PAS mémoïser `consultation` à la place : ne traite qu'un maillon, et `existingCompanies` est déjà stable (`useState`). Reproductible **sans login** via un banc d'essai Vite (page `harness.html` + parent qui re-rend sur `setInterval`) — technique à réutiliser quand l'UI est derrière une authentification |
| **Import offre PDF : le `€` suffixant les montants devient un token** → la passe token-based le prend pour l'unité (`looksLikeUnit('€')` faux) ou n'atteint qu'un seul nombre → **0 article extrait** → bascule **silencieuse** sur l'OCR (lent, dégradé) alors que le calque texte est parfaitement lisible. `joinThousandsSpaces` n'aide pas et introduit pire : `1 550,00` (qté 1 × PU 550) lu 1550,00 | passe 0 `parseCurrencyAnchoredLine` (`parsePdfOffer.js`) : segmentation sur `€` (ancrage fiable qui borne chaque montant) + arbitrage par cohérence `qté × PU ≈ montant`. Rend `null` sans `€` → zéro impact sur les autres PDF. Avertissement explicite quand l'OCR démarre alors qu'un calque texte existe |
| **`projectRefMap` : la numérotation auto `P.n` squatte un vrai `bpuNum`**. Une seule passe enregistrait `autoRef` au fil du traversal ; les « prix uniques » ne réincrémentant pas sur un doublon, le `P.43` auto du 43e article prend la clé avant que le traversal n'atteigne le vrai P.43 (plus loin) → repli par n° inopérant, ligne à désignation retouchée rattachée au mauvais article, le bon reste à 0 € | deux passes dans `offerItemMatcher.js` : **tous** les `bpuNum` d'abord, `autoRef` ensuite et seulement sur les clés libres. Enregistrer `P.n` **et** `P.0n` (l'export écrit `P.1`, d'anciens fichiers `P.01` ; `normalizeRef` retire le point) |
| **Import offre RAO : `Map<désignation, itemId>` → collision sur les « prix uniques »**. Un DQE réutilise volontairement le même prix dans plusieurs sous-chapitres avec des quantités différentes (`refMap` de `useProjectCalculations`) : `GNT 0/80` ×3 sous P.22. La Map écrase → une seule ligne reçoit le prix, les autres restent à **0 €** (offre minorée : −27 k€ / −10 % sur un cas réel) ; pire, la qté de la 1re ligne est comparée à la qté MOE d'un **autre** article → fausses divergences → offre **auto-classée irrégulière** (CCP L2152-2). Aucun signal utilisateur : un article à 0 € n'apparaît dans aucun toast ni panneau | `createOfferItemMatcher` (`utils/offerItemMatcher.js`) : `Map<désignation, itemId[]>` en ordre document, chaque ligne consomme l'occurrence libre suivante ; garde-fou = un candidat libre dont la qté MOE coïncide l'emporte sur le positionnel (lignes réordonnées par l'entreprise). Un rang de mise en forme homonyme ne consomme pas (`consume: false`). Partagé par `handleImportExcel` **et** `handleImportVariant` |
| **Aplatissement destructif d'arbre** : `computeChaptersData` traversait les sous-chapitres (`else if (node.children) extract(node.children)`) sans jamais les émettre → l'identité des sous-chapitres (id/title) **détruite**, tout article estampillé du chapitre **racine**. Pas un filtre (`type==='chapter'`, `level<=1`) mais une branche `else if` qui **consomme** le nœud : invisible au grep, le RAO affichait un lot de 40 articles à plat. Copié-collé à l'identique dans 4 aplatisseurs (analysisCompute, pdfRaoGenerator, excelAnalysisGenerator, usePriceAnalysis) | rendre l'aplatissement **non destructif** : chaque article porte `groupPath: [{id,title}]` (chaîne des sous-chapitres, racine exclue), `items` reste **plat** — le contrat est consommé par ~12 `forEach`/`flatMap` dont les 4 exports, un tableau imbriqué les casserait tous. Hiérarchie reconstruite **au rendu** (`AnalysisTable.buildGroupTree`, groupe inséré à la position de son 1er article → ordre DQE préservé). Aucun champ `level`/`depth`/`parentId` n'existe sur les nœuds : chapitre et sous-chapitre sont **structurellement identiques** (`type: 'chapter'`), seule l'imbrication les distingue |
| `<input type="number">` contrôlé par la valeur distante = **saisie effacée sous les doigts** : la spec impose `.value === ''` dès que le contenu n'est pas un *valid floating-point number* (`12,` `12.` `-` `1e`) → `Number('')` = 0 → réécriture du DOM, puis le 0 part en auto-save. Virgule FR ⇒ décimale **jamais** saisissable ; `value \|\| ''` interdit en plus le 0. Diagnostic trompeur (« Firestore annule ma saisie » — il n'y a aucun `onSnapshot` sur `analysis/data`) | tampon local + commit au blur/Entrée (Échap annule) + `type="text" inputMode="decimal"` + parse tolérant virgule : `useNumericDraft` (`components/analysis/`), pattern d'origine `AeAmountInput` (TabDepouillement). Bonus : pendant la frappe seule la cellule se re-rend, plus tout le tableau |

## Modules
| Module | Statut | Note · Stockage |
|---|---|---|
| Estimation | Prod | num. hiérarchique, arborescence, PSE=delta · `estimation` |
| Bibliothèque/BPU | Prod | prix, bases externes, unités Simple/Expert · `bpu/`+`database/` |
| RAO & Analyse des offres | Prod | dépouillement + Rapport + Tableau prix (**sous-chapitres** : entêtes indentées N niveaux + sous-totaux repliables, via `groupPath`), sous-critères, groupements, OAB · `analysis/data`+`rao/data` |
| Documents CCTP/RC/CCAP | Prod | moteur `docContent.js` (sections `{{#var}}`, art.12 auto `{{derogations}}`, notes ⚑ stripées export), save/projet `useProjectDocStore` · `{moduleKey}/data` |
| GED | Prod | documents émis, `gedExport` · `ged/` |
| CRC | Prod | obs, participants groupes/sous-groupes/labels, exports PDF+Word · `crc/` |
| Docs Admin | WIP | templates, role-check · `admin-docs/` |
| Notes de Frais · Estim. Rapide · MOE Devis | Prod | Firestore |
| Visites de Site | Prod | GPS, photos **Firebase Storage** (`siteVisitImageStorage.js`, plus base64), Tesla plein écran · export PDF : **choix des fonds de carte** (modale `SiteVisitExportModal`, aperçu tuile réelle, mémorisé localStorage `estima:siteVisit:pdfViews`) — vignettes d'observation (satellite/plan/cadastre/**double** satellite+plan côte à côte) et carte pleine page réglées séparément · `siteVisits/` + Storage `companies/{id}/site_visits/` |
| RGPD/Legal · Branding | Prod | `masterBranding` |
| ESTIMA TP | Prod | produit entreprise TP (Phases 1→3, v3.5.8) · `estimaTp/` |
| Métré DXF | POC | `dxf-viewer` (Three.js/WebGL), lecture locale, présentations AutoCAD, **gestionnaire de calques** (masquer/afficher multi via `hiddenLayers` Set, isoler sur icône « solo », Tout afficher/masquer, Masquer les résultats filtrés, survol=pré-isolation ; masqué non-sélectionnable ; persisté localStorage), clic-pour-isoler + survol (picking par **projection écran** — le raycaster de lignes ne marche pas ici, cf. mémoire ; croix ✕ pour tout réafficher ; vue Modèle), longueurs/surfaces/comptages → articles projet · **sélection d'élément** : bouton « Sélection » → index par entité construit dans le worker (`buildEntityIndex`, handles DXF, contours tessellés **relatifs à `index.origin`** — float32 vs Lambert), hit-test grille (`dxfEntityPicking.js`), cumul multi-éléments → ligne `sel::<id>::<metric>` associable/persistée (`selections` dans takeoff/data), overlay orange/bleu (scène − `GetOrigin()`) · **exports** : Feuille de métré (tableau) + Historique + **Plan des métrés** (plan capturé sans échelle cadré sur les sélections + légende couleur + tableau détaillé, 1 page vue d'ensemble + 1 zoom/sélection ; capture via `DxfViewerPanel.captureFrames` impératif — `preserveDrawingBuffer:true`, `collectEntityBounds` → `FitView` → composite canvas WebGL + canvas 2D des aplats) · **layout 3 colonnes** : volet « Métrés » (gauche, sélections + calques associés) · Plan (centre) · volet « Calques » (droite, escamotable en rail) ; `DxfMappingPanel` réinstancié 2× via prop `mode` → filtres locaux donc indépendants ; calque associé « migre » à gauche ; `pick` (clic-calque plan) ne cible que le volet layers ; largeurs+repli en localStorage `estima:dxf:layout:{projectId}` · `src/components/takeoff/` |
| PWA Mobile | Prod | offline, 7+ modules · SW |

## Commandes
`npm run dev` (5173, autoPort) · `build` · `preview` · `lint` · `test` · `firebase deploy --only hosting` (prod) · `--only firestore:rules` (règles). `.env.local` (VITE_FIREBASE_*, VITE_SENTRY_DSN) jamais commité.

## Fichiers clés
```
src/views/{estimaTp,ged,expenseNotes,estimRapide,devisMoe,crc,rao,bpu,projectManager,siteVisits,database,branding,admin}/
src/components/takeoff/        Métré DXF (POC) : DxfTakeoffModal (ribbon RibbonParts + layout 3 colonnes) · DxfViewerPanel (rendu+picking+capture) · DxfMappingPanel (prop `mode` metres|layers, réinstancié 2×) · dxfLayoutRendering.js (viewports présentation)
src/utils/takeoff/             pdfTakeoffGenerator.js (Feuille de métré : tableau) · pdfTakeoffPlanGenerator.js (Plan des métrés : plan capturé + légende + tableau) · applyTakeoff.js · dxfTakeoff.js
src/utils/ignTiles.js          tuiles IGN **sans Leaflet** (TILE_LAYERS, buildTileUrl, maths slippy) — source unique carte app + générateurs PDF ; `PDF_MAP_VIEWS` = pile de calques par vue (cadastre = plan+parcellaire), `dual` = 2 vignettes
src/data/appVersion.js         APP_VERSION (chemin critique — jamais importer changelog.js)
src/data/changelog.js          historique (~160 Ko, lazy only)
src/utils/analysisCompute.js   source unique scoring f1-f9 + OAB Double Moyenne
src/utils/offerItemMatcher.js  résolution ligne fichier offre → article DQE (désignations répétées, n° de prix) — partagé import offre + variante
src/utils/parsePdfOffer.js     extraction PDF d'offre : passe monétaire (€) → token-based → OCR Tesseract en secours ; `parseArticleLine` exportée (testable)
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
**TODO** : envoi Outlook CRC = VBScript (déprécié MS ; FoD Windows, désactivation par défaut annoncée ~2027) → bascule à terme vers « Envoyer (web) »/Graph · RAO export PDF sous-critères/groupements · CRC form→Firestore→PDF + test `useCrrManager` · admin-docs templates+role · ré-optimiser anciennes photos base64 visites (bouton comme CRC ; nouvelles déjà sur Storage) · Firestore rules (custom claim, validation tailles) · perf (`React.memo(PriceCell)`, virtualisation `AnalysisTable`, TTL `history/`) · ESLint `only-export-components` · migration xlsx→ExcelJS.
**Vulnérabilités npm (audit --force, à traiter isolément)** : jsPDF 2→4 (risque élevé, cœur des exports PDF) · Vite 5→8/esbuild (risque build/PWA) · react-quill (le "fix" 0.0.2 est un downgrade cassé, ne pas appliquer) · ExcelJS (le "fix" 3.4.0 est une régression vs 4.4.0 actuel, ne pas appliquer) · xlsx sans fix dispo (rejoint migration xlsx→ExcelJS ci-dessus). 16 vulnérabilités non-breaking déjà corrigées 2026-07-15 (`npm audit fix`, commit 37c05ec).

## Versions app
3.5.9 DQE prix uniques · 3.5.8 ESTIMA TP + terrain · 3.4.0 CCAP · 3.3.0 PSE + num. hiérarchique · 3.0.0 BPU aperçu/PDF calés Word.

---
**Maj ce fichier avec chaque feature. 🚀**
