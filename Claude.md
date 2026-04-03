# Claude.md – EstimaVRD Workflow & Agents

**V2.0** | Avril 2026 | Samuel & Claude | Économe tokens

---

## 1. Principes Core

| Principe | Détail |
|----------|--------|
| **Incrémental** | Petites itérations, tests rapides, déploi progressif |
| **Pragmatique** | Pas d'over-engineering, solutions simples d'abord |
| **Français** | Code métier, docs, messages git |
| **Traçabilité** | Audit trail (Firestore history/), Sentry errors, git logs |

---

## 2. Stack & Architecture

```
Frontend:    React 18 + Vite | Tailwind (dark, emerald accents)
Backend:     Firebase (Auth, Firestore, Hosting)
Exports:     jsPDF, ExcelJS, html2canvas
Monitoring:  Sentry + ErrorBoundary
PWA:         Service Worker manual, icons 30x, offline
Tests:       Vitest (business logic)
Code Split:  Dynamic (jsPDF, ExcelJS, html2canvas)
```

**Patterns clés**: Modular views (`src/views/{module}/`), custom hooks Firestore, audit via `history/` subcoll, multi-tenant isolation, branding centralisé (`masterBranding`), typo PDF fixe (H1 14pt, H2 12pt, H3 11pt, body 10pt).

---

## 2b. Commandes npm Essentielles

| Commande | Rôle |
|----------|------|
| `npm run dev` | Démarrer dev server Vite (http://localhost:5173) |
| `npm run build` | Build production (dist/) |
| `npm run preview` | Prévisualiser build prod localement |
| `npm run lint` | ESLint (code quality) |
| `npm run test` | Vitest (unit tests) |
| `npm run deploy` | Firebase deploy (Hosting + Firestore rules) |

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

---

## 3. Modules EstimaVRD

| Module | Statut | Rôle | Stockage | Notes |
|--------|--------|------|----------|-------|
| **Estimation** | Prod | Devis projet VRD | Firestore docs | JSON save/open |
| **BPU Manager** | Prod | Gestion BPU + prix | Firestore subcoll | Exporte Excel, PDF |
| **CCTP/RC** | Prod | Marché + RC export | PDF generators | `pdfCctpRcGenerator.js` |
| **Branding** | Prod | Identité visuelle | `masterBranding` | Modal 4-onglets |
| **Compte Rendu Chantier** | WIP | Observations chantier | CRC collection | Carry-forward incomplètes |
| **Document Admin** | WIP | Docs administratives | Admin-docs collection | Templates, role-restricted |
| **PWA Mobile** | Prod | App mobile offline | Service Worker | Partage natif `shareInterceptor.js` |

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

---

## 8. Checklist Pre-Push

- [ ] Linter passe (`npm run lint`)
- [ ] Imports résolus (Vite)
- [ ] Firestore rules OK (multi-tenant)
- [ ] Branding utilisé (fonts, colors depuis config)
- [ ] Components mémoïzés si listes
- [ ] ErrorBoundary sur vues critiques
- [ ] Pas de `console.log()`, secrets
- [ ] Build OK (0 warnings)
- [ ] Desktop + mobile responsive
- [ ] Git messages français clairs

---

## 9. Structure & Conventions

```
src/views/{module}/           # Modular = views/bpu/, views/projectManager/, etc.
src/components/               # Partagés: Branding, ErrorBoundary, etc.
src/utils/pdf/               # PDF generators (jsPDF)
src/utils/hooks/             # Custom Firestore hooks
src/App.jsx                  # Sidebar nav + routing
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

- [ ] CRC: form → Firestore → PDF complet
- [ ] Admin-docs: templates éditables + role check
- [ ] Intégration CRC/Admin-docs Sidebar
- [ ] Vitest CRC business logic
- [ ] Dynamic split Admin-docs
- [ ] Firestore rules CRC/Admin-docs
- [ ] Lighthouse audit + optimisation

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
   - Mise à jour Claude.md (V2.1, V2.2, etc.)
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

---

## Versioning & Amélioration Continue

| V | Date | Changes |
|---|------|---------|
| 2.1 | Avril 2026 | **Travail Préparatoire Silencieux** (@analyze, @refactor-proposal, @audit, @doc-gen, @test-gen) |
| 2.0+ | Avril 2026 | Auto-amélioration cycle + Refactoring Proactif |
| 2.0 | Avril 2026 | Couverture complète EstimaVRD, agents, économe tokens |
| 1.0 | Avril 2026 | Initial (CRC + Admin-docs) |

**Chaque session peut trigger une V2.1, V2.2, etc.** via cycle amélioration, refactor, ou mode silencieux.

---

**Update ce fichier en même temps que les features ! 🚀**
