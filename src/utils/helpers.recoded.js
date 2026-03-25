// src/utils/helpers.js

export const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const formatPrice = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

// Modifié pour accepter un champ dynamique
export const calculateTotal = (node, qtyField = 'qty') => {
  if (!node) return 0;
  if (node.type === 'item') {
    // On récupère la valeur, si elle n'existe pas on prend 0
    const q = parseFloat(node[qtyField] !== undefined ? node[qtyField] : (node.qty || 0));
    const p = parseFloat(node.price || 0);
    return q * p;
  }
  const children = node.children || node.chapters || [];
  return children.reduce((sum, child) => sum + calculateTotal(child, qtyField), 0);
};

export const cleanText = (html) => {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

export const getUniqueBpuCatalog = (project) => {
  const items = [];
  if (!project || !project.chapters) return [];
  const collect = (list) => {
    list.forEach(el => {
      if (el.type === 'item') items.push(el);
      if (el.children) collect(el.children);
    });
  };
  collect(project.chapters || []);
  return Array.from(new Map(items.map(i => [i.designation, i])).values());
};

export const getItemRefMap = (project) => {
  const refMap = new Map();
  if (!project || !project.chapters) return refMap;
  let counter = 1;
  const traverse = (items) => {
    if (!items) return; 
    items.forEach(item => {
      if (item.type === 'item') {
        const key = (item.designation || "").trim().toUpperCase();
        if (!refMap.has(key)) {
          const ref = `P.${String(counter).padStart(2, '0')}`;
          refMap.set(key, ref);
          counter++;
        }
      }
      if (item.children && item.children.length > 0) traverse(item.children);
    });
  };
  project.chapters.forEach(chapter => {
    if (chapter.children) traverse(chapter.children);
  });
  return refMap;
};

// --- CELLE-CI EST CRUCIALE POUR LE CALCUL ---
export const isFixedItem = (item) => {
    if (!item || !item.unit) return false;
    const u = item.unit.trim().toLowerCase();
    const q = item.qty || 0;

    // 1. Unités forfaitaires (Toujours bloquées)
    if (['ens', 'ft', 'f', 'forfait', 'un', 'global'].includes(u)) return true;

    // 2. Petites unités comptables (Bloquées si < 10)
    if (['u', 'pce', 'p', 'un'].includes(u) && q < 10) return true;

    return false;
};

// ------------------------------
// MULTI-BASES LOCALES (BPU)
// ------------------------------
const BPU_DB_PROFILES_KEY = 'bpu_db_profiles_v1';
const BPU_ACTIVE_DB_KEY = 'bpu_active_db_v1';
const BPU_LOCAL_DB_PREFIX = 'bpu_local_db_'; // + <dbId>

export const loadDbProfiles = () => {
  try {
    const raw = localStorage.getItem(BPU_DB_PROFILES_KEY);
    if (!raw) return [{ id: 'cloud', name: 'Base principale (Cloud)' }];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ id: 'cloud', name: 'Base principale (Cloud)' }];
    // Garantit que la base cloud existe
    if (!parsed.find(p => p.id === 'cloud')) parsed.unshift({ id: 'cloud', name: 'Base principale (Cloud)' });
    return parsed;
  } catch {
    return [{ id: 'cloud', name: 'Base principale (Cloud)' }];
  }
};

export const saveDbProfiles = (profiles) => {
  localStorage.setItem(BPU_DB_PROFILES_KEY, JSON.stringify(profiles || []));
};

export const getActiveDbId = () => {
  return localStorage.getItem(BPU_ACTIVE_DB_KEY) || 'cloud';
};

export const setActiveDbId = (id) => {
  localStorage.setItem(BPU_ACTIVE_DB_KEY, id || 'cloud');
};

export const getLocalDbStorageKey = (dbId) => `${BPU_LOCAL_DB_PREFIX}${dbId}`;

export const initLocalDbIfMissing = (dbId, seed = null) => {
  const key = getLocalDbStorageKey(dbId);
  if (localStorage.getItem(key)) return;
  const base = seed || { bpu: [], categories: [], units: [] };
  localStorage.setItem(key, JSON.stringify(base));
};

export const loadLocalDb = (dbId) => {
  try {
    const key = getLocalDbStorageKey(dbId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveLocalDb = (dbId, data) => {
  const key = getLocalDbStorageKey(dbId);
  localStorage.setItem(key, JSON.stringify(data));
};

export const deleteLocalDb = (dbId) => {
  localStorage.removeItem(getLocalDbStorageKey(dbId));
};
