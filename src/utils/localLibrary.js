// src/utils/localLibrary.js
//
// Helpers d'accès à la "bibliothèque de travail local" (mode BPU local) via localStorage,
// sans passer par le hook useLocalMode (utile depuis Gestion de Projets, qui ne monte pas
// le DatabaseView). useLocalMode reste source de vérité quand Estima est monté :
// ces helpers se contentent de lire/écrire les mêmes clés.

const KEYS = {
  active: 'bpu_local_active',
  data: 'bpu_local_data',
  categories: 'bpu_local_categories',
  id: 'bpu_local_id',
  name: 'bpu_local_name',
  importedAt: 'bpu_local_imported_at',
  backup: 'bpu_local_backup',
};

const safeParse = (raw, fallback) => {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

/**
 * Lit la bibliothèque locale active. Retourne null si le mode local n'est pas actif.
 * @returns {{ id, name, importedAt, bpu, categories } | null}
 */
export function getActiveLocalLibrary() {
  try {
    if (localStorage.getItem(KEYS.active) !== 'true') return null;
    const bpu = safeParse(localStorage.getItem(KEYS.data), null);
    if (!Array.isArray(bpu)) return null;
    return {
      id: localStorage.getItem(KEYS.id) || null,
      name: localStorage.getItem(KEYS.name) || '',
      importedAt: localStorage.getItem(KEYS.importedAt) || null,
      bpu,
      categories: safeParse(localStorage.getItem(KEYS.categories), []),
    };
  } catch {
    return null;
  }
}

/**
 * Sauvegarde la biblio active vers la clé "backup" (pour restauration manuelle ultérieure).
 * Ne fait rien si aucune biblio active. Retourne true si une sauvegarde a été créée.
 */
export function backupActiveLocalLibrary() {
  const current = getActiveLocalLibrary();
  if (!current) return false;
  try {
    localStorage.setItem(KEYS.backup, JSON.stringify({ ...current, backedUpAt: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.warn('[localLibrary] backup échoué (quota?):', e?.message);
    return false;
  }
}

/**
 * Active la bibliothèque locale fournie (remplace l'actuelle dans localStorage).
 * L'appelant est responsable d'avoir backupé l'ancienne via backupActiveLocalLibrary si nécessaire.
 *
 * @param {{ id?, name?, importedAt?, bpu, categories? }} lib
 */
export function setActiveLocalLibrary(lib) {
  if (!lib || !Array.isArray(lib.bpu)) throw new Error('Bibliothèque invalide');
  try {
    localStorage.setItem(KEYS.active, 'true');
    localStorage.setItem(KEYS.data, JSON.stringify(lib.bpu));
    localStorage.setItem(KEYS.categories, JSON.stringify(lib.categories || []));
    if (lib.id) localStorage.setItem(KEYS.id, lib.id); else localStorage.removeItem(KEYS.id);
    if (lib.name) localStorage.setItem(KEYS.name, lib.name); else localStorage.removeItem(KEYS.name);
    if (lib.importedAt) localStorage.setItem(KEYS.importedAt, lib.importedAt); else localStorage.removeItem(KEYS.importedAt);
  } catch (e) {
    console.error('[localLibrary] écriture échouée:', e?.message);
    throw e;
  }
}

/**
 * Désactive le mode local sans toucher aux données stockées (l'utilisateur pourra les
 * réactiver plus tard via le toggle DatabaseView, comme aujourd'hui).
 */
export function deactivateLocalLibrary() {
  try { localStorage.setItem(KEYS.active, 'false'); } catch { /* ignore */ }
}

/**
 * Compare deux bibliothèques pour savoir si elles représentent le même contenu.
 * Heuristique : ID prioritaire, sinon nom + count d'items.
 */
export function librariesMatch(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  // Fallback heuristique : même nom + même nombre d'items
  const sameName = (a.name || '').trim() === (b.name || '').trim();
  const sameCount = Array.isArray(a.bpu) && Array.isArray(b.bpu) && a.bpu.length === b.bpu.length;
  return sameName && sameCount;
}

export const LOCAL_LIBRARY_KEYS = KEYS;

/**
 * Compare les items utilisés par un projet à une bibliothèque BPU.
 * Détecte :
 *  - IDs référencés par le projet (via item.uid) absents de la biblio → missing
 *  - Items présents dans les deux mais avec un prix différent → divergent
 *
 * @param {object} project Projet (avec chapters et éventuellement tranches)
 * @param {Array} libraryItems Items de la biblio active (Cloud ou local)
 * @returns {{ itemsChecked, missingIds, divergentPrices, hasDifferences }}
 */
export function compareProjectVsLibrary(project, libraryItems) {
  const result = { itemsChecked: 0, missingIds: [], divergentPrices: [], hasDifferences: false };
  if (!project || !Array.isArray(libraryItems)) return result;

  // Indexer la biblio par uid ET id (un item BPU peut être référencé par l'un ou l'autre)
  const byKey = new Map();
  for (const b of libraryItems) {
    if (b?.uid != null) byKey.set(String(b.uid), b);
    if (b?.id != null) byKey.set(String(b.id), b);
  }

  const PRICE_EPSILON = 0.001;
  const seen = new Set();

  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      // Un item BPU dans un projet est identifié par son champ "uid" (réf vers la biblio)
      if (node?.uid != null) {
        const key = String(node.uid);
        if (!seen.has(key)) {
          seen.add(key);
          result.itemsChecked++;
          const libItem = byKey.get(key);
          // bpuNum (P.01, P.02…) est le N° lisible affiché dans le devis, plus parlant que l'uid
          const bpuNum = node.bpuNum || libItem?.bpuNum || '';
          if (!libItem) {
            result.missingIds.push({ uid: node.uid, bpuNum, designation: node.designation || '' });
          } else {
            const pProj = Number(node.price ?? node.priceHT ?? 0);
            const pLib = Number(libItem.price ?? libItem.priceHT ?? 0);
            if (Math.abs(pProj - pLib) > PRICE_EPSILON) {
              result.divergentPrices.push({
                uid: node.uid,
                bpuNum,
                designation: node.designation || libItem.designation || '',
                projectPrice: pProj,
                libraryPrice: pLib,
              });
            }
          }
        }
      }
      if (node?.children) walk(node.children);
    }
  };

  walk(project.chapters);
  if (Array.isArray(project.tranches)) {
    for (const t of project.tranches) walk(t.chapters);
  }

  result.hasDifferences = result.missingIds.length > 0 || result.divergentPrices.length > 0;
  return result;
}

