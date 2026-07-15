# Design System EstimaVRD — Apple-style Light + Tablette

> Référence UI détachée de `CLAUDE.md` (économie tokens). **Lire avant tout travail d'interface.**

## Philosophie
Minimalisme Apple : fond clair, beaucoup de blanc, ombres douces, coins très arrondis, typographie SF Pro. Pas de dark mode, pas de glow, pas de neon.

## Palette globale

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

## Composants récurrents

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

## Couleurs par thème (Hub Bento Box)

| Rangée | Usage | Style carte |
|--------|-------|-------------|
| **Row 1** | Projet & Estimation | Cartes blanches, icônes grises, badges gris-argent |
| **Row 2** | Outils & Administration | Dark copper (`from-amber-950/90`), icônes amber, badges cuivrés |
| **Row 3** | Paramètres & Compte | Dark amethyst (`from-violet-950/90`), icônes violet, badges violets |

## Couleurs par dossier (Gestion de Projets)
`src/views/projectManager/folderColors.js` : 6 couleurs rotatives (**blue, amber, violet, emerald, rose, cyan**). Chaque dossier reçoit une couleur par index ; les tuiles projets héritent (fond, bordure, bande latérale `w-1.5`, badge). Sans dossier → gris neutre. Classes tranchées (`bg-{color}-50`, `border-{color}-300`, `bg-{color}-500`).

## Règles de design
1. **Jamais de dark mode** sauf cartes Row 2/3 du hub (copper/amethyst glass).
2. **Coins** : `rounded-2xl` min cartes, `rounded-xl` boutons/inputs.
3. **Ombres** : au hover uniquement (`hover:shadow-lg`), jamais au repos (sauf header blur).
4. **Hover** : `hover:-translate-y-0.5` cartes, `active:scale-[0.97]` mobile.
5. **Transitions** : `duration-200` interactions, `duration-700` animations d'entrée.
6. **Icônes** : Lucide React, `strokeWidth={1.5}`, 16-22px.
7. **Espacement** : `gap-4` entre cartes, `px-6 py-5` intérieur.
8. **Pas de glow/neon/drop-shadow coloré** sur le design light.

## EstimaMobileStyle — variante mobile haute lisibilité (chantier, plein soleil)

| Règle | Détail |
|-------|--------|
| **Contraste fort** | Principal `text-gray-900`, secondaire `text-gray-700` min (jamais `gray-300/400`) |
| **Fond** | `bg-[#f5f5f7]`, cartes `bg-white border-gray-200` (bordures visibles) |
| **Header** | `bg-white/70 backdrop-blur-xl border-gray-200/50`, texte `text-gray-900` |
| **Onglets actifs** | `bg-gray-900 text-white shadow-sm rounded-xl` (noir, impossible à rater) |
| **Onglets inactifs** | `bg-gray-100 text-gray-600` |
| **Container onglets** | `bg-gray-100 rounded-2xl p-1` (segmented control) |
| **Icônes fonctionnelles** | Fond opaque (`bg-blue-50`, `bg-amber-50`, `bg-rose-100`), pas de `/10` |
| **Prix/montants** | `text-gray-900 font-bold` ou `text-blue-600 font-bold` |
| **Badges** | Fond opaque (`bg-indigo-100 text-indigo-700`), pas de transparence |
| **Toast** | `bg-gray-900 text-white rounded-2xl` |
| **Prose (HTML)** | Texte `#6b7280`, strong `#374151`, titres `#111827`, bordures `#e5e7eb` |

**Fichiers** : `src/components/mobile/` (styles partagés dans `MobileStyles.jsx`).

---

## Support Tablette (Galaxy Tab S10 FE & autres)

**Détection** — `useDeviceMode()` → `{ isPhone, isTablet, isDesktop, layoutMode, forceLayout }`.
- Phone : UA phone OU (touch + width < 768). Tablet : UA tablet OU (touch + 768 ≤ width ≤ 1366). Desktop : le reste.
- Détecte la tablette **même en mode « site desktop »** (UA sans Android/Mobile). Override persisté dans `localStorage.estima_force_layout`.

**Container mobile** (`MobileApp.jsx`) — Phone : `max-w-md` portrait / `w-full` paysage. **Tablette** : `max-w-2xl` portrait / `max-w-6xl` paysage.

**Hub mobile** — Phone `grid-cols-2` ; tablette portrait `grid-cols-2` (cartes plus grandes) ; tablette paysage `grid-cols-3`.

**Split-view** (tablette paysage) — liste 360px gauche + détail flex-1. Composant `SplitView` en haut de `MobileApp.jsx`. Modules : Projets, CRC, MOE, Visites, Docs Admin. Empty state si rien de sélectionné.

**Bascule mobile ↔ desktop** (tablette only) — bouton 🖥️ (Monitor) dans header `MobileHubView` ; bouton 📱 flottant (Smartphone) injecté via `useEffect` dans `App.jsx`. Jamais sur phone ni desktop PC.

**Capture caméra** (mode desktop, tablette/mobile) — deux inputs cachés côte à côte :
```jsx
<input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
<input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddImages} />
```
`capture="environment"` ouvre l'app photo (fallback file picker desktop). Compression auto `utils/imageCompressor`. Utilisé : `CrrObservations.jsx`, `SiteVisitsView.jsx`.

**Breakpoints** — `md` (768+) tablette portrait ; `lg` (1024+) PC ; `xl` (1280+) grand écran (ribbon CRC single-line, colonnes obs pleine largeur). Ribbon CRC : `flex-wrap` + dividers masqués sous xl, `flex-nowrap` + overflow-x + dividers visibles à partir de xl.
